import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();

let serviceKey = null;
try {
  const keys = JSON.parse(
    execSync(
      '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
    ).toString()
  );
  serviceKey = keys.find(
    (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
  )?.api_key;
} catch (err) {
  console.error('Failed to retrieve service key:', err);
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const targetEmail = process.argv[2] || 'firdavsove1@gmail.com';
  console.log(`Foydalanuvchi qidirilmoqda: ${targetEmail}`);

  const { data: userProfile, error: profileErr } = await adminClient
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('email', targetEmail)
    .single();

  if (profileErr || !userProfile) {
    console.error('Foydalanuvchi profili topilmadi:', profileErr);
    process.exit(1);
  }

  console.log(`Profil topildi: ${userProfile.email} (${userProfile.id})`);

  const { data: userAuth, error: authErr } = await adminClient.auth.admin.getUserById(userProfile.id);
  if (authErr || !userAuth.user) {
    console.error('User auth retrieval error:', authErr);
    process.exit(1);
  }

  const userClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  userClient.auth.getUser = async () => ({
    data: { user: userAuth.user },
    error: null,
  });

  const questions = [
    '2026-yil sentabr oyida qancha oylik olganman?',
    '2026-yil sentabr oyida jami qancha xarajat qilganman?',
    '2026-yil oktabr oyida jami qancha xarajat qilganman?',
    'Sentabr oyida qancha pul ortib qolgan?',
    'Oktabr oyida qancha pul ortib qolgan?',
    'Sentabr va oktabr xarajatlarimni taqqoslab ber.',
    'Qaysi kategoriyalarga eng ko‘p pul sarfladim?',
    'Kafe, ichimliklar va taksiga jami qancha sarflaganman?',
    'Qaysi kichik xarajatlarni kamaytirish orqali ko‘proq pul tejashim mumkin?',
    'Ikki oy davomida jami qancha daromad oldim va qancha sarfladim?',
    'Qayerga ko‘p pul sarflayapman?',
    'Shu oy 2 million so‘m tejamoqchiman.',
    'Bugun 6 million so‘m oylik oldim.',
  ];

  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n======================================================`);
    console.log(`SAVOL ${i + 1}: "${q}"`);
    console.log(`======================================================`);

    const res = await askFinancialAdvisor(q, undefined, userClient);
    if (res.error) {
      console.error('Xatolik:', res.error);
      results.push({ question: q, success: false, error: res.error });
    } else {
      console.log('AI JAVOBI:\n', res.data.answer);
      console.log('\nIshlatilgan model:', res.data.evidence?.model_used);
      console.log('Fallback faolmi:', res.data.isAiFallback);
      results.push({ question: q, success: true, answer: res.data.answer });
    }

    if (i < questions.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log('\n======================================================');
  console.log('AI TEKSHIRUV XULOSASI:');
  console.log(`Jami savollar: ${questions.length}, Muvaffaqiyatli: ${results.filter((r) => r.success).length}`);
  console.log('======================================================');

  if (results.some((r) => !r.success)) {
    process.exit(1);
  }
}

run();
