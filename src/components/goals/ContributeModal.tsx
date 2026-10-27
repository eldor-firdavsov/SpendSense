'use client';

import { useState } from 'react';
import { X, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { GoalWithProgress } from '@/lib/goals/schemas';

interface ContributeModalProps {
  isOpen: boolean;
  goal: GoalWithProgress;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContributeModal({
  isOpen,
  goal,
  onClose,
  onSuccess,
}: ContributeModalProps) {
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Iltimos, 0 dan katta to‘g‘ri summa kiriting');
      setLoading(false);
      return;
    }

    const contributionAmount = action === 'withdraw' ? -numAmount : numAmount;

    try {
      const res = await fetch(`/api/goals/${goal.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: contributionAmount,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maqsad mablag‘ini yangilab bo‘lmadi');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mablag‘ni yangilashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCE4DE] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#17211B]">Mablag‘ kiritish / yechish</h2>
            <p className="text-xs text-[#68736C] mt-0.5">{goal.name}</p>
          </div>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Action toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F9F7] rounded-xl border border-[#DCE4DE]">
            <button
              type="button"
              id="action-deposit-btn"
              onClick={() => setAction('deposit')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                action === 'deposit'
                  ? 'bg-white text-[#176B45] shadow-fintech-card font-semibold'
                  : 'text-[#68736C] hover:text-[#17211B]'
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Qo‘shish (Kirim)</span>
            </button>
            <button
              type="button"
              id="action-withdraw-btn"
              onClick={() => setAction('withdraw')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                action === 'withdraw'
                  ? 'bg-white text-[#C74747] shadow-fintech-card font-semibold'
                  : 'text-[#68736C] hover:text-[#C74747]'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Yechib olish</span>
            </button>
          </div>

          <div>
            <label className="block text-[#68736C] font-medium mb-1">
              Summa (soʻm) *
            </label>
            <input
              id="contribute-amount-input"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] font-semibold text-sm focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[#68736C] font-medium mb-1">
              Izoh (ixtiyoriy)
            </label>
            <input
              id="contribute-note-input"
              type="text"
              placeholder="Masalan: Oylik maoshdan tejash"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-2 text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>

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
              id="save-contribution-btn"
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs transition-colors disabled:opacity-50 shadow-fintech-card ${
                action === 'deposit'
                  ? 'bg-[#176B45] hover:bg-[#125536]'
                  : 'bg-[#C74747] hover:bg-[#963728]'
              }`}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{action === 'deposit' ? 'Jamg‘armaga qo‘shish' : 'Mablag‘ni yechish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
