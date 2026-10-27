import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  generateAndSaveInsights,
  listInsights,
  updateInsightStatus,
} from '../src/lib/ai/insightsService.ts';
import {
  askFinancialAdvisor,
  simulateBudgetScenario,
  listAIConversations,
  getConversationMessages,
} from '../src/lib/ai/advisorService.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';
import { createCategory } from '../src/lib/categories/service.ts';
import { createBudget } from '../src/lib/budgets/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase 9 — Gemini AI Integration & Insights Backend Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;
  let catElectronicsId;

  const userAData = {
    email: `phase9_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    email: `phase9_user_b_${Date.now()}@example.com`,
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

    // Create Category for User A
    const catRes = await createCategory(
      { name: 'AI Gadgets', type: 'expense', color: '#6366f1' },
      clientA
    );
    assert.strictEqual(catRes.status, 201);
    catElectronicsId = catRes.data.id;

    const today = new Date().toISOString().split('T')[0];
    const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];

    // Seed: Small regular transactions in Gadgets (avg ~$20)
    await createTransaction(
      {
        description: 'USB Cable',
        amount: 20.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: twentyEightDaysAgo,
        category_id: catElectronicsId,
      },
      clientA
    );
    await createTransaction(
      {
        description: 'Mouse Pad',
        amount: 20.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: twentyEightDaysAgo,
        category_id: catElectronicsId,
      },
      clientA
    );

    // Seed: Huge spike transaction in Gadgets ($500.00 >> avg $20)
    await createTransaction(
      {
        description: 'Ultra High-End Monitor',
        amount: 500.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: today,
        category_id: catElectronicsId,
      },
      clientA
    );

    // Seed: Recurring subscription charges from Netflix 28 days apart
    await createTransaction(
      {
        description: 'Netflix Monthly',
        amount: 15.99,
        currency: 'USD',
        type: 'expense',
        merchant: 'Netflix',
        transaction_date: twentyEightDaysAgo,
      },
      clientA
    );
    await createTransaction(
      {
        description: 'Netflix Monthly',
        amount: 15.99,
        currency: 'USD',
        type: 'expense',
        merchant: 'Netflix',
        transaction_date: today,
      },
      clientA
    );

    // Seed: Over-budget condition
    await createBudget(
      {
        name: 'Entertainment Limit',
        amount: 10.0, // tiny budget
        currency: 'USD',
        period_type: 'monthly',
        start_date: twentyEightDaysAgo,
        end_date: today,
      },
      clientA
    );
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('ai_messages').delete().eq('user_id', userAId);
        await adminClient.from('ai_conversations').delete().eq('user_id', userAId);
        await adminClient.from('insights').delete().eq('user_id', userAId);
        await adminClient.from('budgets').delete().eq('user_id', userAId);
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('categories').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('ai_messages').delete().eq('user_id', userBId);
        await adminClient.from('ai_conversations').delete().eq('user_id', userBId);
        await adminClient.from('insights').delete().eq('user_id', userBId);
        await adminClient.from('budgets').delete().eq('user_id', userBId);
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('categories').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  let spikeInsightId;

  test('9.1 Generates insights: detects spending spike, recurring charge, and budget alert', async () => {
    const res = await generateAndSaveInsights(clientA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.insights);
    assert.ok(res.data.insights.length >= 2, 'Should generate multiple insights from seeded data');

    // Verify spending spike detected
    const spike = res.data.insights.find((i) => i.type === 'spending_spike');
    assert.ok(spike, 'Spending spike insight should be detected');
    assert.ok(spike.title.includes('AI Gadgets') || spike.title.includes('Spike'));
    assert.ok(spike.evidence_metadata.amount === 500);
    spikeInsightId = spike.id;

    // Verify recurring charge detected
    const recurring = res.data.insights.find((i) => i.type === 'recurring_charge');
    assert.ok(recurring, 'Recurring charge insight should be detected');
    assert.strictEqual(recurring.evidence_metadata.average_amount, 15.99);

    // Verify budget alert detected
    const budgetAlert = res.data.insights.find((i) => i.type === 'budget_alert');
    assert.ok(budgetAlert, 'Budget alert insight should be detected');
  });

  test('9.2 Insight status transitions: viewed, dismissed, resolved', async () => {
    assert.ok(spikeInsightId, 'Spike insight ID required');

    // 1. Mark as viewed
    const viewed = await updateInsightStatus(spikeInsightId, 'viewed', clientA);
    assert.strictEqual(viewed.status, 200);
    assert.strictEqual(viewed.data.status, 'viewed');

    // 2. Mark as dismissed
    const dismissed = await updateInsightStatus(spikeInsightId, 'dismissed', clientA);
    assert.strictEqual(dismissed.status, 200);
    assert.strictEqual(dismissed.data.status, 'dismissed');

    // 3. Mark as resolved
    const resolved = await updateInsightStatus(spikeInsightId, 'resolved', clientA);
    assert.strictEqual(resolved.status, 200);
    assert.strictEqual(resolved.data.status, 'resolved');
  });

  test('9.3 Budget scenario simulation computes exact monthly and annualized savings', async () => {
    const res = await simulateBudgetScenario('AI Gadgets', 20, clientA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    assert.ok(res.data);
    assert.strictEqual(res.data.categoryName, 'AI Gadgets');
    // Total spent in AI Gadgets: 20 + 20 + 500 = 540.00
    assert.strictEqual(res.data.currentMonthlySpending, 540.0);
    // 20% savings = 108.00/mo
    assert.strictEqual(res.data.monthlySavings, 108.0);
    assert.strictEqual(res.data.reducedMonthlySpending, 432.0);
    // Annualized = 108 * 12 = 1296.00
    assert.strictEqual(res.data.annualizedSavings, 1296.0);
    assert.ok(res.data.explanation.includes('saving $108.00/month'));
  });

  let conversationId;

  test('9.4 Advisor Q&A: grounds answer on verified data and persists messages in Supabase', async () => {
    const res = await askFinancialAdvisor(
      'What was my largest expense recently and how much did it cost?',
      undefined,
      clientA
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.conversationId);
    assert.ok(res.data?.answer);
    assert.ok(res.data?.evidence);
    conversationId = res.data.conversationId;

    // Verify conversation was persisted in public.ai_conversations
    const convList = await listAIConversations(clientA);
    assert.strictEqual(convList.status, 200);
    assert.ok(convList.data.some((c) => c.id === conversationId));

    // Verify messages were persisted in public.ai_messages
    const msgList = await getConversationMessages(conversationId, clientA);
    assert.strictEqual(msgList.status, 200);
    assert.strictEqual(msgList.data.messages.length, 2); // 1 user + 1 assistant
    assert.strictEqual(msgList.data.messages[0].role, 'user');
    assert.strictEqual(msgList.data.messages[1].role, 'assistant');
    assert.ok(msgList.data.messages[1].evidence_references);
  });

  test('9.5 User isolation: User B cannot access User A insights or conversations', async () => {
    // User B insights list does not contain User A's insights
    const listB = await listInsights(undefined, clientB);
    assert.strictEqual(listB.status, 200);
    assert.strictEqual(listB.data.some((i) => i.id === spikeInsightId), false);

    // User B cannot update User A insight
    const updateB = await updateInsightStatus(spikeInsightId, 'dismissed', clientB);
    assert.strictEqual(updateB.status, 404);

    // User B cannot fetch User A conversation messages
    const convB = await getConversationMessages(conversationId, clientB);
    assert.strictEqual(convB.status, 404);
  });
});
