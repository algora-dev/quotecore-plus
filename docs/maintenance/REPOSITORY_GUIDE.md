# Repository Documentation Guide

**Purpose:** navigation index for the `docs/` tree — tells a new developer or coding agent what is current, what is historical, and what is protected. It changes nothing else.

**Basis:** audited against `development` at `268ea659` on 2026-11-13. Statements below carry the dates recorded in their source documents; nothing here was re-verified at audit time unless stated.

**Authority order for repo protocol** (unchanged by this guide): root `AGENTS.md` first, then the current references below. When a document conflicts with deployed behaviour or live database state, the deployed state wins (see the authority hierarchy in `docs/current/CURRENT_TRUTH.md`).

---

## Start here

| Path | What it is |
|---|---|
| [`AGENTS.md`](../../AGENTS.md) (repo root) | The single authoritative entry point: branch/deploy model (three-agent protocol), validation gates, protected-paths list. Do not edit without owner approval. |
| `docs/testing/EVIDENCE_MATRIX.md` | What each verification command proves, where it last ran, and what is knowingly skipped. The source of truth for test evidence. |

## Current, load-bearing references

| Path | Purpose | As of |
|---|---|---|
| `docs/current/CURRENT_TRUTH.md` | Canonical product/business snapshot (business model, capability status, deployment map, billing model). Last reviewed 2026-08-05 at `fcad15ab` — infrastructure specifics (Supabase project, Vercel map) predate later consolidation; treat deployed state as newer. | 2026-08-05 |
| `docs/ARCHITECTURE.md` | Engineering map: route surface, data layer, billing resolver, AI systems, background work, gates. | 2026-10-29 |
| `docs/DESIGN_SYSTEM.md` | UI authority. **Protected** — required reading before any UI work. | — |
| `docs/ux/phase-9/` | Current UX standard (earlier phases are history). | — |
| `docs/smoke-tests/CHECKLIST.md` (top section) + `docs/smoke-tests/README.md` | Billing-matrix smoke test — hard rule on every testing deploy. The rest of CHECKLIST.md is historical (see its README). | — |
| `docs/db/MIGRATION_INVENTORY.md` | Migration policy: two live roots, no ledger table, live DB is source of truth. | — |
| `docs/security/RATE_LIMIT_AUDIT.md` | Rate-limit posture; AI-spend paths fail closed. | — |
| `docs/billing/LEGACY_RETIREMENT_PROPOSAL.md` | Active owner-read; decision pending. | — |
| `docs/debt/TSC_TRIAGE.md` + `scripts/debt-baseline.json` | Type/lint debt baselines (tsc 81 / lint 8,704 recorded 2026-10-30) and the incremental paydown plan. | 2026-10-29 |
| `docs/REPO_CLEANUP_PLAN.md` | 2026-10-03 audit + 2026-10-20 executed cleanup (stages A–E COMPLETE). Read to avoid repeating past cleanup work. | 2026-10-20 |

## Historical records — do not follow as instructions

These are evidence/records of past work. Never delete without owner approval; never treat their procedures as current.

| Path | What it holds |
|---|---|
| `docs/history/` | Superseded `START_HERE_*` entry points and past return notes. |
| `docs/sa-*` (2026-09 era) | Smart Assistant acceptance trails. Their `validation/` fixtures are hash-locked (below). |
| `docs/ux/phase-1..8`, `docs/ux/completion-*`, `docs/ux/experience-*` | Superseded UX fixtures; phase history archived to the design workspace 2026-10-20. |
| `docs/demo-v2.2/` + root `FILE_CHANGES.json` + `BUILD_INFO_DEMO_V22.json` | Demo V2.2 external-return record. Still consumed by `scripts/demo/` offline checks (`lint-changes.cjs` defaults to root `FILE_CHANGES.json`) — load-bearing, do not remove. |
| `docs/marketing-site/` | Past external marketing returns/handoffs. |
| `docs/pwa-session-2026-10-04/`, `docs/demo/`, `docs/reviews/`, `docs/audits/`, `docs/plans/` | Dated session/plan records. |
| `docs/current/BRANDING.md`, `DESIGN_CHANGES.md`, `VERCEL-SETUP-DEV.md` | Reference material kept from the 2026-10-20 consolidation; verify against live config before use. |

## Protected / hash-locked — never edit without owner approval

- `docs/sa-*/validation/*.json` — four manifests (`sa-p17`, `sa-p171`, `sa-p172`, `sa-retrieval`) hash ~3k files. Update only via `scripts/reconcile-locked-files.cjs` then `scripts/reconcile-baseline-protected.cjs`, in that order.
- `docs/DESIGN_SYSTEM.md`, all migrations (`backend/supabase/migrations/`, `supabase/migrations/`), `quote-core-roof-takeoff-*.tgz` (live `file:` dependency), `app/lib/supabase/database.types.ts` (UTF-16LE — edit via node script only).

## Known open risks (as recorded 2026-10-30)

- tsc 81 / lint 8,704 baselines — paydown plan in `docs/debt/TSC_TRIAGE.md`; ratchet forbids growth.
- `check-smart-assistant-p17-source` + `resolver-source` RED since Sept (generated SQL drift vs generators).
- CI v1 has no `next build` (env strategy pending) and no browser E2E (run ad hoc vs testing).
- Two migration roots, no ledger — DB state is truth; reconciliation is a known follow-up.

## Root artifact audit (2026-11-13, this guide's accompanying run)

Audit-only; nothing was deleted. Evidence: `git grep` over the full tree, `git log` per file, and entry checks against all four locked manifests.

| Path | Size | Origin | References | Verdict |
|---|---|---|---|---|
| `smoke-server.log` | 2.3 KB | `ab5edf45` 2026-11-01 (local `next start` log swept into the marketing merge) | none anywhere in tree; not in any manifest | **SAFE TO PROPOSE** for deletion (owner approval required) |
| `FILE_CHANGES.json` | 27 KB | `06fb6f92` 2026-10-04 (Demo V2.2 return fold) | `scripts/demo/lint-changes.cjs` default; `docs/demo-v2.2/TESTING.md`+`VALIDATION.md` procedures | **RETAIN** — consumed by demo offline checks |
| `BUILD_INFO_DEMO_V22.json` | 0.7 KB | same | manifest entry inside root `FILE_CHANGES.json` only | **RETAIN** — paired with the demo record (its `read_first` target now lives in `docs/history/`) |
| `docs/marketing-site/FILE_CHANGES.json` | 0.9 KB | marketing return | hash entry in `BASELINE_PROTECTED.json` (sa-p172) | **RETAIN** — protected |
| `docs/ux/completion-2026-10-03/FILE_CHANGES.json` | 8.4 KB | UX completion handoff | none in tree; not in any manifest | **SAFE TO PROPOSE** (historical evidence; zero gain beyond tidiness) |

## Maintenance

- New "current" documents get a row above; anything they supersede moves to the historical section — never deleted.
- Keep entries dated. Don't present historical checks as freshly executed.
