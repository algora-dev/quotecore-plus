# Fable 5 Audit + Build Plan: Takeoff Canvas Critical Bugs

**Date:** 2026-07-03
**Auditor:** Fable 5 (Opus 4.8)
**Executor target:** Gavin (GLM 5.2)
**Shipped commit under review:** `07ebed4` (development)
**Prior audit:** `docs/audits/FABLE5-AUDIT-2026-07-02-TAKEOFF-CANVAS-REWORK.md`

**Scope files (all read in full or targeted):**
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` (3640 lines)
- `app/lib/takeoff/useCanvasHistory.ts` (134 lines)
- `app/lib/takeoff/reconstructCanvas.ts` (271 lines)
- `app/lib/takeoff/reconstructTypes.ts`
- `app/lib/takeoff/tool-for-measurement-type.ts`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffPage.tsx`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` (targeted)

> ⚠️ **ENCODING RULE FOR THE EXECUTOR (read first):** Every file in this audit contains non-ASCII characters (arrows, math symbols, em-dashes). When you edit these files you MUST use the `edit` / `write` tools or Node `fs.writeFileSync(path, content, 'utf8')`. **NEVER** use PowerShell `Set-Content`, `Out-File`, `>` or `>>` redirection on these files — that is what produced the mojibake in the first place. Verify after every edit with the mojibake scanner in §Issue 1.

---

## Executive Summary

The rework introduced a `useCanvasHistory` hook + `reconstructCanvas` module, but the **undo/redo integration into `TakeoffWorkstation.tsx` is fundamentally broken** because of three architectural mistakes, plus a data-model mismatch, plus a pre-existing mojibake problem that was never cleaned up. All 5 of Shaun's bugs trace to a small number of concrete root causes:

| Issue | Root cause | Severity |
|-------|-----------|----------|
| 1 — Mojibake symbols | Raw non-ASCII literals in JSX + comments, some written by `Set-Content` historically | HIGH (visible) |
| 2 — Image disappears / becomes draggable on undo | Image is a **regular canvas object**, serialized into the undo snapshot; `loadFromJSON` async race + lost custom-prop tagging | CRITICAL |
| 3 — Old area points persist after undo | In-progress polygon **vertex markers are never tracked** in any state array or `canvasObjects`; re-link by `measurementId` fails because Fabric strips custom props | CRITICAL |
| 4 — Undo jumps to start | The `mouse:down` handler is bound **once** at canvas init and captures a **stale `pushHistorySnapshot` closure**; snapshots are pushed with initial (empty) React state, so restoring any snapshot wipes everything | CRITICAL |
| 5 — Undo/redo architecture broken | Sum of 2+3+4: snapshot granularity, stale closures, un-serialized `measurementId`, no `canvas.clear()` before restore | CRITICAL |

**The correct fix is to stop snapshotting the whole canvas + whole React state and instead drive the canvas from React state as the single source of truth.** Details below. This is a rewrite of the undo layer, not a patch.

---

## Part 1: Detailed Root-Cause Analysis

### Issue 1 — Mojibake / encoding artifacts

**Root cause:** Non-ASCII glyphs are embedded directly in JSX text and comments. At some earlier point these files (or parts of them) were written with PowerShell `Set-Content`, which defaults to the system ANSI (Windows-1252) code page, corrupting UTF-8 bytes. The corruption is now baked into the source.

**Confirmed mojibake locations** (scanned with a Node UTF-8 detector; `app/lib/takeoff` is CLEAN, only `TakeoffWorkstation.tsx` is affected):

| Line | Current (broken) | Should be | Type |
|------|------------------|-----------|------|
| 553 | `boundary measurement â€” restore` | `—` (em dash) | comment |
| 840 | `null â†’ manual entry` | `→` | comment |
| 1269–1272 | `â€"` bullets | `–` (en dash) | comment |
| 1579 | `scaleÂ² for area` | `²` (superscript 2) | comment |
| 1834 | `isnâ€™t the first` | `’` (apostrophe) | comment |
| 1957–1961 | `â†'` arrows | `→` | comment |
| 2156 | `accidental clicks) â€"` | `—` | comment |
| 2190 | `new page â€"` | `—` | comment |
| **2437** | **`â† Back to quote`** | `←` | **VISIBLE JSX (back link)** |
| **2508** | **`<span…>Â·</span>`** | `·` (middot) | **VISIBLE JSX (guidance dot)** |
| 2535 | `Weâ€™ll save` | `We’ll` | VISIBLE modal text |
| 2657 | `Savingâ€¦` | `Saving…` | VISIBLE button text |
| **2681** | **`âœ" Confirmed`** | `✓ Confirmed` | **VISIBLE badge** |
| **2714** | **`âœ" Confirm Calibration`** | `✓ Confirm Calibration` | **VISIBLE button** |
| 2752 | `sq ft â†' RS (1 RS = 100 ftÂ²)` | `→` / `ft²` | comment |
| 2756/2758 | `ftÂ²` / `mÂ²` | `ft²` / `m²` | VISIBLE unit labels |
| 3089 | `Area tool â€"` | `—` | comment |
| **3254** | **`â†¶`** | undo glyph (replace with SVG) | **VISIBLE undo button** |
| **3262** | **`â†·`** | redo glyph (replace with SVG) | **VISIBLE redo button** |
| 3366/3380 | `Draw Area Â· Polygon/Rectangle` | `·` | VISIBLE labels |
| 3450/3736 | `Volume â‰ˆ` / `Area â‰ˆ` | `≈` | VISIBLE labels |
| 3457 | `mÂ³` | `m³` | VISIBLE label |
| 3504 | `skip to use 0Â°.` | `0°` | VISIBLE text |
| 3533 | `Save at ${pitchOnlyInput}Â°` / `0Â° flat` | `°` | VISIBLE text |
| 3743 | `mÂ²` | `m²` | VISIBLE label |

