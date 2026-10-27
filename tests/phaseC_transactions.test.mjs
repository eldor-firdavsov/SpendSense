import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from '../src/lib/transactions/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase C — Transaction CRUD Implementation and Verification', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;

  let systemExpenseCategoryId;
  let systemIncomeCategoryId;
  let userACustomExpenseCategoryId;
  let userBCustomExpenseCategoryId;

  const userAData = {
    email: `phase_c_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Charlie',
    lastName: 'Transactions',
  };

  const userBData = {
    email: `phase_c_user_b_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Dana',
    lastName: 'Transactions',
  };

  before(async () => {
    // 1. Get service role key for admin setup and teardown
    let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      const keys = JSON.parse(
        execSync(
          '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
        ).toString()
      );
      serviceKey = keys.find(
        (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
      )?.api_key;
    }
    assert.ok(serviceKey, 'Service role key required');

    adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 2. Fetch system categories (one expense, one income)
    const { data: sysExpense } = await adminClient
      .from('categories')
      .select('id, name')
      .eq('is_system', true)
      .eq('type', 'expense')
      .limit(1)
      .single();
    assert.ok(sysExpense, 'System expense category must exist');
    systemExpenseCategoryId = sysExpense.id;

    const { data: sysIncome } = await adminClient
      .from('categories')
      .select('id, name')
      .eq('is_system', true)
      .eq('type', 'income')
      .limit(1)
      .single();
    assert.ok(sysIncome, 'System income category must exist');
    systemIncomeCategoryId = sysIncome.id;

    // 3. Create User A and authenticate
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await clientA.auth.signUp({
      email: userAData.email,
      password: userAData.password,
      options: { data: { first_name: userAData.firstName, last_name: userAData.lastName } },
    });
    assert.strictEqual(errA, null, 'User A sign-up failed');
    userAId = signA.user.id;

    const { data: loginA } = await clientA.auth.signInWithPassword({
      email: userAData.email,
      password: userAData.password,
    });
    assert.ok(loginA.session, 'User A sign-in failed');

    // 4. Create User B and authenticate
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientB.auth.signUp({
      email: userBData.email,
      password: userBData.password,
      options: { data: { first_name: userBData.firstName, last_name: userBData.lastName } },
    });
    assert.strictEqual(errB, null, 'User B sign-up failed');
    userBId = signB.user.id;

    const { data: loginB } = await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ok(loginB.session, 'User B sign-in failed');

    // 5. Create a custom category for User A
    const { data: catA, error: catAErr } = await clientA
      .from('categories')
      .insert({
        user_id: userAId,
        name: 'User A Electronics',
        type: 'expense',
        is_system: false,
      })
      .select()
      .single();
    assert.strictEqual(catAErr, null);
    userACustomExpenseCategoryId = catA.id;

    // 6. Create a custom category for User B
    const { data: catB, error: catBErr } = await clientB
      .from('categories')
      .insert({
        user_id: userBId,
        name: 'User B Luxury',
        type: 'expense',
        is_system: false,
      })
      .select()
      .single();
    assert.strictEqual(catBErr, null);
    userBCustomExpenseCategoryId = catB.id;
  });

  after(async () => {
    // Delete test users and cascaded records
    try {
      if (adminClient) {
        if (userAId) await adminClient.auth.admin.deleteUser(userAId);
        if (userBId) await adminClient.auth.admin.deleteUser(userBId);
      }
    } catch (e) {
      console.error('Test cleanup error:', e.message);
    }
  });

  // =========================================================================
  // Section 3: Transaction Creation Tests (14 Acceptance Scenarios)
  // =========================================================================
  describe('3. Transaction Creation', () => {
    test('1. Valid expense creation with system category', async () => {
      const res = await createTransaction(
        {
          description: 'Weekly Organic Grocery Run',
          amount: 145.85,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: systemExpenseCategoryId,
          merchant: 'Whole Foods Market',
          notes: 'Groceries for the week',
        },
        clientA
      );

      assert.strictEqual(res.error, null);
      assert.strictEqual(res.status, 201);
      assert.ok(res.data?.id);
      assert.strictEqual(res.data.user_id, userAId);
      assert.strictEqual(Number(res.data.amount), 145.85);
      assert.strictEqual(res.data.type, 'expense');
      assert.strictEqual(res.data.category_id, systemExpenseCategoryId);
      assert.strictEqual(res.data.categories?.type, 'expense');
    });

    test('2. Valid income creation with system category', async () => {
      const res = await createTransaction(
        {
          description: 'Monthly Engineering Salary',
          amount: 6500.0,
          currency: 'USD',
          type: 'income',
          transaction_date: '2026-10-22',
          category_id: systemIncomeCategoryId,
          merchant: 'Tech Corp',
        },
        clientA
      );

      assert.strictEqual(res.error, null);
      assert.strictEqual(res.status, 201);
      assert.ok(res.data?.id);
      assert.strictEqual(res.data.type, 'income');
      assert.strictEqual(Number(res.data.amount), 6500.0);
    });

    test('3. Missing description or required fields is rejected', async () => {
      const res = await createTransaction(
        {
          description: '',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );

      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('Description is required'));
    });

    test('4. Invalid amount (zero or negative) is rejected', async () => {
      const resZero = await createTransaction(
        {
          description: 'Zero test',
          amount: 0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(resZero.status, 400);
      assert.ok(resZero.error.includes('positive'));

      const resNeg = await createTransaction(
        {
          description: 'Negative test',
          amount: -25.5,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(resNeg.status, 400);
      assert.ok(resNeg.error.includes('positive'));
    });

    test('5. Too many decimal places (>2) is rejected', async () => {
      const res = await createTransaction(
        {
          description: 'Sub-cent amount',
          amount: 19.999,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('2 decimal places'));
    });

    test('6. Invalid currency code format is rejected', async () => {
      const resShort = await createTransaction(
        {
          description: 'Bad currency',
          amount: 10.0,
          currency: 'US',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(resShort.status, 400);
      assert.ok(resShort.error.includes('Currency'));

      const resDigit = await createTransaction(
        {
          description: 'Numeric currency',
          amount: 10.0,
          currency: '123',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(resDigit.status, 400);
    });

    test('7. Invalid transaction type is rejected', async () => {
      const res = await createTransaction(
        {
          description: 'Invalid type',
          amount: 50.0,
          currency: 'USD',
          type: 'crypto_transfer',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes("'income' or 'expense'"));
    });

    test('8. Invalid date format or non-existent date is rejected', async () => {
      const resFormat = await createTransaction(
        {
          description: 'Bad date format',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '22-10-2026',
        },
        clientA
      );
      assert.strictEqual(resFormat.status, 400);
      assert.ok(resFormat.error.includes('YYYY-MM-DD'));

      const resNonExistent = await createTransaction(
        {
          description: 'Bad calendar date',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-02-31',
        },
        clientA
      );
      assert.strictEqual(resNonExistent.status, 400);
    });

    test('9. Nonexistent category UUID is rejected', async () => {
      const res = await createTransaction(
        {
          description: 'Ghost category',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: '00000000-0000-0000-0000-000000000000',
        },
        clientA
      );
      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('category does not exist'));
    });

    test("10. Another user's private category is rejected", async () => {
      const res = await createTransaction(
        {
          description: 'Intrusion into User B category',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: userBCustomExpenseCategoryId,
        },
        clientA
      );
      assert.ok(res.status === 400 || res.status === 403);
      assert.ok(res.error);
    });

    test('11. Category type incompatible with transaction type is rejected', async () => {
      // User creates an expense transaction, but selects an income category
      const res = await createTransaction(
        {
          description: 'Mismatched category type',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: systemIncomeCategoryId, // Income category for an Expense!
        },
        clientA
      );
      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('incompatible with transaction type'));
    });

    test('12. Unauthenticated request is rejected', async () => {
      const unauthClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const res = await createTransaction(
        {
          description: 'Unauthenticated transaction',
          amount: 50.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        unauthClient
      );
      assert.strictEqual(res.status, 401);
      assert.ok(res.error.includes('Unauthorized'));
    });

    test('13. Attempted client-supplied user_id spoofing is ignored and forced to session UID', async () => {
      const res = await createTransaction(
        {
          description: 'Spoof user_id test',
          amount: 75.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          user_id: userBId, // Malicious attempt to assign to User B
        },
        clientA
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.user_id, userAId, 'user_id must be forced to authenticated user A');
    });

    test('14. Valid uncategorized transaction succeeds', async () => {
      const res = await createTransaction(
        {
          description: 'Uncategorized coffee',
          amount: 4.75,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: null,
        },
        clientA
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.category_id, null);
      assert.strictEqual(Number(res.data.amount), 4.75);
    });
  });

  // =========================================================================
  // Section 4: Transaction Listing Tests
  // =========================================================================
  describe('4. Transaction Listing', () => {
    test('User A sees only their own transactions, never User B', async () => {
      // Create a transaction for User B
      const { data: bTx } = await createTransaction(
        {
          description: 'Secret User B Expense',
          amount: 999.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientB
      );
      assert.ok(bTx);

      // List User A's transactions
      const resA = await listTransactions({ page: 1, pageSize: 20 }, clientA);
      assert.strictEqual(resA.status, 200);
      assert.ok(resA.data.transactions.length >= 3);
      // Ensure none belong to User B
      const foundB = resA.data.transactions.some((t) => t.id === bTx.id || t.user_id === userBId);
      assert.strictEqual(foundB, false, "User A must never see User B's transactions");

      // List User B's transactions
      const resB = await listTransactions({ page: 1, pageSize: 20 }, clientB);
      assert.strictEqual(resB.status, 200);
      assert.strictEqual(resB.data.transactions.length, 1);
      assert.strictEqual(resB.data.transactions[0].id, bTx.id);
    });

    test('Sorting by amount: ascending and descending', async () => {
      const resAsc = await listTransactions(
        { sortBy: 'amount', sortDirection: 'asc', pageSize: 10 },
        clientA
      );
      assert.strictEqual(resAsc.status, 200);
      const amountsAsc = resAsc.data.transactions.map((t) => Number(t.amount));
      for (let i = 0; i < amountsAsc.length - 1; i++) {
        assert.ok(amountsAsc[i] <= amountsAsc[i + 1], 'Amounts should be in ascending order');
      }

      const resDesc = await listTransactions(
        { sortBy: 'amount', sortDirection: 'desc', pageSize: 10 },
        clientA
      );
      assert.strictEqual(resDesc.status, 200);
      const amountsDesc = resDesc.data.transactions.map((t) => Number(t.amount));
      for (let i = 0; i < amountsDesc.length - 1; i++) {
        assert.ok(amountsDesc[i] >= amountsDesc[i + 1], 'Amounts should be in descending order');
      }
    });

    test('Pagination boundaries and page slicing', async () => {
      const resPage1 = await listTransactions({ page: 1, pageSize: 2 }, clientA);
      assert.strictEqual(resPage1.status, 200);
      assert.strictEqual(resPage1.data.transactions.length, 2);
      assert.strictEqual(resPage1.data.page, 1);
      assert.strictEqual(resPage1.data.pageSize, 2);

      const resPage2 = await listTransactions({ page: 2, pageSize: 2 }, clientA);
      assert.strictEqual(resPage2.status, 200);
      assert.strictEqual(resPage2.data.transactions.length, 2);
      assert.strictEqual(resPage2.data.page, 2);

      // Verify page 1 and page 2 don't overlap
      const idsPage1 = new Set(resPage1.data.transactions.map((t) => t.id));
      for (const t of resPage2.data.transactions) {
        assert.ok(!idsPage1.has(t.id), 'Page 1 and Page 2 must not contain duplicate items');
      }
    });

    test('Invalid pagination parameters are rejected', async () => {
      const resBadPage = await listTransactions({ page: 0 }, clientA);
      assert.strictEqual(resBadPage.status, 400);

      const resBadSize = await listTransactions({ pageSize: 500 }, clientA);
      assert.strictEqual(resBadSize.status, 400);
    });
  });

  // =========================================================================
  // Section 5: Transaction Filtering and Search Tests
  // =========================================================================
  describe('5. Transaction Filtering and Search', () => {
    let createdTxIds = [];

    before(async () => {
      // Seed a targeted dataset for filter testing
      const seedItems = [
        {
          description: 'Starbucks Morning Latte',
          amount: 6.5,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-05-10',
          merchant: 'Starbucks',
          category_id: systemExpenseCategoryId,
        },
        {
          description: 'Consulting Retainer Invoice #101',
          amount: 2500.0,
          currency: 'USD',
          type: 'income',
          transaction_date: '2026-06-15',
          merchant: 'Client Acme',
          category_id: systemIncomeCategoryId,
        },
        {
          description: 'Target Home Goods & Grocery',
          amount: 112.4,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-07-20',
          merchant: 'Target Store #45',
          category_id: systemExpenseCategoryId,
        },
      ];

      for (const item of seedItems) {
        const { data } = await createTransaction(item, clientA);
        if (data) createdTxIds.push(data.id);
      }
    });

    test('Filter by date range (inclusive)', async () => {
      const res = await listTransactions(
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        clientA
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 1);
      assert.strictEqual(res.data.transactions[0].description, 'Consulting Retainer Invoice #101');
    });

    test('Filter rejects invalid date range (endDate < startDate)', async () => {
      const res = await listTransactions(
        { startDate: '2026-12-31', endDate: '2026-01-01' },
        clientA
      );
      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('End date must be on or after start date'));
    });

    test('Filter by type: income only', async () => {
      const res = await listTransactions({ type: 'income' }, clientA);
      assert.strictEqual(res.status, 200);
      for (const t of res.data.transactions) {
        assert.strictEqual(t.type, 'income');
      }
    });

    test('Filter by type: expense only', async () => {
      const res = await listTransactions({ type: 'expense' }, clientA);
      assert.strictEqual(res.status, 200);
      for (const t of res.data.transactions) {
        assert.strictEqual(t.type, 'expense');
      }
    });

    test('Filter by category ID', async () => {
      const res = await listTransactions({ categoryId: systemIncomeCategoryId }, clientA);
      assert.strictEqual(res.status, 200);
      for (const t of res.data.transactions) {
        assert.strictEqual(t.category_id, systemIncomeCategoryId);
      }
    });

    test('Filter by search query matching description or merchant', async () => {
      const res = await listTransactions({ search: 'Starbucks' }, clientA);
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.transactions.length >= 1);
      assert.strictEqual(res.data.transactions[0].merchant, 'Starbucks');
    });

    test('Search input sanitization prevents SQL injection or errors', async () => {
      const res = await listTransactions({ search: "%' OR '1'='1" }, clientA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 0);
    });

    test('Combined filters: Date range + Type + Search', async () => {
      const res = await listTransactions(
        {
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          type: 'expense',
          search: 'Target',
        },
        clientA
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 1);
      assert.strictEqual(res.data.transactions[0].merchant, 'Target Store #45');
    });
  });

  // =========================================================================
  // Section 6: Transaction Editing Tests
  // =========================================================================
  describe('6. Transaction Editing', () => {
    let testTxId;

    before(async () => {
      const { data } = await createTransaction(
        {
          description: 'Editable Gas Fillup',
          amount: 45.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: systemExpenseCategoryId,
          merchant: 'Shell',
        },
        clientA
      );
      testTxId = data.id;
    });

    test('Valid description and amount update', async () => {
      const res = await updateTransaction(
        testTxId,
        {
          description: 'Chevron Premium Gas Fillup',
          amount: 52.3,
        },
        clientA
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.description, 'Chevron Premium Gas Fillup');
      assert.strictEqual(Number(res.data.amount), 52.3);
    });

    test('Category reassignment to another valid category of same type', async () => {
      const res = await updateTransaction(
        testTxId,
        {
          category_id: userACustomExpenseCategoryId,
        },
        clientA
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.category_id, userACustomExpenseCategoryId);
    });

    test('Category reassignment to incompatible type is rejected', async () => {
      // Reassign expense transaction to income category
      const res = await updateTransaction(
        testTxId,
        {
          category_id: systemIncomeCategoryId,
        },
        clientA
      );

      assert.strictEqual(res.status, 400);
      assert.ok(res.error.includes('incompatible with transaction type'));
    });

    test("Category reassignment to another user's category is rejected", async () => {
      const res = await updateTransaction(
        testTxId,
        {
          category_id: userBCustomExpenseCategoryId,
        },
        clientA
      );

      assert.ok(res.status === 400 || res.status === 403);
    });

    test('User B cannot update User A transaction', async () => {
      const res = await updateTransaction(
        testTxId,
        {
          description: 'Hacked by User B',
        },
        clientB
      );

      assert.strictEqual(res.status, 404);
      assert.ok(res.error.includes('not found'));
    });

    test('Updating non-existent transaction ID returns 404', async () => {
      const res = await updateTransaction(
        '00000000-0000-0000-0000-000000000000',
        { description: 'Ghost' },
        clientA
      );
      assert.strictEqual(res.status, 404);
    });

    test('Invalid amount update is rejected', async () => {
      const resNeg = await updateTransaction(testTxId, { amount: -10 }, clientA);
      assert.strictEqual(resNeg.status, 400);

      const resPrecision = await updateTransaction(testTxId, { amount: 10.999 }, clientA);
      assert.strictEqual(resPrecision.status, 400);
    });
  });

  // =========================================================================
  // Section 7: Transaction Deletion Tests
  // =========================================================================
  describe('7. Transaction Deletion', () => {
    let txToDeleteId;

    before(async () => {
      const { data } = await createTransaction(
        {
          description: 'Transaction to be deleted',
          amount: 30.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
        },
        clientA
      );
      txToDeleteId = data.id;
    });

    test('User B cannot delete User A transaction', async () => {
      const res = await deleteTransaction(txToDeleteId, clientB);
      assert.strictEqual(res.status, 404);
    });

    test('Deleting non-existent transaction returns 404', async () => {
      const res = await deleteTransaction('00000000-0000-0000-0000-000000000000', clientA);
      assert.strictEqual(res.status, 404);
    });

    test('User A deletes own transaction successfully', async () => {
      const res = await deleteTransaction(txToDeleteId, clientA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);

      // Verify record is gone
      const getRes = await getTransaction(txToDeleteId, clientA);
      assert.strictEqual(getRes.status, 404);
    });

    test('Deleting a custom category leaves associated transaction with category_id = NULL (ON DELETE SET NULL)', async () => {
      // 1. Create a category to delete
      const { data: tempCat } = await clientA
        .from('categories')
        .insert({
          user_id: userAId,
          name: 'Temporary Cat for Delete Test',
          type: 'expense',
          is_system: false,
        })
        .select()
        .single();
      assert.ok(tempCat);

      // 2. Create a transaction referencing this category
      const { data: linkedTx } = await createTransaction(
        {
          description: 'Linked to temp category',
          amount: 25.0,
          currency: 'USD',
          type: 'expense',
          transaction_date: '2026-10-22',
          category_id: tempCat.id,
        },
        clientA
      );
      assert.strictEqual(linkedTx.category_id, tempCat.id);

      // 3. Delete the category
      const { error: delCatErr } = await clientA.from('categories').delete().eq('id', tempCat.id);
      assert.strictEqual(delCatErr, null);

      // 4. Verify transaction still exists with category_id = NULL
      const checkTx = await getTransaction(linkedTx.id, clientA);
      assert.strictEqual(checkTx.status, 200);
      assert.strictEqual(checkTx.data.category_id, null, 'category_id must be SET NULL on category deletion');
      assert.strictEqual(checkTx.data.description, 'Linked to temp category');
    });
  });
});
