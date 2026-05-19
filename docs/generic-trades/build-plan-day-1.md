# Generic Trades — Day 1 Build Plan

**For:** Gavin (next session — read this first, then execute).
**Status:** Gerald greenlit Phase 1. Phase 2 SQL is blocked until 5 specific patches land.
**Branch:** `development` (no long-lived feature branch).
**Source plan:** `C2-implementation-plan.md` (this is the operational version of Phase 1 + the C2 patches).

---

## Today's outcomes

By end of day:

1. C2/A/B patched with Gerald's 5 round-2 corrections committed to `development`.
2. `D-read-site-audit.md` produced — a deliverable doc, not code.
3. Phase 2 SQL drafted as a migration file but NOT applied (review with Gerald + Shaun first).
4. Memory updated, progress logged.

**Explicit non-goals today:**
- No schema migrations applied to Supabase.
- No application code changes (no TS, no RPC).
- No UI work.

The whole day is documentation + audit. Phase 2 (the actual schema migration) ships **only after Gerald grades the audit + migration draft.**

---

## Step 0 — Session prep (5 min)

1. `cd projects/quotecore-plus`
2. `git pull --ff-only origin development` — sync any overnight changes.
3. `git status` — confirm clean working tree.
4. Re-read in order: this file → `C2-implementation-plan.md` (skim) → Gerald's report at `C:\Users\Jimmy\.openclaw\workspace-gerald\audits\quotecore-plus-generic-trades-plan-2026-05-19-c2\04-report.md`.
5. Confirm current `development` HEAD against MEMORY.md pointer.

---

## Step 1 — Patch C2 / A / B with Gerald's 5 round-2 findings (45-60 min)

Gerald flagged 4 medium findings + 1 low. Address each as a doc patch. Commit as one logical change.

### Patch 1.1 — Rename `takeoff_measurements` → `quote_takeoff_measurements` everywhere

**Why:** Gerald M-01. The actual table is `quote_takeoff_measurements` (per migrations and generated types). C2 used the wrong name.

**Where to fix:**
- `docs/generic-trades/C2-implementation-plan.md` — search for `takeoff_measurements` (no `quote_` prefix). Every hit is wrong.
- `docs/generic-trades/A-schema-delta.md` — same search.
- `docs/generic-trades/B-ux-walkthrough.md` — same search (probably none, but check).

**Acceptance:** `grep -n 'takeoff_measurements' docs/generic-trades/*.md` returns ONLY hits prefixed with `quote_`.

### Patch 1.2 — Add `save_takeoff_atomic` to the explicit RPC update list

**Why:** Gerald M-01 follow-up. The save-takeoff RPC writes measurements and must learn about `page_id`.

**Where to fix:**
- `C2-implementation-plan.md` Phase 7 (`Multi-page takeoff`) — add an explicit subsection: "Update `save_takeoff_atomic` to accept and persist `page_id` for every measurement row it writes." Add a regression bullet: "Round-trip `save_takeoff_atomic` → reload quote → confirm measurements still associated with their page."
- `C2-implementation-plan.md` Phase 2.2 schema changes — note that `quote_takeoff_measurements.page_id` initial NULL is temporary, tightened in Phase 7 after `save_takeoff_atomic` is updated.

### Patch 1.3 — Bootstrap concurrency: SECURITY DEFINER RPC + DB-level invariant

**Why:** Gerald M-02. Supabase JS has no multi-statement transaction boundary; two concurrent `ensureCompanyHasCollection(companyId)` calls can race and create duplicate "My Components" rows.

**Where to fix:**
- `C2-implementation-plan.md` Phase 3 (`Bootstrap path`) — rewrite the helper section as:
  > Implement bootstrap as a SECURITY DEFINER RPC `ensure_company_has_collection(p_company_id uuid)` that:
  > 1. Acquires a per-company advisory lock (`pg_advisory_xact_lock(hashtext(p_company_id::text))`).
  > 2. Inserts a `component_collections` row with `name='My Components'` if and only if no row exists for the company tagged as `is_bootstrap=true` (new column).
  > 3. Returns the bootstrap collection id.
  >
  > **Add:** new column `component_collections.is_bootstrap boolean not null default false`. Partial unique index `(company_id) WHERE is_bootstrap = true` makes duplicates literally impossible.
  >
  > **App-side caller** uses this RPC via the admin client; UI doesn't call it directly.

  Add a regression bullet: "Spawn 5 concurrent calls to `ensure_company_has_collection` for the same company; assert exactly one bootstrap row exists."

### Patch 1.4 — Trade compatibility: one central server helper

