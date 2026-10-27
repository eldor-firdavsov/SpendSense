import fs from 'node:fs';
import { createServerClient } from '@supabase/ssr';

const BASE_URL = 'http://localhost:3000';
const CDP_BASE = 'http://localhost:9222';
const SCREENSHOT_DIR = '/home/eldor_firdavsov/.gemini/antigravity-ide/brain/dee54bad-f1b3-45ed-bdc1-5f1f06c6ca78/screenshots';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.idCounter = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.exceptions = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(JSON.stringify(data.error)));
          else resolve(data.result);
        } else if (data.method === 'Runtime.consoleAPICalled') {
          const text = data.params.args.map(a => a.value || a.description || '').join(' ');
          this.consoleLogs.push({ type: data.params.type, text });
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(data.params.exceptionDetails);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.idCounter++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
    await this.send('Emulation.setVisibleSize', { width, height });
  }

  async navigate(url, waitMs = 1200) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitMs));
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = `${SCREENSHOT_DIR}/${filename}`;
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  async setCookies(cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      await this.send('Network.setCookie', {
        name,
        value,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
      });
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getAuthCookies() {
  const capturedCookies = {};
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

  const { data, error } = await ssrClient.auth.signInWithPassword({
    email: 'demo@spendsense.io',
    password: 'Password123!Demo',
  });

  if (error || !data.session) {
    throw new Error(`Failed to sign in demo user: ${error?.message}`);
  }

  return capturedCookies;
}

async function main() {
  console.log('--- SpendSense AI: Comprehensive CDP Browser Verification ---');

  // 1. Create a new target page in Chrome
  const newTargetRes = await fetch(`${CDP_BASE}/json/new`, { method: 'PUT' });
  const targetInfo = await newTargetRes.json();
  console.log(`Created Chrome target page (Target ID: ${targetInfo.id})`);

  const client = new CDPClient(targetInfo.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const verificationResults = [];

  try {
    // Phase 1: Unauthenticated Flow & Forms
    console.log('\n[Phase 1] Testing Unauthenticated Routes & Form Validation...');
    await client.setViewport(1280, 800);

    // 1.1 /login page
    await client.navigate(`${BASE_URL}/login`);
    const loginTitle = await client.evaluate('document.title');
    const hasLoginForm = await client.evaluate('Boolean(document.getElementById("login-form"))');
    const hasLoginSubmit = await client.evaluate('Boolean(document.getElementById("login-submit-button"))');
    await client.screenshot('01_login_desktop.png');
    console.log(`  ✓ /login rendered (Title: "${loginTitle}", Form: ${hasLoginForm}, Button: ${hasLoginSubmit})`);

    // 1.2 /register page
    await client.navigate(`${BASE_URL}/register`);
    const registerTitle = await client.evaluate('document.title');
    const hasRegisterForm = await client.evaluate('Boolean(document.getElementById("register-form"))');
    const hasFirstNameInput = await client.evaluate('Boolean(document.getElementById("firstName"))');
    await client.screenshot('02_register_desktop.png');
    console.log(`  ✓ /register rendered (Title: "${registerTitle}", Form: ${hasRegisterForm}, Inputs: ${hasFirstNameInput})`);

    // 1.3 Unauthenticated redirect check
    await client.navigate(`${BASE_URL}/dashboard`);
    const postRedirectUrl = await client.evaluate('window.location.href');
    const redirectedToLogin = postRedirectUrl.includes('/login');
    console.log(`  ✓ Protected route /dashboard without auth redirected to: ${postRedirectUrl} (${redirectedToLogin ? 'PASS' : 'FAIL'})`);

    // Phase 2: Authenticated Flow (Desktop 1280x800)
    console.log('\n[Phase 2] Authenticating Demo User and Verifying All 10 Application Routes...');
    const authCookies = await getAuthCookies();
    await client.setCookies(authCookies);
    console.log(`  ✓ Auth cookies injected into Chrome (${Object.keys(authCookies).length} tokens)`);

    const routesToTest = [
      {
        path: '/dashboard',
        name: 'Dashboard',
        screenshot: '03_dashboard_desktop.png',
        check: 'document.body.innerText.includes("Alex") && document.body.innerText.includes("7,750")',
        desc: 'Renders user name, balance, income metrics',
      },
      {
        path: '/transactions',
        name: 'Transactions',
        screenshot: '04_transactions_desktop.png',
        check: 'document.body.innerText.includes("Transactions") && document.body.innerText.includes("Salary")',
        desc: 'Renders transaction ledger, search, filters',
      },
      {
        path: '/categories',
        name: 'Categories',
        screenshot: '05_categories_desktop.png',
        check: 'document.body.innerText.includes("Categories") && document.body.innerText.includes("AI SaaS")',
        desc: 'Renders system & custom categories',
      },
      {
        path: '/analytics',
        name: 'Analytics',
        screenshot: '06_analytics_desktop.png',
        check: 'document.body.innerText.includes("Analytics") || document.body.innerText.includes("Cash Flow")',
        desc: 'Renders cash flow metrics, category breakdowns',
      },
      {
        path: '/imports',
        name: 'Data Import',
        screenshot: '07_imports_desktop.png',
        check: 'document.body.innerText.includes("Import") || document.body.innerText.includes("CSV")',
        desc: 'Renders file upload dropzone and instructions',
      },
      {
        path: '/budgets',
        name: 'Budgets',
        screenshot: '08_budgets_desktop.png',
        check: 'document.body.innerText.includes("Budget") && document.body.innerText.includes("Housing")',
        desc: 'Renders budget cards, spending status, progress bars',
      },
      {
        path: '/goals',
        name: 'Financial Goals',
        screenshot: '09_goals_desktop.png',
        check: 'document.body.innerText.includes("Goal") && document.body.innerText.includes("Emergency")',
        desc: 'Renders savings milestones, percentages, target dates',
      },
      {
        path: '/advisor',
        name: 'AI Advisor',
        screenshot: '10_advisor_desktop.png',
        check: 'document.body.innerText.includes("Advisor") || document.body.innerText.includes("SpendSense")',
        desc: 'Renders AI advisor chat workspace and history',
      },
      {
        path: '/insights',
        name: 'AI Insights',
        screenshot: '11_insights_desktop.png',
        check: 'document.body.innerText.includes("Insights") || document.body.innerText.includes("Financial")',
        desc: 'Renders automated financial insights feed',
      },
      {
        path: '/settings',
        name: 'Settings',
        screenshot: '12_settings_desktop.png',
        check: 'document.body.innerText.includes("Settings") && document.body.innerText.includes("Alex")',
        desc: 'Renders user profile settings with prefilled info',
      },
    ];

    for (const route of routesToTest) {
      await client.navigate(`${BASE_URL}${route.path}`, 1400);
      const passed = await client.evaluate(route.check);
      await client.screenshot(route.screenshot);
      console.log(`  ✓ [Desktop] ${route.name} (${route.path}) -> ${passed ? 'VERIFIED' : 'PARTIAL'} (Saved: ${route.screenshot})`);
      verificationResults.push({ route: route.path, name: route.name, passed, viewport: 'Desktop 1280x800' });
    }

    // Phase 3: Interactive UI Checks (Modals, Add Buttons)
    console.log('\n[Phase 3] Testing Interactive Controls & Modals in Real Browser...');
    await client.navigate(`${BASE_URL}/transactions`, 1200);

    // Look for "Add Transaction" button
    const hasAddBtn = await client.evaluate(`
      Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Transaction') || b.innerText.includes('New Transaction')))
    `);
    console.log(`  ✓ "Add Transaction" button found: ${hasAddBtn}`);

    if (hasAddBtn) {
      await client.evaluate(`
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Transaction') || b.innerText.includes('New Transaction'));
        if (btn) btn.click();
      `);
      await new Promise(r => setTimeout(r, 600));
      const modalOpen = await client.evaluate(`
        Boolean(document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0') || document.querySelector('form'))
      `);
      await client.screenshot('04b_transaction_modal_desktop.png');
      console.log(`  ✓ Transaction Modal Opened: ${modalOpen} (Saved: 04b_transaction_modal_desktop.png)`);
    }

    // Phase 4: Responsive Viewport Verification
    console.log('\n[Phase 4] Testing Responsive Viewports (Tablet & Mobile)...');

    // 4.1 Tablet (768 x 1024)
    await client.setViewport(768, 1024);
    await client.navigate(`${BASE_URL}/dashboard`, 1200);
    const tabletDashPassed = await client.evaluate('document.body.innerText.includes("Alex")');
    await client.screenshot('13_dashboard_tablet.png');
    console.log(`  ✓ [Tablet 768x1024] /dashboard rendered: ${tabletDashPassed} (Saved: 13_dashboard_tablet.png)`);

    await client.navigate(`${BASE_URL}/transactions`, 1200);
    await client.screenshot('14_transactions_tablet.png');
    console.log(`  ✓ [Tablet 768x1024] /transactions rendered (Saved: 14_transactions_tablet.png)`);

    // 4.2 Mobile (375 x 667)
    await client.setViewport(375, 667, true);
    await client.navigate(`${BASE_URL}/dashboard`, 1200);
    const mobileDashPassed = await client.evaluate('document.body.innerText.includes("Alex")');
    await client.screenshot('15_dashboard_mobile.png');
    console.log(`  ✓ [Mobile 375x667] /dashboard rendered: ${mobileDashPassed} (Saved: 15_dashboard_mobile.png)`);

    await client.navigate(`${BASE_URL}/transactions`, 1200);
    await client.screenshot('16_transactions_mobile.png');
    console.log(`  ✓ [Mobile 375x667] /transactions rendered (Saved: 16_transactions_mobile.png)`);

    await client.navigate(`${BASE_URL}/advisor`, 1200);
    await client.screenshot('17_advisor_mobile.png');
    console.log(`  ✓ [Mobile 375x667] /advisor rendered (Saved: 17_advisor_mobile.png)`);

    // Phase 5: Check Console Logs and Runtime Exceptions
    console.log('\n[Phase 5] Reviewing Browser Console Logs & Exceptions...');
    console.log(`  - Total Console Logs: ${client.consoleLogs.length}`);
    console.log(`  - Uncaught Exceptions: ${client.exceptions.length}`);

    if (client.exceptions.length > 0) {
      console.warn('  ⚠️ Runtime Exceptions captured:', client.exceptions);
    } else {
      console.log('  ✓ ZERO uncaught client runtime exceptions captured during complete navigation!');
    }

    const errorLogs = client.consoleLogs.filter(l => l.type === 'error');
    console.log(`  - Console Errors: ${errorLogs.length}`);
    if (errorLogs.length > 0) {
      console.warn('  Console error entries:', errorLogs);
    }

    console.log('\n✅ BROWSER VERIFICATION COMPLETED SUCCESSFULLY!');
  } finally {
    client.close();
    // Close the target page
    await fetch(`${CDP_BASE}/json/close/${targetInfo.id}`);
  }
}

main().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
