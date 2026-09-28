-- Run once if artifacts already exist without delete / team download policies

drop policy if exists "artifacts_delete_own" on public.artifacts;
create policy "artifacts_delete_own"
  on public.artifacts for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "kiva_artifacts_delete_own" on storage.objects;
create policy "kiva_artifacts_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kiva_artifacts_read_community" on storage.objects;
create policy "kiva_artifacts_read_community"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'artifacts'
    and exists (
      select 1
      from public.artifacts a
      where a.storage_path = name
        and a.visibility = 'community'
    )
  );
