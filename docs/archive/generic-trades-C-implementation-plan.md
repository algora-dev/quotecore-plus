# Generic Trades Expansion — Implementation Plan

**For:** Gerald (security/architecture audit) — please review before any code ships.
**Author:** Gavin (QuoteCore+ agent)
**Status:** Draft 1, awaiting Gerald's first pass.
**Scope source:** `A-schema-delta.md` (data model) + `B-ux-walkthrough.md` (user journeys) in the same folder. This document is the bridge between those two and the actual code work.

---

## TL;DR

QuoteCore+ today is a roofing-first quoting + digital takeoff app. We are generalising it so it can be used for any trade while leaving the existing roofing workflow intact. Two product axes get added — `trade` (controls naming + which measurement types are offered) and `component_library_id` (controls which components are available). The two axes are **fully independent**; a library is not bound to a trade and never auto-selects.

The plan ships in 6 phases over an estimated 7-9 working days, each phase guarded by a feature flag so master can stay deployable at any commit. There are no destructive migrations because the launch wipes existing user data; we therefore design migrations for *new* data correctness, not legacy back-compat.

---

## Guiding constraints (from Shaun)

1. **Do not break roofing.** Existing roofing flow is the default and must keep working through every phase.
2. **Libraries and trades are independent.** A library carries no trade. A quote picks both, separately. User can pair "Library 3" with "Trade 5" if they want.
3. **No defaults on libraries.** No `is_default` flag, no `default_library_id` on companies, no auto-pick on create-quote. User selects manually each time.
4. **Trade controls language and gates.** "Roof Areas" vs "Wall Areas" vs "Areas" is a trade-driven UI label. Whether the takeoff prompts for an area at all is trade-driven.
5. **Digital takeoff stops forcing area creation.** Even in roofing trade, after calibration, ask the user if they need an area. Yes → existing modal. No → straight to tools.
6. **Wipe at launch — no migration of existing customer data.** The migrations need to be correct for *fresh* installs; legacy mapping is out of scope.
7. **Section concept does not exist.** Areas and components, that's it.
8. **One takeoff session per quote, many pages per session.** Multi-session is deliberately deferred.
9. **Customer quote editor stays the final override layer.** Unchanged behaviour.
10. **Ship behind a feature flag in phases.** No big-bang merge.

---

## Phase 0 — Decisions still needed (before any code)

| # | Question | Suggested answer | Need Shaun? |
|---|---|---|---|
| 0.1 | Waste default for `hours_days` components | `percent` (consistent with all other types) | Yes |
| 0.2 | Initial trades shipped | `roofing` and `generic` only — no `fencing` / `cladding` enum values yet | Yes |
| 0.3 | Initial measurement types ON ROOFING library when creating a component | Existing four (`area`, `lineal`, `rafter`, `valley_hip`) only — do NOT show the new types on roofing libraries by default | Yes |
| 0.4 | Initial measurement types ON GENERIC library | All 11 (existing four + the seven new) | Default; flag if disagree |
| 0.5 | "Need an area?" prompt copy in digital takeoff | "Do you want to measure an area first?" with `Yes` / `No, skip` buttons | Default; flag if disagree |
| 0.6 | Feature flag name | `NEXT_PUBLIC_GENERIC_TRADES_V1` — env var, gates every new UI surface; falls back to current roofing-only behaviour when off | Default; flag if disagree |

**Gerald's input requested:** Question 0.6 in particular — is an env-var feature flag appropriate, or should this live in a database row so it can be toggled per-company without redeploy?

---

## Phase 1 — Foundation (data model)

**Goal:** add every new table and column. No UI changes. No behavioural changes. Everything is dark.

### 1.1 New tables

- `component_libraries(id, company_id, name, created_at)` — note: **no trade column, no is_default column**. Libraries are pure containers; the trade dimension lives elsewhere.
- `takeoff_sessions(id, quote_id, created_at)` — one row per quote, created lazily on first page upload.
- `takeoff_pages(id, session_id, quote_id, image_storage_path, page_order, page_name, scale_calibration jsonb, pan_zoom_state jsonb, created_at)`.

### 1.2 New columns

