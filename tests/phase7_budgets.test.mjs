import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  createBudget,
  listBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
} from '../src/lib/budgets/service.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';
import { createCategory, deleteCategory } from '../src/lib/categories/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase 7 — Budget Management Backend Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;
  let userACatExpenseId;
  let userACatIncomeId;

  const userAData = {
    email: `phase7_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    email: `phase7_user_b_${Date.now()}@example.com`,
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

    // Categories
    const expRes = await createCategory(
      { name: 'Budget Dining', type: 'expense', color: '#f59e0b' },
      clientA
    );
    assert.strictEqual(expRes.status, 201);
    userACatExpenseId = expRes.data.id;

    const incRes = await createCategory(
      { name: 'Budget Salary', type: 'income', color: '#10b981' },
      clientA
    );
    assert.strictEqual(incRes.status, 201);
    userACatIncomeId = incRes.data.id;
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('budgets').delete().eq('user_id', userAId);
        await adminClient.from('categories').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('budgets').delete().eq('user_id', userBId);
        await adminClient.from('categories').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  let createdBudgetId;

  test('7.1 Create category-specific budget and overall budget with validation', async () => {
    // 1. Valid category-specific budget
    const res = await createBudget(
      {
        name: 'Monthly Dining Budget',
        amount: 400.0,
        currency: 'USD',
        period_type: 'monthly',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        category_id: userACatExpenseId,
      },
      clientA
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.id);
    assert.strictEqual(res.data.name, 'Monthly Dining Budget');
    assert.strictEqual(res.data.amount, 400.0);
    assert.strictEqual(res.data.spent, 0);
    assert.strictEqual(res.data.remaining, 400.0);
    assert.strictEqual(res.data.percentageUsed, 0);
    assert.strictEqual(res.data.status, 'on_track');
    assert.strictEqual(res.data.category?.id, userACatExpenseId);
    createdBudgetId = res.data.id;

    // 2. Valid overall budget (category_id = null)
    const overallRes = await createBudget(
      {
        name: 'Total Monthly Spending Limit',
        amount: 2500.0,
        currency: 'USD',
        period_type: 'monthly',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        category_id: null,
      },
      clientA
    );
    assert.strictEqual(overallRes.status, 201);
    assert.strictEqual(overallRes.data.category_id, null);

    // 3. Validation: reject negative amount
    const negRes = await createBudget(
      {
        name: 'Negative Budget',
        amount: -100,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      },
      clientA
    );
    assert.strictEqual(negRes.status, 400);

    // 4. Validation: reject end_date < start_date
    const invalidDatesRes = await createBudget(
      {
        name: 'Invalid Dates',
        amount: 200,
        start_date: '2026-11-30',
        end_date: '2026-11-01',
      },
      clientA
    );
    assert.strictEqual(invalidDatesRes.status, 400);

    // 5. Validation: reject assigning budget to income category
    const incomeCatRes = await createBudget(
      {
        name: 'Income Budget Attempt',
        amount: 500,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        category_id: userACatIncomeId,
      },
      clientA
    );
    assert.strictEqual(incomeCatRes.status, 400);
    assert.ok(incomeCatRes.error.includes('expense'));
  });

  test('7.2 Spending-to-date calculation and status transitions (on_track, near_limit, over_budget)', async () => {
    // Budget is 400.00 for November 2026 in userACatExpenseId

    // Add 100.00 expense -> 25% used -> on_track
    const tx1 = await createTransaction(
      {
        description: 'First Dinner',
        amount: 100.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-11-05',
        category_id: userACatExpenseId,
      },
      clientA
    );
    assert.strictEqual(tx1.status, 201);

    let budgetRes = await getBudget(createdBudgetId, clientA);
    assert.strictEqual(budgetRes.data.spent, 100.0);
    assert.strictEqual(budgetRes.data.remaining, 300.0);
    assert.strictEqual(budgetRes.data.percentageUsed, 25.0);
    assert.strictEqual(budgetRes.data.status, 'on_track');

    // Add 230.00 expense -> total 330 / 400 = 82.5% used -> near_limit
    const tx2 = await createTransaction(
      {
        description: 'Large Dinner Party',
        amount: 230.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-11-15',
        category_id: userACatExpenseId,
      },
      clientA
    );
    assert.strictEqual(tx2.status, 201);

    budgetRes = await getBudget(createdBudgetId, clientA);
    assert.strictEqual(budgetRes.data.spent, 330.0);
    assert.strictEqual(budgetRes.data.remaining, 70.0);
    assert.strictEqual(budgetRes.data.percentageUsed, 82.5);
    assert.strictEqual(budgetRes.data.status, 'near_limit');

    // Add 100.00 expense -> total 430 / 400 = 107.5% used -> over_budget
    const tx3 = await createTransaction(
      {
        description: 'Late Night Takeout',
        amount: 100.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-11-20',
        category_id: userACatExpenseId,
      },
      clientA
    );
    assert.strictEqual(tx3.status, 201);

    budgetRes = await getBudget(createdBudgetId, clientA);
    assert.strictEqual(budgetRes.data.spent, 430.0);
    assert.strictEqual(budgetRes.data.remaining, -30.0);
    assert.strictEqual(budgetRes.data.percentageUsed, 107.5);
    assert.strictEqual(budgetRes.data.status, 'over_budget');
  });

  test('7.3 Update budget amount and date range', async () => {
    // Increase budget to 600.00 so it returns to on_track (430 / 600 = 71.67%)
    const updated = await updateBudget(
      createdBudgetId,
      {
        amount: 600.0,
      },
      clientA
    );

    assert.strictEqual(updated.status, 200);
    assert.strictEqual(updated.data.amount, 600.0);
    assert.strictEqual(updated.data.spent, 430.0);
    assert.strictEqual(updated.data.remaining, 170.0);
    assert.strictEqual(updated.data.percentageUsed, 71.67);
    assert.strictEqual(updated.data.status, 'on_track');
  });

  test('7.4 User isolation and cross-user rejection', async () => {
    // User B cannot view User A budget (HTTP 404)
    const getB = await getBudget(createdBudgetId, clientB);
    assert.strictEqual(getB.status, 404);

    // User B cannot update User A budget (HTTP 404)
    const updateB = await updateBudget(createdBudgetId, { name: 'Hacked' }, clientB);
    assert.strictEqual(updateB.status, 404);

    // User B cannot delete User A budget (HTTP 404)
    const deleteB = await deleteBudget(createdBudgetId, clientB);
    assert.strictEqual(deleteB.status, 404);
  });

  test('7.5 Delete budget and category deletion ON DELETE SET NULL behavior', async () => {
    // 1. Create a temporary category and budget
    const tempCat = await createCategory({ name: 'Temp Cat', type: 'expense' }, clientA);
    assert.strictEqual(tempCat.status, 201);

    const tempBudget = await createBudget(
      {
        name: 'Temp Budget',
        amount: 150,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        category_id: tempCat.data.id,
      },
      clientA
    );
    assert.strictEqual(tempBudget.status, 201);

    // 2. Delete the category
    await deleteCategory(tempCat.data.id, clientA);

    // 3. Verify budget STILL EXISTS and category_id is set to NULL
    const checkBudget = await getBudget(tempBudget.data.id, clientA);
    assert.strictEqual(checkBudget.status, 200);
    assert.strictEqual(checkBudget.data.category_id, null);
    assert.strictEqual(checkBudget.data.category, null);

    // 4. Delete the budget
    const delRes = await deleteBudget(tempBudget.data.id, clientA);
    assert.strictEqual(delRes.status, 200);

    const checkGone = await getBudget(tempBudget.data.id, clientA);
    assert.strictEqual(checkGone.status, 404);
  });
});
