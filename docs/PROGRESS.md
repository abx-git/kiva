# Kiva — Development progress

Chronological implementation log. Newest entries first.

---

## 2026-09-28 — English UI

### Done

- [x] All Kiva **user-facing strings** in English (app, manifest, HTML meta).
- [x] Error messages and docs renamed to `CONCEPT.md` / `PROGRESS.md` (English).

---

## 2026-09-28 — Phase 3 (artifacts, MVP)

### Done

- [x] Register file via file picker (SHA-256, local blob in IndexedDB).
- [x] Optional **Share with community** (`visibility`).
- [x] Upload to Storage bucket `artifacts` + insert into `artifacts`.
- [x] **My artifacts** list with status (local / uploading / published / error).

### Open

- [ ] Browse and download **community** artifacts from other users.
- [ ] Conflict handling for duplicate files / re-upload.

---

## 2026-09-28 — Phase 2 (instructions)

### Done

- [x] **Remote adapter:** list published instructions (`published = true`).
- [x] **Storage download:** bucket `instructions`, path from `storage_path`.
- [x] **Local engine:** metadata in `instructions`, blobs in `instruction_blobs` (DB v2+).
- [x] **Sync:** refresh catalog; invalidate offline copy when server version changes.
- [x] **UI:** list, download, open locally (export from IndexedDB).
- [x] **Docs:** `supabase/kiva/storage.sql`, `seed.example.sql`.

### Open

- [ ] Tighter Storage policies (path ↔ DB).
- [ ] Service worker: optional hints for large blobs (blobs stay in IndexedDB today).

---

## 2026-09-28 — Phase 0 & 1 (initial)

### Done

- [x] **Concept** in `docs/kiva/CONCEPT.md`: E2/ET2, domain, phases, Supabase setup.
- [x] **`kiva/`** project (Vite + TypeScript), build to `public/kiva/`.
- [x] **PWA:** manifest, service worker (app shell), theme/meta.
- [x] **Supabase client** + env; demo mode without keys.
- [x] **Sign-in UI:** email/password, session, sign out.
- [x] **Local engine:** IndexedDB `kiva-local`.
- [x] **Schema** `supabase/kiva/schema.sql`.
- [x] **CI:** Kiva build in GitHub Actions.

### Open

- [ ] Upload progress UX, RLS tests with a live project.
- [ ] Optional concept card on main site (`src/content/concepts.ts`).

### Known limitations

- No Supabase project in the repo (schema + env example only).
- Instruction files offline in IndexedDB, not in the service worker cache.
