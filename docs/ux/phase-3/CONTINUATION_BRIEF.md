# QuoteCore+ | Fresh-chat continuation brief

Read alongside the LATEST integrated code ZIP and UI standard v2.3. **INTEGRATION RESULT 2026-09-24 (Gavin): Phase 3 integrated at commit 4c7ba900, deployed to quotecore-plus-testing, and owner-approved in browser the same evening.** Owner quote: the sidebar edge tab is "really nice" and overall Phase 3 "everything on it is great"; Job Spaces works but reads "a little busy" - a future pass should simplify the list presentation without removing capabilities. P3-LIST-01 is RESOLVED in code (authoritative company-scoped non-draft head-count feeds an honest partial-load warning when the unpaginated read cap is exceeded). Quotes and Drafts are unchanged and verified (QuotesList byte-identical). Next baseline for the external agent: quotecore-plus-phase3-integrated-2026-09-24.zip (contains UX phases 1+2AB+3 and Smart Assistant V2 P0-P4 code; the assistant UI/behaviour is under separate owner-led iteration by Gavin - do not restyle or restructure assistant-owned files without a new explicit instruction).

## Product and goal

Roofing/construction measurement, reusable component pricing and quoting SaaS. Users range from technology-resistant roofers in a van to full-time estimators. Quiet white/black/orange UI; one obvious next action; consistent reusable components, premium controlled gradients/glow, frosted overlays distinct from interactive glass. Do not hide capabilities to make screens look cleaner.

## Current architecture and approvals

- Phase 1 integrated and owner liked: existing four-step advanced quote builder visually migrated. Keep it. A guided/tutorial presentation comes later using the owner's other tool; do not invent or restructure it now.
- Phase 2AB integrated and owner approved on testing: collapsible app shell, action-led Home, card-driven Job Space on the existing Summary route. This supersedes the rejected conservative document-first Phase 2. Pricing summary is a deeper section, not the landing-page hero.
- Phase 3 candidate: ADD a Job Spaces list while retaining Quotes and its Drafts tab. One orange edge tab replaces two desktop navigation controls. See phase-3 docs for implementation/testing status.
- Current baseline supplied by owner: `quotecore-plus-phase-2ab-integrated-2026-09-24.zip`, including Smart Assistant V2 P0, HOME-01 wiring, original notification-refresh fix and real `/q-mark.png` branding. Latest owner instruction, not the old proposed "Draft quotes" split, wins.

## Locked scope/behaviour

No API/server-action/app-lib/schema/middleware/config/dependency/test-tooling edits by the external UI agent. Static work only: no app/services/installs. No browser alert/confirm/prompt; no emoji/em-dash UI; backdrop never dismisses modals; existing feature/plan gates remain. Return a full archive with same logical structure, root RETURN_NOTES and phase docs. One owner-approved phase at a time. Gavin integrates/runs tests/wires backend TODOs on an isolated preview.

Quotes remains at `/quotes`, with Drafts INSIDE it. Do not rename it Draft quotes or redirect it. Job Spaces at `/job-spaces` projects existing non-draft quotes, not a jobs table. Rows use existing Summary with `from=job-spaces`. New quote flow is unchanged.

Navigation: one visible desktop edge tab, expanded/fully hidden. Internal rail is not a user mode. Takeoff defaults hidden; normal builder follows normal preference. Preserve Q-mark asset, stored hidden preference, single mounted child tree, and refreshed notification fix. Mobile gets explicit-close drawer, not compressed icon rail.

Job Space should remain extendable for future project scheduling/tasks/team but no dummy controls or fabricated data today. Do not force Orders/Invoices as mandatory workflow stages.

## Open items to reconcile with Gavin's next update

- P3-LIST-01: RESOLVED 2026-09-24 (see integration result above). The UI keeps its optional nonDraftCount and partial/error states.
- JOB-01: linked orders/invoices was deferred by integrator; do not fabricate associations.
- HOME-01 already wired. No rework needed in this phase.
- Historical G01 remains behaviour-locked; reconcile G02/G03/G05 retest status with latest owner/integration evidence rather than inferring fixes.
- Real application build, full typecheck, auth/RLS, canvas resizing, mobile interactions and e2e belong to Gavin's environment. Static fixture results are not substitutes.

## Next work, only after approval

Agree the next bounded area using updated phase scope. Remaining families include takeoff chrome/measurement flow, customer/labour/order/invoice editors, Pricing Library/resources/templates, operational lists/settings, assistant/mobile and final consistency. Quotes-list redesign was explicitly NOT part of Phase 3. Guided builder and future project management are separate later projects. Mobile takeoff flow has locked order/state/pitch/draw invariants; do not casually rearrange it.

## Start prompt for next chat

Read the latest root INTEGRATION_UPDATE.md, RETURN_NOTES.md, this continuation brief and the current UX standard START_HERE.md. Confirm the exact approved baseline and proposed next phase before coding. Use only the newly integrated ZIP, not an old generated return. Preserve all scoped capabilities and provide a tracked full-code return plus any updated design-standard ZIP.
