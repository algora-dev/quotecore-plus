# P1.6 — authoritative retrieval implementation / integration handoff

## Status and authority

Built against **`quotecore-plus-SA-handoff-2026-09-26.zip`**, the full agent export at `1908e78d4e260c8a037f131eb7bf01c9645e1e97`. This supersedes neither the owner's permissions nor existing business logic. The 26 September agent's live P1.5/P2/P3 changes and Luna reasoning hotfix are retained. No deployment, migration application, live model benchmark, or real PostgreSQL/RLS test was performed in this environment.

Read `RETURN_NOTES.md`, this document, `docs/sa-retrieval-2026-09-26/validation/VALIDATION.md`, and the original `docs/SA_HANDOFF_2026-09-26.md` before integration. **A successful offline suite is not permission to deploy an unreviewed SQL compiler to production.** The real-database gates below are mandatory.

## What is implemented

One shared **business-source registry**, one constrained read-plan compiler, and one model query tool replace the growing menu of overlapping search/read/facts tools on enabled model turns. They read the existing QuoteCore tables; no business-data mirror, new embeddings store, or model-generated SQL is introduced. The same registry is used for every account; authenticated scope, application entitlements and Hidden/View/Edit determine which sources/fields/relationships are usable.

Execution remains:

`existing admission/reservation → authenticated V2 run scope → existing deterministic fast path OR model interpretation → authoritative query/engine → guarded result → existing trusted finish`

A simple non-compound factual request can finish after **one metered model/tool-planning completion**: the registered service renders the verified result and the existing access checkpoint runs before release. The model cannot end a turn merely by emitting an `answer` property. Only results retained in the private service/tool WeakSets qualify. Multi-tool, comparative, explanatory, continuation and mutation workflows retain synthesis and existing action protocols. Discovery and error repair can require additional model calls; this is not an unconditional one-call architecture.

### Sources and actual breadth

| Source | Existing authoritative data / restrictions |
| --- | --- |
| `quotes` | Quote/draft headers; separate parent-domain permissions; engine-derived `builder_total` / `customer_total`. |
| `quote_components` | Components placed on quotes, not reusable templates. Requires Components plus visible quote/draft. Stored final canonical quantities and internal costs/rates. |
| `quote_areas` | Existing stored `computed_sqm` / `plan_sqm`, pitch and labels. No geometry recalculation. |
| `quote_entries` | Existing raw entry inputs and their saved units/basis, not a substitute for final quantities. |
| `customer_quote_lines` | Saved customer-facing line amounts, inclusion/visibility and text; preferred for “what did I charge?”. |
| `orders` | Existing material-order headers and authorised quote relationship. |
| `order_lines` | Standard material-order line representation only. |
| `order_text_lines` | Both legacy arrays and current line-by-line envelope content; raw saved numeric text is not blindly summed. |
| `invoices`, `invoice_lines` | Stored invoice totals and lines; do not infer balances/payment allocations that are not registered. |
| `component_library`, `component_collections` | Existing company-owned reusable definitions and collections. |
| `catalogues`, `catalogue_rows` | Ready owned uploads, existing `catalogs` entitlement and Components access. Per-account CSV mapping is respected; raw mapped prices stay source text. |
| `knowledge_documents`, `knowledge_chunks` | Existing ready published uploads/chunks, additionally gated and trusted-section-classified. No unclassified content, private storage paths or arbitrary file fetching. |

There is no separate CRM/customer table invented here. Contact fields derive from permitted quotes, with Customers dependencies for sensitive contact fields. Billing internals, auth, Stripe, tokens, assistant reservations, private transcripts, arbitrary URLs/storage objects and unregistered physical tables are not queryable. **Sixteen sources is broad initial coverage, not a claim that every possible QuoteCore question is solved.**

### Plans, relationships and aggregation

`query_workspace({plan, presentation})` accepts a strict versioned object: source, projected fields, scalar filters, search, at most two registered one-hop related filters, quote scope, owner, optional UTC calendar period, rows or metrics/groups/order, current-page hint and output limit. Unknown keys, field names, SQL/formulas, tenant IDs and arbitrary JSON paths are rejected. `describe_workspace_sources` supplies permission-filtered semantic metadata for up to three sources, not physical SQL.

