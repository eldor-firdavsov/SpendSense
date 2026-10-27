import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import * as _XLSX from 'xlsx';
const XLSX = _XLSX.default || _XLSX;

const EXCEL_PATH = '/home/eldor_firdavsov/Desktop/SpendSense/SpendSense_AI_2_Oylik_Demo_Tranzaksiyalar.xlsx';
const DEMO_EMAIL = 'demo@spendsense.io';
const DEMO_PASSWORD = 'Password123!Demo';

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

if (!supabaseUrl || !serviceKey) {
  console.error('Error: Supabase URL and service role key are required.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// Pad helper
const pad = (n) => String(n).padStart(2, '0');

export async function runSeed({ targetEmail = DEMO_EMAIL, cleanFirst = false } = {}) {
  console.log('====================================================');
  console.log(` SpendSense AI: 2-Month Transactions Seeder for ${targetEmail}`);
  console.log('====================================================');

  // 1. Verify / Resolve Target User
  console.log(`Checking account: ${targetEmail}...`);
  const { data: users, error: uErr } = await adminClient.auth.admin.listUsers();
  if (uErr) throw uErr;

  let targetUser = users.users.find((u) => u.email === targetEmail);

  if (!targetUser) {
    console.log(`Account not found. Creating ${targetEmail}...`);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: targetEmail,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Foydalanuvchi', last_name: 'SpendSense' },
    });
    if (createErr) throw createErr;
    targetUser = created.user;
  }

  const userId = targetUser.id;
  console.log(`[PASS] User confirmed: ID ${userId}`);

  // Ensure profile is set if not already present
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    await adminClient.from('profiles').insert({
      id: userId,
      email: targetEmail,
      first_name: 'Foydalanuvchi',
      last_name: 'SpendSense',
      updated_at: new Date().toISOString(),
    });
  }

  // 2. Read and parse Excel file
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found at: ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH, { raw: true });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets['Tranzaksiyalar']);
  console.log(`Read ${rawRows.length} source transaction records from Excel sheet 'Tranzaksiyalar'.`);

  // 3. Ensure custom Uzbek categories exist for this user
  console.log('Creating/verifying custom demo categories for user...');
  const categoryDefinitions = [
    { name: 'Maosh', type: 'income', icon: 'briefcase', color: '#176B45', description: 'Oylik asosiy maosh daromadi' },
    { name: 'Uy-joy', type: 'expense', icon: 'home', color: '#4B75E8', description: 'Ijara va uy-joy xarajatlari' },
    { name: 'Oziq-ovqat', type: 'expense', icon: 'shopping-cart', color: '#10B981', description: 'Supermarket va bozor xaridlari' },
    { name: 'Transport', type: 'expense', icon: 'car', color: '#F59E0B', description: 'Yandex Go, metro va transport xarajatlari' },
    { name: 'Kafe va restoran', type: 'expense', icon: 'utensils', color: '#EF4444', description: 'Kafelar, tushliklar va restoranlar' },
    { name: "O'tkazmalar", type: 'expense', icon: 'arrow-right-left', color: '#8B5CF6', description: 'Oila va do‘stlarga pul o‘tkazmalari' },
    { name: "Sog'liq", type: 'expense', icon: 'heart-pulse', color: '#EC4899', description: 'Dorixona va tibbiy xizmatlar' },
    { name: "Ko'ngilochar", type: 'expense', icon: 'film', color: '#6366F1', description: 'Kino, dam olish va obunalar' },
    { name: 'Kommunal', type: 'expense', icon: 'zap', color: '#EAB308', description: 'Elektr, gaz, suv va maishiy xizmatlar' },
    { name: 'Ichimliklar va snack', type: 'expense', icon: 'coffee', color: '#D97706', description: 'Qahva, Red Bull va tezkor gazaklar' },
    { name: 'Xaridlar', type: 'expense', icon: 'shopping-bag', color: '#06B6D4', description: 'Kiyim-kechak va shaxsiy buyumlar' },
    { name: 'Mobil aloqa', type: 'expense', icon: 'smartphone', color: '#3B82F6', description: 'Internet to‘plami va mobil balans' },
  ];

  const catMap = new Map();

  for (const catDef of categoryDefinitions) {
    const { data: existingCat } = await adminClient
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('name', catDef.name)
      .eq('type', catDef.type)
      .maybeSingle();

    if (existingCat) {
      catMap.set(catDef.name, existingCat.id);
    } else {
      const { data: newCat, error: insertCatErr } = await adminClient
        .from('categories')
        .insert({
          user_id: userId,
          name: catDef.name,
          type: catDef.type,
          icon: catDef.icon,
          color: catDef.color,
          description: catDef.description,
          is_system: false,
        })
        .select()
        .single();
      if (insertCatErr) throw insertCatErr;
      catMap.set(catDef.name, newCat.id);
    }
  }
  console.log(`[PASS] All ${catMap.size} custom categories resolved with valid UUIDs.`);

  // 4. Optional: Clean previous records if cleanFirst is requested
  if (cleanFirst) {
    console.log('Cleaning previous demo records for fresh reseed...');
    await adminClient.from('transactions').delete().eq('user_id', userId);
    await adminClient.from('budgets').delete().eq('user_id', userId);
    await adminClient.from('financial_goals').delete().eq('user_id', userId);
    await adminClient.from('ai_messages').delete().eq('user_id', userId);
    await adminClient.from('ai_conversations').delete().eq('user_id', userId);
  }

  // 5. Query existing transactions for Idempotency
  const { data: existingTxs } = await adminClient
    .from('transactions')
    .select('id, notes, transaction_date, amount, type')
    .eq('user_id', userId);

  const existingNotesSet = new Set((existingTxs || []).map((t) => t.notes).filter(Boolean));

  let insertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const rowsToInsert = [];

  for (const r of rawRows) {
    const demoId = String(r.ID || '').trim();
    const dateParsed = XLSX.SSF.parse_date_code(r.Sana);
    const transactionDate = `${dateParsed.y}-${pad(dateParsed.m)}-${pad(dateParsed.d)}`;
    const categoryName = String(r.Kategoriya || '').trim();
    const categoryId = catMap.get(categoryName) || null;
    const type = r.Turi === 'Kirim' ? 'income' : 'expense';
    const amount = Number(r.Summa_UZS);
    const description = String(r.Izoh || '').trim();
    const hisob = String(r.Hisob || '').trim();
    const extraNotes = String(r["Qo'shimcha_izoh"] || '').trim();

    const noteTag = `[${demoId}]`;
    const fullNotes = [noteTag, extraNotes, hisob ? `(${hisob})` : ''].filter(Boolean).join(' ');

    // Idempotency check:
    const alreadyExists = existingNotesSet.has(fullNotes) ||
      Array.from(existingNotesSet).some((n) => n.includes(noteTag));

    if (alreadyExists) {
      skippedCount++;
      continue;
    }

    if (isNaN(amount) || amount <= 0 || !description || !transactionDate) {
      console.warn(`Invalid row: ${demoId}`, r);
      failedCount++;
      continue;
    }

    rowsToInsert.push({
      user_id: userId,
      category_id: categoryId,
      description,
      amount,
      currency: 'UZS',
      type,
      transaction_date: transactionDate,
      merchant: hisob || null,
      notes: fullNotes,
      source: 'excel',
    });
  }

  if (rowsToInsert.length > 0) {
    console.log(`Inserting ${rowsToInsert.length} new transactions in batches...`);
    const chunkSize = 50;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { data: inserted, error: insertErr } = await adminClient
        .from('transactions')
        .insert(chunk)
        .select('id');
      if (insertErr) {
        console.error(`Batch insert error at ${i}:`, insertErr);
        failedCount += chunk.length;
      } else {
        insertedCount += inserted.length;
      }
    }
  }

  console.log(`Import status: Inserted: ${insertedCount}, Skipped (duplicate): ${skippedCount}, Failed: ${failedCount}`);

  // 6. Seed Realistic Budgets in UZS for August & September
  const { data: existingBudgets } = await adminClient.from('budgets').select('id').eq('user_id', userId);
  if (!existingBudgets || existingBudgets.length === 0) {
    console.log('Seeding demo budgets in UZS...');
    await adminClient.from('budgets').insert([
      {
        user_id: userId,
        name: 'Uy-joy ijarasi',
        category_id: catMap.get('Uy-joy'),
        amount: 1800000,
        currency: 'UZS',
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
      },
      {
        user_id: userId,
        name: 'Oziq-ovqat va bozorlik',
        category_id: catMap.get('Oziq-ovqat'),
        amount: 1800000,
        currency: 'UZS',
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
      },
      {
        user_id: userId,
        name: 'Kafe va ovqatlanish',
        category_id: catMap.get('Kafe va restoran'),
        amount: 1300000,
        currency: 'UZS',
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
      },
      {
        user_id: userId,
        name: 'Transport (Yandex Go)',
        category_id: catMap.get('Transport'),
        amount: 500000,
        currency: 'UZS',
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
      },
      {
        user_id: userId,
        name: 'Kommunal to‘lovlar',
        category_id: catMap.get('Kommunal'),
        amount: 300000,
        currency: 'UZS',
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
      },
    ]);
  }

  // 7. Seed Realistic Financial Goals in UZS
  const { data: existingGoals } = await adminClient.from('financial_goals').select('id').eq('user_id', userId);
  if (!existingGoals || existingGoals.length === 0) {
    console.log('Seeding demo financial goals in UZS...');
    await adminClient.from('financial_goals').insert([
      {
        user_id: userId,
        name: 'Yangi ishchi noutbuk (M4 MacBook Pro)',
        target_amount: 25000000,
        current_amount: 18000000,
        currency: 'UZS',
        target_date: '2026-12-31',
        status: 'in_progress',
      },
      {
        user_id: userId,
        name: 'Sayohat va ta‘til jamg‘armasi',
        target_amount: 15000000,
        current_amount: 8500000,
        currency: 'UZS',
        target_date: '2027-05-01',
        status: 'in_progress',
      },
      {
        user_id: userId,
        name: 'Favqulodda zaxira jamg‘armasi (Emergency Fund)',
        target_amount: 30000000,
        current_amount: 22000000,
        currency: 'UZS',
        target_date: '2027-08-01',
        status: 'in_progress',
      },
    ]);
  }

  // 8. Verification Queries
  console.log('====================================================');
  console.log(' Reconciling Database Records against Excel Sheet');
  console.log('====================================================');
  const { data: allUserTxs } = await adminClient
    .from('transactions')
    .select('id, transaction_date, amount, type, currency, category_id, categories(name)')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: true });

  const dates = allUserTxs.map((t) => t.transaction_date).sort();
  const earliestDate = dates[0];
  const latestDate = dates[dates.length - 1];

  const augTxs = allUserTxs.filter((t) => t.transaction_date.startsWith('2026-08'));
  const sepTxs = allUserTxs.filter((t) => t.transaction_date.startsWith('2026-09'));

  const augIncome = augTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const augExpense = augTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const sepIncome = sepTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const sepExpense = sepTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  console.log(`Total user transactions in DB: ${allUserTxs.length}`);
  console.log(`Earliest Date: ${earliestDate}`);
  console.log(`Latest Date: ${latestDate}`);
  console.log(`August 2026: ${augTxs.length} txs | Income: ${augIncome.toLocaleString()} UZS | Expense: ${augExpense.toLocaleString()} UZS | Net: ${(augIncome - augExpense).toLocaleString()} UZS`);
  console.log(`September 2026: ${sepTxs.length} txs | Income: ${sepIncome.toLocaleString()} UZS | Expense: ${sepExpense.toLocaleString()} UZS | Net: ${(sepIncome - sepExpense).toLocaleString()} UZS`);

  return {
    userId,
    totalRecords: allUserTxs.length,
    insertedCount,
    skippedCount,
    failedCount,
    earliestDate,
    latestDate,
    august: { count: augTxs.length, income: augIncome, expense: augExpense, net: augIncome - augExpense },
    september: { count: sepTxs.length, income: sepIncome, expense: sepExpense, net: sepIncome - sepExpense },
  };
}

if (process.argv[1]?.endsWith('seed_excel_demo_transactions.mjs')) {
  const clean = process.argv.includes('--clean');
  const emailIdx = process.argv.indexOf('--email');
  const targetEmail = emailIdx !== -1 && process.argv[emailIdx + 1] ? process.argv[emailIdx + 1] : DEMO_EMAIL;
  runSeed({ targetEmail, cleanFirst: clean })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    });
}
