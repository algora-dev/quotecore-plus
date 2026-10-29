# Migration roots inventory

Date: 2026-10-29 | Author: Gavin | Zero-risk documentation (no schema changes).

## Repository state (two live roots, known debt)

| Root | SQL files | Notes |
| --- | --- | --- |
| backend/supabase/migrations/ | 228 | older/primary root |
| supabase/migrations/ | 99 | second live root |

AGENTS.md already documents the policy: DB state is truth; never wholesale-regen
types; splice generated types instead. This inventory adds the counts and the
open provenance question.

## Applied-migrations ledger

Attempted read of `supabase_migrations.schema_migrations` on the active
project (bcqrrrvbzlfmfgvotzqw, us-east-1, migrated 2026-10-26) via the
Supabase Management API on 2026-10-29: both attempts returned HTTP 400 with
an empty body. Most likely the supabase_migrations ledger was not carried by
the 10-26 LOGICAL migration (dump/restore moves tables, not the migration
tool's bookkeeping schema), meaning file-based migration state and live DB
state have no machine-readable reconciliation on the new project.

Needs one manual verification (psql): does supabase_migrations.schema_migrations
exist on bcqrrrvbzlfmfgvotzqw, and how many entries? Until then treat any
"which migrations are applied" question as answerable only by inspecting
schema presence per migration.

## Known facts

- Old project aaavvfttkesdzblttmby (eu-central-1) kept unpaused as rollback copy.
- 2026-10-26 migration was logical (451MB, 16/16 tables row-verified); auth
  config was NOT copied (bit us: anonymous-signins flag, mailer templates,
  rate limits reset - documented in MEMORY.md).
- Standing rule: additive/nullable migrations only by default; never drop
  tables or delete prod data without owner confirmation.

## Follow-up (owner decision required before any action)

1. Confirm ledger state on the active project (read-only psql).
2. Decide the canonical migration root going forward (one root, one ledger).
3. Optional drift detection: scripted schema-presence check for the N most
   recent migrations. Do NOT replay historical migrations to "fix" the ledger.
