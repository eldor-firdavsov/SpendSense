import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// 1. Resolve environment and keys
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

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 2. Resolve target user
async function resolveTargetUser(emailArg) {
  let targetEmail = emailArg;

  if (!targetEmail) {
    // If not passed as CLI argument, check environment
    targetEmail = process.env.TARGET_USER_EMAIL;
  }

  if (!targetEmail) {
    // Look up human profile in profiles table
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .not('email', 'like', '%@spendsense.%')
      .not('email', 'like', '%test%')
      .order('created_at', { ascending: false });

    if (error || !profiles || profiles.length === 0) {
      console.error(
        'Xatolik: Autentifikatsiya qilingan foydalanuvchi aniqlanmadi. Iltimos, tizimga kiring yoki --email orqali ko\'rsating.'
      );
      process.exit(1);
    }

    targetEmail = profiles[0].email;
    console.log(`Faol foydalanuvchi profili aniqlandi: ${targetEmail} (${profiles[0].first_name || ''} ${profiles[0].last_name || ''})`);
  }

  const { data: userProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('email', targetEmail)
    .maybeSingle();

  if (profileErr || !userProfile) {
    console.error(`Xatolik: '${targetEmail}' foydalanuvchisi ma'lumotlar bazasida topilmadi. Avval ro'yxatdan o'ting yoki tizimga kiring.`);
    process.exit(1);
  }

  return userProfile;
}

// 3. Ensure required Uzbek categories exist for this user
async function ensureCategories(userId) {
  const requiredCategories = [
    { name: 'Oylik maosh', type: 'income', icon: 'Briefcase', color: '#16A34A', description: 'Asosiy oylik maosh va daromadlar' },
    { name: 'Ijara va uy', type: 'expense', icon: 'Home', color: '#4B75E8', description: 'Uy-joy ijarasi va ta\'mirlash' },
    { name: 'Oziq-ovqat', type: 'expense', icon: 'ShoppingCart', color: '#10B981', description: 'Supermarketlar va dehqon bozori xaridlari' },
    { name: 'Kafe va restoran', type: 'expense', icon: 'Utensils', color: '#F59E0B', description: 'Kafelar, restoranlar va tushliklar' },
    { name: 'Transport', type: 'expense', icon: 'Car', color: '#6366F1', description: 'Yandex Go taksi, jamoat transporti va yo\'l haqi' },
    { name: 'Ichimliklar', type: 'expense', icon: 'Coffee', color: '#EC4899', description: 'Qahva, choy, suv va salqin ichimliklar' },
    { name: 'Ko‘ngilochar xarajatlar', type: 'expense', icon: 'Film', color: '#8B5CF6', description: 'Kino, konsert, teatr va dam olish' },
    { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#14B8A6', description: 'Kiyim-kechak, elektronika va aksessuarlar' },
    { name: 'Do‘stlarga pul', type: 'expense', icon: 'Send', color: '#3B82F6', description: 'Do\'stlarga o\'tkazmalar, sovg\'alar va yordam' },
    { name: 'Kommunal va aloqa', type: 'expense', icon: 'Zap', color: '#EAB308', description: 'Elektr, gaz, suv, internet va mobil aloqa' },
    { name: 'Sog‘liq', type: 'expense', icon: 'HeartPulse', color: '#EF4444', description: 'Dorixona, tibbiy ko\'rik va vitaminlar' },
    { name: 'Obunalar', type: 'expense', icon: 'Layers', color: '#6366F1', description: 'Raqamli xizmatlar, musiqa va video platformalar obunalari' },
    { name: 'Boshqa', type: 'expense', icon: 'MoreHorizontal', color: '#6B7280', description: 'Boshqa maishiy va mayda xarajatlar' },
  ];

  const { data: existingCats } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', userId);

  const catMap = new Map();
  for (const c of existingCats || []) {
    catMap.set(`${c.name.toLowerCase().trim()}|${c.type}`, c.id);
  }

  for (const cat of requiredCategories) {
    const key = `${cat.name.toLowerCase().trim()}|${cat.type}`;
    if (!catMap.has(key)) {
      const { data: newCat, error: insertErr } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          description: cat.description,
          is_system: false,
        })
        .select('id')
        .single();

      if (!insertErr && newCat) {
        catMap.set(key, newCat.id);
      }
    }
  }

  return catMap;
}

