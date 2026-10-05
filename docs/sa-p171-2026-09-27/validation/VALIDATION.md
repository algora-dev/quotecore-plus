# P1.7.1 validation evidence

## Canonical final run

Command: `node scripts/run-smart-assistant-resolver-offline.mjs`

Environment: Node v22.16.0, existing global TypeScript supplied through the
`TYPESCRIPT_PATH` test-loader hook. No dependency installation or network service.
The complete raw output is `offline-final.log`; machine summary and its SHA-256
are in `RESULTS.json`. Exit status 0. No skipped/cancelled/failing executable test.

**812 executable checks passed: 609 retained + 203 new.** The retained 609 include
37 pre-existing corpus-shape/example-plan checks, not model accuracy evaluations.

| Suite | Checks |
|---|---:|
| P1.6 retrieval pure | 204 |
| P1.6 retrieval services | 60 |
| P1.6 retrieval metrics | 7 |
| Speed pure | 83 |
| Speed services | 24 |
| Speed metrics | 5 |
| P1.7 pure | 132 |
| P1.7 services | 45 |
| P1.7 metrics | 12 |
| P1.7 corpus/example-plan checks | 37 |
| New P1.7.1 pure/service/integration suites, combined node:test run | 203 |
| **Total** | **812** |

New tests cover actual-user anchors, quoted numeric/literal names, incompatible
qualifiers, source projections, absolute relevance and spelling limits, cardinality
and ties, final rereads, changed/deleted identities, old candidates, useful/weak
clarifications, source failure, inherited task/price, parent correction, unit/cost
semantics, permission/capability rollback, P3 proposal-only callbacks, expiring
state contract, canonical wire, forged terminal objects, model-assisted refinement,
real scope/orchestrator integration through explicit mock ports and strict boolean
decoding. They do not emulate PostgreSQL RLS or real Luna interpretation.

The service fixture compiles actual plans and evaluates a limited in-memory dataset.
The integration suite uses actual retrieval/resolver/scope/orchestrator modules with
explicit fake RPC/store/model transports. Consequently a zero-model result in these
tests proves that implemented branch, not its production latency or actual SQL.

## Additional source checks

The same runner completed retained syntax/registry checks and all three SQL
regeneration checks plus the new resolver source guard:

- 92 assistant TS/TSX files and two existing quote components transpile without
  syntax errors. This is **not** a semantic application typecheck or Next build.
- 16 registry sources and 339 physical-column references match supplied schema
  types. Thirteen resolver adapters have registered, <=16-field projections.
- 2,944 baseline files match raw SHA-256 in `LOCKED_FILES.json`, including all 179
  original migrations, the admission/finish HTTP route, model config, dependency
  manifests, pricing engines, protected UX/marketing/Takeoff and original schema.
- SQL textual/static checks confirm invoker business reader, original scope and
  coverage guards, parameterized catalogue prefilter and pre-ranking bound, private
  metadata grants/owner/revision/cutoff/expiry conditions. They are **not** a SQL
  parser, grant integration test or EXPLAIN.
- The 60-case P1.7.1 acceptance specification has valid unique IDs and JSON. It
  has NOT been run against the live model, database or browser and is not added
  to the 812 count.

## Issues found and corrected during offline development

Tests exposed an async finalizer aborting the selected-record continuation before
it completed; awaited returns now retain the read lifecycle. Other corrections
include preserving identified records when price is missing, current quote URLs
holding drafts, no unsupported direct relation field, field-projection bounds,
quoted numbers/literal `for`, exact-parent refinement retaining customer constraints,
and valid boolean fields falling into a generic scalar decoder. The negative cases
remain tested. Initial generator checks also detected inherited CRLF/LF comparison
drift; comparison now normalizes only for checking, all original SQL bytes remain
unchanged. Historical development logs are retained as nonfinal evidence; use
`offline-final.log` for the canonical green execution.

## Deliberately not run

The root source instructions expressly prohibit npm install / tsc / build here and
assign full release gates to Gavin. Accordingly no install, full TypeScript, lint
or production build was attempted in this pass. Prior packages' npm failures are
not claimed as a new attempt.

No PostgreSQL executable, actual Supabase/RLS, applied SQL, browser, real Luna,
100k-catalogue EXPLAIN, effective cancellation or production latency was tested.
No fixtures or business rows in the real testing company were written/deleted.
No benchmark mutations were automatically confirmed. Every such gate remains
mandatory in `../DATABASE_ACCEPTANCE.md` and the agent prompt.

ZIP integrity, member hashes, full changed-files inventory and patch reproduction
are performed after this evidence file is written; their output is the external
`QuoteCore-Plus-SA-P1.7.1-Universal-Resolver-2026-09-27.packaging-verification.json`.
This file does not silently upgrade unrun release gates to PASS.
