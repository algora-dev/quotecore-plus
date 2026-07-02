# Fable 5 Audit Report + Implementation Plan: Digital Takeoff Canvas Rework

**Date:** 2026-07-02
**Brief:** `docs/audits/FABLE5-BRIEF-2026-07-02-TAKEOFF-CANVAS-REWORK.md`
**Bundle HEAD:** `d760e7a` (main, 2026-07-02)
**Auditor model:** Opus 4.8

---

## Part 1: Audit Report

### A1. Canvas Mutation Map (TakeoffWorkstation.tsx)

Every point where a Fabric.js object is added, removed, or modified on the canvas. These are the snapshot points for undo.

#### Calibration
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~1535 | First calibration point click | `Circle` marker added |
| ~1555 | Second calibration point click | `Circle` marker + `Line` added |
| ~2080 | `handleConfirmCalibration()` | All yellow objects **removed** from canvas |
| ~2110 | `handleCancelCalibration()` | Temp calibration `Line` removed |

#### Roof Area / Component Area Drawing
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~1650 | Polygon: add vertex | `Circle` marker added |
| ~1662 | Polygon: close (click near start) | Triggers modal flow |
| ~463 | `handleSaveArea()` — roof area polygon | `Polygon` added to canvas |
| ~501 | `handleSaveArea()` — component area polygon | `Polygon` added to canvas |
| ~546 | `handleToggleAreaVisibility()` | Polygon `.set('visible', ...)` |
| ~546 | `handleDeleteArea()` | Polygon + markers **removed** |
| ~1725 | Volume_3d: preview polygon | `Polygon` (dashed) added |
| ~877 | Volume_3d: confirm depth | Polygon dash removed (style change) |
| ~1872 | Box-drag: start | `Rect` (temp preview) added |
| ~1949 | Box-drag: volume_3d preview | `Polygon` (dashed) added |
| ~1908 | Box-drag: finalise | Temp `Rect` removed, triggers modal flow |

#### Line Measurements
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~1497 | Line: first point | `Circle` marker added |
| ~1515 | Line: second point | `Circle` marker + `Line` added |
| ~3370 | LineMeasurementModal confirm | Objects stay (captured into `canvasObjects`) |
| ~3395 | LineMeasurementModal cancel | Last 3 objects **removed** |
| ~625 | `handleDeleteMeasurement()` | `canvasObjects` **removed** |
| ~646 | `handleToggleMeasurementVisibility()` | `.set('visible', ...)` |

#### Point Measurements
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~1610 | Point: click | `Triangle` marker added |
| ~3300 | PointMeasurementModal confirm | Object stays (captured) |
| ~3320 | PointMeasurementModal cancel | Last object **removed** |

#### Multi-Lineal Measurements
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~1573 | Multi-lineal: add point | `Circle` marker + `Line` segment added |
| ~730 | `handleFinishMultiLineal()` | Objects stay (captured) |
| ~747 | `handleCancelMultiLineal()` | All segment objects **removed** |

#### Freestyle (length_x_height / multi_lineal_lxh_freestyle)
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~3356 | Freestyle: line drawn | Line + markers added |
| ~868 | `handleConfirmFreestyleHeight()` | Objects stay (captured) |
| ~3473 | Freestyle: cancel | `pendingFreestyleCanvasObjects` **removed** |

#### Component Management
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~625 | `handleRemoveComponent()` | All component's `canvasObjects` **removed** |

#### Page Operations
| Line | Action | Objects Mutated |
|------|--------|----------------|
| ~820 | `loadPageImage()` | `canvas.clear()` — **ALL objects destroyed** |

**Total mutation points: ~25 distinct locations.** Each must push an undo snapshot before mutating.

---

### A2. Data Model Audit — Reconstruction Completeness

For canvas reconstruction on re-entry, we need enough stored data to recreate every Fabric.js object. Here's what's stored vs what's needed:

