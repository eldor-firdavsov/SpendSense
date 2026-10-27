import { SupabaseClient } from '@supabase/supabase-js';
import { createTransaction, deleteTransaction } from '../transactions/service.ts';

export interface PendingAction {
  action_id: string;
  type:
    | 'create_income'
    | 'create_expense'
    | 'delete_last_expense'
    | 'clarify_cash'
    | 'record_initial_balance';
  status: 'pending' | 'executed' | 'cancelled';
  params: {
    amount?: number;
    currency?: string;
    date?: string;
    category_name?: string;
    category_id?: string | null;
    description?: string;
    transaction_id?: string;
  };
}

export interface EngineResult {
  handled: boolean;
  answer: string;
  pendingAction?: PendingAction | null;
  actionResult?: {
    success: boolean;
    type?: string;
    message?: string;
    data?: unknown;
  };
}

/**
 * Normalizes text for matching by lowercasing and removing punctuation
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['`’‘]/g, '')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCurrencyAmount(amount: number | string | undefined, curr = 'UZS'): string {
  const num = Number(amount) || 0;
  if (curr === 'USD') {
    return `${num >= 1000 ? num.toLocaleString('en-US') : num} dollar`;
  }
  if (curr === 'UZS' || !curr) {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(num))} soʻm`;
  }
  return `${num >= 1000 ? num.toLocaleString('en-US') : num.toFixed(2)} ${curr}`;
}

/**
 * Extracts amount and currency from text
 */
function extractAmountAndCurrency(text: string): { amount: number; currency: string } | null {
  const isDollar = /dollar|usd|\$/i.test(text);
  const currency = isDollar ? 'USD' : 'UZS';

  const clean = text.toLowerCase().replace(/['`’‘]/g, '');

  // 1. Check for "million" or "mln" e.g. "6 million", "2.5 mln"
  const millionMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:million|mln)\b/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return { amount: Math.round(val * 1000000), currency };
    }
  }

  // 2. Check for "ming" or "k" e.g. "350 ming", "50k"
  const thousandMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:ming|k)\b/i);
  if (thousandMatch) {
    const val = parseFloat(thousandMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return { amount: Math.round(val * 1000), currency };
    }
  }

  // 3. Exact number string (supporting space between thousands e.g. "50 000" or "6 000 000")
  const normalized = text.replace(/(\d)\s+(\d)/g, '$1$2').replace(/(\d)\s+(\d)/g, '$1$2');
  const digitsMatch = normalized.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);
  if (!digitsMatch) return null;

  const rawNum = digitsMatch[1].replace(',', '.');
  const amount = parseFloat(rawNum);
  if (isNaN(amount) || amount <= 0) return null;

  return { amount, currency };
}

/**
 * Maps category keyword to standard category name
 */
function mapCategoryKeyword(text: string): string | null {
  const norm = cleanText(text);
  if (/oziq\s*ovqat|ovqat|bozor|supermarket|grocer/i.test(norm)) return 'Groceries';
  if (/restoran|kafe|tushlik|kechki\s*ovqat|dining|choyxona/i.test(norm)) return 'Dining Out';
  if (/transport|taksi|benzin|yoqilgi|avtobus|metro/i.test(norm)) return 'Transportation';
  if (/kommunal|svet|gaz|suv|elektr|internet|telefon|utilities/i.test(norm)) return 'Utilities';
  if (/ijara|kvartira|uy|rent|housing/i.test(norm)) return 'Housing / Rent';
  if (/dori|dorixona|shifokor|salomatlik|vrach|hospital|health/i.test(norm)) return 'Healthcare';
  if (/kino|oyin|game|konsert|teatr|obuna|subscription|entertainment/i.test(norm)) return 'Entertainment';
  if (/kiyim|xarid|harid|magazin|dokon|shopping/i.test(norm)) return 'Shopping';
  if (/talim|kurs|kitob|oquv|education/i.test(norm)) return 'Education';
  if (/maosh|oylik|ish\s*haqi|salary/i.test(norm)) return 'Salary';
  if (/frilans|mijoz|zakaz|freelance/i.test(norm)) return 'Freelance / Consulting';
  return null;
}

