# SA P1.6 next-phase handoff - 2026-09-26 (evening)

For the external review/improvement agent. Authoritative baseline: branch `ux/phase-4`, commit `a18f4ab9` (this export). Read `RETURN_NOTES.md`, `docs/SMART_ASSISTANT_RETRIEVAL_HANDOFF_2026-09-26.md`, `docs/sa-retrieval-2026-09-26/INTEGRATION_REPORT_2026-09-26.md` and `docs/sa-retrieval-2026-09-26/DATABASE_ACCEPTANCE.md` first.

## Live state (do not rediscover)

- P1.6 universal retrieval is INTEGRATED, SECURITY-VERIFIED, OWNER-PASSED and LIVE on quotecore-plus-testing (deploy `foy2yxqnl`+). Migration `20260926150000_sa_v2_retrieval.sql` is applied to the production database (16 functions; only `sa_v2_retrieval_scope` + `sa_v2_retrieval_knowledge_epoch` are SECURITY DEFINER; `assistant_v2_retrieval_rollout` + `assistant_v2_knowledge_scopes` RLS).
- Rollout: RS Roofing `dd3b3943-c760-4c21-9a9a-3a516d0c3356` `enabled=true, knowledge_enabled=false`. `SMART_ASSISTANT_RETRIEVAL_ENABLED=true` on quotecore-plus-testing Production only. One-company testing policy (owner decision 2026-09-26): do not widen rollout or add testing companies.
- Owner real-world pass (6 queries) verified: engine-total parity exact (NZD $258.02 = Ridge 10.3208m x $25), draft-by-name resolution, propose-confirm-apply loop through the new read path, P1.5 zero-model paths intact (0 tokens).
- Security battery 33/33 via `scripts/test-sa-retrieval-acceptance.mjs rpc` (tenant isolation, forged-plan rejection, cross-tenant/stale/anon/finished-run denials, engine aggregate completeness). Harness subcommands: setup|rpc|luna|regression|bench|cleanup. Fixtures are throwaway companies; ALWAYS clean up; never touch RS Roofing data.
- Benchmarks (warm p50): canonical zero-model ~2.0s; one-model retrieval 3.1-3.7s; related-orders 2.8-5.5s. Model calls dominate (~1.0-1.3s each); query_workspace RPC 0.12-0.25s.

## Fix round already applied (a18f4ab9) - review, do not redo

1. Invoice-unpaid filter: root cause was the model inventing status values ('unpaid','due','open'). Fix: exhaustive status-value domains in the retrieval contract (invoice draft|sent|viewed|payment_reported|paid|disputed|cancelled; quote draft|confirmed|sent|accepted|declined|expired|archived; orders ready|ordered) + unpaid = `paid_at is_null true` + explicit example. Verified offline (3 phrasings emit the valid plan) and live.
2. Name-vs-number: bare tokens/name phrases are NAME searches; quote_number only on explicit "quote number N"/"#N"; plus a service-layer repair hint when a quote_number filter returns empty (service.server.ts).
3. Count precision: exact-name counts for "how many X"; words match for quantity sums; report both counts when variants exist.
4. Related-search match mode: separate `relatedSearch` schema enum ['words','exact'] - related searches never accept natural. LESSON: prose prompt rules are ignored for schema-enumerable constraints; enforce structurally in the tool schema.
- Offline Luna plan-shape reproduction harness: `scripts/debug-sa-p16-luna-plan.cjs` (loads the REAL prompt+schema via the offline loader, calls gpt-5.6-luna with reasoning_effort none, classifies plans through the real compiler with mocked transports). Use it for any plan-quality work before deploying.

## Review + improve targets (residuals, in priority order)

1. **Component open-record navigation**: "Show me the Ridge component on my draft" resolves + verifies but the open/navigation action fails. Locate the navigation target contract for quote_components rows in retrieval mode (the records card path) and fix.
2. **P3 composite verification nondeterminism**: identical draft+component edit prompts proposed correctly once and refused once ("couldn't verify"). The deterministic resolver is correct; the model's composite verification path varies. Consider a single composite resolve (draft by name -> its component) or stronger one-shot guidance; do not weaken propose-then-confirm.
3. **Scale gates (mandatory before any wider rollout)**: EXPLAIN (ANALYZE, BUFFERS) representative compiled queries at 100k catalogue_rows; >200-quote engine refusal boundary; effective caller/PostgREST timeout cancellation (function-level 8s statement_timeout is set but not a hard wall-clock proof). Needs large isolated fixtures.
4. **Bare-numeral name matching**: "my 5 quote" with job "5th mob" now yields an honest actionable empty (repair hint), not auto-resolution. Optional: consider numeric-aware name matching in `sa_v2_retrieval_rank` tiers (e.g. word-stem match "5"~"5th") ONLY if it does not weaken unique-resolution safety.
5. **Knowledge phase (gated off)**: classification workflow, ingestion epoch write-load testing, withdrawal/history-cutoff verification per DATABASE_ACCEPTANCE.md. knowledge_enabled stays false everywhere.

## Next-phase scope (owner direction: review, improve, next phase code update)

- Ranking hardening + cross-quote rollups (the documented next SA phase): extremal/winner evidence beyond single-field max, ranked listings over scoped quote sets, rollup answers with completeness accounting - all through the existing registry/compiler/engine, no new unrestricted SQL tools.
- Latency: keep zero-model canonical paths; target one model call for simple retrieval; reduce related-orders variance (repair-attempt budget or tighter tool error hints).
- Any new registry sources/fields MUST regenerate SQL + fingerprint (`node scripts/generate-sa-retrieval-sql.cjs`; `--check` catches drift) and ship as a new additive migration; never hand-edit generated SQL; schema.json is the single source.

## Invariants (non-negotiable)

- Preserve Luna `gpt-5.6-luna` + tool-turn `reasoning_effort=none` hotfix; P1.5/P2/P3 behaviours and flags; P4 OFF; admission/reservation/quota/replay/finish protocol; service-only finalisation; tenant isolation via admitted-run scope + RLS invoker readers; Hidden/View/Edit enforcement incl. field-level permissions; no model SQL, no tenant selector, no model self-classification; result taxonomy (empty/ambiguous/permission_denied/feature_disabled/unsupported/read_failed) must stay distinct - never paper over a capability gap with prompt wording.
- Rollback for retrieval: company `enabled=false` + remove server flag, KEEP code/metadata tables.

## Verification bar for returned work

Offline 383-check suites all green; `tsc` no new errors over the 80 pre-existing test-file baseline; `next build` passes; `generate-sa-retrieval-sql.cjs --check` passes; `scripts/debug-sa-p16-luna-plan.cjs` shows valid plans for the invoice/related/count/name probes; live battery via `scripts/test-sa-retrieval-acceptance.mjs` (rpc 33/33, luna >=15/16) on throwaway fixtures; RS Roofing left untouched except owner-driven use.

## Return format

Full updated source ZIP extracting into a `quotecore-plus/` wrapper + `START_HERE_*.md` at root + changed-files manifest (SHA-256, LF-normalised comparisons) + evidence logs. Deliver to the Gavin agent for integration (it reconciles drift, runs gates, deploys to quotecore-plus-testing, and runs the acceptance battery).
