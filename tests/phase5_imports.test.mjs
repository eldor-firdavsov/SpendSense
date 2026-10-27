import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import {
  previewImport,
  commitImport,
  listImportJobs,
  getImportJob,
} from '../src/lib/imports/service.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase 5 — CSV/XLSX Import Backend Tests', () => {
  let adminClient;
  let clientA;
  let clientB;
  let userAId;
  let userBId;

  const userAData = {
    email: `phase5_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Ian',
    lastName: 'Importer',
  };

  const userBData = {
    email: `phase5_user_b_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Julia',
    lastName: 'Importer',
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
  });

  after(async () => {
    if (adminClient) {
      if (userAId) {
        await adminClient.from('transactions').delete().eq('user_id', userAId);
        await adminClient.from('import_jobs').delete().eq('user_id', userAId);
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.from('transactions').delete().eq('user_id', userBId);
        await adminClient.from('import_jobs').delete().eq('user_id', userBId);
        await adminClient.auth.admin.deleteUser(userBId);
      }
    }
  });

  test('5.1 Preview CSV buffer: parses rows and sanitizes formula injection', async () => {
    const csvContent = [
      'Date,Description,Amount,Type,Merchant',
      '2026-10-01,Groceries,45.20,expense,Trader Joe',
      '2026-10-02,=cmd|/c calc!A0,120.00,expense,Shady Store', // Formula injection attempt
      '2026-10-03,Consulting Fee,1500.00,income,Client Acme',
    ].join('\n');

    const buffer = Buffer.from(csvContent, 'utf8');
    const res = await previewImport(buffer, 'bank_october.csv', undefined, clientA);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, null);
    assert.ok(res.data);
    assert.strictEqual(res.data.totalRows, 3);
    assert.strictEqual(res.data.validRows, 3);
    assert.strictEqual(res.data.invalidRows, 0);

    // Formula injection check: cell starting with '=' must be sanitized with leading quote
    const injectedRow = res.data.rows.find((r) => r.rowIndex === 2);
    assert.ok(injectedRow?.parsed);
    assert.strictEqual(injectedRow.parsed.description.startsWith("'="), true);
  });

  test('5.2 Preview XLSX buffer: parses Excel workbook and handles row-level validation errors', async () => {
    const worksheetData = [
      ['Date', 'Description', 'Amount', 'Type'],
      ['2026-10-05', 'Office Supplies', 89.99, 'expense'],
      ['bad-date', 'Missing Valid Date', 15.00, 'expense'], // Invalid date
      ['2026-10-06', '', 50.00, 'expense'], // Missing description
      ['2026-10-07', 'Zero Amount', 0.00, 'expense'], // Invalid amount
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const res = await previewImport(buffer, 'statement.xlsx', undefined, clientA);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    assert.strictEqual(res.data.totalRows, 4);
    assert.strictEqual(res.data.validRows, 1);
    assert.strictEqual(res.data.invalidRows, 3);

    const row2 = res.data.rows.find((r) => r.rowIndex === 2);
    assert.strictEqual(row2.isValid, false);
    assert.ok(row2.errors.some((e) => e.includes('date')));

    const row3 = res.data.rows.find((r) => r.rowIndex === 3);
    assert.strictEqual(row3.isValid, false);
    assert.ok(row3.errors.some((e) => e.includes('Description')));

    const row4 = res.data.rows.find((r) => r.rowIndex === 4);
    assert.strictEqual(row4.isValid, false);
    assert.ok(row4.errors.some((e) => e.includes('amount')));
  });

  let createdJobId;

  test('5.3 Commit import creates import_jobs record and persists transactions', async () => {
    const commitPayload = {
      filename: 'payroll_october.csv',
      duplicateStrategy: 'skip',
      rows: [
        {
          transaction_date: '2026-10-10',
          description: 'Payroll Direct Deposit',
          amount: 5200.0,
          currency: 'USD',
          type: 'income',
        },
        {
          transaction_date: '2026-10-11',
          description: 'Apartment Rent',
          amount: 1800.0,
          currency: 'USD',
          type: 'expense',
        },
      ],
    };

    const res = await commitImport(commitPayload, clientA);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.error, null);
    assert.ok(res.data?.jobId);
    assert.strictEqual(res.data.status, 'completed');
    assert.strictEqual(res.data.importedRows, 2);
    assert.strictEqual(res.data.skippedRows, 0);
    assert.strictEqual(res.data.failedRows, 0);
    createdJobId = res.data.jobId;

    // Verify transactions in DB have import_job_id and source='csv'
    const { data: txs, error: txErr } = await clientA
      .from('transactions')
      .select('*')
      .eq('import_job_id', createdJobId);
    assert.ifError(txErr);
    assert.strictEqual(txs.length, 2);
    assert.strictEqual(txs[0].source, 'csv');
    assert.strictEqual(txs[0].user_id, userAId);
  });

  test('5.4 Duplicate detection flags existing transactions and duplicateStrategy=skip skips them', async () => {
    // 1. Preview file containing identical transaction to previously committed rent
    const csvContent = [
      'Date,Description,Amount,Type',
      '2026-10-11,Apartment Rent,1800.00,expense', // Duplicate of previous
      '2026-10-12,Electricity Bill,110.50,expense', // Brand new
    ].join('\n');

    const buffer = Buffer.from(csvContent, 'utf8');
    const previewRes = await previewImport(buffer, 'october_bills.csv', undefined, clientA);
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.data.duplicateRows, 1);
    assert.strictEqual(previewRes.data.rows[0].isDuplicate, true);
    assert.strictEqual(previewRes.data.rows[1].isDuplicate, false);

    // 2. Commit with duplicateStrategy = 'skip'
    const commitRes = await commitImport(
      {
        filename: 'october_bills.csv',
        duplicateStrategy: 'skip',
        rows: [
          {
            transaction_date: '2026-10-11',
            description: 'Apartment Rent',
            amount: 1800.0,
            currency: 'USD',
            type: 'expense',
          },
          {
            transaction_date: '2026-10-12',
            description: 'Electricity Bill',
            amount: 110.5,
            currency: 'USD',
            type: 'expense',
          },
        ],
      },
      clientA
    );

    assert.strictEqual(commitRes.status, 201);
    assert.strictEqual(commitRes.data.importedRows, 1); // Only the new one
    assert.strictEqual(commitRes.data.skippedRows, 1); // The duplicate is skipped
  });

  test('5.5 Import jobs listing and ownership isolation', async () => {
    const listA = await listImportJobs(clientA);
    assert.strictEqual(listA.status, 200);
    assert.ok(listA.data.length >= 2);
    assert.ok(listA.data.some((j) => j.id === createdJobId));

    // User B should NOT see User A's jobs
    const listB = await listImportJobs(clientB);
    assert.strictEqual(listB.status, 200);
    assert.strictEqual(listB.data.some((j) => j.id === createdJobId), false);

    // User B cannot fetch User A job directly by ID (HTTP 404)
    const getB = await getImportJob(createdJobId, clientB);
    assert.strictEqual(getB.status, 404);
  });
});
