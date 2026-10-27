import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServerClient } from '@supabase/ssr';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() ||
  'https://omzreoaaownshtzpqsdt.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const BASE_URL = 'http://localhost:3000';

function createAuthSessionClient() {
  const cookies = {};
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookies[name] = value;
        });
      },
    },
  });

  return {
    client,
    getCookieHeader() {
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    },
  };
}

describe('SpendSense AI — Comprehensive User Journey & Financial Audit', () => {
  const sessionA = createAuthSessionClient();
  const sessionB = createAuthSessionClient();

  const userAEmail = `audit_journeys_a_${Date.now()}@spendsense.test`;
  const userBEmail = `audit_journeys_b_${Date.now()}@spendsense.test`;
  const password = 'Password123!Secure';

  let customIncomeCategoryId = null;
  let customExpenseCategoryId = null;
  let systemHousingCategoryId = null;
  let tempTransactionId = null;
  let rentTransactionId = null;
  let housingBudgetId = null;
  let emergencyGoalId = null;

  it('Journey 1: User Registration and Authentication', async () => {
    const { data: signA, error: errA } = await sessionA.client.auth.signUp({
      email: userAEmail,
      password,
      options: {
        data: {
          first_name: 'Audit',
          last_name: 'Tester',
        },
      },
    });
    assert.equal(errA, null, `User A registration failed: ${errA?.message}`);
    assert.ok(signA.user?.id);

    const { data: loginA, error: loginErrA } = await sessionA.client.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    assert.equal(loginErrA, null);
    assert.ok(loginA.session);

    // Verify /dashboard renders with 200
    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(dashRes.status, 200);
    const html = await dashRes.text();
    assert.ok(html.includes('Welcome back'));
  });

  it('Journey 2: Create Custom Income and Expense Categories', async () => {
    // 1. Create custom expense category "Groceries Plus"
    const expRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionA.getCookieHeader(),
      },
      body: JSON.stringify({
        name: 'Groceries Plus',
        type: 'expense',
        color: '#10b981',
      }),
    });
    assert.equal(expRes.status, 201);
    const expJson = await expRes.json();
    assert.ok(expJson.category?.id);
    assert.equal(expJson.category.name, 'Groceries Plus');
    customExpenseCategoryId = expJson.category.id;

    // 2. Create custom income category "Consulting"
    const incRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionA.getCookieHeader(),
      },
      body: JSON.stringify({
        name: 'Consulting',
        type: 'income',
        color: '#3b82f6',
      }),
    });
    assert.equal(incRes.status, 201);
    const incJson = await incRes.json();
    assert.ok(incJson.category?.id);
    assert.equal(incJson.category.name, 'Consulting');
    customIncomeCategoryId = incJson.category.id;

    // 3. List categories and find system Housing category
    const listRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(Array.isArray(listJson.categories));
    const housing = listJson.categories.find(
      (c) => c.is_system && c.name.toLowerCase().includes('housing')
    );
    assert.ok(housing, 'System Housing category must exist');
    systemHousingCategoryId = housing.id;
  });

  it('Journey 3: Transaction CRUD, Editing, Deletion, and Persistence', async () => {
    // 1. Create Income: Tech Consulting Stipend ($5,000.00)
    const tx1Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        description: 'Tech Consulting Stipend',
        amount: 5000.0,
        currency: 'USD',
        type: 'income',
        category_id: customIncomeCategoryId,
        transaction_date: '2026-10-01',
      }),
    });
    assert.equal(tx1Res.status, 201);

    // 2. Create Expense: Cozy Studio Rent ($1,500.00)
    const tx2Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        description: 'Cozy Studio Rent',
        amount: 1500.0,
        currency: 'USD',
        type: 'expense',
        category_id: systemHousingCategoryId,
        transaction_date: '2026-10-02',
      }),
    });
    assert.equal(tx2Res.status, 201);
    const tx2Json = await tx2Res.json();
    rentTransactionId = tx2Json.transaction.id;

    // 3. Create Expense: Whole Foods Market ($200.00)
    const tx3Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        description: 'Whole Foods Market',
        amount: 200.0,
        currency: 'USD',
        type: 'expense',
        category_id: customExpenseCategoryId,
        transaction_date: '2026-10-05',
      }),
    });
    assert.equal(tx3Res.status, 201);

    // 4. Create Temporary Erroneous Entry ($50.00)
    const txTempRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        description: 'Temp Erroneous Entry',
        amount: 50.0,
        currency: 'USD',
        type: 'expense',
        transaction_date: '2026-10-06',
      }),
    });
    assert.equal(txTempRes.status, 201);
    const txTempJson = await txTempRes.json();
    tempTransactionId = txTempJson.transaction.id;

    // 5. Edit Temporary Entry: Change amount from $50.00 to $75.00
    const editRes = await fetch(`${BASE_URL}/api/transactions/${tempTransactionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        amount: 75.0,
      }),
    });
    assert.equal(editRes.status, 200);
    const editJson = await editRes.json();
    assert.equal(Number(editJson.transaction.amount), 75.0);

    // 6. Delete Temporary Entry
    const delRes = await fetch(`${BASE_URL}/api/transactions/${tempTransactionId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(delRes.status, 200);

    // 7. Verify persistence: exactly 3 transactions remain
    const listRes = await fetch(`${BASE_URL}/api/transactions?limit=50`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.equal(listJson.transactions.length, 3);
    assert.ok(listJson.transactions.some((t) => t.description === 'Tech Consulting Stipend'));
    assert.ok(listJson.transactions.some((t) => t.description === 'Cozy Studio Rent'));
    assert.ok(listJson.transactions.some((t) => t.description === 'Whole Foods Market'));
    assert.equal(listJson.transactions.some((t) => t.id === tempTransactionId), false);
  });

  it('Journey 4: Data Import (CSV, XLSX, and Invalid File Protection)', async () => {
    // 1. Preview valid CSV using multipart/form-data
    const validCsvContent = [
      'Date,Description,Amount,Type,Merchant',
      '2026-10-12,Gym Membership,50.00,expense,FitClub',
      '2026-10-14,Freelance Logo Design,350.00,income,Acme Client',
    ].join('\n');

    const formCsv = new FormData();
    formCsv.append('file', new Blob([validCsvContent], { type: 'text/csv' }), 'valid_import.csv');

    const previewCsvRes = await fetch(`${BASE_URL}/api/imports/preview`, {
      method: 'POST',
      headers: { Cookie: sessionA.getCookieHeader() },
      body: formCsv,
    });
    assert.equal(previewCsvRes.status, 200);
    const previewCsvJson = await previewCsvRes.json();
    assert.equal(previewCsvJson.preview.validRows, 2);
    assert.equal(previewCsvJson.preview.invalidRows, 0);

    // Commit valid CSV rows
    const commitCsvRes = await fetch(`${BASE_URL}/api/imports/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        filename: 'valid_import.csv',
        duplicateStrategy: 'skip',
        rows: previewCsvJson.preview.rows.map((r) => r.parsed),
      }),
    });
    assert.equal(commitCsvRes.status, 201);
    const commitCsvJson = await commitCsvRes.json();
    assert.equal(commitCsvJson.result.importedRows, 2);

    // 2. Preview XLSX file using multipart/form-data
    const xlsxBuffer = fs.readFileSync(
      '/home/eldor_firdavsov/Desktop/SpendSense/test_fixtures/valid_import.xlsx'
    );
    const formXlsx = new FormData();
    formXlsx.append(
      'file',
      new Blob([xlsxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'valid_import.xlsx'
    );

    const previewXlsxRes = await fetch(`${BASE_URL}/api/imports/preview`, {
      method: 'POST',
      headers: { Cookie: sessionA.getCookieHeader() },
      body: formXlsx,
    });
    assert.equal(previewXlsxRes.status, 200);
    const previewXlsxJson = await previewXlsxRes.json();
    assert.equal(previewXlsxJson.preview.validRows, 1);
    assert.equal(previewXlsxJson.preview.rows[0].parsed.description, 'Books and Courses');

    // Commit XLSX
    const commitXlsxRes = await fetch(`${BASE_URL}/api/imports/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        filename: 'valid_import.xlsx',
        duplicateStrategy: 'skip',
        rows: previewXlsxJson.preview.rows.map((r) => r.parsed),
      }),
    });
    assert.equal(commitXlsxRes.status, 201);

    // 3. Invalid file test: test formula injection neutralization & row validation
    const invalidCsv = [
      'Date,Description,Amount,Type',
      'invalid-date,Bad Date,15.00,expense',
      '2026-10-18,Zero Amount,0.00,expense',
      '2026-10-19,=cmd|/c calc!A0,45.00,expense',
    ].join('\n');

    const formInv = new FormData();
    formInv.append('file', new Blob([invalidCsv], { type: 'text/csv' }), 'invalid.csv');

    const previewInvRes = await fetch(`${BASE_URL}/api/imports/preview`, {
      method: 'POST',
      headers: { Cookie: sessionA.getCookieHeader() },
      body: formInv,
    });
    assert.equal(previewInvRes.status, 200);
    const previewInvJson = await previewInvRes.json();
    assert.equal(previewInvJson.preview.invalidRows, 2); // bad date and zero amount
    const sanitizedRow = previewInvJson.preview.rows.find((r) => r.rowIndex === 3);
    assert.ok(
      sanitizedRow.parsed.description.startsWith("'="),
      'Formula injection must be sanitized with prepended single quote'
    );
  });

  it('Journey 5: Deterministic Financial Analytics & Exact Calculation Verification', async () => {
    // Current dataset summary:
    // Income:
    // - Tech Consulting Stipend: $5,000.00
    // - Freelance Logo Design: $350.00
    // Total Income = $5,350.00
    //
    // Expenses:
    // - Cozy Studio Rent: $1,500.00
    // - Whole Foods Market: $200.00
    // - Gym Membership: $50.00
    // - Books and Courses: $80.00
    // Total Expenses = $1,830.00
    //
    // Net Cash Flow = 5350.00 - 1830.00 = +$3,520.00
    // Savings Rate = (3520.00 / 5350.00) * 100 = 65.79439... -> 65.79%

    const analyticsRes = await fetch(
      `${BASE_URL}/api/analytics?period=month&startDate=2026-10-01&endDate=2026-10-31`,
      { headers: { Cookie: sessionA.getCookieHeader() } }
    );
    assert.equal(analyticsRes.status, 200);
    const { analytics } = await analyticsRes.json();

    assert.equal(analytics.totalIncome, 5350.0);
    assert.equal(analytics.totalExpenses, 1830.0);
    assert.equal(analytics.netCashFlow, 3520.0);
    assert.equal(analytics.savingsRate, 65.79);
    assert.equal(analytics.transactionCount, 6);

    // Category breakdown check
    const housingBreakdown = analytics.expenseBreakdown.find(
      (c) => c.categoryName.toLowerCase().includes('housing')
    );
    assert.ok(housingBreakdown);
    assert.equal(housingBreakdown.totalAmount, 1500.0);

    const groceriesBreakdown = analytics.expenseBreakdown.find(
      (c) => c.categoryName === 'Groceries Plus'
    );
    assert.ok(groceriesBreakdown);
    assert.equal(groceriesBreakdown.totalAmount, 200.0);

    // Largest transactions check
    assert.ok(analytics.largestExpenses.length > 0);
    assert.equal(analytics.largestExpenses[0].amount, 1500.0);
    assert.ok(analytics.largestIncome.length > 0);
    assert.equal(analytics.largestIncome[0].amount, 5000.0);
  });

  it('Journey 6: Budget Creation, Spending Calculation, and Over-Budget Thresholds', async () => {
    // Create Housing budget: $2,000.00 monthly
    const budgetRes = await fetch(`${BASE_URL}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        name: 'Monthly Housing',
        category_id: systemHousingCategoryId,
        amount: 2000.0,
        currency: 'USD',
        period_type: 'monthly',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
      }),
    });
    assert.equal(budgetRes.status, 201);
    const budgetJson = await budgetRes.json();
    housingBudgetId = budgetJson.budget.id;

    // List budgets and verify spending calculation
    const listRes = await fetch(`${BASE_URL}/api/budgets`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    const housingBudget = listJson.budgets.find((b) => b.id === housingBudgetId);
    assert.ok(housingBudget);
    assert.equal(housingBudget.spent, 1500.0); // Exact rent amount
    assert.equal(housingBudget.remaining, 500.0);
    assert.equal(housingBudget.percentageUsed, 75);
    assert.equal(housingBudget.status, 'on_track');
  });

  it('Journey 7: Savings Goals and Contribution Tracking', async () => {
    // Create Emergency Fund goal: Target $10,000.00
    const goalRes = await fetch(`${BASE_URL}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        name: 'Emergency Fund',
        target_amount: 10000.0,
        currency: 'USD',
        target_date: '2027-12-31',
      }),
    });
    assert.equal(goalRes.status, 201);
    const goalJson = await goalRes.json();
    emergencyGoalId = goalJson.goal.id;

    // Contribute $500.00 deposit
    const contribRes = await fetch(`${BASE_URL}/api/goals/${emergencyGoalId}/contributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        amount: 500.0,
      }),
    });
    assert.equal(contribRes.status, 200);
    const contribJson = await contribRes.json();
    assert.equal(contribJson.goal.current_amount, 500.0);
    assert.equal(contribJson.goal.remaining_amount, 9500.0);
    assert.equal(contribJson.goal.percentage_completed, 5.0);
  });

  it('Journey 8: AI Advisor Grounded Q&A and Insights Feed', async () => {
    // Ask AI Advisor question grounded in actual data
    const aiRes = await fetch(`${BASE_URL}/api/ai/advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionA.getCookieHeader() },
      body: JSON.stringify({
        question: 'What was my highest expense this month and how much was it?',
      }),
    });
    assert.equal(aiRes.status, 200);
    const aiJson = await aiRes.json();
    assert.ok(aiJson.response?.answer, 'AI response must contain answer');
    const answer = aiJson.response.answer;
    assert.ok(
      answer.includes('1,500') || answer.includes('1500') || answer.toLowerCase().includes('rent'),
      `AI response must accurately identify Cozy Studio Rent ($1,500): ${answer}`
    );

    // Verify conversation thread is stored
    const convRes = await fetch(`${BASE_URL}/api/ai/conversations`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(convRes.status, 200);
    const convJson = await convRes.json();
    assert.ok(Array.isArray(convJson.conversations));

    // Verify insights endpoint
    const insRes = await fetch(`${BASE_URL}/api/ai/insights`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(insRes.status, 200);
    const insJson = await insRes.json();
    assert.ok(Array.isArray(insJson.insights));
  });

  it('Journey 9: Settings Page, Profile State, Sign Out, and Relogin', async () => {
    // 1. Verify settings page renders with 200
    const settingsGet = await fetch(`${BASE_URL}/settings`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(settingsGet.status, 200);
    const settingsHtml = await settingsGet.text();
    assert.ok(settingsHtml.includes('Account Settings'));

    // 2. Sign out
    await sessionA.client.auth.signOut();

    // 3. Relogin with credentials
    const relogin = await sessionA.client.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    assert.equal(relogin.error, null);
    assert.ok(relogin.data.session);

    // 4. Verify all data persists after relogin
    const postLoginDash = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(postLoginDash.status, 200);

    const txCheck = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { Cookie: sessionA.getCookieHeader() },
    });
    assert.equal(txCheck.status, 200);
    const txJson = await txCheck.json();
    assert.equal(txJson.transactions.length, 6); // 3 manual + 2 CSV + 1 XLSX
  });

  it('Journey 10: Multi-Tenant Security & Owner Isolation', async () => {
    // Register User B
    const { data: signB, error: errB } = await sessionB.client.auth.signUp({
      email: userBEmail,
      password,
      options: { data: { first_name: 'UserB', last_name: 'Isolation' } },
    });
    assert.equal(errB, null);

    const { data: loginB } = await sessionB.client.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    assert.ok(loginB.session);

    // 1. User B cannot see User A's transactions
    const bTxsRes = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { Cookie: sessionB.getCookieHeader() },
    });
    assert.equal(bTxsRes.status, 200);
    const bTxs = await bTxsRes.json();
    assert.equal(bTxs.transactions.length, 0, 'User B must see 0 transactions initially');

    // 2. User B cannot update User A's transaction
    const bUpdateTx = await fetch(`${BASE_URL}/api/transactions/${rentTransactionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: sessionB.getCookieHeader() },
      body: JSON.stringify({ amount: 1.0 }),
    });
    assert.equal(bUpdateTx.status, 404);

    // 3. User B cannot delete User A's transaction
    const bDeleteTx = await fetch(`${BASE_URL}/api/transactions/${rentTransactionId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionB.getCookieHeader() },
    });
    assert.equal(bDeleteTx.status, 404);

    // 4. User B cannot see User A's custom category
    const bCatsRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { Cookie: sessionB.getCookieHeader() },
    });
    const bCats = await bCatsRes.json();
    assert.equal(bCats.categories.some((c) => c.id === customExpenseCategoryId), false);

    // 5. User B cannot see User A's budget
    const bBudgetsRes = await fetch(`${BASE_URL}/api/budgets`, {
      headers: { Cookie: sessionB.getCookieHeader() },
    });
    const bBudgets = await bBudgetsRes.json();
    assert.equal(bBudgets.budgets.some((b) => b.id === housingBudgetId), false);

    // 6. User B cannot see User A's savings goal
    const bGoalsRes = await fetch(`${BASE_URL}/api/goals`, {
      headers: { Cookie: sessionB.getCookieHeader() },
    });
    const bGoals = await bGoalsRes.json();
    assert.equal(bGoals.goals.some((g) => g.id === emergencyGoalId), false);

    // 7. Unauthenticated requests to API routes return 401
    const unauthTxs = await fetch(`${BASE_URL}/api/transactions`);
    assert.equal(unauthTxs.status, 401);

    const unauthBudgets = await fetch(`${BASE_URL}/api/budgets`);
    assert.equal(unauthBudgets.status, 401);

    const unauthGoals = await fetch(`${BASE_URL}/api/goals`);
    assert.equal(unauthGoals.status, 401);
  });
});
