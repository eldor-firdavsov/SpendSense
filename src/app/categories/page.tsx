import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import CategoriesManager from '@/components/categories/CategoriesManager';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Kategoriyalar — SpendSense AI',
  description: 'SpendSense AI ilovasida shaxsiy xarajat va daromad kategoriyalarini boshqaring',
};

export default async function CategoriesPage() {
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
        <CategoriesManager />
      </PageContainer>
    </div>
  );
}
