import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import InsightsFeed from '@/components/ai/InsightsFeed';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Moliyaviy xulosalar — SpendSense AI',
  description: 'AI asosidagi tahlillar, xarajatlar tebranishi va foydali moliyaviy tavsiyalar.',
};

export default async function InsightsPage() {
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
        <InsightsFeed />
      </PageContainer>
    </div>
  );
}
