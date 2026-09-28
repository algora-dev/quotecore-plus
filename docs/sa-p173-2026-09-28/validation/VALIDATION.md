# P1.7.3 validation evidence

## Executed successfully

### Task-quality runner

Command:

`node scripts/run-smart-assistant-task-quality-offline.mjs`

Result: PASS.

The captured TAP suites report 981 executable checks in aggregate across retained speed/retrieval/P1.7/resolver/task-context coverage plus the new P1.7.3 checks. Source/static gates also pass, including:

- assistant TS/TSX syntax gate;
- protected-source hashes against the actual supplied Sept 28 baseline;
- all 180 original migrations unchanged;
- retrieval registry/source checks;
- new P1.7.3 migration/canary/fallback source checks.

These are offline tests using explicit mock transports where applicable. They are not live RLS, model, browser or latency evidence.

### Resolver runner

Command:

`node scripts/run-smart-assistant-resolver-offline.mjs`

Result: PASS, including 203 resolver tests and retained protected-source checks.

### P1.7.3 dedicated source gate

Command:

`node scripts/check-smart-assistant-p173-source.cjs`

Result: PASS.

It checks the additive migration's transaction/signature/fences/grants, rejects obvious business-write/admission/finalization/Stripe content, verifies staged-rollout fallback structure, verifies the admin canary is admin-gated and has no company/conversation surface, and verifies setup/error-code presentation contracts.

## Baseline-manifest correction

A clean extraction of the supplied authoritative ZIP failed its own P1.7.2 protected-source checker because `docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json` had stale hashes from an older source tree. This was reproduced before P1.7.3 edits.

The manifest in this package is refreshed against that clean authoritative source tree. This is a validation metadata correction, not an application-code workaround.

## TypeScript attempt — NOT PASSING

`npx tsc --noEmit` was run in both the clean supplied baseline and P1.7.3 tree.

- Baseline: exit 2; 66,881 diagnostics matching `error TS`.
- P1.7.3: exit 2; 66,909 diagnostics matching `error TS`.
- Difference: 28 additional diagnostics, all from the three new admin health files and all caused by absent `react`, `react/jsx-runtime`, `next/server` and JSX type definitions in this dependency-incomplete environment.

This environment therefore cannot establish semantic type correctness. Gavin must run normal install + typecheck.

## Production build attempt — NOT PASSING

`npm run build` was run in both trees.

Both:

1. pass `node scripts/check-server-deps.mjs`;
2. fail at `next build` with `sh: 1: next: not found`.

This is dependency absence, not a successful build. Gavin must run the real build in the normal repository environment.

## Not executed here

- package/dependency installation;
- lint;
- successful full semantic typecheck;
- successful Next production build;
- PostgreSQL parse/apply/rollback;
- real Supabase grants/RLS/tenant tests;
- real missing-rollout/disabled-rollout account tests;
- real GPT-5.6 Luna/provider canary;
- browser/UI test;
- P3 live mutation/Confirm regression;
- live latency/performance benchmark.

No claim is made for any of those.
