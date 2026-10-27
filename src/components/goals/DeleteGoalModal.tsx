'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteGoalModalProps {
  isOpen: boolean;
  goalName: string;
  goalId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteGoalModal({
  isOpen,
  goalName,
  goalId,
  onClose,
  onSuccess,
}: DeleteGoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maqsadni o‘chirib bo‘lmadi');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Maqsadni o‘chirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl space-y-4">
        <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 text-[#C74747] flex items-center justify-center">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#17211B]">Jamg‘arma maqsadini o‘chirish</h2>
          <p className="mt-1 text-xs text-[#68736C] leading-relaxed">
            Haqiqatan ham <strong className="text-[#17211B]">{goalName}</strong> maqsadini o‘chirmoqchimisiz?
            Bu jamg‘arma maqsadi doimiy ravishda o‘chiriladi.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-[#DCE4DE] bg-white text-[#17211B] hover:bg-[#F7F9F7] text-xs font-semibold transition-colors"
          >
            Bekor qilish
          </button>
          <button
            id="confirm-delete-goal-btn"
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C74747] text-white font-semibold text-xs hover:bg-[#963728] transition-colors disabled:opacity-50 shadow-fintech-card"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Maqsadni o‘chirish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
