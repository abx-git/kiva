-- Kiva Storage only (if upload says "Bucket not found")
-- Run in Supabase → SQL → New query (after auth works, tables optional but artifacts table needed for DB row)

insert into storage.buckets (id, name, public)
values
  ('instructions', 'instructions', false),
  ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

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
