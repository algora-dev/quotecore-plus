# P1.6 integration report - 2026-09-26

Integration of `QuoteCore-Plus-SA-P1.6-Universal-Retrieval-2026-09-26.zip` into branch `ux/phase-4` (baseline commit `1908e78d`, integration commit `62aef4ca` + harness commits). Deployment: quotecore-plus-testing `k5jlgre6y`. Nothing merged to main.

## Baseline reconciliation

- ZIP's 46 changed files vs local `1908e78d`: all 8 "modified" files matched the declared `before_sha256` as CRLF variants (line-ending noise only, content byte-identical after normalization). No genuine drift.
- Local commits since baseline (takeoff pan, quote/invoice template dropdowns, italics, hover fix) touch 6 files with zero overlap with the ZIP's 46. No clobbering: applied only the 46 declared files.
- LOCKED_FILES byte-compare honoured: package.json/lock, database.types.ts, HTTP route, original migrations untouched.

## Gates completed (previously blocked in build environment)

| Gate | Result |
| --- | --- |
| npm install | OK (623 packages) |
| tsc --noEmit | 80 errors, ALL pre-existing test-file errors, count identical on clean HEAD; zero in smart-assistant files |
| eslint (assistant scope) | 1 pre-existing error (tools.ts unused import, exists on HEAD); zero new |
| next build (retrieval flag on) | exit 0, compiled successfully |
| Offline suites | 383/383 (retrieval 204, services 60, metrics 7, speed 83+24+5) |
| SQL generation check | fingerprint `feaff3719950d5d17cd163326b06d5641f1b03a915fe947aa9b9abfa94b6eaad` matches runtime capabilities response |

## Database migration

`20260926150000_sa_v2_retrieval.sql` applied to the live DB in one transaction (the ONLY outstanding migration applied; P4 untouched). Verified live:

- 16 `sa_v2_retrieval*` functions, exact signatures; only `knowledge_epoch` trigger fn and `scope` helper are SECURITY DEFINER (as designed); business readers invoker + `row_security=on`.
- `assistant_v2_retrieval_rollout` RLS on, service_role-only grants. `assistant_v2_knowledge_scopes` RLS on, authenticated SELECT via own-company policy only.
- 0 rollout rows auto-created. 9 knowledge-epoch trigger rows (3 tables x 3 events) + rollout epoch trigger.
- Prerequisites confirmed pre-apply: `sa_v2_speed_scope`, `sa_v2_match_score`, `company_has_feature`, knowledge tables.

## Rollout state

- RS Roofing `dd3b3943-c760-4c21-9a9a-3a516d0c3356`: `enabled=true, knowledge_enabled=false` (inserted explicitly; nothing automatic).
- `SMART_ASSISTANT_RETRIEVAL_ENABLED=true` on quotecore-plus-testing Production only (rm+re-add via script pattern; verified by RUNTIME behaviour, not env listing).
- Throwaway fixture companies A/B (retrieval on) and C (no retrieval row, fallback path) used for all testing, then deleted. RS Roofing untouched by tests.

## Runtime confirmation (no silent fallback)

- `[smart-assistant:retrieval-capabilities]` logs include tools `[..., "describe_workspace_sources", "query_workspace"]`.
- `sa_turn_performance` stages show real `tool:query_workspace` executions: 118-247ms per RPC, access guard 232-244ms, model calls ~1.0-1.3s each.
- Company C (no rollout row) served by the old toolset with the explicit "P1.6 retrieval is disabled" note.

## Direct-RPC security battery: 33/33 passed

During a live admitted run (scope-bound window), authenticated PostgREST probes:

- Tenant isolation: "Maple" search returns exactly company A's 2 rows; company B's data invisible by search and by direct ID; foreign ID vs random ID responses shape-identical.
- Forged plans rejected with correct codes: unknown/dotted/`__proto__` fields (`unsupported_field`), tenant `company_id` key (`invalid_plan`), limit 21 (`invalid_limit`), aggregate without metrics (`invalid_projection`), sum of text (`invalid_numeric_metric`), source injection and information_schema (`unsupported_source`), nested JSON filter value (`invalid_filter_value`), control chars (transport-level rejection), knowledge source with gate off (`knowledge_disabled`).
- SQL text in search: 200 + 0 rows - parameterised literal, no injection surface (assertion encodes this property).
- Denials: foreign-company JWT, non-rollout-company JWT, stale revision, anon key, no JWT, finished run, nonexistent run - all denied before data.
- Engine aggregate (`sum builder_total`): `mode=engine_inputs, complete=true`.
- Resolve duplicates: both same-name quotes preserved as candidates. Draft-by-name: exactly 1. Related semi-join: 3 quotes once each (no row multiplication). Catalogue rows: entitlement-gated, mapped price returned as source text.

Harness: `scripts/test-sa-retrieval-acceptance.mjs` (subcommands setup|rpc|luna|regression|bench|cleanup).

## Real Luna accuracy: 7/8 checks passed

- Count: "6 quotes and drafts in total" (correct).
- Ambiguity: "John Smith's quote or Jane Doe's draft?" - discriminator question, not a refusal.
- Engine total: NZD $1,340.90 = exact parity (components 360+56, custom lines 750, GST 15% = 174.90) with scope attribution.
- Cross-record count: 3 Ridge components (correct). Related orders: PO-A1 Plumbing World, status ordered, scope-annotated.
- Capabilities answer lists permitted sources.
- FAIL: "Which of my invoices are not paid yet?" - the model built an invalid filter variant and the repair loop gave up after 14s. RPC layer supports `status neq paid`, `status eq sent`, `paid_at is_null` (all verified 200 + 2 rows). Plan-quality gap, not missing capability.
- Minor: "Show me the Ridge component on my 9th canvas test draft" - resolution worked (found + verified, never asked for a quote number) but the follow-up "open its record" navigation failed.

