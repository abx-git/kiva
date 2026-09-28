# Kiva

PWA for shared work instructions: **sign-in (Supabase)**, local engine (IndexedDB), optional remote (DB + Storage).

**Concept:** [docs/CONCEPT.md](./docs/CONCEPT.md)  
**Progress:** [docs/PROGRESS.md](./docs/PROGRESS.md)

**Live (GitHub Pages):** https://abx-git.github.io/kiva/

## Development

```bash
cp .env.example .env   # Supabase URL and anon key
npm install
npm run dev            # http://localhost:5173/kiva/
npm run build          # → dist/
```

## Supabase

SQL reference: [supabase/kiva/schema.sql](./supabase/kiva/schema.sql)

## Architecture (short)

- **E2/ET2:** browser app + local engine + optional remote adapter (no custom backend).
- **Phase 1:** sign-in and session.
- **Phase 2:** instruction catalog, download, offline storage (IndexedDB).
- **Phase 3:** register artifacts and upload (MVP).
