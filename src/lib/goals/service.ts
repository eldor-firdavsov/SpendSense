import { SupabaseClient } from '@supabase/supabase-js';
import {
  createGoalSchema,
  updateGoalSchema,
  contributeGoalSchema,
} from './schemas.ts';
import type {
  CreateGoalInput,
  UpdateGoalInput,
  GoalWithProgress,
  GoalFeasibility,
} from './schemas.ts';
import type { FinancialGoal } from '../../types/database.ts';

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

function formatUzMoney(amount: number, currency: string = 'UZS'): string {
  if (currency === 'UZS') {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  }
  return `${amount >= 1000 ? amount.toLocaleString('en-US') : amount.toFixed(2)} ${currency}`;
}

/**
 * Computes remaining calendar months until target date
 */
function computeMonthsRemaining(today: Date, targetDateStr: string): number {
  const parts = targetDateStr.split('-');
  const tYear = parseInt(parts[0], 10);
  const tMonth = parseInt(parts[1], 10); // 1-12
  const tDay = parseInt(parts[2], 10);

  const cYear = today.getFullYear();
  const cMonth = today.getMonth() + 1; // 1-12
  const cDay = today.getDate();

  const todayMs = Date.UTC(cYear, cMonth - 1, cDay);
  const targetMs = Date.UTC(tYear, tMonth - 1, tDay);

  if (targetMs < todayMs) {
    return 0; // Target date is in the past
  }

  // Calculate calendar month difference
  const monthDiff = (tYear - cYear) * 12 + (tMonth - cMonth);
  if (monthDiff <= 0) {
    return 1;
  }

  return monthDiff;
}

/**
 * Computes the user's verified historical monthly free cashflow:
 * Oylik erkin mablag' = Oylik daromad - Oylik xarajatlar
 */
async function getUserMonthlyNetCashflow(
  userId: string,
  currency: string,
  supabase: SupabaseClient
): Promise<{ avgMonthlyNet: number; avgMonthlyIncome: number; avgMonthlyExpense: number; activeMonthsCount: number }> {
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type, transaction_date')
    .eq('user_id', userId)
    .eq('currency', currency);

  if (!txs || txs.length === 0) {
    return { avgMonthlyNet: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0, activeMonthsCount: 0 };
  }

  // Bucket by calendar month (YYYY-MM)
  const monthlyBuckets: Record<string, { income: number; expense: number }> = {};
  for (const t of txs) {
    const monthKey = (t.transaction_date || '').substring(0, 7);
    if (!monthKey) continue;
    if (!monthlyBuckets[monthKey]) {
      monthlyBuckets[monthKey] = { income: 0, expense: 0 };
    }
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      monthlyBuckets[monthKey].income += amt;
    } else {
      monthlyBuckets[monthKey].expense += amt;
    }
  }

  const monthKeys = Object.keys(monthlyBuckets);
  if (monthKeys.length === 0) {
    return { avgMonthlyNet: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0, activeMonthsCount: 0 };
  }

  let totalIncome = 0;
  let totalExpense = 0;
  for (const k of monthKeys) {
    totalIncome += monthlyBuckets[k].income;
    totalExpense += monthlyBuckets[k].expense;
  }

  const activeMonthsCount = monthKeys.length;
  const avgMonthlyIncome = Math.round(totalIncome / activeMonthsCount);
  const avgMonthlyExpense = Math.round(totalExpense / activeMonthsCount);
  const avgMonthlyNet = Math.round((totalIncome - totalExpense) / activeMonthsCount);

  return { avgMonthlyNet, avgMonthlyIncome, avgMonthlyExpense, activeMonthsCount };
}

/**
 * Computes progress and feasibility estimate for a financial goal
 */
