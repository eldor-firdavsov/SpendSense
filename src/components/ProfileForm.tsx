'use client';

import { useActionState } from 'react';
import { updateProfileAction } from '@/app/auth/actions';
import { type AuthActionResult } from '@/app/auth/schemas';
import { User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ProfileFormProps {
  initialFirstName: string;
  initialLastName: string;
  email: string;
}

export default function ProfileForm({
  initialFirstName,
  initialLastName,
  email,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    updateProfileAction,
    null
  );

  return (
    <form id="profile-edit-form" action={formAction} className="space-y-4">
      {state?.success && (
        <div
          id="profile-success-banner"
          className="flex items-center gap-2.5 rounded-xl border border-[#176B45]/20 bg-[#DDF3E5] p-3.5 text-sm text-[#176B45]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176B45]" />
          <span className="font-semibold">Profil muvaffaqiyatli yangilandi!</span>
        </div>
      )}

      {state?.error && (
        <div
          id="profile-error-banner"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-[#C74747]"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-[#C74747]" />
          <span className="font-semibold">{state.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="profile-first-name-input"
            className="block text-sm font-medium text-[#47544C] mb-1.5"
          >
            Ism
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A675F]" />
            <input
              id="profile-first-name-input"
              name="firstName"
              type="text"
              required
              defaultValue={initialFirstName}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>
          {state?.fieldErrors?.firstName && (
            <p className="mt-1.5 text-sm font-medium text-[#C74747]">{state.fieldErrors.firstName[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="profile-last-name-input"
            className="block text-sm font-medium text-[#47544C] mb-1.5"
          >
            Familiya
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A675F]" />
            <input
              id="profile-last-name-input"
              name="lastName"
              type="text"
              required
              defaultValue={initialLastName}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>
          {state?.fieldErrors?.lastName && (
            <p className="mt-1.5 text-sm font-medium text-[#C74747]">{state.fieldErrors.lastName[0]}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="profile-email-display"
            className="block text-sm font-medium text-[#47544C] mb-1.5"
          >
            Elektron pochta
          </label>
          <input
            id="profile-email-display"
            type="email"
            disabled
            defaultValue={email}
            className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-[#F7F9F7] py-2 px-3.5 text-sm text-[#5A675F] cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          id="profile-save-button"
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#176B45] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#125536] disabled:cursor-not-allowed disabled:opacity-50 shadow-fintech-card active:scale-98"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saqlanmoqda...</span>
            </>
          ) : (
            <span>Profilni saqlash</span>
          )}
        </button>
      </div>
    </form>
  );
}
