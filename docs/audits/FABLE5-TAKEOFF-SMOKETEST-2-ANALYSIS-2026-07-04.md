# Fable 5 Analysis — Takeoff Smoke Test 2 Findings (2026-07-04)

**Analyst:** Fable 5 (anthropic/claude-fable-5)
**Scope:** Two bugs found during Shaun's second smoke test of commit `c4ee521` (9-phase area fixes).
**Test quote:** `ee9edfed-e44c-4472-881f-3e4857caf372` ("Updated Digi Test")

---

## Bug 1: Drawn area attaches to last selected component instead of the target area

### Symptom
When the user clicks "+ New Area" → "Add to existing area" → draws a polygon, the drawn area is added to the last selected component, not to the target roof area. This happens on first digital takeoff (creating quote via digital takeoff), not on edit/re-entry.

### Root Cause
In the polygon-close handler (line ~2589), the routing logic checks `pendingNewAreaIsExisting && pendingNewAreaTargetId` FIRST and shows the pitch-only modal. But it also checks `currentSelectedId` (from `activeAreaComponentIdRef.current ?? selectedComponentIdRef.current`) and captures it via `setPendingComponentId(currentSelectedId)` at line ~2588 — BEFORE the `pendingNewAreaIsExisting` branch.

The issue: `setPendingComponentId(currentSelectedId)` is called unconditionally for every polygon close. When a component was selected before the user clicked "+ New Area", `currentSelectedId` is non-null, so `pendingComponentId` gets set to that component's ID.

Then in `handleSaveArea` (line ~1122):
```js
const capturedComponentId = pendingComponentId;
const isComponentArea = !!capturedComponentId;
```
Since `pendingComponentId` was set to the component ID, `isComponentArea = true`, and the code enters the **component area** branch (line ~1204) instead of the **roof area** branch. The drawn polygon is attached to the component, not the roof area.

### Why the Phase 6 fix didn't catch this
The `pendingNewAreaIsExisting` check at line ~2612 sets `setPendingComponentId(null)` — but this happens AFTER `setPendingComponentId(currentSelectedId)` was already called at line ~2588. React batches state updates within the same event handler, so both `setPendingComponentId(currentSelectedId)` and `setPendingComponentId(null)` are called. The LAST call wins, so `pendingComponentId` should be `null`.

**However**, there's a subtle issue: `setPendingComponentId(null)` is only called in the `pendingNewAreaIsExisting` branch. If the code takes a different branch (e.g., the `isExistingAreaModeRef.current && !currentSelectedId` branch at line ~2636), `pendingComponentId` remains set to the component ID.

