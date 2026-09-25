# Validation evidence — final candidate

## Completed

- All original **2,505** baseline files retained. Protected API/action/app-lib/Takeoff/mobile/Assistant/config/package surfaces unchanged; all other original unlisted files byte-identical. FILE_CHANGES.json supplies merge hashes.
- TypeScript parser check across the entire return: zero syntax diagnostics (correct BOM-aware read of the existing UTF-16 generated DB type file; file itself unchanged).
- 27 selected financial/save/form/controller bodies compare identically after TypeScript printing with comments removed. This is source proof, not all-behavior runtime proof; see SOURCE_AUDIT.json.
- Differential semantic screen using validation-only ambient dependency shims: 758 diagnostics in baseline and candidate, zero new diagnostics after fixes. This is **not a clean full typecheck**. Missing actual dependencies and approximate React types mean Gavin must use the locked app build/typecheck/lint.
- 29 source-derived static fixture states. Desktop width checks 1440, 1024, 800; recipient sheets 880 and 375. No page-wide horizontal overflow in the checked cases (document preview itself may intentionally scroll at narrow editor widths).
- Four isolated mounted React interaction scenarios passed, no page errors: quote selection/apply/draft barrier/hidden recovery/clean preview; invoice immediate text/quantity edits and display toggles; line-order edits plus distinct hidden-total behavior; visual component edit/draft barrier/layout switch/image visibility. Original data/persistence/lifecycle effects disabled; local draft/focus effects run. Local React 18.2 + bundled ReactDOM is not pinned app runtime. INTERACTION_TESTS.json identifies exact versions.
- Native Chromium A4 print specimens: four normal output formats each one page; 48-item invoice five pages, every item once in original order; no editor controls printed. These are fixture browser-print PDFs, not production jsPDF exports.

## Not completed here

Locked-dependency Next build, real React app hydration, real autosave/save/retry, original action side effects, permissions/auth across routes, production PDF capture, emailed attachments, token/public endpoint calls, real bank/payment state changes, integration/e2e testing and owner approval. No production or preview Supabase data was written. Do not label this deployed or production-ready from fixture evidence.

## Files

`fixtures/` contains current, source-derived, fictional-data HTML/PNG/print references. `tools/render-static-fixtures.cjs` evaluates actual TSX with inert hooks and excludes requests; it is explicitly not an app server. `INTERACTION_TESTS.json`, `LAYOUT_CHECKS.json`, `PRINT_CHECKS.json`, `SOURCE_AUDIT.json` record this pass. Earlier `docs/ux/phase-5` proofs apply only to the superseded style pass.
