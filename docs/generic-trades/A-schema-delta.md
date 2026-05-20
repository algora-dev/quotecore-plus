# Artefact A — Schema Delta

**Purpose:** show exactly what the database needs to change to support the generic-trades expansion. No SQL yet, no migration order, no naming bike-shedding. Just the data model on a page so Shaun can read it in 5 minutes and say yes / no / wrong.

This is the foundation. Once we agree on this, every UI, every server action, every regression test follows from it. Get this right, the rest is mechanical.

**Revision history:**
- v1 (initial draft).
- v2 (post-Gerald 2026-05-19): renamed library container to `component_collections` (the legacy `component_library` table already holds component rows; "library" would collide). Removed `roof_area_entries` nullable rework — the no-area path uses existing `quote_components.quote_roof_area_id` instead. Removed library-level `trade` and `is_default`. Removed `default_component_collection_id` from companies. Kept `default_trade` on companies.
- v2.1 (post-Gerald-round-2 + Shaun additions, 2026-05-20):
  - Fixed table name: `takeoff_measurements` → `quote_takeoff_measurements` (Gerald M-01).
  - Dropped `pricing_mode` column + enum (Gerald M-04). `measurement_type` is the sole pricing driver.
  - Added `component_collections.is_bootstrap` + partial unique index for the SECURITY DEFINER bootstrap RPC (Gerald M-02).
  - Added `multi_lineal` measurement type for the polyline takeoff tool (Shaun).
  - Added `pricing_strategy` enum + `pack_price` / `pack_size` / `pack_coverage_m2` columns on `component_library` for material pricing strategies (Shaun). **Note for Gerald round-3:** `pricing_strategy` is NOT the killed `pricing_mode` — it is orthogonal to `measurement_type` (same measurement type, different purchasable-unit pattern) and has clear use cases.
  - Added `quote_component_entries.combined_from jsonb` + `is_combined boolean` for the "combine N lineal entries into total + waste" feature (Shaun).

---

## Guiding principles (v2)

1. **Roof areas stay.** They keep their table, their pitch/rafter/hip/valley fields, their existing logic. We change the *label* per-trade in the UI, not the table. A "Wall Area" on a cladding quote is a row in the same `quote_roof_areas` table.
2. **Areas were already optional in the data model.** `quote_components.quote_roof_area_id` is already nullable today. Generic no-area quotes just use that. The plan does NOT touch `quote_roof_area_entries` — that table stores width/length dimension rows for *calculating* a roof area, and area dimension entries by definition belong to an area.
3. **The components table grows columns + new enum values.** Components are the source of truth for height, depth, waste, measurement type, and pricing mode.
4. **Collections (not "libraries") become multi.** A new `component_collections` table; existing components gain a `collection_id`; collections are owned by company. **A collection has NO trade and NO `is_default` flag.** Trades and collections are independent, picked separately, never auto-paired.
5. **Quotes gain a `trade` column.** Seeded from `companies.default_trade` at quote-create time. Per-quote overridable in the new-quote form.
6. **Quotes gain a `component_collection_id`.** Initially nullable to keep flag-off quote-create paths working; tightened to NOT NULL only after every quote-create path is updated end-to-end (multi-step migration; see plan C2).
7. **Takeoff gets `takeoff_sessions` + `takeoff_pages`.** Per-page calibration. Measurements gain `page_id`.

---

## Naming choices (locked)

- The legacy `component_library` table already stores individual components. Its name is confusing (singular, but holds many rows) and was named before "library" became a generic word in product design. We do NOT rename it.
- The new container concept is called **`component_collections`** (plural, makes the multi-collection model obvious from the column name alone).
- The legacy column `quote_components.component_library_id` continues to mean "which component row." We do NOT add `quotes.component_library_id` — that name would clash. The new column on quotes is `component_collection_id`.

This deliberately avoids overloading `*_library_id` across two completely different concepts.

---

## Tables & columns — added, renamed, kept

Notation:
- `+` = new
- `~` = changed
- `=` = unchanged, listed for context

### `companies` (= mostly, + one default)

