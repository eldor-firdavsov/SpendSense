import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const currencyRegex = /^[A-Z]{3}$/;

export const createTransactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(255, 'Description cannot exceed 255 characters'),
  amount: z
    .union([z.number(), z.string()])
    .transform((val, ctx) => {
      const num = typeof val === 'number' ? val : Number(val.trim());
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount must be a valid number',
        });
        return z.NEVER;
      }
      return num;
    })
    .pipe(
      z
        .number()
        .positive('Amount must be a positive monetary magnitude')
        .refine(
          (val) => {
            const str = val.toFixed(10).replace(/0+$/, '');
            const decimals = str.split('.')[1];
            return !decimals || decimals.length <= 2;
          },
          { message: 'Amount cannot have more than 2 decimal places' }
        )
    ),
  type: z.enum(['income', 'expense'], {
    message: "Transaction type must be 'income' or 'expense'",
  }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(currencyRegex, 'Currency must be a 3-letter uppercase ISO code')
    .default('UZS'),
  transaction_date: z
    .string()
    .regex(dateRegex, 'Date must be formatted as YYYY-MM-DD')
    .refine(
      (val) => {
        const parts = val.split('-').map(Number);
        if (parts.length !== 3) return false;
        const [year, month, day] = parts;
        const d = new Date(Date.UTC(year, month - 1, day));
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() === month - 1 &&
          d.getUTCDate() === day
        );
      },
      { message: 'Invalid calendar date' }
    ),
  category_id: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  merchant: z
    .string()
    .trim()
    .max(255, 'Merchant cannot exceed 255 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  source: z.enum(['manual', 'csv', 'excel', 'recurring']).default('manual'),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z
  .object({
    startDate: z
      .string()
      .regex(dateRegex, 'Start date must be formatted as YYYY-MM-DD')
      .optional()
      .nullable(),
    endDate: z
      .string()
      .regex(dateRegex, 'End date must be formatted as YYYY-MM-DD')
      .optional()
      .nullable(),
    type: z.enum(['income', 'expense', 'all']).default('all'),
    categoryId: z.string().optional().nullable(),
    search: z.string().trim().max(100).optional().nullable(),
    sortBy: z.enum(['date', 'amount']).default('date'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
