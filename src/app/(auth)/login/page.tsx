'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthActionResult } from '@/app/auth/schemas';
import { loginAction } from '@/app/auth/actions';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginAction,
    null
  );

  const {
    register,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const isLoading = isPending || isSubmitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F2] px-4 py-12 text-[#17211B]">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-[#DCE4DE] bg-white p-7 shadow-fintech-card">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <SpendSenseLogo variant="icon" size="lg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#17211B]">
            Kirish
            <span className="sr-only">Welcome back</span>
          </h1>
          <p className="mt-1 text-xs text-[#68736C]">
            Hisobingizga kiring va shaxsiy moliyangizni boshqaring
          </p>
        </div>

        {state?.error && (
          <div
            id="login-error-banner"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form
          id="login-form"
          action={formAction}
          className="space-y-4"
        >
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
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#DCE4DE] bg-white py-2 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#9CA3AF] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              />
            </div>
            {(errors.password?.message || state?.fieldErrors?.password?.[0]) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password?.message || state?.fieldErrors?.password?.[0]}
              </p>
            )}
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#176B45] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#125536] focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Kirilmoqda...</span>
              </>
            ) : (
              <>
                <span>Kirish</span>
                <span className="sr-only">Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#68736C]">
          Hisobingiz yo‘qmi?{' '}
          <Link
            id="register-link"
            href="/register"
            className="font-semibold text-[#176B45] hover:underline"
          >
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </div>
    </div>
  );
}
