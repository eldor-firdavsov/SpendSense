import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';

import fs from 'node:fs';

let envContent = '';
try {
  envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
} catch {
  // ignore
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() ||
  'https://omzreoaaownshtzpqsdt.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const BASE_URL = 'http://localhost:3000';

describe('Phase 15 — Functional Frontend and SSR Routing Tests', () => {
  it('15.1 All 10 protected routes redirect unauthenticated users to /login', async () => {
    const protectedRoutes = [
      '/dashboard',
      '/transactions',
      '/categories',
      '/analytics',
      '/imports',
      '/budgets',
      '/goals',
      '/advisor',
      '/insights',
      '/settings',
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
      assert.equal(res.status, 307, `Expected 307 redirect for unauthenticated ${route}`);
      const location = res.headers.get('location');
      assert.ok(location?.includes('/login'), `Expected redirect location to contain /login`);
    }
  });

  it('15.2 Public auth routes (/login, /register) return HTTP 200', async () => {
    const loginRes = await fetch(`${BASE_URL}/login`);
    assert.equal(loginRes.status, 200);

    const regRes = await fetch(`${BASE_URL}/register`);
    assert.equal(regRes.status, 200);
  });

  it('15.3 Authenticated user can render all 10 product pages with SSR navigation', async () => {
    const sharedEmail = 'e2e_shared_runner@spendsense.test';
    const sharedPassword = 'Password123!Secure';

    let adminClient = null;
    try {
      const { execSync } = await import('node:child_process');
      const { createClient } = await import('@supabase/supabase-js');
      const keys = JSON.parse(
        execSync(
          '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
        ).toString()
      );
      const serviceKey = keys.find(
        (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
      )?.api_key;
      if (serviceKey) {
        adminClient = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
      }
    } catch {
      // ignore
    }

    const capturedCookies = {};
    const ssrClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    let { data: signInData, error: signInErr } = await ssrClient.auth.signInWithPassword({
      email: sharedEmail,
      password: sharedPassword,
    });

    if (signInErr || !signInData?.session) {
      if (adminClient) {
        await adminClient.auth.admin.createUser({
          email: sharedEmail,
          password: sharedPassword,
          email_confirm: true,
          user_metadata: { first_name: 'Frontend', last_name: 'Tester' },
        });
      } else {
        await ssrClient.auth.signUp({
          email: sharedEmail,
          password: sharedPassword,
          options: { data: { first_name: 'Frontend', last_name: 'Tester' } },
        });
      }
      const retry = await ssrClient.auth.signInWithPassword({
        email: sharedEmail,
        password: sharedPassword,
      });
      signInData = retry.data;
      signInErr = retry.error;
    }

    assert.equal(signInErr, null);
    assert.ok(signInData.session);

    const authCookieHeader = Object.entries(capturedCookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');

    const pages = [
      { route: '/dashboard', titleCheck: 'Welcome back' },
      { route: '/transactions', titleCheck: 'Transactions' },
      { route: '/categories', titleCheck: 'Category Management' },
      { route: '/analytics', titleCheck: 'Financial Analytics' },
      { route: '/imports', titleCheck: 'Import Transactions' },
      { route: '/budgets', titleCheck: 'Budget Management' },
      { route: '/goals', titleCheck: 'Savings Goals' },
      { route: '/advisor', titleCheck: 'SpendSense AI Advisor' },
      { route: '/insights', titleCheck: 'AI Insights' },
      { route: '/settings', titleCheck: 'Account Settings' },
    ];

    for (const p of pages) {
      const res = await fetch(`${BASE_URL}${p.route}`, {
        headers: { Cookie: authCookieHeader },
      });
      assert.equal(res.status, 200, `Page ${p.route} failed with status ${res.status}`);
      const text = await res.text();
      assert.ok(text.includes(p.titleCheck), `Page ${p.route} missing title check "${p.titleCheck}"`);
      assert.ok(text.includes('id="nav-dashboard-link"'), `${p.route} missing nav-dashboard-link`);
      assert.ok(text.includes('id="logout-button"'), `${p.route} missing logout-button`);
    }
  });
});
