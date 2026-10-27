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
    <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#DCE4DE]">
        <div>
          <h2 id="category-modal-title" className="text-base sm:text-lg font-bold text-[#17211B] tracking-tight">
            {isEditing ? 'Kategoriyani tahrirlash' : 'Maxsus kategoriya yaratish'}
          </h2>
          <p className="text-xs text-[#68736C] mt-0.5">
            {isEditing
              ? 'Maxsus kategoriya parametrlarini yangilang.'
              : 'Xarajat yoki daromadlaringiz uchun yangi kategoriya qo‘shing.'}
          </p>
        </div>
        <button
          type="button"
          id="category-modal-close-btn"
          onClick={onClose}
          className="rounded-xl p-1.5 text-[#68736C] hover:bg-[#F7F9F7] hover:text-[#17211B] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Error Alert */}
      {formError && (
        <div
          id="category-modal-error"
          className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-[#C74747] flex items-center gap-2"
        >
          <span>{formError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Type Selector */}
        <div>
          <label className="block text-xs font-medium text-[#68736C] mb-1.5">
            Kategoriya turi *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="category-type-expense"
              onClick={() => setType('expense')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                type === 'expense'
                  ? 'border-[#C74747] bg-red-50 text-[#C74747]'
                  : 'border-[#DCE4DE] bg-white text-[#68736C] hover:bg-[#F7F9F7]'
              }`}
            >
              Chiqim
            </button>
            <button
              type="button"
              id="category-type-income"
              onClick={() => setType('income')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                type === 'income'
                  ? 'border-[#176B45] bg-[#DDF3E5] text-[#176B45]'
                  : 'border-[#DCE4DE] bg-white text-[#68736C] hover:bg-[#F7F9F7]'
              }`}
            >
              Kirim
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="category-name-input" className="block text-xs font-medium text-[#68736C] mb-1">
            Kategoriya nomi *
          </label>
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
            <input
              id="category-name-input"
              type="text"
              required
              placeholder="Masalan: Kofe yoki Freelance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white py-2.5 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#68736C] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="category-desc-input" className="block text-xs font-medium text-[#68736C] mb-1">
            Qisqacha izoh (ixtiyoriy)
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736C]" />
            <input
              id="category-desc-input"
              type="text"
              placeholder="Masalan: Qahvaxona va kichik tushliklar"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white py-2.5 pl-9 pr-3 text-xs text-[#17211B] placeholder-[#68736C] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45]"
            />
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-xs font-medium text-[#68736C] mb-1.5">
            Belgi rangi
          </label>
          <div className="flex items-center gap-2">
            {['#176B45', '#2563EB', '#D97706', '#C74747', '#7C3AED', '#DB2777', '#68736C'].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#17211B] scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              )
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE4DE]">
          <button
            type="button"
            id="category-modal-cancel-btn"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            id="category-modal-save-btn"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#176B45] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-fintech-card"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
