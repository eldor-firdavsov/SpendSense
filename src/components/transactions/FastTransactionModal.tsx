'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Check } from 'lucide-react';
import type { Category, TransactionType } from '@/types/database';
import { cachedFetch, invalidateAllFinancialCaches, CACHE_TTL } from '@/lib/cache/clientCache';

export interface FastTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categories?: Category[];
}

export default function FastTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  categories: initialCategories,
}: FastTransactionModalProps) {
  const router = useRouter();
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch categories when opened if none available
  useEffect(() => {
    if (!isOpen) return;

    if (categories.length === 0) {
      let isMounted = true;
      const fetchCategories = async () => {
        try {
          const data = await cachedFetch<{ categories: Category[] }>(
            '/api/categories',
            undefined,
            CACHE_TTL.CATEGORIES
          );
          if (isMounted && data.categories) {
            setCategories(data.categories);
          }
        } catch {
          // ignore
        } finally {
          if (isMounted) setLoadingCategories(false);
        }
      };
      fetchCategories();
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, categories.length]);

  // Focus amount input immediately on open & clear notices
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
        amountInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Available categories for current type
  const targetType = activeTab === 'income' ? 'income' : 'expense';
  const filteredCategories = categories.filter((c) => c.type === targetType);

  // Derived effective category ID
  const effectiveCategoryId =
    filteredCategories.some((c) => c.id === chosenCategoryId)
      ? chosenCategoryId
      : filteredCategories[0]?.id || '';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Iltimos, to‘g‘ri summa kiriting.');
      amountInputRef.current?.focus();
      return;
    }

    const decimals = amount.split('.')[1] || amount.split(',')[1];
    if (decimals && decimals.length > 2) {
      setError('Summada 2 tadan ortiq kasr xonasi bo‘lishi mumkin emas.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedCategory = categories.find((c) => c.id === effectiveCategoryId);
      const defaultDesc =
        activeTab === 'transfer'
          ? 'O‘tkazma'
          : selectedCategory?.name || (activeTab === 'income' ? 'Daromad' : 'Xarajat');

      const finalDescription = note.trim() || defaultDesc;
      const finalType: TransactionType = activeTab === 'income' ? 'income' : 'expense';

      const payload = {
        description: finalDescription,
        amount: Math.round(parsedAmount * 100) / 100,
        currency: currency.toUpperCase(),
        type: finalType,
        transaction_date: date || new Date().toISOString().split('T')[0],
        category_id: effectiveCategoryId || undefined,
        notes: activeTab === 'transfer' ? (note ? `${note} [O‘tkazma]` : 'O‘tkazma') : note.trim() || undefined,
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Tranzaksiyani saqlashda xatolik yuz berdi');
      }

      setSuccessMessage('Tranzaksiya muvaffaqiyatli saqlandi');
      setAmount('');
      setNote('');

      // Invalidate caches and refresh data
      invalidateAllFinancialCaches();
      router.refresh();
      onSuccess?.();

      // Brief delay to display checkmark, then close
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 500);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Saqlash muvaffaqiyatsiz bo‘ldi');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fast-transaction-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
          <h2 id="fast-transaction-title" className="text-base font-bold text-[#17211B]">
            Tranzaksiya qo‘shish
          </h2>
          <button
            type="button"
            id="close-fast-transaction-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div
            id="fast-transaction-error"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-[#B54736] font-medium"
          >
            {error}
          </div>
        )}

        {/* Success Notice */}
        {successMessage && (
          <div
            id="fast-transaction-success"
            className="p-3 rounded-xl bg-[#DDF3E5] border border-[#176B45]/30 text-xs text-[#176B45] font-semibold flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Transaction Type (Xarajat, Daromad) */}
          <div>
            <label className="block text-xs font-medium text-[#68736C] mb-1.5">
              Tranzaksiya turi
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F7F9F7] rounded-xl border border-[#DCE4DE]">
              <button
                type="button"
                id="fast-tx-tab-expense"
                onClick={() => setActiveTab('expense')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'expense'
                    ? 'bg-white text-amber-900 shadow-fintech-card border border-[#DCE4DE]'
                    : 'text-[#68736C] hover:text-[#17211B]'
                }`}
              >
                Xarajat
              </button>
              <button
                type="button"
                id="fast-tx-tab-income"
                onClick={() => setActiveTab('income')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'income'
                    ? 'bg-white text-[#176B45] shadow-fintech-card border border-[#DCE4DE]'
                    : 'text-[#68736C] hover:text-[#17211B]'
                }`}
              >
                Daromad
              </button>
            </div>
            {/* Accessible fallback for transfer */}
            <button
              type="button"
              id="fast-tx-tab-transfer"
              onClick={() => setActiveTab('transfer')}
              className="sr-only"
              aria-hidden="true"
            >
              O‘tkazma
            </button>
          </div>

          {/* 2. Amount Field (Focused Immediately, Large, Numeric Keyboard) */}
          <div>
            <label htmlFor="fast-tx-amount" className="block text-xs font-medium text-[#68736C] mb-1">
              Summa <span className="text-[#B54736]">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-semibold text-[#68736C]">
                so‘m
              </span>
              <input
                ref={amountInputRef}
                id="fast-tx-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[#DCE4DE] bg-white pl-14 pr-3 py-2.5 text-xl font-bold font-mono text-[#17211B] placeholder-[#D1D5DB] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
                required
              />
            </div>
          </div>

          {/* 3. Category Selector */}
          <div>
            <label htmlFor="fast-tx-category" className="block text-xs font-medium text-[#68736C] mb-1">
              Kategoriya
            </label>
            <select
              id="fast-tx-category"
              value={effectiveCategoryId}
              onChange={(e) => setChosenCategoryId(e.target.value)}
              disabled={isSubmitting || loadingCategories}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] font-medium focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
            >
              {filteredCategories.length === 0 ? (
                <option value="">(Kategoriyalar mavjud emas)</option>
              ) : (
                filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 4. Date (Defaults to Today) & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fast-tx-date" className="block text-xs font-medium text-[#68736C] mb-1">
                Sana
              </label>
              <input
                id="fast-tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
              />
            </div>

            <div>
              <label htmlFor="fast-tx-currency" className="block text-xs font-medium text-[#68736C] mb-1">
                Valyuta
              </label>
              <select
                id="fast-tx-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] font-medium focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
              >
                <option value="UZS">UZS (so‘m)</option>
              </select>
            </div>
          </div>

          {/* 5. Optional Note */}
          <div>
            <label htmlFor="fast-tx-note" className="block text-xs font-medium text-[#68736C] mb-1">
              Izoh <span className="text-[#A3A3A3] font-normal">(ixtiyoriy)</span>
            </label>
            <input
              id="fast-tx-note"
              type="text"
              placeholder="Masalan: Tushlik, Supermarket, Yoqilg‘i..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] placeholder-[#A3A3A3] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
            />
          </div>

          {/* 6. Primary "Saqlash" & Secondary "Bekor qilish" Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              id="fast-tx-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#DCE4DE] bg-white hover:bg-[#F7F9F7] text-[#17211B] text-xs font-semibold transition-all disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              id="fast-tx-submit-btn"
              disabled={isSubmitting || !amount}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white py-2.5 px-4 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-fintech-card active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : successMessage ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Saqlandi</span>
                </>
              ) : (
                <span>Saqlash</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
