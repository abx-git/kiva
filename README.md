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

## GitHub Pages deploy

The workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds on push to `main` and publishes `dist/` to GitHub Pages.

Add these **repository secrets** (Settings → Secrets and variables → Actions) so sign-in works in production:

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | Project URL from Supabase (API settings) |
| `VITE_SUPABASE_ANON_KEY` | `anon` / publishable key from Supabase |

Without them the build fails and the live app cannot authenticate.

## Supabase

SQL reference: [supabase/kiva/schema.sql](./supabase/kiva/schema.sql)

## Architecture (short)

- **E2/ET2:** browser app + local engine + optional remote adapter (no custom backend).
- **Phase 1:** sign-in and session.
- **Phase 2:** instruction catalog, download, offline storage (IndexedDB).
- **Phase 3:** register artifacts and upload (MVP).
