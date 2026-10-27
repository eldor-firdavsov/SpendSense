import { redirect } from 'next/navigation';
import { connection } from 'next/server';
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
  Shield,
  Coins,
  FileSpreadsheet,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export const metadata = {
  title: 'Sozlamalar — SpendSense AI',
  description: 'Hisobingiz sozlamalari, valyuta va xavfsizlik parametrlarini boshqaring',
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

  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      <AppHeader userEmail={user.email} />

      <PageContainer>
        <div className="space-y-6">
          <PageHeader
            title={
              <div className="flex items-center gap-2.5">
                <User className="h-5 w-5 text-[#176B45]" />
                <span>Hisob sozlamalari</span>
              </div>
            }
            subtitle="Shaxsiy profilingiz, asosiy valyuta va tizim xavfsizlik parametrlarini boshqaring."
            srOnlyFallback="Account Settings"
            breadcrumbs={[
              { label: 'Bosh sahifa', href: '/dashboard' },
              { label: 'Sozlamalar' },
            ]}
            actions={<LogoutButton />}
          />

          <BentoGrid cols={12}>
            {/* Profile Information (col-span-7) */}
            <BentoCard span={7} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#DCE4DE]">
                <div className="p-2 rounded-xl bg-[#DDF3E5] text-[#176B45]">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#17211B]">Shaxsiy ma’lumotlar</h2>
                  <p className="text-xs text-[#68736C]">Ism va familiyangizni yangilang</p>
                </div>
              </div>

              <ProfileForm
                initialFirstName={firstName}
                initialLastName={lastName}
                email={user.email || ''}
              />
            </BentoCard>

            {/* Currency & Financial Preferences (col-span-5) */}
            <BentoCard span={5} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#DCE4DE]">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Coins className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#17211B]">Asosiy valyuta</h2>
                  <p className="text-xs text-[#68736C]">Moliyaviy ko‘rsatkichlar birligi</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-[#68736C]">
                  SpendSense AI barcha hisob-kitoblar, daromad va xarajatlarni O‘zbekiston so‘mi (UZS) valyutasida yuritadi.
                </p>

                <div className="p-3 rounded-xl bg-[#F7F9F7] border border-[#DCE4DE] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#17211B]">Standart valyuta:</span>
                    <span className="font-mono font-bold text-[#176B45] px-2 py-0.5 rounded bg-[#DDF3E5]">UZS (soʻm)</span>
                  </div>
                  <div className="flex items-center justify-between text-[#68736C]">
                    <span>Valyuta rejimi:</span>
                    <span className="font-mono font-medium text-[#17211B]">Faqat soʻm (UZS)</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-[#68736C]">
                  Barcha tranzaksiyalar, byudjetlar va hisobotlar avtomatik ravishda soʻmda aks ettiriladi.
                </div>
              </div>
            </BentoCard>

            {/* Fast Links / Management Bento Action Cards (col-span-6 each) */}
            <BentoActionCard
              span={6}
              title="Kategoriyalarni sozlash"
              description="Daromad va xarajat kategoriyalarini qo‘shing, ranglarini o‘zgartiring yoki o‘chiring."
              href="/categories"
              icon={<Layers className="h-4 w-4" />}
              badge="Tizimli va maxsus"
            />

            <BentoActionCard
              span={6}
              title="Bank ko‘chirmalarini import qilish"
              description="Bank ilovangizdan yuklangan CSV va Excel fayllarni bir tugma bilan yuklang."
              href="/imports"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              badge="Avtomatik xaritalash"
            />

            <BentoActionCard
              span={6}
              title="AI Moliyaviy maslahatchi"
              description="Xarajatlaringiz bo‘yicha tahlillar va tejash bo‘yicha tavsiyalar oling."
              href="/advisor"
              icon={<Sparkles className="h-4 w-4" />}
              badge="GPT-4o quvvatida"
            />

            <BentoActionCard
              span={6}
              title="Jamg‘arma va budjetlar"
              description="Maqsadlar belgilang va har oylik limitlaringizni nazorat qiling."
              href="/budgets"
              icon={<HelpCircle className="h-4 w-4" />}
              badge="Nazorat paneli"
            />

            {/* Security & RLS Card (col-span-12) */}
            <BentoCard span={12} variant="green" className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white text-[#176B45] border border-[#DCE4DE] shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-sm font-semibold text-[#17211B]">
                    Xavfsizlik va Ma’lumotlar Maxfiyligi (RLS)
                  </h2>
                  <p className="text-xs text-[#68736C] leading-relaxed">
                    Sizning barcha moliyaviy yozuvlaringiz Supabase Row-Level Security (RLS) himoyasi ostida bo‘lib,
                    faqat sizning hisobingizga tegishlidir. Boshqa foydalanuvchilar yoki uchinchi shaxslar
                    sizning tranzaksiya va balansingizni ko‘ra olmaydi.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#176B45]">
                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-[#DCE4DE]">
                      ✓ RLS faollashtirilgan
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-[#DCE4DE]">
                      ✓ 256-bit shifrlash
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-[#DCE4DE]">
                      ✓ Alohida foydalanuvchi sessiyasi
                    </span>
                  </div>
                </div>
              </div>
            </BentoCard>
          </BentoGrid>
        </div>
      </PageContainer>
    </div>
  );
}
