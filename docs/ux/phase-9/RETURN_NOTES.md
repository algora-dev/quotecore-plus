# Phase 9 return: completion, drawings and mobile/dialog hardening

**Status: implemented source candidate; Gavin integration and owner-device acceptance pending.**

Use this return instead of the interrupted attempt's screenshots. It was rebuilt from the accepted integrated baseline; screenshots alone were not treated as implementation evidence.

## Baseline and merge authority

- Input: `quotecore-plus-phase9-ux-handoff-2026-09-28.zip`
- Input archive SHA-256: `2a192a0fa3900af123e3776f5c6a4ad5779f00bc5d90130e18a52561b5323e26`
- 3219 original repository paths retained.
- Read `docs/ux/phase-9/HANDOFF.md` and `docs/ux/phase-8/INTEGRATION_UPDATE.md` for the original authoritative brief. Both remain unchanged.
- Exact touched paths and raw before/after hashes: root `FILE_CHANGES.json`. Documentation and validation artifacts are included, not only production source. The manifest excludes its own hash to avoid circular hashing.
- Never replace newer marketing, Smart Assistant, Takeoff or backend fixes wholesale. Three-way merge only declared changes against this exact archive; LF-normalized fallback is allowed for integration but manifest hashes are raw bytes.

## Implemented scope

1. **Drawings / Images**: persistent touch-visible library actions; upload/save/download/print error feedback; shared confirmation and preview dialogs; named-return links; fixed-coordinate drawing canvas in a contained scrollport; wrapping controls and independently reachable measurement actions; editable-value validation; keyboard shortcuts no longer steal text-field select-all/undo. Existing scale, coordinates, history, drawing modes, caps, units, saves and helpers remain owned by the existing engine.
2. **Angle tools and tutorials**: field-level angle validation, tap/click help replacing hover-only popovers, consistent controls, floating-tool viewport clamp, scrollable help/tutorial content and reachable tutorial footers. The modeless calculator remains modeless; its Apply does not close it. The modal version still closes after Add Angle. Calculations and tutorial/assistant launch data stay unchanged.
3. **Ordinary feedback**: quote-header template logo/save errors, Job Space file deletion and currency errors use the existing shared UI. No customer document rendering change.
4. **P7-API-01 / P7-INBOX-01**: distinguish real empty invoice-template results from provider errors; Inbox confirms only returned row IDs, retains failed rows/selection, warns on partial results, and does not claim a server rollback after an unconfirmed request. Archive source-entity helper unchanged; only confirmed archived IDs are passed to it.
5. **P7-CACHE-01**: exact template and supplier destinations are invalidated after existing successful mutations. Supplier list props reconcile after explicit success refresh; no polling, no notification-driven refresh, no profile-draft reset.
6. **Manifest**: exact `/manifest.webmanifest` bypass in the existing static-asset classifier. Source showed it was otherwise eligible for auth/canonical HTML redirects. The existing Next metadata source and PWA behaviour are unchanged; deployment must prove the manifest is served as JSON.

## Deliberately not changed

No marketing/public-lane, Smart Assistant, Takeoff, mobile-measurement, Advanced Builder, recipient document-renderer, pricing-engine, DB/schema, package/dependency, entitlement or billing-rule edits. Nine existing server-action modules change only cache invalidation. Two API routes and one exact middleware condition are the explicit Phase 9 exceptions; do not describe the entire backend as untouched.

Locked owner changes remain: `/resources/new` redirects to the Resources **hub**; Quotes has no Resource Library button; catalogue Actions column remains 190px; the real `/q-mark.png` remains; Generic Trades and the notification remount fix are retained.

## Evidence and release gate

- 29 isolated API/outcome contract checks passed.
- 48 actual-source callback checks passed under a substituted-boundary state evaluator.
- 33 source invariant checks passed, including raw hashes for 1191 explicitly protected paths and 29 unchanged named drawing functions.
- 105 Chromium specimen checks passed: 20 source layouts at five viewports (100 fit checks), three native-dialog/background-focus checks and two long-tutorial/footer checks.
- 62 authenticated workspace page routes inventoried; 4 pure return-mapping checks passed. Route inventory is **not** a live mobile audit certificate.

No Next application build, full semantic TypeScript check, authenticated browser journey, real Supabase/Stripe operation, Fabric gesture/history test, print/download integration or physical-device test was performed here. Harnesses disable effects or substitute boundaries as documented. Gavin performs these gates; no dependency bundle is required.

Start with `docs/ux/phase-9/INTEGRATION.md`, then `RUNTIME_CHECKLIST.md`. Existing engine/unit and protected-native-feedback residuals are recorded in `AGENT_TODOS.md`. Do not declare every part of the app/device experience complete on the strength of static specimens.