## Regression

- P1.5 latest-quote fast path: 0 tokens, 1.3-2.5s. Canonical monthly count phrasing: 0 tokens, 2.0s. (Note: "how many quotes did I SEND this month" is not in the pre-existing intent patterns - model answered correctly but spent tokens; not a P1.6 regression.)
- P3 propose-then-confirm: identical prompt proposed correctly in run 1 (full calc_audit + material_rate override payload, requester-button card, nothing applied); refused once in run 2 ("couldn't verify that draft and Ridge component", 11.4k tokens). Model-side nondeterminism on composite draft+component verification - the deterministic resolver itself is correct at RPC level.
- Fallback company C: old tools + disabled note. Old P2/P3 flags and Luna/reasoning hotfix preserved.

## Latency benchmarks (warm, 3 reps each)

| Case | p50 | max | tokens (steady) |
| --- | --- | --- | --- |
| canonical latest-quote (zero-model) | 1.97s | 2.14s | 0 |
| named draft lookup (one model) | 3.11s | 4.18s | ~3.6k in |
| aggregate count (one model) | 3.73s | 3.90s | ~7.3k in |
| related orders (one-two model) | 5.49s | 8.29s | 3.6k-20k in |

Model calls dominate latency (each ~1.0-1.3s); query_workspace RPC itself is 0.12-0.25s. One 500 mid-battery was a transient Luna mid-loop failure (24.4k tokens consumed then error); identical run passed twice around it.

## Queries that still behave poorly (honest list)

1. "Which invoices are not paid yet?" - invalid filter plan built by the model; repair fails despite RPC support. Recommend an invoice-status example in the tool schema/prompt guidance (plan quality, not capability).
2. Related-orders variance - occasional repair loops inflate to 8.3s/20k tokens. Recommend a repair-attempt budget or tighter tool error hints.
3. Component "open its record" navigation after a successful find.
4. Composite named-draft + component verification for P3 proposals is nondeterministic (1 refusal in 2 identical prompts).

## Not yet done (scale gates from DATABASE_ACCEPTANCE)

- EXPLAIN ANALYZE at 100k catalogue rows and >200-quote refusal boundary need large fixtures (isolated-scale test, not feasible on small fixtures).
- Effective caller/PostgREST timeout cancellation test (function-level 8s statement_timeout set; caller-side wall-clock not stress-tested).

## Rollback

Set RS Roofing `enabled=false` in `assistant_v2_retrieval_rollout`, then remove `SMART_ASSISTANT_RETRIEVAL_ENABLED`. Keep code + metadata tables (knowledge-epoch history protection). No business-data rollback needed (reads only).

## Fix round (evening, commit a18f4ab9, deploy foy2yxqnl)

Owner real-world pass exposed 4 plan-quality gaps; all fixed and verified:

1. **Invoice unpaid filter** (confirmed twice: fixtures + owner real data). Offline Luna reproduction (scripts/debug-sa-p16-luna-plan.cjs) captured the exact failure: the model invented status values ('unpaid','due','open','overdue','outstanding','pending') that do not exist. Real enums: invoice draft|sent|viewed|payment_reported|paid|disputed|cancelled; quote draft|confirmed|sent|accepted|declined|expired|archived; orders ready|ordered. Fix: exhaustive status-domain prompt line + unpaid = paid_at is_null semantics + explicit example. Offline repro: all 3 phrasings now emit the valid plan (paid_at is_null true + status neq cancelled, workspace owner). Live: returns both unpaid invoices with correct totals.
2. **Name-vs-number resolution** ('my 5 quote' read as quote_number 5 instead of job '5th mob'). Fix: bare-token/name-phrase rule + service-layer repair hint when a quote_number filter returns empty (service.server.ts). Live: honest actionable empty; offline: real names now name-search.
3. **Count precision** ('10 Ridge components' blended exact+variants). Fix: exact-name rule for counts, words only for quantity sums, report both counts. Live: 'There are 3 exact Ridge components'.
4. **Related-search match mode** (model sent match:natural in related filters; related searches allow words/exact only - SQL validates). Prose teaching was ignored; structural fix: separate relatedSearch schema enum ['words','exact'] in the tool schema. Offline repro round 3: all 6 probe questions reach RPC with valid plans.

Plus repair-discipline line (fix the named invalid part once; empty = real empty, never re-plan with invented values).

Gates: offline 383/383; tsc 80 = pre-existing baseline (0 new); build exit 0; SQL fingerprint unchanged (feaff371...) - schema.json/SQL untouched, only app-layer prompt+schema+service changes. schema-version.ts regenerated canonically after a CRLF artifact from git-stash cycles (hash content identical). Live battery 15/16 on fresh fixtures + 5-quote one-off; fixtures deleted after. RS Roofing remains the single live rollout company.

Residual known issues (handoff to next phase): component open-record navigation after find; P3 composite draft+component verification nondeterminism (1 refusal in 2); scale gates (EXPLAIN 100k catalogue rows, >200-quote refusal boundary, caller timeout cancellation); natural-fuzzy match of bare numerals to names ('5' vs '5th mob') is honest-empty, not auto-resolved.
