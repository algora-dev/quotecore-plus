# Smoke Test Checklist — Takeoff Area Fixes (9-Phase Plan)

## Status: BUILT (round 3) — awaiting smoke test on Dev

### Build history
- `c4ee521` — 9-phase area fixes (round 1)
- `a6cf527` — 5 smoke-test-1 bug fixes (round 2)
- `1212a9c` — 2 smoke-test-2 bug fixes (round 3, current)

### Round 3 fixes (commit `1212a9c`)
1. ✅ Component deselection on "+ New Area" — clears selectedComponentId, activeAreaComponentIdRef, pendingComponentId
2. ✅ Polygon-close routing — pendingComponentId cleared by default, only set in component-area branch
3. ✅ calculatePolygonArea guard — returns 0 when calibrations empty, never NaN
4. ✅ isExistingAreaMode — no longer reset to false in handleSaveArea when adding to existing area
5. ✅ measurementsPayload guard — NaN/null/undefined coerced to 0
6. ✅ RPC INSERT guard — COALESCE(nullif(measurement_value,'')::numeric, 0)
7. ✅ Component entries guard — COALESCE on raw_value + value_after_waste
8. ✅ Left-panel display — sums all matching roofAreas by id or label

### Pre-test cleanup
- [ ] Clean up orphaned/duplicate areas on "Updated Digi Test" quote (ee9edfed)

### Pending verification
- [ ] Layout: canvas sits beside the left panel (not below it)
- [ ] No ghost "Area 1" on first entry
- [ ] "+ New Area" → "Create new" → draw polygon → name persists in left panel + DB
- [ ] "+ New Area" → "Add to existing" → draw polygon → pitch-only modal → area attaches to CORRECT area (not a component)
- [ ] "+ New Area" auto-deselects any active component before drawing
- [ ] Left-panel area total updates after drawing (shows sum of all polygons for that area)
- [ ] Area delete: trash icon → ConfirmModal → area + measurements removed
- [ ] Area switch: each area shows its own measurements + canvas state
- [ ] Re-entry: draw new area → add to existing → save → no null error
- [ ] Re-entry: "Save & upload another plan" → add to existing → no null error
- [ ] Save & upload another plan (existing): measurements route to selected area
- [ ] Save & upload another plan (new): draw polygon → name → area + measurements saved
- [ ] Multi-plan re-entry: exit → re-enter → all areas show → click area → correct plan loads
- [ ] No duplicate areas in DB after multiple saves
