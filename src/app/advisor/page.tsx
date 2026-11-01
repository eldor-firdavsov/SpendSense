import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import AIAdvisorChat from '@/components/ai/AIAdvisorChat';

export const metadata = {
  title: 'Moliyaviy yordamchi — SpendSense',
  description: 'Tasdiqlangan moliyaviy ma’lumotlar asosida aqlli tavsiyalar va ssenariy simulyatsiyasi',
};

export default async function AdvisorPage() {
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
    <div className="h-dvh max-h-dvh bg-[#F1F4F2] text-[#17211B] flex flex-col overflow-hidden">
      <AppHeader userEmail={user.email} userName={displayName} />

      <main className="w-full max-w-[1760px] mx-auto px-2.5 sm:px-6 lg:px-8 xl:px-10 py-2 sm:py-4 flex-1 flex flex-col min-h-0 pb-20 md:pb-4 overflow-hidden">
        <AIAdvisorChat userName={displayName} />
      </main>
    </div>
  );
}
