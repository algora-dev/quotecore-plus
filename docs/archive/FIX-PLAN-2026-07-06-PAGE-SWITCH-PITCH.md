# Fix Plan: Missing Plan 4 Data + Pitch Per-Child-Area

Created: 2026-07-06 (Fable 5 investigation)
Status: Pending (after main merge)

## Issue 1: Missing Plan 4 data (child area + component not saved)

**Root cause:** `handleSwitchPage` (line 1123 of TakeoffWorkstation.tsx) does NOT auto-save to DB and does NOT cache to `areaCanvasStatesRef`. When the user draws on Plan 4, then switches to another page, the Plan 4 data stays in React state but is never persisted. When "Save & Continue" fires on a different page:
- The main save filters by `fromPageId` → Plan 4 areas excluded (correct)
- The flush skips the active area → Plan 4 data never flushed
- Result: Plan 4 data is silently lost

**Fix:**
1. Add a `persistCurrentPageData()` call in `handleSwitchPage` before switching — same pattern as `handleSwitchArea` auto-save. Stamp `fromPageId` on un-stamped measurements, save to DB with the current page ID, then switch.
2. Optionally: surface auto-save failures to the user instead of silently continuing.

## Issue 2: Pitch stored at parent area level, not per child area

**Root cause:** RPC Section 8 (line 271 of migration `20260705230000`):
```sql
UPDATE public.quote_roof_areas SET calc_pitch_degrees = v_area_pitch WHERE id = v_area_id;
```
This updates the parent area's pitch for every area in the payload — last one wins. Pitch is not stored per child area entry.

**Fix (as Shaun described):**
1. Add `pitch_degrees` column to `quote_roof_area_entries` — stores per-child-area pitch at creation time.
2. RPC: stop overwriting `calc_pitch_degrees` on every area. Instead, insert per-entry pitch into `quote_roof_area_entries.pitch_degrees`.
3. Keep `quote_roof_areas.calc_pitch_degrees` as the "default/parent" pitch.
4. Component entries: use parent area's pitch for pricing (as now). Per-component pitch override available in quote builder component phase.
5. Quote builder UI: show per-entry pitch next to each child area (read-only). Main pitch field on parent area remains editable.

## Sequence
1. ✅ Merge development → main (current state, duplicate fix included)
2. Fix Issue 1 (page switch auto-save) on development
3. Fix Issue 2 (per-child-area pitch) on development
4. Test both
5. Merge to main
