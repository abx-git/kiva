# Kiva — Concept

**Updated:** 2026-09-28

## In one sentence

Kiva lists **team instructions**, lets you **download and open** them in your own apps, and **upload result files** back — with optional **sharing per file**.

## Screen flow

1. **Sync list** — refresh which instructions exist (no file bytes).
2. Per instruction:
   - **Download** — store the instruction file in this browser.
   - **Open file** — save a copy to the device for other apps (after download).
   - **Add results** — pick one or many result files.
3. Under that instruction, each new file shows **Share** (optional) and **Upload**.
4. After a successful upload, the row **disappears** (done is done).

## Share checkbox

| Share | After upload |
|-------|----------------|
| Off | Only you see the file on the server (default). |
| On | Teammates signed into Kiva can see it. |

Set **Share** per file before **Upload**.

## What Kiva is not

Not an editor. Not a history of every upload — finished uploads are not listed in the UI.

## Technical notes (operators)

- Supabase: Auth, `instructions` + `artifacts` tables, Storage buckets `instructions` and `artifacts`.
- Setup: `supabase/kiva/setup.sql`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

See [README.md](../README.md) for deploy and troubleshooting.
