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
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('SpendSense AI — Jamg‘arma maqsadlari hisob-kitoblari va tahlili testlari', () => {
  let adminClient;
  let testUserClient;
  let testUserId;

  const testUserData = {
    email: `goals_calc_user_${Date.now()}@example.com`,
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

    // Create a dedicated test user
    testUserClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signRes, error: signErr } = await testUserClient.auth.signUp({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ifError(signErr);
    testUserId = signRes.user.id;

    const { data: loginRes } = await testUserClient.auth.signInWithPassword({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ok(loginRes.session);

    // Seed realistic 2-month transactions for this test user
    // Sentabr 2026: Daromad 6 000 000, Xarajat 5 000 000 => Net = +1 000 000
    await createTransaction(
      {
        description: 'Sentabr oylik maosh',
        amount: 6000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-09-01',
      },
      testUserClient
    );
    await createTransaction(
      {
        description: 'Sentabr xarajatlari',
        amount: 5000000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-09-15',
      },
      testUserClient
    );

    // Oktabr 2026: Daromad 6 000 000, Xarajat 4 950 000 => Net = +1 050 000
    // O'rtacha oylik erkin mablag' = (1 000 000 + 1 050 000) / 2 = 1 025 000 UZS/oy
    await createTransaction(
      {
        description: 'Oktabr oylik maosh',
        amount: 6000000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-10-01',
      },
      testUserClient
    );
    await createTransaction(
      {
        description: 'Oktabr xarajatlari',
        amount: 4950000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-10-15',
      },
      testUserClient
    );
  });

  after(async () => {
    if (adminClient && testUserId) {
      await adminClient.from('transactions').delete().eq('user_id', testUserId);
      await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  test('Test 1: Qisman yig‘ilgan va imkoniyat yetmaydigan maqsad (25m target, 18m saved, 2 oy, kerak: 3.5m/oy > erkin 1.025m => unlikely)', async () => {
    // Current date is 2026-10-27. Target date: 2026-12-31 (2 calendar months remaining: Nov, Dec)
    const res = await createGoal(
      {
        name: 'M4 MacBook Pro',
        target_amount: 25000000,
        current_amount: 18000000,
        currency: 'UZS',
        target_date: '2026-12-31',
        tracking_strategy: 'manual',
      },
      testUserClient
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.error, null);
    const g = res.data;

    // 1. Asosiy hisob-kitob formulalari
    assert.strictEqual(g.target_amount, 25000000, 'Maqsad summasi 25 000 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.current_amount, 18000000, 'Yig‘ilgan mablag‘ 18 000 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.remaining_amount, 7000000, 'Qolgan summa aynan 7 000 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.percentage_completed, 72, 'Bajarilish foizi (18m / 25m * 100) = 72% bo‘lishi kerak');
    assert.strictEqual(g.status, 'in_progress');

    // 2. Feasibility va oylik jamg‘arish imkoniyati
    assert.strictEqual(g.feasibility.estimated_months_remaining, 2, 'Qolgan oylar soni 2 oy bo‘lishi kerak');
    assert.strictEqual(g.feasibility.monthly_needed, 3500000, 'Kerakli oylik jamg‘arma (7 000 000 / 2) = 3 500 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.feasibility.average_monthly_net_savings, 1025000, 'Oylik erkin mablag‘ 1 025 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.feasibility.status, 'unlikely', 'Kerakli 3.5m > 1.025m bo‘lgani uchun status unlikely bo‘lishi kerak');

    // 3. Tavsiya matni tekshiruvi: xarajatni kamaytirish yoki muddatni uzaytirish
    assert.ok(
      g.feasibility.explanation.includes('muddatni uzaytirish') ||
      g.feasibility.explanation.includes('xarajatlarni kamaytirish'),
      'Tavsiyada muddatni uzaytirish yoki xarajatlarni kamaytirish ko‘rsatilishi shart'
    );
    assert.ok(
      !g.feasibility.explanation.includes('806,666.67'),
      'Eski xato 806,666.67 qiymati ishlatilmasligi kerak'
    );
  });

  test('Test 2: Maqsad to‘liq yig‘ilgan holat (10m target, 10m saved => 100%, qolgan: 0, kerakli: 0, feasible)', async () => {
    const res = await createGoal(
      {
        name: 'Oila taʼmiri',
        target_amount: 10000000,
        current_amount: 10000000,
        currency: 'UZS',
        target_date: '2026-11-30',
        tracking_strategy: 'manual',
      },
      testUserClient
    );

    assert.strictEqual(res.status, 201);
    const g = res.data;

    assert.strictEqual(g.target_amount, 10000000);
    assert.strictEqual(g.current_amount, 10000000);
    assert.strictEqual(g.remaining_amount, 0, 'Qolgan summa 0 bo‘lishi kerak');
    assert.strictEqual(g.percentage_completed, 100, 'Bajarilish foizi 100% bo‘lishi kerak');
    assert.strictEqual(g.status, 'completed', 'Status completed bo‘lishi kerak');
    assert.strictEqual(g.feasibility.monthly_needed, 0, 'Kerakli oylik summa 0 bo‘lishi kerak');
    assert.strictEqual(g.feasibility.status, 'feasible');
    assert.ok(
      g.feasibility.explanation.includes('to‘liq bajarildi') || g.feasibility.explanation.includes('erishildi'),
      'Maqsad to‘liq bajarilgani ko‘rsatilishi kerak'
    );
  });

  test('Test 3: Oylik jamg‘arish imkoniyati yetarli bo‘lgan holat (15m target, 8.5m saved, 7 oy => kerak: 928 571 <= erkin 1 025 000 => feasible)', async () => {
    // Target date: 2027-05-01 (7 months remaining from 2026-10)
    const res = await createGoal(
      {
        name: 'Sayohat va ta‘til',
        target_amount: 15000000,
        current_amount: 8500000,
        currency: 'UZS',
        target_date: '2027-05-01',
        tracking_strategy: 'manual',
      },
      testUserClient
    );

    assert.strictEqual(res.status, 201);
    const g = res.data;

    assert.strictEqual(g.target_amount, 15000000);
    assert.strictEqual(g.current_amount, 8500000);
    assert.strictEqual(g.remaining_amount, 6500000, 'Qolgan summa 6 500 000 so‘m bo‘lishi kerak');
    assert.strictEqual(g.percentage_completed, 56.67, 'Bajarilish foizi 56.67% bo‘lishi kerak');
    assert.strictEqual(g.feasibility.estimated_months_remaining, 7, 'Qolgan oylar 7 oy bo‘lishi kerak');

    const expectedMonthly = Math.round((6500000 / 7) * 100) / 100; // 928571.43
    assert.strictEqual(g.feasibility.monthly_needed, expectedMonthly);
    assert.strictEqual(g.feasibility.status, 'feasible', '928k <= 1025k bo‘lgani uchun feasible bo‘lishi kerak');
    assert.ok(
      g.feasibility.explanation.includes('yetarli') || g.feasibility.explanation.includes('o‘z vaqtida'),
      'Erkin mablag‘ yetarli ekanligi ko‘rsatilishi kerak'
    );
  });

  test('Test 4: Jamg‘arma qo‘shish (deposit) va yechish (withdrawal)da qayta hisoblash va ma’lumotlar yaxlitligi', async () => {
    // 1. Yangi maqsad yaratish: 5 000 000 target, 1 000 000 current
    const createRes = await createGoal(
      {
        name: 'Velosiped',
        target_amount: 5000000,
        current_amount: 1000000,
        currency: 'UZS',
        target_date: '2026-12-31',
      },
      testUserClient
    );
    const goalId = createRes.data.id;
    assert.strictEqual(createRes.data.remaining_amount, 4000000);
    assert.strictEqual(createRes.data.percentage_completed, 20);

    // 2. 1 500 000 so‘m qo‘shish (deposit)
    const depositRes = await contributeToGoal(
      goalId,
      { amount: 1500000, note: 'Qo‘shimcha jamg‘arma' },
      testUserClient
    );
    assert.strictEqual(depositRes.status, 200);
    assert.strictEqual(depositRes.data.current_amount, 2500000);
    assert.strictEqual(depositRes.data.remaining_amount, 2500000);
    assert.strictEqual(depositRes.data.percentage_completed, 50);
    assert.strictEqual(depositRes.data.status, 'in_progress');

    // 3. 500 000 so‘m yechish (withdrawal)
    const withdrawRes = await contributeToGoal(
      goalId,
      { amount: -500000, note: 'Shoshilinch xarajat uchun' },
      testUserClient
    );
    assert.strictEqual(withdrawRes.status, 200);
    assert.strictEqual(withdrawRes.data.current_amount, 2000000);
    assert.strictEqual(withdrawRes.data.remaining_amount, 3000000);
    assert.strictEqual(withdrawRes.data.percentage_completed, 40);

    // 4. Maqsadni to‘ldirish (3 000 000 qo‘shish)
    const completeRes = await contributeToGoal(
      goalId,
      { amount: 3000000, note: 'To‘liq to‘ldirildi' },
      testUserClient
    );
    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.data.current_amount, 5000000);
    assert.strictEqual(completeRes.data.remaining_amount, 0);
    assert.strictEqual(completeRes.data.percentage_completed, 100);
    assert.strictEqual(completeRes.data.status, 'completed');
  });

  test('Test 5: Foydalanuvchi profilidagi barcha maqsadlar har xil haqiqiy ko‘rsatkichlarga ega (hech birida generic 806,666.67 yo‘q)', async () => {
    // Foydalanuvchining barcha maqsadlarini olish
    const listRes = await listGoals(testUserClient);
    assert.strictEqual(listRes.status, 200);
    const goals = listRes.data;

    assert.ok(goals.length >= 3, 'Kamida 3 ta maqsad bo‘lishi kerak');

    const monthlyNeeds = new Set();
    for (const g of goals) {
      // Hech qaysi maqsadda generic 806,666.67 bo‘lmasligi kerak
      assert.notStrictEqual(g.feasibility.monthly_needed, 806666.67);
      assert.ok(!g.feasibility.explanation.includes('806,666.67'));

      // Har bir ochiq maqsad uchun qolgan summa va foiz to‘g‘ri hisoblangan
      const computedRemaining = Math.max(0, Math.round((g.target_amount - g.current_amount) * 100) / 100);
      assert.strictEqual(g.remaining_amount, computedRemaining);

      const computedPct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 10000) / 100) : 0;
      assert.strictEqual(g.percentage_completed, computedPct);

      if (g.status !== 'completed' && g.feasibility.monthly_needed !== null) {
        monthlyNeeds.add(g.feasibility.monthly_needed);
      }
    }

    // Har xil maqsadlar har xil oylik talabga ega
    assert.ok(monthlyNeeds.size >= 2, 'Har bir maqsad o‘ziga xos kerakli oylik summaga ega bo‘lishi shart');
  });

  test('Test 6: AI moliyaviy maslahatchi maqsadlar bo‘yicha to‘g‘ri va asosli javob beradi', async () => {
    const aiRes = await askFinancialAdvisor(
      'M4 MacBook Pro maqsadi uchun qancha pul yig‘ishim kerak va erisha olamanmi?',
      undefined,
      testUserClient
    );
    assert.strictEqual(aiRes.status, 200);
    const aiAnswer = aiRes.data?.answer || '';

    assert.ok(aiAnswer, 'AI javob qaytarishi shart');
    assert.ok(
      aiAnswer.includes('25 000 000') || aiAnswer.includes('7 000 000') || aiAnswer.includes('3 500 000') || aiAnswer.includes('MacBook'),
      'AI javobida maqsadning haqiqiy summalari bo‘lishi kerak'
    );
    assert.ok(
      !aiAnswer.includes('806,666.67'),
      'AI javobida hech qanday 806,666.67 bo‘lmasligi kerak'
    );
  });
});
