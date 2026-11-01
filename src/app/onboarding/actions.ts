'use server';

import { createClient } from '@/lib/supabase/server';
import { completeOnboardingSchema, CompleteOnboardingInput } from '@/lib/onboarding/schemas';

export interface OnboardingActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Retrieves the current user's onboarding state from their profile
 */
export async function getOnboardingStateAction(): Promise<
  OnboardingActionResult<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    onboardingStep: number;
    onboardingCompleted: boolean;
    onboardingData: Record<string, unknown> | null;
  }>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      return { success: false, error: profErr.message };
    }

    const meta = user.user_metadata || {};
    const firstName = profile?.first_name || meta.first_name || '';
    const lastName = profile?.last_name || meta.last_name || '';
    const onboardingStep = profile?.onboarding_step || 0;
    const onboardingCompleted = profile?.onboarding_completed ?? false;
    const onboardingData = (profile?.onboarding_data as Record<string, unknown>) || null;

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email || '',
        firstName,
        lastName,
        onboardingStep,
        onboardingCompleted,
        onboardingData,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Holatni yuklashda xatolik yuz berdi';
    return { success: false, error: msg };
  }
}

/**
 * Saves draft progress (step index and current form state) to profiles
 */
export async function saveOnboardingStepAction(
  step: number,
  draftData: Record<string, unknown>
): Promise<OnboardingActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        onboarding_step: step,
        onboarding_data: draftData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Jarayonni saqlashda xatolik';
    return { success: false, error: msg };
  }
}

/**
 * Completes onboarding: validates and persists profile data and savings goals.
 * Strict fintech rules:
 * - current_amount for goals is ALWAYS 0.00
 * - NO transactions or fake activity created
 * - onboarding_completed is set to true
 */
export async function completeOnboardingAction(
  rawInput: CompleteOnboardingInput
): Promise<OnboardingActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const validated = completeOnboardingSchema.safeParse(rawInput);
    if (!validated.success) {
      const err = validated.error.issues?.[0]?.message || 'Kiritilgan ma’lumotlarda xatolik bor';
      return { success: false, error: err };
    }

    const {
      first_name,
      last_name,
      declared_monthly_income,
      declared_monthly_expenses,
      target_expense_reduction_percent,
      target_monthly_expenses,
      goals,
    } = validated.data;

    // 1. Fetch existing profile to preserve existing financial_start_date if present
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('financial_start_date')
      .eq('id', user.id)
      .maybeSingle();

    const todayDateStr = new Date().toISOString().split('T')[0];
    const effectiveFinancialStartDate = existingProfile?.financial_start_date || todayDateStr;

    // 2. Update user profile
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        declared_monthly_income,
        declared_monthly_expenses,
        target_expense_reduction_percent,
        target_monthly_expenses,
        financial_start_date: effectiveFinancialStartDate,
        onboarding_completed: true,
        onboarding_step: 6,
        onboarding_data: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileUpdateErr) {
      return {
        success: false,
        error: `Profilni yangilashda xatolik: ${profileUpdateErr.message}`,
      };
    }

    // 2. Also update auth user metadata if first_name / last_name changed
    await supabase.auth.updateUser({
      data: {
        first_name,
        last_name,
      },
    });

    // 3. Create savings goals if any selected
    if (goals && goals.length > 0) {
      // Avoid duplicates: remove any pending goal with same name created in onboarding
      for (const g of goals) {
        if (!g.name || !g.target_amount || g.target_amount <= 0) continue;

        // Check if goal with same name already exists
        const { data: existingGoal } = await supabase
          .from('financial_goals')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', g.name)
          .maybeSingle();

        if (existingGoal) {
          // Update target amount/date if already exists
          await supabase
            .from('financial_goals')
            .update({
              target_amount: g.target_amount,
              target_date: g.target_date || null,
              currency: 'UZS',
            })
            .eq('id', existingGoal.id);
        } else {
          // Insert brand new goal with current_amount = 0
          const { error: goalInsertErr } = await supabase.from('financial_goals').insert({
            user_id: user.id,
            name: g.name,
            target_amount: g.target_amount,
            current_amount: 0.0,
            currency: 'UZS',
            target_date: g.target_date || null,
            tracking_strategy: 'manual',
            status: 'in_progress',
          });

          if (goalInsertErr) {
            console.error('Error inserting onboarding goal:', goalInsertErr);
          }
        }
      }
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ro‘yxatdan o‘tishni yakunlashda xatolik yuz berdi';
    return { success: false, error: msg };
  }
}