| Col | State | Notes |
|---|---|---|
| `default_trade` | + | New. `'roofing' | 'generic'` (extensible). Inherited by new quotes as the initial value of `quotes.trade`. User can override per-quote in the create-quote form. Default `'roofing'` on every company. |

We deliberately do NOT add `default_component_collection_id`. Per Shaun's spec, collections are never auto-selected on the create-quote form — the user picks manually every time.

### `quotes` (= mostly, + two new columns)

| Col | State | Notes |
|---|---|---|
| `entry_mode` | = | Unchanged. `manual / digital / blank` survives. |
| `trade` | + | New. `'roofing' | 'generic'` (extensible). Set on quote create from `companies.default_trade`, overridable in the create-quote form. Drives terminology + which measurement-types are allowed for that quote's components. |
| `component_collection_id` | + | New. FK to `component_collections`. **Phase 1: nullable.** Phase 3: tightened to NOT NULL after every quote-create path is updated to require the collection. Existing flag-off code paths still work during the transition. |
| `takeoff_canvas_url` | ~ | Deprecated. Migration leaves the column for now; new code reads from `takeoff_pages` instead. Drop in a later release. |

### `quote_roof_areas` (= unchanged table, ~ semantics)

| State | Notes |
|---|---|
| `=` | Same columns, same constraints, same logic. |
| `~` | The UI relabels to "Roof Area" / "Wall Area" / "Area" depending on `quotes.trade`. The data model is identical. |

### `quote_roof_area_entries` (= UNCHANGED)

**No changes.** This table stores width/length dimension rows used to calculate a roof area. It should remain area-bound (`quote_roof_area_id NOT NULL`) — area dimension entries belong to an area by definition. The original plan to make this nullable was incorrect; the no-area path lives elsewhere (see `quote_components` below).

### `quote_components` (= existing, ~ semantics + new helpers)

| Col | State | Notes |
|---|---|---|
| `quote_roof_area_id` | = | Already nullable today. **This is the no-area path.** Generic quotes attach components directly to the quote with `quote_roof_area_id = NULL`. Phase 2 of the implementation plan audits every read site that assumes this is non-null. |
| Everything else | = | Unchanged. |

### `quote_component_entries` (= existing, + 2 new columns for the combine feature)

Entry rows belong to a component. The relationship via `quote_component_id` is already correct.

| Col | State | Notes |
|---|---|---|
| All existing | = | Length, quantity, label, etc. |
| `combined_from` | + | **(Shaun addition.)** JSONB. Stores the source rows when a user collapses N entries into a single total-length entry. Shape: `[{length: number, waste: number, label?: string}, ...]`. NULL on normal (non-combined) rows. Enables the "Split back into individual lengths" UX. |
| `is_combined` | + | **(Shaun addition.)** Boolean default false. UI flag to render the "combined" affordance and the "Split back" action. CHECK constraint: `is_combined = false OR combined_from IS NOT NULL`. |

### `component_collections` (+ new table)

| Col | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `company_id` | uuid fk → companies | Owned by company. Scoped via RLS. |
| `name` | text | User-named: "My roofing", "My fencing", "Demo". Max 80 chars, NOT NULL. |
| `is_bootstrap` | boolean not null default false | True only for the auto-created "My Components" row per company. Partial unique index `(company_id) where is_bootstrap = true` makes duplicate bootstrap rows impossible. (Gerald M-02.) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Maintained by the existing app-wide `updated_at` trigger. |

**No `trade` column.** Trades and collections are independent.
**No `is_default` column.** Collections are never auto-selected. (The `is_bootstrap` flag is purely for the partial unique guard; it is NOT a default-pick signal.)

RLS: identical pattern to `component_library` today — scoped to `company_id`. SELECT/INSERT/UPDATE/DELETE for authenticated users in-company; service-role bypasses.

### `component_library` (= existing, + new column + extended enum)

The existing components table. Confusingly named but stays.

