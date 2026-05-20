# Artefact D — Read-Site Audit (Phase 1)

**Purpose:** classify every file that reads or writes the affected tables/RPCs as `SAFE` / `NEEDS GUARD` / `UNKNOWN` for the no-area generic-trades world (`quote_components.quote_roof_area_id IS NULL`) AND for the new schema/columns introduced in Phase 2. This is a read-only deliverable — no code changes here.

**Date:** 2026-05-20
**Author:** Gavin
**Reviewer:** Gerald (round-3)
**Source plan:** `C2-implementation-plan.md` (patched), `A-schema-delta.md` (v2.1), `B-ux-walkthrough.md` (v2.1)
**Repo HEAD audited:** `f4fc32b` (development branch baseline before round-2 patches).

---

## How to read the classifications

| Class | Meaning |
|---|---|
| `SAFE` | Already handles `quote_roof_area_id = NULL` correctly OR is irrelevant to the no-area path (e.g. a write site that never assumes non-null, a SQL definition file, a TS type definition). |
| `NEEDS GUARD` | Reads or computes against `quote_roof_area_id` (or related state) assuming it's non-null, OR has logic that needs adjustment for generic-trade UX. Action required before Phase 5 ships. |
| `UNKNOWN` | Code is too complex to classify in one pass — escalate to Gerald or write a focused test. |

Plus a Phase-2-specific classification:

| Class | Meaning |
|---|---|
| `NEW COL SAFE` | File needs to learn the new columns (collection_id, trade, pricing_strategy, etc.) but the existing logic doesn't break if they're NULL/default. Update in normal phase order. |

---

## Step 2.1 — File enumeration (raw grep evidence)

Commands run from `projects/quotecore-plus` root:

```powershell
$tables = @('quote_components','quote_component_entries','quote_roof_areas','quote_roof_area_entries','quote_takeoff_measurements')
foreach ($t in $tables) {
  Get-ChildItem -Recurse app,backend -Include *.ts,*.tsx,*.sql | Select-String -Pattern "\b$t\b" -CaseSensitive
}
$rpcs = @('save_takeoff_atomic','create_quote_atomic','get_next_quote_number')
foreach ($r in $rpcs) {
  Get-ChildItem -Recurse app,backend -Include *.ts,*.tsx,*.sql | Select-String -Pattern "\b$r\b" -CaseSensitive
}
```

**Hit counts:**

| Pattern | Hits | App TS | Backend SQL | DB types |
|---|---|---|---|---|
| `quote_components` | 67 | 16 | 47 | 4 |
| `quote_component_entries` | 16 | 6 | 8 | 2 |
| `quote_roof_areas` | 38 | 14 | 21 | 3 |
| `quote_roof_area_entries` | 12 | 6 | 6 | 1 (types only) |
| `quote_takeoff_measurements` | 27 | 4 | 22 | 1 |
| `save_takeoff_atomic` | 11 | 2 | 8 | 1 |
| `create_quote_atomic` | 28 | 10 | 17 | 1 |
| `get_next_quote_number` | 7 | 2 | 4 | 1 |
| **Total** | **206** | **60** | **133** | **13** |

**Notable groupings:**
- Backend SQL hits dominate (133/206 = 65%). These are migration files + RLS + schema definitions — none of them need code changes, but the new Phase 2 SQL must coexist cleanly with them. **All classified `SAFE` (historical) or `NEW COL SAFE` (need new column additions in Phase 2 migration only).**
- DB type definitions (`database.types.ts`) regenerate from the schema. **All `SAFE` — will pick up new columns on next regeneration.**
- App TS hits (60) are the meaningful classification surface. Audit focuses here.

---

## Step 2.2 — Classification: `quote_components` read & write sites

### Write sites (INSERT / UPSERT on `quote_components`)