**Why:** Gerald M-03. Inline checks at every call site will drift; one missed path = a correctness bypass.

**Where to fix:**
- `C2-implementation-plan.md` Phase 6 (`Component creator + server-side trade validation`) — rewrite section 6.3 as:
  > Create one central server-side helper:
  > ```ts
  > // app/lib/trades/assertCompatible.ts
  > export async function assertComponentCompatibleWithQuote(args: {
  >   quoteId: string;
  >   componentId: string;
  >   companyId: string;
  > }): Promise<void> // throws TradeIncompatibleError
  > ```
  > Every server action that attaches a component to a quote MUST call this helper before the write. Specifically: `addQuoteComponent`, `cloneQuote` (re-attach loop), `applyTemplate`, takeoff-measurement-to-component conversion, and any other code path that creates a `quote_components` row.
  >
  > **No inline checks anywhere.** If you find yourself recomputing the allowlist in a server action, you have written a bug.
  >
  > **Regression test pattern:** the test suite greps every server action file for INSERT or UPSERT against `quote_components`. For each hit, the test asserts the file imports `assertComponentCompatibleWithQuote`. Fail otherwise. This is a static guard, not a runtime one.

### Patch 1.5 — Resolve `pricing_mode` drift risk

**Why:** Gerald M-04. If `pricing_mode` is allowed to diverge from `measurement_type` but isn't enforced, the two can drift silently.

**Decision** (make now, log in the patch):

> **Decision: remove `pricing_mode` from v1.** It adds a column whose only legitimate value is `= measurement_type` until a use case justifies divergence. If/when a real divergence emerges, add it then as a backward-compatible column.

**Where to fix:**
- `C2-implementation-plan.md` Phase 2.2 — delete the `pricing_mode` column entry. Delete the `pricing_mode` enum from Phase 2.3.
- `A-schema-delta.md` — same removal.
- Add a note: "If a future component needs a pricing mode independent of its measurement type, add the column at that time. v1 treats measurement_type as the sole driver."

### Patch 1.6 — Tighten Phase 2 schema-type wording (Gerald L-01)

**Why:** C2 mixed "text + CHECK" wording with "use the enum type directly." Pick one.

**Decision:** use the enum types directly for `trade`, `waste_unit`. They're tiny fixed sets.

**Where to fix:**
- `C2-implementation-plan.md` Phase 2.2 — change column type entries to use enums:
  - `companies.default_trade trade not null default 'roofing'`
  - `quotes.trade trade not null default 'roofing'`
  - `component_library.waste_unit waste_unit not null default 'percent'`
- Remove the `(CHECK ...)` annotations on those columns. The enum is the check.

### Commit 1

```
docs(generic-trades): patch C2/A/B with Gerald round-2 findings

- Rename takeoff_measurements → quote_takeoff_measurements throughout
  (Gerald M-01)
- Add save_takeoff_atomic to Phase 7 explicit update list (Gerald M-01
  follow-up)
- Bootstrap path now a SECURITY DEFINER RPC with advisory lock +
  is_bootstrap column + partial unique index (Gerald M-02)
- Central server helper assertComponentCompatibleWithQuote replaces
  every inline trade validation; regression test grep-asserts every
  quote_components mutation site imports the helper (Gerald M-03)
- Drop pricing_mode column + enum for v1 — measurement_type is the
  sole pricing driver; reintroduce if/when divergence is required
  (Gerald M-04)
- Use enum types directly (no text + CHECK) for trade and waste_unit
  in Phase 2 schema (Gerald L-01)

No code yet. Phase 1 (read-site audit) begins next.
```

---

## Step 2 — Phase 1 deliverable: `D-read-site-audit.md` (3-4 hours)

This is THE deliverable for Phase 1. Goal: every file that reads or writes `quote_components`, `quote_component_entries`, `quote_roof_areas`, `quote_roof_area_entries`, `quote_takeoff_measurements`, or the takeoff RPCs is classified as `SAFE` / `NEEDS GUARD` / `UNKNOWN` for the new world.

### Step 2.1 — Build the file list (20 min)

Use grep to enumerate every file touching the affected tables/RPCs. Write commands directly into the audit doc as evidence.

