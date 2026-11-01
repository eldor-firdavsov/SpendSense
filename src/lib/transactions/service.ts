import { SupabaseClient } from '@supabase/supabase-js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterSchema,
} from './schemas.ts';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilterInput,
} from './schemas.ts';
import type { TransactionWithCategory } from '../../types/database.ts';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedTransactions {
  transactions: TransactionWithCategory[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function resolveClient(providedClient?: SupabaseClient): Promise<SupabaseClient> {
  if (providedClient) return providedClient;
  const { createClient } = await import('../supabase/server.ts');
  return await createClient();
}

/**
 * Creates a new transaction for the authenticated user.
 */
export async function createTransaction(
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<TransactionWithCategory>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    // 1. Validate input schema
    const parseResult = createTransactionSchema.safeParse(input);
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid input';
      return { data: null, error: firstError, status: 400 };
    }

    const validData: CreateTransactionInput = parseResult.data;

    // 2. Validate category ownership and type compatibility if category_id is provided
    if (validData.category_id) {
      const { data: category, error: catError } = await supabase
        .from('categories')
        .select('id, name, type, is_system, user_id')
        .eq('id', validData.category_id)
        .maybeSingle();

      if (catError || !category) {
        return { data: null, error: 'Referenced category does not exist or is inaccessible', status: 400 };
      }

      // Check ownership (system category OR owned by current user)
      const isOwner = category.is_system || category.user_id === user.id;
      if (!isOwner) {
        return { data: null, error: 'Referenced category does not belong to you', status: 403 };
      }

      // Check type compatibility
      if (category.type !== validData.type) {
        return {
          data: null,
          error: `Category '${category.name}' (${category.type}) is incompatible with transaction type '${validData.type}'`,
          status: 400,
        };
      }
    }

    // 3. Insert transaction with server-verified user_id
    const { data: created, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: validData.description,
        amount: validData.amount,
        currency: validData.currency,
        type: validData.type,
        transaction_date: validData.transaction_date,
        category_id: validData.category_id,
        merchant: validData.merchant,
        notes: validData.notes,
        source: validData.source,
      })
      .select('*, categories(id, name, type, icon, color)')
      .single();

    if (insertError) {
      return {
        data: null,
        error: insertError.message || 'Database error creating transaction',
        status: 500,
      };
    }

    // Update user financial_start_date if not set or if new transaction is earlier
    const { data: profile } = await supabase
      .from('profiles')
      .select('financial_start_date')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.financial_start_date || validData.transaction_date < profile.financial_start_date) {
      await supabase
        .from('profiles')
        .update({ financial_start_date: validData.transaction_date })
        .eq('id', user.id);
    }

    return { data: created as TransactionWithCategory, error: null, status: 201 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Lists transactions for the authenticated user with filtering, sorting, and pagination.
 */
export async function listTransactions(
  filterParams: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<PaginatedTransactions>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = transactionFilterSchema.safeParse(filterParams || {});
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid filter parameters';
      return { data: null, error: firstError, status: 400 };
    }

    const filters: TransactionFilterInput = parseResult.data;

    let query = supabase
      .from('transactions')
      .select('*, categories(id, name, type, icon, color)', { count: 'exact' })
      .eq('user_id', user.id);

    // Enforce user financial_start_date
    const { data: profile } = await supabase
      .from('profiles')
      .select('financial_start_date')
      .eq('id', user.id)
      .maybeSingle();

    const effectiveStart = profile?.financial_start_date;
    const activeStartDate = filters.startDate
      ? (effectiveStart && filters.startDate < effectiveStart ? effectiveStart : filters.startDate)
      : effectiveStart;

    // Apply filters
    if (activeStartDate) {
      query = query.gte('transaction_date', activeStartDate);
    }
    if (filters.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }
    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }
    if (filters.categoryId) {
      if (filters.categoryId === 'uncategorized') {
        query = query.is('category_id', null);
      } else if (filters.categoryId !== 'all') {
        query = query.eq('category_id', filters.categoryId);
      }
    }
    if (filters.search) {
      // Escape commas, brackets or wildcards to prevent query corruption
      const sanitized = filters.search.replace(/[%_,()]/g, ' ').trim();
      if (sanitized) {
        query = query.or(`description.ilike.%${sanitized}%,merchant.ilike.%${sanitized}%`);
      }
    }

    // Sorting
    const isAscending = filters.sortDirection === 'asc';
    if (filters.sortBy === 'amount') {
      query = query.order('amount', { ascending: isAscending });
    } else {
      query = query.order('transaction_date', { ascending: isAscending });
    }
    // Deterministic tie-breaker
    query = query.order('id', { ascending: true });

    // Pagination
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: transactions, error: fetchError, count } = await query;

    if (fetchError) {
      return {
        data: null,
        error: fetchError.message || 'Database error fetching transactions',
        status: 500,
      };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      data: {
        transactions: (transactions || []) as TransactionWithCategory[],
        totalCount,
        page,
        pageSize,
        totalPages,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Gets a single transaction by ID for the authenticated user.
 */
export async function getTransaction(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<TransactionWithCategory>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    if (!id || typeof id !== 'string') {
      return { data: null, error: 'Transaction ID is required', status: 400 };
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(id, name, type, icon, color)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!data) {
      return { data: null, error: 'Transaction not found', status: 404 };
    }

    return { data: data as TransactionWithCategory, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Updates an existing transaction for the authenticated user.
 */
export async function updateTransaction(
  id: string,
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<TransactionWithCategory>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    if (!id || typeof id !== 'string') {
      return { data: null, error: 'Transaction ID is required', status: 400 };
    }

    // 1. Fetch existing transaction to verify ownership
    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError.message, status: 500 };
    }

    if (!existing) {
      return { data: null, error: 'Transaction not found or inaccessible', status: 404 };
    }

    // 2. Validate input schema
    const parseResult = updateTransactionSchema.safeParse(input);
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid input';
      return { data: null, error: firstError, status: 400 };
    }

    const validData: UpdateTransactionInput = parseResult.data;
    const targetType = validData.type || existing.type;
    const targetCategoryId =
      validData.category_id !== undefined ? validData.category_id : existing.category_id;

    // 3. If category is updated or type changed, re-validate category compatibility
    if (targetCategoryId) {
      const { data: category, error: catError } = await supabase
        .from('categories')
        .select('id, name, type, is_system, user_id')
        .eq('id', targetCategoryId)
        .maybeSingle();

      if (catError || !category) {
        return { data: null, error: 'Referenced category does not exist or is inaccessible', status: 400 };
      }

      const isOwner = category.is_system || category.user_id === user.id;
      if (!isOwner) {
        return { data: null, error: 'Referenced category does not belong to you', status: 403 };
      }

      if (category.type !== targetType) {
        return {
          data: null,
          error: `Category '${category.name}' (${category.type}) is incompatible with transaction type '${targetType}'`,
          status: 400,
        };
      }
    }

    // 4. Build sanitized update payload (exclude user_id, id, created_at)
    const updatePayload: Record<string, unknown> = {};
    if (validData.description !== undefined) updatePayload.description = validData.description;
    if (validData.amount !== undefined) updatePayload.amount = validData.amount;
    if (validData.currency !== undefined) updatePayload.currency = validData.currency;
    if (validData.type !== undefined) updatePayload.type = validData.type;
    if (validData.transaction_date !== undefined)
      updatePayload.transaction_date = validData.transaction_date;
    if (validData.category_id !== undefined) updatePayload.category_id = validData.category_id;
    if (validData.merchant !== undefined) updatePayload.merchant = validData.merchant;
    if (validData.notes !== undefined) updatePayload.notes = validData.notes;
    if (validData.source !== undefined) updatePayload.source = validData.source;

    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, categories(id, name, type, icon, color)')
      .single();

    if (updateError) {
      return {
        data: null,
        error: updateError.message || 'Database error updating transaction',
        status: 500,
      };
    }

    return { data: updated as TransactionWithCategory, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Deletes a transaction for the authenticated user.
 */
export async function deleteTransaction(
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

    if (!id || typeof id !== 'string') {
      return { data: null, error: 'Transaction ID is required', status: 400 };
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');

    if (deleteError) {
      return {
        data: null,
        error: deleteError.message || 'Database error deleting transaction',
        status: 500,
      };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return { data: null, error: 'Transaction not found or inaccessible', status: 404 };
    }

    return { data: { success: true, id }, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}
