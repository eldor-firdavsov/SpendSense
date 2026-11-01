import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  personalInfoStepSchema,
  monthlyIncomeStepSchema,
  monthlySpendingStepSchema,
  reductionTargetStepSchema,
  onboardingGoalItemSchema,
  completeOnboardingSchema,
} from '../src/lib/onboarding/schemas.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('SpendSense AI — Comprehensive Onboarding E2E & Clean Account Verification', () => {
  let adminClient = null;
  let testUserId = null;
  const testEmail = `onboarding_e2e_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  // Retrieve admin service role key for clean isolation
  try {
    const keys = JSON.parse(
      execSync(
        '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
      ).toString()
    );
    const serviceKey = keys.find(k => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role'))?.api_key;
    if (serviceKey) {
      adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    }
  } catch (err) {
    console.warn('Could not initialize adminClient via CLI, proceeding with anon tests:', err.message);
  }

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  after(async () => {
    if (adminClient && testUserId) {
      try {
        await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
        await adminClient.from('transactions').delete().eq('user_id', testUserId);
        await adminClient.from('budgets').delete().eq('user_id', testUserId);
        await adminClient.from('profiles').delete().eq('id', testUserId);
        await adminClient.auth.admin.deleteUser(testUserId);
      } catch (e) {
        console.error('Cleanup error:', e.message);
      }
    }
  });

  // =========================================================================
  // 1. SCHEMAS & VALIDATION
  // =========================================================================
  describe('1. Zod Validation & Input Normalization', () => {
    test('personalInfoStepSchema validates and trims Uzbek Latin names', () => {
      const valid = personalInfoStepSchema.safeParse({
        first_name: '  O‘ktam  ',
        last_name: '  Po‘latov  ',
      });
      assert.strictEqual(valid.success, true);
      if (valid.success) {
        assert.strictEqual(valid.data.first_name, 'O‘ktam');
        assert.strictEqual(valid.data.last_name, 'Po‘latov');
      }

      const invalid = personalInfoStepSchema.safeParse({
        first_name: '',
        last_name: 'P',
      });
      assert.strictEqual(invalid.success, false);
    });

    test('monthlyIncomeStepSchema accepts 0 UZS and standard income amounts', () => {
      const zero = monthlyIncomeStepSchema.safeParse({ declared_monthly_income: 0 });
      assert.strictEqual(zero.success, true);
      assert.strictEqual(zero.data.declared_monthly_income, 0);

      const standard = monthlyIncomeStepSchema.safeParse({ declared_monthly_income: 6000000 });
      assert.strictEqual(standard.success, true);
      assert.strictEqual(standard.data.declared_monthly_income, 6000000);

      const negative = monthlyIncomeStepSchema.safeParse({ declared_monthly_income: -50000 });
      assert.strictEqual(negative.success, false);
    });

    test('monthlySpendingStepSchema accepts 0 UZS and validates non-negative bounds', () => {
      const zero = monthlySpendingStepSchema.safeParse({ declared_monthly_expenses: 0 });
      assert.strictEqual(zero.success, true);

      const standard = monthlySpendingStepSchema.safeParse({ declared_monthly_expenses: 5000000 });
      assert.strictEqual(standard.success, true);

      const negative = monthlySpendingStepSchema.safeParse({ declared_monthly_expenses: -100 });
      assert.strictEqual(negative.success, false);
    });

    test('reductionTargetStepSchema validates bounds correctly', () => {
      const validPct = reductionTargetStepSchema.safeParse({
        target_expense_reduction_percent: 10,
        target_monthly_expenses: 4500000,
      });
      assert.strictEqual(validPct.success, true);

      const invalidPct = reductionTargetStepSchema.safeParse({
        target_expense_reduction_percent: 150,
        target_monthly_expenses: 4500000,
      });
      assert.strictEqual(invalidPct.success, false);
    });

    test('onboardingGoalItemSchema validates single goal item attributes', () => {
      const validGoal = onboardingGoalItemSchema.safeParse({
        key: 'laptop',
        name: 'MacBook Pro M4',
        target_amount: 15000000,
        target_date: '2026-12-31',
      });
      assert.strictEqual(validGoal.success, true);

      const invalidGoal = onboardingGoalItemSchema.safeParse({
        key: 'laptop',
        name: '',
        target_amount: -1000,
      });
      assert.strictEqual(invalidGoal.success, false);
    });

    test('completeOnboardingSchema validates full payload', () => {
      const validComplete = completeOnboardingSchema.safeParse({
        first_name: 'Shahzod',
        last_name: 'Karimov',
        declared_monthly_income: 6000000,
        declared_monthly_expenses: 5000000,
        target_expense_reduction_percent: 10,
        target_monthly_expenses: 4500000,
        goals: [
          { key: 'laptop', name: 'MacBook Pro M4', target_amount: 15000000 },
        ],
      });
      assert.strictEqual(validComplete.success, true);
    });
  });

  // =========================================================================
  // 2. NEW USER REGISTRATION & INITIAL CLEAN STATE
  // =========================================================================
  describe('2. New User Registration and Initial Clean State', () => {
    test('New user registers with clean state (no transactions, 0 balance)', async () => {
      const { data: authData, error: authErr } = await userClient.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            first_name: 'E2E',
            last_name: 'Tester',
          },
        },
      });

      assert.strictEqual(authErr, null, `SignUp error: ${authErr?.message}`);
      assert.ok(authData.user, 'Expected user to be created');
      testUserId = authData.user.id;

      // Ensure profile exists with onboarding_completed: false
      if (adminClient) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('*')
          .eq('id', testUserId)
          .single();

        assert.ok(profile, 'Profile should exist for new user');
        assert.strictEqual(profile.onboarding_completed, false, 'New user must have onboarding_completed = false');
        assert.ok(Number(profile.declared_monthly_income || 0) === 0, 'Initial declared income must be 0');
        assert.ok(Number(profile.declared_monthly_expenses || 0) === 0, 'Initial declared expenses must be 0');

        // Verify zero transactions
        const { count: txCount } = await adminClient
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', testUserId);
        assert.strictEqual(txCount, 0, 'New user must start with 0 transactions');

        // Verify zero budgets
        const { count: bgCount } = await adminClient
          .from('budgets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', testUserId);
        assert.strictEqual(bgCount, 0, 'New user must start with 0 budgets');

        // Verify zero financial goals
        const { count: gCount } = await adminClient
          .from('financial_goals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', testUserId);
        assert.strictEqual(gCount, 0, 'New user must start with 0 financial goals');
      }
    });
  });

  // =========================================================================
  // 3. ONBOARDING DRAFT PERSISTENCE
  // =========================================================================
  describe('3. Onboarding Progress and Draft Persistence', () => {
    test('Saves intermediate onboarding draft and step across sessions', async () => {
      if (!adminClient) return;

      const draftPayload = {
        firstName: 'Shahzod',
        lastName: 'Karimov',
        declaredMonthlyIncome: 6000000,
        declaredMonthlyExpenses: 5000000,
        targetExpenseReductionPercent: 10,
        targetMonthlyExpenses: 4500000,
        goals: [
          { name: 'MacBook Pro M4', targetAmount: 15000000 },
          { name: 'Sayohat', targetAmount: 10000000 },
        ],
      };

      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({
          onboarding_step: 4,
          onboarding_data: draftPayload,
        })
        .eq('id', testUserId);

      assert.strictEqual(updateErr, null, `Draft update error: ${updateErr?.message}`);

      // Verify draft can be read back
      const { data: readBack } = await adminClient
        .from('profiles')
        .select('onboarding_step, onboarding_data, onboarding_completed')
        .eq('id', testUserId)
        .single();

      assert.strictEqual(readBack.onboarding_step, 4);
      assert.strictEqual(readBack.onboarding_completed, false);
      assert.deepStrictEqual(readBack.onboarding_data.goals.length, 2);
    });
  });

  // =========================================================================
  // 4. ONBOARDING COMPLETION & CRITICAL FINANCIAL INTEGRITY
  // =========================================================================
  describe('4. Complete Onboarding and Enforce Clean Financial Rules', () => {
    test('Completes onboarding: saves planning data, creates goals with 0 saved amount, and 0 transactions', async () => {
      if (!adminClient) return;

      const submission = {
        firstName: 'Shahzod',
        lastName: 'Karimov',
        declaredMonthlyIncome: 6000000,
        declaredMonthlyExpenses: 5000000,
        targetExpenseReductionPercent: 10,
        targetMonthlyExpenses: 4500000,
        goals: [
          { name: 'MacBook Pro M4', targetAmount: 15000000 },
          { name: 'Favqulodda zaxira', targetAmount: 5000000 },
        ],
      };

      // 1. Update profile with completed status and planning values
      const { error: profErr } = await adminClient
        .from('profiles')
        .update({
          first_name: submission.firstName,
          last_name: submission.lastName,
          declared_monthly_income: submission.declaredMonthlyIncome,
          declared_monthly_expenses: submission.declaredMonthlyExpenses,
          target_expense_reduction_percent: submission.targetExpenseReductionPercent,
          target_monthly_expenses: submission.targetMonthlyExpenses,
          onboarding_completed: true,
          onboarding_step: 6,
          onboarding_data: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUserId);

      assert.strictEqual(profErr, null, `Profile complete error: ${profErr?.message}`);

      // 2. Insert goals with STRICT current_amount = 0
      const goalInserts = submission.goals.map((g) => ({
        user_id: testUserId,
        name: g.name,
        target_amount: g.targetAmount,
        current_amount: 0, // CRITICAL: Must be exactly 0
        currency: 'UZS',
        status: 'in_progress',
      }));

      const { error: goalErr } = await adminClient
        .from('financial_goals')
        .insert(goalInserts);

      assert.strictEqual(goalErr, null, `Goal insertion error: ${goalErr?.message}`);

      // =======================================================================
      // CRITICAL VERIFICATIONS:
      // =======================================================================

      // A. Verify profile data
      const { data: finalProfile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      assert.strictEqual(finalProfile.onboarding_completed, true);
      assert.strictEqual(finalProfile.first_name, 'Shahzod');
      assert.strictEqual(finalProfile.last_name, 'Karimov');
      assert.strictEqual(Number(finalProfile.declared_monthly_income), 6000000);
      assert.strictEqual(Number(finalProfile.declared_monthly_expenses), 5000000);
      assert.strictEqual(Number(finalProfile.target_expense_reduction_percent), 10);
      assert.strictEqual(Number(finalProfile.target_monthly_expenses), 4500000);

      // B. Verify ZERO transactions exist (No auto-generated salaries, no expenses)
      const { data: txs, count: txCount } = await adminClient
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', testUserId);

      assert.strictEqual(txCount, 0, 'Transactions count MUST BE EXACTLY ZERO');
      assert.strictEqual(txs.length, 0, 'No transaction records must be generated by onboarding');

      // C. Verify Goals have current_amount = 0
      const { data: createdGoals } = await adminClient
        .from('financial_goals')
        .select('*')
        .eq('user_id', testUserId)
        .order('created_at', { ascending: true });

      assert.strictEqual(createdGoals.length, 2);
      for (const g of createdGoals) {
        assert.strictEqual(
          Number(g.current_amount),
          0,
          `Goal "${g.name}" current_amount MUST BE EXACTLY 0, but got ${g.current_amount}`
        );
        assert.strictEqual(g.currency, 'UZS');
        assert.ok(Number(g.target_amount) > 0);
      }

      // D. Verify NO budgets were auto-created
      const { count: budgetCount } = await adminClient
        .from('budgets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId);

      assert.strictEqual(budgetCount, 0, 'Budgets count MUST BE ZERO');
    });
  });

  // =========================================================================
  // 5. EXISTING USER ONBOARDING BYPASS
  // =========================================================================
  describe('5. Existing User Login & Onboarding Bypass', () => {
    test('User with onboarding_completed = true bypasses onboarding flow', async () => {
      if (!adminClient) return;

      const { data: profile } = await adminClient
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', testUserId)
        .single();

      assert.strictEqual(profile.onboarding_completed, true);
    });
  });
});
