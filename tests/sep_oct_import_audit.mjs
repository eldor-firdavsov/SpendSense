import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { runImport } from '../scripts/import_sep_oct_transactions.mjs';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();

let serviceKey = null;
try {
  const keys = JSON.parse(
    execSync(
      '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
    ).toString()
  );
  serviceKey = keys.find(
    (k) => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role')
  )?.api_key;
} catch (err) {
  console.error('Failed to retrieve service key:', err);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('SpendSense AI — Sentabr va Oktabr 2026 Import Audit Suite', () => {
  const targetEmail = 'firdavsove1@gmail.com';
  let userId;
  let userScopedClient;

  test('Step 1: Resolve authenticated user profile', async () => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('email', targetEmail)
      .single();

    assert.ok(!error, `Profile retrieval failed: ${error?.message}`);
    assert.ok(profile?.id, 'User ID must exist');
    userId = profile.id;

    // Create userScopedClient
    const { data: userAuth } = await supabase.auth.admin.getUserById(userId);
    userScopedClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    userScopedClient.auth.getUser = async () => ({
      data: { user: userAuth.user },
      error: null,
    });
  });

  test('Step 2: Database state reconciliation for September and October 2026', async () => {
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('transaction_date, amount, type, description, categories(name)')
      .eq('user_id', userId)
      .gte('transaction_date', '2026-09-01')
      .lte('transaction_date', '2026-10-31');

    assert.ok(!error, `Failed to fetch transactions: ${error?.message}`);
    assert.ok(txs.length >= 77, `Expected at least 77 transactions, got ${txs.length}`);

    const septTxs = txs.filter((t) => t.transaction_date.startsWith('2026-09'));
    const octTxs = txs.filter((t) => t.transaction_date.startsWith('2026-10'));

    const septIncome = septTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const septExpense = septTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const octIncome = octTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const octExpense = octTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    assert.equal(septIncome, 6000000, 'Sentabr daromadi 6 000 000 UZS bo\'lishi shart');
    assert.equal(septExpense, 5000000, 'Sentabr xarajati 5 000 000 UZS bo\'lishi shart');
    assert.equal(septIncome - septExpense, 1000000, 'Sentabr qoldig\'i 1 000 000 UZS bo\'lishi shart');

    assert.equal(octIncome, 6000000, 'Oktabr daromadi 6 000 000 UZS bo\'lishi shart');
    assert.equal(octExpense, 4950000, 'Oktabr xarajati 4 950 000 UZS bo\'lishi shart');
    assert.equal(octIncome - octExpense, 1050000, 'Oktabr qoldig\'i 1 050 000 UZS bo\'lishi shart');
  });

  test('Step 3: Idempotency & Deduplication verification', async () => {
    const res = await runImport({ targetEmail, cleanPriorDemo: false });
    assert.equal(res.totalImported, 0, 'Re-running import should insert 0 new records');
    assert.equal(res.skippedDuplicates, 77, 'Re-running import should skip 77 duplicates');
  });

  test('Step 4: AI Advisor grounded financial questions verification (10 core scenarios)', async () => {
    const checks = [
      {
        question: '2026-yil sentabr oyida qancha oylik olganman?',
        contains: ['6 000 000'],
      },
      {
        question: '2026-yil sentabr oyida jami qancha xarajat qilganman?',
        contains: ['5 000 000'],
      },
      {
        question: '2026-yil oktabr oyida jami qancha xarajat qilganman?',
        contains: ['4 950 000'],
      },
      {
        question: 'Sentabr oyida qancha pul ortib qolgan?',
        contains: ['1 000 000'],
      },
      {
        question: 'Oktabr oyida qancha pul ortib qolgan?',
        contains: ['1 050 000'],
      },
      {
        question: 'Sentabr va oktabr xarajatlarimni taqqoslab ber.',
        contains: ['5 000 000', '4 950 000', '50 000'],
      },
      {
        question: 'Qaysi kategoriyalarga eng ko‘p pul sarfladim?',
        contains: ['Ijara va uy', '3 600 000', 'Oziq-ovqat'],
      },
      {
        question: 'Kafe, ichimliklar va taksiga jami qancha sarflaganman?',
        contains: ['2 035 000'],
      },
      {
        question: 'Qaysi kichik xarajatlarni kamaytirish orqali ko‘proq pul tejashim mumkin?',
        contains: ['585 000', '380 000', '1 070 000'],
      },
      {
        question: 'Ikki oy davomida jami qancha daromad oldim va qancha sarfladim?',
        contains: ['12 000 000', '9 950 000', '2 050 000'],
      },
    ];

    for (const c of checks) {
      const res = await askFinancialAdvisor(c.question, undefined, userScopedClient);
      assert.ok(!res.error, `AI error on "${c.question}": ${res.error}`);
      for (const phrase of c.contains) {
        assert.ok(
          res.data.answer.includes(phrase),
          `AI answer to "${c.question}" must contain "${phrase}". Got:\n${res.data.answer}`
        );
      }
    }
  });
});
