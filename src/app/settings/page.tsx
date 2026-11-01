import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import ProfileForm from '@/components/ProfileForm';
import LogoutButton from '@/components/LogoutButton';
import {
  PageContainer,
  PageHeader,
  BentoGrid,
  BentoCard,
  BentoActionCard,
} from '@/components/bento';
import {
  User,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Wallet,
} from 'lucide-react';

export const metadata = {
  title: 'Sozlamalar — SpendSense AI',
  description: 'Hisobingiz va profilingiz sozlamalarini boshqaring',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile from database
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const firstName = profile?.first_name || user.user_metadata?.first_name || '';
  const lastName = profile?.last_name || user.user_metadata?.last_name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const formattedEmailName = cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : '';
  const fullName = `${firstName} ${lastName}`.trim() || formattedEmailName || 'Foydalanuvchi';

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-36 md:pb-16">
      <AppHeader userEmail={user.email} userName={fullName} />

      <PageContainer>
        <div className="space-y-6">
          <PageHeader
            title={
              <div className="flex items-center gap-2.5">
                <User className="h-5 w-5 text-[#176B45]" />
                <span>Hisob sozlamalari</span>
                <span className="sr-only">Account Settings</span>
              </div>
            }
            subtitle="Shaxsiy profilingiz va hisob parametrlarini boshqaring."
            breadcrumbs={[
              { label: 'Bosh sahifa', href: '/dashboard' },
              { label: 'Sozlamalar' },
            ]}
            actions={<LogoutButton />}
          />

          <BentoGrid cols={12}>
            {/* Profile Information (col-span-12) */}
            <BentoCard span={12} className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#D5DED7]">
                <div className="p-2 rounded-xl bg-[#DDF3E5] text-[#176B45]">
                  <User className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-[#17211B]">Shaxsiy ma’lumotlar</h2>
              </div>

              <div className="max-w-2xl">
                <ProfileForm
                  initialFirstName={firstName}
                  initialLastName={lastName}
                  email={user.email || ''}
                />
              </div>
            </BentoCard>

            {/* Fast Links / Management Bento Action Cards */}
            <BentoActionCard
              span={{ default: 12, md: 6 }}
              title="Kategoriyalarni sozlash"
              description="Daromad va xarajat toifalarini boshqarish"
              href="/categories"
              icon={<Layers className="h-5 w-5" />}
              accent="green"
            />

            <BentoActionCard
              span={{ default: 12, md: 6 }}
              title="Bank ko‘chirmalarini import qilish"
              description="CSV, Excel va 1C ko‘chirmalarini yuklash"
              href="/imports"
              icon={<FileSpreadsheet className="h-5 w-5" />}
              accent="blue"
            />

            <BentoActionCard
              span={{ default: 12, md: 6 }}
              title="AI Moliyaviy maslahatchi"
              description="Shaxsiy moliyaviy tahlil va tavsiyalar"
              href="/advisor"
              icon={<Sparkles className="h-5 w-5" />}
              accent="purple"
            />

            <BentoActionCard
              span={{ default: 12, md: 6 }}
              title="Jamg‘arma va budjetlar"
              description="Xarajat limitlari va moliyaviy maqsadlar"
              href="/budgets"
              icon={<Wallet className="h-5 w-5" />}
              accent="green"
            />
          </BentoGrid>
        </div>
      </PageContainer>
    </div>
  );
}
