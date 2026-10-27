import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !anonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be in .env.local');
  process.exit(1);
}

// Retrieve service_role key cleanly from CLI
let serviceKey = null;
try {
  const keys = JSON.parse(
    execSync(
      '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
    ).toString()
  );
  serviceKey = keys.find(k => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role'))?.api_key;
} catch {
  console.warn('Could not retrieve service key via CLI, falling back to anon key.');
}

const adminClient = serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const DEMO_EMAIL = 'demo@spendsense.io';
const DEMO_PASSWORD = 'Password123!Demo';
const DEMO_FIRST_NAME = 'Alex';
const DEMO_LAST_NAME = 'Taylor';

async function seedDemoAccount() {
  console.log('--- Seeding SpendSense AI Demo Account ---');

  // 1. Resolve demo user ID
  let userId = null;
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  if (!authErr && authData?.user) {
    userId = authData.user.id;
    console.log(`Authenticated demo user: ${DEMO_EMAIL} (ID: ${userId})`);
  } else {
    // Attempt signUp if not yet registered
    const { data: upData, error: upErr } = await adminClient.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: { data: { first_name: DEMO_FIRST_NAME, last_name: DEMO_LAST_NAME } }
    });
    if (upErr) throw upErr;
    userId = upData.user.id;
    console.log(`Created demo user ID: ${userId}`);
  }

  // Ensure profile is updated
  await adminClient.from('profiles').upsert({
    id: userId,
    email: DEMO_EMAIL,
    first_name: DEMO_FIRST_NAME,
    last_name: DEMO_LAST_NAME,
    updated_at: new Date().toISOString()
  });

  // 2. Clear previous demo data for this user
  console.log('Cleaning existing user demo records...');
  await adminClient.from('ai_messages').delete().eq('user_id', userId);
  await adminClient.from('ai_conversations').delete().eq('user_id', userId);
  await adminClient.from('financial_goals').delete().eq('user_id', userId);
  await adminClient.from('budgets').delete().eq('user_id', userId);
  await adminClient.from('transactions').delete().eq('user_id', userId);
  await adminClient.from('categories').delete().eq('user_id', userId);

  // 3. Fetch system categories
  const { data: sysCats, error: sysErr } = await adminClient
    .from('categories')
    .select('id, name, type')
    .eq('is_system', true);
  if (sysErr) throw sysErr;

  const catMap = {};
  sysCats.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

  // 4. Create custom categories for Demo User
  console.log('Creating custom categories...');
  const { data: customCats, error: custErr } = await adminClient
    .from('categories')
    .insert([
      {
        user_id: userId,
        name: 'AI SaaS & Dev Tools',
        type: 'expense',
        color: '#8b5cf6',
        icon: 'Cpu',
        is_system: false
      },
      {
        user_id: userId,
        name: 'Tech Consulting',
        type: 'income',
        color: '#3b82f6',
        icon: 'Briefcase',
        is_system: false
      },
      {
        user_id: userId,
        name: 'Artisan Coffee & Cafes',
        type: 'expense',
        color: '#f59e0b',
        icon: 'Coffee',
        is_system: false
      }
    ])
    .select();
  if (custErr) throw custErr;

  customCats.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

  // 5. Seed compelling October 2026 transactions
  console.log('Seeding transactions...');
  const transactionsToInsert = [
    // Income
    {
      user_id: userId,
      description: 'Senior Software Engineer Salary',
      amount: 6500.00,
      currency: 'USD',
      type: 'income',
      category_id: catMap['salary'],
      merchant: 'Acme Technologies Inc.',
      transaction_date: '2026-10-01'
    },
    {
      user_id: userId,
      description: 'Cloud Migration & Next.js Architecture Advisory',
      amount: 1250.00,
      currency: 'USD',
      type: 'income',
      category_id: catMap['tech consulting'],
      merchant: 'VentureScale Labs',
      transaction_date: '2026-10-15'
    },
    // Expenses
    {
      user_id: userId,
      description: 'Downtown Studio Apartment Rent',
      amount: 1850.00,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['housing / rent'],
      merchant: 'Metropolitan Real Estate',
      transaction_date: '2026-10-02'
    },
    {
      user_id: userId,
      description: 'Whole Foods Market — Weekly Groceries',
      amount: 182.40,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['groceries'],
      merchant: 'Whole Foods Market',
      transaction_date: '2026-10-04'
    },
    {
      user_id: userId,
      description: 'AWS Cloud Hosting & Gemini AI API Usage',
      amount: 85.00,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['ai saas & dev tools'],
      merchant: 'Amazon Web Services',
      transaction_date: '2026-10-08'
    },
    {
      user_id: userId,
      description: 'Gigabit Fiber Internet & Electric Utilities',
      amount: 145.50,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['utilities'],
      merchant: 'City Power & Fiber Co.',
      transaction_date: '2026-10-10'
    },
    {
      user_id: userId,
      description: 'Omakase Sushi & Dinner with Engineering Team',
      amount: 115.80,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['dining out'],
      merchant: 'Sushi Zen Bistro',
      transaction_date: '2026-10-12'
    },
    {
      user_id: userId,
      description: 'Metro Unlimited Monthly Transit Pass',
      amount: 65.00,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['transportation'],
      merchant: 'Metropolitan Transit Authority',
      transaction_date: '2026-10-14'
    },
    {
      user_id: userId,
      description: 'Single-Origin Ethiopian Beans & Pour Over',
      amount: 38.25,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['artisan coffee & cafes'],
      merchant: 'Blue Bottle Roasters',
      transaction_date: '2026-10-17'
    },
    {
      user_id: userId,
      description: 'Equinox Gym & Wellness Center Membership',
      amount: 90.00,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['healthcare'],
      merchant: 'Equinox Sports Club',
      transaction_date: '2026-10-19'
    },
    {
      user_id: userId,
      description: 'Sony WH-1000XM5 Noise Cancelling Headphones',
      amount: 248.00,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['shopping'],
      merchant: 'Best Buy Electronics',
      transaction_date: '2026-10-21'
    },
    {
      user_id: userId,
      description: 'Trader Joe\'s — Mid-Month Pantry Restock',
      amount: 135.60,
      currency: 'USD',
      type: 'expense',
      category_id: catMap['groceries'],
      merchant: 'Trader Joe\'s',
      transaction_date: '2026-10-22'
    }
  ];

  const { error: txErr } = await adminClient.from('transactions').insert(transactionsToInsert);
  if (txErr) throw txErr;

  // 6. Seed Budgets
  console.log('Seeding budgets...');
  const { error: budErr } = await adminClient.from('budgets').insert([
    {
      user_id: userId,
      name: 'Monthly Housing & Rent',
      category_id: catMap['housing / rent'],
      amount: 2000.00,
      currency: 'USD',
      period_type: 'monthly',
      start_date: '2026-10-01',
      end_date: '2026-10-31'
    },
    {
      user_id: userId,
      name: 'Groceries Budget',
      category_id: catMap['groceries'],
      amount: 500.00,
      currency: 'USD',
      period_type: 'monthly',
      start_date: '2026-10-01',
      end_date: '2026-10-31'
    },
    {
      user_id: userId,
      name: 'Utilities & Connectivity',
      category_id: catMap['utilities'],
      amount: 250.00,
      currency: 'USD',
      period_type: 'monthly',
      start_date: '2026-10-01',
      end_date: '2026-10-31'
    },
    {
      user_id: userId,
      name: 'Shopping & Electronics',
      category_id: catMap['shopping'],
      amount: 400.00,
      currency: 'USD',
      period_type: 'monthly',
      start_date: '2026-10-01',
      end_date: '2026-10-31'
    }
  ]);
  if (budErr) throw budErr;

  // 7. Seed Financial Goals
  console.log('Seeding financial goals...');
  const { error: goalErr } = await adminClient.from('financial_goals').insert([
    {
      user_id: userId,
      name: '6-Month Emergency Fund Reserve',
      target_amount: 25000.00,
      current_amount: 17500.00,
      currency: 'USD',
      target_date: '2027-06-30',
      status: 'in_progress'
    },
    {
      user_id: userId,
      name: 'Spring Vacation to Tokyo & Kyoto',
      target_amount: 5500.00,
      current_amount: 3850.00,
      currency: 'USD',
      target_date: '2027-04-15',
      status: 'in_progress'
    },
    {
      user_id: userId,
      name: 'M4 Max MacBook Pro Workstation',
      target_amount: 3200.00,
      current_amount: 2560.00,
      currency: 'USD',
      target_date: '2026-12-31',
      status: 'in_progress'
    }
  ]);
  if (goalErr) throw goalErr;

  // 8. Seed Sample AI Conversation
  console.log('Seeding AI Advisor conversation...');
  const { data: conv, error: convErr } = await adminClient
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title: 'Monthly Cash Flow & Savings Rate Analysis'
    })
    .select()
    .single();

  if (!convErr && conv) {
    await adminClient.from('ai_messages').insert([
      {
        conversation_id: conv.id,
        user_id: userId,
        role: 'user',
        content: 'What was my highest expense this month and what is my overall savings rate?'
      },
      {
        conversation_id: conv.id,
        user_id: userId,
        role: 'assistant',
        content: 'Based on your verified financial records for October 2026:\n\n• **Highest Expense**: Your Downtown Studio Apartment Rent of **$1,850.00** on October 2nd.\n• **Income & Outflow**: Total income is **$7,750.00** (Salary: $6,500.00 + Consulting: $1,250.00) against total expenses of **$2,955.55**.\n• **Net Cash Flow**: **+$4,794.45** surplus.\n• **Savings Rate**: **61.86%**, which comfortably exceeds the recommended 20% benchmark and puts you well on track for your $25,000 Emergency Reserve goal.',
        evidence_references: {
          grounded_facts: {
            totalIncome: 7750.0,
            totalExpense: 2955.55,
            highestExpense: 1850.0,
            savingsRate: 61.86
          }
        }
      }
    ]);
  }

  console.log('✅ Demo account seeded successfully!');
  console.log(`Demo Account: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log('Metrics summary:');
  console.log('  - Income: $7,750.00 (2 transactions)');
  console.log('  - Expenses: $2,955.55 (10 transactions)');
  console.log('  - Net Cash Flow: +$4,794.45');
  console.log('  - Savings Rate: 61.86%');
  console.log('  - Budgets: 4 active categories');
  console.log('  - Goals: 3 active milestones');
}

seedDemoAccount().catch(err => {
  console.error('Failed to seed demo account:', err);
  process.exit(1);
});
