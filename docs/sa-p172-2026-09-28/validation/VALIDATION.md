# P1.7.2 validation evidence

## What actually ran

`node scripts/run-smart-assistant-task-quality-offline.mjs` exited 0 against the returned source.

**976 executable offline checks passed across 18 suites: 812 retained, 164 new.** The retained 37-case P17 corpus checks verify corpus structure/example plans, not live language understanding. None of these numbers denotes real Luna evaluations or database security cases.

New checks: 65 boundary/interpretation, 24 continuous conversation, 22 real scope/orchestrator/store with explicit transports, 21 task HTTP route/body/auth-mock, 32 pure failure/presentation/diagnostic checks. Tests are executable Node tests through the existing TypeScript transpile loader. A mock transport explicitly supplies test records; no real quote/account was queried or edited.

Evidence: `all-offline.log`, `task-suite.tap`, `offline-summary.json`. `owner-sequence-offline.json` records plans, mock selected results, task disposition and read counts for the owner's four sentences in one simulated conversation. It is NOT live latency, real account correctness or a Luna transcript.

Additional executed checks:

- TypeScript/TSX syntax across **103 assistant files**, plus the existing P17 syntax check of the two quote components. Syntax/transpilation is not a semantic typecheck.
- Existing speed/retrieval/P17 static source checks passed; registered 16 sources and 339 physical-column references unchanged.
- New static task-source check passed for metadata structure/grants/identity guards and all **3,197 protected baseline files**, including all **180 original migration SQL files**, the original turn HTTP route, model config/reasoning client, pricing code and unrelated UX.
- 13 resolver source adapters still map to registered bounded fields.
- New SQL was inspected structurally only. There is no PostgreSQL parser or actual RLS execution here.

## Baseline checker issue kept visible

Before changes, `node scripts/run-smart-assistant-resolver-offline.mjs` executed all 812 checks successfully but failed its historical final source-hash check at `DESIGN_CHANGES.md`. The latest agent ZIP contains later UX changes not reflected in that older P171 locked manifest. That checker is unchanged. See `baseline-offline.log` and `historical-resolver-source.log`.

The P172 runner retains all original executable assertions and the still-valid speed/retrieval/P17 static checks, then checks protection against the ACTUAL 28 September baseline with `check-smart-assistant-task-quality-source.cjs`. This is not permission to ignore arbitrary drift in the agent branch. Reconcile intentionally changed files against `FILE_CHANGES.json`.

## Typecheck attempted, not passed

Executed `tsc --noEmit --incremental false --pretty false` on BOTH the untouched latest baseline and final implementation. Both exited 2 in the environment without the project's React/Next/Supabase/Node type dependencies. Baseline: **66,920 diagnostic entries**; implementation: **66,948**. Compare by file/code/message, ignoring line movement, in `typecheck-delta.json`.

Additional diagnostic patterns are missing Next/Supabase/Node declarations and JSX/implicit-any cascades in newly added UI code. This comparison is evidence about the blocked attempt, NOT semantic typecheck parity in a working application environment. Full current output: `typecheck-attempt.log`; baseline output: `baseline-typecheck.log.gz`.

No dependency install, lint or production build was attempted. No real browser automation/render inspection was performed. Complete these in the normal integration environment; do not assume tests transpiling successfully imply a deployable build.

## Mandatory unexecuted live gates

- SQL parsing/application, real authenticated/service-role grants/RLS/tenant isolation, permission/history/knowledge epoch and locking/concurrency.
- Browser controls/deep links/mobile failure visibility, cross-tab/resume/rollback and actual HTTP lost-response behavior.
- Real Luna language/correction quality. `continuous-acceptance.json` contains 20 scenarios; LIVE NOT RUN.
- Latency, checkpoint RPC overhead, 100k catalogues, totals population boundary and effective database/caller cancellation.
- Existing canonical reservation/replay/finish and P3 confirmation/audit regression on actual Supabase.

No production speed, success rate or security certification is claimed. Read `DATABASE_ACCEPTANCE.md` and the engineering handoff before enabling the flag.

## Packaging

The return includes `FILE_CHANGES.json`; hashes exclude that manifest's own bytes to avoid a self-reference. Original unrelated files are preserved, not regenerated. The external packaging-verification JSON and ZIP checksum establish actual archive/patch verification when delivery is generated. They do not establish runtime acceptance.
