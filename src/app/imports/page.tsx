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

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      <AppHeader userEmail={user.email} />

      <PageContainer>
        <ImportManager />
      </PageContainer>
    </div>
  );
}
