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
          className="flex items-center gap-2 rounded-xl border border-[#176B45]/20 bg-[#DDF3E5] p-3.5 text-xs text-[#176B45]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176B45]" />
          <span className="font-medium">Profil muvaffaqiyatli yangilandi!</span>
        </div>
      )}

      {state?.error && (
        <div
          id="profile-error-banner"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-[#C74747]"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-[#C74747]" />
          <span className="font-medium">{state.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label
            htmlFor="profile-first-name-input"
            className="block font-medium text-[#68736C] mb-1.5"
          >
            Ism
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#68736C]" />
            <input
              id="profile-first-name-input"
              name="firstName"
              type="text"
              required
              defaultValue={initialFirstName}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white py-2.5 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#68736C] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
            />
          </div>
          {state?.fieldErrors?.firstName && (
            <p className="mt-1 text-xs text-[#C74747]">{state.fieldErrors.firstName[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="profile-last-name-input"
            className="block font-medium text-[#68736C] mb-1.5"
          >
            Familiya
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#68736C]" />
            <input
              id="profile-last-name-input"
              name="lastName"
              type="text"
              required
              defaultValue={initialLastName}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white py-2.5 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#68736C] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
            />
          </div>
          {state?.fieldErrors?.lastName && (
            <p className="mt-1 text-xs text-[#C74747]">{state.fieldErrors.lastName[0]}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="profile-email-display"
            className="block font-medium text-[#68736C] mb-1.5"
          >
            Elektron pochta (Kirish uchun foydalaniladi)
          </label>
          <input
            id="profile-email-display"
            type="email"
            disabled
            defaultValue={email}
            className="w-full rounded-xl border border-[#DCE4DE] bg-[#F7F9F7] py-2.5 px-3.5 text-xs text-[#68736C] cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          id="profile-save-button"
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#176B45] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#125536] disabled:cursor-not-allowed disabled:opacity-60 shadow-fintech-card"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saqlanmoqda...</span>
            </>
          ) : (
            <>
              <span className="sr-only">Save Profile</span>
              <span>Profilni saqlash</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
