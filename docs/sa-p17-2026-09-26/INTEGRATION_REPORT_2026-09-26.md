# P1.7 Integration Report — 2026-09-26

**Integrator:** Gavin (QuoteCore+ agent) · **Baseline:** package `QuoteCore-Plus-SA-P1.7-Retrieval-Intelligence-2026-09-26.zip` against `ux/phase-4` @ `a18f4ab9` (+docs-only `cc13790e`) · **Result: integrated, all gates green except one scale finding (100k words-search timeout) — details below.**

## 1. Drift resolution

- Full-tree LF-normalized compare (2,776 package files vs HEAD): **2,701 identical, 21 modified + 54 new = 75 manifest files, 0 files changed outside the manifest, 0 repo files missing**. No newer unrelated fixes were overwritten (the only post-baseline commit, `cc13790e`, touched 2 unrelated docs).
- **Locked-file manifest (207 files): the agent's LOCKED_FILES.json hashes were computed on a CRLF Windows checkout while the ZIP/repo ship LF.** Raw compare → 30 mismatches; naive LF compare → 207; canonical `sha256(CRLF(LF(file)))` → **207/207 match, zero real drift**. Integration fix: `scripts/check-smart-assistant-p17-source.cjs` now accepts raw or CRLF-canonical hashes (strictness preserved; any content change still fails). This is the only change made to the agent's harness code.
- One probe-authoring bug fixed in my own new v17 battery (not agent code): hardcoded `quoteScope:'drafts'` in a child-plan probe tested against a SENT parent — corrected to carry the parent's real scope (the RPC correctly refused the mismatched plan; the service never constructs that shape).

## 2. Offline gates

| Gate | Result |
|---|---|
| `run-smart-assistant-p17-offline.mjs` | ✅ all suites (37/37 corpus; source checks; both SQL generators `--check`) |
| `tsc --noEmit --incremental false` | ✅ **exact parity**: baseline 151 diagnostic lines vs after 151, diff = 0 (all pre-existing test-file errors: free-roofing-takeoff-builder, takeoff calibration, supplier-pricing, phase6 parity) |
| `npm run lint` | ✅ 0 problems in any changed/new P1.7 file (repo-wide 8,351 incl. pre-existing baseline drift from unrelated files) |
| `npm run build` | ✅ exit 0 |

## 3. Migration + database

- `20260926190000_sa_v2_retrieval_v17.sql` reviewed line-by-line (additive: `sa_v2_retrieval_query_v17` STABLE SECURITY INVOKER, fixed `search_path`, `row_security=on`, `statement_timeout=8s`, parameter-bound `EXECUTE … USING`, plan-key whitelist, LIMIT 201 refuse boundary, 256KB payload cap, coverage computed before LIMIT, no DML/SECURITY DEFINER) and **applied to the shared production DB** via the standing Management-API permission.
- `pg_proc` verified: both functions present, `definer=false`, correct `proconfig` (`search_path=pg_catalog, pg_temp` + `row_security=on`, `statement_timeout=8s` on v17). Grants: revoked PUBLIC/anon/authenticated, granted authenticated. The compatibly-replaced `sa_v2_retrieval_capabilities` returns `intelligence_version:1` — **P1.6 regression battery re-run green after replacement (33/33 RPC, luna 22/24 — see §5)**.

## 4. v17 RPC security/correctness battery — **47/47** (disposable fixtures, live admitted run, real user JWTs)