```powershell
# From projects/quotecore-plus root:
cd projects/quotecore-plus

# Tables to audit:
$tables = @('quote_components','quote_component_entries','quote_roof_areas','quote_roof_area_entries','quote_takeoff_measurements')
foreach ($t in $tables) {
  "=== $t ==="
  Get-ChildItem -Recurse app,backend -Include *.ts,*.tsx,*.sql | Select-String -Pattern "\b$t\b" -CaseSensitive | Select-Object Path,LineNumber,Line | Out-String -Width 200
}

# RPCs:
$rpcs = @('save_takeoff_atomic','create_quote_atomic','get_next_quote_number')
foreach ($r in $rpcs) {
  "=== $r ==="
  Get-ChildItem -Recurse app,backend -Include *.ts,*.tsx,*.sql | Select-String -Pattern "\b$r\b" -CaseSensitive | Select-Object Path,LineNumber,Line | Out-String -Width 200
}
```

Capture the output into the audit doc verbatim. Bulk count expected: ~50-80 hits total.

### Step 2.2 — Classify every hit (2-3 hours)

For each file/line pair, open the file, read the surrounding context, classify as:

| Class | Meaning |
|---|---|
| `SAFE` | Already handles `quote_roof_area_id=NULL` correctly OR is irrelevant to the no-area path (e.g. a write site that always provides an area). |
| `NEEDS GUARD` | Reads or computes against `quote_roof_area_id` assuming it's non-null. Needs a guard / fallback before Phase 5 can ship. |
| `UNKNOWN` | Code is too complex to classify in one pass — escalate to Gerald or write a focused test to determine behaviour. |

Use a markdown table per category. Example shape:

```md
## quote_components.quote_roof_area_id NULL — write sites

| File | Line | Classification | Notes |
|---|---|---|---|
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 117 | SAFE | createQuoteAtomic call, doesn't pass quote_roof_area_id |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` | 815 | NEEDS GUARD | addQuoteComponent always passes area_id from selected roof_area; needs "Quote-level (no area)" option |
| ... |
```

### Step 2.3 — Pricing engine deep-dive (30 min)

`app/lib/pricing/engine.ts` is the highest-risk file. Read it end-to-end with a specific question in mind: **does this code panic, mis-price, or skip rows when `quote_roof_area_id IS NULL`?**

Write a separate subsection of the audit doc documenting:
- How the engine iterates components.
- What it does with components that have no area.
- What multipliers (pitch, waste-by-area) it would skip and which still apply.
- A worked example: a `lineal` component with no area, qty 12, price $5/m. Trace through to confirm `$60` is the output, not `$0` or undefined.

### Step 2.4 — `save_takeoff_atomic` deep-dive (20 min)

Find the SQL source. Read the JSONB payload contract. Document:
- Does it accept `page_id`?
- Does it accept measurements with `unassigned=true`?
- What's the migration path to add `page_id` without breaking the existing one-page-per-quote assumption?

### Step 2.5 — RLS audit on new tables (15 min)

For each NEW table planned (`component_collections`, `takeoff_sessions`, `takeoff_pages`):
- Confirm the planned RLS policies match the C-01/C-02 standard.
- Confirm no billing-sensitive columns (so column-level GRANTs aren't required).
- Note any unusual access patterns.

### Step 2.6 — Final classification summary (15 min)

At the end of `D-read-site-audit.md`, summary table:

| Table/RPC | SAFE | NEEDS GUARD | UNKNOWN |
|---|---|---|---|
| `quote_components` (read) | N | N | N |
| `quote_components` (write) | N | N | N |
| ... etc |

And below it: a numbered list of follow-up tasks (one per `NEEDS GUARD` and one per `UNKNOWN`). Each task gets an estimated effort and a target phase.

### Commit 2

```
docs(generic-trades): Phase 1 read-site audit deliverable

D-read-site-audit.md classifies every file/line touching the affected
tables and RPCs as SAFE / NEEDS GUARD / UNKNOWN. Findings:
- N read sites SAFE
- N read sites NEEDS GUARD (covered in Phase 5)
- N UNKNOWN (escalated to Gerald)
- Pricing engine: <one-line verdict>
- save_takeoff_atomic: <one-line verdict>
- RLS on new tables: matches existing pattern

