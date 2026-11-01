'use client';

import React, { useState } from 'react';
import { X, Loader2, Tag, FileText } from 'lucide-react';
import { Category, CategoryType } from '@/types/database';

interface CategoryModalProps {
  isOpen: boolean;
  isSaving: boolean;
  categoryToEdit?: Category | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    type: CategoryType;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
  }) => Promise<{ error?: string } | void>;
}

function CategoryModalForm({
  isSaving,
  categoryToEdit,
  onClose,
  onSave,
}: Omit<CategoryModalProps, 'isOpen'>) {
  const isEditing = Boolean(categoryToEdit);

  const [name, setName] = useState(categoryToEdit?.name || '');
  const [type, setType] = useState<CategoryType>(categoryToEdit?.type || 'expense');
  const [description, setDescription] = useState(categoryToEdit?.description || '');
  const [icon] = useState(categoryToEdit?.icon || '');
  const [color, setColor] = useState(categoryToEdit?.color || '#176B45');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Kategoriya nomi kiritilishi shart.');
      return;
    }

    const res = await onSave({
      name: name.trim(),
      type,
      description: description.trim() ? description.trim() : null,
      icon: icon.trim() ? icon.trim() : null,
      color: color.trim() ? color.trim() : null,
    });

    if (res?.error) {
      setFormError(res.error);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D5DED7]">
        <div>
          <h2 id="category-modal-title" className="text-lg sm:text-xl font-semibold text-[#17211B] tracking-tight">
            {isEditing ? 'Kategoriyani tahrirlash' : 'Maxsus kategoriya yaratish'}
          </h2>
          <p className="text-sm sm:text-base text-[#47544C] mt-1">
            {isEditing
              ? 'Maxsus kategoriya parametrlarini yangilang.'
              : 'Xarajat yoki daromadlaringiz uchun yangi kategoriya qo‘shing.'}
          </p>
        </div>
        <button
          type="button"
          id="category-modal-close-btn"
          onClick={onClose}
          className="rounded-xl p-2 text-[#5A675F] hover:bg-[#F7F9F7] hover:text-[#17211B] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Error Alert */}
      {formError && (
        <div
          id="category-modal-error"
          className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-[#C74747] flex items-center gap-2"
        >
          <span>{formError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Type Selector */}
        <div>
          <label className="block text-sm font-medium text-[#47544C] mb-2">
            Kategoriya turi *
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="category-type-expense"
              onClick={() => setType('expense')}
              className={`min-h-[44px] py-2 px-3 rounded-xl text-sm font-semibold border transition-all ${
                type === 'expense'
                  ? 'border-[#C74747] bg-red-50 text-[#C74747] shadow-xs'
                  : 'border-[#D5DED7] bg-white text-[#47544C] hover:bg-[#F7F9F7]'
              }`}
            >
              Chiqim
            </button>
            <button
              type="button"
              id="category-type-income"
              onClick={() => setType('income')}
              className={`min-h-[44px] py-2 px-3 rounded-xl text-sm font-semibold border transition-all ${
                type === 'income'
                  ? 'border-[#176B45] bg-[#DDF3E5] text-[#176B45] shadow-xs'
                  : 'border-[#D5DED7] bg-white text-[#47544C] hover:bg-[#F7F9F7]'
              }`}
            >
              Kirim
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="category-name-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Kategoriya nomi *
          </label>
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#5A675F]" />
            <input
              id="category-name-input"
              type="text"
              required
              placeholder="Masalan: Kofe yoki Freelance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white py-2.5 pl-10 pr-3.5 text-sm sm:text-base text-[#17211B] placeholder-[#8C9890] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="category-desc-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Qisqacha izoh (ixtiyoriy)
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#5A675F]" />
            <input
              id="category-desc-input"
              type="text"
              placeholder="Masalan: Qahvaxona va kichik tushliklar"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white py-2.5 pl-10 pr-3.5 text-sm sm:text-base text-[#17211B] placeholder-[#8C9890] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20"
            />
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-sm font-medium text-[#47544C] mb-2">
            Belgi rangi
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {['#176B45', '#2563EB', '#D97706', '#C74747', '#7C3AED', '#DB2777', '#68736C'].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#17211B] scale-110 shadow-sm' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Tanlash rangi: ${c}`}
                />
              )
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#D5DED7]">
          <button
            type="button"
            id="category-modal-cancel-btn"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-5 py-2.5 text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            id="category-modal-save-btn"
            disabled={isSaving}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-[#176B45] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-xs"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CategoryModal(props: CategoryModalProps) {
  if (!props.isOpen) return null;

  return (
    <div
      id="category-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <CategoryModalForm {...props} />
    </div>
  );
}
