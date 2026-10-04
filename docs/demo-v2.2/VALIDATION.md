# Demo V2.2 — validation evidence and limitations

**Performed:** 2026-10-03, supplied baseline `77e99efd` plus cumulative return.  
**Local runtime:** Node v22.16.0; deployment target per repository is Node 24.  
**Result:** source/test candidate; not an app build or live deployment certificate.

## Checks actually completed

| Check | Result | Scope |
|---|---|---|
| New demo domain suite | 34 passed, 0 failed | Real pure modules; counter I/O simulated. Commands, records, expiry, namespace selection, signed token tampering/expiry, CAS concurrency, reset-resistant counters, prepared scan preservation and existing pricing/tax functions. |
| Existing precision/calibration/topology suites | 217 passed, 0 failed | Existing repository tests run with a TypeScript require hook. Their implementation files were not changed. |
| Seed orchestration | Passed: 43 write batches / 81 rows | Actual authored seed and existing real pricing functions; DB/storage/sharp transport mocked. Three libraries, 20 components, eight jobs and relationship checks. Not live schema execution. |
| Strict domain / seed type checks | Passed | Nine pure domain modules plus all 43 captured seed write batches against supplied generated Supabase Insert types. |
| Changed-source syntax/local imports | Passed: 96 TS/TSX files, 0 reported problems | TypeScript transpilation diagnostics and local import existence only. Does not resolve all React/Next/Supabase semantic types. |
| Existing server dependency-boundary check | Passed | `node scripts/check-server-deps.mjs`. |
| New script syntax | Passed | Node --check on the readiness/lint scripts. |
| Protected tree comparison | Passed | No changes in protected free roof tool, Message Center, public measurement tool, Smart Assistant UI, precision engine, DB migrations, package.json, package-lock.json or generated database types. |

**251 passing test cases total** combines the 34 demo-domain cases and 217 existing cases; it does not include live integration tests. The seed checks are separate.

Repeat after installing the existing dependency tree:

```sh
DEMO_CHANGED_MANIFEST=FILE_CHANGES.json node scripts/demo/run-offline.cjs
```

Logs: `offline-domain.tap`, `existing-geometry.tap`, `seed-and-types.log`, `offline-run.log`. Tests use this repository's existing TypeScript dev dependency; this environment resolved the already installed compiler through NODE_PATH. No npm dependency changes were made.

## Gates attempted but not completed

`npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000` failed during dependency installation. Network/DNS retrieval was unavailable and npm ended with `Exit handler never called!`. A partial node_modules tree was not treated as an installed app and is not included.

A full-source TypeScript attempt against the incomplete dependency tree produced missing-module/type cascades. That result is **not** a successful full-project typecheck and is not presented as evidence of semantic compatibility. No full Next build or scoped ESLint run was completed. Gavin must run all gates under Node 24 with the canonical lockfile and assets.

## Not performed here

- Any live Supabase query, auth-user provisioning, SQL migration, RLS attack test, storage upload/deletion or cleanup invocation.
- Real Smart Assistant/OpenAI execution, provider cost calibration, audio transcription/speech or tool confirmation.
- Email verification/delivery through the actual provider.
- Browser screenshots, drag/mobile usability, end-to-end route transitions, seeded canvas hydration or final edited-canvas→quote persistence.
- Testing or production deployment, DNS/domain changes, auth settings or feature switch changes.

All of those remain explicit checks in `TESTING.md` and `DATABASE_GATES.md`. In particular, no runtime success is inferred from successful seed typechecking or a mocked provider/storage transport.
