import fs from 'node:fs';
import { createServerClient } from '/home/eldor_firdavsov/Desktop/SpendSense/node_modules/@supabase/ssr/dist/main/index.js';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const targetPort = process.env.TEST_PORT || '3001';
const DEV_URL = `http://localhost:${targetPort}`;

async function main() {
  const cookies = {};
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return Object.entries(cookies).map(([name, value]) => ({ name, value })); },
      setAll(c) { c.forEach(({ name, value }) => { cookies[name] = value; }); }
    }
  });

  const { error } = await client.auth.signInWithPassword({
    email: 'browser_test_user@spendsense.ai',
    password: 'Password123!Secure'
  });
  if (error) {
    console.error('Login error:', error);
    process.exit(1);
  }

  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  const routes = [
    '/dashboard',
    '/advisor',
    '/transactions',
    '/analytics',
    '/budgets',
    '/goals',
    '/categories',
    '/imports',
    '/settings'
  ];

  console.log('=== SpendSense Development Server Baseline Measurement (Port 3001) ===\n');

  const coldResults = [];
  for (const r of routes) {
    const t0 = performance.now();
    const res = await fetch(`${DEV_URL}${r}`, {
      headers: { Cookie: cookieHeader }
    });
    const t1 = performance.now();
    const body = await res.text();
    const t2 = performance.now();
    coldResults.push({
      route: r,
      status: res.status,
      ttfb: Math.round(t1 - t0),
      total: Math.round(t2 - t0),
      bytes: body.length
    });
  }

  console.log('--- Cold Navigation (First Hit) ---');
  console.table(coldResults);

  const warmResults = [];
  for (const r of routes) {
    const t0 = performance.now();
    const res = await fetch(`${DEV_URL}${r}`, {
      headers: { Cookie: cookieHeader }
    });
    const t1 = performance.now();
    const body = await res.text();
    const t2 = performance.now();
    warmResults.push({
      route: r,
      status: res.status,
      ttfb: Math.round(t1 - t0),
      total: Math.round(t2 - t0),
      bytes: body.length
    });
  }

  console.log('\n--- Warm Navigation (Repeat Hit) ---');
  console.table(warmResults);

  // Measure API routes
  const apiRoutes = [
    '/api/categories',
    '/api/transactions?page=1&pageSize=12',
    '/api/analytics?interval=month&currency=USD',
    '/api/budgets',
    '/api/goals',
    '/api/imports/jobs'
  ];

  const apiResults = [];
  for (const api of apiRoutes) {
    const t0 = performance.now();
    const res = await fetch(`${DEV_URL}${api}`, {
      headers: { Cookie: cookieHeader }
    });
    const t1 = performance.now();
    const body = await res.text();
    const t2 = performance.now();
    apiResults.push({
      endpoint: api,
      status: res.status,
      ttfb: Math.round(t1 - t0),
      total: Math.round(t2 - t0),
      bytes: body.length
    });
  }

  console.log('\n--- API Endpoints (Dev Server) ---');
  console.table(apiResults);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
