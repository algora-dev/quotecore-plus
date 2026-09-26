# RETURN NOTES — P1.7 Retrieval Intelligence & Reliability

## Status and provenance

**Implemented, offline-verified, not deployed.** Based on the supplied 26 September
2026 next-phase agent ZIP (`ux/phase-4`, agent export commit `a18f4ab9`). Reconcile
against any newer agent branch before integration. New server flag defaults OFF.
This package does not establish live latency, real database isolation, a successful
production build, or browser navigation acceptance.

Prior root notes are preserved in `docs/sa-p17-2026-09-26/baseline/`. The latest
baseline's actual live P1.6 state supersedes historical “default off” text in those
older documents. Original integration reports and test evidence remain unchanged.

## Implemented

- **Deterministic composite resolution:** 10 registered parent/child paths use a
  bounded parent resolution followed by a database-constrained child query. Parent
  ambiguity stops the operation. Child name search is field-specific, avoiding a
  job name accidentally supplying the apparent component match.
- **One-call named-component proposal preparation:** the existing P3
  `propose_component_change` accepts a gated structured `selection`. It resolves
  parent/child, revalidates their relationship in the authoritative P3 snapshot,
  and creates the existing reviewed proposal. It NEVER confirms or commits.
- **Semantic normalization:** a small explicit business vocabulary maps unpaid
  invoices and saved/builder quote-value aliases to existing authoritative fields.
  Unknown statuses, discarded qualifiers and invalid negations are rejected.
- **One rejected-plan repair allowance:** P1.7 retrieval tools share one correction
  allowance; a second rejected plan forces a tool-free explanation. Existing hard
  hop/tool limits and repeat suppression remain. Metadata/one rejected plan may
  precede a trusted deterministic reply without an unnecessary synthesis call.
- **Generalized ranked rows and grouped rollups:** stored data is ranked/grouped in
  the invoker RPC; derived quote values use existing engines. Full filtered-input
  evidence is computed BEFORE display limits, including missing values in omitted
  groups, currency/unit compatibility, rank and ties. No sampled winner is claimed.
- **Focused placed-component navigation:** cards carry a parent quote + exact child
  identity; navigation freshly verifies the relationship and permissions. A minimal
  existing-builder bridge expands/focuses that loaded component. Reusable library
  components retain their different navigation identity.
- **Evidence/harnesses:** 50 live/manual acceptance specifications, opt-in repeated
  HTTP benchmark, offline telemetry report and guarded read-only database probes.
  They do not silently create fixtures, submit confirmation, change flags or seed
  large data. The database probe refuses the real owner testing company.

## Preserved boundaries

207 locked baseline files are byte-for-byte unchanged, including all **178 original
migrations**, dependency manifests, the model client/config files, original registry
JSON, selected quota/turn infrastructure, pricing/currency engines and conversions.
See `docs/sa-p17-2026-09-26/validation/LOCKED_FILES.json`.

No arbitrary model SQL, no account selector, no shadow business database, no new
registered business sources. Existing 16-source scope and RLS invoker architecture
remain. No change to `sa_admit_run` / reservation / replay / trusted `sa_finish_run`.
Existing P2/P3 confirmation, audit, permissions and rollout policies remain. No P4,
knowledge rollout, new order mutation system, visual redesign, microphone, PWA or
streaming transport. The two general quote component files only receive the narrow
assistant navigation/focus bridge; no pricing, data-save or layout change.

## Rollout — do not skip

1. Read the technical handoff and database acceptance gates. Compare this package
   with the latest integration branch; preserve newer unrelated fixes.
2. Install dependencies; run offline suites, full typechecking, lint, Next build
   and targeted browser tests. P1.7 stays off during baseline verification.
3. Review/test ONLY `backend/supabase/migrations/20260926190000_sa_v2_retrieval_v17.sql`
   in an appropriately isolated database environment. Real SQL/RLS, role grants,
   permissions, scope, ranking, engine and timeout checks are mandatory. The draft
   adds an invoker RPC and extends capabilities; it does NOT enable any company.
4. After those gates, use `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true` on the intended
   testing deployment only, retaining existing P1.6 gates. Keep P4/knowledge off.
   Do not widen the owner's one-company live testing rollout.
5. Prove runtime telemetry has `intelligenceActive=true`, `intelligenceVersion=1`
   and the composite tool available; do not infer activation from an environment
   label alone. Compare identical fixtures and prompts with P1.7 off/on.
6. Run real Luna repeatability/latency and owner workflows, including proposal ->
   button confirmation -> normal mutation/audit, without harness auto-confirmation.

Rollback: set the P1.7 server flag false. Existing P1.6 remains available; retain the
additive reader/capability metadata. Already-stored focused navigation cards still
use fresh authorization; rollback does not invalidate or auto-confirm proposals.

## Validation actually run

**609/609 executable offline checks passed:** 383 retained baseline checks plus
132 P1.7 core, 45 service/boundary, 12 diagnostics/harness, and 37 corpus checks.
The last 37 comprise corpus structure plus illustrative plan/selection validation;
they are NOT 37 human-language or model accuracy passes.

Syntax passed across 80 assistant TypeScript/TSX files plus the 2 quote components.
The registry's 16 sources / 339 physical-column references passed static comparison
with the supplied generated types. Both migration generators pass `--check`.
Source/SQL structural and locked-file checks pass. These are not PostgreSQL parsing
or RLS execution. See the exact commands/logs in the validation document.

`npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000`
was attempted and failed with npm **“Exit handler never called!”**. Full project
`tsc --noEmit --incremental false` was attempted and blocked by missing dependency
type libraries. No successful lint/build/full typecheck is claimed. The incomplete
install residue is not shipped. PostgreSQL, actual Supabase/Luna calls and browser
E2E were not available/run here. No production latency figures were generated.

## Intentional limits / agent follow-up

Engine-derived analytics remain all-or-refuse at <=200 matching quotes and the
existing child/payload limits. No capacity increase is implied. Stored ranking must
scan the actual filtered population; top-N output is not proof of cheap execution.
100k catalogue EXPLAIN/BUFFERS and effective PostgREST/caller cancellation remain
live gates, not completed tests. The 8s SQL setting alone is not a wall-clock SLA.

Blank-entry quotes do not acquire a fabricated placed-component focus route.
Other nested sources may navigate to their existing parent page, not a new inline
editor. Grouping customer/component names is grouping stored labels, not a new
customer identity model. No aggressive “5” -> “5th mob” guessing was introduced.

## Package guide

- `docs/SMART_ASSISTANT_P17_HANDOFF_2026-09-26.md`: implementation/contracts/rollout.
- `docs/sa-p17-2026-09-26/DATABASE_ACCEPTANCE.md`: real SQL/RLS/scale/browser gates.
- `docs/sa-p17-2026-09-26/ACCEPTANCE_CASES.json`: 50 test specifications.
- `docs/sa-p17-2026-09-26/AGENT_INTEGRATION_PROMPT.txt`: concise integration brief.
- `docs/sa-p17-2026-09-26/validation/`: actual offline results and limitations.
- `CHANGED_FILES.json`: baseline/new SHA-256 plus LF-normalized comparisons.

Return real timings (model calls, retries, composite reads, RPC/network time, trusted
finish time), correctness and remaining failures after integration. Do not call
P1.7 live-accepted merely because the offline suite is green.