Related filters are **independently scoped EXISTS semi-joins**. One quote with ten matching Ridge components still counts once. Stored aggregates run over the entire filtered input before limiting returned groups. No capped search result is promoted into a global total. Numeric SQL outputs are decimal strings; exact large counts retain their precision. Currency and unit dimensions are automatically included where required, both for row projections and aggregates. There is no FX conversion or summing metres with pieces.

Search computes exact-name, whole-phrase, all-word and weaker existing P1 fuzzy signals inside one operation. It does not drop customer/date/relationship qualifiers to broaden a result. The code resolver chooses a unique strong match, preserves near/exact ties, or returns a candidate set and a useful discriminator. Recency does not manufacture unique identity. A lone weak fuzzy result remains a suggestion. Drafts never require quote numbers. Current page IDs are server-bound hints and are re-authorised in the query.

For quoted prices, `speed/quote-totals.ts` now exposes the **same existing engine calculation** for bulk callers. Its original reader remains available. The bulk SQL inputs use the original component/line/tax ordering, retain the builder-versus-saved-document distinction, and do not substitute zero or builder totals when a saved customer total is absent. Extremal quote aggregates return actual winner identities and ties.

### Bounds and deliberate limits

| Bound | Behaviour |
| --- | --- |
| 16 fields, 8 filters, 2 related filters, 3 metrics, 3 explicit grouping fields | Strict compiler rejection; automatic currency/unit dimensions may bring groups to five. |
| 20 output rows/groups; 120-character search; 12,000-character server plan bound | Lists are explicitly bounded. SQL also has an independent 16KB plan limit. |
| 200 matching quotes for engine calculations | All matching inputs or refusal. Over 200 is `too_broad`, not a sampled “highest quote”. Narrow scope. |
| 5,000 placed components, 5,000 saved quote lines, 2,000 tax rows per bulk input | Over-limit returns incomplete/no calculation. |
| 2MiB bulk snapshot / 256KiB ordinary SQL result bounds | Explicit refusal rather than silent numeric truncation. |
| Bounded model rows/text/answer | Long source text/JSON is visibly excerpted; output rows can be omitted with a warning. Aggregate **inputs** are never sampled by this presentation limit. |

SQL configures an 8s statement-timeout setting, but **this is not validated as a hard wall-clock bound**: verify the effective caller/role/PostgREST timeout and cancellation on the real deployment. The active turn AbortSignal is passed to RPCs. Rank functions can scan a tenant's candidate set; bounded output does not establish bounded scan cost. Large-catalogue and cross-quote EXPLAIN/latency gates are essential. Do not add a prefilter that silently loses fuzzy matches merely to make timing look better.

### Result taxonomy

`ok`, `empty`, `ambiguous`, `needs_context`, `too_broad`, `incomplete`, `permission_denied`, `feature_disabled`, `setup_required`, `unsupported_source/field`, `invalid_query`, `read_failed` are not interchangeable. A missing migration is not missing user data. A hidden source is not zero. Foreign/nonexistent direct IDs are not disclosed as a known foreign record. Invalid plans can be repaired within existing bounded model-loop limits. Access revocation is terminal, not model-readable data.

## Files / architecture

