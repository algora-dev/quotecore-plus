# P2 verification

## Executed locally

| Check | Result |
|---|---|
| Focused Node tests against actual new modules and patched gateways with mocked dependencies | 110 passed, 0 failed |
| TypeScript/TSX syntax/transpilation across supplied app tree plus new files | 63 files, 0 syntax diagnostics |
| Strict TypeScript check for the five dependency-contained usage modules | Passed |
| Python PostgreSQL harness syntax and CLI help | Passed |
| Guarded installer unit checks, including refusal and rollback cases | 10 passed |

The Node suite covers request/canonical hash validation, exact-period snapshot parsing, idempotent scan execution, uncertain/refunded outcomes, component-tail binding, provider reservation/settlement coordination, measured upload finalization, cleanup ordering, scope validation, quote error mapping, legacy dispatch and unchanged price/allowance values.

Mocks simulate PostgreSQL/Storage responses. They do NOT prove SQL trigger behavior, concurrency, real provider cancellation, RLS, or actual bucket policies. No count here includes an unexecuted SQL assertion or an old P1 result reported by the integrating agent.

## Supplied for host execution, not run locally

`python tools/billing-p2/test-postgres.py` compiles the five migrations on a synthetic relevant schema, exercises SQL contract assertions, and uses separate PostgreSQL connections for quote, scan, task and storage races. It verifies private legacy-body preservation and public OID preservation. It is intentionally restricted to a disposable Docker database.

PostgreSQL/Docker are not installed in this environment and package downloads were unavailable. Accordingly no P2 SQL migration was executed here. The harness also needs execution and any corrections before shared-database use.

The synthetic schema includes selected exact source function bodies but omits the missing live quote-status body, full RLS/policies, additional triggers and active workers. Passing it is necessary but not sufficient. Repeat acceptance on a disposable copy of the full actual schema.

## Not performed

- Full Next.js build or full repository TypeScript check.
- Existing host P1 and broader regression suite reruns.
- Real PostgreSQL transaction/concurrency/privilege tests.
- Real Storage uploads/deletions, provider requests, Stripe payments, renewals or webhooks.
- Browser/mobile flows or any deployment.

## Acceptance before public purchases

All bindings in `BINDINGS-AND-GAPS.md` must be complete. Confirm exact paid-period limits at real endpoints, actual-schema legacy compatibility, registered-object overwrite prevention, provider loop/audio coverage, correct usage/reset-date display and a complete test purchase lifecycle.

Do not enable public custom checkout merely because the Node tests pass.
