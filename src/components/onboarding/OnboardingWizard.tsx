'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  TrendingUp,
  Target,
  Home,
  Car,
  Laptop,
  Plane,
  GraduationCap,
  ShieldCheck,
  Briefcase,
  Loader2,
  AlertCircle,
  HelpCircle,
  Edit2,
} from 'lucide-react';
import CurrencyInput, { formatWithSpaces } from './CurrencyInput';
import { saveOnboardingStepAction, completeOnboardingAction } from '@/app/onboarding/actions';

interface GoalTemplate {
  key: string;
  defaultName: string;
  defaultAmount: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    key: 'home',
    defaultName: 'Uy sotib olish',
    defaultAmount: 250000000,
    icon: Home,
    description: 'Boshlang‘ich to‘lov yoki yangi xonadon uchun jamg‘arma',
  },
  {
    key: 'car',
    defaultName: 'Avtomobil olish',
    defaultAmount: 100000000,
    icon: Car,
    description: 'Yangi yoki oilaviy avtotransport vositasi uchun',
  },
  {
    key: 'tech',
    defaultName: 'Telefon yoki noutbuk',
    defaultAmount: 15000000,
    icon: Laptop,
    description: 'Ish, o‘qish yoki qulaylik uchun zamonaviy gadjet',
  },
  {
    key: 'travel',
    defaultName: 'Sayohat jamg‘armasi',
    defaultAmount: 20000000,
    icon: Plane,
    description: 'Oilaviy ta’til yoki yangi mamlakatlarni kashf etish',
  },
  {
    key: 'education',
    defaultName: 'Ta’lim va kurslar',
    defaultAmount: 12000000,
    icon: GraduationCap,
    description: 'Kasbiy rivojlanish, chet tili yoki oliygoh to‘lovi',
  },
  {
    key: 'emergency',
    defaultName: 'Favqulodda zaxira jamg‘armasi',
    defaultAmount: 15000000,
    icon: ShieldCheck,
    description: '3–6 oylik xarajatlar uchun moliyaviy xavfsizlik yostig‘i',
  },
  {
    key: 'business',
    defaultName: 'Biznes boshlash',
    defaultAmount: 50000000,
    icon: Briefcase,
    description: 'Yangi daromad manbai va shaxsiy loyihalar sarmoyasi',
  },
  {
    key: 'other',
    defaultName: 'Boshqa shaxsiy maqsad',
    defaultAmount: 10000000,
    icon: Target,
    description: 'Siz uchun muhim bo‘lgan har qanday maxsus maqsad',
  },
];

interface ConfiguredGoal {
  key: string;
  name: string;
  target_amount: number;
  target_date?: string | null;
}

interface OnboardingWizardProps {
  initialFirstName?: string;
  initialLastName?: string;
  initialStep?: number;
  initialData?: Record<string, unknown> | null;
}

