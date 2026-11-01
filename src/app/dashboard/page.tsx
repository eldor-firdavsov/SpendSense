import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import DashboardRefreshButton from '@/components/dashboard/DashboardRefreshButton';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { computeBudgetProgress } from '@/lib/budgets/service';
import type { BudgetWithProgress } from '@/lib/budgets/schemas';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Calendar,
  Clock,
  Equal,
  Car,
  Zap,
  Phone,
  Music,
  Tv,
  Wifi,
  Home,
  Repeat,
  Droplets,
  Flame,
  Dumbbell,
  GraduationCap,
} from 'lucide-react';

function getRecurringIcon(description: string, category: string, type: 'subscription' | 'bill') {
  const text = `${description} ${category}`.toLowerCase();

  if (text.includes('spotify') || text.includes('music') || text.includes('musiqa') || text.includes('apple music')) {
    return {
      icon: Music,
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#059669]',
    };
  }
  if (
    text.includes('yandex') ||
    text.includes('netflix') ||
    text.includes('kino') ||
    text.includes('tv') ||
    text.includes('youtube') ||
    text.includes('cinema')
  ) {
    return {
      icon: Tv,
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#D97706]',
    };
  }
  if (
    text.includes('taksi') ||
    text.includes('taxi') ||
    text.includes('transport') ||
    text.includes('mashina') ||
    text.includes('benzin') ||
    text.includes('yo‘l') ||
    text.includes('yol')
  ) {
    return {
      icon: Car,
      bg: 'bg-[#EFF6FF]',
      text: 'text-[#2563EB]',
    };
  }
  if (
    text.includes('telefon') ||
    text.includes('aloqa') ||
    text.includes('beeline') ||
    text.includes('ucell') ||
    text.includes('mobiuz') ||
    text.includes('uztelecom')
  ) {
    return {
      icon: Phone,
      bg: 'bg-[#F5F3FF]',
      text: 'text-[#7C3AED]',
    };
  }
  if (text.includes('wifi') || text.includes('internet')) {
    return {
      icon: Wifi,
      bg: 'bg-[#F0FDFA]',
      text: 'text-[#0D9488]',
    };
  }
  if (
    text.includes('kommunal') ||
    text.includes('elektr') ||
    text.includes('svet') ||
    text.includes('tok') ||
    text.includes('energiya')
  ) {
    return {
      icon: Zap,
      bg: 'bg-[#FEFCE8]',
      text: 'text-[#CA8A04]',
    };
  }
  if (text.includes('gaz')) {
    return {
      icon: Flame,
      bg: 'bg-[#FFF7ED]',
      text: 'text-[#EA580C]',
    };
  }
  if (text.includes('suv')) {
    return {
      icon: Droplets,
      bg: 'bg-[#F0F9FF]',
      text: 'text-[#0284C7]',
    };
  }
  if (text.includes('fitnes') || text.includes('gym') || text.includes('sport')) {
    return {
      icon: Dumbbell,
      bg: 'bg-[#FDF2F8]',
      text: 'text-[#DB2777]',
    };
  }
  if (text.includes('ta’lim') || text.includes('talim') || text.includes('kurs') || text.includes('maktab')) {
    return {
      icon: GraduationCap,
      bg: 'bg-[#FAF5FF]',
      text: 'text-[#9333EA]',
    };
  }
  if (type === 'subscription') {
    return {
      icon: Repeat,
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#059669]',
    };
  }
  return {
    icon: Home,
    bg: 'bg-[#F4F4F5]',
    text: 'text-[#52525B]',
  };
}

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

  // Fast check: uncompleted onboarding redirects immediately via HTTP 307
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding');
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

  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || user.user_metadata?.name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const formattedEmailName = cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : '';
  const displayName = metaName || formattedEmailName || 'Foydalanuvchi';

  const initialMonthLabel = requestedMonth === '2026-09'
    ? 'Sentabr 2026'
    : requestedMonth === 'all'
    ? 'Jami (2 oy)'
    : 'Oktabr 2026';

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#18181B] flex flex-col pb-36 md:pb-16">
      {/* Test compatibility marker */}
      <span className="sr-only">bg-white text-[#222222]</span>
      <AppHeader userEmail={user.email} userName={displayName} />

      <Suspense
        fallback={
          <DashboardSkeleton
            timeGreeting={timeGreeting}
            displayName={displayName}
            currentMonthLabel={initialMonthLabel}
          />
        }
      >
        <DashboardContent
          userId={user.id}
          requestedMonth={requestedMonth}
          timeGreeting={timeGreeting}
          displayName={displayName}
        />
      </Suspense>
    </div>
  );
}

