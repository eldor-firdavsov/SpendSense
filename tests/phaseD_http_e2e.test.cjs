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

describe('Phase D — HTTP & SSR E2E Server Tests', () => {
  let createdUserId = null;
  let testEmail = `phase_d_http_${Date.now()}@example.com`;
  let testPassword = 'Password123!';
  let authCookieHeader = '';
  let adminClient = null;
  let systemExpenseCategoryId = null;

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
        const { data: sysExp } = await adminClient
          .from('categories')
          .select('id')
          .eq('is_system', true)
          .eq('type', 'expense')
          .limit(1)
          .single();
        if (sysExp) {
          systemExpenseCategoryId = sysExp.id;
        }
      }
    } catch (e) {
      console.error('Error obtaining service key:', e.message);
    }
  });

  after(async () => {
    if (adminClient && createdUserId) {
      try {
        await adminClient.from('categories').delete().eq('user_id', createdUserId);
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (err) {
        console.error('Error cleaning up HTTP test user:', err.message);
      }
    }
  });

  test('GET /categories (unauthenticated) redirects to /login', async () => {
    const res = await fetch(BASE_URL + '/categories', { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'));
  });

  test('GET /api/categories (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/categories');
    assert.strictEqual(res.status, 401);
  });

  test('POST /api/categories (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked', type: 'expense' }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('PUT /api/categories/some-id (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/categories/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('DELETE /api/categories/some-id (unauthenticated) returns 401', async () => {
    const res = await fetch(BASE_URL + '/api/categories/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
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
          first_name: 'Category',
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

  test('Authenticated request to /categories renders page with Category Management', async () => {
    const res = await fetch(BASE_URL + '/categories', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Category Management'));
    assert.ok(html.includes('Add Custom Category'));
  });

  let createdCustomCategoryId = null;

  test('Authenticated HTTP API: create custom category via POST /api/categories', async () => {
    const res = await fetch(BASE_URL + '/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieHeader,
      },
      body: JSON.stringify({
        name: 'E2E Specialty Hobbies',
        type: 'expense',
        description: 'Testing custom hobby category',
        color: '#8b5cf6',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.category?.id);
    assert.strictEqual(body.category.name, 'E2E Specialty Hobbies');
    assert.strictEqual(body.category.type, 'expense');
    assert.strictEqual(body.category.color, '#8b5cf6');
    assert.strictEqual(body.category.is_system, false);
    createdCustomCategoryId = body.category.id;
  });

  test('Authenticated HTTP API: list categories and verify custom category is present', async () => {
    const res = await fetch(BASE_URL + '/api/categories', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.categories));
    const custom = body.categories.find((c) => c.id === createdCustomCategoryId);
    assert.ok(custom, 'Created custom category must be in categories list');
    assert.strictEqual(custom.name, 'E2E Specialty Hobbies');
  });

  test('Authenticated HTTP API: type filtering via GET /api/categories?type=expense', async () => {
    const res = await fetch(BASE_URL + '/api/categories?type=expense', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.categories.length > 0);
    assert.ok(body.categories.every((c) => c.type === 'expense'));
  });

  test('Authenticated HTTP API: update custom category via PUT /api/categories/[id]', async () => {
    const res = await fetch(BASE_URL + `/api/categories/${createdCustomCategoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookieHeader,
      },
      body: JSON.stringify({
        name: 'E2E Premium Hobbies',
        color: '#10b981',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.category.name, 'E2E Premium Hobbies');
    assert.strictEqual(body.category.color, '#10b981');
  });

  test('Authenticated HTTP API: system category deletion is forbidden (HTTP 403)', async () => {
    assert.ok(systemExpenseCategoryId, 'System expense category required');
    const res = await fetch(BASE_URL + `/api/categories/${systemExpenseCategoryId}`, {
      method: 'DELETE',
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('System categories cannot be deleted'));
  });

  test('Authenticated HTTP API: delete custom category via DELETE /api/categories/[id]', async () => {
    const res = await fetch(BASE_URL + `/api/categories/${createdCustomCategoryId}`, {
      method: 'DELETE',
      headers: { Cookie: authCookieHeader },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // Verify it is gone via GET /api/categories/[id]
    const checkRes = await fetch(BASE_URL + `/api/categories/${createdCustomCategoryId}`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(checkRes.status, 404);
  });
});
