# AGENTS.md — QuoteCore+ Repository Guide

One authoritative entry point. Supersedes all `START_HERE_*` files (now in `docs/history/`).

## What this is
Next.js 16 (App Router) + Supabase: construction/roofing quoting app, takeoff workstation, Smart Assistant v1/v2, billing (legacy Stripe tiers + custom billing), marketing site + free tools. One repo, domain-aware: `app.quote-core.com` (app), `quote-core.com` (marketing).

## Branch & deploy model (three-agent protocol)
- `development` = most advanced line → quotecore-plus-testing (CLI deploy; its git link is disconnected, pushes never build it)
- `main` = production line → quotecore-plus-main (git-linked; push = auto-build)
- Testing advances freely; main only advances from testing on owner go (Gavin's lane by default)
- Before any push: `git fetch origin`, rebase on the target tip. A rejected push means another agent moved the line — stop and announce.
- `npm run smoke:billing` on EVERY testing deploy. Hard rule.

## Validation gates (run before push)
- `npm run build` (must exit 0)
- `npx tsc --noEmit` (81 pre-existing errors = known baseline)
- `npm run test:roof-takeoff` / `test:topology` / `test:calibration` / `test:precision` (touchAiOutline unknown-level assertion quarantined 2026-10-29 with documented rationale: actual 10 vs expected 2, owner decision owed on fallback charge; suite green 19/19)
- `npm run check:billing` (billing guard, must be clean)

## Protected — do not touch without owner approval
- `docs/sa-*/validation/*.json` — regression fixtures; LOCKED_FILES/BASELINE_PROTECTED hash ~3k files. Update ONLY via `scripts/reconcile-locked-files.cjs` + `scripts/reconcile-baseline-protected.cjs` (run in that order) after intentional changes.
- `docs/DESIGN_SYSTEM.md` — required reading before ANY UI work
- All migrations — `backend/supabase/migrations/` + `supabase/migrations/` (two live roots, no ledger table; DB state is truth)
- `quote-core-roof-takeoff-*.tgz` — live `file:` dependency in package.json
- `app/lib/supabase/database.types.ts` — UTF-16LE by design; edit via node script only
- `docs/ux/phase-9/` — current UX standard. History archived to agent workspace 2026-10-20 (see `docs/REPO_CLEANUP_PLAN.md`).

## Cleanup ledger
See `docs/REPO_CLEANUP_PLAN.md` (audited 10-03, executed 10-20, stages A–E).
