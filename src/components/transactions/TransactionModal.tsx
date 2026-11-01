'use client';

import React, { useState } from 'react';
import { X, Loader2, Coins, Calendar, Tag, Building2, FileText } from 'lucide-react';
import { Category, TransactionWithCategory, TransactionType } from '@/types/database';
import { getCategoryDisplayName } from '@/lib/categories/schemas';

interface TransactionModalProps {
  isOpen: boolean;
  isSaving: boolean;
  transactionToEdit?: TransactionWithCategory | null;
  categories: Category[];
  onClose: () => void;
  onSave: (payload: {
    description: string;
    amount: number;
    currency: string;
    type: TransactionType;
    transaction_date: string;
    category_id: string | null;
    merchant?: string | null;
    notes?: string | null;
  }) => Promise<{ error?: string } | void>;
}

function TransactionModalForm({
  isSaving,
  transactionToEdit,
  categories,
  onClose,
  onSave,
}: Omit<TransactionModalProps, 'isOpen'>) {
  const isEditing = Boolean(transactionToEdit);

  const [description, setDescription] = useState(transactionToEdit?.description || '');
  const [amount, setAmount] = useState(
    transactionToEdit?.amount !== undefined ? String(transactionToEdit.amount) : ''
  );
  const currency = transactionToEdit?.currency || 'UZS';
  const [type, setType] = useState<TransactionType>(transactionToEdit?.type || 'expense');
  const [transactionDate, setTransactionDate] = useState(
    transactionToEdit?.transaction_date || new Date().toISOString().split('T')[0]
  );
  const [categoryId, setCategoryId] = useState<string>(transactionToEdit?.category_id || '');
  const [merchant, setMerchant] = useState(transactionToEdit?.merchant || '');
  const [notes, setNotes] = useState(transactionToEdit?.notes || '');
  const [formError, setFormError] = useState<string | null>(null);

  const compatibleCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Iltimos, noldan katta to‘g‘ri summa kiriting.');
      return;
    }

    const decimals = amount.split('.')[1];
    if (decimals && decimals.length > 2) {
      setFormError('Summada 2 tadan ortiq kasr xonasi bo‘lishi mumkin emas.');
      return;
    }

    // If description is empty, use category name or type
    let finalDescription = description.trim();
    if (!finalDescription) {
      const selectedCat = categories.find((c) => c.id === categoryId);
      finalDescription = selectedCat ? selectedCat.name : type === 'expense' ? 'Xarajat' : 'Daromad';
    }

    if (!transactionDate) {
      setFormError('Tranzaksiya sanasi kiritilishi shart.');
      return;
    }

    const res = await onSave({
      description: finalDescription,
      amount: parsedAmount,
      currency: currency.toUpperCase().trim(),
      type,
      transaction_date: transactionDate,
      category_id: categoryId ? categoryId : null,
      merchant: merchant.trim() ? merchant.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    });

    if (res?.error) {
      setFormError(res.error);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D5DED7]">
        <div>
          <h2 id="modal-title" className="text-xl font-semibold text-[#17211B] tracking-tight">
            {isEditing ? 'Tranzaksiyani tahrirlash' : 'Tranzaksiya qo‘shish'}
          </h2>
          <p className="text-sm text-[#47544C] mt-1">
            {isEditing
              ? 'Mavjud tranzaksiya tafsilotlarini o‘zgartiring'
              : 'Yangi moliyaviy yozuvni tezda kiriting'}
          </p>
        </div>
        <button
          type="button"
          id="close-modal-btn"
          onClick={onClose}
          className="rounded-xl p-2 text-[#5A675F] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Yopish</span>
        </button>
      </div>

      {/* Form Error Banner */}
      {formError && (
        <div
          id="modal-error-banner"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-[#C74747] flex items-start justify-between"
        >
          <span>{formError}</span>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-[#C74747] underline text-xs ml-2"
          >
            Yopish
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Type Selector (Chiqim / Kirim) */}
        <div>
          <label className="block text-sm font-medium text-[#47544C] mb-1.5">
            Tranzaksiya turi
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="type-expense-btn"
              onClick={() => {
                setType('expense');
                setCategoryId('');
              }}
              className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${
                type === 'expense'
                  ? 'border-[#C74747] bg-rose-50 text-[#C74747]'
                  : 'border-[#D5DED7] bg-white text-[#47544C] hover:bg-[#F7F9F7]'
              }`}
            >
              Chiqim (Xarajat)
            </button>
            <button
              type="button"
              id="type-income-btn"
              onClick={() => {
                setType('income');
                setCategoryId('');
              }}
              className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${
                type === 'income'
                  ? 'border-[#176B45] bg-[#DDF3E5] text-[#176B45]'
                  : 'border-[#D5DED7] bg-white text-[#47544C] hover:bg-[#F7F9F7]'
              }`}
            >
              Kirim (Daromad)
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Summa (so‘m) <span className="text-[#C74747]">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
              <Coins className="h-4 w-4" />
            </span>
            <input
              id="amount-input"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2.5 text-base text-[#17211B] font-semibold font-mono tabular-nums focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category-select" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Kategoriya
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
              <Tag className="h-4 w-4" />
            </span>
            <select
              id="category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            >
              <option value="">Kategoriyasiz</option>
              {compatibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCategoryDisplayName(c.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Sana <span className="text-[#C74747]">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
              <Calendar className="h-4 w-4" />
            </span>
            <input
              id="date-input"
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>
        </div>

        {/* Description / Note */}
        <div>
          <label htmlFor="description-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
            Tavsif (ixtiyoriy)
          </label>
          <input
            id="description-input"
            type="text"
            placeholder="Masalan: Tushlik, Oylik maosh..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white px-3.5 py-2.5 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
          />
        </div>

        {/* Merchant & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="merchant-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
              Savdo nuqtasi
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
                <Building2 className="h-4 w-4" />
              </span>
              <input
                id="merchant-input"
                type="text"
                placeholder="Masalan: Korzinka"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes-input" className="block text-sm font-medium text-[#47544C] mb-1.5">
              Qo‘shimcha izoh
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
                <FileText className="h-4 w-4" />
              </span>
              <input
                id="notes-input"
                type="text"
                placeholder="Qayd..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#D5DED7] flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-modal-btn"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-[#D5DED7] bg-white px-4 py-2.5 min-h-[44px] text-sm font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            id="save-transaction-btn"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#176B45] px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-fintech-card"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TransactionModal(props: TransactionModalProps) {
  if (!props.isOpen) return null;

  return (
    <div
      id="transaction-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <TransactionModalForm {...props} />
    </div>
  );
}
