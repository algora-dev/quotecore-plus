# START HERE - Smart Assistant loop zip (2026-09-25, evening)

This is the complete, current QuoteCore+ codebase (branch: ux/phase-4, commit history intact in the repo this was exported from). It is a strict superset of every previous SA handoff zip - nothing from your earlier work was dropped.

## Read this first

`docs/SA_HANDOFF_2026-09-25.md` - the full handoff for the next SA phase:
- Model decision: gpt-5.6-luna locked (benchmark table inside; re-validate any model change against the same 8-question suite)
- Owner-priority capability gaps: quote-total reads, cross-quote aggregation, direct RLS-scoped DB access (tables/columns, not UI-shaped projections)
- Locked invariants you must not break + phase gates P2-P4

## What changed since the last SA handoff zip (2026-09-24 evening)

- Your P1-P4 batch is fully integrated (6 modified + 38 new files, drift-verified, live on testing) - P1 navigation owner-tested working
- Desktop takeoff overhaul (UX phases 3-4 + six owner-pass rounds): staged AI scan review card, outline editing, uncertain-line assignment, guidance tips
- SA model switched to gpt-5.6-luna (code default + testing env)
- Sidebar logo swapped to the new brand lockup (public/MainQCP.png)
- 584 files newer than your last base zip

## Loop protocol (unchanged)

Return your work as a zip; Gavin LF-normalizes, drift-checks against this base, integrates phase-by-phase, runs gates (tests + build + harness), deploys to quotecore-plus-testing, and sends the next zip back with an integration update. Never touch: conversions.ts constants, sa_finish_run service-role-only contract, quota protocol.

## If you think something is missing

List the exact file paths. This zip is a git export of the full committed tree - if a path you expect is absent, it was never in the committed repo (scratch files, .env.local, node_modules and .git are intentionally excluded). Ask via Shaun and Gavin will verify directly.
