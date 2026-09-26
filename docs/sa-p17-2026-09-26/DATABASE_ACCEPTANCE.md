# P1.7 real database, scope, scale and browser acceptance

**NOT RUN IN THIS BUILD ENVIRONMENT.** Offline tests/mock transports and SQL
structure checks do not establish any gate in this document. No Supabase migration,
fixture setup, live query, Luna completion or browser interaction was performed.

## A. Integration order and approved scope

Read the root return notes and the agent's original next-phase handoff. RS Roofing
is the ONLY approved real testing company; do not widen product rollout or seed
that account. Large/adversarial fixtures must be isolated disposable fixtures in an
approved database/environment. Existing agent harness setup uses service credentials
and writes fixtures: do not run it casually just because it exists in the source.
Obtain normal integration approval, retain a fixture manifest, and always clean up.
A preview URL may share the live database. Do not infer isolation from its hostname.

1. Complete npm install, full typecheck (no new errors), lint and production build.
2. Keep the new P1.7 flag off. Verify existing P1.5 zero-model commands, P1.6, P2 and
   P3 requester-button policy. Keep P4/knowledge disabled.
3. Review/apply only the new `20260926190000_sa_v2_retrieval_v17.sql` draft in the
   approved test database. The existing P1.6 registry migration is a prerequisite.
   Do not execute all outstanding migration files.
4. Check real PostgreSQL parsing, function signatures, body privileges, search_path,
   row_security, statement timeout config, grants and schema visibility.
5. Run the new reader's scope/ranking tests under actual authenticated user JWTs.
   Calls made only with a service role do NOT establish RLS isolation.
6. Enable the new server flag on the intended testing deployment only once gates
   pass. Prove capabilities/intelligenceVersion=1/tool registration in runtime logs.
7. Run browser, real Luna and repeated-latency cases. Compare the same source data,
   flags, model/config and request categories with P1.7 off/on.

## B. Run lifecycle and authorization matrix

Use legitimately admitted runs and their real permission revisions. Never insert
or forge a run/reservation as a shortcut to query tests. Existing harness admission
and trusted cleanup/finalisation paths must be respected. Do not leave reservations
unreconciled or convert uncertain requests into new submissions.

Re-run the original P1.6 security battery, then reproduce its applicable probes
against **sa_v2_retrieval_query_v17**. The old reader passing is not sufficient.

- Anonymous, wrong user's run, finished/cancelled/expired run, stale revision and
  disabled company all refuse. No data/card content leaks in refusals.
- Cross-company IDs, names and registered relations cannot retrieve foreign data.
  Check hidden parent + visible child, visible parent + hidden child, and hidden
  field through search.field, select, grouping, ordering, dimensions and aliases.
- Quote versus draft permissions/status transitions remain correct. Library
  components and placed components retain separate identities/permissions.
- Forged source/field/operator/join/company_id and search.field injection fail.
  No model value is interpolated into executable SQL. Every relation is registered.
- Missing catalogue entitlement refuses before a read; knowledge stays off.
- Revoke permission between parent and child query, before final output and between
  selection and P3 snapshot. Confirm revocation is terminal, not a generic empty.
- Move/delete a component between selection and proposal preparation; verify no
  proposal is prepared for the wrong parent. Recheck the existing confirmation's
  stale snapshot/permission/proof/requester constraints and audit lifecycle.

## C. Correctness fixtures and full-population truth

Use independently queried ground truth under the same authenticated scope. Include
same names in another tenant and confusing parent/child names. Do not weaken real
schema constraints to force an impossible fixture.

- Unique draft `9th canvas test`, unique Ridge, similarly named draft, duplicate
  Ridge under one parent, same Ridge in another parent and library template named
  Ridge. Confident parent/child resolves consistently; exact duplicates clarify.
- Parent named Ridge with unrelated children: field-specific child resolution must
  not match solely through the parent's text. Preserve all user qualifiers.
- Grouped missing-value case uses **material_order_lines.quantity**, which is
  nullable in the supplied schema. Create `P17 Missing A` quantity100 and
  `P17 Missing B` quantityNULL, both unit m, inside disposable order fixtures.
  Group by item_name, SUM quantity, DESC LIMIT1: the displayed A group must NOT
  erase B's missing input. Coverage must show matchedRows2/groupCount2/missing1,
  complete=false. Do NOT try to insert NULL into invoices.total (NOT NULL).
- Top1 with three equal numeric values: _tie_count3, rank1 and explicit tie evidence
  even though two rows are outside the page. Secondary sorting only orders display.
- A missing numeric row sorts outside the returned top page: still incomplete.
- Unlike currencies/units in rows outside the page: no valid global winner. Scope
  to one dimension, then compare exact total/rank with ground truth.
- Stored count/sum/min/max/avg/groupBy on complete filtered input; related EXISTS
  must not multiply a parent with many matching children. Include zero matches,
  all-missing values, empty grouped result, tied groups and bounded large payloads.
- Quote totals: match existing builder/customer engines, with their deliberate
  differences, tax/margins/discounts/units and incomplete snapshots. No model math,
  sampled rankings or applying conversions twice. Grouped names are labels, not
  asserted unique customers.

## D. Scale: 100,000 catalogue rows and 200/201 quote boundary

`DATABASE_PROBES.json` is a read-only contract set, not a fixture generator. Seed
only in approved disposable fixtures. Match the registry's real column mapping
(e.g. catalog_rows.raw_row keyed through catalogs.column_mapping).

