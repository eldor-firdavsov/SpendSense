import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export const metadata = {
  title: 'Moliyaviy rejalashtirish — SpendSense AI',
  description: 'SpendSense AI yangi foydalanuvchi moliyaviy rejasi',
};

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Load existing profile to check onboarding completion and restore draft state
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // If user has already completed onboarding, skip directly to dashboard
  if (profile && profile.onboarding_completed === true) {
    redirect('/dashboard');
  }

  const meta = user.user_metadata || {};
  const initialFirstName = profile?.first_name || meta.first_name || '';
  const initialLastName = profile?.last_name || meta.last_name || '';
  const initialStep = Math.min(6, Math.max(0, profile?.onboarding_step || 0));
  const initialData = (profile?.onboarding_data as Record<string, unknown>) || {
    declared_monthly_income: profile?.declared_monthly_income || 0,
    declared_monthly_expenses: profile?.declared_monthly_expenses || 0,
    target_expense_reduction_percent: profile?.target_expense_reduction_percent || 10,
    target_monthly_expenses: profile?.target_monthly_expenses || 0,
  };

  return (
    <div className="min-h-screen min-h-dvh bg-[#F1F4F2] text-[#17211B] flex flex-col justify-center items-center px-3 sm:px-4 py-3 sm:py-6">
      <main className="w-full max-w-lg">
        <OnboardingWizard
          initialFirstName={initialFirstName}
          initialLastName={initialLastName}
          initialStep={initialStep}
          initialData={initialData}
        />
      </main>
    </div>
  );
}