- `app/lib/smart-assistant/retrieval/schema.json`: canonical fields, fixed SQL source expressions, search fields, permissions, relationships and dimensions. Server-only import graph; never dump the manifest to the model/browser.
- `registry.ts`, `contracts.ts`: pure strict compiler and typed result/error contract.
- `resolution.ts`, `render.ts`: structural resolution and bounded deterministic answers, source/basis/UTC scope attribution.
- `engine.ts`: batch adapter to the existing quote engines, completeness, dimensional aggregation and winner evidence.
- `service.server.ts`: admitted RPC transport, strict envelope validation, current context, release guards, existing cards and private trusted-result identity.
- `tools.server.ts`: compact planner/discovery contract, conditional parallel-safe reads and conservative terminal-answer eligibility.
- `scripts/sa-retrieval/retrieval.sql.in` + `scripts/generate-sa-retrieval-sql.cjs`: generated migration and matching schema fingerprint; `--check` catches drift.
- `backend/supabase/migrations/20260926150000_sa_v2_retrieval.sql`: **additive draft only**.
- `v2/tools.server.ts`: lazy rollout capability loading and model registry switch. Existing deterministic operations still work; P2/P3 tools stay installed when permitted. No new P3/P4 actions.
- `speed/model-loop.ts`, `orchestrator.ts`: declared per-call read concurrency and private trusted single-tool completion, with accounting/guards preserved.
- `speed/telemetry.ts`: retrieval path/terminal counter. HTTP route, trusted finisher, admission code and quota schema unchanged.

When extending the registry, use fixed schema-owned SQL expressions; add permission dependencies on every field/search/relationship, an explicit tenant predicate, unit/currency semantics and representative forbidden-plan tests. Regenerate both SQL and fingerprint using `node scripts/generate-sa-retrieval-sql.cjs`. Never hand-edit the generated SQL independently. Discovery alone does not make a derived field executable; add a validated authoritative engine adapter where needed. This initial draft should be applied once, not regenerated/reapplied over an already migrated database; follow normal subsequent-migration discipline after rollout.

## Rollout — testing first, one gate at a time

1. Diff against the exact 26 September baseline. Read original locks. Keep Luna configuration and its **tool-turn `reasoning_effort=none` / synthesis `low`** hotfix. Keep existing P1.5/P2/P3 flags. P4 remains off. Run normal `npm ci`, full TypeScript, lint and production build with the normal dependency/network environment. Run all commands in the validation document. No UI redesign is in this package.
2. Keep `SMART_ASSISTANT_RETRIEVAL_ENABLED` absent/false. Verify old canonical navigation, count, totals, named draft and P3 proposal/Confirm/audit flows unchanged. A model turn now makes a capability metadata call to maintain knowledge-history cutoffs; canonical non-capability commands do not incur this call. Missing new RPC falls back to existing tools, with explicit diagnostics.
3. Review and apply **only the new migration** on an isolated/staging database with the existing P0/P1 and 25 September speed-facts prerequisites. **Do not apply all outstanding migration drafts or accidentally enable P4.** Verify invoker grants/RLS, actual columns, function bodies, signature lookup/schema cache and every source query before deployment. No rollout rows are inserted by the draft; both new booleans default false.
4. Using the service/admin deployment context, explicitly insert/update the intended testing company only:

   ```sql
   INSERT INTO public.assistant_v2_retrieval_rollout(company_id,enabled,knowledge_enabled)
   VALUES ('<TEST_COMPANY_UUID>'::uuid,true,false)
   ON CONFLICT(company_id) DO UPDATE SET enabled=true,knowledge_enabled=false;
   ```

   This is a manual rollout example, not automatically executed SQL. Then set `SMART_ASSISTANT_RETRIEVAL_ENABLED=true` on **testing** and redeploy. A server flag alone is insufficient. Inspect `sa_retrieval_capabilities`: matching schema hash/setup, server enabled, workspace enabled, and `query_workspace` actually in the tools list. If not, diagnose before benchmarking model behaviour.
5. Run the two-company/current-permission/direct-RPC matrix in `DATABASE_ACCEPTANCE.md`, engine parity fixtures, corpus and real timings. Repeat the original owner 9th-canvas and Ridge-rate tests. Do not widen rollout until accuracy, tenant isolation, P3 regression and latency gates pass.
6. Uploaded-document retrieval stays **off initially**. It needs the separate classification and privacy review below. Catalogue reads use their existing entitlement, not this document gate.

### Rollback

Set the affected company `knowledge_enabled=false, enabled=false` in one admin update, then disable the server retrieval flag. Retain this code and the metadata tables/triggers so the previous knowledge-history cutoff remains enforced. Existing P1.5 model tools return. Do not drop all new database objects or blindly roll back to pre-P1.6 code after document retrieval has been used: older code does not enforce its classification-epoch history cutoffs. Reconcile affected conversations/privacy first. No quota or business row rollback is necessary because P1.6 reads do not mutate those domains.

