# P1.7 validation evidence — 26 September 2026

## What this evidence means

These results were executed in the local build environment against the returned
implementation. They are offline tests, compiler/service boundary checks with
explicit mocks, static schema/SQL checks and syntax transpilation. They are NOT
real PostgreSQL/RLS execution, browser E2E, a complete application build, or Luna
accuracy/performance measurements.

## Executable tests

| Suite | Passed |
|---|---:|
| Existing retrieval core | 204 |
| Existing retrieval services | 60 |
| Existing retrieval diagnostics/harness | 7 |
| Existing speed core | 83 |
| Existing speed services | 24 |
| Existing speed diagnostics | 5 |
| P1.7 semantics/composites/ranking/navigation/repair core | 132 |
| P1.7 service, P3 and authorization boundary mocks | 45 |
| P1.7 telemetry and offline/live-opt-in harness checks | 12 |
| P1.7 corpus structure and illustrative plan/selection compilation | 37 |
| **Total executed / passed** | **609 / 609** |

Exact per-suite counts/exit codes: OFFLINE_RESULTS.json. Each suite has its own
`.log` in this directory. `baseline-*.log` records the original 383-check baseline
before P1.7 implementation; do not count those again as extra coverage.

All50 acceptance cases remain test specifications, NOT50 live passes. The37 corpus
checks validate structure plus example plans/selections; they do not send English
to a model. Boundary mocks explicitly test orchestration contracts and fail-closed
behaviour, but do not establish real PostgreSQL RLS enforcement.

Reproduction with normal installed dependencies:

```sh
node scripts/run-smart-assistant-p17-offline.mjs
```

In this environment each Node test used the existing offline loader with
`TYPESCRIPT_PATH=$(npm root -g)/typescript`. No new package/lockfile or network mock
was substituted for real live acceptance.

## Static and syntax checks

- Existing source checker: TypeScript/TSX syntax across80 assistant files.
- New source checker: syntax for the2 existing quote components with the optional
  focus bridge. Neither check resolves dependencies or proves semantic typing.
- Original registry/schema check:16 sources /339 physical-column references match
  the supplied generated types. That is not a live database introspection.
- Both generators `--check`: original P1.6 artifacts and new P1.7 draft consistent.
- New SQL structural checks: explicit invoker/scope/grants, fixed registry fields,
  bound values, same-snapshot population evidence, existing200/201 guard and payload
  bounds. This is NOT a PostgreSQL parser or a executed migration.
- LOCKED_FILES.json:207 original baseline files unchanged byte-for-byte, including
  all178 original migrations, package manifests, registry JSON, original model and
  selected auth/turn/pricing/currency/conversion files.

The schema-version.ts generated artifact alone is normalized to the generator's
canonical LF bytes. Most edited existing files retain original CRLF endings;
changed-file metadata also includes LF-normalized hashes for the agent's workflow.
Use `git -c core.whitespace=cr-at-eol diff --check` for baseline-aware whitespace
review, not an assumption that CRLF line endings are newly-added trailing spaces.

## Install/typecheck failures — actual attempts

`npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000`
was attempted. npm exited1 with “Exit handler never called!” (npm-ci.log).
It left an incomplete dependency tree. No dependencies/lockfile were altered to
work around this. The installation residue is excluded from delivery.

`tsc --noEmit --incremental false` was attempted and exited2 on missing dependency
type libraries (typecheck-attempt.log). A supplementary targeted diagnostic scan
also remained blocked by unresolved dependencies; it is not a passing typecheck.
No successful project typecheck, lint or production build is claimed. Installed
Next guide files were unavailable with the incomplete install; no new Next APIs
were introduced, only the existing client navigation/focus conventions.

## Not executed / mandatory integrator gates

- PostgreSQL parsing/applying the new SQL; actual Supabase new-RPC role grants/RLS,
  two-tenant/hidden-field enforcement and final-state behaviour.
-100k catalogue EXPLAIN/BUFFERS or real planner index evaluation.
-200/201 quote and child/payload boundaries in a live database.
-Actual caller/PostgREST cancellation and request/reservation reconciliation.
-Full dependency install, semantic typecheck, lint, production build.
-Browser component focus/navigation, mobile hide/reopen, P3 button confirmation.
-Real Luna corpus/repeatability, measured token/repair reduction or speedup.

DATABASE_ACCEPTANCE.md defines these separately. There are no new live latency
numbers in this package. Historical P1.6 timings remain the agent's baseline
reports, not evidence for P1.7. Harness --plan output is not a benchmark.

## Packaging

The full package preserves the quotecore-plus/ wrapper and original source files.
Patch/ZIP verification results are recorded separately in the external packaging
verification artifact to avoid a self-referential archive checksum. The changed
file manifest excludes its own digest, explicitly; it includes exact baseline/new
hashes and semantic (LF-normalized) comparisons. No .git, dependency residue, runtime
credentials or invented success logs are included.
