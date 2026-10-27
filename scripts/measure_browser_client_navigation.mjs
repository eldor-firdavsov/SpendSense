import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';

// Load Supabase configuration
const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const SUPABASE_ANON_KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getAuthCookies() {
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

  const { data, error } = await ssrClient.auth.signInWithPassword({
    email: 'e2e_shared_runner@spendsense.test',
    password: 'Password123!Secure',
  });
  if (error) throw error;

  return Object.entries(capturedCookies).map(([name, value]) => ({
    name,
    value,
    domain: 'localhost',
    path: '/',
  }));
}

async function runBrowserBenchmark() {
  console.log(`\n======================================================`);
  console.log(` SpendSense AI — Real Headless Chrome Browser Benchmark`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Authenticate to get real session cookies
  console.log('Authenticating test user with Supabase...');
  const cookies = await getAuthCookies();

  // 2. Launch Google Chrome headless with remote debugging port
  const port = 9222;
  const chromeProcess = spawn(
    'google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--window-size=1440,900',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // Wait for Chrome to listen
  await new Promise((r) => setTimeout(r, 1500));

  try {
    const versionRes = await fetch(`http://127.0.0.1:${port}/json/version`);
    const versionData = await versionRes.json();
    console.log(`Connected to ${versionData.Browser}`);

    // Create a new tab
    const newTabRes = await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT' });
    const tabData = await newTabRes.json();

    const cdp = new ChromeCDP(tabData.webSocketDebuggerUrl);
    await cdp.connect();

    // Enable Network & Page
    await cdp.send('Network.enable');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Set session cookies in Chrome's cookie jar
    for (const c of cookies) {
      await cdp.send('Network.setCookie', {
        name: c.name,
        value: c.value,
        domain: 'localhost',
        path: '/',
      });
    }

    console.log('\n--- 1. Cold Initial Full Document SSR Navigations ---');
    const directRoutes = [
      { name: '/dashboard', url: `${BASE_URL}/dashboard` },
      { name: '/transactions', url: `${BASE_URL}/transactions` },
      { name: '/analytics', url: `${BASE_URL}/analytics` },
      { name: '/budgets', url: `${BASE_URL}/budgets` },
      { name: '/goals', url: `${BASE_URL}/goals` },
      { name: '/advisor', url: `${BASE_URL}/advisor` },
    ];

    for (const r of directRoutes) {
      const t0 = performance.now();
      await cdp.send('Page.navigate', { url: r.url });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const elapsed = Math.round(performance.now() - t0);
      console.log(`Cold SSR Document Load -> ${r.name}: ${elapsed}ms`);
    }

    // Now start on /dashboard for SPA navigation flow
    await cdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` });
    await new Promise((resolve) => setTimeout(resolve, 600));

    console.log('\n--- 2. Client-Side SPA Transitions (Clicking Navigation Links in UI) ---');

    const transitions = [
      {
        name: 'Dashboard -> Activity (Faoliyat)',
        selector: '#nav-transactions-link',
        expectedUrl: '/transactions',
        readyCheck: 'document.querySelectorAll("table, [data-transaction-card], .space-y-6").length > 0',
      },
      {
        name: 'Activity -> Analytics (Tahlil)',
        selector: '#nav-analytics-link',
        expectedUrl: '/analytics',
        readyCheck: 'document.getElementById("tab-btn-analytics") !== null',
      },
      {
        name: 'Analytics -> Budgets (TahlilHub Tab)',
        selector: '#tab-btn-budgets',
        expectedUrl: 'budgets',
        readyCheck: 'document.querySelector("[role=tablist]") !== null',
      },
      {
        name: 'Budgets -> Jamg‘arma maqsadlari (TahlilHub Tab)',
        selector: '#tab-btn-goals',
        expectedUrl: 'goals',
        readyCheck: 'document.querySelector("[role=tablist]") !== null',
      },
      {
        name: 'Jamg‘arma maqsadlari -> AI Advisor (SayHalo Chat)',
        selector: '#nav-advisor-link',
        expectedUrl: '/advisor',
        readyCheck: 'document.querySelector("textarea, input[type=text]") !== null',
      },
      {
        name: 'AI Advisor -> Dashboard',
        selector: '#nav-dashboard-link',
        expectedUrl: '/dashboard',
        readyCheck: 'document.getElementById("user-display-name") !== null || document.body.innerText.includes("Moliyaviy holatingiz")',
      },
    ];

    const measurements = [];

    for (const t of transitions) {
      // Measure client-side click to UI render
      const clientTime = await cdp.evaluate(`
        new Promise((resolve) => {
          const btn = document.querySelector('${t.selector}') || 
                      document.querySelector('#mobile-' + '${t.selector}'.replace('#', '')) ||
                      Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href') === '${t.expectedUrl}');
          if (!btn) {
            resolve({ error: 'Selector ${t.selector} not found' });
            return;
          }
          const start = performance.now();
          btn.click();
          const checkInterval = setInterval(() => {
            const elapsed = Math.round(performance.now() - start);
            const isUrlMatched = window.location.pathname.includes('${t.expectedUrl}') || window.location.search.includes('${t.expectedUrl}');
            const isContentReady = (${t.readyCheck});
            if ((isUrlMatched && isContentReady) || elapsed > 8000) {
              clearInterval(checkInterval);
              resolve({ duration: elapsed, url: window.location.pathname + window.location.search });
            }
          }, 15);
        })
      `);

      console.log(`SPA: ${t.name}: ${clientTime.duration}ms (URL: ${clientTime.url})`);
      measurements.push({ ...t, duration: clientTime.duration });
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log('\n--- 3. Warm Revisit Transitions (In-Memory Client Cache Hit) ---');

    const warmTransitions = [
      {
        name: 'Warm Revisit -> Activity (Faoliyat)',
        selector: '#nav-transactions-link',
        expectedUrl: '/transactions',
        readyCheck: 'document.querySelectorAll("table, [data-transaction-card], .space-y-6").length > 0',
      },
      {
        name: 'Warm Revisit -> Analytics (Tahlil)',
        selector: '#nav-analytics-link',
        expectedUrl: '/analytics',
        readyCheck: 'document.getElementById("tab-btn-analytics") !== null',
      },
      {
        name: 'Warm Tab Switch -> Budgets (Preserved DOM)',
        selector: '#tab-btn-budgets',
        expectedUrl: 'budgets',
        readyCheck: 'document.querySelector("[role=tablist]") !== null',
      },
      {
        name: 'Warm Tab Switch -> Jamg‘arma maqsadlari (Preserved DOM)',
        selector: '#tab-btn-goals',
        expectedUrl: 'goals',
        readyCheck: 'document.querySelector("[role=tablist]") !== null',
      },
      {
        name: 'Warm Revisit -> AI Advisor',
        selector: '#nav-advisor-link',
        expectedUrl: '/advisor',
        readyCheck: 'document.querySelector("textarea, input[type=text]") !== null',
      },
      {
        name: 'Warm Revisit -> Dashboard',
        selector: '#nav-dashboard-link',
        expectedUrl: '/dashboard',
        readyCheck: 'document.getElementById("user-display-name") !== null || document.body.innerText.includes("Moliyaviy holatingiz")',
      },
    ];

    for (const t of warmTransitions) {
      const clientTime = await cdp.evaluate(`
        new Promise((resolve) => {
          const btn = document.querySelector('${t.selector}') || 
                      document.querySelector('#mobile-' + '${t.selector}'.replace('#', '')) ||
                      Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href') === '${t.expectedUrl}');
          if (!btn) {
            resolve({ error: 'Selector ${t.selector} not found' });
            return;
          }
          const start = performance.now();
          btn.click();

          const checkInterval = setInterval(() => {
            const elapsed = Math.round(performance.now() - start);
            const isUrlMatched = window.location.pathname.includes('${t.expectedUrl}') || window.location.search.includes('${t.expectedUrl}');
            const isContentReady = (${t.readyCheck});
            if ((isUrlMatched && isContentReady) || elapsed > 8000) {
              clearInterval(checkInterval);
              resolve({ duration: elapsed, url: window.location.pathname + window.location.search });
            }
          }, 10);
        })
      `);

      console.log(`WARM SPA: ${t.name}: ${clientTime.duration}ms`);
      await new Promise((r) => setTimeout(r, 200));
    }

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

runBrowserBenchmark().catch((err) => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
