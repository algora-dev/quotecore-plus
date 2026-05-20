# Generic Trades Expansion — Implementation Plan (revision 2)

**For:** Gerald (round-4 audit) — please grade again before any code ships.
**Author:** Gavin (QuoteCore+ agent)
**Status:** Draft 2 + round-2 patches + Shaun additions + round-3 patches (security/integrity fixes from Gerald's 2026-05-20 audit). Supersedes `C-implementation-plan.md`.
**Scope:** the bridge between `A-schema-delta.md` (v2) and `B-ux-walkthrough.md` (v2). All three docs are now mutually consistent.

---

## What changed C → C2 → C2-patched (post-Gerald round-2 + Shaun additions 2026-05-20)

### Gerald round-2 patches applied

| Finding | Action |
|---|---|
| M-01 wrong table name | Renamed `takeoff_measurements` → `quote_takeoff_measurements` everywhere. Added explicit note that `save_takeoff_atomic` must learn `page_id` in Phase 7. |
| M-02 bootstrap concurrency | Bootstrap is now a SECURITY DEFINER RPC `ensure_company_has_collection(p_company_id uuid)` with `pg_advisory_xact_lock` + `component_collections.is_bootstrap` partial unique index. |
| M-03 trade-compat drift | Central server helper `assertComponentCompatibleWithQuote()` replaces all inline checks. Regression suite greps every `quote_components` mutation site for the import. |
| M-04 `pricing_mode` drift | `pricing_mode` dropped from v1. `measurement_type` is the sole pricing driver. (See also Shaun addition 3 below: the new `pricing_strategy` column is a different concern.) |
| L-01 schema type wording | Phase 2.2 now uses enum types directly (`trade`, `waste_unit`); no mixed text+CHECK wording. |

### Gerald round-3 patches (2026-05-20)

| Finding | Action |
|---|---|
| H-01 enum split | Phase 2 SQL split into TWO files: `20260520120000_..._enums.sql` (committed first) and `20260520120010_..._dark_schema.sql` (depends on enums committing first). PG refuses to use newly-added enum values inside the same transaction the values were added in. |
| H-02 is_bootstrap user-writable | `component_collections` RLS hardened: authenticated users cannot INSERT bootstrap rows, UPDATE bootstrap rows, flip the flag, or DELETE bootstrap rows. Plus column-level GRANT restricts authenticated UPDATE to `name` only. Bootstrap is now genuinely service-role only, via the SECDEF RPC. |
| H-03 cross-company FK | Composite FKs from `quotes(company_id, component_collection_id)` and `component_library(company_id, collection_id)` to `component_collections(company_id, id)`. DB rejects any cross-company link, even if a buggy server action ever supplies the wrong UUID. |
| H-04 image_storage_path defensive lockdown | INSERT RLS on `takeoff_pages` enforces `image_storage_path IS NULL`. UPDATE column-GRANT excludes `image_storage_path` (and `quote_id`). Only the service-role finaliser sets/changes the path. |
| M-01 session/quote consistency | Composite FK from `takeoff_pages(session_id, quote_id)` to `takeoff_sessions(id, quote_id)`. Page cannot point at one session and a different quote. |
| M-02 one-session-per-quote enforced | `UNIQUE (quote_id)` on `takeoff_sessions`. Concurrent or repeated calls cannot create a second session. |
| M-03 multi_lineal allowlist gap | `multi_lineal` added to the generic trade allowlist (Phase 6.2). Roofing kept as-is for v1. |
| M-04 stale pricing_mode in Phase 5.1 | Replaced with `pricing_strategy`. No strategy switch happens in Phase 5 — the strategy table arrives with Phase 6; Phase 5 just uses the existing rate fields. |
| M-05 zero/negative pack values | `ck_component_library_pack_values_positive` CHECK: `pack_price >= 0`, `pack_size > 0`, `pack_coverage_m2 > 0`. Prevents divide-by-zero in the pricing engine. |
| L-01 combined_from server validation | Promoted to an explicit Phase 6 acceptance bullet in `test-combined-lineal-entries.mjs` (steps 7-10). |

### Shaun additions (2026-05-20)

| Addition | Action |
|---|---|
| **Multi-line takeoff tool** | New `measurement_type` value `multi_lineal`. Polyline-style takeoff tool that sums N segments into a single total-length measurement; component-level waste settings (percent OR flat-per-length) apply per segment. UX in Phase 7; schema in Phase 2. |
| **Combine lineal entries in quote builder** | New `quote_component_entries.combined_from jsonb` + `is_combined boolean` columns let the user collapse N separate length entries into a single "total length + waste" entry, reversible. PDF renders the clean total. UX in Phase 6; schema in Phase 2. |
| **Material pricing strategies** | New `pricing_strategy` enum + pack columns on `component_library` let users price a component by how they buy it (rolls by length, rolls by m², paint-style coverage, volume-pack, or per-unit). Pricing engine rounds up to whole packs. UX in Phase 6; schema in Phase 2. **Note for Gerald round-3:** this is NOT the `pricing_mode` column killed in M-04. M-04 killed a column that duplicated `measurement_type` with no use case. `pricing_strategy` is orthogonal to `measurement_type` (same measurement type, different purchasable-unit pattern) and has clear use cases. |

---

## Original C → C2 changes (Gerald round-1)

| Finding | Action |
|---|---|
| H-01 wrong "no-area" table | Drop the `roof_area_entries.area_id` nullable rework. The no-area path uses the **already-nullable** `quote_components.quote_roof_area_id`. Phase 1's schema change shrinks accordingly; phase 2 (read-site audit) now targets `quote_components` instead. |
| H-02 NOT NULL too early | `quotes.component_collection_id` is **nullable in phase 1**, tightened to NOT NULL in phase 3 only after every quote-create path is updated. Same staging for `component_library.collection_id` — nullable in phase 1, NOT NULL in phase 4 after bootstrap. |
| H-03 A/B/C contradictions | A v2 and B v2 published. All three now consistent. Confirmed locked in this commit. |
| H-04 naming collision | New container is `component_collections`, not `component_libraries`. New column on quotes is `component_collection_id`, not `component_library_id`. The legacy `component_library` table (which stores component rows) is NOT renamed. |
| M-01 flag layering | Two-layer flag: client `NEXT_PUBLIC_GENERIC_TRADES_V1` for UI rendering, plus server-side `GENERIC_TRADES_V1_ENABLED` for backend acceptance. Independent and both flippable. Path to per-company flag (DB row) left as a future option but not required for v1. |
| M-02 dark dynamic bootstrap | Replace "create library on the fly during quote create" with a deterministic `ensureCompanyHasCollection(companyId)` helper. Idempotent, transaction-safe, runs at company signup (or once on backfill for existing companies). The quote-create RPC never side-effect-creates a collection. |
| M-03 cascade footgun | `component_collections → component_library` is `ON DELETE RESTRICT`. Application-level UI must move/delete components before allowing collection deletion. |
| M-04 server-side trade validation | Every server action that adds a component to a quote validates `(quote.trade, component.measurement_type)` against the trade allowlist server-side. Whitelist lives in `app/lib/trades/measurement-type-whitelist.ts`. |
| M-05 multi-page storage | Each takeoff page upload goes through the existing signed-upload-URL finaliser (H-05). Phase 7 includes regression tests for "10+ pages near quota" and "cross-company page path attempt". |
| Q7 default trade | Keep `companies.default_trade`. Required to seed the create-quote form's trade dropdown sensibly. |
| Q8 hours/days waste | Default to `flat` (extra hours/days per line). |

---

## Guiding constraints (unchanged)

1. **Do not break roofing.**
2. **Trades and collections are independent.** Picked separately at quote-create time. Neither auto-pairs with the other. Collections have no trade.
3. **No defaults selected on the collection dropdown.** User picks manually each time. `default_trade` on companies is allowed (it's a single-value seed, not an auto-pair).
4. **Trade controls labels and gates.** "Roof Areas" vs "Wall Areas" vs "Areas" is a UI label. Whether the takeoff prompts for an area is trade-driven.
5. **Digital takeoff stops forcing area creation.** "Do you want to measure an area?" gate fires after calibration.
6. **Wipe at launch — no migration of existing customer data.**
7. **No section concept.** Areas (optional, named per-trade) and components.
8. **One takeoff session per quote, many pages.** Multi-session deferred.
9. **Customer quote editor stays the final override layer.** Unchanged.
10. **Ship behind a two-layer flag in phases.** Master stays deployable at any commit.

---

## Phase 0 — Decisions (locked)

| Item | Locked value |
|---|---|
| Container name | `component_collections` + `quote.component_collection_id` + `component_library.collection_id`. |
| Trades shipped v1 | `roofing`, `generic` only. |
| `default_trade` on companies | Kept. Defaults to `'roofing'`. |
| Default collection on companies | NONE. Bootstrap creates "My Components" but it's not stored as a default. |
| Library trade | NONE. Collections have no `trade` column. |
| Library `is_default` | NONE. No `is_default` column. |
| Roofing library measurement types in create-component form | All 11 types shown — Shaun confirmed component creation is trade-independent; the filtering happens at quote level. |
| Generic library measurement types | All 11. |
| "Need an area?" prompt copy | "Do you want to measure a roof area first?" (Yes / No, skip). Trade-aware copy: "Do you want to measure an area first?" for generic. |
| Client feature flag | `NEXT_PUBLIC_GENERIC_TRADES_V1` (env). Default `false`. |
| Server feature flag | `GENERIC_TRADES_V1_ENABLED` (env, no `NEXT_PUBLIC_` prefix). Default `false`. Validated on server actions independently. |
| Waste default for `hours_days` | `flat`. |
| Bootstrap collection name | "My Components". |

---

## Phase ordering (revised post-Gerald)

Gerald's recommendation: read-site audit comes BEFORE schema changes. Adopted.

| Phase | Goal | Effort |
|---|---|---|
| 0 | Decisions locked (above) | done |
| 1 | **Read-site audit** of `quote_components.quote_roof_area_id`-NULL paths | 0.5-1 day |
| 2 | Dark schema — every new table/column, all nullable, server flag off | 1 day |
| 3 | Bootstrap path — deterministic collection creation per company | 0.5 day |
| 4 | `create_quote_atomic` and quote-create path updates | 1 day |
| 5 | No-area generic quote support — server actions + pricing + customer editor | 1.5 days |
| 6 | Component creator + new measurement types + server-side trade validation | 1 day |
| 7 | Multi-page takeoff | 2-3 days |
| 8 | Trade-aware labels + builder polish | 0.5-1 day |
| 9 | Regression suites + Shaun smoke with flag on | 1 day |
| **Total** | | **9-11 days** |

---

## Phase 1 — Read-site audit (PRE-schema)

Goal: identify every TS / SQL / app site that touches `quote_components`, `quote_component_entries`, `quote_roof_areas`, `quote_roof_area_entries`, takeoff, templates, customer editor, material orders — and classify them as safe / needs-update / unknown when `quote_components.quote_roof_area_id IS NULL`.

Deliverable: a markdown table of files + classifications. Lives at `docs/generic-trades/D-read-site-audit.md`. No code changes in this phase.

Specific functions/files to audit (initial list, will grow):

- `app/lib/pricing/engine.ts` — does it iterate components and handle null area_id?
- `app/lib/billing/quote-creation.ts` (`createQuoteAtomic`) — what columns does the RPC project?
- `app/(auth)/[workspaceSlug]/quotes/actions.ts` (`loadQuote`, `loadQuoteComponents`, `addQuoteComponent`, `confirmQuote`, etc.)
- `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`
- `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx`
- `app/(auth)/[workspaceSlug]/quotes/[id]/summary/*` (PDF rendering)
- `app/(auth)/[workspaceSlug]/material-orders/*` (does the order template join components via roof_area_id?)
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts`
- The SQL `save_takeoff_atomic` RPC — does its payload include area-required assumptions?
- The component RLS policies on `quote_components` and `quote_component_entries`.

For each: read, classify (SAFE / NEEDS GUARD / UNKNOWN), record. Anything UNKNOWN goes back to Gerald.

**This phase is invisible to users.** No commits change behaviour. Audit doc + maybe a couple of follow-up PRs in phase 5 to add NULL handling.

---

## Phase 2 — Dark schema

Add every new table and column. All nullable. Server flag stays off.

### 2.1 New tables

- `component_collections (id uuid pk, company_id uuid fk, name text not null, is_bootstrap boolean not null default false, created_at timestamptz, updated_at timestamptz)`
  - **Partial unique index:** `unique (company_id) where is_bootstrap = true`. Makes duplicate bootstrap collections literally impossible. (Gerald M-02.)
- `takeoff_sessions (id uuid pk, quote_id uuid fk, created_at timestamptz)`
- `takeoff_pages (id uuid pk, session_id uuid fk, quote_id uuid fk, image_storage_path text, page_order int, page_name text, scale_calibration jsonb, pan_zoom_state jsonb, created_at timestamptz)`

### 2.2 New columns

- `companies.default_trade trade not null default 'roofing'`
- `quotes.trade trade not null default 'roofing'`
- `quotes.component_collection_id uuid null` — referenced by a **composite FK** `(company_id, component_collection_id)` → `component_collections (company_id, id)` `on delete restrict`. (Round-3 H-03: composite FK blocks cross-company links at the DB layer. Requires `UNIQUE (company_id, id)` on `component_collections`.)
- `component_library.collection_id uuid null` — referenced by a **composite FK** `(company_id, collection_id)` → `component_collections (company_id, id)` `on delete restrict`. (Round-3 H-03.)
- `component_library.height_value_mm integer null`
- `component_library.depth_value_mm integer null`
- `component_library.waste_unit waste_unit not null default 'percent'`
- **`component_library.pricing_strategy pricing_strategy not null default 'per_unit'`** (Shaun addition — material pricing modes). Compatibility with `measurement_type` enforced by CHECK constraint, see 2.4.
- **`component_library.pack_price numeric(12,4) null`** — price per pack/roll/bucket/unit. NULL when `pricing_strategy = 'per_unit'`.
- **`component_library.pack_size numeric(12,4) null`** — pack size in metres (for `per_pack_length`), m² (for `per_pack_area`), or m³ (for `per_pack_volume`). NULL otherwise.
- **`component_library.pack_coverage_m2 numeric(12,4) null`** — coverage in m² per pack (for `per_pack_coverage` only — the paint-style strategy where the pack quantity ≠ the area covered).
- `quote_takeoff_measurements.page_id uuid null references takeoff_pages(id) on delete cascade` (nullable for backfill; phase 7 tightens after `save_takeoff_atomic` learns the field — see Gerald M-01 follow-up).
- `quote_takeoff_measurements.unassigned boolean not null default false`
- **`quote_component_entries.combined_from jsonb null`** (Shaun addition — combine lineal entries). Stores the source rows when a user collapses N entries into a single total-length entry, so the operation is reversible. Shape: `[{length: number, waste: number, label?: string}, ...]`.
- **`quote_component_entries.is_combined boolean not null default false`** — flag for the UI to show "combined" affordance + the "Split back" action.

### 2.3 Enum extensions

- `measurement_type` add: `length_x_height`, `volume`, `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area`, **`multi_lineal`** (Shaun addition — polyline takeoff tool that sums N segments).
- `waste_unit` (new enum: `percent`, `flat`).
- `trade` (new enum: `roofing`, `generic`).
- **`pricing_strategy` (new enum):** `per_unit`, `per_pack_length`, `per_pack_area`, `per_pack_coverage`, `per_pack_volume`. Default `per_unit` keeps every existing component behaviour-equivalent. (See M-04 disambiguation in the header changelog: this is NOT the killed `pricing_mode` enum — it is orthogonal to `measurement_type`.)

### 2.4 Constraints

- `CHECK (measurement_type <> 'length_x_height' OR height_value_mm IS NOT NULL)`
- `CHECK (measurement_type <> 'volume' OR depth_value_mm IS NOT NULL)`
- `CHECK (height_value_mm IS NULL OR measurement_type = 'length_x_height')`
- `CHECK (depth_value_mm IS NULL OR measurement_type = 'volume')`
- **`CHECK` enforcing `pricing_strategy` ↔ `measurement_type` compatibility:**
  - `per_unit` → allowed for ALL measurement types (current behaviour).
  - `per_pack_length` → only `lineal`, `multi_lineal`, `rafter`, `valley_hip`, `curved_line`.
  - `per_pack_area` → only `area`, `length_x_height`, `irregular_area`.
  - `per_pack_coverage` → only `area`, `length_x_height`, `irregular_area`.
  - `per_pack_volume` → only `volume`.
- **`CHECK` enforcing pack columns nullable in lockstep with strategy:**
  - `per_unit` → `pack_price`, `pack_size`, `pack_coverage_m2` all NULL.
  - `per_pack_length` / `per_pack_area` / `per_pack_volume` → `pack_price` + `pack_size` NOT NULL, `pack_coverage_m2` NULL.
  - `per_pack_coverage` → `pack_price` + `pack_size` (quantity per pack, e.g. 20L) + `pack_coverage_m2` all NOT NULL.
- **`CHECK (is_combined = false OR combined_from IS NOT NULL)`** on `quote_component_entries` — a combined row must have its source data preserved.

### 2.5 RLS + column-level GRANTs

Every new table follows the company-scoped pattern. Service-role bypasses. Two tables receive **column-level GRANT lockdowns** even though they have no billing-sensitive columns, because round-3 surfaced specific abuse paths each one addresses:

- **`component_collections`** (Round-3 H-02):
  - SELECT: `company_id = (SELECT company_id FROM users WHERE id = auth.uid())`.
  - INSERT WITH CHECK adds `AND is_bootstrap = false` — authenticated users cannot create a bootstrap row.
  - UPDATE USING + WITH CHECK both add `AND is_bootstrap = false` — authenticated users cannot touch an existing bootstrap row or flip the flag during an UPDATE.
  - DELETE USING adds `AND is_bootstrap = false` — authenticated users cannot delete a bootstrap row.
  - Column-level GRANT: `REVOKE UPDATE` from authenticated, then `GRANT UPDATE (name)` only. `is_bootstrap`, `company_id`, `id`, timestamps are all NOT in the whitelist. Bootstrap is genuinely service-role only via the SECDEF RPC.

- **`takeoff_sessions`**: standard `FOR ALL` policy scoped by `quote_id IN (SELECT id FROM quotes WHERE company_id = ...)`. No column-GRANT needed.

- **`takeoff_pages`** (Round-3 H-04):
  - SELECT / UPDATE / DELETE: standard quote-scoped policies.
  - INSERT WITH CHECK adds `AND image_storage_path IS NULL` — authenticated users cannot supply an arbitrary storage path at insert time.
  - Column-level GRANT: `REVOKE UPDATE` from authenticated, then `GRANT UPDATE (page_name, page_order, scale_calibration, pan_zoom_state, session_id)` only. `image_storage_path`, `quote_id`, `id`, `created_at` are all NOT in the whitelist. The service-role signed-upload finaliser is the only path that writes/updates `image_storage_path` after verifying ownership, prefix, content type, and stored size.

The C-01 column-level GRANT pattern is therefore used here as a defensive posture (round-3 made it mandatory), even though there's no billing leakage risk.

### 2.6 Indexes

- `component_collections (company_id)`
- `component_collections (company_id) where is_bootstrap = true` — partial unique (Gerald M-02).
- `takeoff_pages (session_id, page_order)`
- `quote_takeoff_measurements (page_id)`
- `quotes (component_collection_id)` partial WHERE NOT NULL
- `component_library (collection_id)` partial WHERE NOT NULL

### 2.7 Migration safety

- All columns nullable or default-valued.
- No existing row needs hand-writing.
- Server flag off → no server action accepts `trade`/`collection_id` from clients.
- Client flag off → UI hides every new control.
- Existing regression matrix continues passing unchanged.

**Acceptance test for this phase:** every existing regression suite still passes with the flag OFF, and a new `test-dark-schema-smoke.mjs` confirms that creating a company, then a quote via the existing path, results in `quotes.trade='roofing'` and `quotes.component_collection_id IS NULL`.

---

## Phase 3 — Bootstrap path

Goal: deterministic, **DB-concurrency-safe** helper that ensures every company has at least one collection, created idempotently.

### 3.1 Bootstrap RPC (Gerald M-02)

Implement bootstrap as a SECURITY DEFINER PostgreSQL RPC:

```sql
create or replace function public.ensure_company_has_collection(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection_id uuid;
begin
  -- Per-company advisory lock; releases at end of transaction.
  perform pg_advisory_xact_lock(hashtext(p_company_id::text));

  -- Re-check inside the lock.
  select id into v_collection_id
  from component_collections
  where company_id = p_company_id and is_bootstrap = true
  limit 1;

  if v_collection_id is null then
    insert into component_collections (company_id, name, is_bootstrap)
    values (p_company_id, 'My Components', true)
    returning id into v_collection_id;
  end if;

  return v_collection_id;
end;
$$;

revoke all on function public.ensure_company_has_collection(uuid) from public, anon, authenticated;
-- Service-role only — call via admin client.
```

Key properties:
- **Service-role only.** REVOKE ALL from public/anon/authenticated. The UI never calls this directly; server actions call it via the admin client.
- **Per-company advisory lock** + the partial unique index from Phase 2 mean concurrent calls cannot create duplicate bootstrap rows.
- **Idempotent.** Safe to call any number of times.
- Returns the bootstrap collection id.

### 3.1b TS wrapper

`ensureCompanyHasCollection(companyId: string): Promise<string>` in `app/lib/data/company-context.ts`:
- Resolves the admin client.
- Calls `rpc('ensure_company_has_collection', { p_company_id })`.
- Returns the resulting collection id.
- Adds a structured log line on each call for observability.

**Regression bullet:** spawn 5 concurrent calls to `ensure_company_has_collection` for the same company; assert exactly one bootstrap row exists afterwards.

### 3.2 Call sites

- New signup flow → call `ensureCompanyHasCollection` as the last step of company creation.
- One-off backfill admin script for every existing company (`scripts/backfill-component-collections.mjs`). Idempotent, run-anywhere.
- Optional safety net: a server action `getCompanyCollections` that calls `ensureCompanyHasCollection` first if the company has zero collections (this is the only "create on the fly" path retained, behind explicit logging).

### 3.3 No quote-create side-effects

`createQuoteAtomic` is NOT modified in this phase. The bootstrap helper runs *before* any quote-create RPC. The RPC sees a populated `component_collections` table for every company that's been bootstrapped.

### 3.4 Migrate existing data

For dev/staging only (production is wiped at launch): run backfill once → every existing company has a "My Components" collection → every existing `component_library` row gets `collection_id` set to that collection. After backfill, phase 4 can tighten `component_library.collection_id` to NOT NULL.

---

## Phase 4 — Update `create_quote_atomic` and quote-create paths

Goal: every code path that creates a quote accepts `trade` and `component_collection_id` and persists them.

### 4.1 RPC changes

- `create_quote_atomic(p_company_id, p_user_id, p_payload jsonb)` — add `trade` and `component_collection_id` to the projected column list.
- Server-side validation: refuse the insert if `p_payload.component_collection_id` is NULL when `GENERIC_TRADES_V1_ENABLED=true`. Refuse if `p_payload.trade` is missing.
- Regression: update `test-trial-reactivation-blocked.mjs` and other quote-creation tests to pass `trade='roofing'` + `component_collection_id` from the company's first collection.

### 4.2 Server action surface

- `CreateQuotePayload` adds `trade: 'roofing' | 'generic'` and `componentCollectionId: string`.
- Every TS caller updated. There are ~6 callers (manual create, blank create, digital create, clone, template, demo seed).

### 4.3 Schema tightening

After the RPC + callers are updated AND there's a regression confirming every quote-create path persists the new columns:
- `ALTER TABLE quotes ALTER COLUMN component_collection_id SET NOT NULL` (only when `GENERIC_TRADES_V1_ENABLED=true` becomes the default).

This tightening can ship in a separate migration once we're confident.

### 4.4 Flag layering

- `GENERIC_TRADES_V1_ENABLED=false` → server action accepts the new columns but allows NULL. Default `trade='roofing'`. Default `collection_id` = NULL.
- `GENERIC_TRADES_V1_ENABLED=true` → both required server-side.

---

## Phase 5 — No-area generic quote support

Goal: a quote with `trade='generic'` and zero areas, with components attached at `quote_roof_area_id=NULL`, prices correctly, renders correctly in the customer editor, and exports to PDF correctly.

### 5.1 Pricing engine

`app/lib/pricing/engine.ts`:
- Iterate `quote_components`. For each row, calculate price using the existing `material_rate` / `labour_rate` fields on the row, plus `component.height_value_mm` + `component.depth_value_mm` where applicable to `length_x_height` / `volume` components. **Phase 5 does NOT introduce the `pricing_strategy` switch** — that arrives in Phase 6 alongside the strategy table and the component-creator UI. Phase 5's only job here is to make the existing per-unit pricing path NULL-area-safe and `length_x_height` / `volume` aware. (Round-3 M-04: stale `pricing_mode` reference removed; this section was previously pointing at a column that was killed in M-04.)
- For `quote_roof_area_id = NULL` rows: skip pitch / waste-by-area maths entirely. Use the entry's own qty / length / area.

### 5.2 Customer quote editor

- Lines from no-area quotes render under a flat "Quote items" heading.
- Move-line-between-areas: works for area-attached quotes; for no-area quotes the move-action is a no-op (areas don't exist).
- Delete-area: when the last area is removed, components move to `quote_roof_area_id = NULL` (not deleted).

### 5.3 PDF rendering

- The summary PDF treats no-area quotes as one flat list of components under a "Quote items" heading.

### 5.4 Regression

`scripts/test-no-area-quote.mjs`:
1. Create company → bootstrap → create a generic quote with collection_id set → add 3 components (lineal, count, fixed) with `quote_roof_area_id = NULL` → assert pricing engine returns correct totals → confirm the quote → assert customer editor shows the three lines under "Quote items" → render PDF (smoke) → assert no crash.

---

## Phase 6 — Component creator + server-side trade validation

### 6.1 Component creator UI

- Update `/{slug}/components` to show the collection switcher + "+ Create collection" modal (just name field).
- Component creation modal:
  - Measurement type dropdown shows all 11 types.
  - Type-specific fields (height, depth, hours/days unit).
  - Waste type defaults to `percent` except `hours_days` which defaults to `flat`.
- Component edit / delete unchanged (edits don't retroactively change saved quote lines).
- Collection delete: `ON DELETE RESTRICT` at DB level + app-level confirmation modal + check for blocking quotes.

### 6.2 Trade allowlist

`app/lib/trades/measurement-type-whitelist.ts`:
```ts
export const TRADE_ALLOWED_MEASUREMENT_TYPES = {
  roofing: new Set(['area','lineal','rafter','valley_hip']),
  generic: new Set(['area','lineal','rafter','valley_hip','length_x_height','volume','hours_days','count','fixed','curved_line','irregular_area','multi_lineal']),
  // Round-3 M-03: multi_lineal added to generic. Roofing intentionally
  // omits it for v1 — if a roofing workflow surfaces (gutters, cabling),
  // we'll widen later. Keep test-trade-whitelist.mjs in sync.
};
```

### 6.3 Server-side validation — one central helper (Gerald M-03)

Create one central server-side helper. **No inline checks anywhere.**

```ts
// app/lib/trades/assertCompatible.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { TRADE_ALLOWED_MEASUREMENT_TYPES } from './measurement-type-whitelist';

export class TradeIncompatibleError extends Error {
  code = 'trade_incompatible' as const;
  constructor(public trade: string, public measurementType: string) {
    super(`Component with measurement_type=${measurementType} is not allowed on a ${trade} quote.`);
  }
}

export async function assertComponentCompatibleWithQuote(args: {
  quoteId: string;
  componentId: string;
  companyId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const [{ data: quote }, { data: component }] = await Promise.all([
    admin.from('quotes').select('trade').eq('id', args.quoteId).eq('company_id', args.companyId).single(),
    admin.from('component_library').select('measurement_type').eq('id', args.componentId).eq('company_id', args.companyId).single(),
  ]);
  if (!quote || !component) throw new Error('not_found');
  const allowed = TRADE_ALLOWED_MEASUREMENT_TYPES[quote.trade];
  if (!allowed?.has(component.measurement_type)) {
    throw new TradeIncompatibleError(quote.trade, component.measurement_type);
  }
}
```

**Every server action that creates a `quote_components` row MUST import and call this helper before the write.** Specifically:
- `addQuoteComponent`
- `cloneQuote` (the re-attach loop for every cloned component)
- `applyTemplate`
- Takeoff measurement → component conversion (`save_takeoff_atomic` callers and any TS helper that materialises measurements as components)
- Any other code path that inserts into `quote_components`.

**Static regression guard** (`scripts/test-trade-helper-imports.mjs`): grep every server action file under `app/` for INSERT or UPSERT against `quote_components`. For each match, assert the file imports `assertComponentCompatibleWithQuote`. Fail otherwise. This is a static guard, not a runtime one; we catch regressions at PR time.

Refusal returns a structured error (`trade_incompatible`) the UI surfaces as a tooltip/toast, not a 500.

### 6.4 Client-side UI hint

Components incompatible with the current quote's trade are shown disabled in the picker with a tooltip ("This component uses `volume`, which isn't supported on roofing quotes"). Pure UX polish; the server is the source of truth.

### 6.5 Material pricing strategies (Shaun addition)

Goal: let users price a component by how they buy it. Materials don't always come per-unit — they come in rolls, buckets, packs, volumes. The pricing engine rounds up to whole packs.

#### 6.5.1 Strategies

| Strategy | Use case | Inputs | Cost formula |
|---|---|---|---|
| `per_unit` | Per-item pricing (bolts, fasteners). DEFAULT — current behaviour. | `cost_per_unit` (existing) | `qty * cost_per_unit` |
| `per_pack_length` | Cable: 20m roll @ $50. | `pack_price=50, pack_size=20` | `ceil(total_lineal_m / pack_size) * pack_price` |
| `per_pack_area` | Underlay: 50 m² roll @ $60. | `pack_price=60, pack_size=50` | `ceil(total_m2 / pack_size) * pack_price` |
| `per_pack_coverage` | Paint: 20L bucket @ $100, covers 50 m². | `pack_price=100, pack_size=20 (litres), pack_coverage_m2=50` | `ceil(total_m2 / pack_coverage_m2) * pack_price` |
| `per_pack_volume` | Concrete: 5 m³ unit @ $100. | `pack_price=100, pack_size=5` | `ceil(total_m3 / pack_size) * pack_price` |

`pack_size` for `per_pack_coverage` stores the **physical pack quantity** (e.g. 20 litres) for display purposes; the cost math uses `pack_coverage_m2`. This lets the quote builder show "7 × 20L buckets = 140 litres" alongside the price.

#### 6.5.2 UI in component creator

Under "Pricing" in the component create/edit modal, add a **Pricing strategy** dropdown. Default `per_unit`. Selecting any other strategy reveals strategy-specific fields:

- `per_pack_length`: `Pack price` ($), `Pack size` (m).
- `per_pack_area`: `Pack price` ($), `Pack size` (m²).
- `per_pack_coverage`: `Pack price` ($), `Pack size` (e.g. 20 litres — free-form quantity for display), `Coverage per pack` (m²).
- `per_pack_volume`: `Pack price` ($), `Pack size` (m³).

Dropdown options are **filtered by the component's `measurement_type`** so users can't pick incompatible combos (matches the CHECK in Phase 2.4). E.g. a `lineal` component only shows `per_unit` and `per_pack_length`.

Live worked example below the inputs: "280 m² ÷ 50 m²/roll = 6 rolls × $60 = $360" updates as user types. Helps with mental model.

#### 6.5.3 Pricing engine

`app/lib/pricing/engine.ts` adds a strategy switch per component:

```ts
switch (component.pricing_strategy) {
  case 'per_unit':           return qty * component.cost_per_unit;
  case 'per_pack_length':    return Math.ceil(total / component.pack_size) * component.pack_price;
  case 'per_pack_area':      return Math.ceil(total / component.pack_size) * component.pack_price;
  case 'per_pack_coverage':  return Math.ceil(total / component.pack_coverage_m2) * component.pack_price;
  case 'per_pack_volume':    return Math.ceil(total / component.pack_size) * component.pack_price;
}
```

The `total` value is the measured value (length, area, or volume) already including any waste added at the component level. **Rounding up happens AFTER waste is applied** — the user has already padded for waste; the round-up captures the next purchasable unit on top.

#### 6.5.4 PDF / customer editor display

- Quote builder shows: `6 × 50 m² rolls × $60 = $360` for transparency.
- Customer PDF shows just the line total ($360) plus a sub-note in italic for transparency: "6 rolls of underlay @ $60." Final wording TBD with Shaun in Phase 6 build.

### 6.6 Combined lineal entries (Shaun addition)

Goal: when a quote builder has many small lineal entries (e.g. 10 × 2m of cable), let the user **collapse them into one total-length-plus-waste entry**, reversibly.

#### 6.6.1 UI

In the quote builder → Components tab, for any `lineal` / `multi_lineal` / `rafter` / `valley_hip` / `curved_line` component with ≥2 entries:
- Show button: **"Combine into total length + waste"**.
- On click: collapse all entries into one row. New row's `length` = `sum(entry.length × (1 + waste%))` (or `sum(entry.length + waste_flat)` when waste_unit is `flat` — waste is per-length per Shaun's spec).
- The new row stores the source data in `combined_from` JSONB.
- New row UI label: `21m (combined from 10 × 2m + 5% waste per length)`.
- Show inverse button: **"Split back into individual lengths"**, which restores from `combined_from` and deletes the combined row.

#### 6.6.2 Waste math

Waste is **always applied per source length**, regardless of waste_unit:
- `waste_unit='percent', waste_value=5, entries=10 × 2m` → each segment becomes `2 + (2 × 0.05) = 2.1m` → combined = `21m`.
- `waste_unit='flat', waste_value=0.25, entries=10 × 2m` → each segment becomes `2 + 0.25 = 2.25m` → combined = `22.5m`.

This matches the multi-line takeoff tool's behaviour (Phase 7.7) so the two paths produce identical outputs for identical inputs.

#### 6.6.3 PDF rendering

Customer PDF shows the **clean total length only** — no breakdown of "10 × 2m". Same as the existing lineal PDF rendering. The `is_combined`/`combined_from` data is internal to the quote builder.

#### 6.6.4 Regression

`scripts/test-combined-lineal-entries.mjs`:
1. Create a quote with a `lineal` component, `waste_unit=percent`, `waste_value=5`.
2. Add 10 entries of 2m each.
3. Call `combineEntries(componentId)` server action.
4. Assert one entry remains with `length=21, is_combined=true, combined_from=[10 rows]`.
5. Call `splitEntries(componentId)` server action.
6. Assert 10 entries restored with their original lengths, `is_combined=false`.

**Round-3 L-01: malformed-input rejection** (the server action that writes `combined_from` MUST validate shape before insert; these tests fail-shut if validation is missing):
7. Attempt to write `combined_from = "not-an-array"` → server action REJECTS with a structured `invalid_combined_from` error.
8. Attempt to write `combined_from = [{ length: "oops" }]` (non-numeric length) → REJECTED.
9. Attempt to write `combined_from = [...500 entries]` (exceeds max array length) → REJECTED. Max length cap: 200 entries for v1.
10. Attempt to write `combined_from = [{ length: -5, waste: 0 }]` (negative length) → REJECTED.

### 6.7 Regression

- `test-trade-whitelist.mjs`:
  1. Create a roofing quote.
  2. Create a `volume` component (in any collection).
  3. Server action `addQuoteComponent` rejects the attach with `trade_incompatible`.
  4. Repeat for every type / trade combo in the allowlist table.
- `test-collection-isolation.mjs`:
  1. Create company → bootstrap → create collection A and B with different components.
  2. Create a quote with collection_id = A.
  3. Assert the component picker for that quote shows only A's components, not B's.

---

## Phase 7 — Multi-page takeoff + multi-line tool

Goal: takeoff supports many images per quote with per-page calibration, assignment modal, and existing signed-upload-URL finaliser flow. Also: a new polyline takeoff tool for measurements that need N connected points summed into one total (cabling, fencing, gutters, etc.).

### 7.0 `save_takeoff_atomic` updates (Gerald M-01 follow-up)

Before Phase 7 schema tightening (7.1), `save_takeoff_atomic` must be updated to accept and persist `page_id` for every measurement row it writes. Without this, the page-aware path is incomplete and tightening `quote_takeoff_measurements.page_id` to NOT NULL will break the RPC.

**Regression bullet:** round-trip `save_takeoff_atomic` → reload quote → confirm measurements still associated with their page.

### 7.1 Schema cleanup

- `quote_takeoff_measurements.page_id` → ALTER to NOT NULL after backfill (every existing measurement assigned to the single first page created per quote during phase 2 migration) **AND after `save_takeoff_atomic` has been updated per 7.0**.

### 7.2 Page upload

- Each page upload reuses `mintQuoteDocumentUploadUrl()` and the existing finaliser. `MintUploadInput.scope` already supports `'quote'` scope; pages slot in naturally.
- New action: `addTakeoffPage(quoteId, claimedSize, contentType, filename, pageName?)` → calls the existing mint, returns the signed URL + token; client uploads; client calls `finaliseTakeoffPageUpload(quoteId, pageId, storagePath)` which writes the `takeoff_pages` row and runs the same quota accounting as today.

### 7.3 Calibration UI

- Per-page calibration on every page upload. Calibration JSON stored on the page row.
- Page switcher: thumbnails or numbered tabs above the canvas. Switching loads page-specific drawings + calibration.

### 7.4 Assignment modal

- "Upload another image" → modal: "Add to same area as previous", "Create new area", "No area" (when no areas exist).
- Default selection: the first area created for the previous page.
- Modal logic same in initial-takeoff and "add later" flows.

### 7.5 "Add takeoff page" entry point on saved quote

- Header button on quote builder. Opens takeoff canvas in add-page mode (skips empty-state upload screen).

### 7.7 Multi-line takeoff tool (Shaun addition)

A new takeoff drawing tool for the `multi_lineal` measurement type. Mirrors the area tool's UX but draws an open polyline (not a closed polygon) and sums segment lengths into a single measurement.

#### 7.7.1 UX

- User picks a `multi_lineal` component (e.g. "Electrical cable").
- Canvas activates polyline-drawing mode:
  - Click to drop point 1.
  - Click to drop point 2 — segment 1 renders.
  - Click to drop point 3 — segment 2 renders.
  - ... continue until N points.
  - Double-click OR press Enter OR click "Finish" to commit.
- During drawing, the live readout shows running total (`Total: 14.2m (5 segments)`).
- On commit:
  - One row written to `quote_takeoff_measurements` with `measurement_type='multi_lineal'`, `length_m = sum(segment_lengths)`, `points = JSON array of all vertices`.
  - **Component-level waste is applied per source segment**, per Shaun's spec.
    - `waste_unit='percent', value=5` + 10 × 2m segments → 21m total.
    - `waste_unit='flat', value=0.25` + 10 × 2m segments → 22.5m total.
  - This matches the manual quote builder's "Combine into total length + waste" output (Phase 6.6) for identical inputs.

#### 7.7.2 Storage

No new columns. `quote_takeoff_measurements.points` (existing JSONB) holds the vertex array. The renderer detects `measurement_type='multi_lineal'` and treats `points` as an open polyline instead of a closed polygon.

#### 7.7.3 Pricing path

Pricing engine treats `multi_lineal` exactly like `lineal` (length × $/m, plus pricing-strategy round-up if applicable). The only difference is the source of `length_m`.

#### 7.7.4 Regression

`scripts/test-multi-lineal-tool.mjs`:
1. Create a `multi_lineal` component with `waste_unit=percent, value=5`.
2. Programmatically save a takeoff with 10 segments of 2m each.
3. Assert one measurement row with `length_m = 21` (10 × 2 × 1.05).
4. Repeat with `waste_unit=flat, value=0.25` → assert `length_m = 22.5`.
5. Assert pricing engine output matches the lineal-component pricing for the same total.

### 7.8 Regression

- `test-multi-image-takeoff.mjs`:
  1. Create quote → upload page 1 → calibrate → measure → upload page 2 → modal defaults to "first area created" → user changes to "new area" → measure on page 2 → assert both pages persist with their own calibration and measurements.
- `test-takeoff-page-quota.mjs`:
  1. Create company on starter plan (200 MB quota).
  2. Upload 10 takeoff pages, each ~15 MB. The 14th should refuse with `storage_quota_exceeded`. Quota accounting matches actual storage usage.
- `test-takeoff-page-isolation.mjs`:
  1. Two companies. Company A tries to call `addTakeoffPage` with a path inside company B's folder. Refused with `unauthenticated` or `invalid_input`.

---

## Phase 8 — Trade-aware UI

Goal: the final polish layer — wording, labels, trade-driven gating in the quote builder.

### 8.1 Labels config

`app/lib/trades/labels.ts`:
```ts
export const TRADE_LABELS = {
  roofing: {
    areaPluralLabel: 'Roof Areas',
    addAreaCta: 'Add Roof Area',
    needAreaPrompt: 'Do you want to measure a roof area first?',
    skipAreaCta: 'No, skip',
  },
  generic: {
    areaPluralLabel: 'Areas',
    addAreaCta: 'Add Area',
    needAreaPrompt: 'Do you want to measure an area first?',
    skipAreaCta: 'No, skip',
  },
};
```

### 8.2 Quote builder

- "Roof Areas" → `TRADE_LABELS[trade].areaPluralLabel`.
- "Add area" form simplified for non-roofing trades (no pitch field).
- Component picker filtered by trade allowlist (per phase 6, this is enforced server-side; client just hides/disables).

### 8.3 Settings page

- Company default trade selector. Available in company settings (`/{slug}/settings`).

### 8.4 Customer quote editor

- No language changes (final-override layer stays unchanged per Shaun).
- Lines from no-area quotes render flat under "Quote items".

---

## Phase 9 — Regression coverage + Shaun smoke

### 9.1 New regression suites

| Suite | Tests |
|---|---|
| `test-generic-quote-flow.mjs` | Generic quote with one of each new measurement type, end-to-end |
| `test-no-area-quote.mjs` | Generic quote with components only, no areas |
| `test-multi-image-takeoff.mjs` | 3 pages, calibration, assignment modal |
| `test-takeoff-page-quota.mjs` | Quota enforcement across many pages |
| `test-takeoff-page-isolation.mjs` | Cross-company path attack refused |
| `test-trade-whitelist.mjs` | Every type × every trade allowlist combo |
| `test-collection-isolation.mjs` | Components in collection A don't leak into quotes bound to B |
| `test-roofing-not-broken.mjs` | Full existing roofing flow passes with flag ON |
| `test-bootstrap-concurrency.mjs` | 5 concurrent `ensure_company_has_collection` calls produce exactly 1 bootstrap row (Gerald M-02) |
| `test-trade-helper-imports.mjs` | Static grep — every `quote_components` mutation site imports `assertComponentCompatibleWithQuote` (Gerald M-03) |
| `test-pricing-strategies.mjs` | Each of the 5 strategies prices correctly; round-up behaviour verified at boundaries (Shaun addition) |
| `test-combined-lineal-entries.mjs` | Combine → split round-trip preserves all source data (Shaun addition) |
| `test-multi-lineal-tool.mjs` | Multi-line takeoff sums correctly and applies per-segment waste (Shaun addition) |

### 9.2 Existing suite updates

- `test-regression-matrix.mjs` — extend with at least one generic-trade scenario.
- `test-stripe-live-flow.mjs` — no changes (trade-orthogonal).

### 9.3 Shaun smoke

After all suites green: Shaun smokes both flows on dev preview with `NEXT_PUBLIC_GENERIC_TRADES_V1=true` + `GENERIC_TRADES_V1_ENABLED=true`. If clean, flip default to ON in env, merge `development → main`.

---

## Feature flag layering (recap)

| Layer | Variable | Purpose |
|---|---|---|
| Client UI | `NEXT_PUBLIC_GENERIC_TRADES_V1` (env) | Hides new dropdowns, library switcher, takeoff "need area?" prompt etc. when `false`. |
| Server actions | `GENERIC_TRADES_V1_ENABLED` (env, no `NEXT_PUBLIC_`) | Refuses requests with `trade='generic'` or `component_collection_id` set when `false`. Independent of client flag — a malicious client cannot bypass. |

Both env vars default `false` and flip together as the final phase-9 action.

A future per-company DB flag is left as an option but not built into v1. The env-level two-layer approach is sufficient for "ship in stages with flag-on smoke before public default."

---

## Risks Gerald should re-grade in round 3

0. **The three Shaun additions (multi_lineal, combined entries, pricing_strategy).** Each adds schema + UI surface. Specifically:
   - `pricing_strategy` is a new enum, NOT the killed `pricing_mode` — verify M-04's intent isn't being subverted. (Header changelog has the full disambiguation.)
   - The combined-entries `combined_from` JSONB stores user-editable data; needs validation on the server (shape, max array length) — capture as a Phase 6 build follow-up.
   - The `pricing_strategy` ↔ `measurement_type` CHECK constraint matrix is the bit most likely to need iteration. Single-strategy mistakes (e.g. allowing `per_pack_volume` on `area` components) would only surface during build.

## Risks Gerald should re-grade in round 2

1. **The phase 1 → 2 ordering.** Audit-before-schema is the right call but adds 0.5-1 day of doc work before any code lands. Worth it?
2. **NOT NULL tightening only after backfill.** Two-step migration is correct, but adds another migration file later. Acceptable overhead?
3. **`ON DELETE RESTRICT` on collection → components.** App layer offers confirmation modals + blocker checks; DB layer is the safety net. Are both required or is DB-level RESTRICT enough?
4. **Server-side trade allowlist in TS instead of DB.** TS allowlist is faster to evolve (no migration to add a trade), but a malicious or buggy server-action could bypass. Mitigation: every server-action call site has the validation inline. Worth pushing into DB CHECK or trigger?
5. **`hours_days` waste unit default `flat`.** Will this surprise existing roofing users when they create a labour component? Probably not (it's new) but worth a note.
6. **The "default trade" on companies.** Single value, no auto-pair, but it does mean a user can land on the create-quote form with "Roofing" pre-filled. If they're a generic-only company they have to manually change every time until they update company settings. Acceptable, or do we want a banner suggesting "Update your company default trade"?
7. **Multi-page takeoff: each page is a separate Storage object.** Already covered by H-05's signed-upload finaliser, but quota accounting per page (not per session) means a user with 10 pages of 20 MB each consumes 200 MB — same as a single 200 MB file. Confirm this is the model we want.
8. **The dropped `roof_area_entries` nullable rework.** Confirming Gerald's H-01 reading: `quote_roof_area_entries` should NEVER be nullable, and the no-area path is always `quote_components.quote_roof_area_id = NULL`. Phase 5's regression test should cover this explicitly.

---

## Next step after Gerald round 2

1. Gerald grades C2.
2. Any blockers raised → fix and re-issue C3.
3. No blockers → Shaun greenlights phase 1 (read-site audit).
4. Phase 1 ships as `D-read-site-audit.md` — a doc, no code.
5. Phase 2 ships as the first SQL migration, behind both flags OFF.
6. Daily updates to Shaun per phase.

End of plan v2.
