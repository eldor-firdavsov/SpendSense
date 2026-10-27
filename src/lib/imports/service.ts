import { SupabaseClient } from '@supabase/supabase-js';
import {
  importCommitSchema,
  importColumnMappingSchema,
} from './schemas.ts';
import type {
  ImportColumnMapping,
  ImportPreviewRow,
} from './schemas.ts';
import {
  parseSpreadsheetBuffer,
  detectColumnMapping,
  normalizeRows,
} from './parser.ts';
import type { ImportJob } from '../../types/database.ts';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface ImportPreviewResult {
  filename: string;
  headers: string[];
  mapping: ImportColumnMapping;
  rows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export interface ImportCommitResult {
  jobId: string;
  job?: { id: string };
  status: 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  insertedCount?: number;
  skippedRows: number;
  skippedCount?: number;
  failedRows: number;
}

async function resolveClient(providedClient?: SupabaseClient): Promise<SupabaseClient> {
  if (providedClient) return providedClient;
  const { createClient } = await import('../supabase/server.ts');
  return await createClient();
}

/**
 * Previews an uploaded spreadsheet file, validates rows, and flags duplicates
 */
export async function previewImport(
  buffer: Buffer,
  filename: string,
  userMapping?: Partial<ImportColumnMapping>,
  client?: SupabaseClient
): Promise<ServiceResult<ImportPreviewResult>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    if (!buffer || buffer.length === 0) {
      return { data: null, error: 'Uploaded file is empty', status: 400 };
    }

    // 1. Parse spreadsheet structure
    const { headers, rows } = parseSpreadsheetBuffer(buffer);
    if (headers.length === 0 || rows.length === 0) {
      return { data: null, error: 'File contains no data rows or headers', status: 400 };
    }

    // 2. Resolve mapping
    const detected = detectColumnMapping(headers);
    const mapping = { ...detected, ...(userMapping || {}) };

    const parseMappingResult = importColumnMappingSchema.safeParse(mapping);
    if (!parseMappingResult.success) {
      const err = parseMappingResult.error.issues?.[0]?.message || 'Invalid column mapping';
      return { data: null, error: err, status: 400 };
    }
    const finalMapping = parseMappingResult.data;

    // 3. Normalize & validate rows
    const previewRows = normalizeRows(rows, finalMapping);

    // 4. Fetch existing transactions to detect duplicates
    const validRows = previewRows.filter((r) => r.isValid && r.parsed);
    let duplicateCount = 0;

    if (validRows.length > 0) {
      // Find date range
      const dates = validRows.map((r) => r.parsed!.transaction_date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      const { data: existingTxs } = await supabase
        .from('transactions')
        .select('transaction_date, amount, description, type')
        .eq('user_id', user.id)
        .gte('transaction_date', minDate)
        .lte('transaction_date', maxDate);

      if (existingTxs && existingTxs.length > 0) {
        const existingSet = new Set(
          existingTxs.map(
            (t) =>
              `${t.transaction_date}|${Number(t.amount).toFixed(2)}|${t.description.toLowerCase().trim()}|${t.type}`
          )
        );

        previewRows.forEach((r) => {
          if (r.isValid && r.parsed) {
            const key = `${r.parsed.transaction_date}|${Number(r.parsed.amount).toFixed(2)}|${r.parsed.description.toLowerCase().trim()}|${r.parsed.type}`;
            if (existingSet.has(key)) {
              r.isDuplicate = true;
              duplicateCount++;
            }
          }
        });
      }
    }

    const validCount = previewRows.filter((r) => r.isValid).length;
    const invalidCount = previewRows.filter((r) => !r.isValid).length;

    return {
      data: {
        filename,
        headers,
        mapping: finalMapping,
        rows: previewRows,
        totalRows: previewRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error previewing spreadsheet';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Commits validated rows to the transactions table and tracks progress in import_jobs
 */
export async function commitImport(
  input: unknown,
  client?: SupabaseClient
): Promise<ServiceResult<ImportCommitResult>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const parseResult = importCommitSchema.safeParse(input);
    if (!parseResult.success) {
      const err = parseResult.error.issues?.[0]?.message || 'Invalid commit payload';
      return { data: null, error: err, status: 400 };
    }

    const { filename, duplicateStrategy, rows } = parseResult.data;

    // 1. Create or initialize import_jobs record
    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .insert({
        user_id: user.id,
        filename,
        status: 'processing',
        total_rows: rows.length,
      })
      .select()
      .single();

    if (jobErr || !job) {
      return { data: null, error: jobErr?.message || 'Failed to initialize import job', status: 500 };
    }

    // 2. Duplicate detection check if strategy is 'skip'
    let rowsToInsert = rows;
    let skippedCount = 0;

    if (duplicateStrategy === 'skip') {
      const dates = rows.map((r) => r.transaction_date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      const { data: existingTxs } = await supabase
        .from('transactions')
        .select('transaction_date, amount, description, type')
        .eq('user_id', user.id)
        .gte('transaction_date', minDate)
        .lte('transaction_date', maxDate);

      const existingSet = new Set(
        (existingTxs || []).map(
          (t) =>
            `${t.transaction_date}|${Number(t.amount).toFixed(2)}|${t.description.toLowerCase().trim()}|${t.type}`
        )
      );

      const filtered: typeof rows = [];
      for (const r of rows) {
        const key = `${r.transaction_date}|${Number(r.amount).toFixed(2)}|${r.description.toLowerCase().trim()}|${r.type}`;
        if (existingSet.has(key)) {
          skippedCount++;
        } else {
          filtered.push(r);
          // Add to existing set to avoid intra-batch duplicates
          existingSet.add(key);
        }
      }
      rowsToInsert = filtered;
    }

    // 3. Batch insert transactions
    const source = filename.endsWith('.csv') ? 'csv' : 'excel';
    const payload = rowsToInsert.map((r) => ({
      user_id: user.id,
      category_id: r.category_id || null,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      type: r.type,
      transaction_date: r.transaction_date,
      merchant: r.merchant || null,
      notes: r.notes || null,
      source,
      import_job_id: job.id,
    }));

    let importedCount = 0;
    const failedCount = 0;

    if (payload.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('transactions')
        .insert(payload)
        .select('id');

      if (insertErr) {
        await supabase
          .from('import_jobs')
          .update({
            status: 'failed',
            failed_rows: rows.length,
            error_summary: insertErr.message,
          })
          .eq('id', job.id);

        return {
          data: null,
          error: `Transaction insertion failed: ${insertErr.message}`,
          status: 500,
        };
      }

      importedCount = inserted?.length || 0;
    }

    // 4. Update import_jobs with final counts
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        imported_rows: importedCount,
        skipped_rows: skippedCount,
        failed_rows: failedCount,
      })
      .eq('id', job.id);

    return {
      data: {
        jobId: job.id,
        job: { id: job.id },
        status: 'completed',
        totalRows: rows.length,
        importedRows: importedCount,
        insertedCount: importedCount,
        skippedRows: skippedCount,
        skippedCount: skippedCount,
        failedRows: failedCount,
      },
      error: null,
      status: 201,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error committing import';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Lists import jobs for the authenticated user
 */
export async function listImportJobs(
  client?: SupabaseClient
): Promise<ServiceResult<ImportJob[]>> {
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
      .from('import_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    return { data: (data || []) as ImportJob[], error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching import jobs';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Gets a specific import job by ID
 */
export async function getImportJob(
  id: string,
  client?: SupabaseClient
): Promise<ServiceResult<ImportJob>> {
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
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    if (!data) {
      return { data: null, error: 'Import job not found', status: 404 };
    }

    return { data: data as ImportJob, error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching import job';
    return { data: null, error: msg, status: 500 };
  }
}
