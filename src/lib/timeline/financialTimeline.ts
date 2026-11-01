import { SupabaseClient } from '@supabase/supabase-js';

export interface EligibleMonthItem {
  key: string; // 'YYYY-MM'
  year: number;
  month: number; // 1-12
  labelUz: string; // e.g. 'Sentabr 2026'
  shortLabelUz: string; // e.g. 'Sen 2026'
  startDate: string; // 'YYYY-MM-01'
  endDate: string; // 'YYYY-MM-DD'
  transactionCount: number;
}

export interface FinancialTimelineSummary {
  financialStartDate: string | null;
  availableMonths: EligibleMonthItem[];
  availableMonthKeys: string[];
  latestMonthKey: string | null;
  oldestMonthKey: string | null;
  hasData: boolean;
  totalTransactions: number;
}

export const MONTH_NAMES_UZ_FULL = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

export const MONTH_NAMES_UZ_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

export function getMonthDateRange(year: number, monthIndex0: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(monthIndex0 + 1)}-01`;
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const endDate = `${year}-${pad(monthIndex0 + 1)}-${pad(lastDay)}`;
  return { startDate, endDate };
}

/**
 * Returns user-specific eligible financial months.
 * Strict rules:
 * - Only months with actual qualifying financial transactions appear.
 * - No months before financial_start_date.
 * - No artificial or empty intermediate months.
 * - New users with 0 transactions return an empty timeline (hasData = false).
 */
export async function getUserFinancialTimeline(
  userId: string,
  supabase: SupabaseClient
): Promise<FinancialTimelineSummary> {
  // 1. Fetch user profile financial_start_date
  const { data: profile } = await supabase
    .from('profiles')
    .select('financial_start_date, created_at')
    .eq('id', userId)
    .maybeSingle();

  let financialStartDate = profile?.financial_start_date || null;

  // 2. Fetch all transaction dates for user
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  if (error || !txs || txs.length === 0) {
    return {
      financialStartDate,
      availableMonths: [],
      availableMonthKeys: [],
      latestMonthKey: null,
      oldestMonthKey: null,
      hasData: false,
      totalTransactions: 0,
    };
  }

  // 3. If user has transactions but financial_start_date was not set, backfill it
  const earliestTxDate = txs[txs.length - 1]?.transaction_date;
  if (!financialStartDate && earliestTxDate) {
    financialStartDate = earliestTxDate;
    await supabase
      .from('profiles')
      .update({ financial_start_date: financialStartDate })
      .eq('id', userId);
  }

  const financialStartMonthKey = financialStartDate
    ? financialStartDate.substring(0, 7)
    : null;

  // 4. Count transactions per month and filter out months before financial_start_date
  const monthCountMap = new Map<string, number>();
  for (const t of txs) {
    if (typeof t.transaction_date !== 'string') continue;
    const mKey = t.transaction_date.substring(0, 7); // 'YYYY-MM'

    // Strict rule: do not include months before financial_start_date
    if (financialStartMonthKey && mKey < financialStartMonthKey) {
      continue;
    }

    monthCountMap.set(mKey, (monthCountMap.get(mKey) || 0) + 1);
  }

  // Sort months newest first (e.g. ['2027-01', '2026-12', '2026-10'])
  const sortedKeys = Array.from(monthCountMap.keys()).sort().reverse();

  const availableMonths: EligibleMonthItem[] = sortedKeys.map((key) => {
    const [yStr, mStr] = key.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const monthIdx = month - 1;
    const { startDate, endDate } = getMonthDateRange(year, monthIdx);

    return {
      key,
      year,
      month,
      labelUz: `${MONTH_NAMES_UZ_FULL[monthIdx]} ${year}`,
      shortLabelUz: `${MONTH_NAMES_UZ_SHORT[monthIdx]} ${year}`,
      startDate,
      endDate,
      transactionCount: monthCountMap.get(key) || 0,
    };
  });

  return {
    financialStartDate,
    availableMonths,
    availableMonthKeys: sortedKeys,
    latestMonthKey: sortedKeys[0] || null,
    oldestMonthKey: sortedKeys[sortedKeys.length - 1] || null,
    hasData: availableMonths.length > 0,
    totalTransactions: txs.length,
  };
}
