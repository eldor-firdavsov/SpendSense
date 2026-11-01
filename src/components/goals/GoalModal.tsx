'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { GoalWithProgress } from '@/lib/goals/schemas';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  goalToEdit?: GoalWithProgress | null;
}

export default function GoalModal({
  isOpen,
  onClose,
  onSuccess,
  goalToEdit,
}: GoalModalProps) {
  const isEditing = !!goalToEdit;

  const [name, setName] = useState(goalToEdit?.name || '');
  const [targetAmount, setTargetAmount] = useState(goalToEdit ? String(goalToEdit.target_amount) : '');
  const [currentAmount, setCurrentAmount] = useState(goalToEdit ? String(goalToEdit.current_amount) : '0');
  const currency = goalToEdit?.currency || 'UZS';
  const [targetDate, setTargetDate] = useState(goalToEdit?.target_date || '');
  const [status, setStatus] = useState<'in_progress' | 'completed' | 'cancelled'>(
    goalToEdit?.status || 'in_progress'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numTarget = parseFloat(targetAmount);
    const numCurrent = parseFloat(currentAmount);

    if (isNaN(numTarget) || numTarget <= 0) {
      setError('Maqsad summasi musbat son bo‘lishi kerak');
      setLoading(false);
      return;
    }

    if (isNaN(numCurrent) || numCurrent < 0) {
      setError('Hozirgi summa manfiy bo‘lishi mumkin emas');
      setLoading(false);
      return;
    }

    const payload = {
      name: name.trim(),
      target_amount: numTarget,
      current_amount: numCurrent,
      currency,
      target_date: targetDate || null,
      status,
    };

    try {
      const url = isEditing ? `/api/goals/${goalToEdit.id}` : '/api/goals';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maqsadni saqlab bo‘lmadi');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Maqsadni saqlashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 sm:p-7 shadow-xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#D5DED7] pb-3.5">
          <h2 className="text-xl font-semibold text-[#17211B]">
            {isEditing ? 'Jamg‘arma maqsadini tahrirlash' : 'Yangi jamg‘arma maqsadi'}
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
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">
              Maqsad nomi *
            </label>
            <input
              id="goal-name-input"
              type="text"
              required
              placeholder="Masalan: Yangi noutbuk yoki Ta’til"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-sm sm:text-base text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">
              Maqsad summasi (so‘m) *
            </label>
            <input
              id="goal-target-amount-input"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="1000.00"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-base font-semibold font-mono tabular-nums text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">
              Boshlang‘ich to‘plangan mablag‘
            </label>
            <input
              id="goal-current-amount-input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-base font-semibold font-mono tabular-nums text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#47544C] mb-1.5">
              Kutilayotgan sana (ixtiyoriy)
            </label>
            <input
              id="goal-target-date-input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-[#47544C] mb-1.5">Holati</label>
              <select
                id="goal-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'in_progress' | 'completed' | 'cancelled')}
                className="w-full min-h-[48px] bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2.5 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              >
                <option value="in_progress">Jarayonda</option>
                <option value="completed">Bajarildi</option>
                <option value="cancelled">Bekor qilindi</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#D5DED7]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#D5DED7] bg-white text-[#17211B] hover:bg-[#F7F9F7] text-sm font-semibold transition-colors"
            >
              Bekor qilish
            </button>
            <button
              id="save-goal-btn"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-fintech-card"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isEditing ? 'Yangilash' : 'Yaratish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
