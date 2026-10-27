import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';

const DEMO_EMAIL = 'demo@spendsense.io';
const DEMO_PASSWORD = 'Password123!Demo';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !anonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required');
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function run() {
  console.log('Authenticating as demo user:', DEMO_EMAIL);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (authErr || !authData.user) {
    console.error('Auth error:', authErr);
    process.exit(1);
  }

  console.log('Logged in successfully! User ID:', authData.user.id);

  const testQuestions = [
    '2026-yil avgust oyida jami qancha xarajat qilganman?',
    '2026-yil sentabr oyida eng ko‘p qaysi kategoriyaga pul sarflaganman?',
    'Ikki oyda kafe va ichimliklarga qancha sarflangan?',
    'Avgust va sentabr xarajatlarimni taqqoslab ber.',
    'Qaysi takroriy mayda xarajatlarimga e\'tibor berishim mumkin?',
  ];

  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    console.log(`\n======================================================`);
    console.log(`TEST ${i + 1}: "${q}"`);
    console.log(`======================================================`);

    const res = await askFinancialAdvisor(q, undefined, client);
    if (res.error) {
      console.error('Error answering question:', res.error);
    } else {
      console.log('AI Answer:\n', res.data.answer);
      console.log('\nModel used:', res.data.evidence?.model_used);
      console.log('Fallback active:', res.data.isAiFallback);
    }

    if (i < testQuestions.length - 1) {
      console.log('\nWaiting 4s before next query to prevent rate limits...');
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

run();