| Measurement Type | `canvas_points` stored? | Sufficient for reconstruction? | Gap? |
|-----------------|------------------------|-------------------------------|------|
| `line` | ✅ `[{x,y}, {x,y}]` | ✅ Yes — 2 points → line + 2 markers | None |
| `area` (roof area) | ✅ `[{x,y}, ...]` | ✅ Yes — polygon + markers | None |
| `point` | ✅ `[{x,y}]` | ✅ Yes — triangle marker | None |
| `multi_lineal` | ✅ `[{x,y}, ...]` | ✅ Yes — N markers + N-1 segments | None |
| `multi_lineal_lxh` | ✅ `[{x,y}, ...]` | ✅ Yes — same as multi_lineal | None |
| `volume_3d` | ✅ `[{x,y}, ...]` | ✅ Yes — polygon | None |
| `length_x_height_freestyle` | ✅ `[{x,y}, ...]` | ✅ Yes — line + markers (same as line) | None |
| `multi_lineal_lxh_freestyle` | ✅ `[{x,y}, ...]` | ✅ Yes — same as multi_lineal | None |

**Finding: `canvas_points` is sufficient for ALL measurement types.** The x/y coordinates of all vertices are stored. We can reconstruct every shape.

**However, there are 3 critical data gaps for full reconstruction:**

#### Gap 1: Calibrations are NEVER persisted ⚠️ CRITICAL
- `takeoff_pages.scale_calibration` (JSONB column) exists in the schema but is **never written to**.
- Calibrations live only in React state (`calibrations` array).
- On re-entry via `mode=add`, the hydration data (`loadTakeoffHydrationData()`) does **not** include calibrations.
- **Impact:** When a user re-enters to edit, they have no calibration scale. The canvas shows shapes but the user can't add new measurements without recalibrating. And if they recalibrate, the new scale may differ from the original, causing spatial inconsistency.
- **Fix required:** Persist calibrations to `takeoff_pages.scale_calibration` on save. Load them in `loadTakeoffHydrationData()`.

#### Gap 2: Roof area `points` are NOT stored in `quote_takeoff_measurements` ⚠️ HIGH
- Roof areas (the boundary polygons drawn for the roof) are saved as `type: 'area'` measurements with `points` in `allMeasurements[]`... BUT only when `!isExistingAreaMode`.
- In `isExistingAreaMode` (the "add to existing area" flow), roof area rows are **skipped** in the save payload (line ~990: `if (!isExistingAreaMode) {`).
- The `quote_roof_areas` table stores `label`, `final_value_sqm`, `computed_sqm`, `calc_pitch_degrees` but **NOT the polygon points**.
- **Impact:** Roof area boundary polygons cannot be reconstructed from the DB. We know the area value and pitch, but not the shape.
- **Fix required:** Either (a) always store roof area polygon points in `quote_takeoff_measurements` with `componentId: null` and a distinct type, OR (b) add a `canvas_points` JSONB column to `quote_roof_areas`.

#### Gap 3: Component color assignment is not stored ⚠️ LOW
- Component colors are assigned at runtime by `COLOR_PALETTE[idx % length]` based on `activeComponentIds` order.
- On re-entry, the order may differ (hydrated components are added via `setActiveComponentIds(Array.from(grouped.keys()))`).
- **Impact:** Colors may change between sessions. Minor UX issue, not a blocker.
- **Fix:** Accept this — colors are cosmetic. Or store the color index in the measurement row.

#### Gap 4: Calibration markers are removed after confirmation ⚠️ MEDIUM
- `handleConfirmCalibration()` (line ~2080) **removes all yellow calibration objects from the canvas** after confirmation.
- Even if we reconstruct calibrations from the DB, the visual calibration line/markers won't be shown on the canvas.
- **Impact:** Users won't see where they calibrated. This is actually fine for re-entry — calibration is a setup step, not a measurement. The calibration *scale* is what matters, not the visual line.
- **Fix:** On reconstruction, don't redraw calibration lines. Just restore the `calibrations` state array so the scale is available for new measurements.

