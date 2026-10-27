import { z } from 'zod';

export const createBudgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Budget name is required')
    .max(100, 'Budget name cannot exceed 100 characters'),
  amount: z
    .number({ message: 'Amount must be a valid number' })
    .positive('Budget amount must be positive')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places'),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((s) => s.toUpperCase())
    .default('UZS'),
  period_type: z.enum(['monthly', 'weekly', 'custom']).default('monthly'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  category_id: z
    .string()
    .uuid('Category ID must be a valid UUID')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
}).refine(
  (data) => data.end_date >= data.start_date,
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
);

export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  amount: z
    .number()
    .positive('Budget amount must be positive')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places')
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase())
    .optional(),
  period_type: z.enum(['monthly', 'weekly', 'custom']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.end_date >= data.start_date;
    }
    return true;
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
);

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export type BudgetStatus = 'on_track' | 'near_limit' | 'over_budget';

export interface BudgetWithProgress {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: string;
  period_type: 'monthly' | 'weekly' | 'custom';
  start_date: string;
  end_date: string;
  spent: number;
  remaining: number;
  percentageUsed: number;
  status: BudgetStatus;
  category?: {
    id: string;
    name: string;
    type: string;
    color: string | null;
    icon: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}
