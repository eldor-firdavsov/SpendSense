import { SupabaseClient } from '@supabase/supabase-js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryFilterSchema,
} from './schemas.ts';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryFilterInput,
} from './schemas.ts';
import type { Category } from '../../types/database.ts';

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
 * Lists categories (system categories + current user's custom categories).
 * Optionally filters by type ('income' | 'expense' | 'all').
 */
export async function listCategories(
  filters?: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<Category[]>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = categoryFilterSchema.safeParse(filters || {});
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid filter parameters';
      return { data: null, error: firstError, status: 400 };
    }

    const filterData: CategoryFilterInput = parseResult.data;

    let query = supabase
      .from('categories')
      .select('*')
      .or(`is_system.eq.true,user_id.eq.${user.id}`);

    if (filterData.type && filterData.type !== 'all') {
      query = query.eq('type', filterData.type);
    }

    query = query.order('is_system', { ascending: false }).order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message || 'Database error fetching categories', status: 500 };
    }

    return { data: (data || []) as Category[], error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Gets a single category by ID (accessible if system category or owned by authenticated user).
 */
export async function getCategory(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<Category>> {
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
      return { data: null, error: 'Category ID is required', status: 400 };
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!data) {
      return { data: null, error: 'Category not found', status: 404 };
    }

    // Must be either system category or owned by user
    if (!data.is_system && data.user_id !== user.id) {
      return { data: null, error: 'Category not found', status: 404 };
    }

    return { data: data as Category, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Creates a new custom category for the authenticated user.
 */
export async function createCategory(
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<Category>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = createCategorySchema.safeParse(input);
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid input';
      return { data: null, error: firstError, status: 400 };
    }

    const validData: CreateCategoryInput = parseResult.data;

    // Insert user-owned custom category (force is_system = false, user_id = user.id)
    const { data: created, error: insertError } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: validData.name.trim(),
        type: validData.type,
        description: validData.description,
        icon: validData.icon,
        color: validData.color,
        is_system: false,
      })
      .select()
      .single();

    if (insertError) {
      // Check for PostgreSQL unique constraint violation (code 23505)
      if (insertError.code === '23505' || insertError.message.includes('unique constraint') || insertError.message.includes('already exists')) {
        return {
          data: null,
          error: `A category with the name '${validData.name}' already exists for type '${validData.type}'`,
          status: 409,
        };
      }
      return {
        data: null,
        error: insertError.message || 'Database error creating category',
        status: 500,
      };
    }

    return { data: created as Category, error: null, status: 201 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Updates a custom category owned by the authenticated user.
 * System categories cannot be updated.
 * Category type cannot be changed if existing transactions reference this category.
 */
export async function updateCategory(
  id: string,
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<Category>> {
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
      return { data: null, error: 'Category ID is required', status: 400 };
    }

    // 1. Fetch existing category to verify ownership and system status
    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError.message, status: 500 };
    }

    if (!existing) {
      return { data: null, error: 'Category not found or inaccessible', status: 404 };
    }

    // System categories must never be updated
    if (existing.is_system) {
      return { data: null, error: 'System categories cannot be modified', status: 403 };
    }

    // Another user's category must not be updated
    if (existing.user_id !== user.id) {
      return { data: null, error: 'Category not found or inaccessible', status: 404 };
    }

    // 2. Validate input schema
    const parseResult = updateCategorySchema.safeParse(input);
    if (!parseResult.success) {
      const fallbackErrors = (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors;
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        fallbackErrors?.[0]?.message ||
        'Invalid input';
      return { data: null, error: firstError, status: 400 };
    }

    const validData: UpdateCategoryInput = parseResult.data;

    // 3. Category Type Change Safety Validation:
    // If type is changing, verify that NO existing transactions reference this category!
    if (validData.type && validData.type !== existing.type) {
      const { count: txCount, error: txCountError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (txCountError) {
        return { data: null, error: txCountError.message, status: 500 };
      }

      if (txCount && txCount > 0) {
        return {
          data: null,
          error: `Cannot change category type because ${txCount} existing transaction(s) are assigned to this category. Reassign or remove those transactions first.`,
          status: 400,
        };
      }
    }

    // 4. Build sanitized update payload (exclude id, user_id, is_system, created_at)
    const updatePayload: Record<string, unknown> = {};
    if (validData.name !== undefined) updatePayload.name = validData.name.trim();
    if (validData.type !== undefined) updatePayload.type = validData.type;
    if (validData.description !== undefined) updatePayload.description = validData.description;
    if (validData.icon !== undefined) updatePayload.icon = validData.icon;
    if (validData.color !== undefined) updatePayload.color = validData.color;

    const { data: updated, error: updateError } = await supabase
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_system', false)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505' || updateError.message.includes('unique constraint') || updateError.message.includes('already exists')) {
        return {
          data: null,
          error: `A category with this name and type already exists`,
          status: 409,
        };
      }
      return {
        data: null,
        error: updateError.message || 'Database error updating category',
        status: 500,
      };
    }

    return { data: updated as Category, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}

/**
 * Deletes a custom category owned by the authenticated user.
 * System categories cannot be deleted.
 * Foreign key transactions.category_id has ON DELETE SET NULL, leaving transactions intact.
 */
export async function deleteCategory(
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
      return { data: null, error: 'Category ID is required', status: 400 };
    }

    // 1. Fetch existing category to check system status and ownership
    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError.message, status: 500 };
    }

    if (!existing) {
      return { data: null, error: 'Category not found or inaccessible', status: 404 };
    }

    // System categories must never be deleted
    if (existing.is_system) {
      return { data: null, error: 'System categories cannot be deleted', status: 403 };
    }

    // Another user's category must not be deleted
    if (existing.user_id !== user.id) {
      return { data: null, error: 'Category not found or inaccessible', status: 404 };
    }

    // 2. Perform delete
    const { data: deletedRows, error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_system', false)
      .select('id');

    if (deleteError) {
      return {
        data: null,
        error: deleteError.message || 'Database error deleting category',
        status: 500,
      };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return { data: null, error: 'Category not found or inaccessible', status: 404 };
    }

    return { data: { success: true, id }, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { data: null, error: message, status: 500 };
  }
}