| Col | State | Notes |
|---|---|---|
| `id, name, company_id, ...` | = | All existing columns kept. |
| `measurement_type` | ~ | Enum extended (see below). |
| `collection_id` | + | New. FK to `component_collections`. **Phase 1: nullable.** Phase 4: tightened to NOT NULL after every company has at least one collection and every component has been migrated. Bootstrap path ensures every new company has a "My Components" collection created idempotently at signup. |
| `height_value_mm` | + | New. Used by `length_x_height` components. Stored in mm (canonical), displayed in m/ft per company setting. NULL for all other types. |
| `depth_value_mm` | + | New. Used by `volume` components. Stored in mm. NULL for all other types. |
| `waste_unit` | + | New. `'percent' | 'flat'`. Default `'percent'` for most types. For `hours_days` components the default is `'flat'` (= "extra hours/days per line") because a percentage of labour hours is not a natural mental model for users. |
| `pricing_strategy` | + | **(Shaun addition.)** New. Drives how the pricing engine computes material cost. Values: `per_unit` (default — current behaviour, no breaking change), `per_pack_length` (e.g. cable in 20m rolls), `per_pack_area` (e.g. underlay in 50 m² rolls), `per_pack_coverage` (e.g. paint in 20L buckets that cover 50 m²), `per_pack_volume` (e.g. concrete in 5 m³ units). Orthogonal to `measurement_type` — a single `area` component could be priced `per_unit` OR `per_pack_area` OR `per_pack_coverage` depending on how the user buys it. **Not to be confused with the killed `pricing_mode` column (Gerald M-04).** |
| `pack_price` | + | **(Shaun addition.)** Numeric. Price per pack/roll/bucket/unit. NULL for `per_unit` strategy. |
| `pack_size` | + | **(Shaun addition.)** Numeric. Pack size in m (`per_pack_length`), m² (`per_pack_area`), m³ (`per_pack_volume`), or display quantity like 20 (litres) for `per_pack_coverage`. NULL for `per_unit`. |
| `pack_coverage_m2` | + | **(Shaun addition.)** Numeric. Coverage in m² per pack — only used by `per_pack_coverage` (paint-style: pack quantity ≠ area covered). NULL otherwise. |

Constraint additions:
- `height_value_mm` NOT NULL when `measurement_type = 'length_x_height'`, NULL otherwise.
- `depth_value_mm` NOT NULL when `measurement_type = 'volume'`, NULL otherwise.
- `pricing_strategy` ↔ `measurement_type` compatibility matrix enforced by CHECK (see `C2-implementation-plan.md` Phase 2.4 for the full matrix). Pack columns nullable-in-lockstep with strategy.

### `takeoff_sessions` (+ new table — minimal for v1)

| Col | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `quote_id` | uuid fk → quotes | One session per quote for v1. (Future: many; this table is the seam.) |
| `created_at` | timestamptz | |

For v1: one session per quote, created lazily on first takeoff page upload by a deterministic helper (NOT a side effect of quote creation).

### `takeoff_pages` (+ new table — the multi-image core)

| Col | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `session_id` | uuid fk → takeoff_sessions | |
| `quote_id` | uuid fk → quotes | Denormalised for RLS + fast querying. |
| `image_storage_path` | text | Path inside QUOTE-DOCUMENTS. Each page is its own file, uploaded via the existing signed-upload-URL finaliser (H-05 contract) so storage-quota accounting is correct. |
| `page_order` | int | User-controlled ordering. 1, 2, 3... |
| `page_name` | text | User-editable label ("Site plan", "North elevation"). Optional. |
| `scale_calibration` | jsonb | Per-page scale calibration. Today this lives on the quote; now it's per page. |
| `pan_zoom_state` | jsonb | Last viewport state for resume-where-you-left-off. Optional. |
| `created_at` | timestamptz | |

### `quote_takeoff_measurements` (= existing, + new columns)

(Real table name in the repo is `quote_takeoff_measurements` — Gerald M-01 correction.)

