import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from '../src/lib/categories/service.ts';
import {
  createTransaction,
  getTransaction,
} from '../src/lib/transactions/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase D — Category Management Live Database & RLS Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;

  let systemExpenseCategory;
  let systemIncomeCategory;

  const userAData = {
    email: `phase_d_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Categories',
  };

  const userBData = {
    email: `phase_d_user_b_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Bob',
    lastName: 'Categories',
  };

  before(async () => {
    // 1. Get service role key for admin setup and teardown
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

    // 2. Fetch system categories
    const { data: sysExpense } = await adminClient
      .from('categories')
      .select('*')
      .eq('is_system', true)
      .eq('type', 'expense')
      .limit(1)
      .single();
    assert.ok(sysExpense, 'System expense category must exist');
    systemExpenseCategory = sysExpense;

    const { data: sysIncome } = await adminClient
      .from('categories')
      .select('*')
      .eq('is_system', true)
      .eq('type', 'income')
      .limit(1)
      .single();
    assert.ok(sysIncome, 'System income category must exist');
    systemIncomeCategory = sysIncome;

    // 3. Create User A and authenticate
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
    assert.ifError(errA);
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
      options: {
        data: {
          first_name: userBData.firstName,
          last_name: userBData.lastName,
        },
      },
    });
    assert.ifError(errB);
    userBId = signB.user.id;

    const { data: loginB } = await clientB.auth.signInWithPassword({
      email: userBData.email,
      password: userBData.password,
    });
    assert.ok(loginB.session, 'User B sign-in failed');
  });

  after(async () => {
    // Clean up test users and their data
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('categories').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('categories').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  // --- D1. Read Categories ---
  test('D1.1 Authenticated category listing returns system categories', async () => {
    const res = await listCategories({}, clientA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    assert.ok(res.data.length > 0, 'Categories list should not be empty');

    const hasSysExpense = res.data.some((c) => c.id === systemExpenseCategory.id && c.is_system === true);
    const hasSysIncome = res.data.some((c) => c.id === systemIncomeCategory.id && c.is_system === true);
    assert.strictEqual(hasSysExpense, true, 'System expense category must be included');
    assert.strictEqual(hasSysIncome, true, 'System income category must be included');
  });

  test('D1.2 Type filtering works for income and expense', async () => {
    const expenseRes = await listCategories({ type: 'expense' }, clientA);
    assert.strictEqual(expenseRes.status, 200);
    assert.ok(expenseRes.data.length > 0);
    assert.ok(expenseRes.data.every((c) => c.type === 'expense'));

    const incomeRes = await listCategories({ type: 'income' }, clientA);
    assert.strictEqual(incomeRes.status, 200);
    assert.ok(incomeRes.data.length > 0);
    assert.ok(incomeRes.data.every((c) => c.type === 'income'));
  });

  // --- D2. Create Categories ---
  let userACat1Id;
  let userBCat1Id;

  test('D2.1 Valid custom category creation succeeds with proper user_id and is_system=false', async () => {
    const res = await createCategory(
      {
        name: 'User A Custom Hobby',
        type: 'expense',
        description: 'Hobby and craft supplies',
        icon: 'palette',
        color: '#f59e0b',
      },
      clientA
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.id);
    assert.strictEqual(res.data.name, 'User A Custom Hobby');
    assert.strictEqual(res.data.type, 'expense');
    assert.strictEqual(res.data.description, 'Hobby and craft supplies');
    assert.strictEqual(res.data.icon, 'palette');
    assert.strictEqual(res.data.color, '#f59e0b');
    assert.strictEqual(res.data.user_id, userAId);
    assert.strictEqual(res.data.is_system, false);
    userACat1Id = res.data.id;
  });

  test('D2.2 Input validation rejects empty name, invalid type, and invalid hex color', async () => {
    const emptyNameRes = await createCategory(
      {
        name: '   ',
        type: 'expense',
      },
      clientA
    );
    assert.strictEqual(emptyNameRes.status, 400);
    assert.ok(emptyNameRes.error);

    const invalidTypeRes = await createCategory(
      {
        name: 'Invalid Type Category',
        type: 'investment',
      },
      clientA
    );
    assert.strictEqual(invalidTypeRes.status, 400);
    assert.ok(invalidTypeRes.error);

    const invalidColorRes = await createCategory(
      {
        name: 'Invalid Color Category',
        type: 'expense',
        color: 'not-a-color',
      },
      clientA
    );
    assert.strictEqual(invalidColorRes.status, 400);
    assert.ok(invalidColorRes.error);
  });

  test('D2.3 Client spoofing: ignores or rejects client-supplied user_id and is_system', async () => {
    // Attempt to spoof user_id to User B and is_system to true
    const res = await createCategory(
      {
        name: 'Spoof Attempt Cat',
        type: 'expense',
        user_id: userBId,
        is_system: true,
      },
      clientA
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.user_id, userAId);
    assert.strictEqual(res.data.is_system, false);

    // Clean up
    await deleteCategory(res.data.id, clientA);
  });

  test('D2.4 Duplicate name for same user and type is rejected with HTTP 409 Conflict', async () => {
    const dupRes = await createCategory(
      {
        name: 'User A Custom Hobby', // same name as D2.1
        type: 'expense',
      },
      clientA
    );
    assert.strictEqual(dupRes.status, 409);
    assert.ok(dupRes.error.includes('already exists'));

    // Case-insensitive duplicate name check
    const caseInsensitiveDup = await createCategory(
      {
        name: '  user a custom hobby  ',
        type: 'expense',
      },
      clientA
    );
    assert.strictEqual(caseInsensitiveDup.status, 409);

    // Different type with same name is ALLOWED (e.g. "Bonus" expense vs "Bonus" income)
    const incomeWithSameName = await createCategory(
      {
        name: 'User A Custom Hobby',
        type: 'income',
      },
      clientA
    );
    assert.strictEqual(incomeWithSameName.status, 201);
    assert.strictEqual(incomeWithSameName.data.type, 'income');

    // Clean up income category
    await deleteCategory(incomeWithSameName.data.id, clientA);
  });

  test('D2.5 User B can create category with the same name as User A without conflict', async () => {
    const res = await createCategory(
      {
        name: 'User A Custom Hobby', // Same name as User A, but owned by User B
        type: 'expense',
      },
      clientB
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.user_id, userBId);
    userBCat1Id = res.data.id;
  });

  // --- Isolation & Cross-User Privacy ---
  test('D1.3 User A cannot see User B private custom category in list', async () => {
    const resA = await listCategories({}, clientA);
    assert.strictEqual(resA.status, 200);
    const seesUserBCat = resA.data.some((c) => c.id === userBCat1Id);
    assert.strictEqual(seesUserBCat, false, 'User A must NOT see User B category');

    const seesUserACat = resA.data.some((c) => c.id === userACat1Id);
    assert.strictEqual(seesUserACat, true, 'User A must see own category');
  });

  test('D1.4 User A cannot fetch User B category directly by ID (returns 404)', async () => {
    const res = await getCategory(userBCat1Id, clientA);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data, null);
  });

  // --- D3. Update Categories ---
  test('D3.1 User A can edit their own custom category fields', async () => {
    const res = await updateCategory(
      userACat1Id,
      {
        name: 'User A Art & Crafts',
        description: 'Updated art description',
        color: '#3b82f6',
      },
      clientA
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'User A Art & Crafts');
    assert.strictEqual(res.data.description, 'Updated art description');
    assert.strictEqual(res.data.color, '#3b82f6');
  });

  test('D3.2 Updating nonexistent category returns HTTP 404', async () => {
    const res = await updateCategory(
      '00000000-0000-0000-0000-000000000000',
      {
        name: 'Nonexistent',
      },
      clientA
    );
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data, null);
  });

  test('D3.3 User A cannot edit User B custom category (returns HTTP 404)', async () => {
    const res = await updateCategory(
      userBCat1Id,
      {
        name: 'Hacked by User A',
      },
      clientA
    );
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data, null);
  });

  test('D3.4 Editing a system category is strictly forbidden with HTTP 403', async () => {
    const res = await updateCategory(
      systemExpenseCategory.id,
      {
        name: 'Hacked System Category',
      },
      clientA
    );
    assert.strictEqual(res.status, 403);
    assert.ok(res.error.includes('System categories cannot be modified'));
  });

  test('D3.5 Changing category type is rejected if transactions reference it', async () => {
    // 1. Create a transaction for User A referencing userACat1Id (which is 'expense')
    const txRes = await createTransaction(
      {
        amount: 45.5,
        type: 'expense',
        currency: 'USD',
        transaction_date: '2026-10-23',
        description: 'Art supplies purchase',
        category_id: userACat1Id,
      },
      clientA
    );
    assert.strictEqual(txRes.status, 201);
    assert.ok(txRes.data?.id);

    // 2. Attempt to change userACat1Id type to 'income'
    const updateRes = await updateCategory(
      userACat1Id,
      {
        type: 'income',
      },
      clientA
    );
    assert.strictEqual(updateRes.status, 400);
    assert.ok(updateRes.error.includes('Cannot change category type'));

    // 3. Delete the transaction
    const { error: delTxErr } = await clientA.from('transactions').delete().eq('id', txRes.data.id);
    assert.ifError(delTxErr);
  });

  // --- D4. Delete Categories ---
  test('D4.1 Deleting a system category is strictly forbidden with HTTP 403', async () => {
    const res = await deleteCategory(systemExpenseCategory.id, clientA);
    assert.strictEqual(res.status, 403);
    assert.ok(res.error.includes('System categories cannot be deleted'));
  });

  test('D4.2 User A cannot delete User B custom category (returns HTTP 404)', async () => {
    const res = await deleteCategory(userBCat1Id, clientA);
    assert.strictEqual(res.status, 404);
  });

  test('D4.3 Deleting an owned custom category preserves transactions with category_id = NULL', async () => {
    // 1. Create a category to test deletion
    const createRes = await createCategory(
      {
        name: 'Category To Delete',
        type: 'expense',
      },
      clientA
    );
    assert.strictEqual(createRes.status, 201);
    const tempCatId = createRes.data.id;

    // 2. Create a transaction assigned to tempCatId
    const txRes = await createTransaction(
      {
        amount: 99.99,
        type: 'expense',
        currency: 'USD',
        transaction_date: '2026-10-23',
        description: 'Safe deletion test transaction',
        category_id: tempCatId,
      },
      clientA
    );
    assert.strictEqual(txRes.status, 201);
    assert.strictEqual(txRes.data.category_id, tempCatId);

    // 3. Delete the category
    const delRes = await deleteCategory(tempCatId, clientA);
    assert.strictEqual(delRes.status, 200);

    // 4. Verify category is gone
    const checkCatRes = await getCategory(tempCatId, clientA);
    assert.strictEqual(checkCatRes.status, 404);

    // 5. Verify transaction SURVIVES and category_id is set to NULL
    const checkTxRes = await getTransaction(txRes.data.id, clientA);
    assert.strictEqual(checkTxRes.status, 200);
    assert.ok(checkTxRes.data, 'Transaction must survive category deletion');
    assert.strictEqual(checkTxRes.data.id, txRes.data.id);
    assert.strictEqual(checkTxRes.data.category_id, null, 'Transaction category_id must be set to NULL');
    assert.strictEqual(Number(checkTxRes.data.amount), 99.99);

    // Clean up test transaction
    await clientA.from('transactions').delete().eq('id', txRes.data.id);
  });

  // --- D5. Transaction CRUD & Category Compatibility ---
  test('D5.1 Expense transaction cannot use income category', async () => {
    const res = await createTransaction(
      {
        amount: 25.0,
        type: 'expense',
        currency: 'USD',
        transaction_date: '2026-10-23',
        description: 'Mismatched type test',
        category_id: systemIncomeCategory.id,
      },
      clientA
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.error.includes('type'));
  });

  test('D5.2 Income transaction cannot use expense category', async () => {
    const res = await createTransaction(
      {
        amount: 1000.0,
        type: 'income',
        currency: 'USD',
        transaction_date: '2026-10-23',
        description: 'Mismatched type test',
        category_id: systemExpenseCategory.id,
      },
      clientA
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.error.includes('type'));
  });
});
