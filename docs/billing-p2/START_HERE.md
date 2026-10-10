# QuoteCore+ Billing Enforcement P2

**Base:** supplied next-context packet, reported integration commit `27d19446`.
**Release status:** source integration candidate for disposable database and testing deployment. Not production approval.

This patch makes custom usage follow a verified paid subscription period. It does not change prices, legacy plan values, the Stripe catalogue, subscription changes, or payment routing.

Read `AGENT-RUNBOOK.md`, then `BINDINGS-AND-GAPS.md`. Apply source only with the package's guarded installer. The installer never executes SQL or contacts Stripe.

## What is included

- Durable custom usage ledger for created quotes, Scan Tokens and accepted Assistant Tasks.
- Atomic SQL admission and server adapters, exact-period reads, idempotent scan results and original-period refunds.
- Storage holds, measured-size finalization, tombstones and confirmed-removal acknowledgement.
- An internal Assistant provider-budget adapter, separate from customer tasks.
- Preserved legacy function bodies with public function identities retained for dependent policies/callers.
- Focused Node tests, a disposable PostgreSQL contract/concurrency harness and release checks.

## Critical boundary

The packet is not the entire active application. The active Smart Assistant orchestrator, scan client/queue worker, latest calibration functions, Offcut execution boundary and complete Storage policies/callers are not all supplied. The code does not pretend to instrument them. Custom queue/calibration/voice paths are deliberately blocked, and custom Assistant admission requires a reviewed internal budget policy that is disabled by default. Complete the listed bindings before enabling purchases.

The local verification report is `QA.md`. SQL harness execution, the full repository build, real payment tests and browser tests remain host tasks.
