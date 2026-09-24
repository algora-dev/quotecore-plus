# Static validation | Phase 3

Date: 2026-09-24. **Implementation candidate; actual application runtime untested.**

## Baseline and scope

Code baseline: `quotecore-plus-phase-2ab-integrated-2026-09-24.zip`. SHA-256: `e769508fef66ca241588da831b7b16d8daf1cc7e8f281811f2e2170db515fc4f`.

All 2,373 original files are retained. **858 protected original files match their supplied hashes.** The allowlisted source changes are five existing presentation files and seven new TS/CSS files. DESIGN_CHANGES.md is also updated and phase/root handoff documents are added. The complete source list and final package manifest are machine-readable. No application install/build/start or services were used.

The latest owner's correction is implemented: **Quotes and its Drafts tab remain, /quotes is not redirected.** C49 remains the existing QcIcon; C50 is QcSidebarTab and C51 is JobSpacesList.

## Checks performed

| Check | Result | What it establishes |
|---|---|---|
| Original/protected hashes | PASS, 858 protected files | Byte preservation, not functional runtime equivalence |
| Original Quotes server read/creation-prop block | PASS, exact after newline normalisation | Mechanical extraction to QuoteIndexPage did not rewrite the existing reads/props |
| Original Quotes JSX + QuotesList.tsx | PASS; exact JSX / byte-identical client | Existing display/creation/draft controls are preserved in source |
| Builder, takeoff, Q-mark, notification fix | PASS, original files unchanged except documented shell host | No engine, builder, asset or AlertBell edits |
| Local changed/new imports | PASS | Local target files exist, not module semantic typecheck |
| Isolated TS/TSX transpilation | PASS, 10 modules | Syntax-level diagnostics only |
| PostCSS parsing | PASS, 2 stylesheets | CSS parses; not full cross-browser compatibility |
| Pure presentation/state helpers | PASS, 53 assertions | Non-draft selection, filters, stable sorting/dates, link encoding, shell states and no input mutation |
| Standalone source-derived fixtures | PASS, 15 screen/viewport combinations | No document-wide horizontal overflow in sampled 320-1920px layouts |
| Fixture interactions | PASS, 7 checks | Visible hover/focus, reduced motion, explicit-close drawer and static toggle demonstration |

The Node helper test uses the supplied pure source functions with an already available TypeScript transpiler. It is stored under docs/ux/phase-3/, not the protected e2e/scripts suite. No dependencies were installed. Reproduce that check in the full repo with `node docs/ux/phase-3/check-pure-functions.cjs` once its existing TypeScript dependency is available.

## Visual fixture limitation

The HTML is rendered from returned JSX/CSS with fixed sample records and a **non-React static adapter**. Its JavaScript demonstrates show/hide/search/filter/dialog states only. It does not mount the app or prove React hydration, Next routing/cache, focus after real route transitions, RLS, payment/plan gates, actual save/send/upload, or canvas accuracy. A fixture keeping its DOM during toggling is NOT a React no-remount test. The implementation retains one children slot; Gavin must verify the real behaviour.

The sample-record list and mobile drawer were visually inspected. Colours/gradients use the existing approved tokens. No generated marketing imagery, copied font binaries or new external assets were added.

## Required integrator checks

**P3-LIST-01:** inherited quote and unresolved-revision reads are unpaginated. Validate full large-company coverage above the configured service cap, including older non-drafts behind newer drafts. Wire company-scoped count/paging for the NEW Job Spaces view when needed; client display pagination cannot prove all rows arrived. Verify that empty, failed and partially loaded data are not misrepresented. Current fixtures do not verify live collection completeness.

Run the complete app typecheck, build, lint and existing regression suite in the full integration environment. Check Quotes/Drafts and new-quote quotas; company isolation; summary/inbox back routes; Job Spaces list states; stored sidebar preference and old rail migration; repeated toggles with edited builder state; focus/inert behaviour; mobile drawer scroll/close/logout; actual takeoff calibration, pointer coordinates, pan/zoom, file/AI and dirty exit after resizing. Wait beyond the previous refresh interval while sections remain open.

No claim is made that build/e2e/PDF/pricing/service parity passed here. No release approval is inferred. Follow INTEGRATION.md and obtain owner preview approval. The final archive checker separately verifies original logical paths, protected bytes and absence of path collisions after ZIP creation.

## Evidence files

SOURCE_CHECKS.json, SOURCE_FILES.json, PROTECTED_HASHES.csv, SYNTAX_CHECKS.json, PURE_FUNCTION_CHECKS.json, BROWSER_CHECKS.json, FIXTURE_SOURCE.md, CAPABILITY_PARITY.csv and RETURN_FILE_MANIFEST.json. Earlier phase reports remain historical evidence, not re-run tests.