| Col | State | Notes |
|---|---|---|
| All existing | = | geometry, value, unit, component_id, area_id, etc. The existing `points` JSONB column already stores vertex arrays; the new `multi_lineal` measurement type reuses it as an open polyline. |
| `page_id` | + | New FK → `takeoff_pages`. Required for new rows. Migration: existing measurements assigned to the first (and only) page created for the quote. `save_takeoff_atomic` updated in Phase 7 to write this field. |
| `area_id` | = | Stays. The "which area this measurement contributes to" link. Nullable when the component is non-area-based (lineal, count etc.). |
| `unassigned` | + | New boolean. True when the user drew a measurement but hasn't picked a component yet (the "draft measurements" case). Unassigned measurements do NOT contribute to quote totals. |

---

## Enum additions

### `measurement_type` enum (extend)

Existing (live in DB as of 2026-05-20): `area`, `linear`, `quantity`, `fixed`, `lineal`. The `linear` and `quantity` values are legacy carry-overs from patch_006/008; new code reads/writes `lineal`. There are NO `rafter` / `valley_hip` measurement types — those are values of the separate `pitch_type` enum (`none|rafter|valley_hip`). The pricing engine applies them as pitch FACTORS on top of an `area`/`lineal` measurement.

Add: `length_x_height`, `volume`, `hours_days`, `count`, `curved_line`, `irregular_area`, **`multi_lineal`** (Shaun addition — the polyline tool that sums N segments into one length).

**Correction (pre-apply, 2026-05-20):** earlier v2/v2.1 drafts of this doc claimed `rafter`/`valley_hip` were measurement types. They are not. Discovered when verifying live enum state before applying the Phase 2 migration. The dark-schema CHECK was corrected before SQL apply.

### ~~`pricing_mode` enum~~ — DROPPED in v2.1 (Gerald M-04)

Killed before v1 ship. Adds a column whose only legitimate value is `= measurement_type` until a use case justifies divergence. If/when a real divergence emerges, add it then as a backward-compatible column.

### `pricing_strategy` enum (new — Shaun addition)

`per_unit`, `per_pack_length`, `per_pack_area`, `per_pack_coverage`, `per_pack_volume`.

**Not the same as the killed `pricing_mode`.** This is orthogonal to `measurement_type`: same measurement type, different purchasable-unit pattern (e.g. an `area` component priced `per_pack_coverage` for paint vs `per_pack_area` for underlay vs `per_unit` for a tile). See `C2-implementation-plan.md` Phase 6.5 for the strategy table and cost formulas.

### `waste_unit` enum (new)

`percent`, `flat`

### `trade` enum (new)

`roofing`, `generic` for v1. Adding `fencing`, `cladding`, etc. later is a one-line `ALTER TYPE` plus a label entry in `app/lib/trades/labels.ts`.

---

## What stops existing things from breaking

1. **Every new column is nullable OR has a sensible default.** No existing row needs hand-writing.
2. **`quote_roof_areas` is unchanged.** Existing roofing logic keeps reading and writing exactly as before.
3. **`quote_roof_area_entries` is unchanged.** No nullable rework.
4. **`measurement_type` enum is extended, not replaced.** Roofing components keep their values.
5. **`quotes.component_collection_id` is nullable in phase 1.** Flag-off `create_quote_atomic` paths keep working until the RPC is updated end-to-end in phase 3.
6. **`component_library.collection_id` is nullable in phase 1.** Components without a collection still exist; the bootstrap path attaches them to a default collection per company before the column is tightened.

---

## What's deliberately NOT in scope

- **Section concept.** There are areas (optional, named per-trade) and components (with optional extras). No section table.
- **Multi-session takeoff.** `takeoff_sessions` exists as a one-row-per-quote table to leave the door open, but the UI exposes one session.
- **AI authorship metadata.** No `created_by_agent` columns. The brief explicitly defers AI integration.
- **Per-trade overrides on existing components.** A "Roof underlay" component will keep working untouched.
- **Templates / cloning sections between quotes.** Parked.

---

## Open questions

None on the schema itself. Two product questions answered post-Gerald:

1. **Waste UI default for `hours_days` components**: `flat` (extra hours/days per line). Users don't naturally think in "% waste on labour."
2. **Naming the bootstrap collection on company signup**: "My Components". Boring but unambiguous.

---

## Sign-off

If Shaun says yes to this artefact (v2), the schema is locked. The migrations follow phase order in `C2-implementation-plan.md`.
