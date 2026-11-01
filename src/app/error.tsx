'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

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
          <h1 className="text-xl font-semibold tracking-tight text-[#17211B]">
            Xatolik yuz berdi
          </h1>
          <p className="mt-2 text-base text-[#47544C] leading-relaxed">
            Server bilan bog‘lanishda yoki sahifani yuklashda kutilmagan xatolik yuz berdi.
          </p>
          {error?.digest && (
            <p className="mt-2 text-sm font-mono text-[#5A675F] bg-[#F7F9F7] py-1 px-2.5 rounded-lg border border-[#D5DED7] inline-block">
              Xato kodi: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#124D35] text-white text-sm font-semibold transition-all shadow-fintech-card active:scale-98"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Qayta urinish</span>
          </button>

          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#D5DED7] bg-white hover:bg-[#F7F9F7] text-sm font-semibold text-[#17211B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-[#47544C]" />
            <span>Kirish sahifasi</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