**Fix strategy:** Replace the two **icon** glyphs (undo `â†¶` @3254, redo `â†·` @3262, back-arrow `â†` @2437, checkmark `âœ"` @2681/2714) with proper **Heroicons outline SVGs** per the design system. Replace all other symbols (`·`, `²`, `³`, `≈`, `°`, `—`, `–`, `’`, `…`, `→`) with the correct UTF-8 characters written via the `edit` tool. See build plan §Task 1.

---

### Issue 4 — Undo goes all the way back to start ★ FIX THIS FIRST (it explains 2, 3, 5)

**Root cause: stale-closure capture of `pushHistorySnapshot` in the one-shot canvas init effect.**

- The canvas `mouse:down` handler that calls `pushHistorySnapshot()` is registered inside the canvas-init `useEffect` at **line 1663**, which is guarded by `canvasInitedRef` (line 1664) and has an **empty-ish dep array** — it runs **exactly once** on mount.
- At mount time, `pushHistorySnapshot` (defined line ~478) closes over the **initial** values of `componentMeasurements`, `roofAreas`, `calibrations`, etc. — all empty arrays / initial flags.
- Because the handler is never re-registered, **every** `mouse:down` snapshot for the whole session pushes `reactState` = *the empty initial state*.
- Result: when the user later hits Undo, `restoreSnapshot` restores `componentMeasurements: []`, `roofAreas: []`, `calibrationConfirmed: false`, etc. — i.e. it **resets the entire workstation to the pre-calibration start**. That is precisely Shaun's Issue 4 ("went all the way back to calibration start").

**Secondary cause: double / wrong-granularity snapshots.** Even if the closure were fresh:
- `mouse:down` pushes a snapshot on *every* click while any tool mode is active (line 1718). Drawing one polygon = N snapshots (one per vertex).
- Then `handleSaveArea` (line ~688), `handleConfirmCalibration` (line 2351), `handleSaveCalibration` (line ~2395) push *again*.
- The redo stack is cleared on every push (`useCanvasHistory.pushSnapshot`), so granularity is inconsistent: undo steps are per-click, not per-logical-action.

