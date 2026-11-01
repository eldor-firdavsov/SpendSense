import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import ImportManager from '@/components/imports/ImportManager';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Import — SpendSense AI',
  description: 'Bank ko‘chirmalari va moliyaviy ma’lumotlarni dublikatsiz yuklang.',
};

export default async function ImportsPage() {
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
        <ImportManager />
      </PageContainer>
    </div>
  );
}
