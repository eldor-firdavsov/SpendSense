'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  categoryName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteCategoryModal({
  isOpen,
  isDeleting,
  categoryName,
  onConfirm,
  onCancel,
}: DeleteCategoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-[#C74747] mb-4">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
            <AlertTriangle className="h-5 w-5 text-[#C74747]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#17211B]">Maxsus kategoriyani o‘chirish</h3>
            <p className="text-xs text-[#68736C]">Tranzaksiyalar kategoriyasiz holatga o‘tadi.</p>
          </div>
        </div>

        <p className="text-sm text-[#17211B] mb-3">
          Haqiqatan ham <span className="font-semibold text-[#17211B]">&ldquo;{categoryName}&rdquo;</span> kategoriyasini o‘chirmoqchimisiz?
        </p>

        <div className="rounded-xl bg-[#F7F9F7] border border-[#DCE4DE] p-3 text-xs text-[#68736C] mb-5">
          <span className="text-[#176B45] font-semibold">Xavfsiz saqlash:</span> Bog‘langan tranzaksiyalaringiz o‘chirilmaydi, ular &ldquo;Kategoriyasiz&rdquo; deb saqlanib qoladi.
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-delete-category-btn"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            id="confirm-delete-category-btn"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C74747] px-4 py-2 text-xs font-medium text-white hover:bg-[#963b2c] transition-colors disabled:opacity-50 shadow-fintech-card"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isDeleting ? 'O‘chirilmoqda...' : 'O‘chirish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