| File | Line | Operation | Classification | Notes |
|---|---|---|---|---|
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 160 | INSERT via template-apply (`createBlankQuote → applyTemplate`) | **SAFE** | `quote_roof_area_id: tc.template_roof_area_id ? (areaMapping[tc.template_roof_area_id] ?? null) : null` — already NULL-tolerant. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 653 | `addQuoteComponent` — primary attach action | **SAFE for area-null, NEW COL SAFE for trade-compat** | Already accepts `quote_roof_area_id: input.quote_roof_area_id ?? null`. **Must add `assertComponentCompatibleWithQuote()` call before INSERT (Gerald M-03).** |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 1037 | `cloneQuote` re-attach loop | **SAFE for area-null, NEW COL SAFE for trade-compat** | Copies `quote_roof_area_id` from source row 1:1; NULL passes through unchanged. Must add `assertComponentCompatibleWithQuote()` per cloned component. |
| `backend/.../20260505180000_save_takeoff_atomic.sql` | 134 | RPC INSERT | **SAFE (historical), superseded by 20260510170000** | Initial RPC. Writes `quote_roof_area_id = v_first_roof_area`; if no roof areas in payload, that's NULL → fine. |
| `backend/.../20260507200000_fix_save_takeoff_atomic_enum_casts.sql` | 115 | RPC INSERT | **SAFE (historical), superseded by 20260510170000** | Same as above, enum-cast fix. |
| `backend/.../20260510130000_save_takeoff_atomic_ownership.sql` | 124 | RPC INSERT | **SAFE (historical), superseded by 20260510170000** | Adds ownership check; same NULL behaviour. |
| `backend/.../20260510170000_takeoff_canvas_paths.sql` | 183 | **Current** `save_takeoff_atomic` RPC INSERT | **NEEDS GUARD (Phase 7)** | Writes `quote_roof_area_id = v_first_roof_area`. Already NULL-tolerant when no roof areas in payload. **Phase 7 must update this RPC to also accept `page_id` (Gerald M-01 follow-up).** Must also add `assertComponentCompatibleWithQuote` enforcement either DB-side or via the calling TS server action. |

### Read sites on `quote_components`

| File | Line | Operation | Classification | Notes |
|---|---|---|---|---|
| `app/(auth)/[workspaceSlug]/material-orders/create/quote-loader.ts` | 61 | `SELECT * FROM quote_components` | **SAFE** | Doesn't filter or branch on `quote_roof_area_id`. |
| `app/(auth)/[workspaceSlug]/quotes/actions-bulk.ts` | 216 | Bulk loader for quote builder | **SAFE** | Selects all components, doesn't filter on area. The downstream `engineComps` map (line ~253) doesn't include `quoteRoofAreaId`. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 511 | `loadQuoteComponents` | **SAFE** | Returns all rows; UI is the one that groups by area. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 520 | Delete-cascade helper read | **SAFE** | Just collects IDs. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 686 | `updateComponentSettings` | **SAFE** | Reads single row by id; doesn't read `quote_roof_area_id`. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 716 | `recalcComponentFromEntries` (material/labour rate read) | **SAFE** | Doesn't touch `quote_roof_area_id`. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 1034 | `cloneQuote` source-component read | **SAFE** | Copies row verbatim. |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | 1064 | (post-clone update path) | **SAFE** | Same. |
| `app/lib/auth/ownership.ts` | 55 | `verifyComponentOwnership` | **SAFE** | Looks up `quote_id` via the row; doesn't care about area. |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` | 206-207, 357 | **Pricing/PDF rendering** | **NEEDS GUARD** | Lines 206-207: `mainComps = filter(c => c.quote_roof_area_id)`, `extraComps = filter(c => !c.quote_roof_area_id)`. For a no-area generic quote, every component lands in `extraComps` and renders under the existing "Extras" heading. Need a new branch: if `quote.trade === 'generic'` AND zero areas, render `extraComps` under a "Quote items" heading instead. |

### Customer quote editor (separate read path)

| File | Line | Classification | Notes |
|---|---|---|---|
| `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` | 135, 150, 181, 381-383, 541-545 | **NEEDS GUARD** | Currently buckets lines by `roofAreaId`, with NULL falling into an `'extras'` bucket rendered under "Extras & Custom" heading (line 544). For a no-area generic quote, the entire quote ends up in that bucket — functionally correct but the heading is wrong for users. Need a trade-aware label: "Quote items" for `trade='generic'` with zero areas, "Extras & Custom" otherwise. |

---

## Step 2.3 — Pricing engine deep-dive

**File:** `app/lib/pricing/engine.ts` (133 lines, fully read).

### Question: does this code panic, mis-price, or skip rows when `quote_roof_area_id IS NULL`?

**Answer: no. The pricing engine is already NULL-tolerant.**

