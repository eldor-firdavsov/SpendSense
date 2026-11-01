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
      className={`min-h-[36px] sm:min-h-[40px] inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#D5DED7] bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#17211B] transition-all hover:bg-red-50/50 hover:text-[#C74747] hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-98 ${className}`}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-[#5A675F]" />
          <span>Chiqilmoqda...</span>
        </>
      ) : (
        <>
          <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#5A675F]" />
          <span>Chiqish</span>
        </>
      )}
    </button>
  );
}
