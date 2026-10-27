const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const { createClient } = require('/home/eldor_firdavsov/Desktop/SpendSense/node_modules/@supabase/supabase-js');
const { createServerClient } = require('/home/eldor_firdavsov/Desktop/SpendSense/node_modules/@supabase/ssr');

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const BASE_URL = 'http://localhost:3000';

describe('SpendSense Minimal White UI/UX Verification', () => {
  let adminClient;
  let authCookieHeader = '';
  let createdUserId = null;
  const testEmail = `minimal_ui_${Date.now()}@test.spendsense.ai`;
  const testPassword = 'Password123!Secure';

  before(async () => {
    try {
      const keys = JSON.parse(
        execSync(
          '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
        ).toString()
      );
      const serviceKey = keys.find(
        (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
      )?.api_key;
      if (serviceKey) {
        adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      }
    } catch (e) {
      console.error('Error obtaining service key:', e.message);
    }

    let capturedCookies = {};
    const ssrClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return Object.entries(capturedCookies).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            capturedCookies[name] = value;
          });
        },
      },
    });

    const { data: signUpData, error: signUpErr } = await ssrClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Minimal',
          last_name: 'Tester',
        },
      },
    });

    assert.strictEqual(signUpErr, null);
    createdUserId = signUpData.user.id;

    const { data: signInData, error: signInErr } = await ssrClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(signInErr, null);
    assert.ok(signInData.session);

    authCookieHeader = Object.entries(capturedCookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
  });

  after(async () => {
    if (adminClient && createdUserId) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (err) {
        // ignore
      }
    }
  });

  test('1. Bosh sahifa (/dashboard) has white background and exactly 4 nav links', async () => {
    const res = await fetch(BASE_URL + '/dashboard', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('bg-white text-[#222222]'), 'Should use bg-white text-[#222222]');
    assert.ok(html.includes('Bosh sahifa'), 'Should have Bosh sahifa link');
    assert.ok(html.includes('AI yordamchi'), 'Should have AI yordamchi link');
    assert.ok(html.includes('Faoliyat'), 'Should have Faoliyat link');
    assert.ok(html.includes('Tahlil'), 'Should have Tahlil link');
    assert.ok(html.includes('+ Tranzaksiya'), 'Should have + Tranzaksiya button');
    assert.ok(html.includes('Mavjud balans'), 'Should have Mavjud balans section');
    assert.ok(!html.includes('ThemeToggle'), 'Should not contain theme toggle');
  });

  test('2. Faoliyat (/transactions) has white background and secondary nav links', async () => {
    const res = await fetch(BASE_URL + '/transactions', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('bg-white text-[#222222]'));
    assert.ok(html.includes('Faoliyat'));
    assert.ok(html.includes('Kategoriyalar'));
    assert.ok(html.includes('Import'));
  });

  test('3. Tahlil (/analytics) has white background and budget/goal links', async () => {
    const res = await fetch(BASE_URL + '/analytics', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('bg-white text-[#222222]'));
    assert.ok(html.includes('Tahlil'));
    assert.ok(html.includes('Budjetlar'));
    assert.ok(html.includes('Jamg‘arma maqsadlari'));
  });

  test('4. AI yordamchi (/advisor) has white background and chat container', async () => {
    const res = await fetch(BASE_URL + '/advisor', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('bg-white text-[#222222]'));
    assert.ok(html.includes('AI yordamchi'));
  });

  test('5. Sozlamalar (/settings) has white background and no dark toggle', async () => {
    const res = await fetch(BASE_URL + '/settings', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('bg-white text-[#222222]'));
    assert.ok(html.includes('Hisob sozlamalari'));
    assert.ok(!html.includes('ThemeToggle'), 'Theme toggle should be absent');
  });

  test('6. Fast transaction creation via API succeeds', async () => {
    const res = await fetch(BASE_URL + '/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieHeader,
      },
      body: JSON.stringify({
        description: 'Tezkor xarid',
        amount: 25.5,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-23',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.transaction.description, 'Tezkor xarid');
    assert.strictEqual(Number(data.transaction.amount), 25.5);
  });
});