async function computeGoalProgress(
  goal: FinancialGoal,
  supabase: SupabaseClient
): Promise<GoalWithProgress> {
  const target = Number(goal.target_amount) || 0;
  const current = Number(goal.current_amount) || 0;
  const remaining = Math.max(0, Math.round((target - current) * 100) / 100);
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 10000) / 100) : 0;

  // Feasibility calculation
  let feasibilityStatus: GoalFeasibility = 'not_applicable';
  let monthlyNeeded: number | null = null;
  let monthsRemaining: number | null = null;
  let avgMonthlyNet: number | null = null;
  let explanation = `"${goal.name}": Oylik jamg‘arma rejasini hisoblash uchun maqsad muddatini belgilang.`;

  if (goal.status === 'completed' || remaining === 0 || current >= target) {
    feasibilityStatus = 'feasible';
    monthlyNeeded = 0;
    monthsRemaining = 0;
    explanation = goal.currency === 'USD'
      ? `"${goal.name}": Goal target amount has been achieved! (Needed: 0 USD).`
      : 'Maqsad to‘liq bajarildi.';
  } else if (goal.target_date) {
    const today = new Date();
    monthsRemaining = computeMonthsRemaining(today, goal.target_date);

    if (monthsRemaining === 0) {
      feasibilityStatus = 'unlikely';
      monthlyNeeded = remaining;
      explanation = goal.currency === 'USD'
        ? `"${goal.name}": The target date for this goal has already passed (Needed: ${formatUzMoney(remaining, goal.currency)}).`
        : 'Belgilangan muddat o‘tib ketgan. Yangi muddat belgilash kerak.';
    } else {
      monthlyNeeded = Math.round((remaining / monthsRemaining) * 100) / 100;

      // Query user's real historical monthly free cashflow
      const cashflow = await getUserMonthlyNetCashflow(goal.user_id, goal.currency, supabase);
      avgMonthlyNet = cashflow.avgMonthlyNet;

      if (avgMonthlyNet >= monthlyNeeded) {
        feasibilityStatus = 'feasible';
        explanation = goal.currency === 'USD'
          ? `"${goal.name}": Based on your monthly net savings of ${formatUzMoney(avgMonthlyNet, goal.currency)}/mo, you are on track to save ${formatUzMoney(monthlyNeeded, goal.currency)}/mo needed by ${goal.target_date}.`
          : `Maqsadga yetish uchun oyiga ${formatUzMoney(monthlyNeeded, goal.currency)} yig‘ing. Oylik erkin mablag‘ingiz (${formatUzMoney(avgMonthlyNet, goal.currency)}) yetarli.`;
      } else if (avgMonthlyNet > 0 && monthlyNeeded <= avgMonthlyNet * 1.5) {
        feasibilityStatus = 'challenging';
        explanation = goal.currency === 'USD'
          ? `"${goal.name}": You need ${formatUzMoney(monthlyNeeded, goal.currency)}/mo, but your average savings is ${formatUzMoney(avgMonthlyNet, goal.currency)}/mo. Consider extending your target date or trimming discretionary spending.`
          : `Oyiga ${formatUzMoney(monthlyNeeded, goal.currency)} jamg‘arish kerak. Xarajatlarni optimallashtirish tavsiya etiladi.`;
      } else {
        feasibilityStatus = 'unlikely';
        explanation = goal.currency === 'USD'
          ? `"${goal.name}": You need ${formatUzMoney(monthlyNeeded, goal.currency)}/mo, but your current net cashflow is insufficient (${formatUzMoney(avgMonthlyNet, goal.currency)}/mo). Consider extending your target date.`
          : `Hozirgi jamg‘arish sur’ati bilan muddatni uzaytirish yoki xarajatlarni kamaytirish kerak (Oyiga ${formatUzMoney(monthlyNeeded, goal.currency)} kerak, erkin mablag‘: ${formatUzMoney(avgMonthlyNet, goal.currency)}).`;
      }
    }
  }

  return {
    id: goal.id,
    user_id: goal.user_id,
    name: goal.name,
    target_amount: target,
    current_amount: current,
    currency: goal.currency,
    target_date: goal.target_date,
    tracking_strategy: goal.tracking_strategy,
    status: goal.status,
    remaining_amount: remaining,
    percentage_completed: percentage,
    feasibility: {
      status: feasibilityStatus,
      monthly_needed: monthlyNeeded,
      estimated_months_remaining: monthsRemaining,
      average_monthly_net_savings: avgMonthlyNet,
      explanation,
    },
    created_at: goal.created_at,
    updated_at: goal.updated_at,
  };
}

/**
 * Lists financial goals for authenticated user
 */
