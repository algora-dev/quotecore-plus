# Validation evidence — 2026-09-25

## Actually executed

Environment: Node v22.16.0, npm 10.9.2; restricted runner's global TypeScript 5.8.3 was used via explicit `TYPESCRIPT_PATH`. No external API keys or database credentials were supplied to these tests.

| Command | Observed result | Evidence |
|---|---|---|
| `node scripts/test-smart-assistant-speed.cjs` with explicit TypeScript path | **83 tests, 83 passed, 0 failed** | `offline-core-tests.log` |
| `node scripts/test-smart-assistant-speed-services.cjs` with explicit TypeScript path | **24 tests, 24 passed, 0 failed** | `offline-service-tests.log` |
| `node scripts/test-smart-assistant-speed-metrics.mjs` | **5 tests, 5 passed, 0 failed** | `offline-metrics-tests.log` |
| `node scripts/check-smart-assistant-speed-source.cjs` with explicit TypeScript path | **65 assistant TS/TSX files: syntax pass**; additive SQL structure/allowlist checks pass | `source-checks.log` |
| `node --check` on all newly supplied CJS/MJS speed scripts and test loader | Passed | No diagnostics; repeated in final packaging checks |
| `node scripts/benchmark-smart-assistant-speed.mjs --plan` | Offline plan printed; **no live benchmark run** | `benchmark-offline-plan.log` |
| `npm ci --ignore-scripts --no-audit --no-fund` | **Failed, exit 1**. Registry `EAI_AGAIN`; npm `Exit handler never called!` | `npm-ci-failure.log`, `npm-registry-failure-excerpt.log` |
| `tsc --noEmit --incremental false --pretty false` | **Failed, exit 2**: unavailable dependency type definitions | `full-typecheck-blocked.log` |
| Targeted compiler diagnostic with automatic ambient package types disabled and changed files as entrypoints | Diagnostic-only, still dependency-incomplete; **not a semantic/project pass** | `dependency-incomplete-targeted-diagnostic.log` |

Total executable offline regression tests: **112 passed**. Test durations in the TAP logs are local test-run times, **not QuoteCore response-time benchmarks**. Synthetic timing values in report-unit tests are also not production measurements.

The syntax checker uses `transpileModule`, not semantic type analysis. The targeted diagnostic still reports missing React/Next/Supabase/Node types and resulting callback/JSX diagnostics; it cannot establish compatibility with installed dependencies. The integration agent must run full dependency-backed `tsc`, changed-file lint and production build.

## What the offline tests prove under their stated conditions

The actual deterministic parser/resolver, quote-total adapter, concurrency scheduler, repeat protection, model-loop bounds, usage accumulation, orchestration seam, V2 scope/composite/facts adapters and HTTP route were executed. Explicit stubs replace network/database/framework services where needed. The HTTP tests retain the real admission-result parser and trusted finish wrapper, while substituting user/admin RPC clients.

Checks include exact-number versus fuzzy/ambiguous matches, whole-utterance negative cases, current quote/draft identity, hidden sections, creator/count labels, complete/UTC validation, bigint precision, hidden/missing/oversized financial reads, builder/customer parity fixtures, source-section card visibility, feature/phase gates, lazy sessions, no redundant current read, zero-model routing, partial reported usage, bounded concurrency with drained siblings, replay/refusal before work, admitted bootstrap failure and exactly one finish attempt.

Permission revocations in offline tests are injected outcomes, not a database race test. Model behaviour is simulated, not a real Luna quality evaluation. The tests do not read or mutate a real QuoteCore database.

## Not executed / still blocked

- Successful `npm ci`, full semantic project typing, ESLint and Next production build.
- PostgreSQL parsing/installation/execution of the new SQL; actual RLS, privileges, schema compatibility, query plans, statement timeouts and race tests.
- Real model requests, OpenAI spend measurements, before/after latency percentiles or proof of a particular production speedup.
- Browser navigation/rendering/first-useful-output measurements, mobile/device tests, microphone behaviour and notification delivery.
- Existing service-role fixture/write harnesses. No SQL migration or feature flag was applied/changed.

## Artifact integrity

Packaging compares every original archive file against the workspace. Only the six listed original source files are changed; additions contain the new speed modules, optional SQL draft, documentation, scripts and evidence. Original migrations, model configuration/client, package manifests, engines/conversions and non-assistant files are verified unchanged. See `CHANGED_FILES.json` and `source-integrity.json` for actual hashes.

The final full ZIP is integrity-tested, then accompanied by a SHA-256 sidecar. The manifest excludes its own recursive checksum. No incomplete `node_modules`, build cache or secret benchmark cookie/fixture file is included.
