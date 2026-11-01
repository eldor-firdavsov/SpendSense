import { SupabaseClient } from '@supabase/supabase-js';
import type { Insight, InsightStatus } from '../../types/database.ts';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function resolveClient(providedClient?: SupabaseClient): Promise<SupabaseClient> {
  if (providedClient) return providedClient;
  const { createClient } = await import('../supabase/server.ts');
  return await createClient();
}

/**
 * Scans user transactions and active budgets to generate deterministic, evidence-grounded insights
 */
export async function generateAndSaveInsights(
  client?: SupabaseClient
): Promise<ServiceResult<{ generatedCount: number; insights: Insight[] }>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch recent transactions
    const { data: rawTxs } = await supabase
      .from('transactions')
      .select('id, description, amount, type, currency, transaction_date, merchant, category_id, categories(name)')
      .eq('user_id', user.id)
      .gte('transaction_date', thirtyDaysAgo)
      .order('transaction_date', { ascending: false });

    const transactions = rawTxs || [];
    const newInsights: Array<Record<string, unknown>> = [];

    // --- A. Detect Unusual Spending Spikes ---
    const categorySums: Record<string, { total: number; count: number; name: string }> = {};
    for (const t of transactions) {
      if (t.type === 'expense') {
        const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
        const catName = cat?.name || 'Uncategorized';
        const key = t.category_id || '__uncat__';
        if (!categorySums[key]) categorySums[key] = { total: 0, count: 0, name: catName };
        categorySums[key].total += Number(t.amount);
        categorySums[key].count += 1;
      }
    }

    for (const t of transactions) {
      if (t.type === 'expense') {
        const key = t.category_id || '__uncat__';
        const stats = categorySums[key];
        if (stats && stats.count >= 2) {
          const avg = stats.total / stats.count;
          const amt = Number(t.amount);
          // Flag if individual transaction is > 2.5x the category average and >= $50
          if (amt >= 2.5 * avg && amt >= 50) {
            newInsights.push({
              user_id: user.id,
              type: 'spending_spike',
              title: `${stats.name}: xarajatlarning keskin oshishi`,
              explanation: `"${t.description}" uchun sarflangan ${t.currency} ${amt.toFixed(2)} miqdoridagi to‘lov (${t.transaction_date}) ${stats.name} kategoriyasidagi 30 kunlik o‘rtacha sarf-xarajatingizdan (${t.currency} ${avg.toFixed(2)}) ancha yuqori.`,
              confidence: 'high',
              evidence_metadata: {
                transaction_id: t.id,
                amount: amt,
                category_name: stats.name,
                category_average: Math.round(avg * 100) / 100,
              },
              period_start: thirtyDaysAgo,
              period_end: today,
            });
          }
        }
      }
    }

    // --- B. Detect Potential Recurring Charges ---
    const merchantMap: Record<string, Array<{ id: string; amount: number; date: string; desc: string }>> = {};
    for (const t of transactions) {
      if (t.type === 'expense') {
        const merchantKey = (t.merchant || t.description).toLowerCase().trim();
        if (!merchantMap[merchantKey]) merchantMap[merchantKey] = [];
        merchantMap[merchantKey].push({
          id: t.id,
          amount: Number(t.amount),
          date: t.transaction_date,
          desc: t.description,
        });
      }
    }

    for (const [merch, entries] of Object.entries(merchantMap)) {
      if (entries.length >= 2) {
        // Sort ascending by date
        entries.sort((a, b) => a.date.localeCompare(b.date));
        for (let i = 0; i < entries.length - 1; i++) {
          const a = entries[i];
          const b = entries[i + 1];
          const diffDays = Math.round(
            (new Date(b.date).getTime() - new Date(a.date).getTime()) / 86400000
          );
          // Check for monthly recurring interval (25 to 35 days) with same amount (within 5%)
          if (diffDays >= 25 && diffDays <= 35 && Math.abs(a.amount - b.amount) / a.amount <= 0.05) {
            newInsights.push({
              user_id: user.id,
              type: 'recurring_charge',
              title: `Davriy obuna to‘lovi: ${b.desc}`,
              explanation: `Har ${diffDays} kunda "${b.desc}" uchun taxminan $${b.amount.toFixed(2)} miqdoridagi oylik davriy to‘lov aniqlandi.`,
              confidence: 'high',
              evidence_metadata: {
                merchant: merch,
                average_amount: b.amount,
                interval_days: diffDays,
                transaction_ids: [a.id, b.id],
              },
              period_start: thirtyDaysAgo,
              period_end: today,
            });
            break;
          }
        }
      }
    }

    // --- C. Check Active Budgets for Alerts ---
    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, name, amount, currency, start_date, end_date')
      .eq('user_id', user.id)
      .lte('start_date', today)
      .gte('end_date', today);

    const budgetResults = await Promise.all(
      (budgets || []).map(async (b) => {
        const { data: bTxs } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('currency', b.currency)
          .eq('type', 'expense')
          .gte('transaction_date', b.start_date)
          .lte('transaction_date', b.end_date);

        let spent = 0;
        for (const t of bTxs || []) spent += Number(t.amount);
        const bAmt = Number(b.amount);
        const pct = bAmt > 0 ? (spent / bAmt) * 100 : 0;
        return { b, spent, bAmt, pct };
      })
    );

    for (const { b, spent, bAmt, pct } of budgetResults) {
      if (pct >= 100) {
        newInsights.push({
          user_id: user.id,
          type: 'budget_alert',
          title: `Budjet oshib ketdi: ${b.name}`,
          explanation: `"${b.name}" budjetining (${b.currency} ${bAmt.toFixed(2)}) rejalashtirilgan miqdoridan ortiq, ya'ni ${b.currency} ${spent.toFixed(2)} (${Math.round(pct)}%) mablag‘ sarflangan.`,
          confidence: 'high',
          evidence_metadata: {
            budget_id: b.id,
            budget_amount: bAmt,
            spent,
            percentage_used: Math.round(pct),
          },
          period_start: b.start_date,
          period_end: b.end_date,
        });
      } else if (pct >= 85) {
        newInsights.push({
          user_id: user.id,
          type: 'budget_alert',
          title: `Budjet chegarasiga yaqin: ${b.name}`,
          explanation: `"${b.name}" uchun ajratilgan ${b.currency} ${bAmt.toFixed(2)} budjetining ${Math.round(pct)}% qismi ishlatildi.`,
          confidence: 'medium',
          evidence_metadata: {
            budget_id: b.id,
            budget_amount: bAmt,
            spent,
            percentage_used: Math.round(pct),
          },
          period_start: b.start_date,
          period_end: b.end_date,
        });
      }
    }

    // --- D. Deduplicate and Insert into public.insights ---
    let savedInsights: Insight[] = [];

    if (newInsights.length > 0) {
      // Check existing insights to avoid repeating identical titles within period
      const { data: existing } = await supabase
        .from('insights')
        .select('title')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo);

      const existingTitles = new Set((existing || []).map((e) => e.title));
      const toInsert = newInsights.filter((n) => !existingTitles.has(n.title));

      if (toInsert.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('insights')
          .insert(toInsert)
          .select();

        if (insErr) {
          return { data: null, error: insErr.message, status: 500 };
        }
        savedInsights = (inserted || []) as Insight[];
      }
    }

    // Return all current insights
    const { data: allInsights } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return {
      data: {
        generatedCount: savedInsights.length,
        insights: (allInsights || []) as Insight[],
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Xulosalarni yaratishda xatolik yuz berdi';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Lists insights for the authenticated user
 */
export async function listInsights(
  statusFilter?: InsightStatus,
  client?: SupabaseClient
): Promise<ServiceResult<Insight[]>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    let query = supabase
      .from('insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    return { data: (data || []) as Insight[], error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Xulosalarni olishda xatolik yuz berdi';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Updates status of an insight (viewed, dismissed, resolved)
 */
export async function updateInsightStatus(
  id: string,
  newStatus: InsightStatus,
  client?: SupabaseClient
): Promise<ServiceResult<Insight>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data, error } = await supabase
      .from('insights')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!data) {
      return { data: null, error: 'Xulosa topilmadi', status: 404 };
    }

    return { data: data as Insight, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Xulosa holatini yangilashda xatolik yuz berdi';
    return { data: null, error: msg, status: 500 };
  }
}