## Optional uploaded knowledge: explicit classification, not blanket access

The only new data tables are **rollout metadata** and **document permission classification**. They are not an assistant copy of QuoteCore. The existing document/chunk content remains authoritative. The service-only classification table requires a nonempty array of applicable assistant sections and an audit note. A trusted operator/ingestion policy must assign **all** relevant sections; the model cannot self-classify a document to grant itself access. No automatic backfill/classification or new ingestion system is delivered.

`knowledge_enabled=true` still excludes unclassified, non-ready, unpublished, foreign-company or partially hidden documents. A change to document/chunk/classification data or the gates advances a conservative company epoch. The model's next history load excludes older messages/references, and the release guard checks the epoch before output. Existing stored transcripts are **not deleted**; this is not a claim of retroactively erasing data previously shown in the UI. Review transcript retention separately if required. A bulk import causes epoch invalidation and can add metadata write contention; include it in ingestion testing. Never bypass this gate to make a document test pass.

## Measurement and live diagnosis

`sa_retrieval_capabilities`: server/workspace gates, setup state and installed tool names. `sa_retrieval`: run ID, source/mode/state, output count, truncation, RPC/engine/render/total timings, not prompt/arguments/customer values. Existing `sa_turn_performance` and `sa_request_performance` supply total model/tool count, tokens, repeat suppression, pipeline time and canonical finish status. Join by run ID. The first-model-token timestamp is backend-only, **not useful browser output**.

Use `node scripts/report-smart-assistant-retrieval.mjs exported-server-log.jsonl`. Report p50/p95 separately for existing zero-model commands, one-model retrieval, multi-read synthesis, clarification and failures. Keep cold starts separate. A metadata label such as “P1.6” is not evidence the deployed query tool was enabled. Actual tool/capability logs are. Source-query events do not have a unique call ID; deduplicate export transport before reporting.

The 100-case `EVALUATION_CASES.json` is an annotated acceptance corpus, **not a claim that Luna has passed it**. Forty-three example query shapes are compiler-tested. Natural-language plan quality, source choice, preserved qualifiers, relational correctness and confirmation workflow must be evaluated live against known fixtures.

`node scripts/benchmark-smart-assistant-retrieval.mjs --plan` is network-free. To intentionally run selected read cases, supply:

- `SA_RETRIEVAL_BENCH_ACK=paid-turns-preview-is-not-isolated`
- `SA_RETRIEVAL_BENCH_BASE_URL`, exact `..._ALLOWED_HOST`, `..._COOKIE_FILE` (single Cookie header, secure local file)
- owned idle `..._CONVERSATION_ID`, expected `..._COMPANY_ID`, comma-separated `..._CASES`, new `..._OUTPUT`, operator `..._LABEL`
- `..._PATHNAME` for page cases; `..._QUOTE_NUMBER`, `..._JOB_NAME`, `..._CUSTOMER`, `..._SUPPLIER`, `..._COMPONENT`, `..._CURRENCY` only where selected prompts contain those placeholders; optional `..._REPEATS=1..3`.

Then `node scripts/benchmark-smart-assistant-retrieval.mjs --run`. It uses normal HTTP admission, consumes turn allowance/model spend where applicable, and stores normal history. It never edits permissions, seeds business data, clicks Confirm, retries uncertain turns, or uses service credentials. P2/P3 may remain live; P4 must be off and P3 must use propose-then-confirm. Manual/adversarial/workflow corpus cases are refused by this runner. Use a dedicated quiet test conversation and operator-controlled fixtures; inspect correctness/cards, not just timings.

Targets must be measured, not asserted: retain zero-model canonical latency; aim for one model call for simple supported retrieval without discovery; two for independent reads plus genuine synthesis. If the model itself still dominates one-call latency, the logs will show that rather than attributing it to the database. Highest-value queries above 200 quotes and large catalogue scans need explicit follow-up architecture, not misreported success.
