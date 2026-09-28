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

## Supabase (required for more than sign-in)

The PWA only talks to **Supabase** (Auth + Postgres + Storage). URL and anon key in `.env` / GitHub secrets are **not** enough: you must create the Kiva tables and buckets once.

### One-time setup

1. **Supabase Dashboard** → your project → **SQL** → **New query**.
2. Paste and run the full script **[supabase/kiva/setup.sql](./supabase/kiva/setup.sql)**.
3. **Authentication** → **Users** → **Add user** (email + password) — login uses `auth.users`, not your custom tables.
4. (Optional) **Storage** → bucket `instructions` → upload a file, e.g. `onboarding/willkommen.pdf`, matching the demo row in `setup.sql`.
5. In the app: sign in → **Refresh catalog**.

Table reference (same content split): [supabase/kiva/schema.sql](./supabase/kiva/schema.sql), [storage notes](./supabase/kiva/storage.sql).

### Deutsch (Kurz)

Ohne SQL-Setup siehst du in Supabase **keine Tabellen** — das ist normal, bis du `setup.sql` ausführst. **Anmelden** geht trotzdem, wenn unter **Authentication → Users** ein Nutzer existiert. **Instruktionen laden** erst nach Tabellen + optional Datei im Storage-Bucket `instructions`.

**Login-Fehler „Database error querying schema“:** Der Testnutzer wurde per SQL ohne leere Token-Felder angelegt. Im SQL Editor den **UPDATE**-Block aus [supabase/kiva/test-user.sql](./supabase/kiva/test-user.sql) ausführen — oder Nutzer im Dashboard neu anlegen.

**Upload „Bucket not found“:** Storage-Buckets fehlen. Einmal [supabase/kiva/storage-setup.sql](./supabase/kiva/storage-setup.sql) im SQL Editor ausführen (oder komplett [setup.sql](./supabase/kiva/setup.sql)). Buckets heißen exakt `artifacts` und `instructions` (klein, privat).

### Cloud Agent: SQL automatisch ausführen lassen

Der Browser-Key (`VITE_SUPABASE_ANON_KEY`) darf **kein DDL** ausführen. Damit der Agent `setup.sql` per Shell anwenden kann, brauchst du eine **Postgres-Verbindung** als Secret:

1. **Supabase** → **Project Settings** → **Database** → **Connection string** → **URI** (Direct connection).
2. Ersetze `[YOUR-PASSWORD]` durch das Datenbank-Passwort (nicht der anon key).
3. In **Cursor** → **Dashboard** → **Cloud Agents** → deine **Environment** (Personal/Team für `abx-git/kiva`) → **Secrets**:
   - `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (für die App, hast du vermutlich schon)
   - **`SUPABASE_DB_URL`** = die URI aus Schritt 1
4. Neuen Agent starten (Secrets gelten für neue Runs). Der Agent kann dann ausführen:

   ```bash
   npm run db:setup
   ```

**Sicherheit:** `SUPABASE_DB_URL` niemals ins Git committen, nicht als `VITE_*` prefixen (würde ins Frontend-Build leaken). Optional nur read-only Secrets für Produktion — für Setup reicht ein separates Dev-Projekt.

**Alternative ohne DB-URL:** Supabase CLI mit Personal Access Token (`SUPABASE_ACCESS_TOKEN`) und `supabase link` — im Repo ist der Weg über `npm run db:setup` + `SUPABASE_DB_URL` vorgesehen.

### Tablet / kein Copy-Paste in Supabase SQL Editor

Du musst **kein SQL** in Supabase einfügen. Einmal einrichten, dann per Knopfdruck:

1. Supabase → **Project Settings** → **Database** → **Connection string** → **URI** (Direct) kopieren (eine Zeile, Passwort einsetzen).
2. GitHub → Repo **kiva** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**  
   Name: `SUPABASE_DB_URL`, Wert: die URI.
3. GitHub → **Actions** → **Apply Kiva Supabase setup** → **Run workflow**.

Das legt Tabellen und Storage-Buckets an. Nutzer weiterhin unter Supabase **Authentication → Users** anlegen.

## Architecture (short)

- **E2/ET2:** browser app + local engine + optional remote adapter (no custom backend).
- **Phase 1:** sign-in and session.
- **Phase 2:** instruction catalog, download, offline storage (IndexedDB).
- **Phase 3:** register artifacts and upload (MVP).
