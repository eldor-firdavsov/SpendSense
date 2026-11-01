import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const SUPABASE_ANON_KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const BASE_URL = 'http://localhost:3000';

function createAuthSession() {
  const cookies = {};
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookies[name] = value;
        });
      },
    },
  });

  return {
    client,
    cookies,
    getCookieHeader() {
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    },
  };
}

describe('SpendSense AI — Onboarding HTTP & SSR Flow Verification', () => {
  const session = createAuthSession();
  const testEmail = `http_onboard_${Date.now()}@spendsense.test`;
  const testPassword = 'Password123!Secure';
  let testUserId = null;
  let adminClient = null;

  try {
    const keys = JSON.parse(
      execSync(
        '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
      ).toString()
    );
    const serviceKey = keys.find(k => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role'))?.api_key;
    if (serviceKey) {
      adminClient = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
    }
  } catch (err) {
    console.warn('CLI admin key initialization warning:', err.message);
  }

  after(async () => {
    if (adminClient && testUserId) {
      try {
        await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
        await adminClient.from('transactions').delete().eq('user_id', testUserId);
        await adminClient.from('budgets').delete().eq('user_id', testUserId);
        await adminClient.from('profiles').delete().eq('id', testUserId);
        await adminClient.auth.admin.deleteUser(testUserId);
      } catch (e) {
        console.error('Test cleanup failed:', e.message);
      }
    }
  });

  it('Step 1: New user registers and gets session', async () => {
    const { data, error } = await session.client.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Anvar',
          last_name: 'Qodirov',
        },
      },
    });

    assert.strictEqual(error, null, `SignUp error: ${error?.message}`);
    assert.ok(data.user, 'User should be returned');
    testUserId = data.user.id;

    // Check profile
    if (adminClient) {
      const { data: prof } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();
      assert.strictEqual(prof.onboarding_completed, false, 'New user profile must have onboarding_completed: false');
    }
  });

  it('Step 2: Uncompleted user hitting /dashboard is redirected to /onboarding', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: {
        Cookie: session.getCookieHeader(),
      },
      redirect: 'manual',
    });

    // Should redirect to /onboarding or return redirect header
    const location = res.headers.get('location');
    assert.ok(
      res.status === 307 || res.status === 302 || location?.includes('/onboarding'),
      `Expected redirect to /onboarding, but got status ${res.status} location: ${location}`
    );
    assert.ok(location?.includes('/onboarding'), `Expected redirect location to contain /onboarding, got: ${location}`);
  });

  it('Step 3: User accesses /onboarding and receives 200 OK with Uzbek Fintech UI', async () => {
    const res = await fetch(`${BASE_URL}/onboarding`, {
      headers: {
        Cookie: session.getCookieHeader(),
      },
    });

    assert.strictEqual(res.status, 200, 'Expected 200 OK on /onboarding');
    const html = await res.text();

    // Verify key brand and onboarding strings
    assert.ok(html.includes('SpendSense AI'), 'Should include SpendSense AI brand');
    assert.ok(html.includes('Moliyaviy nazoratni'), 'Should include welcome headline');
    assert.ok(html.includes('Boshlash'), 'Should include initial CTA button');
  });

  it('Step 4: User completes onboarding, saving planning data and 0-balance goals', async () => {
    if (!adminClient) return;

    // Simulate completion
    await adminClient
      .from('profiles')
      .update({
        first_name: 'Anvar',
        last_name: 'Qodirov',
        declared_monthly_income: 6000000,
        declared_monthly_expenses: 5000000,
        target_expense_reduction_percent: 10,
        target_monthly_expenses: 4500000,
        onboarding_completed: true,
        onboarding_step: 6,
        onboarding_data: null,
      })
      .eq('id', testUserId);

    await adminClient.from('financial_goals').insert([
      {
        user_id: testUserId,
        name: 'MacBook Pro M4',
        target_amount: 15000000,
        current_amount: 0, // ZERO SAVED AMOUNT
        currency: 'UZS',
        status: 'in_progress',
      },
    ]);

    const { data: prof } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();
    assert.strictEqual(prof.onboarding_completed, true);
  });

  it('Step 5: Completed user accesses /dashboard and sees pristine clean financial account', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: {
        Cookie: session.getCookieHeader(),
      },
    });

    assert.strictEqual(res.status, 200, 'Expected 200 OK on /dashboard');
    const html = await res.text();

    // Verify User Display Name
    assert.ok(html.includes('Anvar Qodirov') || html.includes('Anvar'), 'User name should appear in greeting');

    // Verify Clean Balance & 0 Totals
    assert.ok(html.includes('0 soʻm'), 'Balance must be 0 soʻm');

    // Verify Empty State Messages
    assert.ok(html.includes('Hozircha tranzaksiyalar yo‘q.'), 'Transactions empty state headline must be present');
    assert.ok(html.includes('Daromad yoki xarajatlaringizni qo‘shishdan boshlang.'), 'Transactions empty state instruction must be present');
    assert.ok(html.includes('Hali budjet yaratilmagan.'), 'Budgets empty state must be present');
    assert.ok(html.includes('Jamg‘arma maqsadlari'), 'Savings goals header must be present');

    // Verify Planning Estimates card is rendered separately
    const normalizedHtml = html.replace(/\u00a0/g, ' ');
    const planIdx = normalizedHtml.indexOf('Dastlabki moliyaviy rejangiz');
    if (planIdx !== -1) {
      console.log('PLANNING SNIPPET:', normalizedHtml.substring(planIdx, planIdx + 600));
    }
    assert.ok(normalizedHtml.includes('Dastlabki moliyaviy rejangiz'), 'Planning card must be present');
    assert.ok(normalizedHtml.includes('6 000 000 soʻm'), 'Declared income must appear in planning card');
    assert.ok(normalizedHtml.includes('5 000 000 soʻm'), 'Declared expense must appear in planning card');
    assert.ok(normalizedHtml.includes('Kamaytirish maqsadi'), 'Reduction target must appear');

    // Verify Goals show 0% progress and 0 saved amount
    assert.ok(normalizedHtml.includes('MacBook Pro M4'), 'Created goal name must appear');
    assert.ok(normalizedHtml.includes('0%'), 'Goal progress must be 0%');
  });

  it('Step 6: Completed user visiting /onboarding is redirected straight to /dashboard', async () => {
    const res = await fetch(`${BASE_URL}/onboarding`, {
      headers: {
        Cookie: session.getCookieHeader(),
      },
      redirect: 'manual',
    });

    const location = res.headers.get('location');
    assert.ok(
      res.status === 307 || res.status === 302 || location?.includes('/dashboard'),
      `Expected redirect to /dashboard for completed user, got status ${res.status} location: ${location}`
    );
    assert.ok(location?.includes('/dashboard'), `Expected redirect to /dashboard, got: ${location}`);
  });
});