---

### A3. Save Flow Edge Cases

#### Edge Case 1: `fromPageId` filtering (line ~978)
The save logic filters out measurements where `m.fromPageId !== currentPageDbIdEarly`. This prevents cross-page double-counting. **With reconstruction, this logic must still work** — hydrated measurements from other pages will have `fromPageId` set, and only current-page measurements (including newly drawn ones) should be saved.

**Risk:** If reconstruction adds `canvasObjects` to hydrated measurements, the save logic doesn't touch `canvasObjects` (it only reads `value`, `type`, `points`, `visible`). So reconstruction is safe here. ✅

#### Edge Case 2: Safe-skip when no new measurements (line ~1025)
If `allMeasurements.length === 0` after filtering, the save is skipped. This happens when re-entering and the user doesn't draw anything new. **With reconstruction, this still works** — the filtered array will be empty if the user only views existing measurements without adding new ones. ✅

#### Edge Case 3: `STALE_TAKEOFF_VERSION` guard (line ~1167)
The RPC rejects saves if the DB `session_version` has advanced. **With reconstruction, this is unchanged** — the version guard operates on the RPC level. ✅

#### Edge Case 4: `isExistingAreaMode` skips area rows (line ~990)
When in existing-area mode, roof area polygons are not saved. **With reconstruction, this is a problem** — if the user edits roof area boundaries on re-entry, those changes won't persist. However, the current re-entry modal (`mode=add`) doesn't let users edit roof area boundaries anyway (they're shown read-only in the sidebar). So this is consistent. ✅ (for now)

#### Edge Case 5: Canvas image export (line ~1047)
The save exports the canvas as two PNGs (full + lines-only). **With reconstruction, these PNGs will now include the reconstructed shapes** — which is correct behavior. The baked image will reflect the full canvas state. ✅

---

### A4. FlashingCanvas.tsx Audit

#### Edit mode reconstruction: ✅ Already works
Unlike the Takeoff canvas, `FlashingCanvas.tsx` **does** reconstruct canvas objects on edit. It stores the full Fabric.js canvas JSON (`canvas_data` column) and loads it via `fabricRef.current.loadFromJSON()`. Measurements are stored as `StoredMeasurement[]` and restored.

#### Undo system: ❌ Removed
Line 76: `// History removed - was causing issues with canvas state sync`

The old history system was removed because it caused sync issues between the canvas state and the React `measurements` state. The likely problem was that undo/redo restored canvas JSON without同步-ing the `measurements` array, causing the sidebar to show measurements that no longer existed on the canvas (or vice versa).

**Key insight for the new undo system:** The undo snapshot must capture BOTH the Fabric.js canvas state AND the React state (`measurements`, `linePoints`, etc.) together. Restoring one without the other causes the sync issue.

#### What FlashingCanvas stores for reconstruction:
- `flashing_library.canvas_data` — full Fabric.js canvas JSON (all objects, positions, styling)
- `flashing_library.measurements` — `StoredMeasurement[]` (id, type, value, pointIndices, visible, textHidden, arcHidden)

**This is a different approach from TakeoffWorkstation.** FlashingCanvas stores the raw canvas JSON; TakeoffWorkstation stores only `canvas_points` (vertex coordinates). Both approaches work, but the Takeoff approach is more portable (doesn't depend on Fabric.js serialization format).

---

### A5. Multi-Page Upload Flow Audit

The "Save & Upload another plan" modal (line ~1200) works as follows:

1. `persistTakeoffData()` saves current page measurements (scoped delete by `currentPageDbId`)
2. New plan image uploaded to storage
3. `createTakeoffPageForArea()` or `createTakeoffPage()` creates the new page row
4. `finalizeTakeoffPageImage()` writes the image path to the new page
5. `loadPageImage()` clears the canvas entirely and loads the new image
6. State is reset: all measurements, calibrations, roof areas, tool modes cleared
7. `setSessionVersion(null)` — forces fresh version fetch on next save

**Risk with reconstruction:** When the user navigates back to page 1 after drawing on page 2, the canvas must reconstruct page 1's shapes. Currently, `loadPageImage()` clears everything and starts fresh. This is correct for the "new page" flow (page 2 should start empty), but incorrect for "go back to page 1" (which currently doesn't exist as a feature — plan tabs are read-only, line ~860: "switchToPage removed").

**Current state:** Users cannot switch between pages within the TakeoffWorkstation. The "Plan X of Y" indicator is read-only. To edit page 1, they'd have to exit and re-enter via `mode=add` (which would hydrate all pages' measurements but not reconstruct the canvas for any specific page).

