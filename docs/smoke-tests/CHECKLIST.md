# Smoke Test Checklist — Takeoff Structural Redesign

## Pending verification (Batches 1-6)

### Batch 1 re-fixes (from last round)
1. **#2 Area-assignment modal** — Edit existing plan → draw new area polygon → modal appears with "Assign Area Measurement" (existing areas + New Area option)
2. **#3 Toolbar** — Single-stack text; Line tool has Single/Multi sub-tool toggle; Multi still commits polylines
3. **#5 Undo click-by-click** — 4-click polygon → undo steps back ONE click at a time → never wipes canvas

### Batch 3 — Left panel area switcher
4. **Area list** — Left panel shows all roof areas for the quote; active area highlighted
5. **Switch areas** — Click a different area in the list → canvas switches to show that area's content
6. **New Area button** — Click "+ New Area" → creates area in DB → appears in list → switches to it

### Batch 4 — Unified entry
7. **Single entry** — Click "Edit Digital Take-off" from FilesManager → goes straight to canvas (no 2-option modal)
8. **All areas loaded** — All existing areas visible in left panel on entry

### Batch 5 — Area-scoped save
9. **Save with area ID** — Draw measurements → save → check DB: `quote_takeoff_measurements.quote_roof_area_id` is populated

### Batch 6 — Polygon close UX
10. **New Area choice** — Draw polygon → modal → choose "New Area" → enter name → Confirm → area appears in left panel immediately with DB UUID
11. **Add to existing** — Draw polygon → modal → choose existing area → Confirm → activeAreaId switches to that area → subsequent measurements are scoped to it

## Passed (recent)
_(none yet — all pending)_
