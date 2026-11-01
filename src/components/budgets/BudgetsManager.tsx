'use client';

import { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import BudgetModal from './BudgetModal';
import DeleteBudgetModal from './DeleteBudgetModal';
import type { BudgetWithProgress } from '@/lib/budgets/schemas';
import { PageHeader, BentoGrid, BentoCard, BentoMetricCard, BentoEmptyState } from '@/components/bento';
import { cachedFetch, peekCache, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { MetricCardSkeleton, BudgetCardSkeleton } from '@/components/ui/Skeleton';

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  color?: string | null;
}

export default function BudgetsManager() {
  const currency = 'UZS';

  // Peek cache for 0ms instant load
  const cachedBudgets = peekCache<{ budgets: BudgetWithProgress[] }>(`/api/budgets?currency=UZS`);
  const cachedCats = peekCache<{ categories: CategoryOption[] }>('/api/categories?type=expense');

  const [budgets, setBudgets] = useState<BudgetWithProgress[]>(() => cachedBudgets?.budgets || []);
  const [categories, setCategories] = useState<CategoryOption[]>(() => cachedCats?.categories || []);
  const [loading, setLoading] = useState(() => !cachedBudgets);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState<BudgetWithProgress | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetWithProgress | null>(null);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const targetUrl = `/api/budgets?currency=${currency}`;
        const cached = peekCache<{ budgets: BudgetWithProgress[] }>(targetUrl);

        if (reloadTrigger > 0) {
          invalidateCache('/api/budgets');
        } else if (cached?.budgets) {
          setBudgets(cached.budgets);
          setError(null);
          setLoading(false);
          setIsRevalidating(true);
        } else if (budgets.length === 0) {
          setLoading(true);
        }

        const [catData, budgetData] = await Promise.all([
          cachedFetch<{ categories: CategoryOption[] }>(
            '/api/categories?type=expense',
            undefined,
            CACHE_TTL.CATEGORIES
          ),
          cachedFetch<{ budgets: BudgetWithProgress[] }>(
            targetUrl,
            undefined,
            CACHE_TTL.BUDGETS
          ),
        ]);

        if (!isCancelled) {
          if (catData.categories) {
            setCategories(catData.categories);
          }
          if (budgetData.budgets) {
            setBudgets(budgetData.budgets);
            setError(null);
          }
          setLoading(false);
          setIsRevalidating(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Budjetlarni yuklashda xatolik');
          setLoading(false);
          setIsRevalidating(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [reloadTrigger]);

  const refreshBudgets = () => {
    invalidateCache('/api/budgets');
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount: number, currency = 'UZS') => {
    if (currency === 'USD') {
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  };

  // Aggregated totals
  const totalBudgeted = budgets.reduce((acc, b) => acc + Number(b.amount), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + Number(b.spent), 0);
  const totalRemaining = Math.max(0, totalBudgeted - totalSpent);
  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Wallet className="h-5 w-5 text-[#176B45]" />
            <span>Budjetlar</span>
          </div>
        }
        onRefresh={refreshBudgets}
        isRefreshing={loading || isRevalidating}
        refreshId="refresh-budgets-btn"
        actions={
          <button
            id="create-budget-btn"
            type="button"
            onClick={() => {
              setBudgetToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-fintech-card"
          >
            <Plus className="h-4 w-4" />
            <span>Byudjet yaratish</span>
          </button>
        }
      />

      {/* Hero Summary Bento Metric Cards */}
      {budgets.length > 0 && (
        <BentoGrid cols={3}>
          <BentoMetricCard
            title="Jami rejalashtirilgan budjet"
            value={formatCurrency(totalBudgeted)}
            subtext={`${budgets.length} ta faol reja bo‘yicha`}
            accent="neutral"
            icon={<Wallet className="h-4 w-4" />}
          />
          <BentoMetricCard
            title="Jami sarflangan"
            value={formatCurrency(totalSpent)}
            subtext={`Ajratilgan summaning ${overallPercentage.toFixed(1)}% qismi`}
            accent="red"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <BentoMetricCard
            title="Qolgan mablag‘"
            value={formatCurrency(totalRemaining)}
            subtext="Xavfsiz sarflash mumkin bo‘lgan qoldiq"
            accent="green"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </BentoGrid>
      )}

      {/* Error message with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[#C74747] text-sm flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-base">Budjetlarni yuklab bo‘lmadi</p>
              <p className="text-rose-600 text-sm mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshBudgets}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && budgets.length === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <BudgetCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && budgets.length === 0 && (
        <BentoEmptyState
          icon={<Wallet className="h-6 w-6 text-[#176B45]" />}
          title="Hozircha budjetlar mavjud emas"
          description="Xarajatlaringizni nazorat qilish va limitdan oshib ketishning oldini olish uchun birinchi budjetingizni yarating."
          action={
            <button
              id="empty-create-budget-btn"
              type="button"
              onClick={() => {
                setBudgetToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Birinchi budjetingizni yarating</span>
            </button>
          }
        />
      )}

      {/* Budgets Grid */}
      {!loading && budgets.length > 0 && (
        <BentoGrid cols={3}>
          {budgets.map((b) => {
            const isOver = b.spent > b.amount;
            const isNear = !isOver && b.percentageUsed >= 80;

            let barColor = 'bg-[#176B45]';

            if (isOver) {
              barColor = 'bg-[#C74747]';
            } else if (isNear) {
              barColor = 'bg-amber-500';
            }

            return (
              <BentoCard key={b.id} className="p-4 sm:p-5 space-y-3.5">
                {/* Header: Title, Category & Action Buttons */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-[#17211B] truncate">{b.name}</h3>
                      {isOver && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 border border-rose-200 text-[#C74747]">
                          Limit oshdi
                        </span>
                      )}
                    </div>
                    {b.category && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
                          style={{
                            backgroundColor: `${b.category.color || '#176B45'}15`,
                            color: b.category.color || '#176B45',
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: b.category.color || '#176B45' }}
                          />
                          {getCategoryDisplayName(b.category.name)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions (top right) */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetToEdit(b);
                        setIsModalOpen(true);
                      }}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 rounded-lg text-[#5A675F] hover:text-[#176B45] hover:bg-[#F7F9F7] transition-colors"
                      title="Tahrirlash"
                      aria-label="Tahrirlash"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Tahrirlash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetToDelete(b);
                        setIsDeleteModalOpen(true);
                      }}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 rounded-lg text-[#5A675F] hover:text-[#C74747] hover:bg-rose-50 transition-colors"
                      title="O‘chirish"
                      aria-label="O‘chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">O‘chirish</span>
                    </button>
                  </div>
                </div>

                {/* Progress & Clean Spending Display */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-baseline justify-between text-xs sm:text-sm">
                    <div className="font-mono">
                      <span className="font-bold text-base sm:text-lg text-[#17211B] tabular-nums">
                        {formatCurrency(b.spent, b.currency)}
                      </span>
                      <span className="text-[#5A675F] text-xs"> / {formatCurrency(b.amount, b.currency)}</span>
                    </div>
                    <span
                      className={
                        isOver
                          ? 'text-[#C74747] font-semibold text-xs font-mono tabular-nums'
                          : 'text-[#176B45] font-semibold text-xs font-mono tabular-nums'
                      }
                    >
                      {isOver
                        ? `+${formatCurrency(Math.abs(b.remaining), b.currency)} oshdi`
                        : `${formatCurrency(b.remaining, b.currency)} qoldi`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-[#F1F4F2] rounded-full overflow-hidden border border-[#D5DED7]/40">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(100, b.percentageUsed)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#5A675F]">
                    <span className="font-mono tabular-nums">{b.percentageUsed.toFixed(0)}% sarflandi</span>
                    <span>{b.period_type === 'monthly' ? 'Oylik' : b.period_type === 'weekly' ? 'Haftalik' : 'Maxsus'}</span>
                  </div>
                </div>
              </BentoCard>
            );
          })}
        </BentoGrid>
      )}

      {/* Edit/Create Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshBudgets}
        categories={categories}
        budgetToEdit={budgetToEdit}
      />

      {/* Delete Confirmation Modal */}
      {budgetToDelete && (
        <DeleteBudgetModal
          isOpen={isDeleteModalOpen}
          budgetId={budgetToDelete.id}
          budgetName={budgetToDelete.name}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setBudgetToDelete(null);
          }}
          onSuccess={refreshBudgets}
        />
      )}
    </div>
  );
}