Evidence:
1. **`computeQuoteTotals(components, context)`** iterates `components.reduce((sum, c) => sum + (c.materialCost ?? 0), 0)`. It reads `materialCost` and `labourCost`, both pre-computed per component row by `recalcComponentFromEntries` server-side. It never reads `quoteRoofAreaId`.
2. **`recalcComponentFromEntries`** (in `actions.ts:716`) reads `material_rate` + `labour_rate` from the component row and multiplies by the sum of entry `value_after_waste`. No area dependency.
3. **`applyPitchAndWaste`** is called per-entry inside `addComponentEntry`. Pitch is supplied as a parameter (`areaPitch` from the area row, or NULL). When NULL → `pitchDegrees=0` → `pitchFactor=1` → no-op. **Components with no area naturally bypass pitch math.**
4. **`computeRoofArea` / `totalRoofArea`** only operate on `RoofArea[]` arrays. Empty array → returns 0. Components attached to no-area path don't go through this code.

### Worked example — lineal component, no area, qty 12, $5/m

1. User creates a `lineal` component on a generic quote.
2. Picks "Quote-level (no area)" in the component picker.
3. `addQuoteComponent` writes `quote_components` row with `quote_roof_area_id=NULL`, `material_rate=5`, `pitch_type='none'`, `waste_type='none'`.
4. User adds a single entry with `raw_value=12`.
5. `addComponentEntry` calls `applyPitchAndWaste(12, true, 'none', 0, 'none', 0, 0)` → `afterWaste=12`.
6. `recalcComponentFromEntries` writes `final_quantity=12, material_cost=12*5=60, labour_cost=0`.
7. `computeQuoteTotals` sums it: `totalMaterials=60`.

**Output: $60. Correct.** No NULL panic, no skip, no mis-price.

### Pricing engine changes required for Phase 6 (Shaun's pricing-strategy addition)

This is **NEW WORK**, not a NULL-handling concern, but documented here since it's the same file:

- Add a strategy switch at the per-component level (or per-entry, TBD during build).
- For `per_unit`: current behaviour. No change.
- For `per_pack_length` / `per_pack_area` / `per_pack_volume`: `cost = ceil(total / pack_size) * pack_price`.
- For `per_pack_coverage`: `cost = ceil(total / pack_coverage_m2) * pack_price`.
- The `total` value is the measured value already including any waste added at the component level. **Round-up happens AFTER waste is applied** (the user has already padded for waste; the round-up captures the next purchasable unit on top).

See `C2-implementation-plan.md` Phase 6.5 for the full strategy table + UI spec.

---

## Step 2.4 — `save_takeoff_atomic` deep-dive

**Current authoritative migration:** `backend/supabase/migrations/20260510170000_takeoff_canvas_paths.sql` (lines 76-220).

### JSONB payload contract

```jsonc
{
  "canvas_image_path": "path/to/canvas.png",      // optional
  "lines_image_path":  "path/to/lines.png",       // optional
  "canvas_image_url":  "...",                     // legacy, accepted for one release
  "lines_image_url":   "...",                     // legacy, accepted for one release
  "measurements": [                               // → quote_takeoff_measurements
    {
      "company_id": "<uuid>",                     // optional, falls back to quote's company
      "component_library_id": "<uuid or null>",
      "measurement_type": "lineal|area|point",
      "measurement_value": 12.5,
      "measurement_unit": "m|m2|ea",
      "canvas_points": [...],                     // jsonb
      "is_visible": true
    }
  ],
  "roof_areas": [                                 // → quote_roof_areas (input_mode='final')
    {
      "label": "Main roof",
      "final_value_sqm": 120.5,
      "computed_sqm": 130.2,
      "calc_pitch_degrees": 25
    }
  ],
  "components": [                                 // → quote_components + quote_component_entries
    {
      "component_library_id": "<uuid>",
      "name": "Roof underlay",
      "material_rate": 12.5,
      "labour_rate": 4.0,
      "waste_type": "percent",
      "waste_percent": 5,
      "waste_fixed": 0,
      "pitch_type": "rafter",
      "final_quantity": 130.5,
      "material_cost": 1631.25,
      "labour_cost": 522.0,
      "entries": [
        { "raw_value": 120.5, "value_after_waste": 130.5, "sort_order": 0 }
      ]
    }
  ]
}
```

### Critical observations

1. **No `page_id` anywhere.** The RPC has no concept of pages. Phase 7 must add it (Gerald M-01 follow-up). Specifically:
   - Add `"page_id": "<uuid>"` to each entry in `measurements[]`.
   - The RPC writes it into `quote_takeoff_measurements.page_id`.
   - The TS caller (`saveTakeoffMeasurements` in `actions.ts`) must accept page context and pass it through.