**Verdict:** The snapshot-the-world approach is the wrong model. See the recommended architecture in Part 2.

---

### Issue 2 — Image disappears on undo, then becomes selectable/draggable

**Root cause chain:**

1. The plan image is added as a **normal Fabric object** (`canvas.add(fabricImg)` + `canvas.sendObjectToBack(fabricImg)`), at init line 1701–1703 and in `loadPageImage` line 1069–1070. It is **not** set as a true background (`canvas.backgroundImage`).
2. When `pushHistorySnapshot` serializes `canvas.toJSON()`, the image is included in the JSON (good) — but restore is broken:
   - `restoreSnapshot` (line ~445) calls `canvas.loadFromJSON(data, cb)` **without calling `canvas.clear()` first** and the callback is **async**. Between the current render and the callback firing, the canvas can render an intermediate/empty state → the image **flashes away** ("disappears on undo").
   - `loadFromJSON` rebuilds *new* Fabric instances. The code re-links `canvasObjects` by reading `obj.measurementId` (line ~455), but **Fabric does not serialize custom properties by default** — `measurementId` is lost in `toJSON()`/`toObject()`. So re-linking silently fails (`filter` returns `[]`).
3. "Clicking the canvas makes the image reappear and it becomes selected/draggable": after a broken restore, the image object may be re-added by a later render path or the reconstruct effect, but with `selectable`/`evented` defaults **not** re-applied, so the user can grab and drag it. The design intent (image is fixed; only zoom + pan) is violated.

**Fix intent (Shaun):** the image must be **immovable** — `selectable:false, evented:false, lockMovementX:true, lockMovementY:true, hasControls:false, hasBorders:false`, and it must **never** be part of the undo snapshot. Best solution: make the plan image the canvas **background image** (`canvas.backgroundImage`) so it is structurally outside the object list and outside undo. Pan/zoom already work via `viewportTransform` (Alt+drag pan at line 2096–2105; button zoom at 2298–2320) and operate on the background too.

---

### Issue 3 — Old area points remain on canvas after undo

**Root cause:** In-progress polygon **vertex markers** (the small circles drawn on each area-tool click, line ~2013 `canvas.add(marker)`) are **never stored in any React array and never attached to a measurement's `canvasObjects`**. They live only as loose canvas objects until:
- the polygon is closed and `handleSaveArea` creates the polygon (but the vertex markers are still **not** added to `newMeasurement.canvasObjects` — only the `Polygon` is, line ~735), or
- `canvas.clear()` runs on page load.

Consequences:
- On undo via `loadFromJSON`, these orphan markers are part of whatever JSON snapshot restores, but because snapshots are broken (Issue 4) and re-linking fails (Issue 2/3), they end up **stranded on the canvas** with no owning measurement — physically blocking new point placement, exactly as Shaun reports.
- Same problem for calibration markers, line markers, multi-lineal markers: several drawing paths add markers to the canvas without tracking them for removal.

**Fix intent (Shaun):** points/locations should live in the **DB (and React state)**, not as persistent loose canvas objects. On undo, the canvas view for the undone action must be **rebuilt from state**, not from a stale JSON blob. On redo, re-derive the objects from state/DB `canvas_points` (the `reconstructCanvas` module already knows how to do this per type).

---

### Issue 5 — Overall architecture

Issue 5 is the umbrella. The current model is: *snapshot entire canvas JSON + entire React state, restore by replaying JSON and re-linking by a custom prop that isn't serialized.* This fails on three independent axes (stale closure, lost custom prop, async race + no clear). **The fix is to invert the model.**

---

## Part 2: Recommended Architecture — "State is the source of truth"

Instead of snapshotting the canvas, snapshot **only the serializable React data model** (measurements, roof areas, calibrations, and the active drawing buffers) and **re-derive all canvas objects from that model** after every undo/redo. The plan image is a background, never in the model.

