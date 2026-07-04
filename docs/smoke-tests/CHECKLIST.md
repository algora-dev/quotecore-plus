# Smoke Test Checklist — Takeoff Area Fixes (9-Phase Plan)

## Status: BUILD IN PROGRESS (not ready for testing)

### Build phases (see `docs/plans/TAKEOFF-AREA-FIXES-2026-07-04.md`)
1. ☐ Layout fix — canvas/toolbar beside panel
2. ☐ DB-first naming — `createNewTakeoffArea(quoteId, label?)`
3. ☐ Area sub-measurement rows — reuse quote builder Area-tab system
4. ☐ Save/restore all areas — auto-save on area switch
5. ☐ Area delete — trash icon + ConfirmModal + real DB delete
6. ☐ "+ New Area" Route 1 — choice modal (add to existing / create new)
7. ☐ "Save & upload another plan" Route 2 — dropdown for existing, no upfront name for new
8. ☐ Multi-plan re-entry — area click loads associated plan
9. ☐ Cleanup — dead code removal, `next build`, smoke-test checklist rewrite

### Pre-test cleanup
- Delete orphaned/duplicate areas on "Updated Digi Test" quote (or provide one-off cleanup script)

### Smoke test items (run AFTER all phases built)
_To be written in Phase 9._