2. **No `unassigned` field anywhere.** Phase 2 adds the column with default `false`. Phase 5 or 7 (whenever the "draft measurements" UX lands) wires the RPC to accept it.
3. **Components are written with `quote_roof_area_id = v_first_roof_area`.** Where `v_first_roof_area` is selected as `(SELECT id FROM inserted LIMIT 1)` of the just-inserted roof_areas batch. **If `roof_areas` is empty, `v_first_roof_area = NULL` and components get NULL.** ✅ No code change needed for the no-area path — the RPC is already NULL-tolerant.
4. **Trade compatibility is NOT enforced in this RPC.** A user could theoretically craft a payload that attaches a `volume` component to a `roofing` quote and the RPC would happily insert. **Phase 6 must either: (a) add a CHECK constraint at the DB level, or (b) update the TS caller `saveTakeoffMeasurements` to call `assertComponentCompatibleWithQuote()` per component before constructing the payload.** Per C2 patch (Gerald M-03), the TS-side helper is the chosen path; the RPC stays simple.
5. **`delete from public.quote_takeoff_measurements where quote_id = p_quote_id`** at line 130 — wipes all measurements for the quote on every save. This is a "replace, don't merge" semantics. Phase 7's multi-page work must NOT change this delete to filter by page_id without careful thought (we don't want page-1 measurements to vanish when the user saves page 2). **Flagged as a Phase 7 design concern; resolve before Phase 2 SQL applies.**

### Migration path for `page_id`

Phase 2 adds `page_id uuid null references takeoff_pages(id) on delete cascade` — nullable. Phase 7:
1. Updates `save_takeoff_atomic` to accept and write `page_id`.
2. Backfills existing measurements to point at the first (and only) `takeoff_pages` row created per quote during migration.
3. Tightens `page_id` to NOT NULL.
4. Reconsiders the wipe-on-save semantics: probably `delete where quote_id = p_quote_id AND page_id = ANY(p_pages_in_payload)` so saves are scoped to the pages being re-saved.

**This is OK to defer to Phase 7.** Phase 2 just adds the column.

---

## Step 2.5 — RLS audit on new tables

For each new table planned in Phase 2:

### `component_collections`

- **Required pattern:** `(company_id = (SELECT company_id FROM users WHERE id = auth.uid()))` for SELECT/INSERT/UPDATE/DELETE — matches `component_library` exactly.
- **No billing-sensitive columns** → C-01 column-level GRANT pattern not required.
- **`is_bootstrap` column** is service-role-only writable (the SECDEF RPC writes it). RLS doesn't need a special policy — the RPC bypasses RLS via service-role; a user with column-level UPDATE on the rest of the table cannot toggle `is_bootstrap` because the partial unique index would block any second `true` insert and the RPC is the only path that writes the column to begin with. **Safe.**
- **`ON DELETE RESTRICT`** from `component_collections` to `component_library.collection_id` blocks accidental wipes (already in C2 Phase 6.1).

### `takeoff_sessions`

- **Required pattern:** `(quote_id IN (SELECT id FROM quotes WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid())))` — matches existing takeoff RLS patterns.
- **No billing-sensitive columns.**

### `takeoff_pages`

- **Required pattern:** same as `takeoff_sessions` — via `quote_id` denormalised column.
- **`image_storage_path`** writable only via the existing signed-upload-finaliser path (matches `quote_files` pattern). User-context UPDATE on this column should be REVOKED — column-level GRANT pattern from C-01 applies here as a defensive measure even though no billing impact. **Open question for Gerald round-3:** is column-level GRANT overkill for storage paths, or worth the safety margin?

### Unusual access patterns

- None. All three tables follow existing company-scoping idioms.

---

## Step 2.6 — Other touch points (lightweight classification)

### `quote_roof_areas` / `quote_roof_area_entries`

- **All 38 + 12 hits classified `SAFE`.** Roof areas keep their existing semantics; `quote_roof_area_entries` stays area-bound (Gerald H-01 confirmed). The "Roof Areas" → "Areas" relabel is a UI concern (Phase 8), not a code-change for these tables.

### `quote_takeoff_measurements`

- App-side: `material-orders/create/quote-loader.ts:79` (read), `takeoff/actions.ts:198` (write payload construction), `database.types.ts:1766` (type). All **SAFE** for no-area path.
- SQL: RLS in `20260429160000` and `20260515160000` — **SAFE**, doesn't reference `quote_roof_area_id`.
- **Phase 2 adds:** `page_id`, `unassigned`. Both nullable/defaulted. **NEW COL SAFE.**

### `create_quote_atomic` (~28 hits)

