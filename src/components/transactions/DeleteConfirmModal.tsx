'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  transactionDescription: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  isOpen,
  isDeleting,
  transactionDescription,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3.5 text-[#C74747] mb-4">
          <div className="h-11 w-11 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100 shrink-0">
            <AlertTriangle className="h-5 w-5 text-[#C74747]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#17211B]">Tranzaksiyani o‘chirish</h3>
            <p className="text-sm sm:text-base text-[#47544C]">Bu amalni qaytarib bo‘lmaydi.</p>
          </div>
        </div>

        <p className="text-base sm:text-lg text-[#17211B] mb-6 leading-relaxed">
          Haqiqatan ham <span className="font-semibold text-[#17211B]">&ldquo;{transactionDescription}&rdquo;</span> tranzaksiyasini o‘chirmoqchimisiz?
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-delete-btn"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#D5DED7] bg-white px-5 py-2.5 min-h-[44px] text-sm font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            id="confirm-delete-btn"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C74747] px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-[#993b2c] transition-colors disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isDeleting ? 'O‘chirilmoqda...' : 'O‘chirish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
