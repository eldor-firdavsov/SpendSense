'use client';

import { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import GoalModal from './GoalModal';
import ContributeModal from './ContributeModal';
import DeleteGoalModal from './DeleteGoalModal';
import GoalAIFeedbackModal from './GoalAIFeedbackModal';
import type { GoalWithProgress } from '@/lib/goals/schemas';
import { PageHeader, BentoGrid, BentoCard, BentoMetricCard, BentoEmptyState } from '@/components/bento';
import { cachedFetch, peekCache, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';
import { MetricCardSkeleton, GoalCardSkeleton } from '@/components/ui/Skeleton';

export default function GoalsManager() {
  const currency = 'UZS';
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  const defaultGoalsUrl = `/api/goals?currency=UZS`;
  const initialCached = peekCache<{ goals: GoalWithProgress[] }>(defaultGoalsUrl);

  const [goals, setGoals] = useState<GoalWithProgress[]>(() => initialCached?.goals || []);
  const [loading, setLoading] = useState(() => !initialCached);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<GoalWithProgress | null>(null);

  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<GoalWithProgress | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<GoalWithProgress | null>(null);

  const [aiFeedbackGoal, setAiFeedbackGoal] = useState<GoalWithProgress | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadGoals() {
      try {
        const params = new URLSearchParams({ currency });
        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }
        const targetUrl = `/api/goals?${params.toString()}`;
        const cached = peekCache<{ goals: GoalWithProgress[] }>(targetUrl);

        if (reloadTrigger > 0) {
          invalidateCache('/api/goals');
        } else if (cached?.goals) {
          setGoals(cached.goals);
          setError(null);
          setLoading(false);
          setIsRevalidating(true);
        } else if (goals.length === 0) {
          setLoading(true);
        }

        const data = await cachedFetch<{ goals: GoalWithProgress[] }>(
          targetUrl,
          undefined,
          CACHE_TTL.GOALS
        );
        if (!isCancelled) {
          setGoals(data.goals || []);
          setError(null);
          setLoading(false);
          setIsRevalidating(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Maqsadlarni yuklashda xatolik');
          setLoading(false);
          setIsRevalidating(false);
        }
      }
    }

    loadGoals();

    return () => {
      isCancelled = true;
    };
  }, [statusFilter, reloadTrigger]);

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
        onRefresh={refreshGoals}
        isRefreshing={loading || isRevalidating}
        refreshId="refresh-goals-btn"
        actions={
          <>
            {/* Status Filter */}
            <div className="inline-flex rounded-xl bg-[#F7F9F7] p-1 border border-[#D5DED7] text-sm">
              {(['all', 'in_progress', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg transition-all text-sm ${
                    statusFilter === s
                      ? 'bg-[#176B45] text-white font-semibold shadow-xs'
                      : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                  }`}
                >
                  {s === 'all' ? 'Barchasi' : s === 'in_progress' ? 'Faol' : 'Yakunlangan'}
                </button>
              ))}
            </div>

            <button
              id="create-goal-btn"
              type="button"
              onClick={() => {
                setGoalToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-fintech-card"
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

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[#C74747] text-sm flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Maqsadlarni yuklab bo‘lmadi</p>
              <p className="text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshGoals}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Loading state matching UI */}
      {loading && goals.length === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <GoalCardSkeleton key={i} />
            ))}
          </div>
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
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-fintech-card"
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

            return (
              <BentoCard
                key={g.id}
                isInteractive
                className="p-5 sm:p-6 space-y-5 flex flex-col justify-between"
              >
                {/* Header & Progress Info */}
                <div className="space-y-4">
                  {/* Goal Name, Deadline & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg sm:text-xl text-[#17211B] tracking-tight leading-snug line-clamp-2">
                        {g.name}
                      </h3>
                      {g.target_date && (
                        <p className="text-xs sm:text-sm text-[#5A675F] mt-1.5 flex items-center gap-1.5 font-mono">
                          <Calendar className="h-4 w-4 text-[#176B45]" />
                          <span>Muddat: {g.target_date}</span>
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 border ${
                        isDone
                          ? 'bg-[#DDF3E5] text-[#176B45] border-[#176B45]/20'
                          : 'bg-[#F0F5F2] text-[#47544C] border-[#D5DED7]'
                      }`}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Bajarildi</span>
                        </>
                      ) : (
                        <span>Jarayonda</span>
                      )}
                    </span>
                  </div>

                  {/* Progress info: Maqsad va hozirgi pul progressi */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <span className="block text-xs font-semibold text-[#5A675F] uppercase tracking-wider mb-1">
                          To‘plandi
                        </span>
                        <div className="text-2xl sm:text-3xl font-bold font-mono text-[#176B45] tabular-nums leading-none">
                          {formatCurrency(g.current_amount, g.currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-[#5A675F] uppercase tracking-wider mb-1">
                          Maqsad
                        </span>
                        <div className="text-base sm:text-lg font-bold font-mono text-[#17211B] tabular-nums leading-none">
                          {formatCurrency(g.target_amount, g.currency)}
                        </div>
                      </div>
                    </div>

                    {/* Thicker, modern progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-[#E8EFEA] rounded-full overflow-hidden p-0.5 border border-[#D5DED7]/60">
                        <div
                          className="h-full bg-gradient-to-r from-[#176B45] to-[#1F8A5B] rounded-full transition-all duration-500 shadow-xs"
                          style={{ width: `${Math.min(100, Math.max(0, g.percentage_completed))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm font-mono pt-0.5">
                        <span className="font-bold text-[#176B45] tabular-nums">
                          {g.percentage_completed.toFixed(1)}% bajarildi
                        </span>
                        <span className="text-[#5A675F] font-medium tabular-nums">
                          {isDone
                            ? 'Maqsadga erishildi! 🎉'
                            : `${formatCurrency(g.remaining_amount, g.currency)} qoldi`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 border-t border-[#D5DED7] flex items-center justify-between gap-2.5">
                  {/* Primary CTA: Mablag‘ qo‘shish / yechish */}
                  <button
                    type="button"
                    onClick={() => {
                      setContributeGoal(g);
                      setIsContributeModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#176B45] hover:bg-[#125536] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98] group flex-1 sm:flex-initial"
                  >
                    <ArrowUpRight className="h-4 w-4 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                    <span className="truncate">Mablag‘ qo‘shish / yechish</span>
                  </button>

                  {/* Secondary Actions: AI Feedback + Edit + Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* AI Feedback Button next to Edit */}
                    <button
                      type="button"
                      onClick={() => setAiFeedbackGoal(g)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl bg-[#DDF3E5] hover:bg-[#C7ECD3] text-[#176B45] border border-[#176B45]/20 hover:border-[#176B45]/40 transition-all shadow-xs active:scale-95"
                      title="AI tahlili va tavsiya olish"
                      aria-label="AI tavsiya olish"
                    >
                      <Sparkles className="h-4 w-4 text-[#176B45]" />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setGoalToEdit(g);
                        setIsModalOpen(true);
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl text-[#47544C] hover:text-[#17211B] hover:bg-[#F0F5F2] border border-transparent hover:border-[#D5DED7] transition-all active:scale-95"
                      title="Tahrirlash"
                      aria-label="Tahrirlash"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setGoalToDelete(g);
                        setIsDeleteModalOpen(true);
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl text-[#47544C] hover:text-[#C74747] hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all active:scale-95"
                      title="O‘chirish"
                      aria-label="O‘chirish"
                    >
                      <Trash2 className="h-4 w-4" />
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

      {/* Goal AI Feasibility Feedback Modal */}
      <GoalAIFeedbackModal
        isOpen={!!aiFeedbackGoal}
        goal={aiFeedbackGoal}
        onClose={() => setAiFeedbackGoal(null)}
      />
    </div>
  );
}
