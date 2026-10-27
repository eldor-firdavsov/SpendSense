import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import TransactionsManager from '@/components/transactions/TransactionsManager';
import PageContainer from '@/components/bento/PageContainer';

export const metadata = {
  title: 'Faoliyat — SpendSense AI',
  description: 'Daromad va xarajatlaringizni kuzating.',
};

export default async function TransactionsPage() {
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
        <div className="flex items-center gap-3 text-xs font-medium text-[#68736C] mb-4">
          <a href="/categories" className="hover:text-[#176B45] transition-colors">Kategoriyalar</a>
          <span className="text-[#DCE4DE]">•</span>
          <a href="/imports" className="hover:text-[#176B45] transition-colors">Import</a>
        </div>
        <TransactionsManager />
      </PageContainer>
    </div>
  );
}
