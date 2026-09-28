# Kiva — Concept

## Artifacts (result files)

Two tables after sign-in:

| Table | Contents |
|-------|-----------|
| **Shared** | All `community` artifacts — yours and teammates’. |
| **Private** | Your `private` artifacts on the server, plus **drafts** (added but not uploaded yet). |

### Actions

| Action | Applies to |
|--------|------------|
| **Upload** | Drafts in Private → stored on server as private. |
| **Move to shared** | Your row in Private → visible in Shared for the team. |
| **Move to private** | Your row in Shared → only you again. |
| **Delete** | Your drafts or your server rows. |
| **Download** | Any row you can see. |

Teammate rows in Shared: **Download** only.

### Instructions (top section)

Opening the app reloads the instruction list. Per instruction: **Download**, **Open file**, **Add results** (drafts → **Private**).

## Operators

- SQL: `supabase/kiva/setup.sql` (includes delete + team download policies).
- Existing projects: also run `supabase/kiva/artifacts-policies.sql`.
