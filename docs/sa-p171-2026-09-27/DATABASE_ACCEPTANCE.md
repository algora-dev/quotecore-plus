# Mandatory P1.7.1 database, runtime and scale acceptance — NOT RUN HERE

## Safety and prerequisites

Use the normal authorised testing workflow. Destructive fixtures, permission
changes and 100k/201-record populations require approved disposable tenant/actor
scope, never real RS Roofing business rows. Do not place credentials or raw
customer data in returned logs. Keep P4/knowledge off and preserve the existing
single-company rollout. Do not apply unrelated outstanding migrations.

Review the new draft against the actual schema and deployed functions before
application. Confirm current P1.7 registry hash/capabilities, existing auth/scope
helpers, import format and catalog_rows search indexes. Check both unchanged
old-reader behavior and new-reader behavior. Run release typecheck/lint/build;
the supplied offline execution is not a substitute.

## Business reader security

Repeat all 47 previously accepted live isolation/correctness cases against
sa_v2_retrieval_query_v171. Include anonymous callers, another actor's run, another
company's row ID, fabricated scopes/revisions, hidden sources/fields/relationships,
View/Edit differences, malformed ASTs/SQL identifiers/unknown columns, feature-off,
mid-turn revocation, contradictory exact number and customer, source rollback,
related joins and aggregates. Never disclose foreign record existence or counts.
New catalogue shortcuts must retain the same WHERE/EXISTS/field checks and RLS.

## Private resolution metadata

1. Browser/public/anon/authenticated roles cannot SELECT/INSERT/UPDATE/DELETE the
   table or execute the writer. Service-role direct table grants are revoked;
   the only intended app writer is its narrow privileged RPC.
2. Store requires accepted/running admitted run belonging to supplied actor and
   current company/conversation, matching bound permission revision and gates.
   Forged actor/run, missing company membership and revocation fail closed.
3. Repeated identical same-run write is idempotent. Different same-run payload,
   choices or section map is rejected. Oversized/invalid state is rejected.
4. Read requires current caller-bound admitted run, same actor/company/conversation,
   current revision and sections, latest completed prior run, both history cutoffs
   and unexpired state. Foreign, stale, older-conversation, cleared-history,
   deleted-user and expired references disclose no candidate data.
5. A failed/cancelled/uncompleted run's metadata cannot be used as a published
   continuation. A later independent completed turn invalidates older choices.
6. Fabricated choice IDs and altered payload task/entity/rate/approval are rejected.
   Use state+choice identity only. Concurrent duplicate click/replay uses the
   original admission invariant; no duplicate business mutation or audit proof.
7. Real record price changes appear on selection reread. Moved/renamed/deleted
   records are not silently substituted. Revocation before proposal/finish wins.
8. Check logical expiry at 15 minutes and lazy physical cleanup: expired inactive
   rows may remain until later per-actor pruning/cascade. No cron is claimed.

## Catalogue correctness and scale

Use real import code to create an approved disposable 100,000-row catalogue with
sparse distinctive descriptions, dense common terms, punctuation, numbers,
unmapped raw cells, mixed case, quoted values and empty cells. Record fixture seed,
row count, tenant, PostgreSQL version/index definitions and warm/cold conditions.

**Import invariant:** verify search_text contains all raw-cell values used for
mapped description/price/quantity and default raw search. Compare final result
membership with the accepted exact/words rank semantics on a representative full
fixture, including remapping columns after import. A necessary prefilter must not
drop a real match. Default source searches search_text only; a catalogue_name
field search must not be prefiltered as an imported-cell match.

Capture actual emitted query forms/parameters and EXPLAIN (ANALYZE, BUFFERS) under
the same tenant/role. Prove the existing trigram index can serve sparse ILIKE
candidates before expensive rank calls. Do not claim index use from a static SQL
string. Measure both preflight and final rank/aggregate, and the whole RPC.

Test sparse exact, sparse multiword, common word plus rare qualifier, punctuation,
short-only words, catalogue parent filter, mapping-specific field and case variants.
Check populations 1,499/1,500/1,501 before ranking: 1,501 raises P1711/too_broad
without a top-N/sample/count answer; <=1,500 retains whole-population semantics.
A dense 100k word search should return the bounded narrowing outcome rather than
hit the prior 8-second rank timeout. Parent-name/short searches may require a
narrower clue; never manufacture a partial answer to avoid that outcome.

Natural catalogue mode and nested related catalogue-row search intentionally raise
P1712. Confirm planner receives a direct exact/words + catalogue filter repair,
then stops under the existing repair ceiling rather than looping or bypassing it.

Observe real 4-second caller/per-read cancellation, 12-second resolver budget and
database statement timeout. Inspect server activity to distinguish client abort
from effective cancellation. Set a performance acceptance target against the
prior 6.4-second/8-second failures and report cold/warm percentiles; do not promote
on an unmeasured assumption. Any needed index migration follows observed EXPLAIN,
not an invented “index applied” claim.

## Financial and P3 regression

Repeat existing complete population ranking/mixed currency/missing values/group
coverage and 200/201 derived-quote boundaries. Test actual component_library
is_active=true and false through the new strict decoder. Invalid booleans still
fail. Keep caller ACL, current scope and original engine totals.

For eligible draft/component fixtures run proposal selection, then separately
approved requester Confirm, commit revalidation, stale-state refusal, rollback,
idempotency and audit. Candidate selection and “yes” in ordinary conversation are
not Confirm authority. Noneligible sent/accepted records must still be refused.
Test wrong-parent component IDs, exact #1014 plus a contradictory customer and
one changed relationship between first pass and selection. No model-verification
phrase may override actual relationship evidence or existing domain guards.

## Browser/model acceptance

Run ACCEPTANCE_CORPUS.json with actual Luna, Supabase and browser. Repeat at least
five times per ordinary exact/natural/clarification case on stable data. Capture
request/run association, capability flags, path, model/token count, resolver reads,
raw end-to-end timing and whether each second answer preserved the task. Browser
choice controls use existing components; test keyboard, disabled/busy behavior,
one click/one turn, none/cancel, hide/reopen, stale cards and safe transcript labels.

Flag rollback with active choices must return unavailable/expired, not pass opaque
packets to Luna. Full V2 rollback must do the same. Keep free-text use available.
Return honest NOT RUN / FAIL / PASS per gate, evidence and residual request examples.