Looking at the condition order:
1. `pendingNewAreaIsExisting && pendingNewAreaTargetId` → clears pendingComponentId, shows pitch-only modal ✓
2. `!isExistingAreaModeRef.current && !currentSelectedId && !takeoffMode && areaList.length > 0 && !pendingNewAreaIsExisting` → shows area-assignment modal (doesn't clear pendingComponentId) ✗
3. `takeoffMode === 'new-page' && currentRoofAreas.length === 0 && !currentSelectedId` → clears pendingComponentId ✓
4. `isExistingAreaModeRef.current && !currentSelectedId && !pendingNewAreaIsExisting` → shows area-assignment modal (doesn't clear pendingComponentId) ✗
5. Else → shows area name modal (doesn't clear pendingComponentId) ✗

**The fix**: `setPendingComponentId(null)` must be called in ALL branches that are meant to create a roof area (not a component area). The cleanest fix is to clear `pendingComponentId` BEFORE the routing logic, and only set it in the explicit component-area branch.

### Fix Plan
1. In the polygon-close handler, move `setPendingComponentId(null)` to BEFORE the routing logic.
2. Only set `setPendingComponentId(currentSelectedId)` when the user is actually drawing a component area (i.e., when a component is selected AND the user did NOT click "+ New Area").
3. In `handleConfirmNewAreaChoice`, explicitly clear `selectedComponentId` and `activeAreaComponentIdRef` when entering area drawing mode, so no component is "active" during area drawing.

### Additional issue: display value doesn't update
When "adding to existing area", the newly drawn area polygon gets a client-side ID (`area-${Date.now()}`), but the left panel display (line ~3618) tries to match `roofAreas.find(ra => ra.name === area.label || ra.id === area.id)`. The new area's `name` is set to the existing area's label, so the `name` match should work. But the `area.area` value shown is from the `roofArea`, not summed. The display shows the individual polygon's area, not the area total.

This is a display issue — the actual sum is computed server-side from `quote_roof_area_entries`. The display should either:
- Show the sum of all `roofAreas` matching the same area label/id, or
- Not show an area value in the left panel (since it's computed server-side)

---

## Bug 2: `null value in column "measurement_value"` on save after adding to existing area

### Symptom
On re-entry (editing existing takeoff), user draws a new area to add to an existing area, clicks Save, and gets: `Failed to save takeoff: null value in column "measurement_value" of relation "quote_takeoff_measurements" violates not-null constraint`

The same error occurs when trying "Save & upload another plan" → "add to existing area".

### Root Cause
The `measurement_value` column in `quote_takeoff_measurements` is NOT NULL. The RPC insert at section 7 uses `(m->>'measurement_value')::numeric`. If the JSON payload has `"measurement_value": null` (which happens when the JavaScript value is `NaN` or `undefined`), the insert fails.

**The `NaN` source:** When `handleSaveArea` is called, it computes `calculatedArea = calculatePolygonArea(pendingAreaPoints)`. The `calculatePolygonArea` function divides by `calibrations.length`:
```js
const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
```
If `calibrations` is empty (`[]`), `0 / 0 = NaN`, and `pixelArea * NaN * NaN = NaN`. `JSON.stringify(NaN)` → `null`.

**However**, DB inspection confirms calibrations ARE present on all takeoff pages, and the hydration code restores them. So the `NaN` path requires calibrations to be empty at the time of drawing, which should not happen if hydration ran correctly.

**More likely cause:** After `handleSaveArea` runs for the "add to existing area" case, it sets `setIsExistingAreaMode(false)` (line ~1174). This causes the subsequent `handleSaveTakeoffCore` to include ALL `roofAreas` in the save — both the hydrated area (from DB) and the newly drawn area. The hydrated area has a valid `area` value from the DB. The new area has `area: calculatedArea` which should also be valid.

**The actual null source:** Further investigation reveals that when `isExistingAreaMode` is `false` (after `handleSaveArea` reset it), the save includes ALL `roofAreas`. But the hydrated `roofAreas` were loaded from the DB with `area: m.value` where `m.value = Number(m.measurement_value)`. This is always a number.

The issue is more likely that the **cached area flush** at lines 2028-2064 sends measurements with `value: area.area` where `area` comes from the cache. If the cache was populated from the hydration path (line 722-728), `area.area` = `m.value` = a valid number. But if the cache was populated from `handleSwitchArea` (line 864-878), and the `roofAreas` at that point included a newly drawn area with `area: NaN`, then the cache has `NaN`.

**Most defensible fix:** Add a guard in `saveTakeoffMeasurements` (actions.ts) and in the RPC to reject/coallesce null/NaN measurement values BEFORE the INSERT. Also fix `calculatePolygonArea` to return 0 (or throw an error) when calibrations is empty, rather than returning `NaN`.

### Fix Plan
1. **Guard in `calculatePolygonArea`**: if `calibrations.length === 0`, return 0 (or show an error and abort the draw). Never return `NaN`.
2. **Guard in `measurementsPayload`**: filter out or coerce any `NaN`/`undefined`/`null` values: `measurement_value: m.value ?? 0`.
3. **Guard in the RPC**: use `COALESCE(nullif(m->>'measurement_value', '')::numeric, 0)` instead of `(m->>'measurement_value')::numeric` so null/empty values default to 0 instead of violating the constraint.
4. **Fix `isExistingAreaMode` reset**: `handleSaveArea` should NOT reset `isExistingAreaMode` to `false` when adding to an existing area. The mode should persist until the user explicitly starts a new drawing mode. This prevents the save from including hydrated areas (which causes duplication).

---

## Summary of Required Fixes

### Bug 1 Fixes (component selection):
1. Clear `pendingComponentId` and `selectedComponentId` when "+ New Area" is clicked (in `handleConfirmNewAreaChoice` and `handleCreateNewArea`)
2. Clear `activeAreaComponentIdRef.current` when entering area drawing mode for roof areas
3. Move `setPendingComponentId(null)` before the routing logic in polygon-close handler
4. Only set `pendingComponentId(currentSelectedId)` in the explicit component-area path

### Bug 2 Fixes (null measurement_value):
1. Guard `calculatePolygonArea` — return 0 when calibrations is empty
2. Guard `measurementsPayload` — coerce null/NaN values to 0
3. Guard RPC — use `COALESCE(nullif(m->>'measurement_value','')::numeric, 0)` in the INSERT
4. Fix `isExistingAreaMode` — don't reset to `false` in `handleSaveArea` when adding to existing area
5. Fix left-panel display — sum all roofAreas matching the same area, not just the first match
