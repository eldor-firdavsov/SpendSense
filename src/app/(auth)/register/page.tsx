'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type AuthActionResult } from '@/app/auth/schemas';
import { registerAction } from '@/app/auth/actions';
import { Lock, Mail, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    registerAction,
    null
  );

  const {
    register,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const isLoading = isPending || isSubmitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F2] px-4 py-12 text-[#17211B]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#DCE4DE] bg-white p-7 shadow-fintech-card">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <SpendSenseLogo variant="icon" size="lg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#17211B]">
            Ro‘yxatdan o‘tish
            <span className="sr-only">Create your SpendSense account</span>
          </h1>
          <p className="mt-1 text-xs text-[#68736C]">
            SpendSense hisobini yaratish uchun ma’lumotlaringizni kiriting
          </p>
        </div>

        {state?.error && (
          <div
            id="register-error-banner"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form
          id="register-form"
          action={formAction}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-medium text-[#68736C] mb-1"
              >
                Ism
                <span className="sr-only">First Name</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
                <input
                  id="firstName"
                  {...register('firstName')}
                  type="text"
                  required
                  placeholder="Ali"
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
                />
              </div>
              {(errors.firstName?.message || state?.fieldErrors?.firstName?.[0]) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.firstName?.message || state?.fieldErrors?.firstName?.[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-medium text-[#68736C] mb-1"
              >
                Familiya
                <span className="sr-only">Last Name</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
                <input
                  id="lastName"
                  {...register('lastName')}
                  type="text"
                  required
                  placeholder="Valiyev"
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
                />
              </div>
              {(errors.lastName?.message || state?.fieldErrors?.lastName?.[0]) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.lastName?.message || state?.fieldErrors?.lastName?.[0]}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[#68736C] mb-1"
            >
              Elektron pochta manzili
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
              <input
                id="email"
                {...register('email')}
                type="email"
                autoComplete="email"
                required
                placeholder="siz@example.com"
                className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              />
            </div>
            {(errors.email?.message || state?.fieldErrors?.email?.[0]) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.email?.message || state?.fieldErrors?.email?.[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#68736C] mb-1"
            >
              Parol
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
              <input
                id="password"
                {...register('password')}
                type="password"
                autoComplete="new-password"
                required
                placeholder="Kamida 8 ta belgi"
                className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              />
            </div>
            {(errors.password?.message || state?.fieldErrors?.password?.[0]) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password?.message || state?.fieldErrors?.password?.[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-medium text-[#68736C] mb-1"
            >
              Parolni tasdiqlang
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
              <input
                id="confirmPassword"
                {...register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                required
                placeholder="Parolni qayta kiriting"
                className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              />
            </div>
            {(errors.confirmPassword?.message || state?.fieldErrors?.confirmPassword?.[0]) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.confirmPassword?.message || state?.fieldErrors?.confirmPassword?.[0]}
              </p>
            )}
          </div>

          <button
            id="register-submit-button"
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#176B45] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#125536] focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 pt-2.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Ro‘yxatdan o‘tilmoqda...</span>
              </>
            ) : (
              <>
                <span>Ro‘yxatdan o‘tish</span>
                <span className="sr-only">Sign Up</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#68736C]">
          Hisobingiz bormi?{' '}
          <Link
            id="login-link"
            href="/login"
            className="font-semibold text-[#176B45] hover:underline"
          >
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
