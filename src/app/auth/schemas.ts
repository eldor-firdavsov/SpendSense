import { z } from 'zod';

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, { message: 'Ism kiritilishi shart.' }),
    lastName: z
      .string()
      .trim()
      .min(1, { message: 'Familiya kiritilishi shart.' }),
    email: z
      .string()
      .trim()
      .min(1, { message: 'Elektron pochta manzili kiritilishi shart.' })
      .email({ message: 'Iltimos, to‘g‘ri elektron pochta manzilini kiriting.' }),
    password: z
      .string()
      .min(6, { message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'Iltimos, parolni tasdiqlang.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Kiritilgan parollar bir-biriga mos kelmadi.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Elektron pochta manzili kiritilishi shart.' })
    .email({ message: 'Iltimos, to‘g‘ri elektron pochta manzilini kiriting.' }),
  password: z
    .string()
    .min(1, { message: 'Parol kiritilishi shart.' }),
});

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'Ism kiritilishi shart.' }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: 'Familiya kiritilishi shart.' }),
});

export type AuthActionResult = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};
