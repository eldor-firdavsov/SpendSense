import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import DashboardHeaderAction from '@/components/dashboard/DashboardHeaderAction';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  PieChart,
  Target,
  Layers,
  Calendar,
} from 'lucide-react';

export const metadata = {
  title: 'Bosh sahifa — SpendSense AI',
  description: 'SpendSense AI shaxsiy moliya boshqaruv markazi',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; period?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedMonth = params.month; // e.g. '2026-10', '2026-09', 'all', or undefined
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Time-based greeting in Uzbek
  const now = new Date();
  const currentHour = now.getHours();
  let timeGreeting = 'Xayrli tong';
  if (currentHour >= 11 && currentHour < 18) {
    timeGreeting = 'Xayrli kun';
  } else if (currentHour >= 18 || currentHour < 5) {
    timeGreeting = 'Xayrli kech';
  }

  // Parallel fetch: profile, all transactions, budgets, goals
  const [profileRes, allTxRes, budgetsRes, goalsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('transactions')
      .select('id, description, amount, currency, type, transaction_date, merchant, categories(name, icon, color)')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('budgets')
      .select('id, name, amount, currency, categories(name, color)')
      .eq('user_id', user.id)
      .limit(3),
    supabase
      .from('financial_goals')
      .select('id, name, target_amount, current_amount, currency, target_date, status')
      .eq('user_id', user.id)
      .limit(3),
  ]);

  const profile = profileRes.data;
  const allTransactions = allTxRes.data || [];
  const budgets = budgetsRes.data || [];
  const goals = goalsRes.data || [];
  const userCurrency = 'UZS';

  const pad = (n: number) => String(n).padStart(2, '0');
  const availableMonths = Array.from(
    new Set(allTransactions.map((t) => t.transaction_date.substring(0, 7)))
  ).sort().reverse(); // e.g. ['2026-10', '2026-09']

  // Determine active month key
  const currentCalendarMonthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  let activeMonthKey = requestedMonth;
  if (!activeMonthKey) {
    if (availableMonths.includes(currentCalendarMonthKey)) {
      activeMonthKey = currentCalendarMonthKey;
    } else if (availableMonths.length > 0) {
      activeMonthKey = availableMonths[0]; // e.g. '2026-09'
    } else {
      activeMonthKey = currentCalendarMonthKey;
    }
  }

  const isAllMonths = activeMonthKey === 'all';
  let startDate = '';
  let endDate = '';
  let prevStartDate = '';
  let prevEndDate = '';
  let currentMonthLabel = '';

  const monthNamesUzFull = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  if (isAllMonths) {
    const oldest = availableMonths[availableMonths.length - 1] || '2026-09';
    const newest = availableMonths[0] || '2026-10';
    startDate = `${oldest}-01`;
    endDate = `${newest}-31`;
    currentMonthLabel = `Jami davr (${oldest} — ${newest})`;
  } else {
    const parts = (activeMonthKey || currentCalendarMonthKey).split('-');
    const selYear = parseInt(parts[0], 10);
    const selMonthIndex = parseInt(parts[1], 10) - 1; // 0-indexed

    startDate = `${selYear}-${pad(selMonthIndex + 1)}-01`;
    const lastDay = new Date(selYear, selMonthIndex + 1, 0);
    endDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
    currentMonthLabel = `${monthNamesUzFull[selMonthIndex]} ${selYear}`;

    // Prior month boundaries for real comparison badges
    const prevMonthDate = new Date(selYear, selMonthIndex - 1, 1);
    prevStartDate = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-01`;
    const prevLastDay = new Date(selYear, selMonthIndex, 0);
    prevEndDate = `${prevLastDay.getFullYear()}-${pad(prevLastDay.getMonth() + 1)}-${pad(prevLastDay.getDate())}`;
  }

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email
    : user.email;

  // Calculate Balances & Monthly Totals
  let totalAvailableBalance = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let prevMonthlyIncome = 0;
  let prevMonthlyExpenses = 0;

  // Monthly buckets for the 6-Month Chart
  const monthBuckets: Record<string, { label: string; income: number; expense: number }> = {};
  const monthNamesUzShort = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

  const chartCenterDate = !isAllMonths && activeMonthKey
    ? new Date(parseInt(activeMonthKey.split('-')[0]), parseInt(activeMonthKey.split('-')[1]) - 1, 1)
    : (availableMonths[0] ? new Date(parseInt(availableMonths[0].split('-')[0]), parseInt(availableMonths[0].split('-')[1]) - 1, 1) : now);

  const endChartDate = new Date(Math.max(chartCenterDate.getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()));
  for (let i = 5; i >= 0; i--) {
    const d = new Date(endChartDate.getFullYear(), endChartDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    monthBuckets[key] = {
      label: monthNamesUzShort[d.getMonth()],
      income: 0,
      expense: 0,
    };
  }

  // Category breakdown map for current month expenses
  const categoryExpenseMap = new Map<string, { amount: number; color: string }>();

  for (const t of allTransactions) {
    const amt = Number(t.amount) || 0;
    const isIncome = t.type === 'income';
    const txDate = t.transaction_date;

    // Lifetime balance
    if (isIncome) {
      totalAvailableBalance += amt;
    } else {
      totalAvailableBalance -= amt;
    }

    // Current month
    if (txDate >= startDate && txDate <= endDate) {
      if (isIncome) {
        monthlyIncome += amt;
      } else {
        monthlyExpenses += amt;

        const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
        const catName = cat?.name || 'Boshqa xarajatlar';
        const catColor = cat?.color || '#176B45';
        const existing = categoryExpenseMap.get(catName) || { amount: 0, color: catColor };
        categoryExpenseMap.set(catName, { amount: existing.amount + amt, color: catColor });
      }
    }

    // Previous month comparison
    if (txDate >= prevStartDate && txDate <= prevEndDate) {
      if (isIncome) {
        prevMonthlyIncome += amt;
      } else {
        prevMonthlyExpenses += amt;
      }
    }

    // 6-Month chart bucket
    const monthKey = txDate.substring(0, 7);
    if (monthBuckets[monthKey]) {
      if (isIncome) {
        monthBuckets[monthKey].income += amt;
      } else {
        monthBuckets[monthKey].expense += amt;
      }
    }
  }

  const netMonthlyFlow = monthlyIncome - monthlyExpenses;

  // Income & expense percentage changes compared to previous month
  const incomeChangePct = prevMonthlyIncome > 0
    ? Math.round(((monthlyIncome - prevMonthlyIncome) / prevMonthlyIncome) * 100)
    : null;
  const expenseChangePct = prevMonthlyExpenses > 0
    ? Math.round(((monthlyExpenses - prevMonthlyExpenses) / prevMonthlyExpenses) * 100)
    : null;

  // Category sorting
  const sortedCategories = Array.from(categoryExpenseMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      color: data.color,
      percentage: monthlyExpenses > 0 ? (data.amount / monthlyExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = sortedCategories[0];

  const formatCurrency = (amt: number, _curr?: string) => {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amt))} soʻm`;
  };

  // Determine chart scale
  const chartList = Object.values(monthBuckets);
  const maxChartValue = Math.max(1, ...chartList.map((m) => Math.max(m.income, m.expense)));

  // Recent 6 transactions
  const recentTransactions = allTransactions.slice(0, 6);

  // Palette of distinct category bar accents
  const categoryAccentColors = ['#176B45', '#4B75E8', '#8664D8', '#D99A32', '#C74747'];

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] flex flex-col pb-24 md:pb-14">
      <AppHeader userEmail={user.email} />

      <main className="flex-1 w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* =========================================================================
            1. PAGE HEADER: User Greeting, Context, Period Pills & Actions
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#DCE4DE]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#68736C]">{timeGreeting},</span>
              <span id="user-display-name" className="text-xs font-bold text-[#17211B] bg-white px-2 py-0.5 rounded-md border border-[#DCE4DE]">
                {displayName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17211B] tracking-tight mt-1 flex items-center gap-2">
              <span>Moliyaviy holatingiz</span>
              <span className="sr-only">Bosh sahifa</span>
              <span className="sr-only">Welcome back</span>
            </h1>
            <p className="text-xs text-[#68736C] mt-1 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#176B45]" />
              <span>Joriy hisobot davri:</span>
              <span className="font-semibold text-[#17211B]">{currentMonthLabel}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Historical Month Selector Pills */}
            <div className="inline-flex items-center gap-1 p-1 bg-white rounded-xl border border-[#DCE4DE] text-xs shadow-xs">
              <Link
                href="/dashboard?month=2026-10"
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  activeMonthKey === '2026-10'
                    ? 'font-bold bg-[#DDF3E5] text-[#176B45] border border-[#176B45]/20 shadow-xs'
                    : 'font-medium text-[#68736C] hover:text-[#17211B]'
                }`}
                title="Oktabr 2026 hisoboti"
              >
                Oktabr 2026
              </Link>
              <Link
                href="/dashboard?month=2026-09"
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  activeMonthKey === '2026-09'
                    ? 'font-bold bg-[#DDF3E5] text-[#176B45] border border-[#176B45]/20 shadow-xs'
                    : 'font-medium text-[#68736C] hover:text-[#17211B]'
                }`}
                title="Sentabr 2026 hisoboti"
              >
                Sentabr 2026
              </Link>
              <Link
                href="/dashboard?month=all"
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  activeMonthKey === 'all'
                    ? 'font-bold bg-[#DDF3E5] text-[#176B45] border border-[#176B45]/20 shadow-xs'
                    : 'font-medium text-[#68736C] hover:text-[#17211B]'
                }`}
                title="2 oylik umumiy hisobot"
              >
                Jami (2 oy)
              </Link>
            </div>

            {/* Header Action Button (Mobile-friendly) */}
            <DashboardHeaderAction />
          </div>
        </div>

        {/* =========================================================================
            2. TOP FINTECH GRID: Main Balance Card (7 cols) + Summary Cards (5 cols)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Main Balance Card (7 Columns on Desktop) */}
          <div className="lg:col-span-7 rounded-2xl border border-[#DCE4DE] bg-white p-6 sm:p-7 shadow-fintech-elevated flex flex-col justify-between space-y-6 relative overflow-hidden">
            {/* Subtle Top Decorative Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#176B45] via-[#218653] to-[#4B75E8]" />

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#DDF3E5] text-[#176B45] flex items-center justify-center font-bold">
                    <Wallet className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#68736C]">Jami balans</span>
                    <span className="sr-only">Mavjud balans</span>
                    <div className="text-[11px] text-[#68736C]">Barcha hisoblar bo‘yicha jami qoldiq</div>
                  </div>
                </div>

                <span className="px-2.5 py-1 text-xs font-bold bg-[#E8EFEA] text-[#124D35] rounded-xl border border-[#DCE4DE]">
                  {userCurrency}
                </span>
              </div>

              {/* Large Focal Typography */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline gap-2">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono tracking-tight text-[#17211B]">
                  {formatCurrency(totalAvailableBalance)}
                </div>
                {netMonthlyFlow !== 0 && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    netMonthlyFlow >= 0 ? 'bg-[#DDF3E5] text-[#218653]' : 'bg-rose-50 text-[#C74747]'
                  }`}>
                    {netMonthlyFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <span>{netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)} bu oy</span>
                  </span>
                )}
              </div>
            </div>

            {/* Sparkline & Quick Trajectory Banner */}
            <div className="pt-4 border-t border-[#DCE4DE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F9F7] -mx-6 -mb-6 p-4 rounded-b-2xl">
              <div className="flex items-center gap-3 text-xs text-[#68736C]">
                <div className="flex items-center gap-1.5 font-medium text-[#17211B]">
                  <span className="h-2 w-2 rounded-full bg-[#218653]" />
                  <span>Kirim: <strong className="text-[#218653] font-mono">+{formatCurrency(monthlyIncome)}</strong></span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5 font-medium text-[#17211B]">
                  <span className="h-2 w-2 rounded-full bg-[#C74747]" />
                  <span>Chiqim: <strong className="text-[#C74747] font-mono">-{formatCurrency(monthlyExpenses)}</strong></span>
                </div>
              </div>

              {/* Mini Trend Sparkline SVG */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-[11px] font-semibold text-[#68736C]">6 oylik dinamika:</span>
                <svg className="w-24 h-6 text-[#176B45]" viewBox="0 0 100 24" fill="none" stroke="currentColor">
                  <path
                    d="M 5 18 Q 25 10, 45 15 T 85 8 L 95 6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="95" cy="6" r="3" fill="#176B45" />
                </svg>
              </div>
            </div>
          </div>

          {/* 3 Summary Cards (5 Columns on Desktop) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
            {/* Kirim (Income) */}
            <div className="p-4 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card flex items-center justify-between hover:border-[#176B45]/40 transition-colors">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#68736C]">Kirim</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-[#218653]">
                  +{formatCurrency(monthlyIncome)}
                </div>
                <div className="text-[11px] text-[#68736C]">
                  {incomeChangePct !== null ? (
                    <span className={incomeChangePct >= 0 ? 'text-[#218653] font-semibold' : 'text-[#C74747] font-semibold'}>
                      {incomeChangePct >= 0 ? '+' : ''}{incomeChangePct}% o‘tgan oyga nisbatan
                    </span>
                  ) : (
                    <span>{currentMonthLabel} tushumlari</span>
                  )}
                </div>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-[#DDF3E5] text-[#218653] flex items-center justify-center shrink-0 shadow-xs">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </div>

            {/* Chiqim (Expenses) */}
            <div className="p-4 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card flex items-center justify-between hover:border-[#C74747]/40 transition-colors">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#68736C]">Chiqim</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-[#17211B]">
                  -{formatCurrency(monthlyExpenses)}
                </div>
                <div className="text-[11px] text-[#68736C]">
                  {expenseChangePct !== null ? (
                    <span className={expenseChangePct <= 0 ? 'text-[#218653] font-semibold' : 'text-[#C74747] font-semibold'}>
                      {expenseChangePct >= 0 ? '+' : ''}{expenseChangePct}% o‘tgan oyga nisbatan
                    </span>
                  ) : (
                    <span>{currentMonthLabel} sarf-xarajatlari</span>
                  )}
                </div>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-rose-50 text-[#C74747] flex items-center justify-center shrink-0 shadow-xs">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>

            {/* Sof Oqim (Net Cash Flow) */}
            <div className="p-4 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card flex items-center justify-between hover:border-[#4B75E8]/40 transition-colors sm:col-span-2 lg:col-span-1">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#68736C]">Sof oqim</span>
                <div className={`text-xl sm:text-2xl font-bold font-mono ${
                  netMonthlyFlow >= 0 ? 'text-[#218653]' : 'text-[#C74747]'
                }`}>
                  {netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)}
                </div>
                <div className="text-[11px] text-[#68736C]">
                  {netMonthlyFlow >= 0 ? 'Mablag‘ tejaldi va saqlandi' : 'Xarajat daromaddan oshdi'}
                </div>
              </div>
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                netMonthlyFlow >= 0 ? 'bg-[#DDF3E5] text-[#218653]' : 'bg-rose-50 text-[#C74747]'
              }`}>
                {netMonthlyFlow >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. MID FINTECH GRID: Income vs Expense Chart (8 cols) + Categories & AI (4 cols)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Analytics Spending & Income Overview (8 Cols on Desktop) */}
          <div className="lg:col-span-8 rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-fintech-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE4DE]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#E0E7FF] text-[#4B75E8] flex items-center justify-center">
                    <PieChart className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#17211B]">
                    Pul oqimi tahlili (6 oylik dinamika)
                  </h2>
                </div>
                <p className="text-xs text-[#68736C] mt-0.5">
                  Kirim va chiqimlar oylik nisbati
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-[#218653]" />
                  <span className="font-medium text-[#17211B]">Kirim</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-[#C74747]" />
                  <span className="font-medium text-[#17211B]">Chiqim</span>
                </div>
                <Link
                  href="/analytics"
                  className="text-xs font-semibold text-[#176B45] hover:underline flex items-center gap-1 ml-2"
                >
                  <span>To‘liq tahlil</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Responsive Multi-Bar Chart */}
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 pt-4 pb-2 border-b border-[#DCE4DE]">
                {chartList.map((item, idx) => {
                  const incHeight = Math.max(8, (item.income / maxChartValue) * 100);
                  const expHeight = Math.max(8, (item.expense / maxChartValue) * 100);

                  return (
                    <div key={idx} className="flex flex-col items-center justify-end h-full gap-1 group">
                      <div className="w-full flex items-end justify-center gap-1 h-36">
                        {/* Income Bar */}
                        <div
                          className="w-1/2 max-w-[20px] bg-[#218653] rounded-t-md transition-all duration-300 hover:brightness-110 relative"
                          style={{ height: `${incHeight}%` }}
                          title={`Kirim: ${formatCurrency(item.income)}`}
                        />
                        {/* Expense Bar */}
                        <div
                          className="w-1/2 max-w-[20px] bg-[#C74747] rounded-t-md transition-all duration-300 hover:brightness-110 relative"
                          style={{ height: `${expHeight}%` }}
                          title={`Chiqim: ${formatCurrency(item.expense)}`}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#68736C] group-hover:text-[#17211B] mt-1">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#68736C]">
                <span>Hisoblar bo‘yicha avtomatik sinxronizatsiya</span>
                <span className="font-mono">Maksimal ko‘rsatkich: {formatCurrency(maxChartValue)}</span>
              </div>
            </div>
          </div>

          {/* Side Column: Categories & AI Insights (4 Cols on Desktop) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Top Category Spending Breakdown */}
            <div className="p-5 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#FEF3C7] text-[#D99A32] flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#17211B]">
                    Xarajat toifalari
                  </h3>
                </div>
                <Link
                  href="/categories"
                  className="text-xs font-semibold text-[#176B45] hover:underline"
                >
                  Barchasi
                </Link>
              </div>

              {sortedCategories.length === 0 ? (
                <p className="text-xs text-[#68736C] py-4 text-center">
                  Joriy oyda hali xarajatlar kiritilmagan.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {sortedCategories.slice(0, 4).map((c, i) => {
                    const barColor = categoryAccentColors[i % categoryAccentColors.length];
                    return (
                      <div key={c.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#17211B] truncate">{c.name}</span>
                          <span className="font-mono font-bold text-[#17211B]">
                            {formatCurrency(c.amount)}
                            <span className="text-[11px] font-normal text-[#68736C] ml-1">
                              ({c.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        {/* Horizontal Progress Bar */}
                        <div className="h-2 w-full bg-[#F1F4F2] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(5, c.percentage))}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Financial Insight Card (Purple Accent) */}
            <div className="p-5 rounded-2xl border border-[#DCE4DE] bg-gradient-to-br from-white via-white to-[#F5F3FF] shadow-fintech-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#F3E8FF] text-[#8664D8] flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8664D8]">
                    SpendSense AI tahlili
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#F3E8FF] text-[#8664D8] rounded-md">
                  Grounded
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#DCE4DE] text-xs text-[#17211B] leading-relaxed shadow-xs">
                {topCategory
                  ? `Joriy oyda eng katta sarf-xarajat "${topCategory.name}" toifasida (${formatCurrency(topCategory.amount)}) kuzatildi. Tejamkorlik uchun ushbu kategoriyaga byudjet limiti belgilash tavsiya etiladi.`
                  : `Hozircha sarf-xarajatlar balansi barqaror. Xarajatlar va daromadlaringizni muntazam kiritib boring.`}
              </div>

              <Link
                href="/advisor"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#176B45] hover:bg-[#124D35] text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
              >
                <span>AI maslahatchidan so‘rash</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. LOWER FINTECH GRID: Recent Transactions (8 cols) + Budgets/Goals (4 cols)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Recent Activity (8 Columns on Desktop) */}
          <div className="lg:col-span-8 rounded-2xl border border-[#DCE4DE] bg-white overflow-hidden shadow-fintech-card">
            <div className="px-5 py-4 border-b border-[#DCE4DE] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[#DDF3E5] text-[#176B45] flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#17211B]">
                  So‘nggi tranzaksiyalar
                </h2>
              </div>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-[#176B45] hover:underline flex items-center gap-1"
              >
                <span>Barchasini ko‘rish</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#68736C] space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-[#F7F9F7] border border-[#DCE4DE] flex items-center justify-center mx-auto text-[#176B45]">
                  <Receipt className="h-6 w-6" />
                </div>
                <p className="font-semibold text-sm text-[#17211B]">Hozircha tranzaksiyalar mavjud emas</p>
                <p className="max-w-sm mx-auto text-[11px]">
                  Moliyaviy faoliyatingiz shu yerda aks etadi. Xarajat yoki daromadingizni kiritish uchun birinchi tranzaksiyangizni qo‘shing.
                </p>
                <div className="pt-2">
                  <DashboardHeaderAction />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#DCE4DE]">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
                  const catName = cat?.name || (isIncome ? 'Kirim' : 'Boshqa xarajat');

                  return (
                    <div
                      key={tx.id}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F7F9F7] transition-colors text-xs group"
                    >
                      <div className="min-w-0 pr-4 flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                          isIncome ? 'bg-[#DDF3E5] text-[#218653]' : 'bg-[#FEE2E2] text-[#C74747]'
                        }`}>
                          {isIncome ? <ArrowDownLeft className="h-4.5 w-4.5" /> : <ArrowUpRight className="h-4.5 w-4.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#17211B] truncate">{tx.description}</div>
                          <div className="text-[11px] text-[#68736C] flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{tx.transaction_date}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 bg-[#F1F4F2] rounded text-[#17211B] font-medium">{catName}</span>
                            {tx.merchant && <span>• {tx.merchant}</span>}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`font-mono font-bold text-sm whitespace-nowrap ${
                          isIncome ? 'text-[#218653]' : 'text-[#C74747]'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Number(tx.amount))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Budgets & Goals Preview (4 Columns on Desktop) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Budgets Card */}
            <div className="p-5 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#DDF3E5] text-[#176B45] flex items-center justify-center">
                    <Target className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#17211B]">
                    Faol byudjetlar
                  </h3>
                </div>
                <Link href="/budgets" className="text-xs font-semibold text-[#176B45] hover:underline">
                  Boshqarish
                </Link>
              </div>

              {budgets.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#68736C]">
                  Faol byudjetlar yo‘q.{' '}
                  <Link href="/budgets" className="text-[#176B45] font-semibold underline">
                    Yangi byudjet yarating
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {budgets.map((b) => (
                    <div key={b.id} className="p-3 rounded-xl bg-[#F7F9F7] border border-[#DCE4DE] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#17211B]">{b.name}</span>
                        <span className="font-mono font-bold text-[#176B45]">{formatCurrency(Number(b.amount))}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#DCE4DE] rounded-full overflow-hidden">
                        <div className="h-full bg-[#176B45] rounded-full w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Savings Goals Card */}
            <div className="p-5 rounded-2xl border border-[#DCE4DE] bg-white shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#E0E7FF] text-[#4B75E8] flex items-center justify-center">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#17211B]">
                    Jamg‘arma maqsadlari
                  </h3>
                </div>
                <Link href="/goals" className="text-xs font-semibold text-[#176B45] hover:underline">
                  Boshqarish
                </Link>
              </div>

              {goals.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#68736C]">
                  Jamg‘arma maqsadlari belgilanmagan.{' '}
                  <Link href="/goals" className="text-[#176B45] font-semibold underline">
                    Maqsad qo‘shing
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((g) => {
                    const current = Number(g.current_amount) || 0;
                    const target = Number(g.target_amount) || 0;
                    const remaining = Math.max(0, target - current);
                    const pct = target > 0
                      ? Math.min(100, Math.round((current / target) * 100))
                      : 0;

                    return (
                      <div key={g.id} className="p-3 rounded-xl bg-[#F7F9F7] border border-[#DCE4DE] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#17211B] truncate max-w-[200px]">{g.name}</span>
                          <span className="font-mono font-bold text-[#4B75E8]">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#DCE4DE] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4B75E8] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#68736C]">
                          <span>Yig‘ilgan: {formatCurrency(current)}</span>
                          <span>{remaining > 0 ? `Qolgan: ${formatCurrency(remaining)}` : 'Bajarildi'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
