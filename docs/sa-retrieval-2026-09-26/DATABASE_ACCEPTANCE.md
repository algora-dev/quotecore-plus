# Mandatory real PostgreSQL / RLS integration gates

**Not executed in this handoff environment.** Static schema/SQL checks and mocked RPC tests do not prove these pass. Use the agent's isolated/staging Supabase project and known two-company fixtures, not uncontrolled live business data. The benchmark's HTTP runner alone cannot establish direct-RPC safety.

## Setup without bypassing locked state

Apply prerequisites already documented in the handoff, then the new draft alone. Use the normal authenticated application admission to create an owned active run, normal service-only V2 scope binding, and the existing trusted finish once the fixture checks are complete. The integration harness may pause the normal pipeline after binding while it performs direct authenticated read RPC probes. Do **not** manufacture run/reservation rows, change quotas, spoof a service role as an end user, or make finish public. Capture request/run IDs and reconcile uncertain outcomes. Direct read functions intentionally refuse calls after the admitted run has finished.

Fixtures: company A and B with known disjoint quote IDs/names, same-name A duplicates, draft 9th canvas test, both quote total bases with taxes/margins, missing saved lines, tied maximums, NZD/GBP, placed Ridge and reusable Ridge, standard plus both line-by-line orders, invoices, owned ready catalogues, classified/unclassified/withdrawn documents, and rows either side of a UTC date boundary. Create fixtures with existing domain flows. More-than-200 and large-catalogue fixtures belong on an isolated test database.

## DDL / grants / planner

1. Execute the migration inside its transaction with errors fatal; verify all sixteen functions exist, exactly the signatures in the draft, and the schema fingerprint matches the generated TypeScript. No enabled rollout rows should have been created.
2. Review `pg_get_functiondef`, invoker/definer settings and grants. Only narrow rollout/scope helpers use definer; business readers are invoker with RLS active. Anon/PUBLIC may not execute privileged readers. Ordinary users cannot enable gates or write classification. `sa_finish_run` remains service-only. Verify existing SELECT grants on every registered source; do not broaden grants speculatively to fix a test.
3. Test each source's default row projection, exact-ID filter, supported scalar types, relation and one supported aggregate. Check enum-to-text, JSON envelopes, array ordinality, invoice numeric fields and company-scoped catalogues against actual stored shapes. Compare with the normal UI.
4. EXPLAIN (ANALYZE, BUFFERS) representative compiled queries in an authorised staging context at realistic company sizes, including 100k catalogue rows. Review current tenant/join indexes and RLS initplans. Counts/grouped aggregates must not multiply rows. Ranking may scan the candidate set: bound caller timeouts and measure, do not assume the function SET starts an independent timer.
5. Cancel a query through the actual PostgREST/turn signal and effective caller timeout. Confirm typed budget/failure outcome, one finish/release and no silent partial numeric answer. Record real cold/warm p50/p95, query count and payload size.

## Isolation / permission contract

- A's JWT + A's admitted run must never return B header, child, catalogue, knowledge or joined parent rows. Known B ID and absent ID must be indistinguishable to the user.
- B's JWT with A's run; same-company different requester's run; no/expired/malformed JWT; stale revision; finished/failed/unbound run: deny before data retrieval.
- Call `sa_v2_retrieval_query` directly with unknown fields, source/table names, `company_id`, arbitrary SQL, nested JSON paths, long strings, unknown keys, invalid limits, malformed metrics/types, prototype-looking names and forged resolution flags. Validation applies in SQL even without the TypeScript compiler.
- Test all Hidden/View/Edit combinations for each source and field. In particular Quotes View + Drafts Hidden, the reverse, Components Hidden + Quotes View, Customers Hidden contact fields, Orders View + Quotes Hidden related filters, and catalogue entitlement off.
- Exact and search paths, filters, grouping, sorting, relationship existence and `_target_id` must not become alternate channels for hidden fields/domains. Money/quantity unit dimensions must not be droppable.
- Revoke the permission revision after retrieval starts or after a result but before release. No text/card should be newly delivered as authorised after the final guard. Preserve existing card permission checks and requester binding. Capture the canonical failed run/usage, not just the exception.
- Query-side source gates and history epochs must fail closed if setup is incompatible. Server on + company off is not “no records”.

## Financial / aggregate correctness

- Compare bulk snapshot results with the original `sa_v2_quote_snapshot` + `quoteTotalsFromSnapshot` for exactly the same quote IDs. Match component/line/tax ordering, margins, labour taxes, hidden/excluded lines, null/default currency, zero and negative supported stored amounts. Quote engines are unchanged; do not fix a mismatch by making Luna calculate or by changing locked tax/pricing code.
- Verify 200 quotes succeeds when child/payload bounds allow; 201 fails as too broad and never advertises the first 200 as a global maximum. Test >5,000 children and 2MiB input separately.
- Saved customer total absent: not zero, not builder fallback. Mixed currencies: separate sums/maximum groups and no combined numeric ranking without currency selection. Equal maxima: actual tied identities. Stored metre/piece quantities: separate groups, no conversion or repeated pitch/waste.
- More than20 aggregate groups: each visible group's full matching input is used; omitted groups marked. Multiple related component rows must not inflate base quote count. Missing values marked incomplete. Exact count zero must remain a successful zero count.

## Knowledge gates / withdrawal

Keep knowledge off for initial rollout. For this isolated phase, trusted operators classify documents with **all** relevant sections. Unclassified/foreign/unpublished/not-ready documents and chunks must never appear. Test shared keywords and wrong-company classification metadata; both document and classification company must match. Raw file/chunk content containing tool instructions is untrusted data, not authorization.

Withdraw/reclassify/update a document/chunk while a turn is active. Epoch change suppresses release; next model history excludes older source-bearing context. Disable the knowledge gate and then the server flag: cutoff remains available to the new code. Stored UI transcripts are not deleted by this implementation; inspect retention separately. Test ingestion epoch-trigger write load.

## Regression release gate

Run original P1.5 canonical cases and retained offline suites; original V2 browser/HTTP/P3 harness under its documented explicit fixture/write opt-ins. Repeat the owner's Ridge-rate proposal → physical Confirm button → revalidation → exact domain mutation → audit proof. Typed “yes” is never confirmation. P4 stays off, Orders mutations are not newly added, quota/replay/reservation/finish/permission revisions are untouched. Verify old fallback when company/server retrieval flag is off, missing migration and schema mismatch. No production enablement until these checks and ordinary build/lint/TypeScript pass.
