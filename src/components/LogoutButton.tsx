'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/app/auth/actions';
import { LogOut, Loader2 } from 'lucide-react';
import { clearAllCache } from '@/lib/cache/clientCache';

export default function LogoutButton({
  className = '',
}: {
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    clearAllCache();
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <button
      id="logout-button"
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F7F8F7] hover:text-[#B54736] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {isPending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#737373]" />
          <span>Chiqilmoqda...</span>
        </>
      ) : (
        <>
          <LogOut className="h-3.5 w-3.5 text-[#737373]" />
          <span>Chiqish</span>
          <span className="sr-only">Sign Out</span>
        </>
      )}
    </button>
  );
}
