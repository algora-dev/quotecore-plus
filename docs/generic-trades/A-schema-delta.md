# Artefact A — Schema Delta

**Purpose:** show exactly what the database needs to change to support the generic-trades expansion. No SQL yet, no migration order, no naming bike-shedding. Just the data model on a page so Shaun can read it in 5 minutes and say yes / no / wrong.

This is the foundation. Once we agree on this, every UI, every server action, every regression test follows from it. Get this right, the rest is mechanical.

**Revision history:**
- v1 (initial draft).
- v2 (post-Gerald 2026-05-19): renamed library container to `component_collections` (the legacy `component_library` table already holds component rows; "library" would collide). Removed `roof_area_entries` nullable rework — the no-area path uses existing `quote_components.quote_roof_area_id` instead. Removed library-level `trade` and `is_default`. Removed `default_component_collection_id` from companies. Kept `default_trade` on companies.

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

### `quote_component_entries` (= UNCHANGED)

Entry rows belong to a component. The relationship via `quote_component_id` is already correct — no change needed.

### `component_collections` (+ new table)

| Col | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `company_id` | uuid fk → companies | Owned by company. Scoped via RLS. |
| `name` | text | User-named: "My roofing", "My fencing", "Demo". Max 80 chars, NOT NULL. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Maintained by the existing app-wide `updated_at` trigger. |

**No `trade` column.** Trades and collections are independent.
**No `is_default` column.** Collections are never auto-selected.

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
| `pricing_mode` | + | New. Mirrors `measurement_type` for v1. Stored explicitly so it can diverge later without another schema change. |

Constraint additions:
- `height_value_mm` NOT NULL when `measurement_type = 'length_x_height'`, NULL otherwise.
- `depth_value_mm` NOT NULL when `measurement_type = 'volume'`, NULL otherwise.

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

### `takeoff_measurements` (= existing, + new columns)

| Col | State | Notes |
|---|---|---|
| All existing | = | geometry, value, unit, component_id, area_id, etc. |
| `page_id` | + | New FK → `takeoff_pages`. Required for new rows. Migration: existing measurements assigned to the first (and only) page created for the quote. |
| `area_id` | = | Stays. The "which area this measurement contributes to" link. Nullable when the component is non-area-based (lineal, count etc.). |
| `unassigned` | + | New boolean. True when the user drew a measurement but hasn't picked a component yet (the "draft measurements" case). Unassigned measurements do NOT contribute to quote totals. |

---

## Enum additions

### `measurement_type` enum (extend)

Existing: `area`, `lineal`, `rafter`, `valley_hip`
Add: `length_x_height`, `volume`, `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area`

The roofing-specific values stay so existing roofing components keep working.

### `pricing_mode` enum (new)

Same set as `measurement_type` for v1. Separate enum so they can diverge later without breaking foreign keys.

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
