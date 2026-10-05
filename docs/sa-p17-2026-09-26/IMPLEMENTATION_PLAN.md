# P1.7 implementation plan

Baseline: `quotecore-plus-SA-P1.6-next-phase-handoff-2026-09-26.zip`, agent export `a18f4ab9`. P1.6 and P2/P3 are already live on the single authorised testing company. This pass extends that implementation; it does not replace its admission, permissions, financial engines, or confirmation protocol.

## Batches

1. Preserve and rerun the six offline suites (383 baseline checks). Inspect the live integration evidence, registry/compiler, model loop, P3 snapshot/confirmation path and component navigation. Record dependency/build limitations, not assumed successes.
2. Introduce a default-off `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED` switch, requiring existing server/company retrieval gates and SQL P1.7 capability. Normalize a small explicit business vocabulary to validated existing plans. No arbitrary query rewriting or company selectors.
3. Resolve registered parent/child relationships inside the server, with parent ambiguity stopping child selection. Route component proposal selectors through that resolver and the unchanged proposal builder, checking the parent again in the proposal snapshot.
4. Add focused quote-component navigation using a card-bound parent + child identity, fresh parent/child authorization and existing builder controls. No visual redesign, automatic edit, or library/placed-component ID confusion.
5. Add one shared retrieval-plan repair allowance per turn, with a final tool-free response after exhaustion; permit a trusted simple answer after a successful bounded repair. Keep accounting, final guards and existing hard turn/tool ceilings.
6. Add ranking/rollup coverage over ALL matching inputs, unit/currency checks, tie evidence and missing-value accounting before pagination. Generate one additive P1.7 SQL draft from a template; retain every applied original migration. Existing quote engines remain the only source of derived prices.
7. Add executable regression tests, a 50-case live acceptance set, opt-in scale/timeout gate instructions and evidence logs. Ship full source, changed-file hashes, patch and checksum. No database migration or deployment is performed here.

## Release gates

Offline tests are not live model, PostgreSQL/RLS, browser, build, or scale proof. The integrating agent must run normal dependency/type/lint/build checks; direct RPC adversarial tests; repeat the named draft/Ridge propose-confirm-audit test; validate focus navigation; and measure repeated/cold/warm request latency and caller cancellation. The 100k catalogue and 201-quote fixtures must run only in an explicitly isolated database, never the owner's account. Knowledge and P4 stay off. Do not widen the one-company rollout.
