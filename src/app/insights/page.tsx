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

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName =
    (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '') ||
    (user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : '');

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-36 md:pb-16">
      <AppHeader userEmail={user.email} userName={displayName} />

      <PageContainer>
        <InsightsFeed />
      </PageContainer>
    </div>
  );
}
