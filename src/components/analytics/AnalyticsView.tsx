'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Coins,
  AlertCircle,
  RefreshCw,
  Target,
  Sparkles,
} from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/analytics/schemas';
import {
  PageHeader,
  BentoGrid,
  BentoCard,
  BentoMetricCard,
  BentoInsightCard,
} from '@/components/bento';
import { cachedFetch, invalidateCache, CACHE_TTL } from '@/lib/cache/clientCache';

const CURRENCIES = ['UZS'];

const getInitialDates = () => {
  return {
    startDate: '2026-09-01',
    endDate: '2026-10-31',
  };
};

export default function AnalyticsView() {
  const [currency, setCurrency] = useState('UZS');
  const [preset, setPreset] = useState<'demo2m' | 'month' | '30d' | '90d' | 'ytd' | 'custom'>('demo2m');
  const [initialDates] = useState(getInitialDates);
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  // Compute preset dates on user button click
  const applyPreset = (p: 'demo2m' | 'month' | '30d' | '90d' | 'ytd' | 'custom') => {
    setPreset(p);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setLoading(true);
    if (p === 'demo2m') {
      setStartDate('2026-09-01');
      setEndDate('2026-10-31');
    } else if (p === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(start));
      setEndDate(toYMD(end));
    } else if (p === '30d') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      setStartDate(toYMD(start));
      setEndDate(toYMD(now));
    } else if (p === '90d') {
      const start = new Date();
      start.setDate(now.getDate() - 90);
      setStartDate(toYMD(start));
      setEndDate(toYMD(now));
    } else if (p === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1);
      setStartDate(toYMD(start));
      setEndDate(toYMD(now));
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          currency,
          interval: 'month',
        });
        if (refreshTrigger > 0) {
          invalidateCache('/api/analytics');
        }
        const json = await cachedFetch<{ analytics: AnalyticsSummary }>(
          `/api/analytics?${params.toString()}`,
          undefined,
          CACHE_TTL.ANALYTICS
        );
        if (!isCancelled) {
          setData(json.analytics);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Tahlilni yuklashda xatolik');
          setLoading(false);
        }
      }
    }

    if (startDate && endDate) {
      loadAnalytics();
    }

    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate, currency, refreshTrigger]);

  const handleRefresh = () => {
    invalidateCache('/api/analytics');
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount: number, _curr?: string) => {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Secondary Routes Links */}
      <PageHeader
        title="Tahlil"
        subtitle="Aniq pul oqimi, xarajatlar taqsimoti va sarf-xarajatlar dinamikasi"
        srOnlyFallback="Financial Analytics"
        actions={
          <>
            <Link
              href="/budgets"
              id="analytics-budgets-link"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F9F7] transition-colors shadow-fintech-card"
            >
              <Wallet className="h-3.5 w-3.5 text-[#68736C]" />
              <span>Budjetlar</span>
            </Link>
            <Link
              href="/goals"
              id="analytics-goals-link"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs font-medium text-[#17211B] hover:bg-[#F7F9F7] transition-colors shadow-fintech-card"
            >
              <Target className="h-3.5 w-3.5 text-[#68736C]" />
              <span>Jamg‘arma maqsadlari</span>
            </Link>
          </>
        }
      />

      {/* Filter and Period Selector Controls */}
      <div className="rounded-2xl border border-[#DCE4DE] bg-white p-4 space-y-3 shadow-fintech-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl border border-[#DCE4DE] p-0.5 bg-[#F7F9F7] text-xs">
            {(['demo2m', 'month', '30d', '90d', 'ytd'] as const).map((p) => {
              const labels = {
                demo2m: 'Sen-Okt (2 oy)',
                month: 'Shu oy',
                '30d': '30 kun',
                '90d': '90 kun',
                ytd: 'Yil boshidan',
              };
              return (
                <button
                  key={p}
                  id={`preset-${p}-btn`}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    preset === p
                      ? 'bg-white text-[#176B45] shadow-fintech-card font-semibold'
                      : 'text-[#68736C] hover:text-[#17211B]'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#DCE4DE] text-xs">
              <Coins className="h-3.5 w-3.5 text-[#68736C]" />
              <select
                id="analytics-currency-select"
                aria-label="Valyuta tanlash"
                value={currency}
                onChange={(e) => {
                  setLoading(true);
                  setCurrency(e.target.value);
                }}
                className="bg-transparent text-[#17211B] font-medium focus:outline-none cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              id="analytics-refresh-btn"
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-white text-[#68736C] hover:text-[#17211B] border border-[#DCE4DE] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50"
              title="Tahlilni yangilash"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-[#DCE4DE] text-xs text-[#68736C]">
          <span className="flex items-center gap-1 font-medium text-[#17211B]">
            <Calendar className="h-3.5 w-3.5 text-[#176B45]" /> Davr:
          </span>
          <div className="flex items-center gap-2">
            <input
              id="analytics-start-date"
              aria-label="Boshlanish sanasi"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset('custom');
                setLoading(true);
                setStartDate(e.target.value);
              }}
              className="border border-[#DCE4DE] rounded-xl px-2.5 py-1 text-[#17211B] text-xs focus:border-[#176B45] focus:outline-none transition-all"
            />
            <span>—</span>
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
              className="border border-[#DCE4DE] rounded-xl px-2.5 py-1 text-[#17211B] text-xs focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>
          <span className="ml-auto text-[11px] text-[#68736C]">
            Valyuta: {currency}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Tahlilni yuklab bo‘lmadi</p>
            <p className="text-[11px] mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-[#F7F9F7] rounded-2xl border border-[#DCE4DE]" />
          ))}
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
                data.comparison.income.percentageChange !== null
                  ? `${data.comparison.income.percentageChange >= 0 ? '+' : ''}${data.comparison.income.percentageChange}% o‘tgan davrga nisbatan`
                  : 'Tanlangan oraliq bo‘yicha'
              }
              delta={
                data.comparison.income.percentageChange !== null
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
                data.comparison.expense.percentageChange !== null
                  ? `${data.comparison.expense.percentageChange >= 0 ? '+' : ''}${data.comparison.expense.percentageChange}% o‘tgan davrga nisbatan`
                  : 'Tanlangan oraliq bo‘yicha'
              }
              delta={
                data.comparison.expense.percentageChange !== null
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
              subtext={data.netCashFlow >= 0 ? 'Ijobiy moliyaviy saldo' : 'Xarajat daromaddan oshdi'}
            />
          </BentoGrid>

          {/* Hidden / secondary stats for compatibility */}
          <div className="hidden">
            <span id="stat-savings-rate">{data.savingsRate.toFixed(1)}%</span>
            <span id="stat-tx-count">{data.transactionCount}</span>
            <span id="stat-avg-amount">{formatCurrency(data.averageTransactionAmount)}</span>
          </div>

          {/* Concise Summary Based on Actual Records via BentoInsightCard */}
          <BentoInsightCard
            title="Davr bo‘yicha tahliliy xulosa"
            eyebrow="Moliyaviy xulosa"
            accent="purple"
            icon={<Sparkles className="h-4 w-4" />}
            message={
              <p className="leading-relaxed">
                Ushbu davrda jami <strong className="text-[#17211B]">{data.transactionCount} ta</strong> tranzaksiya amalga oshirildi.
                Kirim <strong className="text-[#17211B]">{formatCurrency(data.totalIncome)}</strong>,
                chiqim esa <strong className="text-[#17211B]">{formatCurrency(data.totalExpenses)}</strong> ni tashkil qildi.
                Sof pul oqimi: <strong className="text-[#17211B]">{formatCurrency(data.netCashFlow)}</strong>.
                Jamg‘arma darajasi: <strong className="text-[#176B45] font-mono">{data.savingsRate.toFixed(1)}%</strong>.
              </p>
            }
          />

          {/* 12-Column Bento Grid: Cash Flow Trend Chart + Category Distribution */}
          <BentoGrid cols={12}>
            {/* Simple Category Breakdown */}
            <BentoCard span={{ default: 12, lg: 5 }} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#68736C]">
                  Kategoriya taqsimoti
                </h2>
                <div className="inline-flex rounded-xl border border-[#DCE4DE] p-0.5 bg-[#F7F9F7] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBreakdownType('expense')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      breakdownType === 'expense'
                        ? 'bg-white text-[#C74747] shadow-fintech-card font-semibold'
                        : 'text-[#68736C]'
                    }`}
                  >
                    Chiqimlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownType('income')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      breakdownType === 'income'
                        ? 'bg-white text-[#176B45] shadow-fintech-card font-semibold'
                        : 'text-[#68736C]'
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
                    <div className="py-10 text-center text-[#68736C] text-xs">
                      Ushbu davrda {breakdownType === 'expense' ? 'xarajatlar' : 'daromadlar'} qayd etilmagan.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {list.map((item, idx) => (
                      <div key={item.categoryId || `item-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#17211B]">{item.categoryName}</span>
                          <span className="font-mono font-semibold text-[#17211B]">
                            {formatCurrency(item.totalAmount)}
                            <span className="text-[#68736C] font-normal text-[11px] ml-1.5">
                              ({item.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-[#F7F9F7] rounded-full overflow-hidden">
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
            <BentoCard span={{ default: 12, lg: 7 }} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#68736C]">
                  Davriy dinamika
                </h2>
                <span className="text-[11px] text-[#68736C]">Kirim va chiqim taqqosi</span>
              </div>

              {data.trends.length === 0 ? (
                <div className="py-10 text-center text-[#68736C] text-xs">
                  Tarixiy dinamika ma’lumotlari topilmadi.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.trends.map((t) => {
                    const maxVal = Math.max(1, t.income, t.expense);
                    const incWidth = (t.income / maxVal) * 100;
                    const expWidth = (t.expense / maxVal) * 100;
                    return (
                      <div key={t.periodKey} className="p-2.5 rounded-xl border border-[#DCE4DE] bg-[#F7F9F7] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#17211B]">{t.periodKey}</span>
                          <span className={`font-mono text-[11px] font-semibold ${t.net >= 0 ? 'text-[#176B45]' : 'text-[#C74747]'}`}>
                            Sof: {t.net >= 0 ? '+' : ''}{formatCurrency(t.net)}
                          </span>
                        </div>

                        {/* Income Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-[#68736C]">Kirim</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#176B45] rounded-full transition-all"
                              style={{ width: `${incWidth}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-mono font-medium text-[#176B45]">
                            {formatCurrency(t.income)}
                          </span>
                        </div>

                        {/* Expense Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-[#68736C]">Chiqim</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C74747] rounded-full transition-all"
                              style={{ width: `${expWidth}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-mono font-medium text-[#C74747]">
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
    </div>
  );
}
