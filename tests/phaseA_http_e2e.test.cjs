const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const { createClient } = require('/home/eldor_firdavsov/Desktop/SpendSense/node_modules/@supabase/supabase-js');
const { createServerClient } = require('/home/eldor_firdavsov/Desktop/SpendSense/node_modules/@supabase/ssr');

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const BASE_URL = 'http://localhost:3000';

describe('Phase A — HTTP & SSR E2E Server Tests', () => {
  let createdUserId = null;
  let testEmail = `phase_a_http_${Date.now()}@example.com`;
  let testPassword = 'Password123!';
  let authCookieHeader = '';

  test('GET / (unauthenticated) redirects via proxy to /login', async () => {
    const res = await fetch(BASE_URL + '/', { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'));
  });

  test('GET /dashboard (unauthenticated) redirects to /login', async () => {
    const res = await fetch(BASE_URL + '/dashboard', { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'));
  });

  test('GET /settings (unauthenticated) redirects to /login', async () => {
    const res = await fetch(BASE_URL + '/settings', { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'));
  });

  test('GET /register renders registration form', async () => {
    const res = await fetch(BASE_URL + '/register');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Create your SpendSense account'));
    assert.ok(html.includes('First Name'));
  });

  test('GET /login renders login form', async () => {
    const res = await fetch(BASE_URL + '/login');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Welcome back'));
    assert.ok(html.includes('Sign In'));
  });

  test('Register and authenticate user to obtain SSR session cookies', async () => {
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

    const { data, error } = await ssrClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: { data: { first_name: 'ServerE2EFirst', last_name: 'ServerE2ELast' } },
    });

    assert.strictEqual(error, null);
    assert.ok(data.user?.id);
    createdUserId = data.user.id;

    // Sign in to ensure fresh auth session cookies
    capturedCookies = {};
    const { data: signInData, error: signInErr } = await ssrClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(signInErr, null);
    assert.ok(signInData.session);

    authCookieHeader = Object.entries(capturedCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    assert.ok(authCookieHeader.length > 0);
  });

  test('Authenticated request to /dashboard renders user name in HTML', async () => {
    const res = await fetch(BASE_URL + '/dashboard', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('ServerE2EFirst'));
    assert.ok(html.includes('ServerE2ELast'));
  });

  test('Authenticated request to /settings renders ProfileForm with prefilled name', async () => {
    const res = await fetch(BASE_URL + '/settings', {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('ServerE2EFirst'));
    assert.ok(html.includes('ServerE2ELast'));
    assert.ok(html.includes('Save Profile') || html.includes('Profilni saqlash'));
  });

  test('Authenticated visitor on /login redirects to /dashboard via proxy', async () => {
    const res = await fetch(BASE_URL + '/login', {
      headers: { Cookie: authCookieHeader },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/dashboard'));
  });

  test('Authenticated visitor on /register redirects to /dashboard via proxy', async () => {
    const res = await fetch(BASE_URL + '/register', {
      headers: { Cookie: authCookieHeader },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/dashboard'));
  });

  test('Database cleanup of HTTP test user', async () => {
    if (createdUserId) {
      try {
        const keys = JSON.parse(
          execSync(
            '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
          ).toString()
        );
        const serviceKey = keys.find(k => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role'))?.api_key;
        if (serviceKey) {
          const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
          await adminClient.auth.admin.deleteUser(createdUserId);
        }
      } catch (err) {
        console.error('Error during cleanup:', err.message);
      }
    }
  });
});