// 4. Main execution
export async function runImport({ targetEmail, cleanPriorDemo = true } = {}) {
  const user = await resolveTargetUser(targetEmail);
  console.log(`\n======================================================`);
  console.log(`SpendSense AI — Sentabr va Oktabr 2026 Import Jarayoni`);
  console.log(`Foydalanuvchi: ${user.email} (ID: ${user.id})`);
  console.log(`======================================================`);

  // Step A: Parse CSV file
  const csvPath = '/home/eldor_firdavsov/Desktop/SpendSense/data/sentabr_oktabr_2026_tranzaksiyalar.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV fayl topilmadi: ${csvPath}`);
  }

  const fileLines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  const rows = fileLines.slice(1).map((line, index) => {
    const parts = line.split(',');
    return {
      index: index + 1,
      date: parts[0]?.trim(),
      type: parts[1]?.trim(),
      category: parts[2]?.trim(),
      desc: parts[3]?.trim(),
      amount: Number(parts[4]),
      currency: parts[5]?.trim() || 'UZS',
      notes: parts[6]?.trim() || '',
    };
  });

  console.log(`CSV fayldan ${rows.length} ta tranzaksiya o'qildi.`);

  // Step B: Programmatically verify mathematical sums before database entry
  const septTxs = rows.filter((r) => r.date.startsWith('2026-09'));
  const octTxs = rows.filter((r) => r.date.startsWith('2026-10'));

  const septIncome = septTxs.filter((r) => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const septExpense = septTxs.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const octIncome = octTxs.filter((r) => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const octExpense = octTxs.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);

  console.log('\n[Dasturiy hisob-kitob tekshiruvi]');
  console.log(`- Sentabr daromad: ${septIncome.toLocaleString('uz-UZ')} UZS (kutilgan: 6 000 000 UZS)`);
  console.log(`- Sentabr xarajat: ${septExpense.toLocaleString('uz-UZ')} UZS (kutilgan: ~5 000 000 UZS)`);
  console.log(`- Sentabr qoldiq: ${(septIncome - septExpense).toLocaleString('uz-UZ')} UZS (kutilgan: ~1 000 000 UZS)`);
  console.log(`- Oktabr daromad: ${octIncome.toLocaleString('uz-UZ')} UZS (kutilgan: 6 000 000 UZS)`);
  console.log(`- Oktabr xarajat: ${octExpense.toLocaleString('uz-UZ')} UZS (kutilgan: ~5 000 000 UZS)`);
  console.log(`- Oktabr qoldiq: ${(octIncome - octExpense).toLocaleString('uz-UZ')} UZS (kutilgan: ~1 000 000 UZS)`);

  if (septIncome !== 6000000 || octIncome !== 6000000) {
    throw new Error('Xatolik: Sentabr yoki Oktabr oylik daromadi 6 000 000 UZS ga teng emas!');
  }
  if (Math.abs(septExpense - 5000000) > 100000 || Math.abs(octExpense - 5000000) > 100000) {
    throw new Error('Xatolik: Xarajatlar belgilangan 5 000 000 UZS me\'yoridan chetga chiqdi!');
  }

  // Step C: Ensure categories exist
  console.log('\nKategoriyalarni tekshirish va sinxronlash...');
  const catMap = await ensureCategories(user.id);

  // Step D: Pre-check existing transactions in the target window (2026-09-01 to 2026-10-31)
  const { data: existingWindowTxs } = await supabase
    .from('transactions')
    .select('id, transaction_date, amount, description, type, source, notes')
    .eq('user_id', user.id)
    .gte('transaction_date', '2026-09-01')
    .lte('transaction_date', '2026-10-31');

  const priorDemoTxs = (existingWindowTxs || []).filter(
    (t) => t.notes?.startsWith('[DEMO-') || t.notes?.startsWith('[SEP-OCT-') || t.source === 'excel'
  );
  const realUserTxs = (existingWindowTxs || []).filter(
    (t) => !t.notes?.startsWith('[DEMO-') && !t.notes?.startsWith('[SEP-OCT-') && t.source === 'manual'
  );

  console.log(`Mavjud tranzaksiyalar tekshirildi:`);
  console.log(`- Real foydalanuvchi qo'lda kiritgan tranzaksiyalari: ${realUserTxs.length} ta (bularga tegilmaydi)`);
  console.log(`- Eski demo tranzaksiyalar: ${priorDemoTxs.length} ta`);

  if (cleanPriorDemo && priorDemoTxs.length > 0) {
    console.log(`Eski demo yozuvlar xavfsiz tozalanmoqda (${priorDemoTxs.length} ta)...`);
    const demoIds = priorDemoTxs.map((t) => t.id);
    for (let i = 0; i < demoIds.length; i += 100) {
      const chunk = demoIds.slice(i, i + 100);
      await supabase.from('transactions').delete().in('id', chunk);
    }
  }

  // Step E: Deduplication check against remaining transactions
  const { data: remainingTxs } = await supabase
    .from('transactions')
    .select('transaction_date, amount, description, type')
    .eq('user_id', user.id)
    .gte('transaction_date', '2026-09-01')
    .lte('transaction_date', '2026-10-31');

  const existingSet = new Set(
    (remainingTxs || []).map(
      (t) => `${t.transaction_date}|${Number(t.amount).toFixed(2)}|${t.description.toLowerCase().trim()}|${t.type}`
    )
  );

  const toInsert = [];
  let skippedDuplicates = 0;

  for (const r of rows) {
    const key = `${r.date}|${Number(r.amount).toFixed(2)}|${r.desc.toLowerCase().trim()}|${r.type}`;
    if (existingSet.has(key)) {
      skippedDuplicates++;
      continue;
    }

    const catKey = `${r.category.toLowerCase().trim()}|${r.type}`;
    const catId = catMap.get(catKey) || null;

    toInsert.push({
      user_id: user.id,
      category_id: catId,
      description: r.desc,
      amount: r.amount,
      currency: 'UZS',
      type: r.type,
      transaction_date: r.date,
      source: 'csv',
      notes: r.notes,
    });
  }

  console.log(`\nTakroriylik (Deduplication) natijasi:`);
  console.log(`- Kiritiladigan yangi yozuvlar: ${toInsert.length} ta`);
  console.log(`- O'tkazib yuborilgan takroriy yozuvlar: ${skippedDuplicates} ta`);

  // Step F: Create Import Job record
  const { data: importJob } = await supabase
    .from('import_jobs')
    .insert({
      user_id: user.id,
      filename: 'sentabr_oktabr_2026_tranzaksiyalar.csv',
      status: 'processing',
      total_rows: rows.length,
    })
    .select('id')
    .single();

  const jobId = importJob?.id;

  // Step G: Batch insert transactions
  if (toInsert.length > 0) {
    const payload = toInsert.map((t) => ({ ...t, import_job_id: jobId }));
    for (let i = 0; i < payload.length; i += 50) {
      const chunk = payload.slice(i, i + 50);
      const { error: insErr } = await supabase.from('transactions').insert(chunk);
      if (insErr) {
        throw new Error(`Tranzaksiyalarni kiritishda xatolik: ${insErr.message}`);
      }
    }
  }

  // Update import job to completed
  if (jobId) {
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        imported_rows: toInsert.length,
        failed_rows: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  // Step H: Final verification directly from database
  const { data: finalTxs } = await supabase
    .from('transactions')
    .select('transaction_date, amount, type, description, categories(name)')
    .eq('user_id', user.id)
    .gte('transaction_date', '2026-09-01')
    .lte('transaction_date', '2026-10-31')
    .order('transaction_date', { ascending: true });

  const sepFinal = { income: 0, expense: 0, count: 0, cats: {} };
  const octFinal = { income: 0, expense: 0, count: 0, cats: {} };

  for (const t of finalTxs || []) {
    const m = t.transaction_date.slice(0, 7);
    const amt = Number(t.amount);
    const cat = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name || 'Boshqa';
    const target = m === '2026-09' ? sepFinal : octFinal;

    target.count++;
    if (t.type === 'income') {
      target.income += amt;
    } else {
      target.expense += amt;
      target.cats[cat] = (target.cats[cat] || 0) + amt;
    }
  }

  console.log('\n======================================================');
  console.log('YAKUNIY BAZA HOLATI VA TEKSHIRUV');
  console.log('======================================================');
  console.log(`Sentabr 2026:`);
  console.log(`  * Jami daromad: ${sepFinal.income.toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Jami xarajat: ${sepFinal.expense.toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Qoldiq (Sof pul oqimi): ${(sepFinal.income - sepFinal.expense).toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Tranzaksiyalar soni: ${sepFinal.count} ta`);

  console.log(`\nOktabr 2026:`);
  console.log(`  * Jami daromad: ${octFinal.income.toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Jami xarajat: ${octFinal.expense.toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Qoldiq (Sof pul oqimi): ${(octFinal.income - octFinal.expense).toLocaleString('uz-UZ')} UZS`);
  console.log(`  * Tranzaksiyalar soni: ${octFinal.count} ta`);

  return {
    user,
    sepFinal,
    octFinal,
    totalImported: toInsert.length,
    skippedDuplicates,
    jobId,
  };
}

// Allow CLI execution: node scripts/import_sep_oct_transactions.mjs [--email <user_email>]
if (process.argv[1]?.endsWith('import_sep_oct_transactions.mjs')) {
  const emailIdx = process.argv.indexOf('--email');
  const targetEmail = emailIdx !== -1 ? process.argv[emailIdx + 1] : undefined;

  runImport({ targetEmail })
    .then(() => {
      console.log('\nSentabr va Oktabr tranzaksiyalari muvaffaqiyatli import qilindi!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nImport jarayonida xatolik yuz berdi:', err);
      process.exit(1);
    });
}