- `quotes`
  - `trade text not null default 'roofing'` (CHECK constraint: enum-style validation against an allowlist)
  - `component_library_id uuid not null references component_libraries(id)` — note: NOT NULL because every quote must pick a library at creation
  - Question for Gerald: should `component_library_id` be NOT NULL or NULL? Risk if NULL: stale quotes after a library is deleted. Risk if NOT NULL: every test/seed/script that creates a quote needs a library first. **Lean: NOT NULL with `ON DELETE RESTRICT`.** Forces user to migrate quotes off a library before deletion; safer.
- `component_library` (existing components table — confusingly singular)
  - `library_id uuid not null references component_libraries(id) on delete cascade` (every component lives in exactly one library)
  - `height_value_mm integer null` — populated only when `measurement_type = 'length_x_height'`
  - `depth_value_mm integer null` — populated only when `measurement_type = 'volume'`
  - `waste_unit text not null default 'percent'` (CHECK: `'percent' | 'flat'`)
- `roof_area_entries`
  - `area_id` becomes nullable (was NOT NULL) — required so generic quotes can attach components directly to the quote
  - `quote_id uuid not null` — denormalised because the chain `entry → area → quote` is now optional
- `takeoff_measurements`
  - `page_id uuid not null references takeoff_pages(id) on delete cascade` — every measurement belongs to a page

### 1.3 Enum extensions

- `measurement_type` adds: `length_x_height`, `volume`, `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area`. (Old values `area`, `lineal`, `rafter`, `valley_hip` retained.)

### 1.4 RLS

Every new table follows the existing `(SELECT company_id FROM users WHERE id = auth.uid())` pattern. Service role bypasses, authenticated reads/writes scoped to the company. C-01 column-level lockdown pattern not needed on these tables — none of their columns are billing-sensitive.

### 1.5 Constraint validation

- `CHECK (measurement_type <> 'length_x_height' OR height_value_mm IS NOT NULL)`
- `CHECK (measurement_type <> 'volume' OR depth_value_mm IS NOT NULL)`
- `CHECK (height_value_mm IS NULL OR measurement_type = 'length_x_height')`
- `CHECK (depth_value_mm IS NULL OR measurement_type = 'volume')`

### 1.6 Indexes

- `component_libraries (company_id)` — list libraries per company
- `takeoff_pages (session_id, page_order)` — ordered fetch
- `takeoff_measurements (page_id)` — per-page lookup
- `roof_area_entries (quote_id)` — new query path now that area_id is optional

### 1.7 Migration safety

- Phase 1 ships behind `NEXT_PUBLIC_GENERIC_TRADES_V1=false`. The new columns exist but no code reads them.
- Existing seed scripts / regression suites continue to create roofing quotes with `trade='roofing'` (default).
- Build a smoke regression that confirms: with the flag OFF, every existing happy path (create quote → digital takeoff → confirm → customer quote editor) still passes.

**Gerald asks for:**
- Is `roof_area_entries.area_id` being nullable a risk we haven't surfaced? (My audit so far suggests ~12 read sites assume the join is present; the cleanup work is in phase 2 of this plan.)
- Should the `component_libraries` SELECT policy include a "show libraries with at least one component" filter to hide empties? My instinct: no — the user owns the library lifecycle and an empty library is a valid intermediate state.

---

## Phase 2 — Read-site audit and decoupling

**Goal:** make sure every existing read site can cope with `area_id IS NULL` on `roof_area_entries`, and every write site stamps `quote_id` on the entry row (since the chain via area is now optional).

This phase is unglamorous but critical. It's done with the flag OFF so behaviour doesn't change.

### 2.1 Static audit

Grep every TS/SQL site touching `roof_area_entries` or its select shape. Classify each as:
- **Read-only**: does it tolerate `area_id=NULL`? If yes, no change. If no, add a fallback path or a guard.
- **Write**: does it stamp `quote_id` on new rows? If no, add it.
- **Aggregation**: does it group by `area_id`? If yes, decide how to display "quote-level" (no area) entries.

Expected affected files: ~15. List will be in a follow-up PR description; tracked here for Gerald visibility.

### 2.2 Server actions

`createComponentEntry` and friends need to accept an optional `area_id` and stamp `quote_id` from the caller's context.

### 2.3 Pricing engine