export async function listGoals(
  client?: SupabaseClient
): Promise<ServiceResult<GoalWithProgress[]>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: rawGoals, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    const goalsWithProgress: GoalWithProgress[] = await Promise.all(
      (rawGoals || []).map((g) => computeGoalProgress(g, supabase))
    );

    return { data: goalsWithProgress, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching goals';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Gets a single financial goal by ID
 */
export async function getGoal(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<GoalWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: rawGoal, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!rawGoal) {
      return { data: null, error: 'Financial goal not found', status: 404 };
    }

    const computed = await computeGoalProgress(rawGoal, supabase);
    return { data: computed, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching goal';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Creates a new financial goal
 */
export async function createGoal(
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<GoalWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = createGoalSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid goal data';
      return { data: null, error: err, status: 400 };
    }

    const validated: CreateGoalInput = parseResult.data;

    let initialStatus = validated.status;
    if (validated.current_amount >= validated.target_amount) {
      initialStatus = 'completed';
    }

    const { data: created, error } = await supabase
      .from('financial_goals')
      .insert({
        user_id: user.id,
        name: validated.name,
        target_amount: validated.target_amount,
        current_amount: validated.current_amount,
        currency: validated.currency,
        target_date: validated.target_date,
        tracking_strategy: validated.tracking_strategy,
        status: initialStatus,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    const computed = await computeGoalProgress(created, supabase);
    return { data: computed, error: null, status: 201 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating goal';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Updates an existing financial goal
 */
export async function updateGoal(
  id: string,
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<GoalWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = updateGoalSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid goal update data';
      return { data: null, error: err, status: 400 };
    }

    const validated: UpdateGoalInput = parseResult.data;

    const { data: existing } = await supabase
      .from('financial_goals')
      .select('id, user_id, target_amount, current_amount')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return { data: null, error: 'Financial goal not found', status: 404 };
    }

    const effectiveTarget = validated.target_amount !== undefined ? validated.target_amount : Number(existing.target_amount);
    const effectiveCurrent = validated.current_amount !== undefined ? validated.current_amount : Number(existing.current_amount);

    const updatePayload: Record<string, unknown> = {};
    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.target_amount !== undefined) updatePayload.target_amount = validated.target_amount;
    if (validated.current_amount !== undefined) updatePayload.current_amount = validated.current_amount;
    if (validated.currency !== undefined) updatePayload.currency = validated.currency;
    if (validated.target_date !== undefined) updatePayload.target_date = validated.target_date;
    if (validated.tracking_strategy !== undefined) updatePayload.tracking_strategy = validated.tracking_strategy;

    if (validated.status !== undefined) {
      updatePayload.status = validated.status;
    } else {
      updatePayload.status = effectiveCurrent >= effectiveTarget ? 'completed' : 'in_progress';
    }

    const { data: updated, error } = await supabase
      .from('financial_goals')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    const computed = await computeGoalProgress(updated, supabase);
    return { data: computed, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating goal';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Records a contribution deposit (positive) or withdrawal (negative) to a goal
 */
export async function contributeToGoal(
  id: string,
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<GoalWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = contributeGoalSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid contribution data';
      return { data: null, error: err, status: 400 };
    }

    const { amount } = parseResult.data;

    const { data: existing } = await supabase
      .from('financial_goals')
      .select('id, user_id, current_amount, target_amount, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return { data: null, error: 'Financial goal not found', status: 404 };
    }

    const current = Number(existing.current_amount) || 0;
    const target = Number(existing.target_amount) || 0;
    const newAmount = Math.max(0, Math.round((current + amount) * 100) / 100);

    const newStatus = newAmount >= target ? 'completed' : 'in_progress';

    const { data: updated, error } = await supabase
      .from('financial_goals')
      .update({
        current_amount: newAmount,
        status: newStatus,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    const computed = await computeGoalProgress(updated, supabase);
    return { data: computed, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error contributing to goal';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Deletes a financial goal
 */
export async function deleteGoal(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<{ success: boolean; id: string }>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: existing } = await supabase
      .from('financial_goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return { data: null, error: 'Financial goal not found', status: 404 };
    }

    const { error } = await supabase
      .from('financial_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    return { data: { success: true, id }, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting goal';
    return { data: null, error: msg, status: 500 };
  }
}
