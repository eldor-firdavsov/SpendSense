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
      <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3.5 text-[#C74747] mb-4">
          <div className="h-11 w-11 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100 shrink-0">
            <AlertTriangle className="h-5 w-5 text-[#C74747]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-[#17211B]">Maxsus kategoriyani o‘chirish</h3>
            <p className="text-sm sm:text-base text-[#47544C] mt-0.5">Tranzaksiyalar kategoriyasiz holatga o‘tadi.</p>
          </div>
        </div>

        <p className="text-base sm:text-lg text-[#17211B] mb-3.5 leading-relaxed">
          Haqiqatan ham <span className="font-semibold text-[#17211B]">&ldquo;{categoryName}&rdquo;</span> kategoriyasini o‘chirmoqchimisiz?
        </p>

        <div className="rounded-xl bg-[#F7F9F7] border border-[#D5DED7] p-3.5 text-xs sm:text-sm text-[#47544C] mb-5 leading-relaxed">
          <span className="text-[#176B45] font-semibold">Xavfsiz saqlash:</span> Bog‘langan tranzaksiyalaringiz o‘chirilmaydi, ular &ldquo;Kategoriyasiz&rdquo; deb saqlanib qoladi.
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            id="cancel-delete-category-btn"
            onClick={onCancel}
            disabled={isDeleting}
            className="min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-5 py-2.5 text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            id="confirm-delete-category-btn"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-[#C74747] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#963b2c] transition-colors disabled:opacity-50 shadow-xs"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isDeleting ? 'O‘chirilmoqda...' : 'O‘chirish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
