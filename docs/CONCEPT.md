# Kiva — Concept

**Updated:** 2026-09-28

## What Kiva is

Kiva is a **PWA** that connects a **central instruction library** (Supabase) with **work you do on your own device**.

You do **not** edit instructions inside Kiva. You use **your normal apps** (PDF reader, CAD, Office, DAW, …). Kiva **tracks** which instruction you followed and **carries result files back** to the server when you upload them.

## What Kiva is not

- Not a file manager or document editor.
- Not a replacement for opening files in the OS — Kiva **stores a copy in the browser** and can **export** it when you need a file on disk.
- Not offline upload — sending results to the server requires network.

## The workflow (matches the UI)

```text
1. Sign in
2. Sync from server     → refresh the instruction list from Supabase
3. Save offline         → copy instruction file into Kiva (browser storage)
4. Export to device     → save that copy to Downloads / Files so other apps can open it
5. (Work in your apps)
6. Attach result file   → link a finished file to that instruction in Kiva
7. Send to server       → upload that result to Supabase Storage
```

### What each button does

| UI label | Meaning |
|----------|---------|
| **Sync from server** | Fetches the latest **published instruction list** from the database and merges it with what is already saved on this device. Does **not** download file bytes unless you tap **Save offline**. Use after an admin publishes new instructions or new versions. |
| **Save offline** | Downloads the instruction file from Storage into **IndexedDB** in this browser. Needed for offline reading inside Kiva and before **Export to device**. |
| **Export to device** | Takes the offline copy and triggers a **browser download** so you can open it in another app. Disabled until **Save offline** has run at least once. |
| **Attach result file(s)** | Pick one or many files; each becomes its own row under **Your result files** (same instruction). Tap the label directly on tablets. |
| **Share with team when uploaded** | **Per file**, in **Your result files** (not on the instruction row). Off = private on server; on = teammates can see after upload. Default for new files: off. |
| **Send to server** | Uploads one attached file. Repeat for each row, or attach many first and upload one by one. |

### Status badges on an instruction

| Badge | Meaning |
|-------|---------|
| **Saved in app** | File bytes are in this browser; export and offline use possible. |
| **Server only** | You see the catalog entry but have not saved the file on this device yet. |

## Roles

| Role | Kiva |
|------|------|
| **Central platform** | Supabase Auth, Postgres (`instructions`, `artifacts`), Storage buckets `instructions` + `artifacts`. |
| **This device** | IndexedDB cache, local result files before upload, PWA shell (service worker). |
| **Your tools** | Any software that opens the exported instruction file and produces a result file you attach in Kiva. |

## Architecture (short)

```text
┌──────────────────────────────────────────┐
│ Kiva PWA                                  │
│  UI  ·  IndexedDB (offline copies)        │
│         ·  Supabase client when online    │
└──────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   OS apps (export)     Supabase (catalog + uploads)
```

- **Thin client:** no custom backend; auth and data via Supabase.
- **Offline-first for reading:** saved instructions and attached results (pre-upload) live locally.
- **Online for sync and upload:** list sync and server upload need a session and network.

## Data model

| Entity | Description |
|--------|-------------|
| **Instruction** | Published catalog row + file in Storage (`instructions` bucket). |
| **Artifact** | Your result file linked to an instruction; local until uploaded, then in `artifacts` bucket. |

## Security (operators)

- JWT auth via Supabase; RLS on tables; Storage paths scoped by user id for artifacts.
- App env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (never commit secrets).

## Setup (operators)

1. Run `supabase/kiva/setup.sql` once (tables + buckets + policies).
2. Create users in **Authentication → Users** (preferred over raw SQL).
3. Publish instructions in DB + upload files to Storage.

See [README.md](../README.md) for deploy and troubleshooting.

## Roadmap

| Phase | Scope |
|-------|--------|
| **Done** | Sign-in, instruction list, offline save, export, attach + upload results |
| **Next** | Browse and download **other users’** shared results |

## Relation to E2

[E2](https://github.com/abx-git/E2) is a separate domain/agent context. Kiva is the **operational** instruction ↔ result workflow. Deep linking to E2 may come later.
