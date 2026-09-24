# Phase 2A + 2B | Static validation and limits

24 September 2026. This is a **candidate for integration**, not a production approval.

## Baseline and scope

Input: `quotecore-plus-phase-1-integrated-2026-09-24.zip`.
SHA-256: `75178221a15c358c1b41f949a52c9b94a749e7b70c65d319f91da40d25a2fab3`.
The rejected document-first Phase 2 return is not an input. The current owner authorised shell, Home and real Job Space together. Root brief/config files are retained.

## File integrity

- All **2,299 original files retained**. No original files removed or renamed.
- **857 protected files checked; zero changed.** This conservative classification includes app/api, app/lib, root lib, backend, supabase, actions/top-level use-server files, middleware, package/lockfiles, configs, e2e and scripts. See PROTECTED_HASHES.csv for exact hashes.
- **24 source files changed/added:** 9 modifications and 15 additions; 20 TS/TSX modules and 4 CSS files. Full paths/notes in CHANGED_FILES.json and FILE_CHANGE_NOTES.md.
- Existing Phase 1 quote-builder source, notification polling fix, wrapper navigation fix and takeoff internals are unchanged. The only shared Phase 1 style change is ghost/glass hover-border emphasis in qc.css; no token values changed.
- The existing inline duplicate-quote server action in Summary page is byte-identical. Server-rendered pages are changed only for imports/presentation composition and mapping already-loaded display values.

## Static code checks performed

1. TypeScript parser and isolated transpilation passed for all 20 changed/new TS/TSX modules. This does **not** resolve the full project type graph.
2. Static relative/@-local import paths and CSS import paths resolve. No new dependency required; no install attempted.
3. Four changed/new CSS files parse successfully with PostCSS.
4. **24 targeted invariants pass:** original awaits in layout (11), Home (10) and Summary (20) retained in order; send/files/notes/expiry/withdraw/admin-audit runtime prop expressions preserved after type erasure; inline duplicate action unchanged; original customer/labour preview calculation declarations retained; ten shell route defaults and two navigation/gating fixtures pass.
5. Exactly **49 unique component contracts** in the updated catalogue/registry. Current components reuse C11/C22/C23/C24/C39 rather than create a competing primitive set; C47-C49 cover the capability card, Home composition and icon vocabulary.

These checks catch some accidental edits, syntax and wiring errors. They are not a formal proof of behavioural or pricing equivalence. Await comparison is structural, not a test of every branch or runtime effect.

## Visual reference checks performed

The reference is rendered from an explicit allowlist of returned presentation JSX/CSS with a small **non-React fixture adapter**. It uses fixed illustrative data, no hooks/effects/runtime hydration, no service imports and no real application requests. The builder/canvas pages demonstrate the shell's space only; their engines are not rendered. Embedded documents are illustrative placeholders, not actual PDFs.

- Headless Chromium screenshots: Home, Job Space, builder host and immersive host at **320, 390, 768, 1024, 1440 and 1920 px**: 24 fixture/viewport combinations, no document-wide horizontal overflow and no fixture JavaScript errors.
- Six job-section demonstration switches retain expected selected state and no page-wide overflow.
- Mobile navigation demonstration opens, ignores backdrop clicks and closes with its explicit Close control. This is not a test of React's QcDialog effect/focus restoration.
- Catalogue at 390 and 1440 px: 49 distinct contract cards, no document-wide overflow or script errors. Its data table has an intentional internal scroll region.
- Primary, ghost and glass action examples have computed hover changes and visible keyboard-focus outlines using the returned CSS. States are demonstrated, not an exhaustive audit of every legacy control in the app.
- Desktop/mobile screenshots were visually reviewed. Early fixture wrapping issues were corrected in the standalone renderer; actual application screens still require the integration checks below.

See STATIC_SYNTAX.json, STATIC_INVARIANTS.json, VISUAL_FIXTURE_CHECKS.json and CATALOGUE_FEEDBACK_CHECKS.json for the recorded results. Audit helpers run outside the repo; no repository test/config/tooling files were edited.

## Explicitly NOT performed

No Next application execution, dependency installation, full TypeScript typecheck, Next build, React hydration test, real routing/storage/save test, auth/tenancy test, e2e suite, actual PDF export, send/invoice/payment test, canvas measurement/coordinate test, accessibility certification, production deployment or live-service access.

## Integration gates

- HOME-01: connect bounded company-scoped recent work using documented routes and real lifecycle states. Undefined is not the same as an empty list.
- JOB-01: connect this quote's company-scoped related orders/invoices. Do not interpret an unbound prop as "none exist". Existing queue/create links already work through the existing destinations.
- Validate sidebar expand/rail/hide and browser resizing without child remount, canvas drift, lost draft data or focus jumps. Verify existing touch-immersive behavior still wins.
- Leave builder dropdowns/step navigation open through at least 90 seconds and several scoped bell polls; ensure the fixed reset/refresh issue does not return.
- Verify Summary snapshot persistence and all real PDF modes. Original snapshot/current measurement differences and embedded/full-preview tax handling are inherited issues, documented rather than silently fixed.
- Test all legacy Order/Invoice consumers of ActivityCardClient. New hub behavior is scoped through JobSpaceContext, not globally enabled.
- Verify modal stacking, explicit dismissal, keyboard focus restoration, print behavior, actual customer/labour PDFs and signed uploads.
- Preserve G01's owner-locked behavior and retain G02/G03/G05 owner retests.
- The brief reports a shared production database in some preview setups. A clone alone is not isolation. Gavin must confirm safe nonproduction DB, storage, auth, email, billing and integration settings before any workflow test. Merely viewing Summary can persist an original snapshot.

See INTEGRATION.md and CAPABILITY_PARITY.csv. Runtime statuses remain pending until Gavin records actual evidence and the owner approves the running preview.
