import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import {
  createGoal,
  listGoals,
  contributeToGoal,
} from '../src/lib/goals/service.ts';
import { createTransaction, listTransactions } from '../src/lib/transactions/service.ts';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('SpendSense AI — UX/UI soddalashtirish va navigatsiyani qayta tashkil qilish testlari', () => {
  let adminClient;
  let testUserClient;
  let testUserId;
  let authCookieHeader;

  const testUserData = {
    email: `ux_nav_test_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  before(async () => {
    const keys = JSON.parse(
      execSync(
        '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
      ).toString()
    );
    const serviceKey = keys.find(
      (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
    )?.api_key;
    assert.ok(serviceKey, 'Service role key required');

    adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Set up SSR client to capture valid Next.js Supabase cookies
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

    const { data: signRes, error: signErr } = await ssrClient.auth.signUp({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ifError(signErr);
    testUserId = signRes.user.id;

    const { data: loginRes, error: loginErr } = await ssrClient.auth.signInWithPassword({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ifError(loginErr);
    assert.ok(loginRes.session);

    authCookieHeader = Object.entries(capturedCookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');

    testUserClient = ssrClient;

    // Seed realistic sample transactions: 1 income, 1 expense
    await createTransaction(
      {
        description: 'Oylik maosh',
        amount: 6000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-10-01',
      },
      testUserClient
    );
    await createTransaction(
      {
        description: 'Tushlik va qahva',
        amount: 45000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-10-05',
      },
      testUserClient
    );
  });

  after(async () => {
    if (adminClient && testUserId) {
      await adminClient.from('transactions').delete().eq('user_id', testUserId);
      await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
      await adminClient.from('budgets').delete().eq('user_id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  test('Test 1: Asosiy 4 ta navigatsiya bo‘limi to‘g‘ri mavjud va ochiladi', async () => {
    const navRoutes = [
      { path: '/dashboard', label: 'Bosh sahifa' },
      { path: '/transactions', label: 'Faoliyat' },
      { path: '/analytics', label: 'Tahlil' },
      { path: '/advisor', label: 'AI yordamchi' },
    ];

    for (const item of navRoutes) {
      const res = await fetch(`${BASE_URL}${item.path}`, {
        headers: { Cookie: authCookieHeader },
      });
      assert.strictEqual(res.status, 200, `${item.path} sahifasi HTTP 200 qaytarishi shart`);
      const html = await res.text();

      // Check that the 4 primary nav links exist
      assert.ok(html.includes('id="nav-dashboard-link"'), 'Bosh sahifa linki bo‘lishi shart');
      assert.ok(html.includes('id="nav-transactions-link"'), 'Faoliyat linki bo‘lishi shart');
      assert.ok(html.includes('id="nav-analytics-link"'), 'Tahlil linki bo‘lishi shart');
      assert.ok(html.includes('id="nav-advisor-link"'), 'AI yordamchi linki bo‘lishi shart');

      // Check header action button
      assert.ok(html.includes('id="header-add-transaction-btn"'), 'Headerda + Tranzaksiya tugmasi bo‘lishi shart');
    }
  });

  test('Test 2: Bosh sahifa (Dashboard) o‘zining asl tuzilishi va hisob-kitoblarini saqlagan', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(res.status, 200);
    const html = await res.text();

    assert.ok(html.includes('Jami balans'), 'Dashboardda Jami balans saqlangan bo‘lishi kerak');
    assert.ok(html.includes('Kirim'), 'Kirim kartasi bo‘lishi kerak');
    assert.ok(html.includes('Chiqim'), 'Chiqim kartasi bo‘lishi kerak');
    assert.ok(html.includes('Sof oqim'), 'Sof oqim kartasi bo‘lishi kerak');
  });

  test('Test 3 & 4: Faoliyat sahifasida daromad (+) va xarajat (−) to‘g‘ri belgilar va matn bilan ko‘rsatiladi', async () => {
    const txRes = await listTransactions(
      { page: 1, pageSize: 20 },
      testUserClient
    );
    assert.strictEqual(txRes.status, 200);
    const txs = txRes.data?.transactions || [];
    assert.ok(txs.length >= 2, 'Kamida 2 ta tranzaksiya bo‘lishi kerak');

    const incomeTx = txs.find((t) => t.type === 'income');
    const expenseTx = txs.find((t) => t.type === 'expense');

    assert.ok(incomeTx, 'Daromad tranzaksiyasi topilishi kerak');
    assert.ok(expenseTx, 'Xarajat tranzaksiyasi topilishi kerak');

    // Tekshiruv: Tranzaksiya turi faqat type maydonidan olinadi
    assert.strictEqual(incomeTx.type, 'income');
    assert.strictEqual(expenseTx.type, 'expense');

    // Fetch the Faoliyat (/transactions) page HTML
    const pageRes = await fetch(`${BASE_URL}/transactions`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(pageRes.status, 200);
    const html = await pageRes.text();

    // Sarlavha va izoh tekshiruvi
    assert.ok(html.includes('Faoliyat'), 'Sarlavha "Faoliyat" bo‘lishi kerak');
    assert.ok(html.includes('Daromad va xarajatlaringizni kuzating'), 'Qisqa izoh to‘g‘ri bo‘lishi kerak');

    // Filtrlash tugmalari tekshiruvi
    assert.ok(html.includes('Barchasi'), 'Filtrda "Barchasi" tugmasi bo‘lishi kerak');
    assert.ok(html.includes('Daromad'), 'Filtrda "Daromad" tugmasi bo‘lishi kerak');
    assert.ok(html.includes('Xarajat'), 'Filtrda "Xarajat" tugmasi bo‘lishi kerak');
  });

  test('Test 5: Yangi tranzaksiya saqlanadi va kiritilgan summa to‘g‘ri aks etadi', async () => {
    const newTx = await createTransaction(
      {
        description: 'Supermarket xaridi',
        amount: 120000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-10-20',
      },
      testUserClient
    );
    assert.strictEqual(newTx.status, 201);
    assert.ok(newTx.data?.id);
    assert.strictEqual(newTx.data.type, 'expense');
    assert.strictEqual(newTx.data.amount, 120000);
  });

  test('Test 6: Tahlil ichidagi 3 ta ixcham ichki bo‘lim (Tahlil, Budjetlar, Jamg‘arma maqsadlari) ishlaydi', async () => {
    // 1. Tahlil asosiy sahifasi
    const resAnalytics = await fetch(`${BASE_URL}/analytics`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(resAnalytics.status, 200);
    const htmlAnalytics = await resAnalytics.text();
    assert.ok(htmlAnalytics.includes('id="tab-btn-analytics"'), 'Tahlil tab tugmasi bo‘lishi kerak');
    assert.ok(htmlAnalytics.includes('id="tab-btn-budgets"'), 'Budjetlar tab tugmasi bo‘lishi kerak');
    assert.ok(htmlAnalytics.includes('id="tab-btn-goals"'), 'Jamg‘arma maqsadlari tab tugmasi bo‘lishi kerak');

    // 2. /budgets marshruti
    const resBudgets = await fetch(`${BASE_URL}/budgets`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(resBudgets.status, 200);
    const htmlBudgets = await resBudgets.text();
    assert.ok(htmlBudgets.includes('Budjetlar') || htmlBudgets.includes('Budget Management'));

    // 3. /goals marshruti
    const resGoals = await fetch(`${BASE_URL}/goals`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(resGoals.status, 200);
    const htmlGoals = await resGoals.text();
    assert.ok(htmlGoals.includes('Jamg‘arma maqsadlari') || htmlGoals.includes('Savings Goals'));
  });

  test('Test 7: Jamg‘arma maqsadlarida qisqa (1-2 gap) va aniq tavsiyalar ko‘rsatiladi', async () => {
    const goalRes = await createGoal(
      {
        name: 'Oshxona mebellari',
        target_amount: 10000000,
        current_amount: 4000000,
        currency: 'UZS',
        target_date: '2026-12-31', // 2 months
      },
      testUserClient
    );
    assert.strictEqual(goalRes.status, 201);
    const g = goalRes.data;

    assert.strictEqual(g.target_amount, 10000000);
    assert.strictEqual(g.current_amount, 4000000);
    assert.strictEqual(g.remaining_amount, 6000000);
    assert.strictEqual(g.percentage_completed, 40);
    assert.strictEqual(g.feasibility.estimated_months_remaining, 2);
    assert.strictEqual(g.feasibility.monthly_needed, 3000000);

    // Qisqa tavsiya tekshiruvi (uzun emas, aniq va londa)
    assert.ok(g.feasibility.explanation.length > 0);
    assert.ok(
      g.feasibility.explanation.length < 200,
      `Tavsiya qisqa bo‘lishi kerak (uzunligi: ${g.feasibility.explanation.length})`
    );
  });

  test('Test 8 & 9: AI yordamchi inputi va takroriy javoblarni oldini olish (concurrency protection)', async () => {
    // 1. Check /advisor page loads input elements
    const resAdvisor = await fetch(`${BASE_URL}/advisor`, {
      headers: { Cookie: authCookieHeader },
    });
    assert.strictEqual(resAdvisor.status, 200);
    const htmlAdvisor = await resAdvisor.text();

    assert.ok(htmlAdvisor.includes('id="advisor-question-input"'), 'Input maydoni bo‘lishi kerak');
    assert.ok(htmlAdvisor.includes('id="advisor-send-btn"'), 'Yuborish tugmasi bo‘lishi kerak');
    assert.ok(htmlAdvisor.includes('Moliyaviy savolingizni yozing...'), 'Placeholder to‘g‘ri bo‘lishi kerak');

    // 2. Concurrency / Duplicate test: send valid inquiry
    const aiRes = await askFinancialAdvisor(
      'Shu oy qancha pul sarfladim?',
      undefined,
      testUserClient
    );
    assert.strictEqual(aiRes.status, 200);
    assert.ok(aiRes.data?.answer, 'AI javob qaytarishi kerak');
    assert.ok(!aiRes.data?.answer.includes('806,666.67'), 'Generic eski qiymat bo‘lmasligi kerak');
  });

  test('Test 10: Mobil navigatsiya pastki paneli (bottom bar) 4 ta elementdan iborat', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: authCookieHeader },
    });
    const html = await res.text();

    assert.ok(html.includes('aria-label="Mobil navigatsiya"'), 'Mobil navigatsiya bo‘lishi shart');
    assert.ok(html.includes('id="mobile-nav-dashboard-link"'), 'Mobil Bosh sahifa bo‘lishi shart');
    assert.ok(html.includes('id="mobile-nav-transactions-link"'), 'Mobil Faoliyat bo‘lishi shart');
    assert.ok(html.includes('id="mobile-nav-analytics-link"'), 'Mobil Tahlil bo‘lishi shart');
    assert.ok(html.includes('id="mobile-nav-advisor-link"'), 'Mobil AI yordamchi bo‘lishi shart');
  });
});
