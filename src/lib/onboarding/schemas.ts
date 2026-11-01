import { z } from 'zod';

export const personalInfoStepSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'Ismingizni kiriting')
    .max(50, 'Ism 50 ta belgidan oshmasligi kerak'),
  last_name: z
    .string()
    .trim()
    .min(1, 'Familiyangizni kiriting')
    .max(50, 'Familiya 50 ta belgidan oshmasligi kerak'),
});

export const monthlyIncomeStepSchema = z.object({
  declared_monthly_income: z
    .number({ message: 'Raqam kiriting' })
    .min(0, 'Daromad manfiy bo‘lishi mumkin emas')
    .default(0),
});

export const monthlySpendingStepSchema = z.object({
  declared_monthly_expenses: z
    .number({ message: 'Raqam kiriting' })
    .min(0, 'Xarajat manfiy bo‘lishi mumkin emas')
    .default(0),
});

export const reductionTargetStepSchema = z.object({
  target_expense_reduction_percent: z
    .number()
    .min(0, 'Foiz 0 dan kam bo‘lmasligi kerak')
    .max(100, 'Foiz 100 dan oshmasligi kerak')
    .default(0),
  target_monthly_expenses: z
    .number()
    .min(0, 'Maqsadli xarajat manfiy bo‘lmasligi kerak')
    .default(0),
});

export const onboardingGoalItemSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1, 'Maqsad nomini kiriting').max(100),
  target_amount: z.number().positive('Summa 0 dan katta bo‘lishi kerak'),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD ko‘rinishida bo‘lishi kerak')
    .optional()
    .nullable(),
});

export const completeOnboardingSchema = z.object({
  first_name: z.string().trim().min(1, 'Ism kiritilishi shart'),
  last_name: z.string().trim().min(1, 'Familiya kiritilishi shart'),
  declared_monthly_income: z.number().min(0).default(0),
  declared_monthly_expenses: z.number().min(0).default(0),
  target_expense_reduction_percent: z.number().min(0).max(100).default(0),
  target_monthly_expenses: z.number().min(0).default(0),
  goals: z.array(onboardingGoalItemSchema).default([]),
});

export type PersonalInfoStepInput = z.infer<typeof personalInfoStepSchema>;
export type MonthlyIncomeStepInput = z.infer<typeof monthlyIncomeStepSchema>;
export type MonthlySpendingStepInput = z.infer<typeof monthlySpendingStepSchema>;
export type ReductionTargetStepInput = z.infer<typeof reductionTargetStepSchema>;
export type OnboardingGoalItem = z.infer<typeof onboardingGoalItemSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
