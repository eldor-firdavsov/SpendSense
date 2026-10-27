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

  // Create an impersonated client or auth context for this user
  // We can pass user context to Supabase client or generate custom JWT/session
  const { data: userAuth, error: authErr } = await adminClient.auth.admin.getUserById(userProfile.id);
  if (authErr || !userAuth.user) {
    console.error('User auth retrieval error:', authErr);
    process.exit(1);
  }

  // Create client scoped to this user
  const userClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        'x-user-id': userProfile.id,
      },
    },
  });
  // Mock getUser on userClient to return the user
  userClient.auth.getUser = async () => ({
    data: { user: userAuth.user },
    error: null,
  });

  const questions = [
    '2026-yil sentabr oyida jami qancha daromad olganman?',
    '2026-yil sentabr oyida jami qancha xarajat qilganman?',
    '2026-yil oktabr oyida jami qancha xarajat qilganman?',
    'Sentabr va oktabr oylarida eng ko‘p qaysi kategoriyalarga pul sarflaganman?',
    'Ikki oyda kafe va ichimliklarga qancha sarflangan?',
    'Sentabr va oktabr xarajatlarimni taqqoslab ber.',
    'Har oy qancha pul qolgan?',
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
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log('\n======================================================');
  console.log('AI TEKSHIRUV XULOSASI:');
  console.log(`Jami savollar: ${questions.length}, Muvaffaqiyatli: ${results.filter((r) => r.success).length}`);
  console.log('======================================================');
}

run();