100k catalogue: exactly100,000 rows in one owned catalogue, one mapped description
`P17 UNIQUE MARLEY MODERN`, many descriptions matching words `p17`, foreign tenant
lookalikes and real catalogue entitlement. Run selective exact, dense words, count,
and related parent resolution. Capture EXPLAIN (ANALYZE, BUFFERS), actual database
execution time, total RPC time, rows/bytes examined, buffer reads/hits, index usage
and warm/cold behaviour. An EXPLAIN of only a function wrapper may hide dynamic
inner query cost: inspect the actual generated statement or an approved nested
statement profiler with the same role, scope and bound parameters. Do not inject a
run_sql tool or relax RLS just to obtain plans. Add indexes only from measured need,
as separately reviewed migration drafts; none are fabricated by this return.

Engine boundary: distinct isolated fixtures selected by `P17 ENGINE200` and
`P17 ENGINE201` exact word scope, 200 and201 valid quotes respectively. Ensure the
200 case is below the existing child/payload limits; the 201 case must refuse
before partial quote input calculations. In the200 case compare every financial
result with the normal QuoteCore engines. Also exercise child/payload overflow
independently; a refusal at those bounds is not a quote-count regression.

## E. Effective timeout and cancellation

The function declares8s statement_timeout. That alone is NOT a hard caller wall
clock guarantee. Measure actual behaviour under PostgREST transaction/role settings.
In isolated fixtures, test a deliberate short caller timeout and a naturally costly
bounded read; observe PostgreSQL activity, cancellation/error SQLSTATE and the
server run/reservation lifecycle. Client fetch abort does not prove SQL cancelled.

Record what continues after client disconnect; confirm original request replay
returns its existing state/result without duplicate work or quota charge. Reconcile
through existing trusted finish/replay paths, not fabricated cleanup mutations.
The included probe stops at a transport uncertainty and sends no retry. It cannot
prove server cancellation by itself. Any surprising scope/timeout behaviour blocks
wider rollout and must be reported with exact traces.

## F. Guarded read-only PostgREST probe

Default `node scripts/probe-smart-assistant-p17.mjs --plan` is offline.
`--probe` requires ALL explicitly supplied variables:

```text
SA_P17_PROBE_ACK=isolated-fixture-read-only
SA_P17_PROBE_SUPABASE_URL=<exact HTTPS origin>
SA_P17_PROBE_ALLOWED_HOST=<that exact host>
SA_P17_PROBE_USER_JWT_FILE=<0600 file, authenticated-user token>
SA_P17_PROBE_ANON_KEY=<anon/publishable API key, never service-role>
SA_P17_PROBE_COMPANY_ID=<approved disposable fixture company>
SA_P17_PROBE_ACTIVE_RUN_ID=<legitimately admitted active run>
SA_P17_PROBE_REVISION=<current permission revision>
SA_P17_PROBE_CASES=<explicit comma-separated DATABASE_PROBES IDs>
SA_P17_PROBE_OUTPUT=<new JSONL output file>
```

Optional `SA_P17_PROBE_ABORT_MS` controls caller timeout. Selected probes may also
require CATALOGUE_ID, FOREIGN_QUOTE_ID or FOREIGN_COMPANY_ID with the same prefix.
The harness checks runtime.company_id/permission_revision, an approved disposable
company name/slug, P1.7 capability, token role and exact host. It specifically
refuses RS Roofing. It never creates companies, admits/finalises runs, seeds data,
sets permissions or uses service keys. Keep the original run valid and reconcile it
via the approved lifecycle afterward. A completed probe is only that probe's
assertions, not the entire RLS matrix, scale planner or application gate.

## G. Real Luna and browser acceptance

Run all50 specifications in ACCEPTANCE_CASES.json with the right fixtures. Only
`automated-read` cases are accepted by the HTTP benchmark. Manual-only cases cover
fault injection, proposals/confirmation, permissions, actual navigation and scale.
Example plans are illustrative contracts, not evidence of natural-language success.

Benchmark --run uses `SA_P17_BENCH_` variables: ACK must be
`paid-turns-preview-is-not-isolated`; BASE_URL, ALLOWED_HOST, COOKIE_FILE,
CONVERSATION_ID, COMPANY_ID, CASES, OUTPUT and LABEL are mandatory. Supply template
values (e.g. DRAFT_NAME/CURRENCY) and PATHNAME where required. REPEATS1–10 and max100
selected turns; uncertain requests stop without a new submission. Normal admission,
quota, history and finish remain active. Never put cookies/tokens into the return ZIP.

Repeat identical simple and relational prompts at least5 times against stable
fixtures. Record accuracy, exact chosen identities, clarification consistency,
number of model calls, repair rounds, tokens, RPC and total completion p50/p95.
Separate warm/cold results and changed data. Do not infer success from speed alone.
P3 proposals/confirmation are manual and must use the existing requester button.

Browser gate: manual and digital quote builders, component/extra with/without areas,
same page/query-only navigation, repeated click, second child of same parent,
back/reopen conversation, mobile hide/reopen and subsequent manual phase change.
Confirm the right loaded component expands/focuses without snap-back, wrong library
navigation, data save or implicit confirmation. Forged focus target/card swap and
stale/deleted/moved/hidden child must refuse through existing authorization.
Blank quote entries have no fabricated placed-component editor.

## Return evidence

Exact migrations/flags/deploy context, redacted logs, fixture manifest/cleanup,
SQL/RLS results including failures, EXPLAIN/cancellation evidence, browser results
and repeated real Luna timings. Any unrun gate stays explicitly UNRUN. Do not label
the backend mature or start widening rollout until these results justify it.