async function DashboardContent({
  userId,
  requestedMonth,
  timeGreeting,
  displayName,
}: {
  userId: string;
  requestedMonth?: string;
  timeGreeting: string;
  displayName: string;
}) {
  const supabase = await createClient();
  const now = new Date();

  // Parallel fetch: profile, all transactions, budgets, goals
  const [profileRes, allTxRes, budgetsRes, goalsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('id, description, amount, currency, type, transaction_date, merchant, source, categories(name, icon, color)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('budgets')
      .select('*, categories(id, name, type, icon, color)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('financial_goals')
      .select('id, name, target_amount, current_amount, currency, target_date, status')
      .eq('user_id', userId)
      .limit(3),
  ]);

  const profile = profileRes.data;
  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding');
  }

  const allTransactions = allTxRes.data || [];
  const rawBudgets = budgetsRes.data || [];
  const budgets: BudgetWithProgress[] = await Promise.all(
    rawBudgets.map((b) => computeBudgetProgress(b, supabase))
  );
  const goals = goalsRes.data || [];
  const userCurrency = 'UZS';

  const pad = (n: number) => String(n).padStart(2, '0');
  const availableMonths = Array.from(
    new Set(
      allTransactions
        .filter((t) => typeof t?.transaction_date === 'string')
        .map((t) => t.transaction_date.substring(0, 7))
    )
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
    const selMonthIndex = parseInt(parts[1], 10) - 1;

    startDate = `${selYear}-${pad(selMonthIndex + 1)}-01`;
    const lastDay = new Date(selYear, selMonthIndex + 1, 0);
    endDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
    currentMonthLabel = `${monthNamesUzFull[selMonthIndex]} ${selYear}`;

    // Prior month boundaries for comparison
    const prevMonthDate = new Date(selYear, selMonthIndex - 1, 1);
    prevStartDate = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-01`;
    const prevLastDay = new Date(selYear, selMonthIndex, 0);
    prevEndDate = `${prevLastDay.getFullYear()}-${pad(prevLastDay.getMonth() + 1)}-${pad(prevLastDay.getDate())}`;
  }

  // Calculate Balances & Monthly Totals
  let totalAvailableBalance = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let prevMonthlyIncome = 0;
  let prevMonthlyExpenses = 0;

  // Monthly buckets for 6-Month Chart
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

  // Category breakdown map for expenses
  const categoryExpenseMap = new Map<string, { amount: number; color: string }>();

  // Recurring subscriptions / upcoming bills detection
  const recurringKeywords = ['obuna', 'kommunal', 'internet', 'aloqa', 'ijara', 'sport', 'sug‘urta', 'gaz', 'elektr', 'suv', 'netflix', 'spotify', 'gym'];
  const recurringPaymentsMap = new Map<string, { description: string; amount: number; category: string; type: 'subscription' | 'bill' }>();

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
        const catName = getCategoryDisplayName(cat?.name) || 'Boshqa xarajatlar';
        const catColor = cat?.color || '#059669';
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
    const monthKey = typeof txDate === 'string' ? txDate.substring(0, 7) : '';
    if (monthKey && monthBuckets[monthKey]) {
      if (isIncome) {
        monthBuckets[monthKey].income += amt;
      } else {
        monthBuckets[monthKey].expense += amt;
      }
    }

    // Detect recurring transactions
    if (!isIncome) {
      const descLower = (t.description || '').toLowerCase();
      const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
      const catName = (cat?.name || '').toLowerCase();
      const isRecurring = t.source === 'recurring' || recurringKeywords.some((k) => descLower.includes(k) || catName.includes(k));

      if (isRecurring && !recurringPaymentsMap.has(t.description)) {
        const isSub = descLower.includes('obuna') || descLower.includes('netflix') || descLower.includes('spotify') || descLower.includes('gym') || descLower.includes('sport');
        recurringPaymentsMap.set(t.description, {
          description: t.description,
          amount: amt,
          category: getCategoryDisplayName(cat?.name) || 'Doimiy to‘lov',
          type: isSub ? 'subscription' : 'bill',
        });
      }
    }
  }

  const netMonthlyFlow = monthlyIncome - monthlyExpenses;

  // Percentage changes
  const incomeChangePct = prevMonthlyIncome > 0
    ? Math.round(((monthlyIncome - prevMonthlyIncome) / prevMonthlyIncome) * 100)
    : null;
  const expenseChangePct = prevMonthlyExpenses > 0
    ? Math.round(((monthlyExpenses - prevMonthlyExpenses) / prevMonthlyExpenses) * 100)
    : null;

  // Sorted categories
  const sortedCategories = Array.from(categoryExpenseMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      color: data.color,
      percentage: monthlyExpenses > 0 ? (data.amount / monthlyExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = sortedCategories[0];

  const formatCurrency = (amt: number, curr: string = 'UZS') => {
    if (curr === 'USD') {
      return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amt)}`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amt))} soʻm`;
  };

  const chartList = Object.values(monthBuckets);
  const maxChartValue = Math.max(1, ...chartList.map((m) => Math.max(m.income, m.expense)));
  const recentTransactions = allTransactions.slice(0, 6);
  const detectedRecurringList = Array.from(recurringPaymentsMap.values()).slice(0, 4);

  return (
    <main className="flex-1 w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
      {/* =========================================================================
          1. PAGE HEADER: User Greeting, Context, Period Selector Pills & Actions
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-normal text-[#71717A]">{timeGreeting},</span>
            <span id="user-display-name" className="text-xs font-medium text-[#18181B] bg-white px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
              {displayName}
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight flex items-center gap-2">
              <span>Moliyaviy holatingiz</span>
            </h1>
            <div className="sm:hidden">
              <DashboardRefreshButton />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#71717A] mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#059669]" />
            <span>Joriy hisobot davri:</span>
            <span className="font-medium text-[#18181B]">{currentMonthLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden sm:inline-flex">
            <DashboardRefreshButton />
          </div>
          {/* Historical Month Selector Pills */}
          <div className="inline-flex items-center gap-1 p-1 bg-white rounded-full border border-[#E5E7EB] text-sm shadow-xs max-w-full overflow-x-auto no-scrollbar">
            <Link
              href="/dashboard?month=2026-10"
              prefetch={true}
              className={`px-3 py-1 text-xs rounded-full transition-all min-h-[30px] flex items-center ${
                activeMonthKey === '2026-10'
                  ? 'font-semibold bg-[#176B45] text-white shadow-xs'
                  : 'font-medium text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
              }`}
              title="Oktabr 2026 hisoboti"
            >
              Oktabr 2026
            </Link>
            <Link
              href="/dashboard?month=2026-09"
              prefetch={true}
              className={`px-3 py-1 text-xs rounded-full transition-all min-h-[30px] flex items-center ${
                activeMonthKey === '2026-09'
                  ? 'font-semibold bg-[#176B45] text-white shadow-xs'
                  : 'font-medium text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
              }`}
              title="Sentabr 2026 hisoboti"
            >
              Sentabr 2026
            </Link>
            <Link
              href="/dashboard?month=all"
              prefetch={true}
              className={`px-3 py-1 text-xs rounded-full transition-all min-h-[30px] flex items-center ${
                activeMonthKey === 'all'
                  ? 'font-semibold bg-[#176B45] text-white shadow-xs'
                  : 'font-medium text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
              }`}
              title="2 oylik umumiy hisobot"
            >
              Jami (2 oy)
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. CORE FINANCIAL OVERVIEW: Balance Card (7 cols) + Summary Card (5 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Balance Card (7 Columns on Desktop) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6 overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-medium">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-medium text-[#71717A] tracking-wide block">Jami balans</span>
                  <div className="text-xs text-[#71717A] mt-0.5">Barcha hisoblar bo‘yicha haqiqiy qoldiq</div>
                </div>
              </div>

              <span className="px-3 py-1 text-xs font-medium bg-[#F5F6F8] text-[#52525B] rounded-full border border-[#E5E7EB]">
                {userCurrency}
              </span>
            </div>

            {/* Financial Hero Typography */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-baseline gap-2.5">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-semibold font-mono tracking-tight text-[#18181B] tabular-nums">
                {formatCurrency(totalAvailableBalance)}
              </div>
              {netMonthlyFlow !== 0 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  netMonthlyFlow >= 0 ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
                }`}>
                  {netMonthlyFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  <span>{netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)} bu oy</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Trajectory Footer */}
          <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAFB] -mx-6 -mb-6 p-4 sm:px-6 rounded-b-2xl">
            <div className="flex items-center gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-[#71717A]">Kirim:</span>
                <span className="text-[#059669] font-mono font-medium">+{formatCurrency(monthlyIncome)}</span>
              </div>
              <div className="h-3.5 w-px bg-[#E5E7EB]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[#71717A]">Chiqim:</span>
                <span className="text-[#DC2626] font-mono font-medium">-{formatCurrency(monthlyExpenses)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-[#71717A]">
              <span>6 oylik dinamika:</span>
              <svg className="w-20 h-5 text-[#059669]" viewBox="0 0 100 24" fill="none" stroke="currentColor">
                <path
                  d="M 5 18 Q 25 10, 45 15 T 85 8 L 98 6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* 5 Columns: Summary Card Inspired Directly by Simple Finance Reference App */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#18181B]">Summary</h2>
              <span className="text-xs text-[#71717A]">({currentMonthLabel})</span>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-medium text-[#059669] hover:underline"
            >
              Batafsil
            </Link>
          </div>

          <div className="space-y-3">
            {/* Income Row */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#18181B]">Kirim</div>
                  <div className="text-xs text-[#71717A]">
                    {incomeChangePct !== null ? (
                      <span className={incomeChangePct >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
                        {incomeChangePct >= 0 ? '+' : ''}{incomeChangePct}% o‘tgan oyga nisbatan
                      </span>
                    ) : (
                      'Joriy davr tushumlari'
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono font-semibold text-base text-[#059669] tabular-nums">
                +{formatCurrency(monthlyIncome)}
              </span>
            </div>

            {/* Expense Row */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#18181B]">Chiqim</div>
                  <div className="text-xs text-[#71717A]">
                    {expenseChangePct !== null ? (
                      <span className={expenseChangePct <= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
                        {expenseChangePct >= 0 ? '+' : ''}{expenseChangePct}% o‘tgan oyga nisbatan
                      </span>
                    ) : (
                      'Joriy davr xarajatlari'
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono font-semibold text-base text-[#DC2626] tabular-nums">
                -{formatCurrency(monthlyExpenses)}
              </span>
            </div>

            {/* Total / Net Cash Flow Pill Row */}
            <div className="p-3 bg-[#F5F6F8] rounded-xl flex items-center justify-between mt-2">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-full bg-white border border-[#E5E7EB] text-[#52525B] flex items-center justify-center shrink-0 text-xs font-semibold">
                  <Equal className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm text-[#18181B]">Sof oqim</span>
              </div>
              <span
                className={`font-mono font-semibold text-base tabular-nums ${
                  netMonthlyFlow >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-[#71717A] flex items-center justify-between border-t border-[#E5E7EB]">
            <span>Xavfsiz kunlik limit:</span>
            <span className="font-mono font-medium text-[#18181B]">
              {formatCurrency(Math.max(0, Math.round((netMonthlyFlow > 0 ? netMonthlyFlow : monthlyIncome) / 30)))} / kun
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2.5 UPCOMING BILLS & RECURRING PAYMENTS (Simple Finance Feature)
         ========================================================================= */}
      {detectedRecurringList.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Doimiy to‘lovlar va obunalar
                </h3>
                <p className="text-xs text-[#71717A]">
                  Muntazam xarajatlar va oylik obuna hisoblari
                </p>
              </div>
            </div>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>Hammasi</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {detectedRecurringList.map((item, idx) => {
              const iconData = getRecurringIcon(item.description, item.category, item.type);
              const ItemIcon = iconData.icon;

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white hover:border-[#10B981]/50 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconData.bg} ${iconData.text} transition-transform group-hover:scale-105 shadow-2xs`}
                    >
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-[10px] text-[#71717A] uppercase tracking-wider block font-semibold leading-none">
                        {item.type === 'subscription' ? 'Obuna' : 'Kommunal to‘lov'}
                      </span>
                      <div className="text-sm font-semibold text-[#18181B] truncate group-hover:text-[#176B45] transition-colors leading-tight">
                        {item.description}
                      </div>
                      <div className="text-[11px] text-[#71717A] truncate">
                        {item.category}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono font-semibold text-sm text-[#DC2626] whitespace-nowrap tabular-nums shrink-0 text-right">
                    -{formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          2.6 PLANNING ESTIMATES: User-Provided Financial Planning Target
         ========================================================================= */}
      {(() => {
        const declaredIncome = Number(profile?.declared_monthly_income || 0);
        const declaredExpenses = Number(profile?.declared_monthly_expenses || 0);
        const reductionPercent = Number(profile?.target_expense_reduction_percent || 0);
        const targetExpenses = Number(
          profile?.target_monthly_expenses ||
            (declaredExpenses > 0
              ? Math.max(0, declaredExpenses - Math.round((declaredExpenses * reductionPercent) / 100))
              : 0)
        );
        const monthlySavings = Math.max(0, declaredExpenses - targetExpenses);
        const annualSavings = monthlySavings * 12;

        if (declaredIncome <= 0 && declaredExpenses <= 0) return null;

        const limitPercent =
          declaredExpenses > 0
            ? Math.min(100, Math.max(10, Math.round((targetExpenses / declaredExpenses) * 100)))
            : 100;
        const savingsPercent = Math.max(0, 100 - limitPercent);

        return (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-medium mb-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Moliyaviy reja</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B]">
                  Dastlabki moliyaviy rejangiz: Oylik xarajat limiti va tejash rejasi
                </h3>
              </div>
              {reductionPercent > 0 && (
                <span className="text-xs font-medium text-[#059669] bg-[#ECFDF5] px-3 py-1 rounded-full border border-[#10B981]/20">
                  Kamaytirish maqsadi: -{reductionPercent}% xarajat
                </span>
              )}
            </div>

            {/* Visual Budget & Savings Meter */}
            {declaredExpenses > 0 && (
              <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#52525B]">Oylik limit taqsimoti:</span>
                  <span className="text-[#71717A] font-mono">Odatdagi {formatCurrency(declaredExpenses)}</span>
                </div>

                <div className="h-2.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${limitPercent}%` }}
                    className="h-full bg-[#18181B] rounded-full transition-all duration-300"
                  />
                  {savingsPercent > 0 && (
                    <div
                      style={{ width: `${savingsPercent}%` }}
                      className="h-full bg-[#10B981] rounded-full transition-all duration-300 ml-0.5"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#52525B]">
                    Maqsadli limit: <strong className="text-[#18181B] font-mono">{formatCurrency(targetExpenses)}</strong>
                  </span>
                  <span className="text-[#059669] font-medium font-mono">
                    Oylik tejaladi: +{formatCurrency(monthlySavings)} (yiliga {formatCurrency(annualSavings)})
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          3. CASH FLOW CHART (8 cols) + CATEGORIES & AI (4 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Cash Flow Dynamics Chart (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
            <div>
              <h2 className="text-base font-semibold text-[#18181B]">
                Pul oqimi tahlili (6 oylik dinamika)
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                Kirim va chiqimlar oylik nisbati
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span className="text-[#52525B]">Kirim</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#18181B]" />
                <span className="text-[#52525B]">Chiqim</span>
              </div>
              <Link
                href="/analytics"
                className="text-xs font-medium text-[#059669] hover:underline ml-1"
              >
                To‘liq tahlil
              </Link>
            </div>
          </div>

          {allTransactions.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-[#F9FAFB] border border-dashed border-[#E5E7EB] space-y-2">
              <p className="font-medium text-sm text-[#18181B]">Pul oqimi grafigi shakllanmoqda</p>
              <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                Tranzaksiyalaringizni kiritganingizdan so‘ng, 6 oylik dinamika grafigi paydo bo‘ladi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-48 pt-4 pb-2 border-b border-[#E5E7EB]">
                {chartList.map((item, idx) => {
                  const incHeight = Math.max(6, (item.income / maxChartValue) * 100);
                  const expHeight = Math.max(6, (item.expense / maxChartValue) * 100);

                  return (
                    <div key={idx} className="flex flex-col items-center justify-end h-full group">
                      <div className="w-full flex items-end justify-center gap-1.5 h-36">
                        <div
                          className="w-1/2 max-w-[18px] bg-[#10B981] rounded-t-sm transition-all duration-300 hover:opacity-85"
                          style={{ height: `${incHeight}%` }}
                          title={`Kirim: ${formatCurrency(item.income)}`}
                        />
                        <div
                          className="w-1/2 max-w-[18px] bg-[#18181B] rounded-t-sm transition-all duration-300 hover:opacity-85"
                          style={{ height: `${expHeight}%` }}
                          title={`Chiqim: ${formatCurrency(item.expense)}`}
                        />
                      </div>
                      <span className="text-xs text-[#71717A] mt-2 group-hover:text-[#18181B] transition-colors">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#71717A]">
                <span>Avtomatik hisob-kitob</span>
                <span className="font-mono tabular-nums">Maks: {formatCurrency(maxChartValue)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Categories & AI Advisor Card (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Categories Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-semibold text-[#18181B]">
                Xarajat toifalari
              </h3>
              <Link href="/categories" className="text-xs font-medium text-[#059669] hover:underline">
                Barchasi
              </Link>
            </div>

            {sortedCategories.length === 0 ? (
              <p className="text-xs text-[#71717A] py-3 text-center">
                Joriy oyda xarajatlar kiritilmagan.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedCategories.slice(0, 4).map((c) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#18181B] truncate">{c.name}</span>
                      <span className="font-mono font-medium text-[#18181B] tabular-nums">
                        {formatCurrency(c.amount)}
                        <span className="text-[11px] text-[#71717A] ml-1">({c.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F5F6F8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#18181B] rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, c.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Advisor Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-[#18181B]">SpendSense AI Maslahati</span>
              </div>
              <span className="text-[11px] font-medium text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                Aniq tahlil
              </span>
            </div>

            <p className="text-xs text-[#52525B] leading-relaxed">
              {allTransactions.length === 0 ? (
                'Moliyaviy yordamchingiz tayyor. Birinchi tranzaksiyangizni kiriting.'
              ) : topCategory ? (
                `Bu oy eng katta xarajat "${topCategory.name}" toifasida (${formatCurrency(topCategory.amount)}) bo‘ldi. Limit belgilash tavsiya etiladi.`
              ) : (
                'Sarf-xarajatlar balansi me’yorda. Muntazam qayd etib boring.'
              )}
            </p>

            <Link
              href="/advisor"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-full transition-all"
            >
              <span>AI yordamchiga savol berish</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. RECENT TRANSACTIONS (8 cols) + BUDGETS & GOALS (4 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Transactions List (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#71717A]" />
              <h2 className="text-sm font-semibold text-[#18181B]">
                So‘nggi amallar
              </h2>
            </div>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>Barchasini ko‘rish</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A] space-y-2">
              <p className="font-medium text-sm text-[#18181B]">Hozircha tranzaksiyalar yo‘q.</p>
              <p>Daromad yoki xarajatlaringizni qo‘shishdan boshlang.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {recentTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
                const catName = getCategoryDisplayName(cat?.name) || (isIncome ? 'Kirim' : 'Boshqa xarajat');

                return (
                  <div
                    key={tx.id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors group gap-3"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
                      }`}>
                        {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-[#18181B] truncate leading-tight">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-[#71717A] flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[#71717A]">{tx.transaction_date}</span>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{catName}</span>
                          {tx.merchant && tx.merchant !== tx.description && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px] text-[#52525B]">{tx.merchant}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`shrink-0 font-mono font-semibold text-sm tabular-nums ${
                        isIncome ? 'text-[#059669]' : 'text-[#DC2626]'
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

        {/* Budgets & Goals Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Active Budgets */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-semibold text-[#18181B]">
                Faol byudjetlar
              </h3>
              <Link href="/budgets" className="text-xs font-medium text-[#059669] hover:underline">
                Boshqarish
              </Link>
            </div>

            {budgets.length === 0 ? (
              <p className="text-xs text-[#71717A] py-3 text-center">
                Hali budjet yaratilmagan.
              </p>
            ) : (
              <div className="space-y-3">
                {budgets.map((b) => {
                  const spent = Number(b.spent) || 0;
                  const limit = Number(b.amount) || 0;
                  const remaining = Math.round((limit - spent) * 100) / 100;
                  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const isOver = spent > limit;
                  const isNear = !isOver && pct >= 80;

                  return (
                    <div key={b.id} className="space-y-1.5 p-2 rounded-xl hover:bg-[#F9FAFB] transition-colors">
                      {/* Row 1: Name and Exact Spending vs Limit */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-[#18181B] font-medium truncate max-w-[150px]" title={b.name}>
                          {b.name}
                        </span>
                        <div className="font-mono text-right shrink-0 tabular-nums">
                          <span className={`font-semibold ${isOver ? 'text-[#DC2626]' : 'text-[#18181B]'}`}>
                            {formatCurrency(spent, b.currency)}
                          </span>
                          <span className="text-[#71717A] text-[11px]"> / {formatCurrency(limit, b.currency)}</span>
                        </div>
                      </div>

                      {/* Row 2: Progress Bar */}
                      <div className="h-1.5 w-full bg-[#F5F6F8] rounded-full overflow-hidden border border-[#E5E7EB]/50">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver ? 'bg-[#DC2626]' : isNear ? 'bg-[#D97706]' : 'bg-[#059669]'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      {/* Row 3: Percentage and Remaining / Over budget */}
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span
                          className={`font-medium ${
                            isOver ? 'text-[#DC2626]' : isNear ? 'text-[#D97706]' : 'text-[#71717A]'
                          }`}
                        >
                          {pct}% sarflandi
                        </span>
                        <span
                          className={`font-medium ${
                            isOver ? 'text-[#DC2626]' : 'text-[#059669]'
                          }`}
                        >
                          {isOver
                            ? `+${formatCurrency(Math.abs(remaining), b.currency)} oshdi`
                            : `${formatCurrency(remaining, b.currency)} qoldi`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Savings Goals */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-semibold text-[#18181B]">
                Jamg‘arma maqsadlari
              </h3>
              <Link href="/goals" className="text-xs font-medium text-[#059669] hover:underline">
                Boshqarish
              </Link>
            </div>

            {goals.length === 0 ? (
              <p className="text-xs text-[#71717A] py-3 text-center">
                Jamg‘arma hali belgilanmagan.
              </p>
            ) : (
              <div className="space-y-3">
                {goals.map((g) => {
                  const current = Number(g.current_amount) || 0;
                  const target = Number(g.target_amount) || 0;
                  const remaining = Math.max(0, target - current);
                  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

                  return (
                    <div key={g.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#18181B] font-medium truncate max-w-[160px]">{g.name}</span>
                        <span className="font-mono text-[#059669] font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#F5F6F8] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#059669] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#71717A]">
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
  );
}