**This is actually a design problem:** The "Save & Upload another plan" flow is a one-way trip. Once you're on page 2, you can't go back to page 1 within the same session. This is fine for the rework — we just need to preserve this behavior and make sure re-entry via `mode=add` reconstructs the correct page (page 1, or the page the user wants to edit).

---

### A6. Risk Flags

1. **Calibrations not persisted (CRITICAL):** Must fix before reconstruction can work. Without the calibration scale, new measurements on re-entry will be wrong.

2. **Roof area polygon points not stored (HIGH):** Roof area boundaries can't be reconstructed. Need to either always store them in `quote_takeoff_measurements` or add a column to `quote_roof_areas`.

3. **TakeoffWorkstation.tsx file size (MEDIUM):** Currently 3,400+ lines / 162KB. Adding undo + reconstruction logic will push it past 3,800. Must extract new logic into separate modules.

4. **Undo/React state sync (MEDIUM):** The FlashingCanvas history was removed for this reason. The new undo system must snapshot both canvas and React state together.

5. **Multi-page re-entry ambiguity (LOW):** When a quote has multiple pages, `mode=add` hydrates ALL pages' measurements but the canvas can only show one page. Need to decide: reconstruct only page 1? Or show a page selector?

6. **`save_takeoff_atomic` RPC doesn't write `scale_calibration` to `takeoff_pages` (LOW):** The RPC writes canvas/lines paths to `quotes` table, not page-level data. Calibrations need a separate update or RPC extension.

---

## Part 2: Implementation Plan

Designed for GLM 5.2 execution. Each step is self-contained, builds cleanly, and must pass `next build` before moving to the next.

---

### Step 1: Persist Calibrations to DB (Migration + Save/Load)

**Goal:** Store calibration data in `takeoff_pages.scale_calibration` so it survives re-entry.

**Files:**
- New migration: `backend/supabase/migrations/20260702160000_persist_calibrations.sql`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` — save calibrations in `saveTakeoffMeasurements()`, load in `loadTakeoffHydrationData()`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — pass calibrations to save, hydrate from DB

**Changes:**
1. Migration: add comment documenting `scale_calibration` usage. Column already exists — no schema change needed.
2. In `saveTakeoffMeasurements()`: accept a `calibrations` parameter. After the RPC call, update `takeoff_pages` row for `currentPageId` with `{ scale_calibration: calibrations }`.
3. In `loadTakeoffHydrationData()`: include `scale_calibration` in the page query. Return it in `TakeoffHydrationPage`.
4. In `TakeoffWorkstation.tsx`:
   - Pass `calibrations` to `saveTakeoffMeasurements()` in `handleSaveTakeoffCore()`.
   - In the hydration effect, restore `calibrations` state from `hydrationData.pages[0].scale_calibration`.
   - Set `calibrationConfirmed = true` if calibrations were restored.

**Build check:** `next build` must pass.

---

### Step 2: Persist Roof Area Polygon Points

**Goal:** Store roof area boundary polygon points so they can be reconstructed on re-entry.

**Files:**
- New migration: `backend/supabase/migrations/20260702170000_roof_area_canvas_points.sql`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` — include area points in save payload
- Update `save_takeoff_atomic` RPC (or add post-RPC update) to write `canvas_points` to `quote_roof_areas`

