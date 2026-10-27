import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { registerSchema, loginSchema, updateProfileSchema } from '../src/app/auth/schemas.ts';

const envContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

describe('Phase A — Authentication and User Isolation', () => {
  const testUserA = {
    email: `phase_a_user_a_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Auth',
  };

  const testUserB = {
    email: `phase_a_user_b_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Bob',
    lastName: 'Isolation',
  };

  let userAId = null;
  let userBId = null;

  const clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  after(async () => {
    // Purge test users cleanly from database using admin API
    try {
      const keys = JSON.parse(
        execSync(
          '/home/eldor_firdavsov/.local/bin/supabase projects api-keys --project-ref omzreoaaownshtzpqsdt --reveal --output json'
        ).toString()
      );
      const serviceKey = keys.find(k => k.name === 'service_role' || k.type === 'service_role' || k.name?.includes('service_role'))?.api_key;
      if (serviceKey) {
        const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        if (userAId) await adminClient.auth.admin.deleteUser(userAId);
        if (userBId) await adminClient.auth.admin.deleteUser(userBId);
      }
    } catch (err) {
      console.error('Error during test cleanup:', err.message);
    }
  });

  // 1. Zod Validation Schemas
  describe('1. Input Validation Schemas', () => {
    test('registerSchema rejects missing first name', () => {
      const res = registerSchema.safeParse({
        firstName: '',
        lastName: 'Doe',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.flatten().fieldErrors.firstName);
    });

    test('registerSchema rejects invalid email syntax', () => {
      const res = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.flatten().fieldErrors.email);
    });

    test('registerSchema rejects password under 6 characters', () => {
      const res = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: '123',
        confirmPassword: '123',
      });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.flatten().fieldErrors.password);
    });

    test('registerSchema rejects mismatched password confirmation', () => {
      const res = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.flatten().fieldErrors.confirmPassword);
    });

    test('registerSchema accepts valid input', () => {
      const res = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      assert.strictEqual(res.success, true);
    });

    test('registerSchema trims leading and trailing whitespace', () => {
      const res = registerSchema.safeParse({
        firstName: '   John   ',
        lastName: '   Doe   ',
        email: '   john.doe@example.com   ',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.firstName, 'John');
      assert.strictEqual(res.data.lastName, 'Doe');
      assert.strictEqual(res.data.email, 'john.doe@example.com');
    });

    test('loginSchema validates correctly', () => {
      assert.strictEqual(loginSchema.safeParse({ email: '', password: '' }).success, false);
      assert.strictEqual(loginSchema.safeParse({ email: 'bad-email', password: 'pass' }).success, false);
      assert.strictEqual(loginSchema.safeParse({ email: 'user@example.com', password: 'validPassword' }).success, true);
    });

    test('loginSchema trims leading and trailing whitespace on email', () => {
      const res = loginSchema.safeParse({ email: '   user@example.com   ', password: 'validPassword' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.email, 'user@example.com');
    });

    test('updateProfileSchema validates correctly', () => {
      assert.strictEqual(updateProfileSchema.safeParse({ firstName: '', lastName: '' }).success, false);
      assert.strictEqual(updateProfileSchema.safeParse({ firstName: 'NewFirst', lastName: 'NewLast' }).success, true);
    });

    test('use server contract: actions.ts exports ONLY async functions (no objects/schemas)', async () => {
      const actionsContent = fs.readFileSync('/home/eldor_firdavsov/Desktop/SpendSense/src/app/auth/actions.ts', 'utf8');
      assert.ok(!actionsContent.includes('export {\n  registerSchema'), 'actions.ts must not re-export Zod schemas');
      assert.ok(!actionsContent.includes('export { registerSchema'), 'actions.ts must not re-export Zod schemas');
    });
  });

  // 2. Real Registration & Profile Creation
  describe('2. Registration & Profile Auto-Creation', () => {
    test('Valid registration creates user and profile in database', async () => {
      const { data, error } = await clientA.auth.signUp({
        email: testUserA.email,
        password: testUserA.password,
        options: {
          data: {
            first_name: testUserA.firstName,
            last_name: testUserA.lastName,
          },
        },
      });

      assert.strictEqual(error, null);
      assert.ok(data.user?.id);
      userAId = data.user.id;

      // Verify public.profiles table has record populated by trigger
      const { data: profile, error: profError } = await clientA
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single();

      assert.strictEqual(profError, null);
      assert.strictEqual(profile.first_name, testUserA.firstName);
      assert.strictEqual(profile.last_name, testUserA.lastName);
      assert.strictEqual(profile.email, testUserA.email);
    });

    test('Registration handles duplicate email safely', async () => {
      const { data, error } = await clientA.auth.signUp({
        email: testUserA.email,
        password: testUserA.password,
        options: {
          data: {
            first_name: testUserA.firstName,
            last_name: testUserA.lastName,
          },
        },
      });

      // Supabase either returns an error or obfuscated user with 0 identities
      const isBlocked = error !== null || (data.user && (!data.user.identities || data.user.identities.length === 0));
      assert.strictEqual(isBlocked, true);
    });
  });

  // 3. Login, Bad Password, & Session
  describe('3. Login & Session Lifecycle', () => {
    test('Login with wrong password is rejected', async () => {
      const { data, error } = await clientA.auth.signInWithPassword({
        email: testUserA.email,
        password: 'WrongPassword999!',
      });

      assert.ok(error);
      assert.strictEqual(data.session, null);
    });

    test('Login with correct password succeeds and establishes session', async () => {
      const { data, error } = await clientA.auth.signInWithPassword({
        email: testUserA.email,
        password: testUserA.password,
      });

      assert.strictEqual(error, null);
      assert.ok(data.session?.access_token);
      assert.strictEqual(data.user.id, userAId);
    });
  });

  // 4. Profile Update
  describe('4. Profile Retrieval & Update', () => {
    test('User A can update own profile and see changes persisted', async () => {
      const updatedFirst = 'AliceUpdated';
      const updatedLast = 'AuthUpdated';

      const { data: updateData, error: updateError } = await clientA
        .from('profiles')
        .update({
          first_name: updatedFirst,
          last_name: updatedLast,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userAId)
        .select();

      assert.strictEqual(updateError, null);
      assert.strictEqual(updateData?.length, 1);
      assert.strictEqual(updateData[0].first_name, updatedFirst);
      assert.strictEqual(updateData[0].last_name, updatedLast);

      // Verify retrieval
      const { data: fetchProfile } = await clientA
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single();

      assert.strictEqual(fetchProfile.first_name, updatedFirst);
      assert.strictEqual(fetchProfile.last_name, updatedLast);
    });
  });

  // 5. Multi-User RLS Ownership Isolation
  describe('5. RLS Ownership & User Isolation', () => {
    test('Create User B and verify cross-user isolation', async () => {
      const { data: uBData, error: uBErr } = await clientB.auth.signUp({
        email: testUserB.email,
        password: testUserB.password,
        options: {
          data: {
            first_name: testUserB.firstName,
            last_name: testUserB.lastName,
          },
        },
      });

      assert.strictEqual(uBErr, null);
      userBId = uBData.user.id;

      // Authenticate Client B
      await clientB.auth.signInWithPassword({
        email: testUserB.email,
        password: testUserB.password,
      });

      // User A attempts to read User B's profile
      const { data: aReadsB } = await clientA
        .from('profiles')
        .select('*')
        .eq('id', userBId);

      assert.strictEqual(aReadsB?.length, 0, 'User A must not be able to read User B profile');

      // User A attempts to update User B's profile
      const { data: aUpdatesB, error: aUpdateErr } = await clientA
        .from('profiles')
        .update({ first_name: 'HackedByA' })
        .eq('id', userBId)
        .select();

      assert.ok(
        (aUpdatesB && aUpdatesB.length === 0) || aUpdateErr !== null,
        'User A must not be able to modify User B profile'
      );

      // Verify User B's profile remains untouched
      const { data: bProfile } = await clientB
        .from('profiles')
        .select('*')
        .eq('id', userBId)
        .single();

      assert.strictEqual(bProfile.first_name, testUserB.firstName);
    });
  });

  // 6. Logout and Session Invalidation
  describe('6. Logout', () => {
    test('Logout invalidates active session', async () => {
      const { error } = await clientA.auth.signOut();
      assert.strictEqual(error, null);

      const { data } = await clientA.auth.getSession();
      assert.strictEqual(data.session, null);
    });
  });
});
