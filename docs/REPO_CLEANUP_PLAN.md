# QuoteCore Plus Repository Cleanup Plan

Audit date: 2026-10-03. Auditor: Gavin (session agent). Audit-only run: no files were deleted, moved or modified. This plan is the only new file.

## Executive Summary

**Overall rating: HIGH entropy in documentation/artifacts, LOW entropy in product code.**

The application itself (`app/`, `lib/`, `components/`, `backend/`, `supabase/`, `e2e/`, `scripts/`) is well-structured and load-bearing. Virtually all entropy sits in **inert material**: `docs/` (74.4MB across 1,299 files, including 438 loose markdown files at its root), committed local-machine artifacts (including a literal Windows temp path), agent memory committed to git, root-level one-per-return agent files, a second near-empty documentation root, and an 11MB raw log. None of it affects the build — which makes this cleanup **low risk, high polish**.

Headline findings:
- `docs/ux/` = **48.6MB** of HTML design fixtures (the single largest block)
- `docs/sa-p172-2026-09-28/validation/typecheck-attempt.log` = **11MB** raw log
- `UsersJimmyAppDataLocalTemp/` = a literal Windows temp directory committed at repo root (entered via commit 89de572e)
- `memory/` = agent daily notes committed to git (June–July era, commit 7ac2429d)
- Six `START_HERE_*.md` files at root + `RETURN_NOTES.md` + two changed-file manifests + empty `AGENTS.md` (0KB) + empty `README-DEV.md` (0KB)
- `.gitignore` tail is **corrupted** (a UTF-16-encoded attempt to ignore the temp dir — the rule never worked)

## Current Validation Baseline

Verified 2026-10-03 during three folds (offcuts V2.14, SA Workflow V1, outline-edit-mode). All numbers are the *pre-cleanup* state; cleanup stages must reproduce them exactly.

| Check | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | 151 errors | ALL pre-existing (test files + free-tool baseline); 0 introduced by any 2026-10-03 fold |
| `npm run lint` (full repo) | 9,534 problems | Pre-existing; script is bare `eslint`; scoped lint on changed files is the working convention |
| `npm run build` | exit 0 | Verified 3× today |
| `npm run test:roof-takeoff` | 48/48 | |
| `npm run test:topology` | 11/11 | |
| `npm run test:calibration` | 223/223 | |
| `npm run test:precision` | 184/184 | |
| Offcuts package suites | 541/541 node + 222/222 browser | Package tree (workspace zip), incl. V2.14 |
| SA workflow offline | 30+20+23 + static + protected baseline | All green |
| SA legacy suites | 13 green; 4 fail on react.cache loader (pre-existing env issue); 3 source-checks fail on stale Sept locks | Documented, pre-dates all 2026-10 folds |
| E2E (Playwright) | Not run in audit | Requires deployed env; not needed for inert-file cleanup |

## Architecture Understanding (summary)

Next.js 16 App Router app + Supabase. Production-critical systems: quotes/builder (`app/(auth)/[workspaceSlug]`), takeoff workstation (canvas, calibration, AI scans, offcuts V2.14 in `app/lib/takeoff/`), Smart Assistant v1/v2 + Workflow Controller (`app/lib/smart-assistant/`, RPC-backed with RLS), billing/Stripe (`app/lib/billing/`), pricing engine (`app/lib/pricing/`), public marketing + free tools (`app/(public)/` incl. free-roof-takeoff, supplier-pricing-tool), PWA/push (`app/lib/pwa/`, service worker), two migration roots (`backend/supabase/migrations/`, `supabase/migrations/` — both live, no ledger table; DB state is source of truth), Playwright e2e (`e2e/`), regression battery (`scripts/`, incl. source-checks that read `docs/sa-*/validation/*.json` fixtures), local dependency `quote-core-roof-takeoff-0.1.0-prerelease.1.tgz` (referenced by package.json).

## GREEN — High-Confidence Cleanup

1. **Path:** `UsersJimmyAppDataLocalTemp/` (7 PNGs, 32KB)
   **What:** component-guide images committed from a Windows temp staging path. **Origin:** commit 89de572e. **Evidence unused:** no code references (the UI uses inline SVGs; a code comment points at `docs/component-guides/*.svg`, the proper copy). **Risk:** none to build. **Action:** delete + remove hash entries from the locked manifests (see coupling note below) + fix the corrupted `.gitignore` tail.
