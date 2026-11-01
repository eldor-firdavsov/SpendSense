import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { getUserFinancialTimeline } from '../src/lib/timeline/financialTimeline.ts';
import { getAnalyticsSummary } from '../src/lib/analytics/service.ts';
import { createTransaction, listTransactions } from '../src/lib/transactions/service.ts';
import { createCategory } from '../src/lib/categories/service.ts';
import { createBudget, listBudgets } from '../src/lib/budgets/service.ts';
import { createGoal, listGoals } from '../src/lib/goals/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('SpendSense AI — User-Specific Financial History & Zero-Start Data Logic (Scenarios A through H)', () => {
  let adminClient;
  let clientA;
  let clientB;
  let clientFresh;
  let userAId;
  let userBId;
  let userFreshId;
  let catSalaryAId;
  let catFoodAId;

  const testTimestamp = Date.now();
  const userAData = {
    email: `timeline_user_a_${testTimestamp}@example.com`,
    password: 'Password123!',
  };
  const userBData = {
    email: `timeline_user_b_${testTimestamp}@example.com`,
    password: 'Password123!',
  };
  const userFreshData = {
    email: `timeline_user_fresh_${testTimestamp}@example.com`,
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
    await clientA.auth.signInWithPassword({
      email: userAData.email,
      password: userAData.password,
    });

    // User B
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientB.auth.signUp({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ifError(errB);
    userBId = signB.user.id;
    await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });

    // Fresh User (No transactions)
    clientFresh = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signFresh, error: errFresh } = await clientFresh.auth.signUp({
      email: userFreshData.email,
      password: userFreshData.password,
    });
    assert.ifError(errFresh);
    userFreshId = signFresh.user.id;
    await clientFresh.auth.signInWithPassword({
      email: userFreshData.email,
      password: userFreshData.password,
    });

    // Categories for User A
    const catSalary = await createCategory(
      { name: 'Oylik Maosh', type: 'income', color: '#10b981' },
      clientA
    );
    catSalaryAId = catSalary.data.id;

    const catFood = await createCategory(
      { name: 'Oziq-ovqat', type: 'expense', color: '#ef4444' },
      clientA
    );
    catFoodAId = catFood.data.id;
  });

  after(async () => {
    // Clean up created test users
    if (adminClient && userAId) {
      await adminClient.auth.admin.deleteUser(userAId);
    }
    if (adminClient && userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
    }
    if (adminClient && userFreshId) {
      await adminClient.auth.admin.deleteUser(userFreshId);
    }
  });

  // Scenario A: Brand-new user
  test('Scenario A: Brand-new user starts strictly from zero with no historical months', async () => {
    const timeline = await getUserFinancialTimeline(userFreshId, clientFresh);
    assert.strictEqual(timeline.hasData, false, 'Fresh user must have hasData=false');
    assert.strictEqual(timeline.totalTransactions, 0, 'Fresh user must have 0 transactions');
    assert.strictEqual(timeline.availableMonths.length, 0, 'Fresh user must have 0 available months');
    assert.strictEqual(timeline.availableMonthKeys.length, 0, 'Fresh user must have 0 available month keys');

    // Check transactions list
    const txList = await listTransactions({}, clientFresh);
    assert.strictEqual(txList.status, 200);
    assert.strictEqual(txList.data.transactions.length, 0, 'Transaction list must be empty');
    assert.strictEqual(txList.data.totalCount, 0, 'Transaction count must be 0');

    // Check analytics summary
    const analytics = await getAnalyticsSummary(
      { startDate: '2026-01-01', endDate: '2026-12-31', currency: 'UZS' },
      clientFresh
    );
    assert.strictEqual(analytics.status, 200);
    assert.strictEqual(analytics.data.totalIncome, 0, 'Income must be 0');
    assert.strictEqual(analytics.data.totalExpenses, 0, 'Expenses must be 0');
    assert.strictEqual(analytics.data.netCashFlow, 0, 'Net cash flow must be 0');
    assert.strictEqual(analytics.data.savingsRate, 0, 'Savings rate must be 0');
    assert.strictEqual(analytics.data.transactionCount, 0, 'Transaction count must be 0');
    assert.strictEqual(analytics.data.trends.length, 0, 'No fabricated trends allowed');
  });

  // Scenario B: User starts in March
  test('Scenario B: User starts in March 2026 — Jan/Feb never visible, start date recorded', async () => {
    // Add transaction in March 2026
    const txMarch = await createTransaction(
      {
        description: 'Mart oyligi',
        amount: 8000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-03-15',
        category_id: catSalaryAId,
      },
      clientA
    );
    assert.strictEqual(txMarch.status, 201);

    // Add transaction in April 2026
    const txApril = await createTransaction(
      {
        description: 'Aprel xarajati',
        amount: 2500000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-04-10',
        category_id: catFoodAId,
      },
      clientA
    );
    assert.strictEqual(txApril.status, 201);

    // Verify financial_start_date in profile
    const { data: profileA } = await adminClient
      .from('profiles')
      .select('financial_start_date')
      .eq('id', userAId)
      .single();
    assert.ok(profileA.financial_start_date, 'Profile must have financial_start_date');
    assert.strictEqual(profileA.financial_start_date, '2026-03-15');

    // Verify available months
    const timeline = await getUserFinancialTimeline(userAId, clientA);
    assert.strictEqual(timeline.hasData, true);
    assert.deepStrictEqual(timeline.availableMonthKeys, ['2026-04', '2026-03']);

    // January and February must NOT appear
    assert.strictEqual(timeline.availableMonthKeys.includes('2026-01'), false);
    assert.strictEqual(timeline.availableMonthKeys.includes('2026-02'), false);

    // Historical month before start date returns zero analytics
    const janAnalytics = await getAnalyticsSummary(
      { startDate: '2026-01-01', endDate: '2026-01-31', currency: 'UZS' },
      clientA
    );
    assert.strictEqual(janAnalytics.data.totalIncome, 0);
    assert.strictEqual(janAnalytics.data.totalExpenses, 0);
    assert.strictEqual(janAnalytics.data.transactionCount, 0);
  });

  // Scenario C: Missing month
  test('Scenario C: User has transactions in March, April, and June — May 2026 does not appear', async () => {
    // Add transaction in June 2026 (skipping May)
    const txJune = await createTransaction(
      {
        description: 'Iyun oyligi',
        amount: 8500000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-06-20',
        category_id: catSalaryAId,
      },
      clientA
    );
    assert.strictEqual(txJune.status, 201);

    const timeline = await getUserFinancialTimeline(userAId, clientA);
    assert.deepStrictEqual(timeline.availableMonthKeys, ['2026-06', '2026-04', '2026-03']);

    // May 2026 must NOT appear
    assert.strictEqual(timeline.availableMonthKeys.includes('2026-05'), false, 'May 2026 must not appear');
  });

  // Scenario D: Year transition
  test('Scenario D: User has transactions in Dec 2026 and Jan 2027 — both appear across year boundary', async () => {
    // Dec 2026
    await createTransaction(
      {
        description: 'Dekabr xarid',
        amount: 1200000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-12-25',
        category_id: catFoodAId,
      },
      clientA
    );

    // Jan 2027
    await createTransaction(
      {
        description: 'Yanvar yangi yil oyligi',
        amount: 9000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2027-01-10',
        category_id: catSalaryAId,
      },
      clientA
    );

    const timeline = await getUserFinancialTimeline(userAId, clientA);
    assert.strictEqual(timeline.availableMonthKeys.includes('2026-12'), true);
    assert.strictEqual(timeline.availableMonthKeys.includes('2027-01'), true);

    // Chronological order check: 2027-01 must come before 2026-12 in descending order
    const idx2027 = timeline.availableMonthKeys.indexOf('2027-01');
    const idx2026 = timeline.availableMonthKeys.indexOf('2026-12');
    assert.ok(idx2027 < idx2026, '2027-01 must precede 2026-12 in descending sort');
  });

  // Scenario E: Goal without contribution
  test('Scenario E: Goal created with target — current_amount remains 0 and creates NO fake transactions or timeline months', async () => {
    const goalRes = await createGoal(
      {
        name: 'Yangi Avtomobil',
        target_amount: 150000000,
        currency: 'UZS',
        target_date: '2028-12-31',
      },
      clientFresh
    );
    assert.strictEqual(goalRes.status, 201);
    assert.strictEqual(goalRes.data.current_amount, 0, 'Goal current amount must start at 0');

    // Fresh user must still have 0 transactions and empty timeline
    const timeline = await getUserFinancialTimeline(userFreshId, clientFresh);
    assert.strictEqual(timeline.hasData, false, 'Goal creation must not create financial timeline data');
    assert.strictEqual(timeline.totalTransactions, 0);

    const txList = await listTransactions({}, clientFresh);
    assert.strictEqual(txList.data.transactions.length, 0, 'Goal creation must not insert any transaction');
  });

  // Scenario F: Budget without spending
  test('Scenario F: Budget created for 2027-08 — does NOT create transactions or month in actual financial history', async () => {
    const budgetRes = await createBudget(
      {
        name: 'Oziq-ovqat reja',
        category_id: catFoodAId,
        amount: 3000000,
        start_date: '2027-08-01',
        end_date: '2027-08-31',
        period_type: 'monthly',
        currency: 'UZS',
      },
      clientA
    );
    assert.strictEqual(budgetRes.status, 201);

    // August 2027 has no transactions — must NOT appear in financial history timeline
    const timeline = await getUserFinancialTimeline(userAId, clientA);
    assert.strictEqual(
      timeline.availableMonthKeys.includes('2027-08'),
      false,
      'Planned budget without transactions must not appear in transaction history'
    );
  });

  // Scenario G: Existing user
  test('Scenario G: Existing user firdavsove1@gmail.com data remains intact with valid historical months', async () => {
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id, email, financial_start_date')
      .eq('email', 'firdavsove1@gmail.com')
      .maybeSingle();

    if (existingUser) {
      assert.strictEqual(existingUser.financial_start_date, '2026-09-01');

      const timeline = await getUserFinancialTimeline(existingUser.id, adminClient);
      assert.strictEqual(timeline.hasData, true);
      assert.strictEqual(timeline.totalTransactions >= 80, true, 'Existing user transactions preserved');
      assert.strictEqual(timeline.availableMonthKeys.includes('2026-09'), true);
      assert.strictEqual(timeline.availableMonthKeys.includes('2026-10'), true);
    }
  });

  // Scenario H: User isolation
  test('Scenario H: User isolation — User A and User B only see their own available months and records', async () => {
    // User B adds single transaction in November 2026
    const catSalaryB = await createCategory(
      { name: 'User B Oylik', type: 'income', color: '#10b981' },
      clientB
    );
    await createTransaction(
      {
        description: 'User B Noyabr',
        amount: 4000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-11-05',
        category_id: catSalaryB.data.id,
      },
      clientB
    );

    const timelineA = await getUserFinancialTimeline(userAId, clientA);
    const timelineB = await getUserFinancialTimeline(userBId, clientB);

    // User B only has 2026-11
    assert.deepStrictEqual(timelineB.availableMonthKeys, ['2026-11']);

    // User A does not have 2026-11
    assert.strictEqual(timelineA.availableMonthKeys.includes('2026-11'), false);

    // User B does not have User A's months (2026-03, 2026-04, 2026-06, etc.)
    assert.strictEqual(timelineB.availableMonthKeys.includes('2026-03'), false);
    assert.strictEqual(timelineB.availableMonthKeys.includes('2026-04'), false);
    assert.strictEqual(timelineB.availableMonthKeys.includes('2026-06'), false);
  });
});
