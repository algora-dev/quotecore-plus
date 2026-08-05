# Takeoff Area Fixes — Full Build Plan (2026-07-04)

**Status:** CONFIRMED by Shaun 2026-07-04. Build on GLM 5.2. Analysis was done on Fable 5.
**Against:** commit `3357ca9` on `development`.
**Test policy:** Build ALL phases first, then one full smoke test at the end (Shaun's decision).

## Shaun's locked decisions
1. **Area delete = real delete.** Deleting an area from the takeoff left panel deletes the `quote_roof_areas` row AND all associated measurements/components, after a ConfirmModal warning ("this deletes the area and all its components"). Icon changes from "×" to the trash icon (same as components). Delete must actually work in the takeoff canvas (currently only works in quote builder).
2. **Phases:** as many as needed to do it correctly; test once at the end.
3. **Area sums:** reuse the quote builder's existing Area-tab system — each drawn area measurement is its own row, all rows contribute to the SUM for the parent area. NOT one master value per area. The quote builder Area phase already supports: name an area → add multiple sub-measurements → delete individually → all sum to the area total. Use that same DB pattern for takeoff-drawn areas.

## Core architectural rules (apply to every phase)
- **The DB `quote_roof_areas` row is created at the moment the user names the area** (or auto-named for Area 1) — never deferred to save time, never created by the save RPC as a side effect.
- **`quote_roof_areas.label` is the single source of truth for area names.** Client `areaList` mirrors it. `handleSaveArea`'s client-only naming is dead.
- **Area-type measurements NEVER mint new `quote_roof_areas` rows at save time.** Every measurement (component or area) carries `quote_roof_area_id`; the RPC only updates the parent area's sum, never inserts area rows.
- **No data may exist only in client state when the user switches areas or navigates.** Auto-persist on area switch.
- **Name collection timing:** user names a NEW area after drawing it (AreaNameModal). User never re-names an EXISTING area (dropdown selection instead).

---

## Phase 1 — Layout fix
**Problem:** Canvas + toolbar render BELOW the left panel (screenshot 1).
**Work:**
- Fix the outer wrapper of TakeoffWorkstation so the `flex flex-1 overflow-hidden` container has a bounded parent height (`h-screen`/`h-full flex flex-col` chain).
- Verify all modal overlays (`upload another plan`, alerts, area modals) are `fixed inset-0 z-50` and out of document flow.
- Verify at common viewport sizes.
**Files:** `TakeoffWorkstation.tsx` (render section), possibly `TakeoffPage.tsx`/`page.tsx` wrappers.

## Phase 2 — DB-first area naming
**Problem:** Names show "Area 2" instead of "Garage" (Issues 3).
**Work:**
- Change `createNewTakeoffArea(quoteId)` → `createNewTakeoffArea(quoteId, label?)`. When `label` supplied, insert with that label directly (dedup: if label exists, append " 2", " 3"…). When omitted, keep auto "Area N". Kills the create-then-rename race.
- Fix `renameTakeoffArea`'s fragile ownership subquery (`.in('quote_id', await …)`) → direct quote→company join check. Keep it for the future inline-rename UI.
- AreaNameModal confirm handler (new-area paths): await `createNewTakeoffArea(quoteId, userName)` and only add to `areaList` with the returned id+label after success. Error → alert, don't add.
- Remove all remaining "name at save time" logic: `roofAreasPayload.label` in `actions.ts` no longer drives area creation (see Phase 4).
**Files:** `takeoff/actions.ts`, `TakeoffWorkstation.tsx` (`handleSaveArea`, `handleConfirmAreaAssignment`, auto-create effect).

## Phase 3 — Area sub-measurement rows (reuse quote builder system)
**Problem:** Area values missing/zero; wrong sum semantics (Issues 4 partial, 3-related).
**Work:**
- Inspect how the quote builder Area tab stores multiple sub-measurements per area (the "add multiple areas to an area, delete individually, sum to total" system) — identify the exact table/columns it writes (verify at build time; likely child rows keyed to `quote_roof_areas.id`).
- Route takeoff-drawn area polygons into that same structure: each drawn polygon = one sub-measurement row under its `quote_roof_area_id`, with pitch applied per current rules.
- Update/replace the `roof_areas` handling in `saveTakeoffMeasurements` + `save_takeoff_atomic` RPC: area-type measurements update sub-measurement rows + recompute the parent area SUM; RPC must NOT insert `quote_roof_areas` rows anymore. Keep old RPC behaviour behind the existing rollback-able RPC policy (new RPC version, old one kept).
- Keep `quote_takeoff_measurements` mirror rows (with `quote_roof_area_id` + `canvas_points`) for canvas reconstruction.
**Files:** `takeoff/actions.ts`, new migration (RPC update; additive, rollback-able), quote-builder area actions for reference.

## Phase 4 — Save/restore all areas (data integrity)
**Problem:** Only the active area's data is saved; switching areas orphans everything else (Issues 4, 5; "save/restore only works for Area 1").
**Work:**
- `handleSwitchArea`: before clearing state, persist the outgoing area's data (targeted save scoped to that area) — auto-save on switch. Handle failure: block the switch and alert rather than silently losing data.
- `handleSaveTakeoffCore`: on full save, flush the active area AND any dirty cached areas from `areaCanvasStatesRef` (each scoped to its own `quote_roof_area_id` + page).
- Hydration: per-area grouping already exists (`byArea` map) — verify it round-trips with the new sub-measurement rows, including areas with no measurements yet.
- Scoped delete semantics in the RPC: replace-by-area (or area+page) rather than replace-by-page-only, so saving one area cannot wipe another's rows.
**Files:** `TakeoffWorkstation.tsx`, `takeoff/actions.ts`, RPC migration (shared with Phase 3).

## Phase 5 — Area delete (takeoff canvas)
**Problem:** Delete area is client-only, wrong icon, doesn't work properly.
**Work:**
- New server action `deleteTakeoffArea(areaId)`: ownership check, delete `quote_roof_areas` row + its sub-measurement rows + its `quote_takeoff_measurements` + detach/delete its component entries, recalc quote totals (`recalcAllQuoteComponents`).
- Left panel: trash icon (Heroicons outline, matching components), opens ConfirmModal: "Delete [name]? This deletes the area and all its components and measurements." On confirm → server action → remove from `areaList`/cache → if it was active, switch to first remaining area (or auto-create Area 1 if none).
**Files:** `takeoff/actions.ts`, `TakeoffWorkstation.tsx`, existing `ConfirmModal`.

## Phase 6 — "+ New Area" flow (Shaun's Route 1)
**Problem:** No "add to existing" option; new areas mis-named (Issue 2).
**Work:** Clicking "+ New Area" opens a choice modal:
- **Option A — Add to existing area:** dropdown of existing areas (only shown if ≥1 exists). User selects → modal closes → area drawing mode armed for that area → polygon/rect close → pitch-only modal titled "Adding to: [name]" (confirm m², pitch optional, default 0) → sub-measurement row saved under selected area. No new area row. No name prompt.
- **Option B — Create new area:** modal closes → area drawing mode armed → polygon/rect close → AreaNameModal (name required, m² confirmation, pitch optional) → `createNewTakeoffArea(quoteId, name)` → new area in left panel, becomes active; subsequent components attach to it.
- If NO areas exist yet, "+ New Area" goes straight to Option B behaviour.
- Retire the old reactive `showAreaAssignmentModal` path (its job is absorbed by this flow); keep polygon-close guards for component-area drawing untouched.
**Files:** `TakeoffWorkstation.tsx`, `modals/AreaNameModal.tsx` (reuse), new small choice modal.

## Phase 7 — "Save & upload another plan" flow (Shaun's Route 2)
**Problem:** Asks for names it shouldn't, duplicates areas, no area choice (Issues 6, 8).
**Work:** Upload modal gets 2 options:
- **Option A — Add to existing area:** dropdown of existing areas (replaces "first area" hardcoding). NO name field. Flow: save all current data → upload plan → `createTakeoffPage` (page only, NO area row) → load plan → calibrate → optional area draw (skippable): if drawn → pitch-only modal → sub-measurement row under selected area; if skipped → fine. All components route to selected area. The area-assignment modal must NOT fire in this mode.
- **Option B — Create new area:** NO name field upfront. Flow: save all → upload plan → `createTakeoffPage` (page only — area row NOT created yet) → load plan → calibrate → area draw MANDATORY (blocking prompt, cannot skip) → AreaNameModal after close (name, m², pitch) → `createNewTakeoffArea(quoteId, name)` + link page to area → components attach to new area.
- `createTakeoffPageForArea` retired from this flow (or reduced to page+link helper); its area-creation side effect is what caused duplicates.
- Track page↔area link (`takeoff_pages.quote_roof_area_id`) for both options so Phase 8 can map areas to plans.
**Files:** `TakeoffWorkstation.tsx` (upload modal + `handleConfirmSaveAndUploadAnother`), `takeoff/actions.ts`.

## Phase 8 — Multi-plan display on re-entry
**Problem:** Re-entry only shows the most recent plan (Issue 7).
**Work:**
- Server: pass ALL pages (signed URLs) — `loadTakeoffHydrationData` already returns them.
- Client: each area knows its page (`takeoff_pages.quote_roof_area_id`, falling back to page 1). Clicking an area in the left panel loads that area's plan image + its saved measurements/calibration (per-page `scale_calibration` already persisted).
- Areas sharing one plan share the canvas image + calibration; switching between them only swaps measurement overlays.
- Small plan indicator (name of plan/page shown above canvas); no separate thumbnail strip needed since area click drives plan selection (matches Shaun's spec: "user selects which area, system displays the plan associated to that area").
**Files:** `TakeoffWorkstation.tsx`, `TakeoffPage.tsx`/`page.tsx`, `takeoff/actions.ts` (minor).

## Phase 9 — Cleanup + verification
- Remove dead code: old `mode=add`/`new-page` branches superseded by the unified flows, `showAreaAssignmentModal` remnants, `getFirstRoofAreaId` if unused.
- `next build` must pass; fix all type errors.
- Regenerate `database.types.ts` if migrations changed schema.
- Rewrite `docs/smoke-tests/CHECKLIST.md` with a full end-to-end test script covering: layout, Route 1 A/B, Route 2 A/B, area delete, multi-area save/restore, multi-plan re-entry, quote-builder sums (no dupes, correct names, correct SUMs).
- Data cleanup note for Shaun's test quote: the "Updated Digi Test" quote has orphaned/duplicate areas — delete them via quote builder before retesting (or I provide a one-off cleanup).

## Order & dependencies
1 (layout) → 2 (naming) → 3 (sub-measurement rows) → 4 (save-all) → 5 (delete) → 6 (Route 1) → 7 (Route 2) → 8 (multi-plan) → 9 (cleanup).
Phases 3+4 share one migration. Phases 6+7 depend on 2-4. Phase 8 depends on 7's page↔area links.

## Risk notes
- RPC change (Phase 3/4) touches the atomic save path — keep old RPC intact (rollback-able), new version alongside, per standing policy.
- `TakeoffWorkstation.tsx` is 210KB — edits must be surgical; no wholesale refactor in this pass.
- DB migrations: additive only (new RPC version, no drops). Pre-authorized to apply per standing permissions.