No code changes. Phase 2 SQL is the next ship.
```

---

## Step 3 — Draft Phase 2 SQL migration (1-1.5 hours)

The actual migration FILE. Not applied. Reviewed first.

### Step 3.1 — File location and naming

`projects/quotecore-plus/backend/supabase/migrations/20260520120000_generic_trades_phase_2_dark_schema.sql`

(Use the day-1 date and a clear name — the Phase 2 schema is dark; no behaviour changes.)

### Step 3.2 — Content

Translate every C2 Phase 2 change into idempotent SQL:

1. New enums (`trade`, `waste_unit`).
2. New tables in dependency order: `component_collections`, `takeoff_sessions`, `takeoff_pages`.
3. Column additions on existing tables (`companies.default_trade`, `quotes.trade`, `quotes.component_collection_id`, `component_library.collection_id`, `component_library.height_value_mm`, `component_library.depth_value_mm`, `component_library.waste_unit`, `quote_takeoff_measurements.page_id`, `quote_takeoff_measurements.unassigned`).
4. `measurement_type` enum extension (7 new values).
5. CHECK constraints on height/depth nullability.
6. Indexes.
7. RLS policies for the 3 new tables (mirror existing `(SELECT company_id FROM users WHERE id = auth.uid())` pattern).
8. The bootstrap RPC `ensure_company_has_collection(p_company_id uuid)` SECURITY DEFINER + REVOKE PUBLIC.

Each block wrapped in `BEGIN; ... COMMIT;` with comments explaining the why.

### Step 3.3 — DO NOT apply

The migration sits in the repo unapplied. Commit it, but DO NOT POST it to Supabase. The next step is Gerald + Shaun reviewing the actual SQL.

### Commit 3

```
feat(generic-trades): Phase 2 dark schema migration (UNAPPLIED)

Creates the schema delta from C2 Phase 2 as an idempotent SQL file.
Not yet applied to Supabase. Awaiting Gerald round-3 + Shaun signoff
on the actual SQL before posting.

Adds:
- enums: trade, waste_unit; extends measurement_type
- tables: component_collections, takeoff_sessions, takeoff_pages
- columns: trade + default_trade + component_collection_id +
  collection_id + height_value_mm + depth_value_mm + waste_unit +
  page_id + unassigned
- check constraints on height/depth nullability
- RLS policies matching the existing company-scoped pattern
- SECURITY DEFINER RPC ensure_company_has_collection(p_company_id)
  with advisory-lock + is_bootstrap partial unique index

Server flag GENERIC_TRADES_V1_ENABLED stays default false. Client
flag NEXT_PUBLIC_GENERIC_TRADES_V1 stays default false. Every new
column is nullable or default-valued so applying this migration is
behaviour-equivalent for the roofing flow.
```

---

## Step 4 — Push + notify Gerald (10 min)

1. `git push origin development`.
2. Update memory: add a note that day-1 generic-trades work is done; HEAD pointer in MEMORY.md.
3. Provide Gerald with the round-3 path:
   - `projects/quotecore-plus/docs/generic-trades/D-read-site-audit.md`
   - `projects/quotecore-plus/backend/supabase/migrations/20260520120000_generic_trades_phase_2_dark_schema.sql`
   - `projects/quotecore-plus/docs/generic-trades/C2-implementation-plan.md` (patched)

Tell Shaun the day is done + summarise.

---

## Step 5 — Debrief + memory compress (handled by Shaun, not Gavin)

At end of day Shaun has indicated a debrief + memory compression. Wait for his trigger. Gavin's role is to have everything ship-ready in the working tree, MEMORY.md cleanly updated, and the daily note written.

---

## What's NOT in day 1

- Applying Phase 2 SQL to Supabase. (Awaits Gerald round-3.)
- Any TS/React changes.
- The bootstrap helper as TS code (just the RPC SQL stub).
- `create_quote_atomic` updates (Phase 4).
- Any UI work.

---

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| pricing_mode column for v1 | DROP | Avoids drift risk without business value (Gerald M-04) |
| Bootstrap as SECURITY DEFINER RPC | YES | Concurrency safety (Gerald M-02) |
| Central trade-compat helper | YES | Single source of truth (Gerald M-03) |
| Enum types in schema | YES (no text+CHECK) | Cleanliness (Gerald L-01) |
| Phase 2 SQL applied today | NO | Awaits Gerald round-3 |

---

## When stuck

- **Audit classification is ambiguous?** Mark `UNKNOWN`, move on. Don't block on a single file.
- **A grep returns way more hits than expected (>100)?** Sample 20 representative ones, document the pattern, list the rest as "see pattern above" with file count. Quality of classification > coverage.
- **A test or helper doesn't exist that you need?** Note it; don't build it today. Day 1 is read-and-document, not build-and-fix.
- **Shaun asks for something off-plan?** Capture as a follow-up, finish day 1 first.

---

## End-of-day acceptance

- [ ] C2/A/B patched with 5 Gerald findings, committed.
- [ ] `D-read-site-audit.md` exists with classifications for every affected file.
- [ ] `20260520120000_generic_trades_phase_2_dark_schema.sql` exists, unapplied.
- [ ] All 3 commits pushed to `development`.
- [ ] `memory/2026-05-20.md` written, MEMORY.md HEAD pointer updated.
- [ ] Shaun notified.
- [ ] Gerald handed the round-3 paths.

Day done.
