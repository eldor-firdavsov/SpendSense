import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import TahlilHub from '@/components/analytics/TahlilHub';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Budjetlar — SpendSense AI',
  description: 'Xarajat limitlarini belgilang va real vaqtda sarf-xarajatlarni kuzatib boring.',
};

export default async function BudgetsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      <AppHeader userEmail={user.email} />

      <PageContainer>
        <TahlilHub initialTab="budgets" />
      </PageContainer>
    </div>
  );
}
