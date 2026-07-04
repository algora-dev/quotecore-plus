# Smoke Test Checklist — Takeoff Structural Redesign

## Pending verification (post-fix commit 3357ca9)

### Smoke test run 2026-07-04 — ISSUES FOUND
1. **First-time create** — New quote → upload plan → Edit Digital Take-off → canvas with area switcher + "Area 1" auto-created
2. **Same as edit** — Create layout identical to edit layout
3. **New Area** — Click "+ New Area" → modal → enter "Garage" → Confirm → appears as "Garage"
4. **Rename persists** — Reload → "Garage" still "Garage"
5. **Switch areas** — Draw on Area 1 → click "Garage" → canvas switches → Garage blank → back to Area 1 → drawings intact
6. **Shared calibration** — Calibrate on Area 1 → switch to Garage → calibration still active
7. **Per-area save** — Draw on both areas → save → reload → each area shows only its own measurements
8. **State restore** — Reload → click each area → canvas shows exactly what was saved

**Result:** Issues found — Shaun has detailed list for next session. See `memory/2026-07-04.md`.

## Passed (recent)
_(none yet — all pending)_
