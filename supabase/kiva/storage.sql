-- Kiva Storage (Supabase Dashboard → Storage → New bucket)
-- Bucket-Namen: instructions (public: false), artifacts (public: false)

-- Beispiel-Policies für Bucket "instructions" (authenticated read):
-- create policy "instructions_read_authenticated"
-- on storage.objects for select to authenticated
-- using (bucket_id = 'instructions');

-- Optional strenger: nur wenn Pfad in published instructions (über RPC/Edge später).
-- Für MVP reicht Lesezugriff für alle eingeloggten Nutzer auf den Bucket.

-- Upload von Artefakten (Phase 3) — Bucket "artifacts":
-- create policy "artifacts_insert_own"
-- on storage.objects for insert to authenticated
-- with check (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text);
