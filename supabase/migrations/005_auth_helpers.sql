-- ═══════════════════════════════════════════════════════════
-- 005 AUTH TRIGGERS & RPC HELPERS
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Automatically confirm email and set empty string tokens for all new users so GoTrue never fails schema scan
CREATE OR REPLACE FUNCTION public.auto_confirm_users()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  NEW.confirmation_token = COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token = COALESCE(NEW.recovery_token, '');
  NEW.email_change = COALESCE(NEW.email_change, '');
  NEW.email_change_token_new = COALESCE(NEW.email_change_token_new, '');
  NEW.email_change_token_current = COALESCE(NEW.email_change_token_current, '');
  NEW.phone_change = COALESCE(NEW.phone_change, '');
  NEW.phone_change_token = COALESCE(NEW.phone_change_token, '');
  NEW.reauthentication_token = COALESCE(NEW.reauthentication_token, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
CREATE TRIGGER on_auth_user_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_users();
-- Trigger to automatically create profile and identity when user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role public.user_role;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- 1. Ensure auth.identities entry exists for GoTrue
  BEGIN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.id,
      jsonb_build_object('sub', NEW.id::text, 'email', lower(NEW.email)),
      'email',
      NEW.id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Determine role safely
  IF lower(COALESCE(NEW.raw_user_meta_data->>'role', '')) = 'student' THEN
    v_role := 'student'::public.user_role;
  ELSE
    v_role := 'teacher'::public.user_role;
  END IF;

  -- 3. Determine names safely
  v_first_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(split_part(COALESCE(NEW.email, 'User'), '@', 1), ''),
    'User'
  );
  v_last_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), ''),
    ''
  );

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    role,
    is_active
  ) VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    NEW.email,
    v_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user exception: %', SQLERRM;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- RPC function to securely create student accounts from teacher session
CREATE OR REPLACE FUNCTION public.create_student_by_teacher(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_teacher_id UUID;
  v_teacher_role user_role;
  v_new_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_teacher_role FROM public.profiles WHERE id = v_teacher_id;
  IF v_teacher_role IS NULL OR v_teacher_role != 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can create students';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', trim(p_first_name), 'last_name', trim(p_last_name), 'role', 'student'),
    now(),
    now(),
    '',
    '',
    '',
    '',
    ''
  );

  BEGIN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_new_user_id,
      v_new_user_id,
      jsonb_build_object('sub', v_new_user_id::text, 'email', lower(trim(p_email))),
      'email',
      v_new_user_id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    role,
    teacher_id,
    is_active
  ) VALUES (
    v_new_user_id,
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    'student',
    v_teacher_id,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    teacher_id = EXCLUDED.teacher_id,
    role = 'student',
    is_active = true;

  RETURN jsonb_build_object(
    'id', v_new_user_id,
    'first_name', trim(p_first_name),
    'last_name', trim(p_last_name),
    'email', lower(trim(p_email)),
    'role', 'student'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_student_by_teacher(TEXT, TEXT, TEXT, TEXT) TO authenticated;