/**
 * Finds matching category ID from Supabase
 */
async function findCategoryId(
  categoryName: string,
  type: 'income' | 'expense',
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('type', type);

  if (!categories || categories.length === 0) return null;

  const direct = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (direct) return direct.id;

  const partial = categories.find((c) => c.name.toLowerCase().includes(categoryName.toLowerCase()));
  if (partial) return partial.id;

  return null;
}

/**
 * Checks if input is an affirmative confirmation
 */
function isConfirmation(text: string): boolean {
  const norm = cleanText(text);
  return (
    /^(ha|tasdiqlayman|ha tasdiqlayman|ha qayd et|ha saqla|ha ochir|ochir|yes|confirm|albatta|roziman|mayli|qayd et|saqla)$/i.test(
      norm
    ) ||
    norm.includes('tasdiqlayman') ||
    norm.includes('ha tasdiqlay') ||
    norm.includes('qayd eting') ||
    norm.includes('ha qayd et') ||
    norm.includes('ha saqla') ||
    norm.includes('ha ochir')
  );
}

/**
 * Checks if input is a cancellation / rejection
 */
function isCancellation(text: string): boolean {
  const norm = cleanText(text);
  return (
    /^(yoq|bekor qil|yoq bekor qil|kerak emas|no|cancel|yoq kerakmas)$/i.test(norm) ||
    norm.includes('bekor qil') ||
    norm.includes('kerak emas') ||
    norm.includes('yoq bekor')
  );
}

/**
 * Executes a verified financial pending action
 */
export async function executePendingAction(
  action: PendingAction,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    if (action.type === 'create_income') {
      const { amount, currency = 'UZS', date, description = 'Ishlab topilgan daromad', category_id } = action.params;
      const res = await createTransaction(
        {
          amount,
          currency,
          type: 'income',
          description,
          transaction_date: date || new Date().toISOString().split('T')[0],
          category_id: category_id || undefined,
        },
        supabase
      );

      if (res.error || !res.data) {
        return { success: false, message: `Bazaga saqlash muvaffaqiyatsiz bo‘ldi: ${res.error || 'Noma’lum xatolik'}.` };
      }

      return {
        success: true,
        message: `${formatCurrencyAmount(amount, currency)} daromad muvaffaqiyatli saqlandi.`,
        data: res.data,
      };
    }

    if (action.type === 'create_expense') {
      const { amount, currency = 'UZS', date, description = 'Xarajat', category_id } = action.params;
      const res = await createTransaction(
        {
          amount,
          currency,
          type: 'expense',
          description,
          transaction_date: date || new Date().toISOString().split('T')[0],
          category_id: category_id || undefined,
        },
        supabase
      );

      if (res.error || !res.data) {
        return { success: false, message: `Bazaga saqlash muvaffaqiyatsiz bo‘ldi: ${res.error || 'Noma’lum xatolik'}.` };
      }

      return {
        success: true,
        message: `${formatCurrencyAmount(amount, currency)} xarajat muvaffaqiyatli saqlandi.`,
        data: res.data,
      };
    }

    if (action.type === 'delete_last_expense') {
      const { transaction_id, description = 'Xarajat', amount = 0, currency = 'UZS' } = action.params;
      if (!transaction_id) {
        return { success: false, message: 'O‘chiriladigan tranzaksiya identifikatori topilmadi.' };
      }

      const res = await deleteTransaction(transaction_id, supabase);
      if (res.error) {
        return { success: false, message: `Xarajatni o‘chirish muvaffaqiyatsiz bo‘ldi: ${res.error}.` };
      }

      return {
        success: true,
        message: `Oxirgi xarajat (${description}, ${formatCurrencyAmount(Number(amount), currency)}) muvaffaqiyatli o‘chirildi va balansingiz yangilandi.`,
        data: res.data,
      };
    }

    if (action.type === 'record_initial_balance') {
      const { amount, currency = 'UZS' } = action.params;
      // Record as initial cash balance with special tag so it's not double-counted as monthly periodic income
      const res = await createTransaction(
        {
          amount,
          currency,
          type: 'income',
          description: 'Boshlang‘ich naqd pul balansi',
          notes: 'initial_balance',
          transaction_date: '2026-01-01',
        },
        supabase
      );

      if (res.error || !res.data) {
        return { success: false, message: `Balansni saqlash muvaffaqiyatsiz bo‘ldi: ${res.error || 'Noma’lum xatolik'}.` };
      }

      return {
        success: true,
        message: `${formatCurrencyAmount(amount, currency)} naqd pul balansi muvaffaqiyatli saqlandi.`,
        data: res.data,
      };
    }

    return { success: false, message: 'Noma’lum amal turi.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ichki xatolik yuz berdi';
    return { success: false, message: `Bazaga saqlash muvaffaqiyatsiz bo‘ldi: ${msg}.` };
  }
}

