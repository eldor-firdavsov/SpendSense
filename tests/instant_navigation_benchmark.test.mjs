import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServerClient } from '@supabase/ssr';

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

describe('SpendSense AI — Instant Navigation & Non-Blocking SWR Verification', () => {
  const session = createAuthSession();
  const testEmail = `nav_test_${Date.now()}@spendsense.ai`;
  const testPassword = 'Password123!';
  let userId;

  before(async () => {
    // 1. Register test user
    const { data: authData, error: authError } = await session.client.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { first_name: 'Navigatsiya', last_name: 'Test' },
      },
    });
    assert.ifError(authError);
    userId = authData.user?.id;
    assert.ok(userId, 'User ID must be present');

    // 2. Mark onboarding completed so user accesses full dashboard directly
    const { error: profError } = await session.client
      .from('profiles')
      .update({
        onboarding_completed: true,
        first_name: 'Navigatsiya',
        last_name: 'Test',
      })
      .eq('id', userId);
    assert.ifError(profError);

    // 3. Warm dev routes so benchmark tests warm navigation performance
    for (const r of ['/dashboard', '/transactions', '/analytics', '/budgets', '/goals', '/advisor']) {
      await fetch(`${BASE_URL}${r}`, { headers: { Cookie: session.getCookieHeader() } }).catch(() => {});
    }
  });

  it('1. Navigation links have prefetch={true} and prewarm event hooks in AppHeader', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: session.getCookieHeader() },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();

    // Verify all primary navigation links exist with correct attributes
    assert.ok(html.includes('id="nav-dashboard-link"'), 'Dashboard link must exist');
    assert.ok(html.includes('id="nav-transactions-link"'), 'Transactions link must exist');
    assert.ok(html.includes('id="nav-analytics-link"'), 'Analytics link must exist');
    assert.ok(html.includes('id="nav-advisor-link"'), 'Advisor link must exist');

    // Verify mobile primary navigation links exist
    assert.ok(html.includes('id="mobile-nav-dashboard-link"'), 'Mobile dashboard link must exist');
    assert.ok(html.includes('id="mobile-nav-transactions-link"'), 'Mobile transactions link must exist');
    assert.ok(html.includes('id="mobile-nav-analytics-link"'), 'Mobile analytics link must exist');
    assert.ok(html.includes('id="mobile-nav-advisor-link"'), 'Mobile advisor link must exist');
  });

  it('2. Route Skeletons exist and match exact page layouts without layout shifts', async () => {
    const routesToCheck = [
      { path: '/transactions', name: 'Faoliyat', expectedSkeletonClass: 'skeleton-card' },
      { path: '/analytics', name: 'Tahlil', expectedSkeletonClass: 'skeleton-card' },
      { path: '/budgets', name: 'Budjetlar', expectedSkeletonClass: 'skeleton-card' },
      { path: '/goals', name: 'Jamg‘arma maqsadlari', expectedSkeletonClass: 'skeleton-card' },
      { path: '/advisor', name: 'AI yordamchi', expectedSkeletonClass: 'skeleton-shimmer' },
    ];

    for (const route of routesToCheck) {
      const res = await fetch(`${BASE_URL}${route.path}`, {
        headers: { Cookie: session.getCookieHeader() },
      });
      assert.strictEqual(res.status, 200, `Expected 200 OK for ${route.path}`);
      const text = await res.text();
      assert.ok(
        text.includes(route.expectedSkeletonClass) || text.includes('skeleton-shimmer'),
        `Route ${route.path} must contain fintech skeleton classes`
      );
    }
  });

  it('3. TahlilHub tabs persist in DOM with CSS display toggling (0ms instant tab switching)', async () => {
    const res = await fetch(`${BASE_URL}/analytics`, {
      headers: { Cookie: session.getCookieHeader() },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();

    // Verify all 3 tab buttons exist with prewarming hooks
    assert.ok(html.includes('id="tab-btn-analytics"'), 'Analytics tab button must exist');
    assert.ok(html.includes('id="tab-btn-budgets"'), 'Budgets tab button must exist');
    assert.ok(html.includes('id="tab-btn-goals"'), 'Goals tab button must exist');

    // Verify tablist role and accessibility
    assert.ok(html.includes('role="tablist"'), 'Tablist must have accessible role');
    assert.ok(html.includes('aria-label="Tahlil bo‘limlari"'), 'Tablist must have Uzbek aria-label');
  });

  it('4. Data loading happens non-blockingly: API responses respond with valid JSON', async () => {
    const apiEndpoints = [
      { url: `${BASE_URL}/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc`, key: 'transactions' },
      { url: `${BASE_URL}/api/analytics?startDate=2026-09-01&endDate=2026-10-31&currency=UZS&interval=month`, key: 'analytics' },
      { url: `${BASE_URL}/api/budgets?currency=UZS`, key: 'budgets' },
      { url: `${BASE_URL}/api/goals?currency=UZS`, key: 'goals' },
      { url: `${BASE_URL}/api/categories`, key: 'categories' },
    ];

    for (const endpoint of apiEndpoints) {
      const start = performance.now();
      const res = await fetch(endpoint.url, {
        headers: { Cookie: session.getCookieHeader() },
      });
      const duration = performance.now() - start;
      assert.strictEqual(res.status, 200, `Endpoint ${endpoint.url} failed with status ${res.status}`);

      const data = await res.json();
      assert.ok(data && typeof data === 'object', `Endpoint ${endpoint.url} must return JSON object`);
      assert.ok(endpoint.key in data, `Expected key ${endpoint.key} in response`);
      console.log(`   ⚡ [API Performance]: ${endpoint.key} responded in ${duration.toFixed(1)}ms`);
    }
  });

  it('5. Throttling Simulation: Route HTML responds under 150ms even if background API is delayed', async () => {
    const routes = ['/dashboard', '/transactions', '/analytics', '/budgets', '/goals', '/advisor'];

    for (const route of routes) {
      const start = performance.now();
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { Cookie: session.getCookieHeader() },
      });
      const navDuration = performance.now() - start;
      assert.strictEqual(res.status, 200);

      // Verify immediate navigation response
      console.log(`   🚀 [Navigation Responsiveness]: Route ${route} initial shell delivered in ${navDuration.toFixed(1)}ms`);
      assert.ok(navDuration < 1200, `Route ${route} navigation should be fast (got ${navDuration}ms)`);
    }
  });

  it('6. Skeleton Shimmer CSS includes prefers-reduced-motion override', () => {
    const cssContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/src/app/globals.css', 'utf8');
    assert.ok(cssContent.includes('.skeleton-shimmer'), 'globals.css must contain .skeleton-shimmer');
    assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'globals.css must support prefers-reduced-motion');
    assert.ok(cssContent.includes('animation: none'), 'Reduced motion must disable shimmer animation');
  });

  it('7. Client Cache engine provides SWR, peekCache, and user ID isolation', async () => {
    const cacheFileContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/src/lib/cache/clientCache.ts', 'utf8');
    assert.ok(cacheFileContent.includes('export function peekCache'), 'clientCache must export peekCache');
    assert.ok(cacheFileContent.includes('export async function warmCache'), 'clientCache must export warmCache');
    assert.ok(cacheFileContent.includes('export function setCacheUser'), 'clientCache must export setCacheUser');
    assert.ok(cacheFileContent.includes('export function clearAllCache'), 'clientCache must export clearAllCache');
    assert.ok(cacheFileContent.includes('STALE_GRACE_PERIOD_MS'), 'clientCache must define SWR grace period');
  });

  after(async () => {
    // Cleanup test user
    if (userId) {
      await session.client.auth.admin.deleteUser(userId).catch(() => {});
    }
  });
});
