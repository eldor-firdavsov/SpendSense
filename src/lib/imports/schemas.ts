import { z } from 'zod';

export const importColumnMappingSchema = z.object({
  dateColumn: z.string().min(1, 'Date column is required'),
  descriptionColumn: z.string().min(1, 'Description column is required'),
  amountColumn: z.string().min(1, 'Amount column is required'),
  typeColumn: z.string().optional(),
  categoryColumn: z.string().optional(),
  merchantColumn: z.string().optional(),
  notesColumn: z.string().optional(),
  defaultType: z.enum(['income', 'expense']).default('expense'),
  defaultCurrency: z.string().length(3).transform((s) => s.toUpperCase()).default('USD'),
  dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'auto']).default('auto'),
});

export const importPreviewRowSchema = z.object({
  rowIndex: z.number(),
  raw: z.record(z.string(), z.any()),
  parsed: z
    .object({
      transaction_date: z.string(),
      description: z.string(),
      amount: z.number(),
      currency: z.string(),
      type: z.enum(['income', 'expense']),
      category_name: z.string().nullable().optional(),
      merchant: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .nullable(),
  isValid: z.boolean(),
  errors: z.array(z.string()),
  isDuplicate: z.boolean().default(false),
});

export const importCommitSchema = z.object({
  jobId: z.string().uuid().nullable().optional().or(z.literal('')),
  filename: z.string().min(1, 'Filename is required').max(255),
  duplicateStrategy: z.enum(['skip', 'import_all']).default('skip'),
  rows: z.array(
    z.object({
      transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      description: z.string().min(1, 'Description is required').max(255),
      amount: z.number().positive('Amount must be positive'),
      currency: z.string().length(3).transform((s) => s.toUpperCase()),
      type: z.enum(['income', 'expense']),
      category_id: z.string().uuid().nullable().optional(),
      merchant: z.string().max(255).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    })
  ).min(1, 'At least one valid row is required to commit'),
});

export type ImportColumnMapping = z.infer<typeof importColumnMappingSchema>;
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;
