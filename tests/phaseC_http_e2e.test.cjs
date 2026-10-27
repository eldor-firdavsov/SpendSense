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

describe('Phase C — HTTP & SSR E2E Server Tests', () => {
  let createdUserId = null;
  let testEmail = `phase_c_http_${Date.now()}@example.com`;
  let testPassword = 'Password123!';
  let authCookieHeader = '';
  let adminClient = null;

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
  });

  after(async () => {
    if (adminClient && createdUserId) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (err) {
        console.error('Error cleaning up HTTP test user:', err.message);
      }
    }
  });

  test('GET /transactions (unauthenticated) redirects via proxy to /login', async () => {
    const res = await fetch(BASE_URL + '/transactions', { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'));
  });

  test('GET /api/transactions (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/transactions');
    assert.strictEqual(res.status, 401);
  });

  test('POST /api/transactions (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Hacked', amount: 10, type: 'expense' }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('Register and authenticate HTTP user to obtain session cookies', async () => {
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
          first_name: 'E2E',
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
    assert.ok(authCookieHeader.length > 0);
  });

  test('Authenticated request to /transactions renders page with Add Transaction button', async () => {
    const res = await fetch(BASE_URL + '/transactions', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Transactions'));
    assert.ok(html.includes('Add Transaction'));
  });

  test('Authenticated HTTP API: create, list, and delete a transaction', async () => {
    // 1. Create transaction via POST /api/transactions
    const createRes = await fetch(BASE_URL + '/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieHeader,
      },
      body: JSON.stringify({
        description: 'HTTP E2E Coffee',
        amount: 5.75,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
        merchant: 'Blue Bottle',
      }),
    });

    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json();
    assert.ok(createBody.transaction?.id);
    const newTxId = createBody.transaction.id;

    // 2. List transactions via GET /api/transactions
    const listRes = await fetch(BASE_URL + '/api/transactions?search=Blue+Bottle', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.strictEqual(listBody.totalCount, 1);
    assert.strictEqual(listBody.transactions[0].id, newTxId);
    assert.strictEqual(Number(listBody.transactions[0].amount), 5.75);

    // 3. Delete transaction via DELETE /api/transactions/[id]
    const delRes = await fetch(BASE_URL + `/api/transactions/${newTxId}`, {
      method: 'DELETE',
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(delRes.status, 200);

    // 4. Verify transaction is gone
    const checkRes = await fetch(BASE_URL + `/api/transactions/${newTxId}`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(checkRes.status, 404);
  });
});
