import { SupabaseClient } from '@supabase/supabase-js';
import { analyticsQuerySchema } from './schemas.ts';
import type {
  AnalyticsSummary,
  CategoryBreakdownItem,
  TrendBucket,
  PeriodComparison,
} from './schemas.ts';

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
 * Computes deterministic financial analytics for the authenticated user and specified currency
 */
export async function getAnalyticsSummary(
  queryParams?: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<AnalyticsSummary>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = analyticsQuerySchema.safeParse(queryParams || {});
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid analytics query parameters';
      return { data: null, error: err, status: 400 };
    }

    let { currency } = parseResult.data;
    const { interval } = parseResult.data;

    // If currency not explicitly provided in query, infer from user's transactions
    const rawCurrency = (queryParams as Record<string, unknown> | undefined)?.currency;
    if (!rawCurrency) {
      const { data: firstTx } = await supabase
        .from('transactions')
        .select('currency')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (firstTx?.currency) {
        currency = firstTx.currency;
      }
    }

    // Default date range: current month if not specified
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
      .toISOString()
      .split('T')[0];
    const defaultEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0))
      .toISOString()
      .split('T')[0];

    const startDate = parseResult.data.startDate || defaultStart;
    const endDate = parseResult.data.endDate || defaultEnd;

    // 1. Fetch transactions for current period with category join
    const { data: currentTxs, error: txError } = await supabase
      .from('transactions')
      .select('id, description, amount, type, currency, transaction_date, category_id, categories(id, name, type, icon, color)')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) {
      return { data: null, error: txError.message, status: 500 };
    }

    const transactions = currentTxs || [];

    // 2. Deterministic summary metrics
    let totalIncome = 0;
    let totalExpenses = 0;
    const expenseByCategoryMap = new Map<string, { name: string; icon: string | null; color: string | null; sum: number; count: number }>();
    const incomeByCategoryMap = new Map<string, { name: string; icon: string | null; color: string | null; sum: number; count: number }>();
    const trendMap = new Map<string, { income: number; expense: number }>();

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
      const catId = tx.category_id || '__uncategorized__';
      const catName = cat?.name || 'Uncategorized';
      const catIcon = cat?.icon || null;
      const catColor = cat?.color || null;

      // Trends key determination
      let periodKey = tx.transaction_date;
      if (interval === 'month') {
        periodKey = tx.transaction_date.slice(0, 7); // YYYY-MM
      } else if (interval === 'week') {
        const d = new Date(tx.transaction_date + 'T00:00:00Z');
        const dayOfWeek = d.getUTCDay();
        const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setUTCDate(diff));
        periodKey = monday.toISOString().split('T')[0];
      }

      if (!trendMap.has(periodKey)) {
        trendMap.set(periodKey, { income: 0, expense: 0 });
      }
      const trendEntry = trendMap.get(periodKey)!;

      if (tx.type === 'income') {
        totalIncome += amt;
        trendEntry.income += amt;

        const cur = incomeByCategoryMap.get(catId) || { name: catName, icon: catIcon, color: catColor, sum: 0, count: 0 };
        cur.sum += amt;
        cur.count += 1;
        incomeByCategoryMap.set(catId, cur);
      } else {
        totalExpenses += amt;
        trendEntry.expense += amt;

        const cur = expenseByCategoryMap.get(catId) || { name: catName, icon: catIcon, color: catColor, sum: 0, count: 0 };
        cur.sum += amt;
        cur.count += 1;
        expenseByCategoryMap.set(catId, cur);
      }
    }

    totalIncome = Math.round(totalIncome * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netCashFlow = Math.round((totalIncome - totalExpenses) * 100) / 100;

    // Savings rate rule:
    // If totalIncome <= 0 or netCashFlow <= 0 -> 0%
    // Otherwise (netCashFlow / totalIncome) * 100, capped at 100%
    let savingsRate = 0;
    if (totalIncome > 0 && netCashFlow > 0) {
      savingsRate = Math.min(100, Math.round((netCashFlow / totalIncome) * 10000) / 100);
    }

    const transactionCount = transactions.length;
    const averageTransactionAmount =
      transactionCount > 0 ? Math.round(((totalIncome + totalExpenses) / transactionCount) * 100) / 100 : 0;

    // 3. Category breakdowns
    const buildBreakdown = (
      map: Map<string, { name: string; icon: string | null; color: string | null; sum: number; count: number }>,
      baseTotal: number
    ): CategoryBreakdownItem[] => {
      const items: CategoryBreakdownItem[] = [];
      for (const [key, val] of map.entries()) {
        const totalAmount = Math.round(val.sum * 100) / 100;
        const percentage = baseTotal > 0 ? Math.round((totalAmount / baseTotal) * 10000) / 100 : 0;
        items.push({
          categoryId: key === '__uncategorized__' ? null : key,
          categoryName: val.name,
          categoryColor: val.color,
          categoryIcon: val.icon,
          totalAmount,
          percentage,
          count: val.count,
        });
      }
      return items.sort((a, b) => b.totalAmount - a.totalAmount);
    };

    const expenseBreakdown = buildBreakdown(expenseByCategoryMap, totalExpenses);
    const incomeBreakdown = buildBreakdown(incomeByCategoryMap, totalIncome);

    // 4. Trends sorted chronologically
    const trends: TrendBucket[] = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, { income, expense }]) => {
        const roundedInc = Math.round(income * 100) / 100;
        const roundedExp = Math.round(expense * 100) / 100;
        return {
          periodKey,
          income: roundedInc,
          expense: roundedExp,
          net: Math.round((roundedInc - roundedExp) * 100) / 100,
        };
      });

    // 5. Period-over-period comparison
    // Calculate previous period of equal length
    const startMs = new Date(startDate + 'T00:00:00Z').getTime();
    const endMs = new Date(endDate + 'T00:00:00Z').getTime();
    const durationDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

    const prevEnd = new Date(startMs - 86400000).toISOString().split('T')[0];
    const prevStart = new Date(startMs - durationDays * 86400000).toISOString().split('T')[0];

    const { data: prevTxs } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('transaction_date', prevStart)
      .lte('transaction_date', prevEnd);

    let prevIncome = 0;
    let prevExpense = 0;
    for (const p of prevTxs || []) {
      const amt = Number(p.amount) || 0;
      if (p.type === 'income') prevIncome += amt;
      else prevExpense += amt;
    }
    prevIncome = Math.round(prevIncome * 100) / 100;
    prevExpense = Math.round(prevExpense * 100) / 100;
    const prevNet = Math.round((prevIncome - prevExpense) * 100) / 100;

    const makeComparison = (current: number, previous: number): PeriodComparison => {
      const absoluteChange = Math.round((current - previous) * 100) / 100;
      const percentageChange =
        previous > 0 ? Math.round(((current - previous) / previous) * 10000) / 100 : null;
      return {
        currentTotal: current,
        previousTotal: previous,
        absoluteChange,
        percentageChange,
      };
    };

    const comparison = {
      income: makeComparison(totalIncome, prevIncome),
      expense: makeComparison(totalExpenses, prevExpense),
      net: makeComparison(netCashFlow, prevNet),
    };

    // 6. Largest transactions
    const expenseList = transactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((t) => {
        const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
        return {
          id: t.id,
          description: t.description,
          amount: Number(t.amount),
          transaction_date: t.transaction_date,
          category_name: cat?.name || 'Uncategorized',
        };
      });

    const incomeList = transactions
      .filter((t) => t.type === 'income')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((t) => {
        const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
        return {
          id: t.id,
          description: t.description,
          amount: Number(t.amount),
          transaction_date: t.transaction_date,
          category_name: cat?.name || 'Uncategorized',
        };
      });

    return {
      data: {
        currency,
        startDate,
        endDate,
        totalIncome,
        totalExpenses,
        netCashFlow,
        savingsRate,
        transactionCount,
        averageTransactionAmount,
        expenseBreakdown,
        incomeBreakdown,
        trends,
        comparison,
        largestExpenses: expenseList,
        largestIncome: incomeList,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating analytics summary';
    return { data: null, error: msg, status: 500 };
  }
}
