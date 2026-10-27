import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { askFinancialAdvisor, getConversationMessages } from '../src/lib/ai/advisorService.ts';
import { getAnalyticsSummary } from '../src/lib/analytics/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('SpendSense AI — Real Financial Actions & Supabase Persistence Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;
  let conversationAId;

  const userAData = {
    email: `ai_action_user_a_${Date.now()}@example.com`,
    password: 'Password123!Secure',
  };

  const userBData = {
    email: `ai_action_user_b_${Date.now()}@example.com`,
    password: 'Password123!Secure',
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

    // 1. Create and authenticate User A
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await clientA.auth.signUp({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ifError(errA);
    userAId = signA.user.id;

    const { data: loginA, error: loginErrA } = await clientA.auth.signInWithPassword({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ifError(loginErrA);
    assert.ok(loginA.session);

    // 2. Create and authenticate User B
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientB.auth.signUp({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ifError(errB);
    userBId = signB.user.id;

    const { data: loginB, error: loginErrB } = await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ifError(loginErrB);
    assert.ok(loginB.session);
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('ai_conversations').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('ai_conversations').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  test('1. Scenario 1: “Menda 500 dollar naqd pul bor.” clarifies, requires confirmation, and stores initial balance', async () => {
    // 1.1 Initial prompt
    const res1 = await askFinancialAdvisor('Menda 500 dollar naqd pul bor.', undefined, clientA);
    assert.equal(res1.status, 200);
    assert.ok(res1.data);
    conversationAId = res1.data.conversationId;

    // AI must clarify whether it is existing cash/starting balance or new income
    const answer1 = res1.data.answer.toLowerCase();
    assert.ok(
      answer1.includes('mavjud') || answer1.includes('daromad'),
      `AI should clarify mavjud vs daromad. Got: "${res1.data.answer}"`
    );

    // Crucial check: verify NO transaction is created before confirmation
    const { data: txsBeforeConfirm } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId);
    assert.equal(txsBeforeConfirm?.length, 0, 'No transaction should be created before confirmation');

    // 1.2 User clarifies it is existing balance: "Mavjud balans"
    const res2 = await askFinancialAdvisor('Mavjud balans', conversationAId, clientA);
    assert.equal(res2.status, 200);
    assert.ok(res2.data);
    const answer2 = res2.data.answer.toLowerCase();
    assert.ok(
      answer2.includes('500') && (answer2.includes('balans') || answer2.includes('tasdiqlay')),
      `AI should ask to confirm 500 starting balance. Got: "${res2.data.answer}"`
    );

    // Verify still NO transaction before final confirmation
    const { data: txsStillNone } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId);
    assert.equal(txsStillNone?.length, 0, 'No transaction should be created before confirmation');

    // 1.3 User confirms: "Ha, tasdiqlayman"
    const res3 = await askFinancialAdvisor('Ha, tasdiqlayman', conversationAId, clientA);
    assert.equal(res3.status, 200);
    assert.ok(res3.data);
    assert.ok(
      res3.data.answer.includes('muvaffaqiyatli saqlandi'),
      `AI should confirm saving initial balance. Got: "${res3.data.answer}"`
    );

    // 1.4 Verify real Supabase database record
    const { data: txsAfter } = await clientA
      .from('transactions')
      .select('*')
      .eq('user_id', userAId);
    assert.equal(txsAfter?.length, 1, 'Initial balance transaction should now exist in Supabase');
    assert.equal(Number(txsAfter[0].amount), 500);
    assert.equal(txsAfter[0].type, 'income');
    assert.equal(txsAfter[0].notes, 'initial_balance');

    // 1.5 Verify that initial cash balance is NOT double-counted as monthly periodic income for current month
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonth = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

    const analytics = await getAnalyticsSummary(
      { startDate: startOfMonth, endDate: endOfMonth, currency: 'USD' },
      clientA
    );
    assert.equal(analytics.status, 200);
    assert.equal(
      analytics.data.totalIncome,
      0,
      'Initial cash balance should not be counted as regular periodic income for the current month'
    );
  });

  test('2. Scenario 2: “Bugun 200 dollar ishlab topdim.” detects income, confirms, and creates real transaction', async () => {
    // 2.1 User prompt
    const res1 = await askFinancialAdvisor('Bugun 200 dollar ishlab topdim.', conversationAId, clientA);
    assert.equal(res1.status, 200);
    assert.ok(res1.data);
    const answer1 = res1.data.answer;
    assert.ok(
      answer1.includes('200') && (answer1.includes('daromad') || answer1.includes('qayd etish')),
      `AI should propose 200 dollar income confirmation. Got: "${answer1}"`
    );

    // Verify transaction count before confirmation (should still be only the 1 initial balance)
    const { data: txsBefore } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId);
    assert.equal(txsBefore?.length, 1, 'Income transaction must not exist before confirmation');

    // 2.2 User confirms: "Tasdiqlayman"
    const res2 = await askFinancialAdvisor('Tasdiqlayman', conversationAId, clientA);
    assert.equal(res2.status, 200);
    assert.ok(
      res2.data.answer.includes('200 dollar daromad muvaffaqiyatli saqlandi'),
      `AI should confirm saving 200 dollar income. Got: "${res2.data.answer}"`
    );

    // 2.3 Verify transaction in Supabase
    const { data: txsAfter } = await clientA
      .from('transactions')
      .select('*')
      .eq('user_id', userAId)
      .eq('amount', 200);
    assert.equal(txsAfter?.length, 1, 'Real 200 USD income transaction must exist in Supabase');
    assert.equal(txsAfter[0].type, 'income');
    assert.equal(txsAfter[0].currency, 'USD');

    // 2.4 Verify Analytics totals reflect this income in the current month
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonth = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

    const analytics = await getAnalyticsSummary(
      { startDate: startOfMonth, endDate: endOfMonth, currency: 'USD' },
      clientA
    );
    assert.equal(analytics.data.totalIncome, 200, 'Current month income must now reflect $200');
  });

  test('3. Scenario 3: “Kecha oziq-ovqatga 35 dollar sarfladim.” detects expense, confirms, and creates real transaction', async () => {
    // 3.1 User prompt
    const res1 = await askFinancialAdvisor('Kecha oziq-ovqatga 35 dollar sarfladim.', conversationAId, clientA);
    assert.equal(res1.status, 200);
    assert.ok(res1.data);
    const answer1 = res1.data.answer.toLowerCase();
    assert.ok(
      answer1.includes('35') && (answer1.includes('oziq-ovqat') || answer1.includes('xarajat')),
      `AI should propose 35 dollar grocery expense confirmation. Got: "${res1.data.answer}"`
    );

    // Verify transaction does not exist before confirmation
    const { data: txsBefore } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId)
      .eq('amount', 35);
    assert.equal(txsBefore?.length, 0, 'Expense transaction must not exist before confirmation');

    // 3.2 User confirms: "Ha"
    const res2 = await askFinancialAdvisor('Ha', conversationAId, clientA);
    assert.equal(res2.status, 200);
    assert.ok(
      res2.data.answer.includes('35 dollar xarajat muvaffaqiyatli saqlandi'),
      `AI should confirm saving 35 dollar expense. Got: "${res2.data.answer}"`
    );

    // 3.3 Verify transaction in Supabase
    const { data: txsAfter } = await clientA
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', userAId)
      .eq('amount', 35);
    assert.equal(txsAfter?.length, 1, 'Real 35 USD expense transaction must exist in Supabase');
    assert.equal(txsAfter[0].type, 'expense');
    assert.equal(txsAfter[0].currency, 'USD');
    const cat = Array.isArray(txsAfter[0].categories) ? txsAfter[0].categories[0] : txsAfter[0].categories;
    assert.equal(cat?.name, 'Groceries');
  });

  test('4. Scenario 4: “Bu oy qancha pul sarfladim?” answers strictly from real Supabase transactions', async () => {
    const res = await askFinancialAdvisor('Bu oy qancha pul sarfladim?', conversationAId, clientA);
    assert.equal(res.status, 200);
    assert.ok(res.data);
    const answer = res.data.answer;
    assert.ok(
      answer.includes('$35.00') || answer.includes('35'),
      `AI answer must compute exact $35.00 total expense from database. Got: "${answer}"`
    );
    assert.ok(
      answer.includes('bazasi') || answer.includes('tekshirildi') || answer.includes('Groceries'),
      `AI answer must indicate ground fact calculation. Got: "${answer}"`
    );
  });

  test('5. Scenario 5: “Oxirgi xarajatni bekor qil.” displays details, handles cancellation, and deletes after confirmation', async () => {
    // 5.1 Request deletion
    const res1 = await askFinancialAdvisor('Oxirgi xarajatni bekor qil.', conversationAId, clientA);
    assert.equal(res1.status, 200);
    const answer1 = res1.data.answer;
    assert.ok(
      answer1.includes('35') && answer1.includes('o‘chirishni tasdiqlaysizmi'),
      `AI should show 35 USD expense details and ask confirmation. Got: "${answer1}"`
    );

    // Verify transaction is NOT deleted yet
    const { data: txsBeforeCancel } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId)
      .eq('amount', 35);
    assert.equal(txsBeforeCancel?.length, 1, 'Transaction must not be deleted before confirmation');

    // 5.2 User cancels: "Yo'q, bekor qil"
    const resCancel = await askFinancialAdvisor('Yo‘q, bekor qil', conversationAId, clientA);
    assert.equal(resCancel.status, 200);
    assert.ok(
      resCancel.data.answer.includes('bekor qilindi'),
      `AI should confirm action was cancelled. Got: "${resCancel.data.answer}"`
    );

    // Verify transaction is STILL intact in Supabase
    const { data: txsStillIntact } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId)
      .eq('amount', 35);
    assert.equal(txsStillIntact?.length, 1, 'Transaction must still exist after cancellation');

    // 5.3 Request deletion again
    await askFinancialAdvisor('Oxirgi xarajatni bekor qil.', conversationAId, clientA);

    // 5.4 Confirm deletion: "Ha, tasdiqlayman"
    const resDeleteConfirm = await askFinancialAdvisor('Ha, tasdiqlayman', conversationAId, clientA);
    assert.equal(resDeleteConfirm.status, 200);
    assert.ok(
      resDeleteConfirm.data.answer.includes('muvaffaqiyatli o‘chirildi') &&
        resDeleteConfirm.data.answer.includes('yangilandi'),
      `AI should confirm successful deletion and balance update. Got: "${resDeleteConfirm.data.answer}"`
    );

    // 5.5 Verify transaction is deleted from Supabase
    const { data: txsAfterDelete } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId)
      .eq('amount', 35);
    assert.equal(txsAfterDelete?.length, 0, 'Expense transaction must be completely deleted from Supabase');

    // 5.6 Re-check Scenario 4: expenses for this month should now be $0.00
    const resRecheck = await askFinancialAdvisor('Bu oy qancha pul sarfladim?', conversationAId, clientA);
    assert.equal(resRecheck.status, 200);
    assert.ok(
      resRecheck.data.answer.includes('$0.00') || resRecheck.data.answer.includes('hech qanday xarajat qayd etilmagan'),
      `AI must report $0.00 expenses after deletion. Got: "${resRecheck.data.answer}"`
    );
  });

  test('6. Security & Multi-User Isolation: User B cannot access User A data or transactions', async () => {
    // 6.1 User B tries to read User A's conversation
    const resAccess = await getConversationMessages(conversationAId, clientB);
    assert.notEqual(resAccess.status, 200, 'User B must not be able to read User A conversation');

    // 6.2 User B asks for their own spending: should be $0.00
    const resBSpend = await askFinancialAdvisor('Bu oy qancha pul sarfladim?', undefined, clientB);
    assert.equal(resBSpend.status, 200);
    assert.ok(
      resBSpend.data.answer.includes('$0.00') || resBSpend.data.answer.includes('hech qanday xarajat'),
      `User B must see $0.00, completely isolated from User A. Got: "${resBSpend.data.answer}"`
    );

    // 6.3 User B tries to cancel expense: nothing to cancel
    const resBUndo = await askFinancialAdvisor('Oxirgi xarajatni bekor qil.', undefined, clientB);
    assert.equal(resBUndo.status, 200);
    assert.ok(
      resBUndo.data.answer.includes('topilmadi'),
      `User B must have no expense transactions to cancel. Got: "${resBUndo.data.answer}"`
    );
  });

  test('7. Robustness: Ambiguous requests prompt clarification and prevent duplicate executions', async () => {
    // 7.1 Ambiguous income without amount
    const resAmbiguous = await askFinancialAdvisor('Bugun pul ishladim', undefined, clientA);
    assert.equal(resAmbiguous.status, 200);
    assert.ok(
      resAmbiguous.data.answer.includes('aniq ko‘rsata olasizmi'),
      `AI should ask to clarify missing amount. Got: "${resAmbiguous.data.answer}"`
    );

    // 7.2 Replaying "Ha" when there is no pending action does not create transactions
    const { data: countBefore } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId);

    await askFinancialAdvisor('Ha, tasdiqlayman', resAmbiguous.data.conversationId, clientA);

    const { data: countAfter } = await clientA
      .from('transactions')
      .select('id')
      .eq('user_id', userAId);

    assert.equal(
      countBefore?.length,
      countAfter?.length,
      'Replaying confirmation when no pending action exists must not create transactions'
    );
  });
});
