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

Configure Supabase for production in **GitHub → Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
|------|------|--------|
| `VITE_SUPABASE_URL` | Secret or variable | Project URL (Supabase → Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Secret or variable | `anon` / publishable key |

The deploy workflow runs the **build** job in the **`github-pages` environment**, so the same names also work under **Environments → github-pages → Environment secrets / variables** (not only repository-level).

**Cursor Cloud Agent** secrets with the same names are used for development in the agent (`install` writes `kiva/.env` when missing). They are **not** sent to GitHub Pages automatically — GitHub Actions needs its own copy.

Without GitHub config the deploy build fails; the live app cannot authenticate.

## Supabase

SQL reference: [supabase/kiva/schema.sql](./supabase/kiva/schema.sql)

## Architecture (short)

- **E2/ET2:** browser app + local engine + optional remote adapter (no custom backend).
- **Phase 1:** sign-in and session.
- **Phase 2:** instruction catalog, download, offline storage (IndexedDB).
- **Phase 3:** register artifacts and upload (MVP).