`scripts/test-sa-retrieval-v17-rpc.mjs` (new). Highlights:
- Access matrix through the NEW reader: capabilities v17 (`intelligence_version=1`), tenant isolation (search/foreign-id/random-id shape-equal), anon 401, no-JWT 401, foreign-user 403, no-retrieval 403, stale revision 403, finished run 403, nonexistent run 403.
- Forged plans: unknown field, tenant key, dotted/proto fields, limit 21, aggregate-no-metrics, sum-text-metric, source injection, information_schema, knowledge-off, nested JSON filter, SQL-in-search (literal, 0 rows), unknown plan key, control chars — all rejected.
- P1.7-specific: resolve+aggregate rejected (`invalid_aggregate_resolution`), numeric ranking with natural search rejected (`numeric_ranking_requires_definite_membership`), non-text search field rejected.
- Composites: unique draft parent resolves; ambiguous parent returns 2 candidates (no arbitrary pick); duplicate Ridge under one parent → 2 rows (clarify); field-constrained child search does NOT leak parent/job/customer names (Ridge Cottage case → 0); cross-parent child binding → 0.
- Ranking evidence: grouped missing-value (P17 Missing A 100 / B NULL) → coverage `matchedRows=2 groupCount=2 missingValues=1 complete=false`, displayed top = A with sum 100 (B's missing input not erased); three equal values → `_tie_count=3 _position=1` with full-population coverage; all-missing → incomplete; unlike currencies → `dimensionCount=2` evidenced (NZD|GBP, no silent global winner); related semi-join no parent multiplication (3 quotes × Ridge); zero-match honest empty; stored aggregates exact (count=3 sum=231); engine inputs complete.

## 5. Live runtime (testing deployment, `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true`, Production env only)

Deploy: build 2m, Ready (quotecore-plus-testing). Telemetry from Vercel logs: **`intelligenceByServer:true, intelligenceVersion:1, intelligenceActive:true`** + `sa_composite_resolution` events; `retrievalPlanFailures=0 retrievalRepairs=0 repairBudgetStops=0` on all turns; `terminalToolReplies=1` on deterministic direct replies. Canonical zero-model turns correctly show no capability event.

Live prompts (Luna, disposable fixtures):
- Duplicate Ridge on "9th canvas test": both open and P3 proposal-prep correctly **refused to guess** and asked which component (2 identical, 11 m).
- "How many unpaid invoices?" → both invoices, `paid_at IS NULL AND status != cancelled` semantics.
- "Show my order lines with the biggest quantities" → **unlike unit dimensions refusal** (each|m mixed), asked to scope one unit.
- "Total saved quote value across non-draft quotes" → grouped by currency, GBP group flagged missing customer_total, honest incomplete, no global claim.
- Proposal prep (single Ridge): "A proposal is ready on the confirmation card. It is not applied yet" — propose-then-confirm held; **no auto-apply anywhere**.

**Repeat bench (5×, fresh conversations):**

| Case | Match | p50 | p95 |
|---|---|---|---|
| count-ridge | 5/5 | 3,744 ms | 4,412 ms |
| related-orders | **4/5** | 3,217 ms | 4,290 ms |
| composite-open | 5/5 | 2,936 ms | 3,265 ms |
| unpaid-invoices | 5/5 | 2,770 ms | 3,004 ms |

P1.6 luna regression: 22/24 checks across the recorded batteries (latest run 7/8, 1 review). **P1.6's "component open-record navigation" gap is FIXED** (was "couldn't open its record"; now focused open works).

## 6. Browser (real Chrome, logged-in fixture user)

- Composite auto-open "Show me the Ridge component on my 9th canvas test draft" → navigated to `/quotes/<draft>?sa_component=<Ridge-id>`, builder on Components step, **Ridge expanded** showing its entry (11.00 m). Screenshot: `evidence/no-snapback-roofareas.png`, `gutter-expanded-secondchild.png`.
- **Snap-back guard:** manual switch to Roof Areas holds (query-only `sa_component` param does not re-trigger focus on rerender).
- **Second child of another parent:** "…Gutter component on the Maple Ridge quote for John Smith" → q1 builder with `sa_component=<Gutter-id>` (id verified against DB), **Gutter expanded, sibling Ridge collapsed**.
- **P1.7 residual (model, not navigation):** first attempt of that Gutter prompt returned empty — the model bundled the whole qualifier into the parent text search ("Maple Ridge quote for John Smith") instead of binding customer_name as a filter; retry auto-opened correctly. Same family as the related-orders 1/5 miss (§7).
- Fixture note for future harnesses: directly-inserted components with **no entries** plus a linked roof area don't render rows in the area-grouped builder path (retrieval + navigation still correct; totals correct). Add entries or omit areas when visual rendering is asserted.

## 7. Residual inconsistencies (honest list)

1. **Customer-qualifier phrase-bundling (model plan choice, nondeterministic):** "…for John Smith" occasionally lands in the parent text search instead of a customer_name filter → empty result or redundant clarification. Observed 1/5 related-orders repeats + 1 luna run + 1/2 Gutter first attempts. Not a permissions/data issue; worst case is an honest empty + "try a name/date" prompt. Candidate P1.7.1 prompt/schema fix (teach parent-resolution customer binding like the a18f4ab9 name-vs-number rule).
2. **100k catalogue WORDS search times out** (§8). Exact search 6.4 s is close to the 8 s bound.
3. Bare-numeral name matching remains honest-empty (P1.6 known, unchanged, intended).
4. P3 propose nondeterminism on composite draft+component (P1.6 known "1 refusal in 2") — in this run the duplicate-Ridge clarify path fired correctly; no wrong-parent proposal observed (cross-parent binding probe = 0 rows).

## 8. Scale gates (disposable company D: 100,000-row catalogue + 200/201 quote sets; all cleaned up)

| Probe | Result |
|---|---|
| Engine boundary 200 | ✅ `engine_inputs complete=true`, 200 rows, **238 ms** |
| Engine boundary 201 | ✅ **`too_broad` refusal in 150 ms** (before partial calculation), warning emitted |
| Catalogue count (100k) | ✅ 200, **869 ms**, count exact `100000` |
| Catalogue exact-unique | ⚠️ 200, **6,439 ms**, 1 row (correct, tenant isolation held — company-B lookalikes excluded) |
| Catalogue words-dense ("p17 tile red", ~20k matches) | ❌ **500 after 8,083 ms — statement_timeout (8 s) killed it** |
| EXPLAIN (ANALYZE, BUFFERS) equivalents | exact 7.9 ms / dense-ILIKE trigram Bitmap Index 20k rows / full-scan count 199 ms — **the RPC's per-row `sa_v2_retrieval_rank()` predicate is not indexable; the ILIKE-based EXPLAIN understates the real path** |

**Root cause of the words-search timeout:** the compiled predicate evaluates `sa_v2_retrieval_rank(r._names, r._search, …)` per row over the filtered population; the planner cannot use `idx_catalog_rows_search_trgm` through it. Sequential scan + 100k function calls exceed 8 s. **Recommended P1.7.1 fix:** AND an indexable trigram/ILIKE pre-filter (each search word as `ILIKE '%word%'`) into the predicate before the rank call — semantically a necessary condition of `tier>0` words match, so results are unchanged while candidates drop to index-selected rows. No index changes needed (the trigram index already exists and is used by the ILIKE equivalent in 7.9–199 ms).

**Caller-abort observation:** client abort at 500 ms works (TimeoutError client-side); no `catalog_rows` statements remained in `pg_stat_activity` at the first observation (~8 s) or later — orphaned server work is bounded by the 8 s statement timeout in all observations; re-fire of the same query returns normally (no duplicate-work state). The first observation point came after the concurrent timed call finished, so sub-8s continuation-vs-cancellation was not directly observed — recorded as partial evidence, not claimed as full cancellation proof.

**Harness race (documented for reproducibility):** probes must fire inside the live-run window (run `accepted/running` + scope bound). Early attempts 403'd (`access_changed`) because probes fired before scope binding or after run completion; the working pattern is poll-trivial-query-until-200 then fire (see `scripts/p17-boundary-v2.mjs`, `p17-catalogue-v3.mjs`). The first catalogue "timings" recorded in `evidence/explain-probes.json` (127/55/43 ms) were 403 fast-fails — superseded by the real measurements above.

## 9. Exact state after integration

- Branch `ux/phase-4`: `0c3bffe5` (integration) → `286e3f32` (v17 battery) → this report commit. Local-only (not pushed), per release-window policy.
- DB: migration applied (additive, no data changes); **all disposable fixtures deleted and verified** (0 fixture companies, 0 p17 catalog rows, 0 boundary quotes, 0 leftover conversations).
- Flags: `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true` on **quotecore-plus-testing Production only**. P1.6 gates unchanged. P4/knowledge off. RS Roofing rollout untouched (single real-company policy preserved).
- Rollback: set the flag false; keep the additive reader/capabilities (P1.6 continues on the old RPC); stored focused cards keep fresh authorization.

## 10. Verdict

P1.7 is **live and correct on the testing environment** with deterministic composites, honest ranking evidence, bounded repair (unused in all observed turns), semantic normalization, focused navigation and unchanged propose-then-confirm. The one scale gap (100k words-search timeout) is a planner-level fix candidate, not an architecture problem; recommend the trigram pre-filter as the immediate next backend task alongside the customer-binding prompt rule.
