-- Kiva — complete Supabase bootstrap (run once in SQL Editor)
-- Project: Dashboard → SQL → New query → paste this file → Run
--
-- Creates: tables (profiles, instructions, artifacts), RLS, Storage buckets + policies.
-- Login uses built-in auth.users — you still must add users under Authentication → Users.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create table if not exists public.instructions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  version text not null default '1.0.0',
  description text,
  storage_path text not null,
  published boolean not null default false,
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.instructions enable row level security;

drop policy if exists "instructions_select_published" on public.instructions;
create policy "instructions_select_published"
  on public.instructions for select
  to authenticated
  using (published = true);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  instruction_id uuid not null references public.instructions (id) on delete restrict,
  owner_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  sha256 text not null,
  storage_path text,
  visibility text not null default 'private' check (visibility in ('private', 'community')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.artifacts enable row level security;

drop policy if exists "artifacts_select_own_or_community" on public.artifacts;
create policy "artifacts_select_own_or_community"
  on public.artifacts for select
  to authenticated
  using (owner_id = auth.uid() or visibility = 'community');

drop policy if exists "artifacts_insert_own" on public.artifacts;
create policy "artifacts_insert_own"
  on public.artifacts for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "artifacts_update_own" on public.artifacts;
create policy "artifacts_update_own"
  on public.artifacts for update
  to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('instructions', 'instructions', false),
  ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------

drop policy if exists "kiva_instructions_read" on storage.objects;
create policy "kiva_instructions_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'instructions');

drop policy if exists "kiva_artifacts_read_own" on storage.objects;
create policy "kiva_artifacts_read_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kiva_artifacts_insert_own" on storage.objects;
create policy "kiva_artifacts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kiva_artifacts_update_own" on storage.objects;
create policy "kiva_artifacts_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Optional demo row (catalog stays empty until you upload a file to Storage)
-- ---------------------------------------------------------------------------

insert into public.instructions (slug, title, version, description, storage_path, published)
values (
  'willkommen',
  'Welcome to Kiva',
  '1.0.0',
  'Upload a PDF to Storage bucket instructions at onboarding/willkommen.pdf, then refresh in the app.',
  'onboarding/willkommen.pdf',
  true
)
on conflict (slug) do nothing;