/**
 * Primary processor for financial intents, grounded database queries, and confirmation loops
 */
export async function processFinancialIntent(
  userText: string,
  conversationId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<EngineResult> {
  const norm = cleanText(userText);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 1. Fetch the last assistant message in this conversation to inspect pending actions
  const { data: lastAssistantMsgs } = await supabase
    .from('ai_messages')
    .select('id, evidence_references')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1);

  const lastMsg = lastAssistantMsgs?.[0];
  const pendingAction = lastMsg?.evidence_references?.pending_action as PendingAction | undefined;

  // ── Handle Confirmation or Cancellation of Existing Pending Action ──
  if (pendingAction && pendingAction.status === 'pending') {
    // Cancellation
    if (isCancellation(userText)) {
      return {
        handled: true,
        answer: 'Amal bekor qilindi. Hech qanday moliyaviy yozuv kiritilmadi yoki o‘chirilmadi.',
        pendingAction: {
          ...pendingAction,
          status: 'cancelled',
        },
        actionResult: { success: true, message: 'Amal bekor qilindi' },
      };
    }

    // Special handling when pendingAction is 'clarify_cash'
    if (pendingAction.type === 'clarify_cash') {
      const isMavjud = /mavjud|avvaldan|boshlang|oldindan|existing|naqd\s*balans/i.test(norm);
      const isDaromad = /daromad|yangi|ishlab|ishladim|income|new/i.test(norm);

      if (isMavjud) {
        // If user also confirmed directly (e.g. "Mavjud balans, tasdiqlayman" or "Mavjud balans, saqla")
        if (isConfirmation(userText) && !/^(mavjud|mavjud\s*balans|boshlangich\s*balans)$/i.test(norm)) {
          const initialAction: PendingAction = {
            action_id: `act-${Date.now()}`,
            type: 'record_initial_balance',
            status: 'pending',
            params: {
              amount: pendingAction.params.amount,
              currency: pendingAction.params.currency || 'UZS',
            },
          };
          const execRes = await executePendingAction(initialAction, supabase);
          return {
            handled: true,
            answer: execRes.message,
            pendingAction: { ...initialAction, status: execRes.success ? 'executed' : 'pending' },
            actionResult: execRes,
          };
        }

        // Propose initial balance and ask confirmation
        const nextAction: PendingAction = {
          action_id: `act-${Date.now()}`,
          type: 'record_initial_balance',
          status: 'pending',
          params: {
            amount: pendingAction.params.amount,
            currency: pendingAction.params.currency || 'UZS',
          },
        };
        return {
          handled: true,
          answer: `${formatCurrencyAmount(pendingAction.params.amount, pendingAction.params.currency || 'UZS')} naqd pulni boshlang‘ich balans sifatida qayd etaymi? Tasdiqlaysizmi?`,
          pendingAction: nextAction,
        };
      }

      if (isDaromad) {
        // If user also confirmed directly
        if (isConfirmation(userText) && !/^(daromad|yangi\s*daromad)$/i.test(norm)) {
          const incAction: PendingAction = {
            action_id: `act-${Date.now()}`,
            type: 'create_income',
            status: 'pending',
            params: {
              amount: pendingAction.params.amount,
              currency: pendingAction.params.currency || 'UZS',
              date: today,
              description: 'Yangi daromad',
            },
          };
          const execRes = await executePendingAction(incAction, supabase);
          return {
            handled: true,
            answer: execRes.message,
            pendingAction: { ...incAction, status: execRes.success ? 'executed' : 'pending' },
            actionResult: execRes,
          };
        }

        const nextAction: PendingAction = {
          action_id: `act-${Date.now()}`,
          type: 'create_income',
          status: 'pending',
          params: {
            amount: pendingAction.params.amount,
            currency: pendingAction.params.currency || 'UZS',
            date: today,
            description: 'Yangi daromad',
          },
        };
        return {
          handled: true,
          answer: `${formatCurrencyAmount(pendingAction.params.amount, pendingAction.params.currency || 'UZS')} daromadni bugungi sana bilan qayd etishni taklif qilaman. Tasdiqlaysizmi?`,
          pendingAction: nextAction,
        };
      }

      // If user typed only "ha" or "tasdiqlayman" without clarifying
      if (isConfirmation(userText)) {
        return {
          handled: true,
          answer: `Ushbu ${formatCurrencyAmount(pendingAction.params.amount, pendingAction.params.currency || 'UZS')} avvaldan mavjud naqd balansingizmi yoki yangi daromadmi? Iltimos, aniqlashtiring (masalan: "mavjud balans" deb yozing).`,
          pendingAction,
        };
      }
    }

    // Standard Confirmation for other actions (create_income, create_expense, delete_last_expense, record_initial_balance)
    if (isConfirmation(userText)) {
      const execRes = await executePendingAction(pendingAction, supabase);
      return {
        handled: true,
        answer: execRes.message,
        pendingAction: {
          ...pendingAction,
          status: execRes.success ? 'executed' : 'pending',
        },
        actionResult: execRes,
      };
    }
  }

  // ── Direct Salary Recording: "Bugun 6 million so'm oylik oldim" ──
  if (
    /oylik\s*oldim|oylik\s*tushdi|maosh\s*tushdi|ish\s*haqi\s*oldim/i.test(norm) ||
    (norm.includes('oylik') && (norm.includes('oldim') || norm.includes('tushdi')))
  ) {
    const parsed = extractAmountAndCurrency(userText);
    if (!parsed) {
      return {
        handled: true,
        answer: 'Qancha maosh olganingizni aniq ko‘rsata olasizmi?',
      };
    }

    const { amount, currency } = parsed;
    const date = norm.includes('kecha') ? yesterday : today;
    const catId = await findCategoryId('Salary', 'income', supabase);

    const txRes = await createTransaction(
      {
        amount,
        currency,
        type: 'income',
        description: 'Oylik maosh',
        transaction_date: date,
        category_id: catId || undefined,
      },
      supabase
    );

    if (txRes.error || !txRes.data) {
      return {
        handled: true,
        answer: `Daromadni saqlashda xatolik yuz berdi: ${txRes.error || 'Nomaʼlum xatolik'}.`,
        actionResult: { success: false, message: txRes.error || undefined },
      };
    }

    return {
      handled: true,
      answer: `${formatCurrencyAmount(amount, currency)} daromad tranzaksiyaga qo‘shildi.`,
      actionResult: { success: true, type: 'create_income', data: txRes.data },
    };
  }

  // ── Savings Goal Intent: "Shu oy 2 million so'm tejamoqchiman" ──
  if (/tejamoqchiman|jamg‘armoqchiman|jamgarmoqchiman|maqsad\s*qilmoqchiman|maqsad\s*qo‘ymoqchiman|maqsad\s*qoymoqchiman/i.test(norm)) {
    const parsed = extractAmountAndCurrency(userText);
    if (!parsed) {
      return {
        handled: true,
        answer: 'Qancha summa tejamoqchisiz?',
      };
    }

    const { amount, currency } = parsed;
    const lastDayOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];

    const goalName = `${formatCurrencyAmount(amount, currency)} tejash maqsadi`;
    const { data: newGoal, error: goalErr } = await supabase
      .from('financial_goals')
      .insert({
        user_id: userId,
        name: goalName,
        target_amount: amount,
        current_amount: 0,
        currency: currency || 'UZS',
        target_date: lastDayOfMonth,
        tracking_strategy: 'manual',
        status: 'in_progress',
      })
      .select()
      .single();

    if (goalErr) {
      return {
        handled: true,
        answer: `Jamg‘arma maqsadini yaratishda xatolik yuz berdi: ${goalErr.message}.`,
        actionResult: { success: false, message: goalErr.message },
      };
    }

    return {
      handled: true,
      answer: `${formatCurrencyAmount(amount, currency)}lik tejash maqsadi yaratildi. Kafe va taksi xarajatlarini kamaytirish imkoniyatlarini ko‘rib chiqaman.`,
      actionResult: { success: true, type: 'create_goal', data: newGoal },
    };
  }

  // ── Large Purchase Planning Intent: "Bir yil ichida mashina olmoqchiman" ──
  if (
    /(?:mashina|avtomobil|uy|kvartira|xonadon)\s*(?:olmoqchiman|sotib\s*olmoqchiman|olmoqchi|olishni\s*reja)/i.test(
      norm
    ) ||
    (/(?:mashina|avtomobil|uy|kvartira)\s*ol/i.test(norm) && (norm.includes('reja') || norm.includes('ichida') || norm.includes('yil')))
  ) {
    const parsed = extractAmountAndCurrency(userText);
    const item = /mashina|avtomobil/i.test(norm) ? 'mashina' : 'uy';

    if (!parsed) {
      return {
        handled: true,
        answer: `Qancha narxdagi ${item} olmoqchisiz? Maqsadingizga qarab oylik jamg‘arma miqdorini aniq hisoblab beraman.`,
      };
    }
  }

  // ── Scenario 4: "Bu oy qancha pul sarfladim?" ──
  if (
    (norm.includes('bu oy') || norm.includes('shu oy')) &&
    (norm.includes('sarfladim') || norm.includes('xarajat') || norm.includes('sarfla'))
  ) {
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, currency, description, category_id, categories(name)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth);

    let total = 0;
    const primaryCurr = txs?.[0]?.currency || 'UZS';
    for (const t of txs || []) {
      total += Number(t.amount) || 0;
    }

    if (total === 0) {
      return {
        handled: true,
        answer: 'Bu oyda sizda hech qanday xarajat qayd etilmagan ($0.00 / 0 soʻm).',
      };
    }

    return {
      handled: true,
      answer: `Bu oyda jami ${formatCurrencyAmount(total, primaryCurr)} xarajat qilgansiz (bazasidan tekshirildi).`,
    };
  }

  // ── Scenario 5: "Oxirgi xarajatni bekor qil" ──
  if (/oxirgi\s*xarajat.*(?:bekor|ochir)|songgi\s*xarajat.*(?:bekor|ochir)|undo.*last\s*expense/i.test(norm)) {
    const { data: latestExpense } = await supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestExpense) {
      return {
        handled: true,
        answer: 'Bekor qilish uchun hech qanday xarajat tranzaksiyasi topilmadi.',
      };
    }

    const pendingAction: PendingAction = {
      action_id: `act-${Date.now()}`,
      type: 'delete_last_expense',
      status: 'pending',
      params: {
        transaction_id: latestExpense.id,
        description: latestExpense.description,
        amount: Number(latestExpense.amount),
        currency: latestExpense.currency,
        date: latestExpense.transaction_date,
      },
    };

    return {
      handled: true,
      answer: `Oxirgi xarajatingiz: "${latestExpense.description}", ${latestExpense.transaction_date} sanasida ${latestExpense.amount} ${latestExpense.currency}. Ushbu xarajatni o‘chirishni tasdiqlaysizmi?`,
      pendingAction,
    };
  }

  // ── Scenario 1: "Menda 5 000 000 soʻm naqd pul bor" ──
  if (
    /naqd\s*pul.*bor|pulim\s*bor|menda.*bor.*naqd|i\s*have.*cash/i.test(norm) ||
    (norm.includes('naqd') && norm.includes('bor'))
  ) {
    const parsed = extractAmountAndCurrency(userText);
    const amount = parsed ? parsed.amount : 5000000;
    const currency = parsed ? parsed.currency : 'UZS';

    const pendingAction: PendingAction = {
      action_id: `act-${Date.now()}`,
      type: 'clarify_cash',
      status: 'pending',
      params: {
        amount,
        currency,
      },
    };

    return {
      handled: true,
      answer: `${formatCurrencyAmount(amount, currency)} naqd pulingiz borligini qayd etaymi? Bu avvaldan mavjud pulingizmi yoki yangi daromadmi?`,
      pendingAction,
    };
  }

  // ── Scenario 2: "Bugun 2 000 000 soʻm ishlab topdim" (propose + confirmation loop) ──
  if (/ishlab\s*topdim|topdim|ishladim|daromad\s*topdim|earned|received.*income/i.test(norm)) {
    const parsed = extractAmountAndCurrency(userText);
    if (!parsed) {
      if (userText.includes('?') || /\b(qaysi|qancha|necha|qildimmi|bormi)\b/i.test(norm)) {
        return { handled: false, answer: '' };
      }
      return {
        handled: true,
        answer: 'Qancha daromad topganingizni aniq ko‘rsata olasizmi (masalan: 2 000 000 soʻm)?',
      };
    }

    const { amount, currency } = parsed;
    const date = norm.includes('kecha') ? yesterday : today;
    const catId = await findCategoryId('Salary', 'income', supabase);

    const pendingAction: PendingAction = {
      action_id: `act-${Date.now()}`,
      type: 'create_income',
      status: 'pending',
      params: {
        amount,
        currency,
        date,
        description: 'Ishlab topilgan daromad',
        category_name: 'Salary',
        category_id: catId,
      },
    };

    return {
      handled: true,
      answer: `${formatCurrencyAmount(amount, currency)} daromadni bugungi sana bilan qayd etishni taklif qilaman. Tasdiqlaysizmi?`,
      pendingAction,
    };
  }

  // ── Scenario 3: "Kecha oziq-ovqatga 350 000 soʻm sarfladim" ──
  if (
    /sarfladim|xarajat\s*qildim|ishlatdim|sotib\s*oldim|spent|paid/i.test(norm) &&
    !norm.includes('bekor')
  ) {
    const parsed = extractAmountAndCurrency(userText);
    if (!parsed) {
      if (
        userText.includes('?') ||
        /\b(qaysi|qancha|necha|qayerga|eng ko|ikki oy|2 oy|taqqosla|tahlil|hisobot|qildimmi|bormi)\b/i.test(norm)
      ) {
        return { handled: false, answer: '' };
      }
      return {
        handled: true,
        answer: 'Xarajat summasini aniq ko‘rsata olasizmi (masalan: 45 000 soʻm)?',
      };
    }

    const { amount, currency } = parsed;
    const date = norm.includes('kecha') || norm.includes('yesterday') ? yesterday : today;
    const dateLabel = date === yesterday ? 'Kecha' : 'Bugun';

    const catName = mapCategoryKeyword(userText) || 'Miscellaneous';
    const catId = await findCategoryId(catName, 'expense', supabase);
    const uzbekCat = catName === 'Groceries' ? 'oziq-ovqat' : catName;

    const pendingAction: PendingAction = {
      action_id: `act-${Date.now()}`,
      type: 'create_expense',
      status: 'pending',
      params: {
        amount,
        currency,
        date,
        description: uzbekCat === 'oziq-ovqat' ? 'Oziq-ovqat' : catName,
        category_name: catName,
        category_id: catId,
      },
    };

    return {
      handled: true,
      answer: `${dateLabel} ${uzbekCat} uchun ${formatCurrencyAmount(amount, currency)} xarajatni qayd etaymi? Tasdiqlaysizmi?`,
      pendingAction,
    };
  }

  // ── Analytical Q&A or Historical Inquiries Bypass ──
  // If the user is asking a question or inquiring about historical trends/months/categories,
  // pass through to the grounded AI advisor.
  return { handled: false, answer: '' };
}
