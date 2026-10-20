# START HERE / Pricing Activation & Smart Component Testing

This archive is a **complete codebase with the new pricing experience implemented**, based on `quotecore-plus-phase10-runtime-acceptance-return-2026-09-28.zip` (SHA-256 `abe445278468e356e508b5cd12ac893093b9efeb2e559960a56d528d2d4bedf7`). It is not another Phase9/Phase10 migration return.

Read:
1. `docs/ux/experience-1-pricing-activation/INTEGRATION.md`
2. `docs/ux/experience-1-pricing-activation/FILE_CHANGES.json` (the only change manifest for THIS return)
3. `docs/ux/experience-1-pricing-activation/RUNTIME_CHECKLIST.md`

The root `RETURN_NOTES.md` / `CHANGED_FILES.json` belong to the parallel Smart Assistant baseline. They are intentionally preserved, NOT overwritten or used as this return's manifest. Older START_HERE documents are historical.

Implemented: clearer library component editor; read-only testing of unsaved settings using existing engine helpers; starter-led optional learning; pricing-first Home for known-empty workspaces; simple catalogue mapping example and honest completion. No prices, DB schema, API/action, Smart Assistant, Takeoff, document renderer, auth or package dependencies were changed.

Source/isolated checks passed. **Actual app TypeScript/Next build, real saving and test-to-quote cost parity remain Gavin's gate.** Use an isolated clone and manifest-only three-way merge, preserving all newer changes. Do not deploy the separate UX-standard archive; it is a reference package.
