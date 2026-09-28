-- Example: one published instruction (after uploading a file to Storage)
-- e.g. path in bucket instructions: onboarding/welcome.pdf

insert into public.instructions (slug, title, version, description, storage_path, published)
values (
  'welcome',
  'Welcome to Kiva',
  '1.0.0',
  'Short introduction to the workflow.',
  'onboarding/welcome.pdf',
  true
)
on conflict (slug) do nothing;
