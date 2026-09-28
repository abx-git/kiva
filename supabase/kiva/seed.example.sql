-- Beispiel: eine veröffentlichte Instruktion (nach Upload einer Datei in Storage)
-- Datei z. B. unter Pfad: onboarding/willkommen.pdf

insert into public.instructions (slug, title, version, description, storage_path, published)
values (
  'willkommen',
  'Willkommen bei Kiva',
  '1.0.0',
  'Kurze Einführung in den Arbeitsablauf.',
  'onboarding/willkommen.pdf',
  true
)
on conflict (slug) do nothing;
