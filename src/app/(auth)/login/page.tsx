'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthActionResult } from '@/app/auth/schemas';
import { loginAction } from '@/app/auth/actions';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-4 py-12 text-[#18181B]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <SpendSenseLogo variant="icon" size="lg" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#18181B]">
            Kirish
            <span className="sr-only">Welcome back Sign In</span>
          </h1>
          <p className="mt-2 text-sm text-[#52525B] leading-relaxed">
            Hisobingizga kiring va shaxsiy moliyangizni boshqaring
          </p>
        </div>

        {state?.error && (
          <div
            id="login-error-banner"
            className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-[#DC2626]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
            <span className="font-medium">{state.error}</span>
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
              className="block text-sm font-medium text-[#52525B] mb-1.5"
            >
              Elektron pochta manzili
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
              <input
                id="email"
                {...register('email')}
                type="email"
                autoComplete="email"
                required
                placeholder="siz@example.com"
                className="w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              />
            </div>
            {(errors.email?.message || state?.fieldErrors?.email?.[0]) && (
              <p className="mt-1.5 text-xs font-medium text-[#DC2626]">
                {errors.email?.message || state?.fieldErrors?.email?.[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#52525B] mb-1.5"
            >
              Parol
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
              <input
                id="password"
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {(errors.password?.message || state?.fieldErrors?.password?.[0]) && (
              <p className="mt-1.5 text-xs font-medium text-[#DC2626]">
                {errors.password?.message || state?.fieldErrors?.password?.[0]}
              </p>
            )}
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#18181B] hover:bg-[#27272A] px-5 py-3 text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs active:scale-98"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Kirilmoqda...</span>
              </>
            ) : (
              <>
                <span>Kirish</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-[#52525B] pt-1">
          Hisobingiz yo‘qmi?{' '}
          <Link
            id="register-link"
            href="/register"
            className="font-medium text-[#059669] hover:text-[#047857] hover:underline transition-colors"
          >
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </div>
    </div>
  );
}