**Core principles:**
1. **Plan image = `canvas.backgroundImage`.** Never selectable, never evented, never in undo, never draggable. Only `viewportTransform` (pan/zoom) moves the view.
2. **Undo history stores plain data only** — arrays of measurements / roofAreas / calibrations / in-progress point buffers. No Fabric JSON. No canvas objects. This is small, serializable, and immune to the custom-prop problem.
3. **One redraw function** `redrawCanvasFromState()` clears all non-background objects and rebuilds every shape from the current React state (reusing `reconstructCanvas` logic). Called after undo, redo, and reconstruction.
4. **One snapshot per logical action** — push a data snapshot at the *start* of each committed action (save area, save line, save point, confirm calibration, delete, etc.), NOT on every `mouse:down`. In-progress vertex clicks are held in a buffer that is itself part of the snapshot, so a single undo can also step back an in-progress polygon vertex if desired — but the default granularity is one logical action.
5. **Fresh closures** — the redraw + snapshot helpers must read current state. Because they're now called from React handlers (not the once-bound canvas listener) they naturally capture fresh state. The canvas `mouse:down` listener should **not** call `pushHistorySnapshot` itself; snapshots happen in the React-side commit handlers.

This eliminates: stale closures (4), lost `measurementId` (2/3), async `loadFromJSON` race + missing clear (2), orphan markers (3), and multi-step jumps (4).

---

## Part 3: Build Plan for Gavin (GLM 5.2)

Execute in order. Each task ends with `npm run build` passing. Do not proceed on a failed build. **Use `edit`/`write`/Node fs only — never `Set-Content` on these files.**

---

### Task 0 — Snapshot the mojibake scanner (tooling)

Create `scripts/scan-mojibake.js` (Node) that scans `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff` + `app/lib/takeoff` for the byte patterns `â€ â† âœ â‰ â­ â¯ Â<symbol> Ã ï¿½` and prints `file:line`. Run it before and after Task 1. (A working version already exists at repo-root `scan-mojibake.js` from this audit — move it into `scripts/` and keep it.)

**Risk:** none. **Build check:** n/a (script only).

---

### Task 1 — Fix all mojibake in `TakeoffWorkstation.tsx`

**1a. Replace the 4 icon glyphs with Heroicons outline SVGs** (24×24, `fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}` per DESIGN_SYSTEM.md):

- Line 2437 back-arrow `â†` → Heroicons `arrow-left` SVG inside the existing back `<Link>`.
- Line 2681 `âœ" Confirmed` → Heroicons `check` SVG + text `Confirmed`.
- Line 2714 `âœ" Confirm Calibration` → Heroicons `check` SVG + text `Confirm Calibration`.
- Line 3254 undo `â†¶` → Heroicons `arrow-uturn-left` SVG.
- Line 3262 redo `â†·` → Heroicons `arrow-uturn-right` SVG.

Heroicons paths to use:
- `arrow-left`: `M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18`
- `check`: `m4.5 12.75 6 6 9-13.5`
- `arrow-uturn-left`: `M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3`
- `arrow-uturn-right`: `m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3`

**1b. Replace remaining text/comment symbols** with correct UTF-8 via `edit`:
`Â·`→`·`, `Â²`→`²`, `Â³`→`³`, `â‰ˆ`→`≈`, `Â°`→`°`, `â€"`→`—`/`–` (context), `â€™`→`’`, `â€¦`→`…`, `â†'`/`â†`→`→` (comments), `â€”`→`—`.

Use the table in Issue 1 for exact line numbers. Work top-down; re-run the scanner after; it must report **zero** hits.

**Risk:** low. Only string/JSX literals change. Watch the two unit labels (`ft²`/`m²`) that are rendered — verify in browser they show correctly. **Build check:** `npm run build`.

---

### Task 2 — Lock the plan image as a background (Issue 2, foundational)

Change both image-load paths so the plan image is the canvas **background image**, not an object:

- **Init effect (line ~1680–1703):** replace `canvas.add(fabricImg); canvas.sendObjectToBack(fabricImg);` with `canvas.backgroundImage = fabricImg; canvas.requestRenderAll();`. Keep the scale/left/top math. Add explicit hard-locks on the image object anyway (defensive): `selectable:false, evented:false, lockMovementX:true, lockMovementY:true, hasControls:false, hasBorders:false`.
- **`loadPageImage` (line ~1058–1071):** same change (`canvas.backgroundImage = fabricImg`). Note `canvas.clear()` at line 1053 also clears `backgroundImage` in Fabric 6/7, so set it **after** clear (it already is).
- **`handleFitToScreen` (line ~2323):** it currently finds the image via `objects.find(obj => obj.type === 'image')`. After this change the image is no longer in `getObjects()`. Update it to read `canvas.backgroundImage` instead.

**Why:** a background image is structurally outside `getObjects()`, so it can never be selected, dragged, or captured into an object snapshot. Pan/zoom still work (they use `viewportTransform`, which applies to the background too).

**Risk:** medium. `handleFitToScreen` + any other `obj.type === 'image'` lookups must be updated (grep for `type === 'image'` and `'image'`). PNG export on save (canvas → dataURL) still includes the background — verify the saved plan image still bakes in the shapes. **Build check:** `npm run build` + manual: image loads, cannot be selected/dragged, pan (Alt+drag) + zoom buttons work.

---

### Task 3 — Rewrite the undo layer to "state-only snapshots" (Issues 3, 4, 5)

This is the core fix. Replace the snapshot-the-canvas model with snapshot-the-data model.

