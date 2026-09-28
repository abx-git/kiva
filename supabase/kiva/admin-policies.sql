-- Admin support for instruction management (run once in SQL Editor)

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "instructions_select_admin" on public.instructions;
create policy "instructions_select_admin"
  on public.instructions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "instructions_insert_admin" on public.instructions;
create policy "instructions_insert_admin"
  on public.instructions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "instructions_update_admin" on public.instructions;
create policy "instructions_update_admin"
  on public.instructions for update
  to authenticated
  using (public.is_admin());

drop policy if exists "instructions_delete_admin" on public.instructions;
create policy "instructions_delete_admin"
  on public.instructions for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "kiva_instructions_insert_admin" on storage.objects;
create policy "kiva_instructions_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'instructions' and public.is_admin());

drop policy if exists "kiva_instructions_update_admin" on storage.objects;
create policy "kiva_instructions_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'instructions' and public.is_admin());

drop policy if exists "kiva_instructions_delete_admin" on storage.objects;
create policy "kiva_instructions_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'instructions' and public.is_admin());

-- Grant yourself admin (replace email):
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'you@example.com');
