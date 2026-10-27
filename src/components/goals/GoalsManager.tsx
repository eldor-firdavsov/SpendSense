'use client';

import { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import GoalModal from './GoalModal';
import ContributeModal from './ContributeModal';
import DeleteGoalModal from './DeleteGoalModal';
import type { GoalWithProgress } from '@/lib/goals/schemas';
import { PageHeader, BentoGrid, BentoCard, BentoMetricCard, BentoEmptyState } from '@/components/bento';
import { cachedFetch, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';

export default function GoalsManager() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [currency, setCurrency] = useState('UZS');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<GoalWithProgress | null>(null);

  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<GoalWithProgress | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<GoalWithProgress | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadGoals() {
      try {
        const params = new URLSearchParams({ currency });
        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }
        if (reloadTrigger > 0) {
          invalidateCache('/api/goals');
        }
        const data = await cachedFetch<{ goals: GoalWithProgress[] }>(
          `/api/goals?${params.toString()}`,
          undefined,
          CACHE_TTL.GOALS
        );
        if (!isCancelled) {
          setGoals(data.goals || []);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Maqsadlarni yuklashda xatolik');
          setLoading(false);
        }
      }
    }

    loadGoals();

    return () => {
      isCancelled = true;
    };
  }, [currency, statusFilter, reloadTrigger]);

  const refreshGoals = () => {
    invalidateCache('/api/goals');
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount: number, curr = 'UZS') => {
    if (curr === 'USD') {
      return `$${amount >= 1000 ? amount.toLocaleString('en-US') : Number(amount).toFixed(2)}`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  };

  // Aggregated totals
  const totalTarget = goals.reduce((acc, g) => acc + Number(g.target_amount), 0);
  const totalCurrent = goals.reduce((acc, g) => acc + Number(g.current_amount), 0);
  const totalRemaining = Math.max(0, totalTarget - totalCurrent);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Target className="h-5 w-5 text-[#176B45]" />
            <span>Jamg‘arma maqsadlari</span>
          </div>
        }
        subtitle="Moliyaviy maqsadlarni belgilang, jamg‘arish jarayonini kuzating va real pul oqimingiz asosida imkoniyatlarni baholang."
        srOnlyFallback="Savings Goals"
        actions={
          <>
            {/* Status Filter */}
            <div className="inline-flex rounded-xl bg-[#F7F9F7] p-0.5 border border-[#DCE4DE] text-xs">
              {(['all', 'in_progress', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs ${
                    statusFilter === s
                      ? 'bg-white text-[#176B45] font-semibold shadow-fintech-card'
                      : 'text-[#68736C] hover:text-[#17211B]'
                  }`}
                >
                  {s === 'all' ? 'Barchasi' : s === 'in_progress' ? 'Faol' : 'Yakunlangan'}
                </button>
              ))}
            </div>

            {/* Currency */}
            <select
              id="goals-currency-filter"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-white border border-[#DCE4DE] text-[#17211B] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#176B45] transition-all shadow-fintech-card"
            >
              <option value="UZS">UZS (soʻm)</option>
            </select>

            <button
              id="create-goal-btn"
              type="button"
              onClick={() => {
                setGoalToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Maqsad yaratish</span>
            </button>
          </>
        }
      />

      {/* Hero Summary Bento Metric Cards */}
      {goals.length > 0 && (
        <BentoGrid cols={3}>
          <BentoMetricCard
            title="Jami to‘plangan mablag‘"
            value={formatCurrency(totalCurrent)}
            subtext={`Mavjud jamg‘arma (${overallProgress.toFixed(0)}%)`}
            accent="green"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <BentoMetricCard
            title="Umumiy maqsad summasi"
            value={formatCurrency(totalTarget)}
            subtext={`${goals.length} ta maqsad bo‘yicha`}
            accent="neutral"
            icon={<Target className="h-4 w-4" />}
          />
          <BentoMetricCard
            title="Yetishmayotgan summa"
            value={formatCurrency(totalRemaining)}
            subtext="Maqsadga erishish uchun zarur"
            accent="amber"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
        </BentoGrid>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Maqsadlarni yuklab bo‘lmadi</p>
            <p className="text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-[#68736C] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-[#176B45]" />
          <p className="text-xs">Jamg‘arma maqsadlari baholanmoqda...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && goals.length === 0 && (
        <BentoEmptyState
          icon={<Target className="h-6 w-6 text-[#176B45]" />}
          title="Hozircha jamg‘arma maqsadlari yo‘q"
          description="Favqulodda jamg‘arma, yirik xarid yoki kelgusi rejalaringiz uchun maqsad belgilang."
          action={
            <button
              id="empty-create-goal-btn"
              type="button"
              onClick={() => {
                setGoalToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Birinchi maqsadni yaratish</span>
            </button>
          }
        />
      )}

      {/* Goals Grid */}
      {!loading && goals.length > 0 && (
        <BentoGrid cols={3}>
          {goals.map((g) => {
            const isDone = g.status === 'completed' || g.percentage_completed >= 100;
            const feasStatus = g.feasibility.status;

            return (
              <BentoCard
                key={g.id}
                isInteractive
                className="space-y-4 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-[#17211B]">{g.name}</h3>
                      {g.target_date && (
                        <p className="text-[11px] text-[#68736C] mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-[#68736C]" />
                          <span>Muddat: {g.target_date}</span>
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        isDone
                          ? 'bg-[#DDF3E5] text-[#176B45] border-[#176B45]/20'
                          : 'bg-[#F7F9F7] text-[#68736C] border-[#DCE4DE]'
                      }`}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Bajarildi</span>
                        </>
                      ) : (
                        <span>Jarayonda</span>
                      )}
                    </span>
                  </div>

                  {/* Progress info */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[#68736C]">
                        To‘plandi:{' '}
                        <strong className="text-[#176B45] font-mono font-semibold">
                          {formatCurrency(g.current_amount, g.currency)}
                        </strong>
                      </span>
                      <span className="text-[#68736C]">
                        Maqsad:{' '}
                        <strong className="text-[#17211B] font-mono font-semibold">
                          {formatCurrency(g.target_amount, g.currency)}
                        </strong>
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-[#F7F9F7] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#176B45] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, g.percentage_completed)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#68736C] font-mono">
                        {g.percentage_completed.toFixed(1)}% bajarildi
                      </span>
                      <span className="text-[#68736C] font-mono">
                        {isDone
                          ? 'Maqsadga erishildi!'
                          : `${formatCurrency(g.remaining_amount, g.currency)} qoldi`}
                      </span>
                    </div>
                  </div>

                  {/* Feasibility Insight Card */}
                  <div
                    className={`p-2.5 rounded-xl border text-xs space-y-0.5 ${
                      feasStatus === 'feasible'
                        ? 'bg-[#DDF3E5] border-[#176B45]/20 text-[#176B45]'
                        : feasStatus === 'challenging'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : feasStatus === 'unlikely'
                        ? 'bg-rose-50 border-rose-200 text-[#C74747]'
                        : 'bg-[#F7F9F7] border-[#DCE4DE] text-[#68736C]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-[11px]">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span>
                        {isDone
                          ? 'Maqsad to‘liq bajarildi'
                          : feasStatus === 'feasible'
                          ? 'Amalga oshirish mumkin'
                          : feasStatus === 'challenging'
                          ? 'Qiyinroq (chegarada)'
                          : feasStatus === 'unlikely'
                          ? 'Imkoniyat yetarli emas'
                          : 'Baholash natijasi'}
                      </span>
                      {g.feasibility.monthly_needed !== null && !isDone && (
                        <span className="ml-auto font-mono text-[10px] font-semibold">
                          Kerak: {formatCurrency(g.feasibility.monthly_needed, g.currency)}/oy
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-90 mt-1">
                      {g.feasibility.explanation}
                    </p>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-[#DCE4DE] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContributeGoal(g);
                      setIsContributeModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F7F9F7] hover:bg-[#DDF3E5] border border-[#DCE4DE] text-xs font-semibold text-[#176B45] transition-colors"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span>Mablag‘ qo‘shish / yechish</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGoalToEdit(g);
                        setIsModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
                      title="Tahrirlash"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalToDelete(g);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-[#68736C] hover:text-[#C74747] hover:bg-rose-50 transition-colors"
                      title="O‘chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </BentoCard>
            );
          })}
        </BentoGrid>
      )}

      {/* Goal Create/Edit Modal */}
      <GoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshGoals}
        goalToEdit={goalToEdit}
      />

      {/* Contribute Modal */}
      {contributeGoal && (
        <ContributeModal
          isOpen={isContributeModalOpen}
          goal={contributeGoal}
          onClose={() => {
            setIsContributeModalOpen(false);
            setContributeGoal(null);
          }}
          onSuccess={refreshGoals}
        />
      )}

      {/* Delete Confirmation Modal */}
      {goalToDelete && (
        <DeleteGoalModal
          isOpen={isDeleteModalOpen}
          goalId={goalToDelete.id}
          goalName={goalToDelete.name}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setGoalToDelete(null);
          }}
          onSuccess={refreshGoals}
        />
      )}
    </div>
  );
}