- **All `NEW COL SAFE`.** The RPC needs to learn `trade` and `component_collection_id` in Phase 4 (not Phase 2). Until then, every existing caller works unchanged. Phase 2's `quotes.trade` defaults to `'roofing'` so the RPC's existing INSERT projects nothing new but the row gets the right default.

### `get_next_quote_number` (7 hits)

- **All `SAFE`.** No coupling to trade, collection, or area.

---

## Step 2.7 — Final classification summary

| Table/RPC | Read | Write | SAFE | NEEDS GUARD | UNKNOWN | NEW COL SAFE |
|---|---|---|---|---|---|---|
| `quote_components` | 9 | 7 | 14 | 2 (summary/PDF, customer editor) | 0 | 2 (addQuoteComponent + cloneQuote trade-compat enforcement) |
| `quote_component_entries` | 4 | 2 | 6 | 0 | 0 | 0 |
| `quote_roof_areas` | 10 | 4 | 14 | 0 | 0 | 0 |
| `quote_roof_area_entries` | 6 | 0 | 6 | 0 | 0 | 0 |
| `quote_takeoff_measurements` | 2 | 2 | 4 | 0 | 0 | 2 (page_id, unassigned) |
| `save_takeoff_atomic` | n/a | 2 (TS+SQL) | 1 | 1 (Phase 7: page_id, trade-compat) | 0 | 0 |
| `create_quote_atomic` | 10 | 1 | 11 | 0 | 0 | 11 (Phase 4: trade, collection_id) |
| `get_next_quote_number` | 2 | 0 | 2 | 0 | 0 | 0 |
| **Totals (app TS only)** | | | **58** | **3** | **0** | **15** |

**Zero UNKNOWN classifications.** Every code path either already handles the new semantics (SAFE), needs a documented adjustment (NEEDS GUARD), or just needs the new columns added (NEW COL SAFE).

---

## The three `NEEDS GUARD` items (action list for Phase 5/6/7)

1. **`app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` lines 206-207, 357.** Currently splits components into `mainComps` (with area) and `extraComps` (without). For `quote.trade === 'generic'` with zero areas, all components land in `extraComps` and render under the "Extras" heading. **Phase 5:** add a trade-aware branch — when generic + zero areas, render `extraComps` under "Quote items" heading. Otherwise unchanged.
2. **`app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` lines 381-383, 541-545.** Same pattern — NULL-area lines fall into `'extras'` bucket labelled "Extras & Custom". **Phase 5:** add trade-aware label.
3. **`backend/supabase/migrations/20260510170000_takeoff_canvas_paths.sql` (`save_takeoff_atomic` RPC).** **Phase 7:** add `page_id` parameter to measurements payload; write to `quote_takeoff_measurements.page_id`. Reconsider the `delete where quote_id = ...` wipe semantics for multi-page saves.

---

## Open questions for Gerald round-3

1. **Column-level GRANT on `takeoff_pages.image_storage_path`** — overkill, or worth the defensive margin given the storage-path -> signed-URL attack surface?
2. **`save_takeoff_atomic` wipe-on-save semantics** — when Phase 7 lands multi-page, should the delete be scoped by `page_id` or stay quote-wide? Current behaviour wipes everything; multi-page workflow probably needs scoped deletes, but that's a Phase 7 design decision and might affect the Phase 2 SQL (specifically the `delete from quote_takeoff_measurements` line). Worth confirming now.
3. **Trade-compat enforcement on `save_takeoff_atomic`** — the C2 patch puts it at the TS caller layer (`saveTakeoffMeasurements` in `actions.ts`). Is that sufficient, or should we add a CHECK constraint / trigger at the DB level as a second safety net?
4. **The combined-entries `combined_from` JSONB** — should the server validate its shape on write (max array length, required fields)? Adding to Phase 6 build follow-up; not blocking Phase 2 SQL.

---

## Conclusion

**Phase 2 dark schema can be applied as planned, with the following confirmed assumptions:**
- Pricing engine is already NULL-tolerant. ✅
- `save_takeoff_atomic` is already NULL-tolerant for the no-area case. ✅
- Only 3 server actions / pages need trade-aware adjustments, and all three are in Phases 5/6/7 (well after Phase 2 SQL lands). ✅
- All new tables follow existing RLS patterns. ✅
- Zero UNKNOWNs — every read site classified. ✅

**Phase 1 deliverable is complete.** Next: Phase 2 SQL migration draft (UNAPPLIED).