**3a. New history model.** Change `useCanvasHistory` usage so a snapshot is a plain serializable object:
```ts
interface TakeoffSnapshot {
  componentMeasurements: ComponentWithMeasurements[]; // WITHOUT canvasObjects (strip before storing)
  roofAreas: RoofArea[];                              // WITHOUT polygon/markers refs
  calibrations: Calibration[];
  calibrationConfirmed: boolean;
  // in-progress buffers so a mid-draw undo works:
  areaPoints: {x:number;y:number}[];
  linePoints: {x:number;y:number}[];
  multiLinealPoints: {x:number;y:number}[];
  activeComponentIds: string[];
  selectedComponentId: string | null;
}
```
Before pushing, **deep-clone and strip Fabric refs** (`canvasObjects`, `polygon`, `markers`) — they are non-serializable and stale after redraw. Store only geometry + values. You can keep using the existing `useCanvasHistory` hook but pass this plain object as `reactState` and **ignore the `canvasJSON` field entirely** (pass `canvas` but don't restore from its JSON). Cleaner: add a lightweight `useHistoryStack<T>()` that stores `T` objects only. Either is fine; the constraint is **no Fabric JSON in history**.

**3b. Single redraw function.** Add `redrawCanvasFromState()`:
```
1. const canvas = fabricRef.current; if (!canvas) return;
2. Remove every object EXCEPT the background:
   canvas.getObjects().slice().forEach(o => canvas.remove(o));
   (backgroundImage is not in getObjects(), so it survives — this is why Task 2 matters)
3. Re-derive objects from current state using reconstructCanvas():
   const result = reconstructCanvas(canvas, {
     componentMeasurements, roofAreas, componentColors, currentPageId
   });
4. setComponentMeasurements(result.componentMeasurements);
   setRoofAreas(result.roofAreas);
5. Redraw any in-progress buffer markers (areaPoints/linePoints/multiLinealPoints) if a draw is active.
6. canvas.requestRenderAll();
```
`reconstructCanvas` already builds polygons/lines/markers per type and returns fresh `canvasObjects` — reuse it. This is the ONLY place canvas objects for committed measurements get created (besides live drawing), which keeps object lifecycle centralized and kills orphan markers (Issue 3).

**3c. Snapshot at commit points, not on mouse:down.**
- **Remove** the `pushHistorySnapshot()` call from the canvas `mouse:down` handler (line ~1718). This is the stale-closure source.
- Keep/normalize `pushHistorySnapshot()` (now pushing the plain snapshot) at the **start** of each committed React handler:
  `handleSaveArea`, `handleConfirmVolumeDepth`, `handleConfirmFreestyleHeight`, `handleSaveCalibration`/`handleConfirmCalibration`, point-confirm, line-confirm, multi-lineal finish, `handleDeleteArea`, `handleDeleteMeasurement`, `handleRemoveComponent`, `handleToggleAreaVisibility`, `handleToggleMeasurementVisibility`.
- These handlers run React-side with **fresh closures**, so the snapshot captures real current state. One logical action = one snapshot = one undo step (fixes Issue 4).

**3d. `handleUndo` / `handleRedo`.** Rewrite:
```
const snap = history.undo(currentPlainSnapshot());
if (!snap) return;
setComponentMeasurements(snap.componentMeasurements);
setRoofAreas(snap.roofAreas);
setCalibrations(snap.calibrations);
setCalibrationConfirmed(snap.calibrationConfirmed);
setAreaPoints(snap.areaPoints); setLinePoints(snap.linePoints); ...
setActiveComponentIds(snap.activeComponentIds);
setSelectedComponentId(snap.selectedComponentId);
// then, in a useEffect keyed on a redrawVersion counter, call redrawCanvasFromState()
```
Do the redraw **after** state commits — bump a `redrawNonce` state value in undo/redo and run `redrawCanvasFromState()` in a `useEffect([redrawNonce])`, reading the just-set state. This avoids the async `loadFromJSON` race entirely.

**3e. Delete the old `restoreSnapshot` (line ~443)** and its `loadFromJSON` re-linking logic — it is the source of the image flash + broken re-link. Also delete the `measurementId`-based re-link filters (lines ~455–468); no longer needed since objects are rebuilt from state.

**Risk:** high (core logic). Mitigations: keep `reconstructCanvas` unchanged (already tested for reconstruction); redraw-from-state is deterministic; test the scenario Shaun hit (area → 2 components → undo = removes last component only). **Build check:** `npm run build` + full manual matrix in §Part 4.

---

### Task 4 — Track/clean in-progress markers (Issue 3 completion)

Ensure every loose marker has an owner:
- **Area vertex markers** (line ~2013): push each into an `areaMarkersRef` array as they're drawn; on polygon close, either (a) add them to the created measurement's `canvasObjects`, or (b) remove them and let `redrawCanvasFromState()` render the final polygon+vertices from `reconstructCanvas`. Prefer (b) for consistency — remove in-progress markers on commit, then redraw from state.
- **Calibration markers**: after `handleConfirmCalibration` removes yellow objects (line ~2360), that's fine — calibration is not redrawn. Just ensure `redrawCanvasFromState()` does NOT recreate calibration lines (it doesn't — `reconstructCanvas` has no calibration branch). Good.
- **Line / multi-lineal in-progress markers**: same pattern — remove on commit/cancel, redraw final from state.

**Risk:** medium. **Build check:** `npm run build` + manual: draw partial polygon → undo → no stray dots block the next click.

---

### Task 5 — Verify save uses live state, not undone drafts (Issue: save correctness)

Confirm (already true in code, just verify after Task 3): `handleSaveTakeoffCore` (line ~1201) builds `allMeasurements` from `componentMeasurements` + `roofAreas` React state (lines ~1226–1263), **not** from canvas JSON. Since undo/redo now mutate exactly those arrays, the saved payload always matches the visible canvas + sidebar. **No code change expected — assert with a test:** draw 3, undo 1, save, re-enter → only 2 persist.

Also confirm calibrations are passed to `saveTakeoffMeasurements({ calibrations })` (actions.ts already persists to `takeoff_pages.scale_calibration`, line ~297, and hydrates at line ~429/604). Grep the save call site for the `calibrations` arg; if missing, add it.

**Risk:** low. **Build check:** `npm run build` + manual re-entry test.

---

