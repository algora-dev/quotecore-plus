# START HERE - UX loop zip (2026-09-25, evening refresh)

This is the complete, current QuoteCore+ codebase (branch: ux/phase-4), a strict superset of every previous UX handoff zip - nothing was dropped. It refreshes the 13:38 phase-5 handoff with an afternoon of integrated work.

## What changed since the earlier phase-5 zip (13:38)

- Desktop takeoff: six owner-pass rounds landed (staged AI-scan review card with point stepper + undo/redo + crosshair selection, uncertain-line assignment to components, stage-aware guidance tips, compact active-component rows, colour stability on attach, in-card scan quality picker)
- Smart Assistant V2: model switched to gpt-5.6-luna + the P1.5 speed layer integrated (zero-LLM fast routes behind env flags, composite tools, telemetry). UX-relevant: `app/components/smart-assistant/v2/V2ChatClient.tsx` changed (TRANSPORT ONLY - page context now rides the turn request instead of a separate POST). If Phase 5 touches the assistant chat shell, build from this base, not an older copy.
- Brand: sidebar logo swapped to the new lockup (`public/MainQCP.png`); PWA/home-screen icons replaced (`public/icons/*`, `app/icon.png`, `app/apple-icon.png`)
- `START_HERE_SA.md` (root) is for the parallel Smart Assistant loop - ignore it unless working that lane

## Loop protocol (unchanged)

Return your work as a zip; Gavin LF-normalizes, drift-checks against this base, integrates phase-by-phase, runs gates (tests + build + harnesses), deploys to quotecore-plus-testing, and sends the next zip back. Never touch: pricing engines, measurement conversions, sa_finish_run service-role contract, quota protocol.

## If you think something is missing

List the exact file paths. This zip is a git export of the full committed tree - scratch files, `.env.local`, `node_modules` and `.git` are intentionally excluded. Ask via Shaun and Gavin will verify directly.
