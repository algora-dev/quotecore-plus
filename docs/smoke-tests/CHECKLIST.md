# Smoke Test Checklist — Takeoff Area Ownership Fix (Round 5)

## Status: BUILT (round 5) — awaiting smoke test on Dev

### Build history
- `c4ee521` — 9-phase area fixes (round 1)
- `a6cf527` — 5 smoke-test-1 bug fixes (round 2)
- `1212a9c` — 2 smoke-test-2 bug fixes (round 3)
- `784b131` — RC-1 through RC-6 + area assignment modal removal (round 4)
- round 5 (current) — area OWNERSHIP fix: draw-time `quoteRoofAreaId` stamping, per-area state isolation, per-area quote_components (migration `20260705160000`)

### Round 5 fixes (spec: docs/plans/TAKEOFF-AREA-OWNERSHIP-FIX-2026-07-05.md)
1. Measurements + area polygons stamped with owning `quote_roof_area_id` at DRAW time (not save time) — creating a new area no longer re-assigns earlier work to it
2. `handleSaveArea` create-new: outgoing area's state cached + auto-saved BEFORE switching — old area no longer shows empty canvas/panel
3. Add-to-existing with a different target area: state cached + view switches to target with polygon appended
4. Pitch-only modal now shows the measured Plan Area (same as AreaNameModal)
5. Left panel per-area totals matched via draw-time stamp (sum of polygons per area)
6. Flush version-cursor fix: cached-area flushes no longer silently fail STALE_TAKEOFF_VERSION after the main save
7. Migration `20260705160000`: per-area `quote_components` — same component on two areas = two rows, one per area (matches manual quote-builder behaviour)

### Pending verification (fresh quote — old "DigiTakeoff Test" draft has corrupted assignments, delete it)
- [ ] Draw areas + components on Main Roof → "+ New Area" → create "Garage" → left panel shows Main Roof with ITS total, Garage with its own
- [ ] Click Main Roof in left panel → canvas + component panel show ONLY Main Roof's drawings/components
- [ ] Click Garage → canvas + component panel show ONLY Garage's drawings/components
- [ ] "+ New Area" → "Add to existing" → pitch-only modal SHOWS the measured area value
- [ ] Add-to-existing polygon: left panel total = SUM of that area's polygons (e.g. 58.71 + 3.71 = 62.42)
- [ ] Save & Continue → quote builder Roof Areas: Main Roof entries under Main Roof, Garage entries under Garage
- [ ] Components step: components listed under the area they were drawn on (not all under one area)
- [ ] Same component drawn on two areas → two line items, one per area, each with own entries
- [ ] Re-entry: exit takeoff → re-enter → per-area data still correct after switching areas
- [ ] Multi-page: upload second plan to existing area → first plan's entries survive (RC-6 regression check)

### Round 4 carryover (retest if touched)
- [ ] Direct Area tool click with no component → "Select a component first" alert
- [ ] "+ New Area" does NOT clear the component panel
- [ ] Area measurements show real m² values (not 0.00)
- [ ] No "Assign Area Measurement" modal appears anywhere (removed)

### Passed (recent)
- (round 4 items pending re-verification under round 5 — superseded by list above)