### Task 6 — Redo repopulates from state/DB (Issue 4/5 completion)

With Task 3, redo restores the plain snapshot and `redrawCanvasFromState()` rebuilds objects — so redone measurements reappear automatically from state (which mirrors DB `canvas_points`). Verify: draw area → undo (gone from canvas + sidebar) → redo (reappears on canvas + sidebar). No extra code beyond Task 3 if snapshots are correct.

**Risk:** low. **Build check:** manual redo cycle.

---

## Part 4: Manual Test Matrix (run after Task 6)

1. **Mojibake:** open takeoff, visually confirm back-arrow, ✓ badges, undo/redo icons, `·`, `m²`, `≈`, `°` all render correctly. Scanner reports 0.
2. **Image lock:** try to click+drag the plan image → cannot move it. Alt+drag pans. Zoom In/Out/Fit/Reset work. Undo during calibration → image stays put, never flashes.
3. **Undo one step:** calibrate → add roof area → add component A measurement → add component B measurement → Undo → only B removed (canvas + sidebar). Undo → only A removed. Undo → roof area removed. Undo → calibration state back. Each undo = exactly one step.
4. **Points don't block:** draw partial polygon (3 clicks) → Undo → no leftover dots; click to start a new point works immediately.
5. **Redo:** after undo, Redo re-adds each measurement in order, on canvas and sidebar.
6. **Save correctness:** draw 3 measurements, undo 1, Save → exit → re-enter (Edit This Plan) → exactly 2 measurements reconstructed; calibration scale restored.
7. **Reconstruction still works:** existing saved takeoff with areas + lines + points re-opens with all shapes visible and immovable image.

---

## Part 5: Execution Order & Dependencies

```
Task 0 (scanner)         → independent
Task 1 (mojibake)        → independent, do early
Task 2 (image = bg)      → REQUIRED before Task 3 (redraw relies on bg surviving clear)
Task 3 (state-only undo) → depends on Task 2; core
Task 4 (marker cleanup)  → depends on Task 3
Task 5 (save verify)     → depends on Task 3
Task 6 (redo verify)     → depends on Task 3
```

**Recommended sequence for GLM 5.2:** `1 → 2 → 3 → 4 → 5 → 6`, `npm run build` after each. Do Task 2 before Task 3 — the redraw-from-state approach is only safe once the image is a background that survives clearing the object list.

## Part 6: Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Re-introducing mojibake via Set-Content | High if wrong tool used | HARD RULE: `edit`/`write`/Node fs only; run scanner after |
| Background-image change breaks Fit/zoom | Medium | Update all `type === 'image'` lookups; test zoom matrix |
| Redraw-from-state has a per-type gap (e.g. volume_3d dashed) | Medium | `reconstructCanvas` already covers all 8 types; diff styles vs live draw |
| Deep-clone of measurements drops fields | Low | Clone geometry+values only; strip Fabric refs explicitly |
| Save double-counts across pages | Low | `fromPageId` filter (line ~1230) unchanged; verify in test 6 |
| PNG export loses baked shapes | Low | Background + objects both export via toDataURL; verify visually |

---

## Appendix: Key Line Reference (TakeoffWorkstation.tsx @ commit 07ebed4)

- `pushHistorySnapshot` def: ~478
- `restoreSnapshot` (DELETE): ~443
- `handleUndo` / `handleRedo` (REWRITE): ~500 / ~536
- Hydration effect: ~561
- Reconstruction effect: ~625
- `handleDeleteArea`: ~688
- `handleSaveArea`: ~700
- `loadPageImage` (image → bg): ~1049
- Canvas init effect (image → bg): ~1663
- `mouse:down` snapshot (REMOVE this call): ~1718
- Area vertex marker add (track/clean): ~2013
- Calibration point handlers: ~2032
- Pan (Alt+drag): ~2096
- `handleFitToScreen` (update image lookup): ~2323
- `handleConfirmCalibration` (yellow removal): ~2351
- Undo/redo buttons (icons): ~3248–3263
