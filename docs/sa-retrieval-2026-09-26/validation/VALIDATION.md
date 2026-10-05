# P1.6 validation evidence — 26 September 2026

## Executed offline

Runtime: Node v22.16.0, npm 10.9.2. The dependency install was unavailable, so executable TypeScript tests used the existing offline loader with the installed TypeScript module path. That loader is a transpiler, **not semantic `tsc`**. Service tests replace only documented access/session/RPC transports; compiler, resolver, renderer, model-loop and engine adapters execute actual source. No Supabase or Luna requests are made by these suites.

Use the project's installed `typescript` in a normal environment; `TYPESCRIPT_PATH` was needed only here:

```sh
export TYPESCRIPT_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript
node scripts/test-smart-assistant-retrieval.cjs
node scripts/test-smart-assistant-retrieval-services.cjs
node scripts/test-smart-assistant-retrieval-metrics.mjs
node scripts/test-smart-assistant-speed.cjs
node scripts/test-smart-assistant-speed-services.cjs
node scripts/test-smart-assistant-speed-metrics.mjs
node scripts/check-smart-assistant-speed-source.cjs
node scripts/check-smart-assistant-retrieval-source.cjs
node scripts/generate-sa-retrieval-sql.cjs --check
node --check scripts/benchmark-smart-assistant-retrieval.mjs
node --check scripts/report-smart-assistant-retrieval.mjs
```

| Suite | Result | Evidence |
| --- | --- | --- |
| Retrieval compiler/resolution/engine/render/model-loop/corpus | 204 passed, 0 failed | `retrieval-unit.tap` |
| Retrieval service / model-tool registration with explicit mock transports | 60 passed, 0 failed | `retrieval-services.tap` |
| Retrieval report / benchmark guard, synthetic timings only | 7 passed, 0 failed | `retrieval-metrics.tap` |
| Retained speed units | 83 passed, 0 failed | `speed-unit.tap` |
| Retained speed services | 24 passed, 0 failed | `speed-services.tap` |
| Retained speed metrics | 5 passed, 0 failed | `speed-metrics.tap` |
| Assistant TypeScript/TSX syntax | 73 files passed | `speed-static.log` |
| Registry/hash / supplied schema / SQL structure | 16 sources; 339 physical-column references passed | `retrieval-static.log` |

Total **383 offline checks**, including 43 compiler-checked sample plan shapes from a 100-utterance annotated corpus. Neither the corpus nor synthetic timer samples are a real model benchmark. The original speed service test transport now explicitly returns the absent-RPC code for optional P1.6 capabilities rather than an invalid null “success”; existing assertions were not removed.

Negative cases cover unknown fields/SQL/account scopes, Hidden sections, current-page mismatches, strict malformed result validation, source/parent identity differences, ambiguous exact ties, lone weak fuzzy matches, the 85-vs56.9 regression, missing totals, mixed units/currency, multi-tool/continuation early-finish suppression, trusted object identity, stale permission/knowledge epochs, disabled/mismatched rollout and uncertain finish reporting.

## Attempted, blocked — not passing

- `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000`: failed registry DNS `EAI_AGAIN` followed by npm `Exit handler never called!`. `npm-ci-attempt.log`, `npm-network-error.log`. No lockfile or package dependency edits; incomplete node_modules removed before packaging.
- Full `tsc --noEmit --incremental false --pretty false`: exit 2, missing dependency type libraries. `full-tsc-attempt.log`.
- Targeted import-graph diagnostic attempt (same project options, Node types from the globally installed ts-node, root retrieval and V2 tool files): 281 source/declaration files, 56 dependency-related diagnostics, including absent Supabase/Next/OpenAI types and dependent implicit-any errors. `targeted-tsc-attempt.log`. This is **not** a passed semantic check and does not validate the real SDK types.
- PostgreSQL runtime/psql were not available; installing tooling was also blocked by DNS. SQL checks were static only. No claim of PostgreSQL parse/planning/RLS or migration execution.

## Not executed

ESLint, Next production build, real RPC/SQL/RLS, live quote-engine database parity, browser E2E, actual model prompt/plan accuracy, live speed p50/p95, deployment, company rollout changes, knowledge classification or ingestion. No credentials or live database side effects occurred. The opt-in benchmark was tested only in its offline/default and refusal modes. The existing write harness was not run.

## Required external release gates

Normal dependency install/typecheck/lint/build, new SQL migration review/execution on staging, all source/grant/isolation/stale-state tests in `../DATABASE_ACCEPTANCE.md`, existing P1.5/P2/P3 regression, 100-case accuracy review and measured warm/cold latency by actual path. Compare real run IDs against authoritative data and canonical `sa_request_performance` completion; a fast wrong answer or unconfirmed finish is not acceptance.

Byte-identical locked/external files are recorded in `LOCKED_FILES.json`. Packaging validation is recorded separately in `PACKAGE_VERIFICATION.md`; it establishes archive/patch integrity, not runtime safety.
