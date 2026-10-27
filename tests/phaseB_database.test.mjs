import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase B — Database Foundation and Financial Data Model', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;
  let systemCategoryId;
  let userACategoryId;
  let userBCategoryId;
  let userAJobId;
  let userBJobId;
  let userAConversationId;
  let userBConversationId;

  const userAData = {
    email: `phase_b_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Finance',
  };

  const userBData = {
    email: `phase_b_user_b_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Bob',
    lastName: 'Security',
  };

  before(async () => {
    // 1. Obtain admin client using Supabase CLI reveal
    const keys = JSON.parse(
      execSync(
        '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
      ).toString()
    );
    const serviceKey = keys.find(
      (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
    )?.api_key;
    assert.ok(serviceKey, 'Service role key must be resolvable for admin setup');

    adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 2. Fetch an existing system category for testing
    const { data: sysCats, error: sysCatErr } = await adminClient
      .from('categories')
      .select('id, name')
      .eq('is_system', true)
      .limit(1);
    assert.strictEqual(sysCatErr, null, 'Fetching system categories should succeed');
    assert.ok(sysCats.length > 0, 'At least one system category must exist');
    systemCategoryId = sysCats[0].id;

    // 3. Create User A
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await clientA.auth.signUp({
      email: userAData.email,
      password: userAData.password,
      options: {
        data: {
          first_name: userAData.firstName,
          last_name: userAData.lastName,
        },
      },
    });
    assert.strictEqual(errA, null, 'User A sign-up should succeed');
    userAId = signA.user.id;
    assert.ok(userAId, 'User A ID should be defined');

    // 4. Create User B
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientB.auth.signUp({
      email: userBData.email,
      password: userBData.password,
      options: {
        data: {
          first_name: userBData.firstName,
          last_name: userBData.lastName,
        },
      },
    });
    assert.strictEqual(errB, null, 'User B sign-up should succeed');
    userBId = signB.user.id;
    assert.ok(userBId, 'User B ID should be defined');

    // Ensure sessions are active
    const { data: authA } = await clientA.auth.signInWithPassword({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ok(authA.session, 'User A session established');

    const { data: authB } = await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ok(authB.session, 'User B session established');
  });

  after(async () => {
    // Clean up test users using admin API
    try {
      if (adminClient) {
        if (userAId) await adminClient.auth.admin.deleteUser(userAId);
        if (userBId) await adminClient.auth.admin.deleteUser(userBId);
      }
    } catch (e) {
      console.error('Error during test cleanup:', e.message);
    }
  });

  // =========================================================================
  // 1. Schema & Migration Integrity Tests
  // =========================================================================
  describe('1. Schema & Constraints Verification', () => {
    test('Transactions: reject non-positive amounts (CHECK amount > 0)', async () => {
      const { error: zeroErr } = await adminClient.from('transactions').insert({
        user_id: userAId,
        description: 'Zero test',
        amount: 0.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
      });
      assert.ok(zeroErr, 'Insert with amount 0 should fail check constraint');

      const { error: negErr } = await adminClient.from('transactions').insert({
        user_id: userAId,
        description: 'Negative test',
        amount: -50.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
      });
      assert.ok(negErr, 'Insert with negative amount should fail check constraint');
    });

    test('Transactions: reject invalid transaction type', async () => {
      const { error } = await adminClient.from('transactions').insert({
        user_id: userAId,
        description: 'Invalid type test',
        amount: 25.5,
        currency: 'USD',
        type: 'transfer_invalid',
        transaction_date: '2026-10-22',
      });
      assert.ok(error, 'Insert with invalid type should fail CHECK constraint');
    });

    test('Transactions: currency code format validation (3 uppercase chars)', async () => {
      const { error: errShort } = await adminClient.from('transactions').insert({
        user_id: userAId,
        description: 'Currency short',
        amount: 10.0,
        currency: 'US',
        type: 'expense',
        transaction_date: '2026-10-22',
      });
      assert.ok(errShort, 'Currency shorter than 3 chars should fail');

      const { error: errLower } = await adminClient.from('transactions').insert({
        user_id: userAId,
        description: 'Currency lowercase',
        amount: 10.0,
        currency: 'usd',
        type: 'expense',
        transaction_date: '2026-10-22',
      });
      assert.ok(errLower, 'Lowercase currency should fail CHECK (currency = UPPER(currency))');
    });

    test('Budgets: reject invalid date ranges (end_date < start_date)', async () => {
      const { error } = await adminClient.from('budgets').insert({
        user_id: userAId,
        name: 'Inverted dates budget',
        amount: 500.0,
        currency: 'USD',
        period_type: 'monthly',
        start_date: '2026-10-31',
        end_date: '2026-10-01',
      });
      assert.ok(error, 'Budget with end_date < start_date must fail chk_budget_date_range');
    });

    test('Financial Goals: reject target_amount <= 0 or current_amount < 0', async () => {
      const { error: errZeroTarget } = await adminClient.from('financial_goals').insert({
        user_id: userAId,
        name: 'Goal Zero Target',
        target_amount: 0,
        currency: 'USD',
      });
      assert.ok(errZeroTarget, 'Goal with target_amount 0 must fail CHECK constraint');

      const { error: errNegCurrent } = await adminClient.from('financial_goals').insert({
        user_id: userAId,
        name: 'Goal Neg Current',
        target_amount: 1000,
        current_amount: -10,
        currency: 'USD',
      });
      assert.ok(errNegCurrent, 'Goal with negative current_amount must fail CHECK constraint');
    });

    test('Decimal precision: NUMERIC(12, 2) preserves exact cents', async () => {
      const testAmount = 12345.67;
      const { data, error } = await adminClient
        .from('transactions')
        .insert({
          user_id: userAId,
          description: 'Precision test',
          amount: testAmount,
          currency: 'USD',
          type: 'income',
          transaction_date: '2026-10-22',
        })
        .select()
        .single();

      assert.strictEqual(error, null, 'Insert with exact decimal should succeed');
      assert.strictEqual(Number(data.amount), testAmount, 'NUMERIC value must equal 12345.67');

      // Cleanup
      await adminClient.from('transactions').delete().eq('id', data.id);
    });

    test('Categories: duplicate system category name/type is rejected', async () => {
      const { error } = await adminClient.from('categories').insert({
        name: 'Groceries', // already exists as system category
        type: 'expense',
        is_system: true,
        user_id: null,
      });
      assert.ok(error, 'Duplicate system category should fail unique index constraint');
    });
  });

  // =========================================================================
  // 2. RLS & User Isolation Tests
  // =========================================================================
  describe('2. Row Level Security & User Isolation', () => {
    test('Categories: User A can read system categories', async () => {
      const { data, error } = await clientA
        .from('categories')
        .select('*')
        .eq('is_system', true);

      assert.strictEqual(error, null);
      assert.ok(data.length >= 10, 'User A should read system categories');
    });

    test('Categories: User A and User B create custom categories with proper isolation', async () => {
      // User A creates custom category
      const { data: catA, error: errCatA } = await clientA
        .from('categories')
        .insert({
          user_id: userAId,
          name: 'Alice Hobby Equipment',
          type: 'expense',
          is_system: false,
        })
        .select()
        .single();

      assert.strictEqual(errCatA, null, 'User A creates custom category');
      userACategoryId = catA.id;

      // User B creates custom category
      const { data: catB, error: errCatB } = await clientB
        .from('categories')
        .insert({
          user_id: userBId,
          name: 'Bob Secret Vault',
          type: 'expense',
          is_system: false,
        })
        .select()
        .single();

      assert.strictEqual(errCatB, null, 'User B creates custom category');
      userBCategoryId = catB.id;

      // User A CANNOT see User B custom category
      const { data: readBFromA } = await clientA
        .from('categories')
        .select('*')
        .eq('id', userBCategoryId);
      assert.strictEqual(readBFromA.length, 0, 'User A must not be able to read User B category');

      // User B CANNOT see User A custom category
      const { data: readAFromB } = await clientB
        .from('categories')
        .select('*')
        .eq('id', userACategoryId);
      assert.strictEqual(readAFromB.length, 0, 'User B must not be able to read User A category');
    });

    test('Categories: Standard user cannot insert system categories', async () => {
      const { error } = await clientA.from('categories').insert({
        name: 'Hacked System Cat',
        type: 'expense',
        is_system: true,
        user_id: null,
      });
      assert.ok(error, 'Standard user inserting is_system=true must be rejected by RLS');
    });

    test('Import Jobs: User A and User B isolation', async () => {
      // User A creates job
      const { data: jobA, error: errA } = await clientA
        .from('import_jobs')
        .insert({
          user_id: userAId,
          filename: 'alice_statements.csv',
          status: 'completed',
          total_rows: 50,
          imported_rows: 50,
        })
        .select()
        .single();
      assert.strictEqual(errA, null);
      userAJobId = jobA.id;

      // User B creates job
      const { data: jobB, error: errB } = await clientB
        .from('import_jobs')
        .insert({
          user_id: userBId,
          filename: 'bob_statements.csv',
          status: 'completed',
          total_rows: 30,
          imported_rows: 30,
        })
        .select()
        .single();
      assert.strictEqual(errB, null);
      userBJobId = jobB.id;

      // User A cannot read User B job
      const { data: readBFromA } = await clientA.from('import_jobs').select('*').eq('id', userBJobId);
      assert.strictEqual(readBFromA.length, 0, 'User A cannot read User B import job');
    });

    test('Transactions: User isolation and cross-user category rejection', async () => {
      // 1. User A can insert transaction with system category
      const { data: txA, error: errTxA } = await clientA
        .from('transactions')
        .insert({
          user_id: userAId,
          description: 'User A Groceries',
          amount: 85.5,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: systemCategoryId,
        })
        .select()
        .single();
      assert.strictEqual(errTxA, null, 'User A inserting transaction with system category should succeed');

      // 2. User A can insert transaction with User A custom category
      const { data: txACustom, error: errTxACustom } = await clientA
        .from('transactions')
        .insert({
          user_id: userAId,
          description: 'User A Custom Hobby',
          amount: 120.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: userACategoryId,
        })
        .select()
        .single();
      assert.strictEqual(errTxACustom, null, 'User A inserting transaction with own category should succeed');

      // 3. User A CANNOT reference User B custom category
      const { error: errCrossCat } = await clientA.from('transactions').insert({
        user_id: userAId,
        description: 'Cross-user category attack',
        amount: 200.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
        category_id: userBCategoryId,
      });
      assert.ok(errCrossCat, 'Referencing another users category must be rejected');

      // 4. User A CANNOT reference User B import job
      const { error: errCrossJob } = await clientA.from('transactions').insert({
        user_id: userAId,
        description: 'Cross-user job reference attack',
        amount: 200.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
        import_job_id: userBJobId,
      });
      assert.ok(errCrossJob, 'Referencing another users import job must be rejected');

      // 5. User B CANNOT read User A transactions
      const { data: readTxAFromB } = await clientB
        .from('transactions')
        .select('*')
        .eq('id', txA.id);
      assert.strictEqual(readTxAFromB.length, 0, 'User B must not read User A transactions');

      // 6. User B CANNOT update User A transactions
      const { data: updateRes } = await clientB
        .from('transactions')
        .update({ description: 'Hijacked by B' })
        .eq('id', txA.id)
        .select();
      assert.strictEqual(updateRes.length, 0, 'User B cannot update User A transaction');

      // 7. User B CANNOT delete User A transactions
      const { data: delRes } = await clientB
        .from('transactions')
        .delete()
        .eq('id', txA.id)
        .select();
      assert.strictEqual(delRes.length, 0, 'User B cannot delete User A transaction');

      // 8. User A CANNOT create a transaction with user_id = User B
      const { error: errImpersonate } = await clientA.from('transactions').insert({
        user_id: userBId,
        description: 'Impersonation transaction',
        amount: 50.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-22',
      });
      assert.ok(errImpersonate, 'User A creating a transaction owned by User B must fail RLS');

      // 9. User A CANNOT change ownership of own transaction to User B
      const { error: errChangeOwner } = await clientA
        .from('transactions')
        .update({ user_id: userBId })
        .eq('id', txA.id);
      assert.ok(errChangeOwner, 'Changing transaction owner to User B must be rejected');
    });

    test('Budgets: User isolation and cross-user category rejection', async () => {
      // 1. User A creates budget
      const { data: budgetA, error: errBudgetA } = await clientA
        .from('budgets')
        .insert({
          user_id: userAId,
          name: 'Monthly Dining',
          amount: 400.0,
          currency: 'USD',
          period_type: 'monthly',
          start_date: '2026-11-01',
          end_date: '2026-11-30',
          category_id: systemCategoryId,
        })
        .select()
        .single();
      assert.strictEqual(errBudgetA, null);

      // 2. User A cannot reference User B custom category
      const { error: errCrossBudgetCat } = await clientA.from('budgets').insert({
        user_id: userAId,
        name: 'Invalid Cross Budget',
        amount: 300.0,
        currency: 'USD',
        period_type: 'monthly',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        category_id: userBCategoryId,
      });
      assert.ok(errCrossBudgetCat, 'Budget referencing another users category must be rejected');

      // 3. User B cannot read User A budget
      const { data: readFromB } = await clientB.from('budgets').select('*').eq('id', budgetA.id);
      assert.strictEqual(readFromB.length, 0, 'User B cannot read User A budget');
    });

    test('Financial Goals: User isolation', async () => {
      // User A creates goal
      const { data: goalA, error: errA } = await clientA
        .from('financial_goals')
        .insert({
          user_id: userAId,
          name: 'Emergency Fund',
          target_amount: 10000.0,
          current_amount: 2500.0,
          currency: 'USD',
          target_date: '2027-12-31',
          tracking_strategy: 'manual',
          status: 'in_progress',
        })
        .select()
        .single();
      assert.strictEqual(errA, null);

      // User B cannot read User A goal
      const { data: readFromB } = await clientB.from('financial_goals').select('*').eq('id', goalA.id);
      assert.strictEqual(readFromB.length, 0, 'User B cannot read User A goal');

      // User B cannot update User A goal
      const { data: updateFromB } = await clientB
        .from('financial_goals')
        .update({ current_amount: 0 })
        .eq('id', goalA.id)
        .select();
      assert.strictEqual(updateFromB.length, 0, 'User B cannot update User A goal');
    });

    test('Insights: User isolation', async () => {
      // User A creates insight
      const { data: insightA, error: errA } = await clientA
        .from('insights')
        .insert({
          user_id: userAId,
          type: 'spending_spike',
          title: 'Dining Spike Detected',
          explanation: 'Dining spending increased 35% compared to last month.',
          confidence: 'high',
          status: 'new',
        })
        .select()
        .single();
      assert.strictEqual(errA, null);

      // User B cannot read User A insight
      const { data: readFromB } = await clientB.from('insights').select('*').eq('id', insightA.id);
      assert.strictEqual(readFromB.length, 0, 'User B cannot read User A insight');
    });

    test('AI Conversations & Messages: User isolation and cross-conversation rejection', async () => {
      // 1. User A creates conversation
      const { data: convA, error: errConvA } = await clientA
        .from('ai_conversations')
        .insert({
          user_id: userAId,
          title: 'Alice Tax Planning',
        })
        .select()
        .single();
      assert.strictEqual(errConvA, null);
      userAConversationId = convA.id;

      // 2. User B creates conversation
      const { data: convB, error: errConvB } = await clientB
        .from('ai_conversations')
        .insert({
          user_id: userBId,
          title: 'Bob Investment Questions',
        })
        .select()
        .single();
      assert.strictEqual(errConvB, null);
      userBConversationId = convB.id;

      // 3. User B cannot read User A conversation
      const { data: readConvAFromB } = await clientB
        .from('ai_conversations')
        .select('*')
        .eq('id', userAConversationId);
      assert.strictEqual(readConvAFromB.length, 0, 'User B cannot read User A conversation');

      // 4. User A sends message in own conversation
      const { data: msgA, error: errMsgA } = await clientA
        .from('ai_messages')
        .insert({
          conversation_id: userAConversationId,
          user_id: userAId,
          role: 'user',
          content: 'How can I optimize my monthly grocery expenses?',
        })
        .select()
        .single();
      assert.strictEqual(errMsgA, null);

      // 5. User B cannot read User A message
      const { data: readMsgFromB } = await clientB
        .from('ai_messages')
        .select('*')
        .eq('id', msgA.id);
      assert.strictEqual(readMsgFromB.length, 0, 'User B cannot read User A message');

      // 6. User B cannot insert message into User A conversation (cross-conversation trigger)
      const { error: errCrossConv } = await clientB.from('ai_messages').insert({
        conversation_id: userAConversationId,
        user_id: userBId,
        role: 'user',
        content: 'Malicious intrusion into Alice conversation',
      });
      assert.ok(errCrossConv, 'User B inserting message into User A conversation must be rejected');
    });
  });
});
