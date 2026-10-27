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
  RefreshCw,
  Calendar,
} from 'lucide-react';
import BudgetModal from './BudgetModal';
import DeleteBudgetModal from './DeleteBudgetModal';
import type { BudgetWithProgress } from '@/lib/budgets/schemas';
import { PageHeader, BentoGrid, BentoCard, BentoMetricCard, BentoEmptyState } from '@/components/bento';
import { cachedFetch, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  color?: string | null;
}

export default function BudgetsManager() {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [currency, setCurrency] = useState('UZS');
  const [loading, setLoading] = useState(true);
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
        if (reloadTrigger > 0) {
          invalidateCache('/api/budgets');
        }
        const [catData, budgetData] = await Promise.all([
          cachedFetch<{ categories: CategoryOption[] }>(
            '/api/categories?type=expense',
            undefined,
            CACHE_TTL.CATEGORIES
          ),
          cachedFetch<{ budgets: BudgetWithProgress[] }>(
            `/api/budgets?currency=${currency}`,
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
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Budjetlarni yuklashda xatolik');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [currency, reloadTrigger]);

  const refreshBudgets = () => {
    invalidateCache('/api/budgets');
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount: number, _curr?: string) => {
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
        subtitle="Har bir kategoriya uchun xarajat limitlarini belgilang va real vaqtda sarf-xarajatlarni kuzatib boring."
        srOnlyFallback="Budget Management"
        actions={
          <>
            <select
              id="budget-currency-filter"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-white border border-[#DCE4DE] text-[#17211B] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#176B45] transition-all shadow-fintech-card"
            >
              <option value="UZS">UZS (soʻm)</option>
            </select>

            <button
              id="create-budget-btn"
              type="button"
              onClick={() => {
                setBudgetToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Byudjet yaratish</span>
            </button>
          </>
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

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Budjetlarni yuklab bo‘lmadi</p>
            <p className="text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center text-[#68736C] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-[#176B45]" />
          <p className="text-xs">Xarajatlar holati hisoblanmoqda...</p>
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card"
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

            let statusColor = 'bg-[#176B45]/10 text-[#176B45] border-[#176B45]/20';
            let barColor = 'bg-[#176B45]';

            if (isOver) {
              statusColor = 'bg-[#C74747]/10 text-[#C74747] border-[#C74747]/20';
              barColor = 'bg-[#C74747]';
            } else if (isNear) {
              statusColor = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
              barColor = 'bg-amber-500';
            }

            return (
              <BentoCard key={b.id} className="p-4 sm:p-5 flex flex-col justify-between space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm text-[#17211B]">{b.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {b.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium"
                          style={{
                            backgroundColor: `${b.category.color || '#176B45'}15`,
                            color: b.category.color || '#176B45',
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: b.category.color || '#176B45' }}
                          />
                          {b.category.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F7F9F7] border border-[#DCE4DE] text-[#68736C]">
                          Umumiy budjet
                        </span>
                      )}
                      <span className="text-[10px] text-[#68736C] uppercase">
                        {b.period_type === 'monthly' ? 'Oylik' : b.period_type === 'weekly' ? 'Haftalik' : 'Maxsus davr'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}
                  >
                    {isOver ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        <span>Limit oshdi</span>
                      </>
                    ) : isNear ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        <span>Yaqin</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Reja bo‘yicha</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Progress Bar & Amounts */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[#68736C]">
                      Sarflandi:{' '}
                      <strong className="text-[#17211B] font-mono font-semibold">
                        {formatCurrency(b.spent, b.currency)}
                      </strong>
                    </span>
                    <span className="text-[#68736C]">
                      Limit:{' '}
                      <strong className="text-[#17211B] font-mono font-semibold">
                        {formatCurrency(b.amount, b.currency)}
                      </strong>
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-[#F7F9F7] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(100, b.percentageUsed)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#68736C] font-mono">
                      {b.percentageUsed.toFixed(1)}% ishlatildi
                    </span>
                    <span className={isOver ? 'text-[#C74747] font-mono font-medium' : 'text-[#68736C] font-mono'}>
                      {isOver
                        ? `${formatCurrency(Math.abs(b.remaining), b.currency)} ga oshib ketdi`
                        : `${formatCurrency(b.remaining, b.currency)} qoldi`}
                    </span>
                  </div>
                </div>

                {/* Dates & Actions */}
                <div className="pt-3 border-t border-[#DCE4DE] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#68736C] flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-[#68736C]" />
                    <span>
                      {b.start_date} dan {b.end_date} gacha
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetToEdit(b);
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
                        setBudgetToDelete(b);
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