2. **Path:** `docs/sa-p172-2026-09-28/validation/typecheck-attempt.log` (**11MB**)
   **What:** raw typecheck log. **Action:** delete (git history preserves). Single largest removal.
3. **Path:** `memory/` (10 files, 53KB)
   **What:** agent daily notes (June–July). **Origin:** commit 7ac2429d ("docs(debrief)"). The live memory system belongs to agent workspaces, not the repo. **Action:** delete.
4. **Path:** `projects/quotecore-plus-development/app/api/supplier-upload/route.ts` (1 file)
   **What:** stray nested-copy artifact. **Action:** delete (whole `projects/` dir).
5. **Paths:** root `RETURN_NOTES.md`, `CHANGED_FILES.json` (23KB), `WORKFLOW_CHANGED_FILES.json`, `AGENT_INTEGRATION_WORKFLOW_V1.md`
   **What:** 2026-10-02/03 handoff manifests already preserved under `docs/sa-workflow-controller-v1-2026-10-02/`. **Action:** delete root copies.
6. **Path:** `header_fix.py` — one-off script, no references. **Action:** delete.
7. **Paths:** root `AGENTS.md` (0KB) and `README-DEV.md` (0KB) — empty files. **Action:** delete both (a real `AGENTS.md` is proposed under BLUE).
8. **Path:** `demo-shots/` (5 screenshots, 615KB) — committed during takeoff phase work; no references. **Action:** delete.
9. **Path:** `docs/smoke-tests/test-catalog-over500kb.csv` (781KB) — a catalog of large files (itself the largest non-log doc). **Action:** delete.
10. **Path:** `.gitignore` corrupted tail — UTF-16 mangled line. **Action:** replace with a working `UsersJimmyAppDataLocalTemp/` ignore entry (encoding fixed).
11. **Path:** `docs/SMART_ASSISTANT_P1_P4_FILE_MANIFEST.json` (699KB) — superseded P1–P4 mega-manifest. **Action:** delete AFTER verifying at execution time that no check-script reads it (greps show only the locked manifests, which are different files).

**Coupling note (critical):** items 1's files (and several others like `AngleImages/`, `demo-shots/`) are hashed inside `docs/sa-p171-2026-09-27/validation/LOCKED_FILES.json` and `docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json`. Deleting the files without removing their manifest entries makes `check-smart-assistant-resolver-source`/`check-smart-assistant-task-quality-source` fail. Every GREEN deletion therefore ships with its manifest-entry removal, and those check scripts must re-run green in the same stage.

## BLUE — Consolidate (phase 2, needs approval; nothing moves yet)

1. Six root `START_HERE_*.md` → `docs/history/` (superseded entry points). Replace with one real root `AGENTS.md` (product map, validation commands, protected-list pointers — ~30 lines).
2. `BRANDING.md`, `DESIGN_CHANGES.md`, `VERCEL-SETUP-DEV.md` → `docs/current/`.
3. `documentation/` (4 implementation notes) → merge into `docs/` and remove the second doc root.
4. 438 loose `.md` at `docs/` root → organize into `docs/history/<topic>/` (SMART_ASSISTANT_*, supplier notes, SEO docs → `docs/marketing-site/`, etc.).
5. `docs/ux/` 48.6MB → owner decision: keep canonical standard only (v2.14) and archive phase-1…8 fixtures, or move the full history to the design workspace (already canonical there).
6. `AngleImages/` (49KB) → verify byte-identity with `public/angle-calculator/` copies, then delete root dir (GREEN once proven).

## AMBER — Verify more before touching

- `public/` (51MB): spot-audit for unreferenced images only via a reference-check script; no bulk deletion.
- `docs/sa-*` screenshots/evidence (e.g. `VISUAL_OVERVIEW.jpg` 404KB): archive-in-place or move to `docs/history/`; do not delete (acceptance trails).
- `docs/archive/` (1.45MB): already archived; keep unless owner wants it out of the repo.

## RED — Preserve (weird but necessary)

