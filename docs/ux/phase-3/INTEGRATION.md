# Gavin integration protocol | Phase 3

## Start

Use the integrated Phase 2AB testing tree as the baseline. Do NOT replay rejected Phase 2 or restart from Phase 1. Read root RETURN_NOTES.md and the preserved INTEGRATION_UPDATE.md. Owner approved 2AB in chat after the historical update was written. Preserve newer assistant/mobile work and the real Q-mark assets.

Apply the returned source changes to a dedicated UX branch, reconcile against current main, then run your normal dependency install/typecheck/build/lint/e2e in your environment. This external pass did not run the app, install packages or connect to a service. A testing hostname alone does not isolate databases/email/payments; check those services before mutation tests.

## Two independently reviewable/shippable batches

### Batch A - Additional Job Spaces index

New route + JobSpacesList/model/CSS; shared QuoteIndexPage and original Quotes page wrapper; Summary's allowlisted return-context lines; Job Spaces nav entry, label and active-state hunks in `shell-config.ts`.

No dependency on QcSidebarTab. It can operate under the previous shell. QuotesList.tsx is byte-identical; its source JSX/data-loading blocks were mechanically preserved in QuoteIndexPage. `/quotes` does not redirect and still includes Drafts. New quote remains gated by its existing route/controls.

Run P3-LIST-01 before claiming complete coverage for large companies. Compare Quotes before/after for cap/plan states, confirmed/draft switching, search, statuses, all create modes, bulk controls and all original routing.

### Batch B - Single orange sidebar tab

QcSidebarTab, sidebar-state, QcAppShell, qc-shell.css, and ONLY the defaultMode hunk in `shell-config.ts`. This batch has no import dependency on the Job Spaces route. It can ship over the old list/navigation. When staging separate commits, stage the shared shell-config file by hunk; do not roll back the other batch by copying the whole file.

Normal editors now follow the expanded/hidden preference rather than auto-forcing a rail. Takeoff's default is still hidden. No width-mode, builder state or takeoff engine change. Internal rail rendering keeps `/q-mark.png`. Treat sidebar resizing as a required canvas regression gate.

Use both batches together for the owner's main preview. Docs, design standard v2.3 and the continuation brief travel with the integration. No runtime flag, config or dependency is added.

## Required checks

1. Full TypeScript/Next build and changed-file lint. The shared server presentation must remain a server component. Do not mark it `use client` to resolve an import issue.
2. Pure checks: `node docs/ux/phase-3/check-pure-functions.cjs` after your ordinary install. They use the existing TypeScript dev dependency and no services.
3. Work through PARITY_CHECKLIST.md / CAPABILITY_PARITY.csv. Confirm tenant isolation, failed reads, all non-draft statuses, large result sets and string quote numbers.
4. Test normal navigation, hidden mode, old saved rail preference, browser Back/Forward, internal rail, route overrides, keyboard/touch, short viewports and mobile drawer scrolling/explicit dismissal.
5. Leave builder fields/disclosures open through several old polling intervals. Toggle navigation repeatedly. Confirm no reset, no unsolicited step navigation, no lost entries and no restored notification-refresh bug.
6. Takeoff: before/after shell hide/show, verify zoom, pan, cursor-to-canvas alignment, drawing accuracy, selected tool, unsaved state and touch immersive chrome. Main width changes once, but only real Fabric interaction proves parity.
7. Send/PDF/editor actions are unchanged, but smoke their entry points from the hub because shell dimensions affect layout. Do not publish until the owner approves the new preview.

## Return to owner

Give the owner the preview URL and a short resolved/open list, especially P3-LIST-01. Then export a new FULL integrated ZIP with a refreshed INTEGRATION_UPDATE.md. Keep RETURN_NOTES/history rather than losing the migration record. The next chat should start with that integrated ZIP and UI standard v2.3, not this candidate or an earlier package.
