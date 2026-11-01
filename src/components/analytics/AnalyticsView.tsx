'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  AlertCircle,
  RefreshCw,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/analytics/schemas';
import {
  PageHeader,
  BentoGrid,
  BentoCard,
  BentoMetricCard,
  BentoInsightCard,
} from '@/components/bento';
import { cachedFetch, peekCache, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { MetricCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/Skeleton';

interface AvailableMonth {
  key: string;
  year: number;
  month: number;
  label: string;
  startDate: string;
  endDate: string;
}

interface TimelineData {
  financialStartDate: string | null;
  hasData: boolean;
  totalTransactions: number;
  availableMonths: AvailableMonth[];
  availableMonthKeys: string[];
  currentMonthKey: string;
}

export default function AnalyticsView() {
  const currency = 'UZS';
  const initialTimeline = peekCache<TimelineData>('/api/timeline/available-months');
  const [timeline, setTimeline] = useState<TimelineData | null>(() => initialTimeline || null);
  const [timelineLoading, setTimelineLoading] = useState(() => !initialTimeline);

  const initialLatestMonth = initialTimeline?.availableMonths?.[0];
  const [preset, setPreset] = useState<string>(() => (initialLatestMonth ? initialLatestMonth.key : 'all'));
  const [startDate, setStartDate] = useState<string>(() => (initialLatestMonth ? initialLatestMonth.startDate : ''));
  const [endDate, setEndDate] = useState<string>(() => (initialLatestMonth ? initialLatestMonth.endDate : ''));
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [loading, setLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  // 1. Fetch user timeline: only eligible months with real records
  useEffect(() => {
    let isCancelled = false;

    async function loadTimeline() {
      try {
        if (refreshTrigger > 0) {
          invalidateCache('/api/timeline/available-months');
        }
        const tl = await cachedFetch<TimelineData>(
          '/api/timeline/available-months',
          undefined,
          CACHE_TTL.TRANSACTIONS
        );
        if (!isCancelled) {
          setTimeline(tl);
          setTimelineLoading(false);

          if (tl.hasData && tl.availableMonths.length > 0) {
            setStartDate((prev) => {
              if (prev && tl.availableMonths.some((m) => m.startDate <= prev && prev <= m.endDate)) {
                return prev;
              }
              return tl.availableMonths[0].startDate;
            });
            setEndDate((prev) => {
              if (prev && tl.availableMonths.some((m) => m.startDate <= prev && prev <= m.endDate)) {
                return prev;
              }
              return tl.availableMonths[0].endDate;
            });
            setPreset((prev) => {
              if (prev && (prev === 'all' || prev === '30d' || tl.availableMonths.some((m) => m.key === prev))) {
                return prev;
              }
              return tl.availableMonths[0].key;
            });
          }
        }
      } catch {
        if (!isCancelled) {
          setTimelineLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      isCancelled = true;
    };
  }, [refreshTrigger]);

  // 2. Fetch analytics for the selected eligible date range
  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      if (timeline && !timeline.hasData) {
        setData({
          currency,
          startDate: '',
          endDate: '',
          totalIncome: 0,
          totalExpenses: 0,
          netCashFlow: 0,
          savingsRate: 0,
          transactionCount: 0,
          averageTransactionAmount: 0,
          expenseBreakdown: [],
          incomeBreakdown: [],
          trends: [],
          comparison: {
            income: { currentTotal: 0, previousTotal: 0, absoluteChange: 0, percentageChange: null },
            expense: { currentTotal: 0, previousTotal: 0, absoluteChange: 0, percentageChange: null },
            net: { currentTotal: 0, previousTotal: 0, absoluteChange: 0, percentageChange: null },
          },
          largestExpenses: [],
          largestIncome: [],
        });
        setLoading(false);
        setIsRevalidating(false);
        return;
      }

      if (!startDate || !endDate) {
        return;
      }

      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          currency,
          interval: 'month',
        });
        const targetUrl = `/api/analytics?${params.toString()}`;
        const cached = peekCache<{ analytics: AnalyticsSummary }>(targetUrl);

        if (refreshTrigger > 0) {
          invalidateCache('/api/analytics');
        } else if (cached?.analytics) {
          setData(cached.analytics);
          setError(null);
          setLoading(false);
          setIsRevalidating(true);
        } else {
          setLoading(true);
        }

        const json = await cachedFetch<{ analytics: AnalyticsSummary }>(
          targetUrl,
          undefined,
          CACHE_TTL.ANALYTICS
        );
        if (!isCancelled) {
          setData(json.analytics);
          setError(null);
          setLoading(false);
          setIsRevalidating(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Tahlilni yuklashda xatolik');
          setLoading(false);
          setIsRevalidating(false);
        }
      }
    }

    if (!timelineLoading) {
      loadAnalytics();
    }

    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate, refreshTrigger, timeline, timelineLoading]);

  const handleRefresh = () => {
    invalidateCache('/api/timeline/available-months');
    invalidateCache('/api/analytics');
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  };

  const isZeroState = !timelineLoading && timeline && !timeline.hasData;

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Refresh */}
      <PageHeader
        title="Tahlil"
        onRefresh={handleRefresh}
        isRefreshing={loading || isRevalidating}
        refreshId="analytics-page-header-refresh-btn"
      />

      {/* Filter and Period Selector Controls: Displayed only if real data exists */}
      {!isZeroState && (
        <div className="rounded-2xl border border-[#D5DED7] bg-white p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 shadow-fintech-card">
          <div className="flex items-center justify-between gap-2.5">
            {/* Dynamic Preset Buttons based on actual recorded timeline */}
            <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
              <div className="inline-flex items-center gap-1 rounded-xl border border-[#D5DED7] p-1 bg-[#F7F9F7] text-xs sm:text-sm">
                {timeline?.availableMonths && timeline.availableMonths.length > 1 && (
                  <button
                    id="preset-all-btn"
                    type="button"
                    onClick={() => {
                      const earliest = timeline.availableMonths[timeline.availableMonths.length - 1];
                      const latest = timeline.availableMonths[0];
                      setPreset('all');
                      setLoading(true);
                      setStartDate(earliest.startDate);
                      setEndDate(latest.endDate);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all whitespace-nowrap text-xs sm:text-sm ${
                      preset === 'all'
                        ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                        : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                    }`}
                  >
                    Barcha davr
                  </button>
                )}

                {timeline?.availableMonths.map((m) => (
                  <button
                    key={m.key}
                    id={`preset-month-${m.key}-btn`}
                    type="button"
                    onClick={() => {
                      setPreset(m.key);
                      setLoading(true);
                      setStartDate(m.startDate);
                      setEndDate(m.endDate);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all whitespace-nowrap text-xs sm:text-sm ${
                      preset === m.key
                        ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                        : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}

                <button
                  id="preset-30d-btn"
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date();
                    start.setDate(now.getDate() - 30);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setPreset('30d');
                    setLoading(true);
                    setStartDate(toYMD(start));
                    setEndDate(toYMD(now));
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all whitespace-nowrap text-xs sm:text-sm ${
                    preset === '30d'
                      ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                      : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                  }`}
                >
                  30 kun
                </button>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              id="analytics-refresh-btn"
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center p-2 rounded-xl bg-white text-[#47544C] hover:text-[#17211B] border border-[#D5DED7] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50 shrink-0 shadow-2xs"
              title="Tahlilni yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
          </div>

          {/* Custom Date Range Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pt-3 border-t border-[#D5DED7] text-xs sm:text-sm text-[#47544C]">
            <span className="flex items-center gap-1.5 font-medium text-[#17211B] shrink-0">
              <Calendar className="h-4 w-4 text-[#176B45]" /> Davr:
            </span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full sm:w-auto">
              <input
                id="analytics-start-date"
                aria-label="Boshlanish sanasi"
                type="date"
                min={timeline?.financialStartDate || undefined}
                value={startDate}
                onChange={(e) => {
                  setPreset('custom');
                  setLoading(true);
                  setStartDate(e.target.value);
                }}
                className="w-full min-w-0 border border-[#D5DED7] rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] text-[#17211B] text-xs sm:text-sm text-center sm:text-left focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all bg-white"
              />
              <span className="text-[#5A675F] font-medium text-center px-0.5">—</span>
              <input
                id="analytics-end-date"
                aria-label="Tugash sanasi"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setPreset('custom');
                  setLoading(true);
                  setEndDate(e.target.value);
                }}
                className="w-full min-w-0 border border-[#D5DED7] rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] text-[#17211B] text-xs sm:text-sm text-center sm:text-left focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-sm flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-base">Tahlilni yuklab bo‘lmadi</p>
              <p className="text-sm mt-0.5 text-rose-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Loading Skeleton matching real UI dimensions */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8">
              <ChartSkeleton height="h-60" />
            </div>

            <div className="lg:col-span-4 skeleton-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5DED7]">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="space-y-3.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Analytics Content */}
      {data && (
        <>
          {/* 3 Primary Financial Totals via BentoMetricCard */}
          <BentoGrid cols={3}>
            {/* Total Income */}
            <BentoMetricCard
              title="Jami kirim"
              value={<span id="stat-total-income">{formatCurrency(data.totalIncome)}</span>}
              accent="green"
              icon={<TrendingUp className="h-4 w-4" />}
              subtext={
                isZeroState
                  ? 'Hozircha yozuvlar yo‘q'
                  : data.comparison.income.percentageChange !== null
                  ? `${data.comparison.income.percentageChange >= 0 ? '+' : ''}${data.comparison.income.percentageChange}% o‘tgan davrga nisbatan`
                  : 'Tanlangan oraliq bo‘yicha'
              }
              delta={
                !isZeroState && data.comparison.income.percentageChange !== null
                  ? {
                      value: `${Math.abs(data.comparison.income.percentageChange)}%`,
                      trend: data.comparison.income.percentageChange >= 0 ? 'up' : 'down',
                    }
                  : undefined
              }
            />

            {/* Total Expenses */}
            <BentoMetricCard
              title="Jami chiqim"
              value={<span id="stat-total-expenses">{formatCurrency(data.totalExpenses)}</span>}
              accent="red"
              icon={<TrendingDown className="h-4 w-4" />}
              subtext={
                isZeroState
                  ? 'Hozircha yozuvlar yo‘q'
                  : data.comparison.expense.percentageChange !== null
                  ? `${data.comparison.expense.percentageChange >= 0 ? '+' : ''}${data.comparison.expense.percentageChange}% o‘tgan davrga nisbatan`
                  : 'Tanlangan oraliq bo‘yicha'
              }
              delta={
                !isZeroState && data.comparison.expense.percentageChange !== null
                  ? {
                      value: `${Math.abs(data.comparison.expense.percentageChange)}%`,
                      trend: data.comparison.expense.percentageChange <= 0 ? 'up' : 'down',
                    }
                  : undefined
              }
            />

            {/* Net Cash Flow */}
            <BentoMetricCard
              title="Sof oqim"
              value={
                <span id="stat-net-cash-flow">
                  {data.netCashFlow >= 0 ? '+' : ''}
                  {formatCurrency(data.netCashFlow)}
                </span>
              }
              accent={data.netCashFlow >= 0 ? 'green' : 'red'}
              icon={<Wallet className="h-4 w-4" />}
              subtext={
                isZeroState
                  ? 'Boshlang‘ich holat'
                  : data.netCashFlow >= 0
                  ? 'Ijobiy moliyaviy saldo'
                  : 'Xarajat daromaddan oshdi'
              }
            />
          </BentoGrid>

          {/* Hidden / secondary stats for compatibility */}
          <div className="hidden">
            <span id="stat-savings-rate">{data.savingsRate.toFixed(1)}%</span>
            <span id="stat-tx-count">{data.transactionCount}</span>
            <span id="stat-avg-amount">{formatCurrency(data.averageTransactionAmount)}</span>
          </div>

          {/* If Zero State, show clean Empty State Container */}
          {isZeroState ? (
            <div className="rounded-2xl border border-[#D5DED7] bg-white p-8 sm:p-12 text-center space-y-4 shadow-fintech-card">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#EAF5EF] text-[#176B45] flex items-center justify-center border border-[#176B45]/20 shadow-xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg sm:text-xl font-bold text-[#17211B]">
                  Moliyaviy ma’lumotlar mavjud emas
                </h3>
                <p className="text-sm text-[#5A675F] leading-relaxed">
                  Sizda hozircha birorta ham daromad yoki xarajat yozuvlari mavjud emas. Birinchi tranzaksiyangiz qo‘shilgandan so‘ng tahlil, xarajatlar taqsimoti va dinamika grafiklari bu yerda ko‘rsatiladi.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/transactions"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125335] text-white font-semibold text-sm transition-colors shadow-xs"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Tranzaksiya qo‘shish</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Concise Summary Based on Actual Records via BentoInsightCard */}
          <BentoInsightCard
            title="Davr bo‘yicha tahliliy xulosa"
            eyebrow="Moliyaviy xulosa"
            accent="purple"
            icon={<Sparkles className="h-4 w-4" />}
            message={
              <p className="text-base sm:text-lg leading-relaxed text-[#17211B]">
                Ushbu davrda jami <strong className="text-[#17211B] font-semibold">{data.transactionCount} ta</strong> tranzaksiya amalga oshirildi.
                Kirim <strong className="text-[#17211B] font-semibold font-mono tabular-nums">{formatCurrency(data.totalIncome)}</strong>,
                chiqim esa <strong className="text-[#17211B] font-semibold font-mono tabular-nums">{formatCurrency(data.totalExpenses)}</strong> ni tashkil qildi.
                Sof pul oqimi: <strong className="text-[#17211B] font-semibold font-mono tabular-nums">{formatCurrency(data.netCashFlow)}</strong>.
                Jamg‘arma darajasi: <strong className="text-[#176B45] font-semibold font-mono tabular-nums">{data.savingsRate.toFixed(1)}%</strong>.
              </p>
            }
          />

          {/* 12-Column Bento Grid: Cash Flow Trend Chart + Category Distribution */}
          <BentoGrid cols={12}>
            {/* Simple Category Breakdown */}
            <BentoCard span={{ default: 12, lg: 5 }} className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-[#D5DED7]">
                <h2 className="text-base sm:text-lg font-bold text-[#17211B] tracking-tight">
                  Kategoriya taqsimoti
                </h2>
                <div className="inline-flex rounded-xl border border-[#D5DED7] p-1 bg-[#F7F9F7] text-xs sm:text-sm self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBreakdownType('expense')}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-lg transition-all font-semibold ${
                      breakdownType === 'expense'
                        ? 'bg-[#C74747] text-white shadow-xs'
                        : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
                    }`}
                  >
                    Chiqimlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownType('income')}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-lg transition-all font-semibold ${
                      breakdownType === 'income'
                        ? 'bg-[#176B45] text-white shadow-xs'
                        : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
                    }`}
                  >
                    Kirimlar
                  </button>
                </div>
              </div>

              {(() => {
                const list = breakdownType === 'expense' ? data.expenseBreakdown : data.incomeBreakdown;
                if (!list || list.length === 0) {
                  return (
                    <div className="py-12 text-center text-[#5A675F] text-base">
                      Ushbu davrda {breakdownType === 'expense' ? 'xarajatlar' : 'daromadlar'} qayd etilmagan.
                    </div>
                  );
                }
                return (
                  <div className="space-y-4 sm:space-y-4.5">
                    {list.map((item, idx) => (
                      <div key={item.categoryId || `item-${idx}`} className="space-y-2">
                        <div className="flex items-center justify-between text-xs sm:text-sm md:text-base gap-2">
                          <span className="font-semibold text-[#17211B] truncate">
                            {getCategoryDisplayName(item.categoryName)}
                          </span>
                          <span className="font-mono font-bold tabular-nums text-[#17211B] shrink-0 text-xs sm:text-sm md:text-base">
                            {formatCurrency(item.totalAmount)}
                            <span className="text-[#5A675F] font-semibold text-[11px] sm:text-xs ml-1.5">
                              ({item.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2.5 sm:h-3 w-full bg-[#EAEFEA] rounded-full overflow-hidden border border-[#D5DED7]/40">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              breakdownType === 'expense' ? 'bg-[#17211B]' : 'bg-[#176B45]'
                            }`}
                            style={{
                              width: `${Math.min(100, item.percentage)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </BentoCard>

            {/* Useful Trend Chart: Cash Flow by Period */}
            <BentoCard span={{ default: 12, lg: 7 }} className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col xs:flex-row sm:flex-row sm:items-center justify-between gap-1 pb-3.5 border-b border-[#D5DED7]">
                <h2 className="text-base sm:text-lg font-bold text-[#17211B] tracking-tight">
                  Davriy dinamika
                </h2>
                <span className="text-xs sm:text-sm font-medium text-[#5A675F]">Kirim va chiqim taqqosi</span>
              </div>

              {data.trends.length === 0 ? (
                <div className="py-12 text-center text-[#5A675F] text-base">
                  Tarixiy dinamika ma’lumotlari topilmadi.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.trends.map((t) => {
                    const maxVal = Math.max(1, t.income, t.expense);
                    const incWidth = (t.income / maxVal) * 100;
                    const expWidth = (t.expense / maxVal) * 100;
                    return (
                      <div key={t.periodKey} className="p-3.5 sm:p-5 rounded-2xl border border-[#D5DED7] bg-[#F7F9F7] space-y-2.5 sm:space-y-3 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm sm:text-base md:text-lg font-bold text-[#17211B]">{t.periodKey}</span>
                          <span className={`font-mono text-xs sm:text-sm md:text-base font-bold tabular-nums ${t.net >= 0 ? 'text-[#176B45]' : 'text-[#C74747]'}`}>
                            Sof: {t.net >= 0 ? '+' : ''}{formatCurrency(t.net)}
                          </span>
                        </div>

                        {/* Income Bar */}
                        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base">
                          <span className="w-12 sm:w-16 text-[#47544C] font-semibold text-xs sm:text-sm shrink-0">Kirim</span>
                          <div className="flex-1 h-2 sm:h-3 bg-[#E2E8E4] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#176B45] rounded-full transition-all"
                              style={{ width: `${incWidth}%` }}
                            />
                          </div>
                          <span className="text-right font-mono font-bold tabular-nums text-[#176B45] text-xs sm:text-sm md:text-base shrink-0">
                            {formatCurrency(t.income)}
                          </span>
                        </div>

                        {/* Expense Bar */}
                        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base">
                          <span className="w-12 sm:w-16 text-[#47544C] font-semibold text-xs sm:text-sm shrink-0">Chiqim</span>
                          <div className="flex-1 h-2 sm:h-3 bg-[#E2E8E4] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C74747] rounded-full transition-all"
                              style={{ width: `${expWidth}%` }}
                            />
                          </div>
                          <span className="text-right font-mono font-bold tabular-nums text-[#C74747] text-xs sm:text-sm md:text-base shrink-0">
                            {formatCurrency(t.expense)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </BentoCard>
          </BentoGrid>
        </>
      )}
    </>
  )}
</div>
  );
}