1. `quote-core-roof-takeoff-0.1.0-prerelease.1.tgz` — **live dependency** (package.json `file:`).
2. `docs/sa-*/validation/{LOCKED_FILES,BASELINE_PROTECTED,BASELINE_INTEGRITY,ACCEPTANCE_CASES,EVALUATION_CASES}.json` + all suite fixtures — regression suites read them; their absence broke suites in the external agent's env (proven 2026-10-03).
3. `app/lib/supabase/database.types.ts` — UTF-16LE by design (edit via node script only).
4. All migrations incl. `backend/supabase/BACKUP_2026-04-04_schema_snapshot.sql`.
5. `docs/DESIGN_SYSTEM.md` — actively load-bearing (required reading before UI work).
6. `docs/sa-workflow-controller-v1-2026-10-02/` incl. `evidence/` — current acceptance trail.
7. `e2e/`, `emails/`, `content/`, `packages/`, all of `app/`+`lib/`+`components/`+`scripts/`, `.env.e2e.example`.

## Agent Context Assessment

Authority is fragmented: six root `START_HERE_*` entry points from different eras, 438 loose docs, two doc roots, an empty root `AGENTS.md`, plus per-agent workspace context outside the repo. A cold-start agent meets contradictory guidance (e.g. `START_HERE_SA.md` vs `docs/sa-workflow-controller-v1-2026-10-02/RETURN_NOTES.md`). **Fix:** one authoritative root `AGENTS.md` + `docs/README.md` index + everything else explicitly historical. Less context, higher signal.

## Proposed .gitignore Improvements (execute in phase 2)

- `UsersJimmyAppDataLocalTemp/` (working encoding), `memory/`, `demo-shots/`, `*.log` under docs validation dirs, `*.tsbuildinfo` already present; do NOT add `*.tgz` (dependency must stay committable).

## Estimated Cleanup Impact

- GREEN: ~30 files / 3 root dirs removed, ≈ **13MB** off the working tree (one 11MB log dominates), zero build impact.
- BLUE (approved separately): docs root 438→<20 loose files; `docs/ux` decision can remove up to **48.6MB**; total tree reduction potential ≈ 60% of non-`public/` repo weight.
- Risk: LOW — all GREEN items are code-unreferenced; only coupling (locked manifests) is handled in-stage; full gate suite + testing deploy gate every stage.

## Proposed Execution Sequence (after approval; recommended after the main push so we clean a stable line)

- **Stage 0:** fix `.gitignore` tail.
- **Stage 1:** GREEN deletions + locked-manifest entry removals → full gate suite identical-green (incl. the three manifest-reading source checks).
- **Stage 2:** branch → deploy to testing → parity check → merge (normal pipeline, never direct to main).
- **Stage 3:** BLUE consolidation (AGENTS.md, START_HERE relocation, docs organization, ux fixtures per owner decision).
- **Stage 4:** prune 12 dead remote branches (`darren/offcuts-v1`, `development`, 10 ancient feature branches — containment-verified 2026-10-03) + `.gitignore` hardening.

## Items Requiring Owner Approval

1. `docs/ux/` 48.6MB: keep canonical-only in repo, archive subfolder, or move history to the design workspace?
2. Delete `docs/archive/` + sa-* screenshots from the tree (git history retains) — yes/no?
3. I draft a real root `AGENTS.md` (pointers, ~30 lines) — yes/no?
4. Branch pruning list (12 branches) — approved?
5. `SMART_ASSISTANT_P1_P4_FILE_MANIFEST.json` deletion after script-reference verification — approved?

*Non-repo phase 2 (separate effort): agent workspace context slimming (MEMORY.md is 114KB and injected every session) and side-project/zip retirement.*

## Owner Decisions (2026-10-03 11:57, voice)
1. UX fixtures: **keep current standard (v2.14) only** in repo; history moves to the design workspace archive. APPROVED.
2. Screenshots + docs/archive out of the working tree: APPROVED (with per-item reference checks at execution).
3. Real root AGENTS.md drafted by Gavin: APPROVED.
4. Branch pruning (12 dead branches): APPROVED � everything remains recoverable: all pruned branches are fully merged into or superseded by ux/phase-4, so git history retains every commit; only pointers are deleted. Owner will have smoke-tested offcuts before execution.
5. SMART_ASSISTANT_P1_P4_FILE_MANIFEST.json deletion after final script-reference check: APPROVED.

Execution: tomorrow (2026-10-04), after the main push, starting with a delta re-audit of anything landed overnight.
