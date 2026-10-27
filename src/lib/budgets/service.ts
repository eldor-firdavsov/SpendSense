import { SupabaseClient } from '@supabase/supabase-js';
import {
  createBudgetSchema,
  updateBudgetSchema,
} from './schemas.ts';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetWithProgress,
  BudgetStatus,
} from './schemas.ts';
import type { Budget } from '../../types/database.ts';

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
 * Computes progress and status for a given budget record
 */
async function computeBudgetProgress(
  budget: Budget & {
    categories?:
      | { id: string; name: string; type: string; color: string | null; icon: string | null }
      | Array<{ id: string; name: string; type: string; color: string | null; icon: string | null }>
      | null;
  },
  supabase: SupabaseClient
): Promise<BudgetWithProgress> {
  const budgetAmount = Number(budget.amount) || 0;

  let query = supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', budget.user_id)
    .eq('currency', budget.currency)
    .eq('type', 'expense')
    .gte('transaction_date', budget.start_date)
    .lte('transaction_date', budget.end_date);

  if (budget.category_id) {
    query = query.eq('category_id', budget.category_id);
  }

  const { data: txs } = await query;

  let spent = 0;
  for (const t of txs || []) {
    spent += Number(t.amount) || 0;
  }
  spent = Math.round(spent * 100) / 100;

  const remaining = Math.round((budgetAmount - spent) * 100) / 100;
  const percentageUsed =
    budgetAmount > 0 ? Math.round((spent / budgetAmount) * 10000) / 100 : 0;

  let status: BudgetStatus = 'on_track';
  if (percentageUsed >= 100) {
    status = 'over_budget';
  } else if (percentageUsed >= 80) {
    status = 'near_limit';
  }

  const cat = Array.isArray(budget.categories) ? budget.categories[0] : budget.categories;

  return {
    id: budget.id,
    user_id: budget.user_id,
    category_id: budget.category_id,
    name: budget.name,
    amount: budgetAmount,
    currency: budget.currency,
    period_type: budget.period_type,
    start_date: budget.start_date,
    end_date: budget.end_date,
    spent,
    remaining,
    percentageUsed,
    status,
    category: cat
      ? {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
        }
      : null,
    created_at: budget.created_at,
    updated_at: budget.updated_at,
  };
}

/**
 * Lists budgets with spending progress for the authenticated user
 */
export async function listBudgets(
  client?: SupabaseClient
): Promise<ServiceResult<BudgetWithProgress[]>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: rawBudgets, error: budgetError } = await supabase
      .from('budgets')
      .select('*, categories(id, name, type, icon, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (budgetError) {
      return { data: null, error: budgetError.message, status: 500 };
    }

    const budgetsWithProgress: BudgetWithProgress[] = await Promise.all(
      (rawBudgets || []).map((b) => computeBudgetProgress(b, supabase))
    );

    return { data: budgetsWithProgress, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching budgets';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Gets a single budget by ID with computed progress
 */
export async function getBudget(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<BudgetWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: rawBudget, error } = await supabase
      .from('budgets')
      .select('*, categories(id, name, type, icon, color)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!rawBudget) {
      return { data: null, error: 'Budget not found', status: 404 };
    }

    const computed = await computeBudgetProgress(rawBudget, supabase);
    return { data: computed, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching budget';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Creates a new budget for the authenticated user
 */
export async function createBudget(
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<BudgetWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = createBudgetSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid budget data';
      return { data: null, error: err, status: 400 };
    }

    const validated: CreateBudgetInput = parseResult.data;

    // Validate category exists and is compatible (if category_id provided)
    if (validated.category_id) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, user_id, is_system, type')
        .eq('id', validated.category_id)
        .maybeSingle();

      if (!cat) {
        return { data: null, error: 'Referenced category not found', status: 400 };
      }
      if (!cat.is_system && cat.user_id !== user.id) {
        return { data: null, error: 'Cannot use another user private category', status: 400 };
      }
      if (cat.type !== 'expense') {
        return { data: null, error: 'Budgets can only be assigned to expense categories', status: 400 };
      }
    }

    const { data: created, error: insertError } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        name: validated.name,
        amount: validated.amount,
        currency: validated.currency,
        period_type: validated.period_type,
        start_date: validated.start_date,
        end_date: validated.end_date,
        category_id: validated.category_id,
      })
      .select('*, categories(id, name, type, icon, color)')
      .single();

    if (insertError) {
      return { data: null, error: insertError.message, status: 500 };
    }

    const computed = await computeBudgetProgress(created, supabase);
    return { data: computed, error: null, status: 201 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating budget';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Updates an existing budget owned by the authenticated user
 */
export async function updateBudget(
  id: string,
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<BudgetWithProgress>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = updateBudgetSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid budget update data';
      return { data: null, error: err, status: 400 };
    }

    const validated: UpdateBudgetInput = parseResult.data;

    // Check ownership
    const { data: existing } = await supabase
      .from('budgets')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return { data: null, error: 'Budget not found', status: 404 };
    }

    if (validated.category_id) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, user_id, is_system, type')
        .eq('id', validated.category_id)
        .maybeSingle();

      if (!cat) {
        return { data: null, error: 'Referenced category not found', status: 400 };
      }
      if (!cat.is_system && cat.user_id !== user.id) {
        return { data: null, error: 'Cannot use another user private category', status: 400 };
      }
      if (cat.type !== 'expense') {
        return { data: null, error: 'Budgets can only be assigned to expense categories', status: 400 };
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.amount !== undefined) updatePayload.amount = validated.amount;
    if (validated.currency !== undefined) updatePayload.currency = validated.currency;
    if (validated.period_type !== undefined) updatePayload.period_type = validated.period_type;
    if (validated.start_date !== undefined) updatePayload.start_date = validated.start_date;
    if (validated.end_date !== undefined) updatePayload.end_date = validated.end_date;
    if (validated.category_id !== undefined) updatePayload.category_id = validated.category_id;

    const { data: updated, error: updateErr } = await supabase
      .from('budgets')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, categories(id, name, type, icon, color)')
      .single();

    if (updateErr) {
      return { data: null, error: updateErr.message, status: 500 };
    }

    const computed = await computeBudgetProgress(updated, supabase);
    return { data: computed, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating budget';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Deletes a budget owned by the authenticated user
 */
export async function deleteBudget(
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
      .from('budgets')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return { data: null, error: 'Budget not found', status: 404 };
    }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    return { data: { success: true, id }, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting budget';
    return { data: null, error: msg, status: 500 };
  }
}
