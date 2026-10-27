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
  const [currency, setCurrency] = useState(goalToEdit?.currency || 'UZS');
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
      <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#DCE4DE] pb-3">
          <h2 className="text-base font-bold text-[#17211B]">
            {isEditing ? 'Jamg‘arma maqsadini tahrirlash' : 'Yangi jamg‘arma maqsadi'}
            <span className="sr-only">{isEditing ? 'Edit Savings Goal' : 'Create Savings Goal'}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[#68736C] font-medium mb-1">
              Maqsad nomi *
            </label>
            <input
              id="goal-name-input"
              type="text"
              required
              placeholder="Masalan: Yangi noutbuk yoki Ta’til"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[#68736C] font-medium mb-1">
                Maqsad summasi *
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
                className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] font-semibold focus:border-[#176B45] focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[#68736C] font-medium mb-1">
                Valyuta
              </label>
              <select
                id="goal-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white border border-[#DCE4DE] rounded-xl px-2.5 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
              >
                <option value="UZS">UZS (soʻm)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#68736C] font-medium mb-1">
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
              className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[#68736C] font-medium mb-1">
              Kutilayotgan sana (ixtiyoriy)
            </label>
            <input
              id="goal-target-date-input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>

          {isEditing && (
            <div>
              <label className="block text-[#68736C] font-medium mb-1">Holati</label>
              <select
                id="goal-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'in_progress' | 'completed' | 'cancelled')}
                className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
              >
                <option value="in_progress">Jarayonda</option>
                <option value="completed">Bajarildi</option>
                <option value="cancelled">Bekor qilindi</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE4DE]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-[#DCE4DE] bg-white text-[#17211B] hover:bg-[#F7F9F7] text-xs font-semibold transition-colors"
            >
              Bekor qilish
            </button>
            <button
              id="save-goal-btn"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-fintech-card"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isEditing ? 'Yangilash' : 'Yaratish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
