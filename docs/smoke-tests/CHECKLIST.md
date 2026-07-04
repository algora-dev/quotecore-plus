# Smoke Test Checklist — Takeoff Area Fixes (9-Phase Plan)

## Status: BUILT — awaiting smoke test on Dev

### Build phases (all complete, commit `c4ee521` on development)
1. ✅ Layout fix — h-screen + overflow-hidden + min-h-0
2. ✅ DB-first naming — createNewTakeoffArea(quoteId, label?) with dedup
3. ✅ Area sub-measurement rows — RPC creates quote_roof_area_entries per polygon
4. ✅ Save/restore all areas — auto-save on switch, flush on full save
5. ✅ Area delete — trash icon + ConfirmModal + deleteTakeoffArea action
6. ✅ "+ New Area" — choice modal (add to existing dropdown / create new)
7. ✅ "Save & upload another plan" — area dropdown, no upfront name for new
8. ✅ Multi-plan re-entry — pageIds cached per area, page switch on area click
9. ✅ Build passes, pushed to development

### Pre-test cleanup
- [ ] Clean up orphaned/duplicate areas on "Updated Digi Test" quote

### Pending verification
- [ ] Layout: canvas sits beside the left panel (not below it)
- [ ] Create new area: click "+ New Area" → choice modal appears → "Create new" → draw polygon → AreaNameModal → name persists
- [ ] Add to existing area: "+ New Area" → "Add to existing" → select from dropdown → draw polygon → pitch-only modal → measurement adds to selected area
- [ ] Area delete: trash icon → ConfirmModal → area + measurements removed from DB
- [ ] Area switch: switch between areas → each area shows its own measurements + canvas state
- [ ] Auto-save on switch: draw on Area 1 → switch to Area 2 → switch back to Area 1 → drawings persist
- [ ] Save & upload another plan (existing): save → upload new plan → select existing area → measurements route to selected area
- [ ] Save & upload another plan (new): save → upload new plan → create new area → draw polygon → name area → area + measurements saved
- [ ] Multi-plan re-entry: exit takeoff → re-enter → area list shows all areas → click area → correct plan loads
- [ ] No duplicate areas: check DB for duplicate quote_roof_areas rows after multiple saves
