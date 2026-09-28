# Kiva — Concept

**As of:** 2026-09-28  
**Status:** Concept + MVP (sign-in, PWA, adapter layer)

## Vision

Kiva is an **installable web app (PWA)** where authorized users **fetch work instructions** from a central platform, **produce results locally** with any desktop software, **register those results in Kiva**, and **upload them** so other Kiva users can use them.

## Architecture (E2 / ET2)

Alongside [E2](https://github.com/abx-git/E2) and the local **Encrypted Vault** (`vault/`), **ET2** here means:

| Layer | Role |
|--------|--------|
| **Browser app (thin client)** | UI, session, orchestration — no business logic on a custom server |
| **Local engine** | IndexedDB, cache, optional File System Access API — data stays under user control |
| **Remote adapter (optional)** | Supabase: auth, metadata (Postgres), files (Storage) — when online with a valid session |

```text
┌─────────────────────────────────────────────────────────┐
│                    Kiva PWA (Browser)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ UI / Router │  │ Local engine │  │ Remote adapter  │ │
│  │ Sign-in, …  │  │ IndexedDB    │  │ Supabase Auth   │ │
│  │             │  │ SW cache     │  │ DB + Storage    │ │
│  └──────┬──────┘  └───────┬──────┘  └────────┬────────┘ │
│         └─────────────────┴──────────────────┘          │
└─────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
   Local files (OS)                 Supabase (central)
   DAW, CAD, Office, …              Instructions, artifacts
```

**Offline-first for reading:** Downloaded instructions and registered metadata are available locally. **Publishing to the community** requires network and authentication.

## Domain model (target)

| Entity | Description |
|---------|----------------|
| **User** | Identity via Supabase Auth (`auth.users`) |
| **Instruction** | Versioned package: metadata + files (PDF, ZIP, …) in Storage |
| **Artifact registration** | Local record: file linked to instruction, hash, sync status |
| **Publication** | Upload to Storage + metadata for other users |

### Golden path

1. **Sign in** — email/password (or magic link) via Supabase.
2. **Instructions** — list from DB, download to local cache / optional disk export.
3. **Work locally** — external tools; Kiva keeps references and metadata only.
4. **Register** — pick file(s), link to instruction, compute checksum.
5. **Upload** — blob to Storage, row in `artifacts`, visibility private or community.
6. **Share** — other users see published artifacts and can download.

## Security & privacy

- **Auth:** JWT via Supabase; refresh in the browser; no custom password storage in Kiva.
- **RLS:** row level security on tables — own drafts writable, published artifacts readable per policy.
- **Storage:** bucket policies; paths include `user_id` / `artifact_id`.
- **CSP:** strict policy in production; `connect-src` limited to the Supabase project URL.

## Stack

| Area | Choice | Rationale |
|---------|------|------------|
| Build | Vite 7 + TypeScript | Same pattern as `vault/` |
| Hosting | Static under `/kiva/` on x-be.de | GitHub Pages |
| Auth & backend | Supabase | DB, Storage, Auth |
| PWA | `manifest.webmanifest` + service worker | Installable, offline app shell |
| Local state | IndexedDB (native) | Structured cache metadata |

## Layout

```text
kiva/                 # SPA source
docs/kiva/            # Concept & progress
supabase/kiva/        # SQL schema (backend reference)
```

## Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **0** | Concept, docs, repo skeleton, PWA shell | Done |
| **1** | Sign-in + session + home | MVP |
| **2** | Instructions: list, download, offline cache | MVP done |
| **3** | Register artifact (local) + upload | MVP done |
| **4** | Community browse, search, orgs | Planned |

## Supabase setup (operators)

1. Create a Supabase project.
2. Run `supabase/kiva/schema.sql` in the SQL editor.
3. Create Storage buckets `instructions` and `artifacts` (see `storage.sql`).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `kiva/.env` or CI secrets.

Without those variables, Kiva runs in **demo mode** (banner in the UI, no real sign-in).

## Relation to E2 Board

- **E2** provides **domain model context** (`.storm.json`) for agents.
- **Kiva** provides **operational workflows** (instructions ↔ artifacts) with central sharing.

Linking an instruction to an E2 snapshot may come later; it is out of scope for phases 0–3.
