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
      <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-[#C74747] mb-4">
          <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
            <AlertTriangle className="h-5 w-5 text-[#C74747]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#17211B]">Tranzaksiyani o‘chirish</h3>
            <p className="text-xs text-[#68736C]">Bu amalni qaytarib bo‘lmaydi.</p>
          </div>
        </div>

        <p className="text-xs text-[#68736C] mb-6 leading-relaxed">
          Haqiqatan ham <span className="font-semibold text-[#17211B]">&ldquo;{transactionDescription}&rdquo;</span> tranzaksiyasini o‘chirmoqchimisiz?
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            id="cancel-delete-btn"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-2 text-xs font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            id="confirm-delete-btn"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C74747] px-4 py-2 text-xs font-semibold text-white hover:bg-[#993b2c] transition-colors disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isDeleting ? 'O‘chirilmoqda...' : 'O‘chirish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
