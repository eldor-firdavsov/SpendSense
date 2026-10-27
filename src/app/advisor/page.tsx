import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import AIAdvisorChat from '@/components/ai/AIAdvisorChat';

export const metadata = {
  title: 'AI yordamchi — SpendSense AI',
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

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] flex flex-col">
      <AppHeader userEmail={user.email} />

      <main className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 flex-1 flex flex-col pb-24 md:pb-8">
        <AIAdvisorChat />
      </main>
    </div>
  );
}
