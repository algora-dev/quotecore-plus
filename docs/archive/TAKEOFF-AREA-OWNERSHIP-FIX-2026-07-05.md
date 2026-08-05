# Takeoff Area Ownership Fix — Build Spec (2026-07-05)

Confirmed by Shaun 2026-07-05 13:53. Analysis by Fable 5; build on GLM 5.2.

## Root causes (verified against DB quote 34c8d11e-133e-4373-98d7-a6f69a0c6996)
1. Client stamps EVERY measurement with `activeAreaId` at SAVE time (TakeoffWorkstation.tsx ~1761, ~1786, and auto-save ~909/918). When a new area is created, activeAreaId flips → everything drawn earlier gets re-stamped to the new area.
2. `handleSaveArea` create-new branch (~1196) switches `activeAreaId` WITHOUT caching the outgoing area's state to `areaCanvasStatesRef` → clicking old area shows empty canvas/panel.
3. RPC `save_takeoff_atomic` section 9 assigns ALL `quote_components` in a save to ONE area (`coalesce(v_target_roof_area, v_first_roof_area)`) and looks up existing rows by (quote_id, component_library_id) LIMIT 1 → same component cannot exist in two areas; all components land in one bucket.
4. Pitch-only modal (~4253) never displays `calculatePolygonArea(pendingAreaPoints)`.
5. Left panel total (~3600) matches polygons by `ra.id === area.id || ra.name === area.label` — fragile; misses client-side `area-${Date.now()}` ids.

## Phase A — stamp quoteRoofAreaId at draw time (TakeoffWorkstation.tsx)
- Add `quoteRoofAreaId?: string | null` to `ComponentMeasurement` (~line 78) and `RoofArea` (~line 60) interfaces.
- Add `activeAreaIdRef` (useRef, synced in an effect alongside the other refs ~line 2190) — canvas handlers are stale closures; NEVER read activeAreaId state inside them.
- Stamp at EVERY measurement commit point (line, point, multi_lineal, multi_lineal_lxh, component-area, volume_3d, freestyle): `quoteRoofAreaId: activeAreaIdRef.current`.
- handleSaveArea roof-area branch:
  - add-to-existing (`pendingNewAreaIsExisting && pendingNewAreaTargetId`): stamp newArea with `quoteRoofAreaId: pendingNewAreaTargetId`.
  - create-new: stamp newArea after `createNewTakeoffArea` returns → update the roofAreas entry by areaId with `quoteRoofAreaId: result.areaId`.
- Hydration (~714, ~721): stamp measurements/areas with `areaKey` (the DB quote_roof_area_id) so re-entered sessions keep correct ownership. Cache entries too (~727-731).
- Save paths: replace blanket `quoteRoofAreaId: activeAreaId ?? activeSaveRoofAreaId` with `m.quoteRoofAreaId ?? activeAreaId ?? activeSaveRoofAreaId` (per measurement), and for roofAreas: `area.quoteRoofAreaId ?? (area.id.startsWith('area-') ? (activeAreaId ?? activeSaveRoofAreaId) : area.id)`.
  - Save & Continue block (~1761 components, ~1786 areas)
  - handleSwitchArea auto-save block (~909 components, ~918 areas)

## Phase B — cache outgoing area state on new-area creation (TakeoffWorkstation.tsx ~1196)
In `handleSaveArea` create-new async callback, BEFORE `setActiveAreaId(result.areaId)`:
1. Cache outgoing area state to `areaCanvasStatesRef.current.set(oldActiveAreaId, {...})` — same shape as handleSwitchArea (~872): componentMeasurements, roofAreas WITHOUT the new polygon, calibrations, calibrationPoints, calibrationConfirmed, activeComponentIds, selectedComponentId.
2. Best-effort auto-save outgoing area to DB (same pattern as handleSwitchArea ~893-935): all componentMeasurements + old roofAreas with per-measurement quoteRoofAreaId fallback to oldActiveAreaId. Bump sessionVersion on success.
3. Then set new-area state: `setComponentMeasurements([])`, `setActiveComponentIds([])`, `setSelectedComponentId(null)`, `setRoofAreas([newAreaStamped])`.
4. `setActiveAreaId(result.areaId)`, `setActiveSaveRoofAreaId(result.areaId)`.
5. `setRedrawNonce(n => n + 1)` so the canvas rebuilds showing only the new area's polygon (check how the redrawNonce effect rebuilds — mirror handleSwitchArea behaviour).
- Add-to-existing when target !== activeAreaId: cache+auto-save current area (without new polygon), restore target's cached state (or empty), append new polygon to target's roofAreas, set active to target, redraw. When target === activeAreaId (common case): just stamp + keep state, no switch needed.
- Guard: oldActiveAreaId may be null (first area ever) — skip caching/saving in that case.

## Phase C — pitch-only modal shows measured area (~4253)
Inside the modal, above the pitch input, add the AreaNameModal block:
```
<div className="p-3 bg-gray-50 border border-orange-400 rounded-lg mb-4">
  <p className="text-xs text-gray-900 font-medium">
    Plan Area: {(pendingAreaPoints.length > 0 ? calculatePolygonArea(pendingAreaPoints) : 0).toFixed(2)} sq {calibrations[0]?.unit || 'feet'} (before pitch adjustment)
  </p>
</div>
```
(Adjust wording for non-roofing trades: omit "(before pitch adjustment)" when !tradeConfig.pitchRequired.)

## Phase D — left panel per-area totals (~3600)
Change matching to: `roofAreas.filter(ra => ra.quoteRoofAreaId === area.id || ra.id === area.id || ra.name === area.label)` (stamp-first, legacy fallbacks). Total = sum. Shaun confirmed sum display (58.71+3.71=62.42).

## Phase E — migration: per-area quote_components
New migration `20260705150000_per_area_quote_components.sql`, new version of `save_takeoff_atomic`:
- Payload change (actions.ts `saveTakeoffMeasurements`): group componentsPayload by (componentId, quoteRoofAreaId) instead of componentId only. Each group carries `quote_roof_area_id`. Group key: measurement.quoteRoofAreaId (fallback targetRoofAreaId/null).
- RPC section 9: existing-row lookup becomes
  `WHERE quote_id = p_quote_id AND component_library_id = v_lib_id AND quote_roof_area_id IS NOT DISTINCT FROM v_comp_area` (v_comp_area = coalesce(payload value, v_target_roof_area, v_first_roof_area)).
- Insert uses v_comp_area for quote_roof_area_id.
- Keep everything else identical to 20260705120000 version (page-scoped deletes etc.). Apply via Management API (pre-authorized), regen types.
- NOTE: client actions.ts must pass quoteRoofAreaId per measurement into the components grouping — TakeoffMeasurement already has the field (actions.ts line 18).

## Phase F — verify
- `npm run build` must pass.
- Commit to development, push (pre-authorized).
- Add smoke-test items to docs/smoke-tests/CHECKLIST.md under "Pending verification":
  1. Multi-area takeoff: draw areas+components on Main Roof, create Garage, verify left panel switches show correct per-area data.
  2. Quote builder Roof Areas: Main Roof entries under Main Roof, Garage entries under Garage.
  3. Components step: components under the area they were drawn on.
  4. Pitch-only modal shows measured area value.
  5. Add-to-existing: left panel total = sum of polygons.
- Shaun deletes corrupted "DigiTakeoff Test" draft and retests fresh.

## Expectation confirmed by Shaun
- Same component in two areas = two separate quote_components rows, one per area (drawn separately per area in takeoff).
- Add-to-existing stays selected on the chosen target area; every polygon drawn attaches to it.
