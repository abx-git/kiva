-- Kiva — Referenzschema für Supabase (Postgres + RLS)
-- Im Supabase SQL Editor ausführen; Storage-Buckets manuell anlegen.

-- Profile (optional, erweiterbar)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Instruktionen (Metadaten; Dateien in Storage-Bucket "instructions")
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

create policy "instructions_select_published"
  on public.instructions for select
  to authenticated
  using (published = true);

-- Artefakte (Ergebnisse der Nutzer)
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

create policy "artifacts_select_own_or_community"
  on public.artifacts for select
  to authenticated
  using (owner_id = auth.uid() or visibility = 'community');

create policy "artifacts_insert_own"
  on public.artifacts for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "artifacts_update_own"
  on public.artifacts for update
  to authenticated
  using (owner_id = auth.uid());

-- Storage: Buckets "instructions" und "artifacts" in der Supabase UI erstellen.
-- Beispiel-Policies (Storage) separat im Dashboard konfigurieren:
-- - instructions: read für authenticated wenn instruction.published
-- - artifacts: read/write für owner_id im Pfad