**Changes:**
1. Migration: `ALTER TABLE quote_roof_areas ADD COLUMN canvas_points JSONB DEFAULT NULL;`
2. In `saveTakeoffMeasurements()`: for each roof area in the payload, include `points` from the measurement data.
3. Update the RPC (or add a post-RPC UPDATE) to write `canvas_points` to `quote_roof_areas` when saving.
4. In `loadTakeoffHydrationData()`: fetch `canvas_points` from `quote_roof_areas` and return them.

**Alternative (simpler, no schema change):** Always store roof area polygons as `type: 'area_boundary'` rows in `quote_takeoff_measurements` with `componentId: null`. This reuses the existing `canvas_points` column. Change the save logic to always include these rows (remove the `!isExistingAreaMode` guard for area boundary rows).

**Recommended approach:** The alternative (store in `quote_takeoff_measurements`) is simpler and avoids a migration. Do that.

**Build check:** `next build` must pass.

---

### Step 3: Extract `useCanvasHistory` Hook

**Goal:** Reusable undo/redo hook for both canvases.

**Files:**
- New: `app/lib/takeoff/useCanvasHistory.ts`

**Design:**
```typescript
interface CanvasSnapshot {
  canvasJSON: string;           // Fabric.js canvas serialization
  reactState: Record<string, unknown>;  // Key React state values
}

interface UseCanvasHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (canvas: Canvas, reactState: Record<string, unknown>) => void;
  undo: (canvas: Canvas) => CanvasSnapshot | null;
  redo: (canvas: Canvas) => CanvasSnapshot | null;
  clear: () => void;
}

function useCanvasHistory(maxDepth = 20): UseCanvasHistoryReturn
```

**Implementation:**
- `pushSnapshot`: serialize canvas to JSON (`canvas.toJSON()`), capture React state, push to undo stack. Clear redo stack.
- `undo`: pop from undo stack, push current state to redo stack, return previous snapshot.
- `redo`: pop from redo stack, push current to undo stack, return next snapshot.
- `clear`: reset both stacks (used on page switch / save).

**Key design decision:** The hook returns the snapshot but does NOT apply it. The caller is responsible for restoring both the canvas (via `canvas.loadFromJSON()`) and the React state (via `setState()` calls). This avoids the sync issue that plagued the old FlashingCanvas history.

**Build check:** `next build` must pass (hook is unused at this point, just needs to compile).

---

### Step 4: Integrate Undo into TakeoffWorkstation

**Goal:** Working undo button in the takeoff toolbar.

**Files:**
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx`
- New: `app/lib/takeoff/takeoffSnapshot.ts` — helper to capture/restore TakeoffWorkstation state

**Changes:**
1. Import `useCanvasHistory` hook.
2. Create `pushHistorySnapshot()` helper that captures:
   - Canvas JSON
   - `componentMeasurements`, `roofAreas`, `calibrations`, `calibrationPoints`, `calibrationConfirmed`, `areaPoints`, `linePoints`, `multiLinealPoints`, `multiLinealSegmentObjects`
3. Call `pushHistorySnapshot()` BEFORE every canvas mutation (the ~25 points identified in A1).
4. Add `handleUndo()` function:
   - Call `undo()` from the hook.
   - Restore canvas from snapshot JSON via `canvas.loadFromJSON()`.
   - Restore all React state from snapshot.
   - Re-bind `canvasObjects` references on measurements (loadFromJSON creates new Fabric objects; measurements' `canvasObjects` arrays must be re-pointed).
5. Add Undo button to the toolbar (next to zoom controls). Use a curved arrow icon. Disabled when `!canUndo`.
6. Optional: Add Redo button.

**The tricky part — re-pointing `canvasObjects`:**
After `canvas.loadFromJSON()`, all Fabric objects are new instances. The `canvasObjects` arrays on `ComponentMeasurement` and `RoofArea` still reference old (disposed) objects. We must re-point them.

**Solution:** After `loadFromJSON()`, iterate the canvas objects and match them to measurements by type + position:
- Polygons → match to roof areas / component area measurements by points
- Lines → match to line measurements by coordinates
- Circles → match to markers (tricky — may need to tag objects with `measurementId`)

**Better solution:** Before serializing, tag every Fabric object with a `measurementId` custom property:
```typescript
obj.set('measurementId', measurement.id);
obj.set('componentId', componentId);
```
After `loadFromJSON()`, iterate objects, read `measurementId`, and re-point `canvasObjects`.

**Build check:** `next build` must pass. Manual test: draw area → add line → undo → verify both shapes removed → undo → verify area removed.

---

### Step 5: Canvas Reconstruction on Re-entry

**Goal:** When user re-enters via "Edit This Plan", all shapes are reconstructed on the canvas.

**Files:**
- New: `app/lib/takeoff/reconstructCanvas.ts` — reconstruction logic
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — call reconstruction after hydration
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` — include roof area points in hydration

