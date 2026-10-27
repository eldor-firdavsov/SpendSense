'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';
import { AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F2] px-4 py-12 text-[#17211B]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#DCE4DE] bg-white p-7 shadow-fintech-card text-center">
        <div className="flex justify-center mb-3">
          <SpendSenseLogo variant="icon" size="lg" />
        </div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#C74747]">
          <AlertCircle className="h-6 w-6" />
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#17211B]">
            Xatolik yuz berdi
          </h1>
          <p className="mt-1 text-xs text-[#68736C]">
            Server bilan bog‘lanishda yoki sahifani yuklashda kutilmagan xatolik yuz berdi.
          </p>
          {error?.digest && (
            <p className="mt-2 text-[10px] font-mono text-[#8C9890] bg-[#F7F9F7] py-1 px-2 rounded inline-block">
              Xato kodi: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#124D35] text-white text-xs font-semibold transition-all shadow-sm active:scale-98"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Qayta urinish</span>
          </button>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#DCE4DE] bg-white hover:bg-[#F7F9F7] text-xs font-medium text-[#17211B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#68736C]" />
            <span>Kirish sahifasi</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
