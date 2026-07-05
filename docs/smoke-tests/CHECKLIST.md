# Smoke Test Checklist — Takeoff Parent/Child Plans (Round 6)

## Status: BUILT (round 6) — awaiting smoke test on Dev

### Build history
- `c4ee521` — 9-phase area fixes (round 1)
- `a6cf527` — 5 smoke-test-1 bug fixes (round 2)
- `1212a9c` — 2 smoke-test-2 bug fixes (round 3)
- `784b131` — RC-1 through RC-6 + area assignment modal removal (round 4)
- `efda453`/`aefe57c` — area ownership (draw-time stamping) + RPC repair (round 5)
- round 6 (current) — PARENT/CHILD PLANS: each named area holds multiple plans (numbered child slots), per-plan calibration, state-wipe fixes, session-version authoritative sync

### Round 6 changes (Shaun-approved Option A, 2026-07-05)
1. **Parent/child model**: each area can hold multiple plans; numbered chips (1, 2, 3…) under each area card in the left panel; click chip = view that plan's image + its drawings; components/totals stay parent-level (aggregate across plans). No DB changes — page_id + quote_roof_area_id already existed.
2. **Upload → existing area**: plan becomes a child slot of the chosen parent instantly. No second dialog, no "+ New Area" click. Calibrate + measure; everything rolls to the parent.
3. **Upload → new area**: after calibrating the new plan, area drawing mode arms AUTOMATICALLY (no "+ New Area" click). Draw boundary → name it → done.
4. **State-wipe fixes**: `loadPageImage` no longer wipes all areas' state on upload-to-existing; save no longer clears the per-area cache (both caused "Garage/Main Roof went blank"); `handleSwitchArea` no longer calls the state-wiping loader.
5. **Page-corruption fix**: cached-area flush now groups by the page each row was DRAWN on — no more re-homing other pages' drawings onto the current plan.
6. **Version fix**: after every save chain the client fetches the authoritative version from the DB (new `getTakeoffSessionVersion` action) — kills the false "Takeoff edited in another tab" error.
7. **Per-plan calibration**: each plan keeps its own scale; restored on chip/area switch; re-entry restores the ACTIVE page's calibration (not blindly page 1's).
8. Canvas redraw filters shapes by page (reconstructCanvas `belongsOnPage`) and preserves `quoteRoofAreaId` through redraws.

### Round 7 (2026-07-05 eve, commits `15aa64c`/`c39cf02`/`09c8143`) — pending verification
- [ ] Quote ee6609ab: Main Roof Valley = 17.74 m, Ridge = 13.54 m in quote builder (Plan 2 entries restored)
- [ ] Re-enter takeoff on ee6609ab: Page 1 shows the ORIGINAL plan image (not Q Area's)
- [ ] Switch to Main Roof Plan 2: NO calibration modal (inherits/restores scale)
- [ ] Upload new plan → create NEW area: component panel starts EMPTY (no stale actives)
- [ ] Measure same area on plan A, save, measure on plan B, save, re-save from plan A → plan B entries survive (component + area totals cross-page correct)
- [ ] Area duplicates still gone (regression check on 820be48c)
- [ ] Components under correct areas still (regression check on 42630e51)
- [ ] NOTE: the ~4+ m² area Shaun drew on ee6609ab Plan 2 was unrecoverable (deleted before page-scoping existed) — re-draw it on Plan 2 and confirm it persists

### Pending verification (fresh quote recommended)
- [ ] Plan 1: calibrate → draw Main Roof + components → "+ New Area" → Garage on same plan → totals/panels per area correct
- [ ] Save & Upload another plan → "Add to existing: Main Roof" → NO second dialog; calibrate; draw a component → it appears under Main Roof's parent component list
- [ ] Left panel: Main Roof now shows chips 1 and 2; clicking 1 shows plan 1 image + its drawings; clicking 2 shows the new plan + its drawings
- [ ] While on Main Roof chip 2, component list still shows ALL Main Roof components (both plans)
- [ ] Save & Upload another plan → "Create new area" → calibrate → drawing mode arms itself → draw boundary → name "Teepee" → SAVES with no "edited in another tab" error
- [ ] Click Garage / Main Roof after uploads → each shows ITS OWN plan image + drawings + components (regression: they went blank/inherited newest image)
- [ ] Save & Continue → quote builder: entries under correct areas, no duplicates, no cross-page corruption
- [ ] Re-entry: exit → re-enter → parent areas + child chips rebuilt; each chip shows right image/drawings; calibration correct per plan
- [ ] Per-area totals = sum of all polygons across that area's plans
- [ ] Same component on two areas → two line items, one per area

### Round 5 carryover (retest if touched)
- [ ] Direct Area tool click with no component → "Select a component first" alert
- [ ] "+ New Area" does NOT clear the component panel
- [ ] Drafts do NOT consume monthly quote quota (round 5b fix)

### Passed (recent)
- Round 5: RPC saves work (column-name repair verified live, single 2-arg signature)
