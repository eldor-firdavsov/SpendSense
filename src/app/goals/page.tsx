import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import TahlilHub from '@/components/analytics/TahlilHub';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Jamg‘arma maqsadlari — SpendSense AI',
  description: 'Moliyaviy maqsadlar belgilang, muddatlarni rejalashtiring va taraqqiyotni kuzatib boring.',
};

export default async function GoalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const displayName = metaName || (cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : 'Foydalanuvchi');

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-36 md:pb-16">
      <AppHeader userEmail={user.email} userName={displayName} />

      <PageContainer>
        <TahlilHub initialTab="goals" />
      </PageContainer>
    </div>
  );
}
