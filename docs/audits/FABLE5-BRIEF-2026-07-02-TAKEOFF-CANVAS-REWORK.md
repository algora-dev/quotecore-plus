# Fable 5 Brief: Digital Takeoff Canvas Rework

**Date:** 2026-07-02
**Author:** Gavin (from Shaun's direction)
**Scope:** `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/` + `app/(auth)/[workspaceSlug]/drawings/draw/FlashingCanvas.tsx` + `FilesManager.tsx` takeoff re-entry modal
**Bundle HEAD:** `d760e7a` (main, 2026-07-02)
**Type:** Architecture + UX rework (not a bugfix patch)

---

## 1. The Problem

The digital takeoff canvas has two fundamental failures that make it unreliable and confusing for users.

### 1A. No Undo System

Neither the Takeoff canvas (`TakeoffWorkstation.tsx`, 3,400+ lines) nor the Drawings canvas (`FlashingCanvas.tsx`) has an undo/redo system. The Drawings canvas has a literal comment: `// History removed - was causing issues with canvas state sync`. The Takeoff canvas never had one.

Every action — placing a calibration point, adding a polygon vertex, drawing a line measurement, creating a component area — is one-way. If a user clicks in the wrong place, their only options are to manually delete the object or start over. There is no step-back mechanism.

**Required:** Undo support for at least 5–10 steps across ALL canvas tools:
- Calibration (placing calibration points, confirming calibration)
- Roof area creation (polygon vertices, box-drag areas)
- Component area drawing (polygon close, box-drag)
- Line measurements (single and multi-segment)
- Point measurements
- Volume/freestyle measurements
- Visibility toggles (optional — may or may not warrant undo)
- Deletions (undo should restore deleted objects)

### 1B. Re-entry Doesn't Reconstruct the Canvas

When a user saves takeoff measurements, goes to the quote builder, then comes back to edit (`mode=add`), the code hydrates the **sidebar panel data** (measurement values show as text) but explicitly does **NOT reconstruct the canvas shapes**. The code comment at line 366 of `TakeoffWorkstation.tsx` says:

```
// Canvas shapes are NOT reconstructed here (P1-1b); values show in the panel.
```

The user sees their measurements listed in the sidebar, but the canvas is blank (or shows a baked overlay image). They cannot visually identify, select, edit, or delete their existing lines and areas. This is why "things go wrong" when they try to edit — they're drawing blind on top of nothing, and the save logic has to do fragile page-scoped filtering (`fromPageId` exclusion) to avoid double-counting.

### 1C. Overcomplicated Re-entry Modal

When a user clicks "Edit Digital Take-off" on a quote that already has measurements, `FilesManager.tsx` shows a 3-option modal:

1. **Continue measuring on this plan** — with a sub-toggle: "clean plan" vs "show measurements on plan" (loads a baked PNG overlay, not editable shapes)
2. **New area, same plan** — creates a new `takeoff_pages` entry + `quote_roof_areas` row, reuses the same plan image
3. **New area, new plan** — uploads a new plan image for a new area

Problems:
- "Continue measuring" doesn't let users actually edit existing measurements (canvas is blank/overlay-only)
- "Show measurements on plan" bakes old drawings into a flat background image — users think they can edit them but can't
- "New area, same plan" vs "new area, new plan" — the distinction is unclear (just whether you upload an image)
- Users can't tell which measurements belong to which area/plan

---

## 2. The Goal

### 2A. Simplified Re-entry (2 options, not 3)

**Option 1: Edit This Plan**
- Takes the user back to the canvas at the last saved state
- Shows ALL existing lines, areas, calibrations, and measurements reconstructed on the canvas as editable Fabric.js objects
- Shows the original plan image as the background
- Shows all measurements in the components sidebar
- User can add new measurements, remove existing ones, adjust existing ones
- Undo works throughout

**Option 2: Add New Plan**
- Uploads a new plan/image
- Opens a fresh canvas with the new image
- Creates a new roof area (user names it)
- No previous measurements shown — completely separate from the original
- User can delete old areas manually from the quote builder if they want

**Remove entirely:**
- The "clean plan vs show measurements" sub-toggle (obsolete — canvas is fully reconstructed now)
- The "new area, same plan" entry point (if users want multiple areas on the same plan, that's just "Edit This Plan" → draw another area)

### 2B. Full Canvas Reconstruction

On re-entry (Edit This Plan), rebuild ALL Fabric.js objects from stored data:
- Roof area polygons (with fill, stroke, markers)
- Component measurement areas (polygons with component colors)
- Line measurements (lines + endpoint markers + arrows)
- Point measurements (circles)
- Calibration lines and markers
- Volume/freestyle measurement shapes

This requires storing enough data to reconstruct. Current `quote_takeoff_measurements` table stores `points` (x/y arrays) for most measurements — verify this is sufficient for all measurement types, or add missing fields.

### 2C. Undo System

Implement a canvas-level undo stack:
- Push a snapshot before every meaningful canvas mutation (calibration point placed, polygon vertex added, polygon closed, line drawn, measurement deleted, visibility toggled, etc.)
- Undo pops the stack and restores the previous canvas + React state
- Minimum 10 steps deep
- Redo optional but nice-to-have
- Must work across ALL tools: calibration, area drawing, line/point/volume/freestyle measurements, deletions
- Clear visual: Undo button in the toolbar, disabled when stack is empty

### 2D. Preserve Existing Multi-Page Upload Flow

The "Save & Upload another plan" flow inside the TakeoffWorkstation (lines ~1200–1300) lets users upload an additional plan image mid-session. This creates a new `takeoff_pages` entry. This flow must continue working. If the rework changes how pages/areas are managed, ensure this flow is updated to match and doesn't break.

---

## 3. Architecture Context (for Fable 5 model)

### Key Files
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — 162KB, 3,400+ lines. The main canvas component. Contains all tools, save logic, hydration, multi-page upload.
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` — 32KB. Server actions: `saveTakeoffMeasurements`, `loadTakeoffHydrationData`, `createTakeoffPageForArea`, `initializeTakeoffPage`, `finalizeTakeoffPageImage`, `getFirstRoofAreaId`.
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx` — Server component, handles `mode=add` and `mode=new-page` routing.
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/modals/` — AreaNameModal, CalibrationModal, LineMeasurementModal, PointMeasurementModal.
- `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx` — The takeoff re-entry modal (3-option modal described above).
- `app/(auth)/[workspaceSlug]/drawings/draw/FlashingCanvas.tsx` — 88KB. Separate canvas for the Drawings/Images feature. Also needs undo. Has a deleted history system.
- `app/lib/takeoff/tool-for-measurement-type.ts` — Maps measurement types to canvas tools.

### Database Tables (relevant)
- `quote_takeoff_measurements` — stores individual measurements (points as JSONB, type, value, component_id, page_id, visible)
- `takeoff_pages` — multi-page entries (image_storage_path, page_order, quote_id)
- `quote_roof_areas` — roof area summaries (label, final_value_sqm, computed_sqm, calc_pitch_degrees)
- `quotes` — has `takeoff_canvas_path` (baked full-canvas PNG), `takeoff_lines_path` (lines-only PNG), `takeoff_session_version` (optimistic concurrency)

### Current Save Flow
`handleSaveTakeoffCore()` (line ~951):
1. Flatten component measurements + roof areas into `allMeasurements[]`
2. Filter out measurements from other pages (`fromPageId` exclusion)
3. Export canvas as two PNGs (full canvas + lines-only) and upload to storage
4. Call `saveTakeoffMeasurements()` RPC (`save_takeoff_atomic`) with page-scoped delete, session version guard
5. Navigate to quote builder

### Current Hydration Flow
`loadTakeoffHydrationData()` in `actions.ts`:
1. Fetch `takeoff_pages` for this quote
2. Fetch `quote_takeoff_measurements` for this quote
3. Return `{ pages, measurements, sessionVersion }`

`TakeoffWorkstation` hydration effect (line ~364):
1. Restore `pages` state from DB
2. Group measurements by component → restore `componentMeasurements` sidebar state
3. **Does NOT reconstruct canvas shapes** — `canvasObjects: []` for all hydrated measurements

### Multi-page Upload Flow
Inside `TakeoffWorkstation`, the "Save & Upload another plan" modal (line ~1200):
1. Calls `persistTakeoffData()` (save current page)
2. Uploads new plan image
3. Creates new `takeoff_pages` entry via `createTakeoffPageForArea()`
4. Creates new `quote_roof_areas` row
5. Finalizes page image via `finalizeTakeoffPageImage()`
6. Reloads to the new page

---

## 4. What Fable 5 Should Audit & Plan

### Audit Phase
1. **Map every canvas mutation point** in `TakeoffWorkstation.tsx` — every place a Fabric.js object is added, removed, or modified. These are the points where undo snapshots must be taken.
2. **Map the data model** — verify that `quote_takeoff_measurements.points` + type + value is sufficient to fully reconstruct every measurement type on the canvas. Flag any measurement type where reconstruction data is missing.
3. **Map the `FlashingCanvas.tsx` canvas** — same exercise for the Drawings canvas. Note what was removed and why ("causing issues with canvas state sync").
4. **Audit the save flow** — identify all edge cases in the page-scoped save logic (`fromPageId` filtering, `STALE_TAKEOFF_VERSION`, safe-skip when no new measurements). Ensure reconstruction + undo doesn't break any of these.
5. **Audit the multi-page upload flow** — ensure the "Save & Upload another plan" modal still works after the rework.
6. **Check `FlashingCanvas.tsx` edit mode** — does it reconstruct canvas shapes on edit? If not, flag it.

### Plan Phase
Produce a step-by-step implementation plan that GLM 5.2 can execute, covering:

1. **Canvas state snapshot system** — a reusable `useCanvasHistory` hook (or similar) that:
   - Captures a serializable snapshot of canvas state (all objects' geometry + styling + React state)
   - Pushes to a stack before mutations
   - Restores on undo
   - Works for both Takeoff and Drawings canvases

2. **Canvas reconstruction on re-entry** — a `reconstructCanvas()` function that:
   - Takes hydration data (measurements + pages + calibrations)
   - Recreates all Fabric.js objects with correct positions, colors, stroke widths
   - Binds them to the correct component/area for selection/deletion
   - Handles all measurement types: area polygons, lines, points, multi-lineal, volume_3d, freestyle

3. **Simplified re-entry UI** — rewrite `FilesManager.tsx` takeoff modal:
   - 2 options: "Edit This Plan" / "Add New Plan"
   - Remove the clean/lines sub-toggle
   - Remove the "new area, same plan" option
   - "Edit This Plan" navigates to `?mode=add` (which now triggers full reconstruction)
   - "Add New Plan" navigates to `?mode=new-page` with an upload step

4. **Undo toolbar** — Undo button (and optionally Redo) in the canvas toolbar, with disabled state when stack is empty.

5. **Drawings canvas undo** — apply the same `useCanvasHistory` to `FlashingCanvas.tsx`.

6. **Testing checklist** — step-by-step smoke test for:
   - First-time takeoff: draw area → add measurements → save → undo at each step
   - Re-entry edit: open saved takeoff → all shapes visible → edit a line → delete an area → add new measurement → save → verify DB matches
   - Multi-page: save → upload another plan → draw on new page → save → go back to page 1 → verify page 1 shapes intact
   - New plan flow: add new plan → draw → save → verify separate from original

### Constraints for the Plan
- **No breaking changes to the DB schema** without explicit migration steps
- **Build must pass** (`next build`) after each step
- **File size:** if `TakeoffWorkstation.tsx` grows beyond ~3,800 lines, extract the undo/reconstruction logic into separate modules
- **Existing saves must not break** — the `save_takeoff_atomic` RPC and page-scoped delete logic must continue to work
- **Multi-page upload flow must survive** — if it needs changes, document them explicitly

---

## 5. Expected Output from Fable 5

1. **Audit report** — findings on reconstruction data completeness, canvas mutation map, edge cases in save logic, FlashingCanvas state, multi-page flow risks.
2. **Implementation plan** — ordered steps with file-level changes, small enough for GLM 5.2 to execute one at a time with build verification between each.
3. **Risk flags** — anything that could break existing user data, saves, or the multi-page system.

---

## 6. Shaun's Confirmed Decisions

- Re-entry is 2 options: **Edit This Plan** (full canvas reconstruction) / **Add New Plan** (fresh canvas, new area)
- "New area, same plan" entry point is removed — multi-area on same plan is just "Edit This Plan" and draw another area
- "Clean plan vs show measurements" sub-toggle is removed — canvas is always fully reconstructed
- Undo must cover ALL tools (calibration, areas, lines, points, volume, freestyle)
- Multi-page "Save & Upload another plan" flow must not break
- Drawings canvas (`FlashingCanvas.tsx`) also needs undo
