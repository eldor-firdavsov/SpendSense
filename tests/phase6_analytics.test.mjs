import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { getAnalyticsSummary } from '../src/lib/analytics/service.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';
import { createCategory } from '../src/lib/categories/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase 6 — Deterministic Financial Analytics Backend Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;
  let catDiningId;
  let catSalaryId;

  const userAData = {
    email: `phase6_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    email: `phase6_user_b_${Date.now()}@example.com`,
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

    // User A
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await clientA.auth.signUp({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ifError(errA);
    userAId = signA.user.id;

    const { data: loginA } = await clientA.auth.signInWithPassword({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ok(loginA.session);

    // User B
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientB.auth.signUp({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ifError(errB);
    userBId = signB.user.id;

    const { data: loginB } = await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ok(loginB.session);

    // Create categories for User A
    const catDining = await createCategory(
      { name: 'Analytics Dining', type: 'expense', color: '#ef4444' },
      clientA
    );
    assert.strictEqual(catDining.status, 201);
    catDiningId = catDining.data.id;

    const catSalary = await createCategory(
      { name: 'Analytics Salary', type: 'income', color: '#10b981' },
      clientA
    );
    assert.strictEqual(catSalary.status, 201);
    catSalaryId = catSalary.data.id;

    // Seed User A transactions for October 2026
    // Income: 5000.00
    await createTransaction(
      {
        description: 'Monthly Paycheck',
        amount: 5000.0,
        currency: 'USD',
        type: 'income',
        transaction_date: '2026-10-01',
        category_id: catSalaryId,
      },
      clientA
    );

    // Expense 1: 150.00
    await createTransaction(
      {
        description: 'Fine Dining Dinner',
        amount: 150.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-05',
        category_id: catDiningId,
      },
      clientA
    );

    // Expense 2: 50.00
    await createTransaction(
      {
        description: 'Lunch with Team',
        amount: 50.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-10',
        category_id: catDiningId,
      },
      clientA
    );

    // Expense 3 (Uncategorized): 300.00
    await createTransaction(
      {
        description: 'Uncategorized Hardware',
        amount: 300.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-15',
      },
      clientA
    );

    // User A transaction in EUR (should NOT be mixed into USD analytics)
    await createTransaction(
      {
        description: 'European Conference',
        amount: 800.0,
        currency: 'EUR',
        type: 'expense',
        transaction_date: '2026-10-12',
      },
      clientA
    );

    // User B transaction in USD (should NOT appear in User A's analytics)
    await createTransaction(
      {
        description: 'User B Secret Expense',
        amount: 9999.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-15',
      },
      clientB
    );
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('categories').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('categories').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  test('6.1 Computes exact totals, net cash flow, and savings rate', async () => {
    const res = await getAnalyticsSummary(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        currency: 'USD',
      },
      clientA
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    const data = res.data;
    assert.ok(data);

    // Income: 5000.00
    // Expenses: 150.00 + 50.00 + 300.00 = 500.00
    // Net: 4500.00
    // Savings Rate: (4500 / 5000) * 100 = 90.00%
    assert.strictEqual(data.totalIncome, 5000.0);
    assert.strictEqual(data.totalExpenses, 500.0);
    assert.strictEqual(data.netCashFlow, 4500.0);
    assert.strictEqual(data.savingsRate, 90.0);
    assert.strictEqual(data.transactionCount, 4);
    assert.strictEqual(data.averageTransactionAmount, 1375.0); // (5000 + 500) / 4 = 1375
  });

  test('6.2 Category breakdown computes accurate percentages and sums', async () => {
    const res = await getAnalyticsSummary(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        currency: 'USD',
      },
      clientA
    );

    assert.strictEqual(res.status, 200);
    const expenses = res.data.expenseBreakdown;
    assert.strictEqual(expenses.length, 2);

    // Uncategorized: 300 / 500 = 60.00%
    const uncat = expenses.find((e) => e.categoryId === null);
    assert.ok(uncat);
    assert.strictEqual(uncat.categoryName, 'Uncategorized');
    assert.strictEqual(uncat.totalAmount, 300.0);
    assert.strictEqual(uncat.percentage, 60.0);
    assert.strictEqual(uncat.count, 1);

    // Analytics Dining: 200 / 500 = 40.00%
    const dining = expenses.find((e) => e.categoryId === catDiningId);
    assert.ok(dining);
    assert.strictEqual(dining.categoryName, 'Analytics Dining');
    assert.strictEqual(dining.totalAmount, 200.0);
    assert.strictEqual(dining.percentage, 40.0);
    assert.strictEqual(dining.count, 2);
  });

  test('6.3 Strict currency isolation: EUR transactions do not contaminate USD analytics', async () => {
    // Check USD analytics has 4 transactions, not 5
    const usdRes = await getAnalyticsSummary(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        currency: 'USD',
      },
      clientA
    );
    assert.strictEqual(usdRes.data.transactionCount, 4);
    assert.strictEqual(usdRes.data.totalExpenses, 500.0);

    // Check EUR analytics
    const eurRes = await getAnalyticsSummary(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        currency: 'EUR',
      },
      clientA
    );
    assert.strictEqual(eurRes.status, 200);
    assert.strictEqual(eurRes.data.totalExpenses, 800.0);
    assert.strictEqual(eurRes.data.totalIncome, 0.0);
    assert.strictEqual(eurRes.data.savingsRate, 0.0); // Zero income => 0% savings rate
  });

  test('6.4 User isolation: User A analytics never includes User B data', async () => {
    const resA = await getAnalyticsSummary(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        currency: 'USD',
      },
      clientA
    );

    // User B has a 9999.00 expense, User A total expenses must remain 500.00
    assert.strictEqual(resA.data.totalExpenses, 500.0);
    const hasUserBExpense = resA.data.largestExpenses.some((e) => e.amount === 9999.0);
    assert.strictEqual(hasUserBExpense, false);
  });

  test('6.5 Handles empty datasets cleanly without NaN or crashes', async () => {
    const res = await getAnalyticsSummary(
      {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        currency: 'USD',
      },
      clientA
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.totalIncome, 0);
    assert.strictEqual(res.data.totalExpenses, 0);
    assert.strictEqual(res.data.netCashFlow, 0);
    assert.strictEqual(res.data.savingsRate, 0);
    assert.strictEqual(res.data.transactionCount, 0);
    assert.strictEqual(res.data.averageTransactionAmount, 0);
    assert.strictEqual(res.data.expenseBreakdown.length, 0);
    assert.strictEqual(res.data.incomeBreakdown.length, 0);
  });
});