**Changes:**

1. **In `loadTakeoffHydrationData()` (actions.ts):** Also fetch `quote_roof_areas` (id, label, canvas_points, calc_pitch_degrees) and include in hydration data.

2. **New file `reconstructCanvas.ts`:**
```typescript
interface ReconstructionInput {
  measurements: TakeoffHydrationMeasurement[];
  roofAreas: { id: string; label: string; points: {x,y}[]; pitch: number }[];
  componentColors: { componentId: string; color: string }[];
  calibrations: Calibration[];
  currentPageId: string | null;
}

function reconstructCanvas(
  canvas: Canvas,
  input: ReconstructionInput
): {
  componentMeasurements: ComponentWithMeasurements[];
  roofAreas: RoofArea[];
  calibrations: Calibration[];
}
```

3. **Reconstruction logic:**
   - Filter measurements to current page only (by `pageId`).
   - For each measurement, create Fabric.js objects based on type:
     - `line` → 2 Circle markers + 1 Line (component color)
     - `area` → Polygon + vertex markers (component color)
     - `point` → Triangle marker (component color)
     - `multi_lineal` / `multi_lineal_lxh` → N Circle markers + N-1 Line segments
     - `volume_3d` → Polygon (component color, solid)
     - `length_x_height_freestyle` → same as line
     - `multi_lineal_lxh_freestyle` → same as multi_lineal
   - For each roof area with `canvas_points` → Polygon (blue fill, blue stroke) + vertex markers
   - Tag every object with `measurementId` (for undo re-pointing)
   - Return React state arrays

4. **In TakeoffWorkstation.tsx hydration effect:**
   - After setting panel data, call `reconstructCanvas()` with the hydration data.
   - Set the returned `componentMeasurements` and `roofAreas` state (replacing the current partial hydration).
   - Set `calibrations` from hydration data (Step 1).
   - Set `calibrationConfirmed = true`.

5. **Timing:** Reconstruction must happen AFTER the canvas is initialized (after `canvasInitedRef.current = true` and the background image loads). Use a flag to defer reconstruction until both canvas is ready AND hydration data is available.

**Build check:** `next build` must pass. Manual test: create takeoff → save → re-enter → verify all shapes visible and editable.

---

### Step 6: Simplify Re-entry Modal (FilesManager.tsx)

**Goal:** Replace 3-option modal with 2-option modal.

**Files:**
- `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx`

**Changes:**
1. Remove `TakeoffOption = 'continue' | 'new-area-same-plan' | 'new-area-new-plan'` → replace with `'edit' | 'new-plan'`
2. Remove `PlanMode` type and `planMode` state entirely.
3. Remove the `planMode=lines` URL parameter from the `mode=add` navigation.
4. Remove the "clean plan vs show measurements" radio toggle.
5. Remove the "new-area-same-plan" option block.
6. Keep the "new-area-new-plan" option → rename to "Add New Plan".
7. "Edit This Plan" navigates to `?mode=add` (no `planMode` param).
8. "Add New Plan" navigates to `?mode=new-page` with upload flow (same as current `new-area-new-plan`).

