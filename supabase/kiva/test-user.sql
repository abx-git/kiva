-- Test user for Kiva (run in Supabase SQL Editor AFTER setup.sql)
--
-- Prefer: Dashboard → Authentication → Users → Add user (email + password, auto-confirm).
-- Use this file only if you need SQL. Wrong NULLs in auth.users cause login error:
-- "Database error querying schema"

-- ---------------------------------------------------------------------------
-- Fix existing manually created users (run once if login fails with that error)
-- ---------------------------------------------------------------------------

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where
  confirmation_token is null
  or recovery_token is null
  or email_change is null
  or email_change_token_new is null
  or email_change_token_current is null
  or reauthentication_token is null;

-- ---------------------------------------------------------------------------
-- Create test user (change email/password below)
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'test@example.com';
  v_password text := 'Test1234!';
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'User % already exists — run the UPDATE block above if login fails.', v_email;
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    reauthentication_token
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Test User"}'::jsonb,
    false,
    '',
    '',
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, display_name)
  values (v_user_id, 'Test User')
  on conflict (id) do update set display_name = excluded.display_name;
end $$;