`app/lib/pricing/engine.ts` already iterates entries; needs to handle entries with no area (no pitch multiplier, no waste-by-area). Confirm by reading the engine and writing a unit test for the no-area case.

### 2.4 Regression coverage

Add `scripts/test-no-area-quote.mjs`:
- Create a quote with `trade='generic'`
- Attach a `lineal` component directly to the quote (no area)
- Confirm the customer quote editor sees the line correctly
- Confirm the total is correct

---

## Phase 3 — Create-quote form changes

**Goal:** the new create-quote form. Two new required dropdowns: Trade + Library. **No defaults selected.** User must pick both before submitting.

### 3.1 Form

- **Trade**: dropdown of trades the user has enabled. v1 ships with `Roofing` and `Generic`. Unselected by default (placeholder: "Pick a trade").
- **Component library**: dropdown of libraries the company owns. Unselected by default. If the company has zero libraries, the form shows a "Create your first library" inline link to the components page instead of the dropdown.
- All other fields unchanged.

### 3.2 Library management page

`/{slug}/components` gets a library switcher at the top:
- Dropdown of all libraries the company owns
- `+ Create library` button → modal: just a name field. No trade. No is_default.
- `Edit / Delete library` actions when a library is selected (delete is allowed only if no quotes reference the library; otherwise show an error with the quotes that block it)

### 3.3 Server actions

- `createComponentLibrary(name)` — creates a library scoped to the calling company.
- `deleteComponentLibrary(id)` — refuses if `quotes.component_library_id` references this library. Cascades to delete all components in the library only on a separate "Are you sure?" confirmation.
- `updateComponentLibrary(id, { name })` — rename.

### 3.4 Trade column on quote inserts

Every code path that creates a quote (`createBlankQuote`, `createQuote`, `cloneQuote`, the digital-takeoff create path) needs to accept `trade` and `component_library_id`.

### 3.5 Flag gating

When `NEXT_PUBLIC_GENERIC_TRADES_V1=false`:
- The form's two new dropdowns are hidden
- Backend defaults `trade='roofing'` and reads the company's first library (or creates a "My Components" library on the fly the first time a user creates a quote, to bootstrap)

This keeps the existing roofing flow alive while we phase the new UI in.

**Gerald asks for:**
- Is the "create library on the fly" bootstrap acceptable for the flag-off path? Alternative: ship phase 3 with a one-time seed that adds a "My Components" library to every existing company before the flag is even flipped. Cleaner but ships dark code.

---

## Phase 4 — Component creator with new measurement types

**Goal:** the new component-creation UI in `/{slug}/components`. Trade-aware filtering of measurement types is library-INDEPENDENT — the page's trade filter is a separate dropdown.

Wait — re-reading Shaun's correction: trades and libraries are independent. So **what controls which measurement types appear in the component creator?** Three options:

1. **Component itself carries no trade.** All measurement types are always shown when creating a component. (Simplest.)
2. **The library has a trade filter the user sets at library creation.** (Contradicts Shaun's independence rule.)
3. **The component-creation modal has a trade dropdown that filters measurement types.** User picks "Roofing" → sees roofing-only types. User picks "Generic" → sees all 11. (Most flexible but adds a step.)

**My recommendation:** option 1. Every measurement type is available when creating any component. The trade filtering happens at the *quote level* (trade selected on the quote determines which components are usable, based on a stored `measurement_type` whitelist per trade). This keeps libraries truly trade-agnostic and matches Shaun's stated mental model.

This means:
- The component creator shows all 11 measurement types regardless of library or company.
- The component-add-to-quote picker filters by the quote's trade's allowed measurement_type set.
- Allowed sets per trade live in `app/lib/trades/measurement-type-whitelist.ts` — a simple config file we can edit without migrations.

**Gerald asks for:** is option 1 a defensible choice, or do we end up with a UX mess where users add a `volume` component to a roofing quote and discover they can't use it? My mitigation: when adding components to a quote, components incompatible with the quote's trade are **shown but disabled** with a tooltip explaining why.

### 4.1 Form fields (from artefact B, simplified)

- Name
- Measurement type — all 11
- Height (if `length_x_height`) — in metres, stored as mm
- Depth (if `volume`) — in metres, stored as mm
- Unit (if `hours_days`) — `hours` / `days`
- Material cost / labour cost — existing
- Waste — unit `percent | flat`, value number
- Notes / description / category — existing

### 4.2 Existing roofing components keep working

The current four roofing types stay first-class. No UI changes for existing roofing customers (we're wiping at launch but the schema honours them).

---

## Phase 5 — Digital takeoff overhaul

**Goal:** the new takeoff experience — "need an area?" prompt, multi-image, page switcher.

### 5.1 Calibration → area gate

After scale calibration:
- New modal: **"Do you want to measure an area first?"** (Yes / No, skip).
- Yes → existing area-creation modal (unchanged for roofing).
- No → close modal, show drawing tools immediately. User can still add areas later if they want, via a button on the toolbar.

### 5.2 Multi-page

- "Upload another image" button visible whenever ≥1 page exists.
- Clicking it shows the **assignment prompt** (the modal Shaun described):
  - "Add new measurements to which area?" with options: existing areas (radio list), "Create new area" (with text field for name), and (only if no areas exist yet) "No area".
  - If the previous page had multiple areas, the **first area created** is the default selection (per Shaun's confirmation).
- Each page gets its own calibration on upload.
- A page switcher (thumbnails or numbered tabs) lives above the canvas. Switching reveals that page's drawings + scale.

### 5.3 Page management

- User can rename a page.
- User can reorder pages by drag (consistent with the section reorder UX you previewed for the customer quote editor).
- Deleting a page is allowed; the modal warns about which measurements will be deleted with it.

### 5.4 Re-opening a saved quote

The quote builder header gets a new affordance: **"Add takeoff page"**. Opens the takeoff canvas in add-page mode (skipping the empty-state upload screen) and shows the assignment modal first.

### 5.5 Tools per measurement type

- `area` / `irregular_area` — polygon tool (4+ points)
- `lineal` / `length_x_height` — polyline tool (2+ points)
- `curved_line` — multi-point polyline (Shaun's preferred MVP — no bezier maths)
- `volume` — polygon tool, depth comes from the component
- `count` — single click per item
- `hours_days` / `fixed` — no drawing tool, just a "manual entry" panel (no takeoff drawing)

The tool is auto-selected when the user picks a component; the canvas swaps to the right mode.

---

## Phase 6 — Trade-aware UI everywhere else

**Goal:** the final layer of polish — wording, labels, and trade-specific toggles in the quote builder and customer quote editor.

### 6.1 Quote builder

- "Roof Areas" → relabel to `Areas` (generic) or trade-specific name. Stored in `app/lib/trades/labels.ts`.
- "Add Area" form simplified for non-roofing trades (no pitch, no rafter calc fields).
- Component picker filters by the trade's measurement-type whitelist (per phase 4 above).

### 6.2 Customer quote editor

- No trade-aware language changes here — the editor is the "final layer" Shaun confirmed stays unchanged.
- Lines from no-area quotes render under a "Quote items" heading (no area grouping).

### 6.3 Settings page

- Company default trade — selector. Currently no default-trade in company settings.
- Trade enable/disable — for v1, all enabled by default.

### 6.4 Trade labels config

`app/lib/trades/labels.ts` exports per-trade copy:
```ts
{
  roofing: { areaLabel: 'Roof Areas', addAreaCta: 'Add Roof Area', skipAreaCta: '...' },
  generic: { areaLabel: 'Areas', addAreaCta: 'Add Area', skipAreaCta: '...' },
}
```
One file change to add a future trade ("fencing", "cladding") + an enum migration to add the trade value.

---

## Phase 7 — Regression coverage

**Goal:** lock the new behaviour in with permanent tests.

### 7.1 New regression suites

- `scripts/test-generic-quote-flow.mjs` — create generic quote, attach 5 components covering each new measurement type, confirm totals.
- `scripts/test-no-area-quote.mjs` — generic quote with components only, no areas (from phase 2).
- `scripts/test-multi-image-takeoff.mjs` — create quote, upload 3 images, calibrate each, measure on each, confirm assignment to first-area-by-default and to user-picked area.
- `scripts/test-trade-whitelist.mjs` — component with `volume` measurement type cannot be added to a roofing quote (or is shown disabled).
- `scripts/test-library-isolation.mjs` — components in library A do not leak into a quote bound to library B.
- `scripts/test-roofing-not-broken.mjs` — full existing roofing flow continues to pass with the flag ON.

Each suite follows the existing pattern (setup → assert → teardown), runs from `node scripts/test-*.mjs`.

### 7.2 Update existing suites

- `test-regression-matrix.mjs` — extend to cover at least one generic quote.

---

## Branching, flagging, deployment

- All work in `development`. No long-lived feature branch.
- Feature flag: `NEXT_PUBLIC_GENERIC_TRADES_V1`. Default `false` until phase 7 ships.
- Per phase, one or more PRs, each pushed to `development`, each green on build + regression suites.
- After phase 7 lands, Shaun smoke-tests with flag ON.
- Once Shaun signs off, the flag flips to default `true` in env config, plus we merge `development → main`.
- We can ship phases 1 and 2 (data model + decoupling) silently before announcing anything — they're invisible.

---

## Risks Gerald should focus on

1. **`roof_area_entries.area_id` becoming nullable.** The biggest single-line change. Surface every aggregation site that assumes the join.
2. **`component_library_id` NOT NULL on quotes.** If we get this wrong, every quote-create path needs updating in lockstep with the schema. A two-step migration (add NULL, backfill, then add NOT NULL) is safer.
3. **The "trade dictates allowed measurement types" config file in TS.** This works for trusted code paths but server actions that accept user input must validate the same whitelist server-side. We can't trust the client to enforce trade compatibility.
4. **Multi-image takeoff storage cost.** Each page is its own image file in QUOTE-DOCUMENTS. Storage quota gates apply per-file via the existing signed-upload flow; but the per-page quota check is implicit. Confirm we don't accidentally let a user upload 50× pages on a starter plan with a 200 MB quota.
5. **The "create library on the fly" bootstrap path in phase 3.** Dark code in production. Suggest replacing with an explicit seed migration once Gerald reviews.
6. **Cascade deletes on `component_libraries.delete → components`.** If a user accidentally deletes a library, every component goes with it. Mitigation: the UI has a confirmation modal AND the action refuses if any quote references the library. Both are application-level guards; the DB-level cascade is the safety net.

---

## Estimated effort

| Phase | Effort | Notes |
|---|---|---|
| 0 — decisions | 30 min | Shaun + Gerald |
| 1 — data model | 1 day | Tables, columns, RLS, indexes, constraints |
| 2 — read-site audit | 1-1.5 days | The hidden cost; could expand if there are unknown roof_area_entries assumptions |
| 3 — create-quote form | 1 day | Form + library mgmt + bootstrap |
| 4 — component creator | 1 day | New measurement-type fields, whitelist config |
| 5 — digital takeoff | 2-3 days | Multi-image + assignment modal + page switcher |
| 6 — trade-aware UI | 0.5-1 day | Labels + builder filter + settings |
| 7 — regression | 1 day | New suites + extending matrix |
| **Total** | **8-10 days** | Plus Gerald review + Shaun smoke tests |

---

## What Gerald should check / improve

1. Phase 1 schema choices — anything missing? Anything over-engineered? Should we add a `trade` column to `companies` despite Shaun saying no defaults on libraries (since trade and library are now independent, a default trade on company is still useful)?
2. RLS patterns on the new tables — anything weaker than the C-01/C-02 standard we set during the audit?
3. The "library is just a container, no trade attached" choice. Is there a security or correctness risk we've missed?
4. The `roof_area_entries.area_id` nullable change. Worth pulling forward into a separate PR with its own audit?
5. Feature flag mechanism — env var vs DB row.
6. The 6 risks enumerated above.
7. Any concept the brief introduces that doesn't appear in this plan? (Curved Line, Irregular Area — both are tooling concerns, not schema; they're covered in phase 5 but the schema treats them like any other measurement type.)

---

## Next step after Gerald

1. Gerald sends back his pass with corrections / additions.
2. Shaun reads any decisions Gerald flags as needing his input.
3. Gavin produces the phase 1 migration (SQL + regression) for review before applying.
4. Phases ship in order with daily updates back to Shaun.

End of plan.
