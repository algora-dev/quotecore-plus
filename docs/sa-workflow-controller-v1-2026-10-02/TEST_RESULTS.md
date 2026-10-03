# Actual verification — 2 October 2026

This report describes only commands executed against this return in the restricted build container. It does not import old handoffs' live results. Node was v22.16.0; npm 10.9. Global TypeScript supplied the existing offline loader; package dependencies could not be downloaded. No real environment credentials or VAPID key material were used.

## New executable suites

| Command | Actual outcome | Scope |
| --- | --- | --- |
| `node scripts/test-smart-assistant-workflow-v1.cjs` | 30/30 pass | Real pure vocabulary, delta reducer, product decisions, task hints, structural review, canonical pricing engine and cookie batch behavior. |
| `node scripts/test-smart-assistant-workflow-v1-services.cjs` | 20/20 pass | Real workflow service with explicit database/access/proposal transport mocks; persistence ordering, grouped choices, stable IDs, stale revisions, permission refusal, configuration drift, bound/deleted/sent/external-change handling. NOT SQL/RLS proof. |
| `node scripts/test-pwa-push-v1.cjs` | 23/23 pass | RFC known-answer ciphertext; independent randomized decryption; signature verification; endpoint/payload/retry rules; service-worker VM behavior. No browser/provider/device delivery. |
| `node scripts/check-smart-assistant-workflow-v1-source.cjs` | Pass | 12 static integration assertions and byte comparison of 367 protected original files. NOT executed database security tests. |
| `node scripts/run-smart-assistant-workflow-v1-offline.mjs` | Exit 0 | Re-runs the above suites; full output in `evidence/workflow-v1-offline-final.log`. |
| TypeScript `transpileModule` over changed/new TS/TSX | 42 files, 0 syntax diagnostics | Syntax only; no semantic import/type compatibility guarantee. |
| `node --check public/qcp-push-sw.js` and new CJS test/guard scripts | Pass | JavaScript syntax only. |

The James Smith offline fixtures use structured intent/deltas, **not a real model interpreting the original voice/text utterance**. They verify three separate Hip measurements and real engine recalculation, but not a stored database quote or actual conversational quality. No test timing here is a live performance measurement.

During development the task-hint test exposed a clear-new-job boundary issue, which was corrected and rerun. New service-test fixtures initially used an unsupported nested delta shape; fixtures were corrected to the actual typed contract and all 20 pass. Final logs, not intermediate red/green counts, are the evidence for the delivered source.

## Dependency / full-project gates

| Command | Actual outcome |
| --- | --- |
| `npm ci --no-audit --no-fund` | Failed. Repeated `EAI_AGAIN` DNS/network errors; npm also reported `Exit handler never called!`. Dependencies were not installed. Partial/empty node_modules are excluded from delivery. |
| Full project `tsc --noEmit` | Attempted; missing type definitions/packages prevented completion. Diagnostic run with global Node types still produced missing Next/React/Supabase cascades. No semantic typecheck pass. |
| `npm run lint` | Exit 127: `eslint: not found`. No lint pass. |
| `npm run build` | Existing prebuild dependency-manifest check passed; Next build could not start (`next: not found`, exit 127). This is NOT a successful build. |

Small command logs and a truncated diagnostic excerpt are included in `evidence/`. The entire repetitive 11MB missing-dependency cascade is not packaged. The dependency manifests and lockfile are unchanged, and the local roof-takeoff package tarball is retained.

## Existing offline regression attempts

`node scripts/run-smart-assistant-p17-offline.mjs` stops at missing `docs/sa-retrieval-2026-09-26/EVALUATION_CASES.json`. Additional suites were invoked individually to distinguish passing tests from blocked harnesses. A nonzero exit is not a pass, even where earlier test cases in that suite succeeded.

