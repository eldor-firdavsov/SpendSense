'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { BudgetWithProgress } from '@/lib/budgets/schemas';
import { getCategoryDisplayName } from '@/lib/categories/schemas';

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  color?: string | null;
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: CategoryOption[];
  budgetToEdit?: BudgetWithProgress | null;
}

export default function BudgetModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  budgetToEdit,
}: BudgetModalProps) {
  const isEditing = !!budgetToEdit;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const defaultEnd = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

  const [name, setName] = useState(budgetToEdit?.name || '');
  const [amount, setAmount] = useState(budgetToEdit ? String(budgetToEdit.amount) : '');
  const currency = budgetToEdit?.currency || 'UZS';
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'custom'>(
    budgetToEdit?.period_type || 'monthly'
  );
  const [startDate, setStartDate] = useState(budgetToEdit?.start_date || defaultStart);
  const [endDate, setEndDate] = useState(budgetToEdit?.end_date || defaultEnd);
  const [categoryId, setCategoryId] = useState<string>(budgetToEdit?.category_id || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Summa musbat son bo‘lishi kerak');
      setLoading(false);
      return;
    }

    if (endDate < startDate) {
      setError('Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas');
      setLoading(false);
      return;
    }

    const payload = {
      name: name.trim() || (categoryId ? (categories.find((c) => c.id === categoryId)?.name || 'Kategoriya') + ' budjeti' : 'Umumiy budjet'),
      amount: numAmount,
      currency,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      category_id: categoryId || null,
    };

    try {
      const url = isEditing ? `/api/budgets/${budgetToEdit.id}` : '/api/budgets';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Budjetni saqlab bo‘lmadi');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Budjetni saqlashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl space-y-4 my-8">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#D5DED7]">
          <h2 className="text-xl font-semibold text-[#17211B]">
            {isEditing ? 'Budjetni tahrirlash' : 'Yangi budjet yaratish'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#5A675F] hover:text-[#17211B] hover:bg-[#F7F9F7] min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">Budjet nomi</label>
            <input
              id="budget-name-input"
              type="text"
              placeholder="Masalan: Oylik oziq-ovqat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-sm sm:text-base text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">Limit summasi (so‘m) *</label>
            <input
              id="budget-amount-input"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="1000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-base font-semibold font-mono tabular-nums text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">Kategoriya</label>
            <select
              id="budget-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            >
              <option value="">Umumiy (barcha xarajatlar uchun)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCategoryDisplayName(c.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">Davr turi</label>
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#F7F9F7] border border-[#D5DED7]">
              {(['monthly', 'weekly', 'custom'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setPeriodType(pt)}
                  className={`min-h-[38px] py-2 rounded-lg text-sm text-center transition-all ${
                    periodType === pt
                      ? 'bg-[#176B45] text-white font-semibold shadow-xs'
                      : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                  }`}
                >
                  {pt === 'monthly' ? 'Oylik' : pt === 'weekly' ? 'Haftalik' : 'Maxsus'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#47544C] mb-1.5">Boshlanish</label>
              <input
                id="budget-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[44px] bg-white border border-[#D5DED7] rounded-xl px-3 py-2 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#47544C] mb-1.5">Tugash</label>
              <input
                id="budget-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] bg-white border border-[#D5DED7] rounded-xl px-3 py-2 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#D5DED7]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#D5DED7] bg-white text-sm font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
            >
              Bekor qilish
            </button>
            <button
              id="save-budget-btn"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#176B45] text-white text-sm font-semibold hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-fintech-card"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isEditing ? 'Yangilash' : 'Saqlash'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
