# Generic Trades Expansion — Implementation Plan (revision 2)

**For:** Gerald (round-2 audit) — please grade again before any code ships.
**Author:** Gavin (QuoteCore+ agent)
**Status:** Draft 2, supersedes `C-implementation-plan.md`.
**Scope:** the bridge between `A-schema-delta.md` (v2) and `B-ux-walkthrough.md` (v2). All three docs are now mutually consistent.

---

## What changed from C → C2 (Gerald's pass)

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

- `component_collections (id uuid pk, company_id uuid fk, name text not null, created_at timestamptz, updated_at timestamptz)`
- `takeoff_sessions (id uuid pk, quote_id uuid fk, created_at timestamptz)`
- `takeoff_pages (id uuid pk, session_id uuid fk, quote_id uuid fk, image_storage_path text, page_order int, page_name text, scale_calibration jsonb, pan_zoom_state jsonb, created_at timestamptz)`

### 2.2 New columns

- `companies.default_trade text not null default 'roofing'` (CHECK against trade enum)
- `quotes.trade text not null default 'roofing'` (CHECK against trade enum)
- `quotes.component_collection_id uuid null references component_collections(id) on delete restrict`
- `component_library.collection_id uuid null references component_collections(id) on delete restrict`
- `component_library.height_value_mm integer null`
- `component_library.depth_value_mm integer null`
- `component_library.waste_unit text not null default 'percent'` (CHECK: `'percent' | 'flat'`)
- `component_library.pricing_mode text` (derived from measurement_type at insert time; CHECK against enum)
- `takeoff_measurements.page_id uuid null references takeoff_pages(id) on delete cascade` (nullable for backfill; phase 7 tightens)
- `takeoff_measurements.unassigned boolean not null default false`

### 2.3 Enum extensions

- `measurement_type` add: `length_x_height`, `volume`, `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area`.
- `pricing_mode` (new enum, same values as measurement_type).
- `waste_unit` (new enum: `percent`, `flat`).
- `trade` (new enum: `roofing`, `generic`).

### 2.4 Constraints

- `CHECK (measurement_type <> 'length_x_height' OR height_value_mm IS NOT NULL)`
- `CHECK (measurement_type <> 'volume' OR depth_value_mm IS NOT NULL)`
- `CHECK (height_value_mm IS NULL OR measurement_type = 'length_x_height')`
- `CHECK (depth_value_mm IS NULL OR measurement_type = 'volume')`

### 2.5 RLS

Every new table follows `(SELECT company_id FROM users WHERE id = auth.uid())` pattern. Service-role bypasses. No billing-sensitive columns on these tables — no column-level GRANT pattern needed (C-01 doesn't apply here).

### 2.6 Indexes

- `component_collections (company_id)`
- `takeoff_pages (session_id, page_order)`
- `takeoff_measurements (page_id)`
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

Goal: deterministic helper that ensures every company has at least one collection, created idempotently.

### 3.1 Helper

`ensureCompanyHasCollection(companyId)` in `app/lib/data/company-context.ts` (or a new module):
- Service-role only (admin client).
- Idempotent. Safe to call any number of times.
- Returns the company's "default" collection (oldest one if multiple exist, named "My Components" if just bootstrapped).
- Wraps in a transaction.

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
- Iterate `quote_components`. For each row, calculate price using `component.pricing_mode` + `component.height_value_mm` + `component.depth_value_mm` as appropriate.
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
  generic: new Set(['area','lineal','rafter','valley_hip','length_x_height','volume','hours_days','count','fixed','curved_line','irregular_area']),
};
```

### 6.3 Server-side validation

Every server action that adds a component to a quote (`addQuoteComponent`, `cloneQuote` re-attachment, `applyTemplate`, takeoff measurement → component conversion) MUST:
1. Load the quote's `trade`.
2. Load the component's `measurement_type`.
3. Refuse the operation if not in `TRADE_ALLOWED_MEASUREMENT_TYPES[trade]`.

Refusal returns a structured error (`trade_incompatible`) the UI surfaces as a tooltip/toast, not a 500.

### 6.4 Client-side UI hint

Components incompatible with the current quote's trade are shown disabled in the picker with a tooltip ("This component uses `volume`, which isn't supported on roofing quotes"). Pure UX polish; the server is the source of truth.

### 6.5 Regression

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

## Phase 7 — Multi-page takeoff

Goal: takeoff supports many images per quote with per-page calibration, assignment modal, and existing signed-upload-URL finaliser flow.

### 7.1 Schema cleanup

- `takeoff_measurements.page_id` → ALTER to NOT NULL after backfill (every existing measurement assigned to the single first page created per quote during phase 2 migration).

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

### 7.6 Regression

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
