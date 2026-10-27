import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const BASE_URL = 'http://localhost:3000';

async function runHttpJourney() {
  console.log('--- Starting SpendSense AI HTTP Journey on http://localhost:3000 ---');

  const testEmail = `http_ai_user_${Date.now()}@example.com`;
  const testPassword = 'Password123!Secure';

  // 1. Authenticate and capture session cookies
  const cookiesMap = {};
  const ssrClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return Object.entries(cookiesMap).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookiesMap[name] = value;
        });
      },
    },
  });

  const { data: signUpData, error: signUpErr } = await ssrClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: { first_name: 'Test', last_name: 'User' },
    },
  });
  assert.ifError(signUpErr);
  const userId = signUpData.user.id;

  const { error: signInErr } = await ssrClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  assert.ifError(signInErr);

  const cookieHeader = Object.entries(cookiesMap)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  let convId = null;

  async function sendAiQuestion(text) {
    const res = await fetch(`${BASE_URL}/api/ai/advisor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        question: text,
        conversationId: convId || undefined,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    if (data.response?.conversationId) {
      convId = data.response.conversationId;
    }
    return data.response;
  }

  // --- Scenario 1: “Menda 500 dollar naqd pul bor.” ---
  console.log('Testing Scenario 1: Menda 500 dollar naqd pul bor.');
  const r1 = await sendAiQuestion('Menda 500 dollar naqd pul bor.');
  assert.ok(
    r1.answer.toLowerCase().includes('mavjud') || r1.answer.toLowerCase().includes('daromad'),
    `Expected clarification question, got: "${r1.answer}"`
  );

  const r2 = await sendAiQuestion('Mavjud balans');
  assert.ok(
    r2.answer.includes('500') && (r2.answer.includes('balans') || r2.answer.includes('tasdiqlay')),
    `Expected confirmation proposal, got: "${r2.answer}"`
  );

  const r3 = await sendAiQuestion('Ha, tasdiqlayman');
  assert.ok(
    r3.answer.includes('muvaffaqiyatli saqlandi'),
    `Expected saved initial balance confirmation, got: "${r3.answer}"`
  );
  console.log('✓ Scenario 1 PASS:', r3.answer);

  // --- Scenario 2: “Bugun 200 dollar ishlab topdim.” ---
  console.log('Testing Scenario 2: Bugun 200 dollar ishlab topdim.');
  const r4 = await sendAiQuestion('Bugun 200 dollar ishlab topdim.');
  assert.ok(
    r4.answer.includes('200') && r4.answer.includes('daromad'),
    `Expected income confirmation proposal, got: "${r4.answer}"`
  );

  const r5 = await sendAiQuestion('Tasdiqlayman');
  assert.ok(
    r5.answer.includes('200 dollar daromad muvaffaqiyatli saqlandi'),
    `Expected 200 USD income success, got: "${r5.answer}"`
  );
  console.log('✓ Scenario 2 PASS:', r5.answer);

  // --- Scenario 3: “Kecha oziq-ovqatga 35 dollar sarfladim.” ---
  console.log('Testing Scenario 3: Kecha oziq-ovqatga 35 dollar sarfladim.');
  const r6 = await sendAiQuestion('Kecha oziq-ovqatga 35 dollar sarfladim.');
  assert.ok(
    r6.answer.includes('35') && r6.answer.includes('oziq-ovqat'),
    `Expected expense confirmation proposal, got: "${r6.answer}"`
  );

  const r7 = await sendAiQuestion('Ha');
  assert.ok(
    r7.answer.includes('35 dollar xarajat muvaffaqiyatli saqlandi'),
    `Expected 35 USD expense success, got: "${r7.answer}"`
  );
  console.log('✓ Scenario 3 PASS:', r7.answer);

  // --- Scenario 4: “Bu oy qancha pul sarfladim?” ---
  console.log('Testing Scenario 4: Bu oy qancha pul sarfladim?');
  const r8 = await sendAiQuestion('Bu oy qancha pul sarfladim?');
  assert.ok(
    r8.answer.includes('$35.00') || r8.answer.includes('35'),
    `Expected $35.00 expense sum, got: "${r8.answer}"`
  );
  console.log('✓ Scenario 4 PASS:', r8.answer);

  // --- Scenario 5: “Oxirgi xarajatni bekor qil.” ---
  console.log('Testing Scenario 5: Oxirgi xarajatni bekor qil.');
  const r9 = await sendAiQuestion('Oxirgi xarajatni bekor qil.');
  assert.ok(
    r9.answer.includes('35') && r9.answer.includes('o‘chirishni tasdiqlaysizmi'),
    `Expected cancellation confirmation request, got: "${r9.answer}"`
  );

  const r10 = await sendAiQuestion('Ha, tasdiqlayman');
  assert.ok(
    r10.answer.includes('muvaffaqiyatli o‘chirildi') && r10.answer.includes('yangilandi'),
    `Expected deletion confirmation, got: "${r10.answer}"`
  );
  console.log('✓ Scenario 5 PASS:', r10.answer);

  // Re-check Scenario 4: spending should now be 0
  const r11 = await sendAiQuestion('Bu oy qancha pul sarfladim?');
  assert.ok(
    r11.answer.includes('$0.00') || r11.answer.includes('hech qanday xarajat qayd etilmagan'),
    `Expected $0.00 after deletion, got: "${r11.answer}"`
  );
  console.log('✓ Re-check Spending PASS:', r11.answer);

  // Cleanup
  const keys = JSON.parse(
    execSync(
      '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
    ).toString()
  );
  const serviceKey = keys.find(
    (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
  )?.api_key;
  if (serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    await admin.from('transactions').delete().eq('user_id', userId);
    await admin.from('ai_conversations').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }

  console.log('--- ALL 5 UZBEK AI FINANCIAL ACTION SCENARIOS VERIFIED OVER HTTP ---');
}

runHttpJourney().catch((err) => {
  console.error('HTTP Journey failed:', err);
  process.exit(1);
});