**In `page.tsx`:** Remove `planMode` handling — `mode=add` always loads the clean plan image (reconstruction handles showing measurements).

**Build check:** `next build` must pass. Manual test: re-enter takeoff → see 2 options → edit → verify reconstruction.

---

### Step 7: Integrate Undo into FlashingCanvas

**Goal:** Undo button in the drawings editor.

**Files:**
- `app/(auth)/[workspaceSlug]/drawings/draw/FlashingCanvas.tsx`

**Changes:**
1. Import `useCanvasHistory` hook.
2. Call `pushHistorySnapshot()` before every canvas mutation (draw line, add measurement, delete object, etc.).
3. `handleUndo()`:
   - Call `undo()` from hook.
   - `canvas.loadFromJSON()` to restore canvas.
   - Restore `measurements` state from snapshot.
   - Re-point measurement-to-object references using `measurementId` tags.
4. Add Undo button to the FlashingCanvas toolbar.
5. Remove the `// History removed - was causing issues with canvas state sync` comment.

**Note:** FlashingCanvas already stores `canvas_data` (full JSON) and `measurements` — the snapshot can reuse the same serialization format.

**Build check:** `next build` must pass. Manual test: draw line → draw another → undo → verify first line remains.

---

### Step 8: Testing Checklist + Smoke Tests

**Files:**
- `docs/smoke-tests/CHECKLIST.md` — add items
- New: `docs/smoke-tests/takeoff-canvas-rework.md` — detailed test script

**Test scenarios:**

1. **First-time takeoff with undo:**
   - Upload plan → calibrate (2 points) → undo → verify calibration point removed
   - Draw area (polygon) → undo mid-drawing → verify last vertex removed
   - Close area → undo → verify area removed from canvas and sidebar
   - Add line measurement → undo → verify line removed
   - Add point measurement → undo → verify point removed
   - Draw multi-lineal → undo → verify last segment removed
   - Draw volume_3d → undo → verify polygon removed

2. **Re-entry edit:**
   - Create takeoff with 2 areas + 3 component measurements → save → exit
   - Re-enter via "Edit This Plan"
   - Verify ALL shapes visible on canvas (areas, lines, points)
   - Verify ALL measurements in sidebar with correct values
   - Verify calibration scale restored
   - Delete a measurement → save → re-enter → verify deletion persisted
   - Add new measurement → save → re-enter → verify addition persisted
   - Undo a deletion → verify measurement restored

3. **Multi-page flow:**
   - Create takeoff on page 1 → "Save & Upload another plan"
   - Draw on page 2 → save → exit
   - Re-enter via "Edit This Plan" → verify page 1 shapes reconstructed
   - (Page 2 shapes not visible — correct, single-page view)

4. **New plan flow:**
   - Re-enter via "Add New Plan" → upload new image
   - Verify fresh canvas, no previous shapes
   - Draw → save → verify separate from page 1

5. **Drawings canvas undo:**
   - Draw flashing → draw line → undo → verify line removed
   - Edit existing flashing → delete measurement → undo → verify restored

---

## Execution Order & Dependencies

```
Step 1 (calibrations persist)     ─┐
Step 2 (roof area points persist)  ├─→ Step 5 (reconstruction) ─→ Step 6 (modal simplify)
Step 3 (useCanvasHistory hook)     ┘                                  │
Step 4 (takeoff undo) ──→ depends on Step 3                          │
Step 7 (flashing undo) ──→ depends on Step 3                         │
Step 8 (testing) ──→ depends on all                                  │
```

Steps 1, 2, 3 can be done in parallel. Step 4 depends on 3. Step 5 depends on 1+2. Step 6 depends on 5. Step 7 depends on 3. Step 8 depends on all.

**Recommended sequential execution for GLM 5.2:**
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Each step ends with a `next build` check. If build fails, fix before proceeding.