| Script (`node scripts/<name>`) | Exit | Reported test scope/results | Note |
| --- | ---: | --- | --- |
| `check-smart-assistant-p17-source.cjs` | 0 | source/harness check | Passed this command. |
| `check-smart-assistant-resolver-source.cjs` | 1 | source/harness check | Error: ENOENT: no such file or directory, open 'docs/sa-p171-2026-09-27/validation/LOCKED_FILES.json' |
| `check-smart-assistant-retrieval-source.cjs` | 0 | source/harness check | Passed this command. |
| `check-smart-assistant-speed-source.cjs` | 0 | source/harness check | Passed this command. |
| `check-smart-assistant-task-quality-source.cjs` | 1 | source/harness check | Error: ENOENT: no such file or directory, open 'docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json' |
| `test-smart-assistant-p17-metrics.mjs` | 1 | 8/12 tests | Harness subprocess assertion failures; see log. Full suite not passing. |
| `test-smart-assistant-p17-services.cjs` | 1 | source/harness check | Error: Cannot find module 'next/headers' |
| `test-smart-assistant-p17.cjs` | 0 | 132/132 tests | Passed this command. |
| `test-smart-assistant-resolver-services.cjs` | 0 | 53/53 tests | Passed this command. |
| `test-smart-assistant-retrieval-metrics.mjs` | 1 | 5/7 tests | Harness subprocess assertion failures; see log. Full suite not passing. |
| `test-smart-assistant-retrieval-services.cjs` | 1 | source/harness check | Error: Cannot find module '@supabase/supabase-js' |
| `test-smart-assistant-speed-metrics.mjs` | 1 | 3/5 tests | Harness subprocess assertion failures; see log. Full suite not passing. |
| `test-smart-assistant-speed-services.cjs` | 1 | source/harness check | Error: Cannot find module '@supabase/supabase-js' |
| `test-smart-assistant-speed.cjs` | 0 | 83/83 tests | Passed this command. |
| `test-smart-assistant-retrieval.cjs` | 7 | source/harness check | Error: Cannot find module '../docs/sa-retrieval-2026-09-26/EVALUATION_CASES.json' |
| `test-smart-assistant-p17-corpus.cjs` | 1 | source/harness check | Error: ENOENT: no such file or directory, open 'docs/sa-p17-2026-09-26/ACCEPTANCE_CASES.json' |
| `test-smart-assistant-resolver-pure.cjs` | 0 | 128/128 tests | Passed this command. |
| `test-smart-assistant-resolver-integration.cjs` | 1 | source/harness check | Error: Cannot find module 'next/headers' |
| `test-smart-assistant-task-boundary.cjs` | 0 | 76/76 tests | Passed this command. |
| `test-smart-assistant-task-conversations.cjs` | 0 | 24/24 tests | Passed this command. |
| `test-smart-assistant-task-integration.cjs` | 1 | source/harness check | Error: Cannot find module 'next/headers' |
| `test-smart-assistant-task-http.cjs` | 0 | 21/21 tests | Passed this command. |
| `test-smart-assistant-task-presentation.cjs` | 0 | 35/35 tests | Passed this command. |
| `test-smart-assistant-p173.cjs` | 0 | 4/4 tests | Passed this command. |
| `check-smart-assistant-p173-source.cjs` | 0 | source/harness check | Passed this command. |

Missing fixture examples are the old retrieval evaluation corpus, P17 acceptance corpus, P171 locked-file manifest and P172 baseline-protected manifest. Restore the actual canonical files; do not manufacture replacements. Some metrics subprocesses failed before their expected no-network/opt-in exit behavior. Treat those complete suites as failing until the actual dependencies/fixtures are restored and rerun.

## Not executed / not evidenced

No PostgreSQL migration execution, SQL parser validation, live RLS/tenant/permission testing, concurrent database mutation/race tests, real Luna conversation, rendered browser/mobile UI, installed-PWA cookie/session matrix, provider push delivery/tap tests, real quote database inspection, or live latency/owner-effort benchmark was performed. Source assertions and mocked orchestration tests do not replace these. `LIVE_ACCEPTANCE.md` enumerates the remaining staging gates; `MIGRATIONS.md` records that the applied migration list here is empty.
