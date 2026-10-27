import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
  currency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .default('UZS'),
  interval: z.enum(['day', 'week', 'month']).default('month'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'startDate cannot be after endDate',
    path: ['endDate'],
  }
);

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  totalAmount: number;
  percentage: number;
  count: number;
}

export interface TrendBucket {
  periodKey: string; // YYYY-MM-DD or YYYY-MM
  income: number;
  expense: number;
  net: number;
}

export interface PeriodComparison {
  currentTotal: number;
  previousTotal: number;
  absoluteChange: number;
  percentageChange: number | null; // null if previousTotal is 0
}

export interface AnalyticsSummary {
  currency: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number; // 0 to 100 percentage
  transactionCount: number;
  averageTransactionAmount: number;
  expenseBreakdown: CategoryBreakdownItem[];
  incomeBreakdown: CategoryBreakdownItem[];
  trends: TrendBucket[];
  comparison: {
    income: PeriodComparison;
    expense: PeriodComparison;
    net: PeriodComparison;
  };
  largestExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
    category_name: string;
  }>;
  largestIncome: Array<{
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
    category_name: string;
  }>;
}
