import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name cannot exceed 100 characters'),
  type: z.enum(['income', 'expense'], {
    message: "Category type must be 'income' or 'expense'",
  }),
  description: z
    .string()
    .trim()
    .max(255, 'Description cannot exceed 255 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  icon: z
    .string()
    .trim()
    .max(50, 'Icon name cannot exceed 50 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  color: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val))
    .refine((val) => val === null || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val), {
      message: 'Color must be a valid hex code (e.g. #10b981)',
    }),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryFilterSchema = z.object({
  type: z.enum(['income', 'expense', 'all']).default('all'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFilterInput = z.infer<typeof categoryFilterSchema>;
