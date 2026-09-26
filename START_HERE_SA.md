# P1.6 implementation return - 26 September 2026

Read `RETURN_NOTES.md` and `docs/SMART_ASSISTANT_RETRIEVAL_HANDOFF_2026-09-26.md` first.
This full source is based on the exact agent export documented below. New retrieval
capability is implemented but DEFAULT OFF; the additive SQL remains a draft.
Normal build, real PostgreSQL/RLS tests and live performance acceptance are required
before enablement. Existing Luna/P1.5/P2/P3 fixes are preserved; P4 stays off.

--- Original agent entry document (unchanged below) ---

# START HERE - Smart Assistant loop zip (2026-09-26)

This is the complete, current QuoteCore+ codebase (branch: ux/phase-4, commit history intact in the repo this was exported from). It is a strict superset of every previous SA handoff zip - nothing from your earlier work was dropped.

## Read this first

`docs/SA_HANDOFF_2026-09-26.md` - the full handoff for your next phase:
- What shipped since your last zip: facts + P1.5 speed layers live, P2 live, P3 write actions live AND owner-verified end-to-end (Ridge rate edit: proposal -> button confirm -> committed, full DB + audit chain verified)
- Two production case studies from today's owner tests (named-record resolution, flag/permissions verification discipline)
- Your scope, owner priority order: cross-quote rollups, ranking + resolution hardening, direct RLS-scoped DB reads
- Locked invariants + gotchas (model hotfix for reasoning_effort is in section 1 - read it before touching llmClient)

## What changed since the last SA handoff zip (2026-09-25 evening)

- Facts layer live: sa_v2_speed_scope / sa_v2_count / sa_v2_quote_snapshot RPCs, engine-backed totals + exact counts, 0-token turns
- Speed layer live + question-form expansion ("what's my latest quote" now hits the zero-LLM path)
- P2 attention migration applied + p2 flag live for RS Roofing
- P3 write actions enabled after acceptance battery (25/25 + 28/28) and verified live with the owner 2026-09-26 (propose-then-confirm edit flow, committed + audit-verified)
- Named-record resolution + draft identity prompt rules (unconditional, not speed-gated)
- Model hotfix: reasoning_effort must be none on tool turns for gpt-5.6-luna (upstream validation change)
- Unrelated to SA but in the tree: UX Phase 5 Document Studio, takeoff canvas UX pass, PWA icons

## Loop protocol (unchanged)

Return your work as a zip; Gavin LF-normalizes, drift-checks against this base, integrates phase-by-phase, runs gates (tests + build + harness), deploys to quotecore-plus-testing, and verifies with the owner before the next zip goes back. Never touch: conversions.ts constants, sa_finish_run service-role-only contract, quota protocol, propose-then-confirm write policies.

## If you think something is missing

List the exact file paths. This zip is a git export of the full committed tree - if a path you expect is absent, it was never in the committed repo (scratch files, .env.local, node_modules and .git are intentionally excluded). Ask via Shaun and Gavin will verify directly.
