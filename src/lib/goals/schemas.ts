import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Goal name is required')
    .max(100, 'Goal name cannot exceed 100 characters'),
  target_amount: z
    .number({ message: 'Target amount must be a number' })
    .positive('Target amount must be positive')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places'),
  current_amount: z
    .number({ message: 'Current amount must be a number' })
    .nonnegative('Current amount cannot be negative')
    .default(0.0),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase())
    .default('UZS'),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be YYYY-MM-DD')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  tracking_strategy: z
    .enum(['manual', 'category_linked', 'account_linked'])
    .default('manual'),
  status: z
    .enum(['in_progress', 'completed', 'cancelled'])
    .default('in_progress'),
});

export const updateGoalSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  target_amount: z
    .number()
    .positive()
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places')
    .optional(),
  current_amount: z
    .number()
    .nonnegative()
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places')
    .optional(),
  currency: z.string().trim().length(3).transform((s) => s.toUpperCase()).optional(),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  tracking_strategy: z
    .enum(['manual', 'category_linked', 'account_linked'])
    .optional(),
  status: z.enum(['in_progress', 'completed', 'cancelled']).optional(),
});

export const contributeGoalSchema = z.object({
  amount: z
    .number()
    .refine((val) => val !== 0, 'Contribution amount cannot be zero')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Amount cannot have more than 2 decimal places'),
  note: z.string().max(255).optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;

export type GoalFeasibility = 'feasible' | 'challenging' | 'unlikely' | 'not_applicable';

export interface GoalWithProgress {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  tracking_strategy: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  remaining_amount: number;
  percentage_completed: number;
  feasibility: {
    status: GoalFeasibility;
    monthly_needed: number | null;
    estimated_months_remaining: number | null;
    average_monthly_net_savings: number | null;
    explanation: string;
  };
  created_at: string;
  updated_at: string;
}
