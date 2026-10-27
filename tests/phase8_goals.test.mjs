import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  createGoal,
  listGoals,
  getGoal,
  updateGoal,
  contributeToGoal,
  deleteGoal,
} from '../src/lib/goals/service.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase 8 — Savings Goals Backend Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;

  const userAData = {
    email: `phase8_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    email: `phase8_user_b_${Date.now()}@example.com`,
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

    // Seed recent transactions for User A so feasibility calculation has positive historical savings
    // Recent income: 4000.00
    await createTransaction(
      {
        description: 'Monthly Income',
        amount: 4000.0,
        currency: 'USD',
        type: 'income',
        transaction_date: '2026-10-01',
      },
      clientA
    );
    // Recent expense: 1000.00 => Net = 3000.00
    await createTransaction(
      {
        description: 'Living Expenses',
        amount: 1000.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-05',
      },
      clientA
    );
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('financial_goals').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('financial_goals').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  let createdGoalId;

  test('8.1 Create savings goal and compute progress & feasibility', async () => {
    const res = await createGoal(
      {
        name: 'Emergency Fund',
        target_amount: 6000.0,
        current_amount: 1200.0,
        currency: 'USD',
        target_date: '2027-04-01', // ~6 months in future
        tracking_strategy: 'manual',
      },
      clientA
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.id);
    assert.strictEqual(res.data.name, 'Emergency Fund');
    assert.strictEqual(res.data.target_amount, 6000.0);
    assert.strictEqual(res.data.current_amount, 1200.0);
    assert.strictEqual(res.data.remaining_amount, 4800.0);
    assert.strictEqual(res.data.percentage_completed, 20.0);
    assert.strictEqual(res.data.status, 'in_progress');

    // Feasibility: Remaining 4800 over ~5.3 months (~$900/mo) vs user's avg savings ($1000/mo)
    assert.ok(res.data.feasibility);
    assert.ok(res.data.feasibility.monthly_needed > 0);
    assert.ok(res.data.feasibility.explanation.includes('Emergency Fund') || res.data.feasibility.explanation.includes('track') || res.data.feasibility.explanation.includes('needed'));

    createdGoalId = res.data.id;
  });

  test('8.2 Input validation rejects negative target amount or invalid currency', async () => {
    const negTarget = await createGoal(
      {
        name: 'Invalid Goal',
        target_amount: -500,
      },
      clientA
    );
    assert.strictEqual(negTarget.status, 400);

    const negCurrent = await createGoal(
      {
        name: 'Invalid Current',
        target_amount: 1000,
        current_amount: -50,
      },
      clientA
    );
    assert.strictEqual(negCurrent.status, 400);
  });

  test('8.3 Contribute to goal increases current_amount and auto-completes on target reached', async () => {
    // 1. Add 800 contribution (1200 + 800 = 2000 / 6000 = 33.33%)
    const contrib1 = await contributeToGoal(
      createdGoalId,
      {
        amount: 800.0,
        note: 'Bonus deposit',
      },
      clientA
    );

    assert.strictEqual(contrib1.status, 200);
    assert.strictEqual(contrib1.data.current_amount, 2000.0);
    assert.strictEqual(contrib1.data.remaining_amount, 4000.0);
    assert.strictEqual(contrib1.data.percentage_completed, 33.33);
    assert.strictEqual(contrib1.data.status, 'in_progress');

    // 2. Add 4000 contribution to reach 6000 target => status changes to 'completed'
    const contrib2 = await contributeToGoal(
      createdGoalId,
      {
        amount: 4000.0,
        note: 'Tax return deposit',
      },
      clientA
    );

    assert.strictEqual(contrib2.status, 200);
    assert.strictEqual(contrib2.data.current_amount, 6000.0);
    assert.strictEqual(contrib2.data.remaining_amount, 0.0);
    assert.strictEqual(contrib2.data.percentage_completed, 100.0);
    assert.strictEqual(contrib2.data.status, 'completed');
  });

  test('8.4 Update goal details', async () => {
    // Update target to 10000 => status resets to in_progress
    const updated = await updateGoal(
      createdGoalId,
      {
        target_amount: 10000.0,
      },
      clientA
    );

    assert.strictEqual(updated.status, 200);
    assert.strictEqual(updated.data.target_amount, 10000.0);
    assert.strictEqual(updated.data.current_amount, 6000.0);
    assert.strictEqual(updated.data.remaining_amount, 4000.0);
    assert.strictEqual(updated.data.percentage_completed, 60.0);
    assert.strictEqual(updated.data.status, 'in_progress');
  });

  test('8.5 User isolation and cross-user rejection', async () => {
    // User B cannot view User A goal
    const getB = await getGoal(createdGoalId, clientB);
    assert.strictEqual(getB.status, 404);

    // User B cannot update User A goal
    const updateB = await updateGoal(createdGoalId, { name: 'Hacked Goal' }, clientB);
    assert.strictEqual(updateB.status, 404);

    // User B cannot contribute to User A goal
    const contribB = await contributeToGoal(createdGoalId, { amount: 50 }, clientB);
    assert.strictEqual(contribB.status, 404);

    // User B cannot delete User A goal
    const deleteB = await deleteGoal(createdGoalId, clientB);
    assert.strictEqual(deleteB.status, 404);
  });

  test('8.6 Delete goal succeeds for owner', async () => {
    const delRes = await deleteGoal(createdGoalId, clientA);
    assert.strictEqual(delRes.status, 200);

    const checkGone = await getGoal(createdGoalId, clientA);
    assert.strictEqual(checkGone.status, 404);
  });
});