export default function OnboardingWizard({
  initialFirstName = '',
  initialLastName = '',
  initialStep = 0,
  initialData = null,
}: OnboardingWizardProps) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<number>(initialStep);
  const [firstName, setFirstName] = useState<string>(
    (initialData?.first_name as string) || initialFirstName || ''
  );
  const [lastName, setLastName] = useState<string>(
    (initialData?.last_name as string) || initialLastName || ''
  );
  const [monthlyIncome, setMonthlyIncome] = useState<number>(
    Number(initialData?.declared_monthly_income) || 0
  );
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(
    Number(initialData?.declared_monthly_expenses) || 0
  );

  // Reduction target state
  const [reductionChoice, setReductionChoice] = useState<'5' | '10' | '15' | '20' | 'custom'>(
    (initialData?.reduction_choice as '5' | '10' | '15' | '20' | 'custom') || '10'
  );
  const [customReductionPercent, setCustomReductionPercent] = useState<number>(
    Number(initialData?.custom_reduction_percent) || 10
  );

  // Goals state
  const [selectedGoalKeys, setSelectedGoalKeys] = useState<string[]>(
    (initialData?.selected_goal_keys as string[]) || []
  );
  const [configuredGoals, setConfiguredGoals] = useState<Record<string, ConfiguredGoal>>(
    (initialData?.configured_goals as Record<string, ConfiguredGoal>) || {}
  );
  const [isConfiguringGoals, setIsConfiguringGoals] = useState<boolean>(false);
  const [activeConfigGoalKey, setActiveConfigGoalKey] = useState<string>('');

  // Status state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Calculate actual reduction percentage and resulting amounts
  const reductionPercent =
    reductionChoice === 'custom'
      ? Math.min(100, Math.max(0, customReductionPercent))
      : parseInt(reductionChoice, 10) || 0;

  const potentialMonthlySavings = Math.round((monthlyExpenses * reductionPercent) / 100);
  const targetMonthlyExpenses = Math.max(0, monthlyExpenses - potentialMonthlySavings);

  // Active goal being configured in Step 5 parameter view
  const currentConfigKey =
    activeConfigGoalKey && selectedGoalKeys.includes(activeConfigGoalKey)
      ? activeConfigGoalKey
      : selectedGoalKeys[0] || '';
  const currentConfigGoal = currentConfigKey
    ? configuredGoals[currentConfigKey] || {
        key: currentConfigKey,
        name:
          GOAL_TEMPLATES.find((t) => t.key === currentConfigKey)?.defaultName ||
          'Jamg‘arma maqsadi',
        target_amount:
          GOAL_TEMPLATES.find((t) => t.key === currentConfigKey)?.defaultAmount || 10000000,
        target_date: null,
      }
    : null;
  const currentGoalIndex = selectedGoalKeys.indexOf(currentConfigKey);
  const isLastConfigGoal =
    currentGoalIndex === selectedGoalKeys.length - 1 || currentGoalIndex === -1;

  // 1-Year Projected Results & Metrics
  const monthlyNetSurplus = Math.max(0, monthlyIncome - targetMonthlyExpenses);
  const annualSavingsPotential = monthlyNetSurplus * 12;
  const annualExpenseSavings = potentialMonthlySavings * 12;
  const projectedAnnualTotal =
    annualSavingsPotential > 0 ? annualSavingsPotential : annualExpenseSavings;

  const totalGoalsTargetAmount = selectedGoalKeys.reduce((acc, k) => {
    return acc + (configuredGoals[k]?.target_amount || 0);
  }, 0);

  const annualGoalCoveragePercent =
    totalGoalsTargetAmount > 0
      ? Math.min(100, Math.round((projectedAnnualTotal / totalGoalsTargetAmount) * 100))
      : 0;

  // Auto-sync draft state on step transition
  const persistDraft = async (nextStep: number) => {
    try {
      const draftPayload = {
        first_name: firstName,
        last_name: lastName,
        declared_monthly_income: monthlyIncome,
        declared_monthly_expenses: monthlyExpenses,
        reduction_choice: reductionChoice,
        custom_reduction_percent: customReductionPercent,
        target_expense_reduction_percent: reductionPercent,
        target_monthly_expenses: targetMonthlyExpenses,
        selected_goal_keys: selectedGoalKeys,
        configured_goals: configuredGoals,
      };
      await saveOnboardingStepAction(nextStep, draftPayload);
    } catch {
      // Background draft save failure should not block user progression
    }
  };

  // Step 1 Validation
  const handleNextFromStep1 = () => {
    setStepError(null);
    if (!firstName.trim()) {
      setStepError('Iltimos, ismingizni kiriting');
      return;
    }
    if (!lastName.trim()) {
      setStepError('Iltimos, familiyangizni kiriting');
      return;
    }
    const next = 2;
    setStep(next);
    persistDraft(next);
  };

  // Step 2 Validation (Income)
  const handleNextFromStep2 = () => {
    setStepError(null);
    const next = 3;
    setStep(next);
    persistDraft(next);
  };

  // Step 3 Validation (Spending)
  const handleNextFromStep3 = () => {
    setStepError(null);
    const next = 4;
    setStep(next);
    persistDraft(next);
  };

  // Step 4 Validation (Reduction)
  const handleNextFromStep4 = () => {
    setStepError(null);
    const next = 5;
    setStep(next);
    persistDraft(next);
  };

  // Step 5 Validation & Handlers (Goals)
  const toggleGoalSelection = (tpl: GoalTemplate) => {
    const isSelected = selectedGoalKeys.includes(tpl.key);
    if (isSelected) {
      setSelectedGoalKeys((prev) => prev.filter((k) => k !== tpl.key));
    } else {
      setSelectedGoalKeys((prev) => [...prev, tpl.key]);
      if (!configuredGoals[tpl.key]) {
        setConfiguredGoals((prev) => ({
          ...prev,
          [tpl.key]: {
            key: tpl.key,
            name: tpl.defaultName,
            target_amount: tpl.defaultAmount,
            target_date: null,
          },
        }));
      }
    }
  };

  const updateGoalField = (key: string, updates: Partial<ConfiguredGoal>) => {
    setConfiguredGoals((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates,
      },
    }));
  };

  const handleNextFromStep5 = () => {
    setStepError(null);
    // If user has selected goals and is on selection view, advance to parameter adjustment
    if (selectedGoalKeys.length > 0 && !isConfiguringGoals) {
      // Ensure all selected goals have configured state initialized
      setConfiguredGoals((prev) => {
        const nextCfg = { ...prev };
        selectedGoalKeys.forEach((k) => {
          if (!nextCfg[k]) {
            const tpl = GOAL_TEMPLATES.find((t) => t.key === k);
            nextCfg[k] = {
              key: k,
              name: tpl?.defaultName || 'Jamg‘arma maqsadi',
              target_amount: tpl?.defaultAmount || 10000000,
              target_date: null,
            };
          }
        });
        return nextCfg;
      });
      setActiveConfigGoalKey(selectedGoalKeys[0]);
      setIsConfiguringGoals(true);
      return;
    }

    // Advance to Step 6
    const next = 6;
    setStep(next);
    setIsConfiguringGoals(false);
    persistDraft(next);
  };

  // Step 6 Final Submission
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setStepError(null);

    const goalsToCommit = selectedGoalKeys
      .map((k) => configuredGoals[k])
      .filter((g) => Boolean(g && g.name && g.target_amount > 0));

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      declared_monthly_income: monthlyIncome,
      declared_monthly_expenses: monthlyExpenses,
      target_expense_reduction_percent: reductionPercent,
      target_monthly_expenses: targetMonthlyExpenses,
      goals: goalsToCommit,
    };

    const result = await completeOnboardingAction(payload);
    if (!result.success) {
      setStepError(result.error || 'Ma’lumotlarni saqlashda xatolik yuz berdi');
      setIsSubmitting(false);
      return;
    }

    // Success: seamlessly navigate to empty dashboard
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Main Screen Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DCE4DE] p-4 sm:p-7 shadow-fintech-card relative overflow-hidden transition-all duration-300">
        {/* Compact Integrated Step Progress (Steps 1 to 6) */}
        {step > 0 && (
          <div className="mb-4 sm:mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5A675F] mb-1.5">
              <span>Qadam {step} / 6</span>
              <span className="text-[#176B45] font-mono">{Math.round((step / 6) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-[#E5EBE6] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#176B45] to-[#218653] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.round((step / 6) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {stepError && (
          <div
            id="onboarding-error-banner"
            className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-xs flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {/* =========================================================================
            SCREEN 0: WELCOME
           ========================================================================= */}
        {step === 0 && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            {/* Visual Emblem */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-[#176B45] via-[#218653] to-[#0E442B] flex items-center justify-center text-white shadow-fintech-elevated">
                  <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-[#9EE5B8]" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#10B981] border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                  ✓
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="text-center space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17211B]">
                Moliyaviy nazoratni qo‘lga oling.
              </h1>
              <p className="text-xs sm:text-sm text-[#47544C] max-w-md mx-auto leading-relaxed">
                SpendSense AI sizga daromad va xarajatlaringizni tushunish, budjet tuzish va moliyaviy maqsadlaringizga erishishda yordam beradi.
              </p>
            </div>

            {/* Fintech Value Highlights */}
            <div className="grid grid-cols-1 gap-2 sm:gap-2.5 pt-0.5">
              <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#F7F9F7] border border-[#D5DED7]">
                <div className="h-8 w-8 rounded-lg bg-[#DDF3E5] text-[#176B45] flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs sm:text-sm font-semibold text-[#17211B]">Aniq pul oqimi va hisob-kitob</div>
                  <div className="text-[11px] sm:text-xs text-[#47544C] truncate">Daromad va xarajatlaringiz doimo aniq va nazorat ostida</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#F7F9F7] border border-[#D5DED7]">
                <div className="h-8 w-8 rounded-lg bg-[#E0E7FF] text-[#4B75E8] flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs sm:text-sm font-semibold text-[#17211B]">Maqsadli jamg‘arma rejalari</div>
                  <div className="text-[11px] sm:text-xs text-[#47544C] truncate">Uy, avtomobil yoki orzuingizdagi xaridlar uchun maqsadlar</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#F7F9F7] border border-[#D5DED7]">
                <div className="h-8 w-8 rounded-lg bg-[#F3E8FF] text-[#8664D8] flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs sm:text-sm font-semibold text-[#17211B]">Shaxsiy AI moliyaviy maslahatchi</div>
                  <div className="text-[11px] sm:text-xs text-[#47544C] truncate">Mablag‘ingizni optimallashtirish bo‘yicha aniq tavsiyalar</div>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="space-y-2 pt-1">
              <button
                id="onboarding-welcome-start-btn"
                type="button"
                onClick={() => {
                  setStep(1);
                  persistDraft(1);
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white font-semibold text-sm sm:text-base transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Boshlash</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-xs text-[#5A675F]">
                Bu bir necha daqiqa vaqt oladi.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 1: PERSONAL INFORMATION
           ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Avval tanishib olaylik.
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Ism va familiyangizni kiriting.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label htmlFor="first_name" className="block text-xs font-semibold uppercase tracking-wider text-[#47544C] mb-2">
                  Ism *
                </label>
                <input
                  id="first_name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ali"
                  className="w-full min-h-[48px] rounded-2xl border-2 border-[#D5DED7] bg-white px-4 py-3 text-base font-medium text-[#17211B] placeholder-[#8C9890] focus:border-[#176B45] focus:outline-none focus:ring-4 focus:ring-[#176B45]/15 transition-all"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-xs font-semibold uppercase tracking-wider text-[#47544C] mb-2">
                  Familiya *
                </label>
                <input
                  id="last_name"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Valiyev"
                  className="w-full min-h-[48px] rounded-2xl border-2 border-[#D5DED7] bg-white px-4 py-3 text-base font-medium text-[#17211B] placeholder-[#8C9890] focus:border-[#176B45] focus:outline-none focus:ring-4 focus:ring-[#176B45]/15 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step1-next-btn"
                type="button"
                onClick={handleNextFromStep1}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2: MONTHLY INCOME
           ========================================================================= */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Oylik daromadingiz qancha?
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Daromadingizni bilish moliyaviy rejangizni to‘g‘ri tuzishga yordam beradi.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <CurrencyInput
                id="onboarding-monthly-income-input"
                value={monthlyIncome}
                onChange={setMonthlyIncome}
                placeholder="6 000 000"
                autoFocus
              />

              <p className="text-sm sm:text-base text-[#47544C] flex items-start gap-2 leading-relaxed bg-[#F7F9F7] p-3.5 rounded-xl border border-[#D5DED7]">
                <HelpCircle className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                <span>
                  Bu ma’lumot rejalashtirish uchun ishlatiladi. Haqiqiy daromad sifatida tranzaksiyaga qo‘shilmaydi.
                </span>
              </p>

              {/* Quick Preset Pills */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-[#5A675F] uppercase tracking-wider">
                  Tezkor tanlov:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Hozircha 0 so‘m', val: 0 },
                    { label: '3 000 000 so‘m', val: 3000000 },
                    { label: '6 000 000 so‘m', val: 6000000 },
                    { label: '10 000 000 so‘m', val: 10000000 },
                    { label: '15 000 000 so‘m', val: 15000000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setMonthlyIncome(preset.val)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        monthlyIncome === preset.val
                          ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs'
                          : 'bg-white text-[#17211B] border-[#D5DED7] hover:bg-[#F7F9F7]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step2-next-btn"
                type="button"
                onClick={handleNextFromStep2}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3: CURRENT MONTHLY SPENDING
           ========================================================================= */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Bir oyda qancha mablag‘ sarflaysiz?
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Odatda bir oyda xarajatlaringiz uchun qancha pul ketadi?
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <CurrencyInput
                id="onboarding-monthly-expenses-input"
                value={monthlyExpenses}
                onChange={setMonthlyExpenses}
                placeholder="5 000 000"
                autoFocus
              />

              <p className="text-sm sm:text-base text-[#47544C] flex items-start gap-2 leading-relaxed bg-[#F7F9F7] p-3.5 rounded-xl border border-[#D5DED7]">
                <HelpCircle className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                <span>
                  Uy-joy, oziq-ovqat, transport va boshqa kundalik xarajatlaringizni hisobga oling. (0 kiritish mumkin).
                </span>
              </p>

              {/* Quick Preset Pills */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-[#5A675F] uppercase tracking-wider">
                  Tezkor tanlov:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '0 so‘m', val: 0 },
                    { label: '2 500 000 so‘m', val: 2500000 },
                    { label: '5 000 000 so‘m', val: 5000000 },
                    { label: '8 000 000 so‘m', val: 8000000 },
                    { label: '12 000 000 so‘m', val: 12000000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setMonthlyExpenses(preset.val)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        monthlyExpenses === preset.val
                          ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs'
                          : 'bg-white text-[#17211B] border-[#D5DED7] hover:bg-[#F7F9F7]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step3-next-btn"
                type="button"
                onClick={handleNextFromStep3}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 4: SPENDING REDUCTION TARGET
           ========================================================================= */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Xarajatlaringizni qanchaga kamaytirmoqchisiz?
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Kichik o‘zgarishlar ham katta natija berishi mumkin.
              </p>
            </div>

            {monthlyExpenses === 0 ? (
              <div className="p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#17211B]">
                  <HelpCircle className="h-4 w-4 text-[#176B45]" />
                  <span>Xarajat ko‘rsatilmagan (0 so‘m)</span>
                </div>
                <p className="text-sm sm:text-base text-[#47544C] leading-relaxed">
                  Oylik xarajat 0 so‘m bo‘lgani sababli, xarajatlarni qisqartirish rejasini keyinchalik hisobingizga tranzaksiyalar qo‘shganingizda belgilashingiz mumkin.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Current expense context */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7]">
                  <span className="text-xs sm:text-sm font-medium text-[#47544C]">Hozirgi oylik xarajatingiz:</span>
                  <span className="text-sm sm:text-base font-mono font-semibold tabular-nums text-[#17211B]">
                    {formatWithSpaces(monthlyExpenses)} so‘m
                  </span>
                </div>

                {/* Percentage options */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#47544C]">
                    Qisqartirish darajasini tanlang:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {(
                      [
                        { key: '5', label: '5%', recommended: false },
                        { key: '10', label: '10%', recommended: true },
                        { key: '15', label: '15%', recommended: false },
                        { key: '20', label: '20%', recommended: false },
                        { key: 'custom', label: 'O‘zim', recommended: false },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setReductionChoice(opt.key)}
                        className={`min-h-[52px] p-3 rounded-2xl border text-center transition-all ${
                          reductionChoice === opt.key
                            ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs font-semibold'
                            : 'bg-white text-[#17211B] border-[#D5DED7] hover:bg-[#F7F9F7] font-medium'
                        }`}
                      >
                        <div className="text-sm sm:text-base">{opt.label}</div>
                        {opt.recommended && (
                          <div className={`text-xs mt-0.5 font-semibold ${reductionChoice === opt.key ? 'text-[#9EE5B8]' : 'text-[#176B45]'}`}>
                            Tavsiya
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom percentage input if selected */}
                {reductionChoice === 'custom' && (
                  <div className="p-4 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-2">
                    <label htmlFor="custom-percent-input" className="block text-xs sm:text-sm font-medium text-[#17211B]">
                      Ixtiyoriy foizni kiriting (1% dan 50% gacha):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="custom-percent-input"
                        type="number"
                        min="1"
                        max="50"
                        value={customReductionPercent}
                        onChange={(e) => setCustomReductionPercent(Number(e.target.value) || 0)}
                        className="w-28 min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3 py-2 text-sm font-semibold font-mono tabular-nums text-[#17211B] focus:border-[#176B45] focus:outline-none"
                      />
                      <span className="text-sm font-semibold text-[#47544C]">%</span>
                    </div>
                  </div>
                )}

                {/* Clear, Spacious Calculation Summary Breakdown */}
                <div className="space-y-3 pt-1">
                  {/* Item 1: Target Monthly Expense */}
                  <div className="p-4 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[#17211B]">
                        Maqsadli oylik xarajat
                      </div>
                      <div className="text-xs text-[#5A675F] flex items-center gap-1.5 flex-wrap">
                        <span>Belgilangan maqsad:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#DDF3E5] text-[#176B45] font-semibold text-xs">
                          -{reductionPercent}% kamaytirish
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D5DED7]/60">
                      <div className="font-mono font-bold text-base sm:text-xl tabular-nums text-[#17211B]">
                        {formatWithSpaces(targetMonthlyExpenses)} so‘m
                      </div>
                      <div className="text-xs text-[#5A675F]">
                        oylik xarajat limiti
                      </div>
                    </div>
                  </div>

                  {/* Item 2: Potential Monthly Savings Hero Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#DDF3E5]/50 border-2 border-[#176B45]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#176B45] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Sparkles className="h-5 w-5 text-[#9EE5B8]" />
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold text-[#17211B]">
                          Oylik potentsial tejash
                        </div>
                        <div className="text-xs text-[#47544C] mt-0.5">
                          Har oy jamg‘armangizga qoladi
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right pl-13 sm:pl-0">
                      <div className="font-mono font-extrabold text-lg sm:text-2xl tabular-nums text-[#176B45] whitespace-nowrap">
                        +{formatWithSpaces(potentialMonthlySavings)} so‘m
                      </div>
                      <div className="text-xs font-semibold text-[#176B45]">
                        har oy tejaladi
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step4-next-btn"
                type="button"
                onClick={handleNextFromStep4}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 5: SAVINGS GOALS
           ========================================================================= */}
        {/* =========================================================================
            SCREEN 5A: SAVINGS GOALS SELECTION
           ========================================================================= */}
        {step === 5 && !isConfiguringGoals && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Kelajakda nimaga pul yig‘moqchisiz?
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Maqsadingizni tanlang. Siz uchun jamg‘arish rejasini shakllantiramiz.
              </p>
            </div>

            {/* Selectable Goal Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {GOAL_TEMPLATES.map((tpl) => {
                const isSelected = selectedGoalKeys.includes(tpl.key);
                const IconComponent = tpl.icon;

                return (
                  <div
                    key={tpl.key}
                    onClick={() => toggleGoalSelection(tpl)}
                    className={`rounded-2xl border p-4 transition-all text-left flex items-center justify-between cursor-pointer select-none ${
                      isSelected
                        ? 'border-[#176B45] bg-[#F7FBF8] ring-2 ring-[#DDF3E5]'
                        : 'border-[#D5DED7] bg-white hover:border-[#176B45]/40 hover:bg-[#FAFBFB]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#176B45] text-white' : 'bg-[#DDF3E5] text-[#176B45]'
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#17211B]">{tpl.defaultName}</div>
                        <div className="text-xs text-[#47544C] line-clamp-1">{tpl.description}</div>
                      </div>
                    </div>

                    <div
                      className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#176B45] border-[#176B45] text-white'
                          : 'border-[#D5DED7] bg-white'
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Skip Button Option */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedGoalKeys([]);
                  const next = 6;
                  setStep(next);
                  setIsConfiguringGoals(false);
                  persistDraft(next);
                }}
                className="text-xs sm:text-sm font-medium text-[#5A675F] hover:text-[#17211B] transition-colors underline"
              >
                Keyinroq belgilayman (o‘tkazib yuborish)
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step5-next-btn"
                type="button"
                onClick={handleNextFromStep5}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 5B: GOAL PARAMETERS CONFIGURATION
           ========================================================================= */}
        {step === 5 && isConfiguringGoals && currentConfigGoal && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Maqsad parametrlarini moslash
              </h1>
              <p className="text-base sm:text-lg text-[#47544C]">
                Tanlangan maqsad uchun rejalashtirilgan summa va muddatni belgilang.
              </p>
            </div>

            {/* Multiple goals tabs if > 1 selected */}
            {selectedGoalKeys.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {selectedGoalKeys.map((key, idx) => {
                  const tpl = GOAL_TEMPLATES.find((t) => t.key === key);
                  const Icon = tpl?.icon || Sparkles;
                  const isCurrent = key === currentConfigKey;
                  const goalName =
                    configuredGoals[key]?.name || tpl?.defaultName || `Maqsad ${idx + 1}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveConfigGoalKey(key)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border shrink-0 ${
                        isCurrent
                          ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs'
                          : 'bg-white text-[#47544C] border-[#D5DED7] hover:bg-[#F7F9F7]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-[#176B45]'}`} />
                      <span className="truncate max-w-[120px]">{goalName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Parameter Editing Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-4">
              {/* Goal Name Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#47544C]">
                  Maqsad nomi
                </label>
                <input
                  type="text"
                  value={currentConfigGoal.name}
                  onChange={(e) =>
                    updateGoalField(currentConfigKey, { name: e.target.value })
                  }
                  placeholder="Maqsad nomi"
                  className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3.5 py-2 text-sm font-semibold text-[#17211B] focus:border-[#176B45] focus:outline-none transition-colors"
                />
              </div>

              {/* Amount & Date 2-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#47544C]">
                    Maqsad summasi (UZS)
                  </label>
                  <input
                    type="number"
                    min="100000"
                    step="100000"
                    value={currentConfigGoal.target_amount}
                    onChange={(e) =>
                      updateGoalField(currentConfigKey, {
                        target_amount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3.5 py-2 text-sm font-semibold font-mono tabular-nums text-[#17211B] focus:border-[#176B45] focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#47544C]">
                    Kutilayotgan sana (Ixtiyoriy)
                  </label>
                  <input
                    type="date"
                    value={currentConfigGoal.target_date || ''}
                    onChange={(e) =>
                      updateGoalField(currentConfigKey, {
                        target_date: e.target.value || null,
                      })
                    }
                    className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3.5 py-2 text-sm font-medium text-[#17211B] focus:border-[#176B45] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Info notice box */}
              <div className="text-xs text-[#47544C] bg-white p-3.5 rounded-xl border border-[#D5DED7] leading-relaxed flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0 mt-0.5">💡</span>
                <span>
                  <strong>Muhim:</strong> Har bir yangi maqsad to‘liq <strong>0 so‘m</strong> bilan boshlanadi. Haqiqiy to‘lovlar keyinchalik o‘zingiz tomoningizdan kiritiladi.
                </span>
              </div>
            </div>

            {/* Secondary fast-forward link if multiple goals and not on last goal */}
            {selectedGoalKeys.length > 1 && !isLastConfigGoal && (
              <div className="flex justify-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = 6;
                    setStep(next);
                    setIsConfiguringGoals(false);
                    persistDraft(next);
                  }}
                  className="text-xs sm:text-sm font-medium text-[#5A675F] hover:text-[#176B45] transition-colors underline"
                >
                  Qolganlarini standart qoldirib, yakunlash
                </button>
              </div>
            )}

            {/* Navigation Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => {
                  if (selectedGoalKeys.length > 1 && currentGoalIndex > 0) {
                    setActiveConfigGoalKey(selectedGoalKeys[currentGoalIndex - 1]);
                  } else {
                    setIsConfiguringGoals(false);
                  }
                }}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-step5-config-next-btn"
                type="button"
                onClick={() => {
                  if (selectedGoalKeys.length > 1 && !isLastConfigGoal) {
                    setActiveConfigGoalKey(selectedGoalKeys[currentGoalIndex + 1]);
                  } else {
                    const next = 6;
                    setStep(next);
                    setIsConfiguringGoals(false);
                    persistDraft(next);
                  }
                }}
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold transition-all shadow-xs active:scale-[0.99]"
              >
                <span>
                  {selectedGoalKeys.length > 1 && !isLastConfigGoal
                    ? `Keyingi maqsad (${currentGoalIndex + 1}/${selectedGoalKeys.length})`
                    : 'Davom etish'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 6: FINAL REVIEW
           ========================================================================= */}
        {step === 6 && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#17211B]">
                Sizning moliyaviy rejangiz tayyor!
              </h1>
              <p className="text-sm sm:text-base text-[#47544C]">
                Kiritgan ma’lumotlaringiz asosida keyingi 1 yilda kutilayotgan moliyaviy natijangiz hisoblab chiqildi.
              </p>
            </div>

            {/* Prominent Hero Card: 1-Year Projected Financial Result */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E442B] via-[#176B45] to-[#218653] p-5 sm:p-6 text-white shadow-fintech-elevated">
              {/* Decorative ambient background glows */}
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-[#9EE5B8]/15 blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[#9EE5B8] text-xs font-bold tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>1 YILLIK KUTILAYOTGAN NATIJA</span>
                  </div>
                  <span className="text-white/80 text-xs font-semibold">12 oylik prognoz</span>
                </div>

                {/* Big Hero Amount */}
                <div className="space-y-1">
                  <div className="font-mono font-extrabold text-3xl sm:text-4xl tracking-tight text-white tabular-nums">
                    +{formatWithSpaces(projectedAnnualTotal)} so‘m
                  </div>
                  <p className="text-xs sm:text-sm text-[#DDF3E5] font-medium leading-relaxed">
                    {annualSavingsPotential > 0
                      ? 'Rejalashtirilgan daromad va tejash sur’ati bilan 1 yilda to‘planadigan umumiy sof jamg‘arma'
                      : 'Xarajatlarni qisqartirish rejasi hisobiga 1 yilda tejaladigan umumiy mablag‘'}
                  </p>
                </div>

                {/* Key Sub-metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
                    <div className="text-[11px] font-medium text-white/75">Oylik sof jamg‘arma</div>
                    <div className="font-mono font-bold text-sm sm:text-base text-white tabular-nums mt-0.5">
                      +{formatWithSpaces(monthlyNetSurplus > 0 ? monthlyNetSurplus : potentialMonthlySavings)} so‘m
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
                    <div className="text-[11px] font-medium text-white/75">Yillik xarajat tejovi</div>
                    <div className="font-mono font-bold text-sm sm:text-base text-[#9EE5B8] tabular-nums mt-0.5">
                      +{formatWithSpaces(annualExpenseSavings)} so‘m
                    </div>
                  </div>
                </div>

                {/* Goals Milestone Impact Callout */}
                {selectedGoalKeys.length > 0 && totalGoalsTargetAmount > 0 && (
                  <div className="p-3 rounded-2xl bg-black/15 border border-white/10 text-xs text-[#E8ECE9] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#9EE5B8] shrink-0" />
                      <span>Jamg‘arma maqsadlarini qoplash:</span>
                    </div>
                    <span className="font-bold text-[#9EE5B8] text-xs sm:text-sm font-mono">
                      {annualGoalCoveragePercent}% (1 yilda)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Compact Plan Summary Card */}
            <div className="space-y-4 pt-1">
              {/* Profile Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#5A675F] uppercase tracking-wider">
                    Foydalanuvchi
                  </div>
                  <div className="text-base sm:text-lg font-bold text-[#17211B]">
                    {firstName} {lastName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-[#176B45] hover:bg-white border border-transparent hover:border-[#D5DED7] transition-all"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Tahrirlash</span>
                </button>
              </div>

              {/* Monthly Income & Expenses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] flex items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#5A675F] uppercase tracking-wider">
                      Oylik daromad
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#176B45]">
                      +{formatWithSpaces(monthlyIncome)} so‘m
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="p-2 rounded-xl text-[#176B45] hover:bg-white transition-all border border-transparent hover:border-[#D5DED7]"
                    title="Daromadni tahrirlash"
                    aria-label="Daromadni tahrirlash"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] flex items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#5A675F] uppercase tracking-wider">
                      Oylik xarajat
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#17211B]">
                      -{formatWithSpaces(monthlyExpenses)} so‘m
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="p-2 rounded-xl text-[#176B45] hover:bg-white transition-all border border-transparent hover:border-[#D5DED7]"
                    title="Xarajatni tahrirlash"
                    aria-label="Xarajatni tahrirlash"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Reduction Plan */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#D5DED7]/60 pb-2.5">
                  <span className="text-xs font-bold text-[#5A675F] uppercase tracking-wider">
                    Xarajatni qisqartirish
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold text-[#176B45] hover:bg-white border border-transparent hover:border-[#D5DED7] transition-all"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Tahrirlash</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#DDF3E5] text-[#176B45] text-xs sm:text-sm font-bold">
                      -{reductionPercent}% kamaytirish
                    </span>
                    <span className="text-xs text-[#5A675F]">rejalashtirilgan</span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#47544C]">
                    Yangi oylik limit:{' '}
                    <strong className="font-mono font-bold text-[#17211B] text-sm sm:text-base">
                      {formatWithSpaces(targetMonthlyExpenses)} so‘m
                    </strong>
                  </div>
                </div>

                {potentialMonthlySavings > 0 && (
                  <div className="p-3 rounded-xl bg-[#DDF3E5]/60 border border-[#176B45]/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#176B45] shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-[#17211B]">
                        Har oy kutilayotgan tejov:
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-sm sm:text-base text-[#176B45]">
                      +{formatWithSpaces(potentialMonthlySavings)} so‘m
                    </span>
                  </div>
                )}
              </div>

              {/* Savings Goals */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#D5DED7]/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5A675F] uppercase tracking-wider">
                      Jamg‘arma maqsadlari
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#E5EBE6] text-[11px] font-bold text-[#176B45]">
                      {selectedGoalKeys.length} ta
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(5);
                      setIsConfiguringGoals(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold text-[#176B45] hover:bg-white border border-transparent hover:border-[#D5DED7] transition-all"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Tahrirlash</span>
                  </button>
                </div>

                {selectedGoalKeys.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[#5A675F] italic py-1">
                    Jamg‘arma maqsadi belgilanmadi (istalgan vaqtda qo‘shish mumkin).
                  </p>
                ) : (
                  <div className="space-y-2.5 pt-0.5">
                    {selectedGoalKeys.map((k) => {
                      const g = configuredGoals[k];
                      if (!g) return null;
                      const tpl = GOAL_TEMPLATES.find((t) => t.key === k);
                      const IconComponent = tpl?.icon || Target;
                      return (
                        <div
                          key={k}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#D5DED7] shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-[#DDF3E5] text-[#176B45] flex items-center justify-center shrink-0">
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm text-[#17211B] truncate">
                              {g.name}
                            </span>
                          </div>
                          <span className="font-mono font-bold tabular-nums text-sm sm:text-base text-[#176B45] shrink-0">
                            {formatWithSpaces(g.target_amount)} so‘m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Reassurance Notice */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#176B45]">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>Toza hisob kafolati</span>
              </div>

              <p className="text-xs sm:text-sm text-[#47544C] leading-relaxed">
                Sizning yangi profilingiz mutlaqo toza holda ochiladi:
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-white border border-[#D5DED7]/80">
                  <div className="text-[11px] font-medium text-[#5A675F]">Balans</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-[#17211B] mt-0.5">0 so‘m</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#D5DED7]/80">
                  <div className="text-[11px] font-medium text-[#5A675F]">Tranzaksiyalar</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-[#17211B] mt-0.5">0 ta</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#D5DED7]/80">
                  <div className="text-[11px] font-medium text-[#5A675F]">Jamg‘arma</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-[#17211B] mt-0.5">0 so‘m</div>
                </div>
              </div>

              <p className="text-[11px] sm:text-xs text-[#5A675F] leading-normal pt-0.5">
                Ushbu onboardingda kiritilgan ma’lumotlar sun’iy intellekt tahlillari va rejalashtirish uchun foydalaniladi.
              </p>
            </div>

            {/* Submit CTA */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#D5DED7]">
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D5DED7] bg-white text-sm font-medium text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors shrink-0 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Orqaga</span>
              </button>

              <button
                id="onboarding-complete-submit-btn"
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 sm:px-6 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-sm font-semibold whitespace-nowrap transition-all shadow-xs active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Saqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <span>SpendSense AI&apos;ni boshlash</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
