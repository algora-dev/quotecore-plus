# P1.7.1 Universal Entity Resolver — implementation handoff

## Goal and retained architecture

The product requirement is not “always show five results”. It is: find direct
matches; offer only plausible candidates; ask a discriminating question if the
request is ambiguous or there is no meaningful match; retain what the user already
said and rejected; never guess a mutation target. A reasonable first utterance
plus a useful clarification is the acceptance objective, not a success guarantee.

The source baseline is the 27 September owner/agent ZIP (`72f3c3bb`). Existing
P1.5 fast commands, P1.6 registry/RLS queries, P1.7 intelligence/repair/ranking,
P2 attention and P3 reviewed edits are retained. No alternate assistant database,
arbitrary SQL tool, new mutation API, pricing engine or model tier is introduced.

## Execution paths

The original admitted-run envelope still encloses every path:

    admission / reserved turn / authenticated scope
      → existing canonical speed path when applicable
      → P1.7.1 deterministic resolver when confidently parsed
      → otherwise bounded model planning using the shared resolver/query tools
      → current access/capability guard
      → existing trusted finish, persistence, accounting and replay

A resolver result is a trusted object tracked by its producing service. Only that
object can supply a terminal answer without a second model synthesis. A model-
authored lookalike object cannot skip the guarded model/tool lifecycle.

`app/api/smart-assistant/turn/route.ts` is byte-identical to baseline. No admission
hash, reservation, replay key, finish behavior, quota or billable-turn exception
was changed. All selection/clarification requests remain normal admitted turns.
Zero model tokens do not mean a free or unreserved turn.

## Code map

`app/lib/smart-assistant/resolver/` is the shared layer:

| File | Responsibility |
|---|---|
| `anchors.ts` | Actual-user typed numbers, customer and component constraints; model plans cannot discard them. |
| `clues.ts` | Conservative deterministic request/refinement grammar; explicit UTC date ranges; unsupported qualifiers fall through. |
| `contracts.ts` | Strict read intent, parent selector, metadata and result contracts. No tenant, permission, SQL or confirmation controls. |
| `sources.ts` | Thirteen adapters and bounded identity/fact projections over the existing business registry. |
| `relevance.ts` | Positive evidence, absolute relevance floor, credible choices and discriminating question. |
| `service.server.ts` | Parallel bounded discovery, parent verification, current-context hint, reread, rejection, final result and existing P3 callback. |
| `continuation.ts` | Restricted model-supplied refinement of an existing task; cannot change its task/rate or approve anything. |
| `state.ts`, `state.server.ts` | Strict expiring state contract, caller-bound metadata read and trusted metadata-only write. |
| `wire.ts` | Versioned state/choice command packet and human-safe transcript display. |
| `tools.server.ts` | Resolver model vocabulary, P3 selection adapter and trusted terminal integration. |

`v2/tools.server.ts` builds one shared resolver/retrieval context per admitted turn,
exposes `resolve_workspace_entity`, and keeps existing P3 proposal handlers.
The resolver tool accepts **either** a new read `request` **or** a partial
`refinement`; there is no second continuation tool or parallel mutation system.
While active, the older competing `resolve_workspace_relationship` vocabulary is
not shown. P1.7 intelligence and query features stay available. Public
`query_workspace(resolve=true)` redirects to the shared resolver rather than
emitting the older fuzzy-choice mechanism; internal `.lookup()` retains strict
RLS reads without emitting competing cards.

`retrieval/service.server.ts` chooses the new invoker reader only under the new
capability/flag, adds immutable clues from the real utterance, handles dense
catalogue errors distinctly, and fixes the boolean decoder fallthrough defect.
The latter narrow correctness fix also benefits flag-off retrieval; valid
booleans pass, malformed booleans still fail closed.

`orchestrator.ts` offers the pre-model resolver path and stops selection protocol
packets from being interpreted as ordinary text, including malformed/future
packets and rollback to V2 off. Telemetry adds `path=resolver` without logging
record content. Only `ConversationCards.tsx` and `V2ChatClient.tsx` change on the
client: existing QcButtons submit candidates/none/cancel and show a readable
transcript caption. No CSS, builder, broader UX or microphone change.

## Scope and relevance

Adapters cover quotes/drafts, placed components, saved customer quote lines,
areas, component library and collections, orders and their two line formats,
invoices and lines, catalogues and imported rows. Raw quote entries and knowledge
remain existing query-registry sources rather than new candidate namespaces.
Knowledge remains off. Catalogues participate only when already permitted and
feature-enabled. Permission-dependent fields/relations retain the original schema
meaning; e.g. quote customer name is a quote field in the supplied registry, not a
new rule that Customers=Hidden masks every occurrence of a name in a visible quote.

Explicit IDs/numbers and explicit parent references outrank current-page hints.
A shared quote URL may represent a draft: status comes from the authoritative
reader, never from the route spelling. For otherwise unscoped requests, the current
record is checked first. A failed check is not permission to substitute another
account-wide record. Without a useful contextual match, plausible permitted
sources are queried concurrently (maximum four in flight).

Words/direct matches precede one bounded natural broadening. Business sources
may produce natural candidates, but the resolver still requires every subject
word in an identity field or a tightly bounded spelling match; a generic overlap
is insufficient. Catalogue natural broadening is deliberately not performed.
Evidence levels include identity, exact normalized names, phrase, complete-word
match and bounded spelling. Spelling alone never auto-selects. A high rank is not
sufficient evidence. Recency is descriptive, not proof that a tied name is unique.

A complete uniquely strong match may proceed. Up to five credible matches can be
shown; a single uncertain but credible match may also be offered for selection.
Large near-ties ask a useful discriminator rather than showing an arbitrary page.
Truncated/failed/skipped relevant reads prevent an account-wide uniqueness/absence
claim. Clarification wording is derived from candidate differences or missing
scope (domain, parent, customer, job, date or name).

Queries such as “Ridge quotes” check both a quote-name interpretation and a
component-containment interpretation. “Quotes with Ridge” has explicit child
semantics and uses the registered relationship/EXISTS path. Qualifiers survive
both planning and rereads. Unsupported compound language stays with the existing
bounded model path instead of silently executing a subset of the sentence.

## Two-turn continuation and trust boundary

A pending state contains the bounded original intent, labels/identity clues,
parent IDs, up to five choice IDs, rejected identities, discriminator and attempt
count. It is not a financial snapshot. For a pending P3 request it also holds the
user's proposed input rates/units: these are intent, not authoritative prices.

The client submits:

    [[sa-resolution:v1:<resolution-state-uuid>:<choice-uuid|none|cancel>]]

The existing message hash therefore binds the selection to admission and replay.
The server never trusts the packet as an entity ID or permission grant. It loads
the private state bound to the current actor/company/conversation/revision, then
looks up the choice, reauthorizes, rereads and checks names/parent membership.
Deleted, moved, stale or unauthorised records do not silently select alternatives.
Buttons never carry desired mutation inputs or approval tokens. Exact candidate
identity becomes known after a click, but permission/state/value checks still run.

The state reader accepts only the latest completed prior run in the conversation,
within both history cutoffs and 15 minutes. A failed/uncompleted run cannot publish
a reusable choice. A newer independent completed turn retires older choices.
Permission revision change invalidates them. All invalid/foreign/expired states
have the same null-read shape, not a tenant existence oracle. The application
rejects malformed state as failure, not a valid empty result.

`None of these` excludes the displayed identities. A useful textual answer is
combined with the previous task, not treated as a brand-new item query. A complete
small prior candidate universe can be reread/filter-narrowed without a global
search; incomplete or changed scope triggers a fresh bounded search. The service
also supports a model-generated refinement when the second answer is more complex.
That patch cannot change task, proposal values or approval, or replace exact
identities without an explicit new user reference. A fuzzy parent can be replaced
by an explicitly supplied number while independent customer/job constraints remain.

Two useful/unhelpful clarification attempts are the configured ceiling. Clicking
none for the first time records rejection and asks for a clue; it does not consume
an additional model-only clarification. Repeated none with no choices is bounded.
At exhaustion the assistant explains the missing context and asks for a fresh
well-specified request; it does not endlessly republish weak candidates. A new
independent command remains possible. This is a heuristic language system around
strict data operations, not a claim that all colloquial answers are understood.

Private state has logical 15-minute expiry. The write RPC opportunistically
removes at most 100 expired states for the same actor/company. Inactive accounts'
expired rows may persist until later activity/cascade deletion: do not market this
as physical deletion at exactly 15 minutes. No cron, pricing or auth infrastructure
was added. Longer-term cleanup can be reviewed separately if volume requires it.

## Price semantics and P3

Cost retrieval separates internal component rates/costs, component-library rates,
saved customer-facing quote lines, invoice lines and raw catalogue text. A missing
price is not zero and does not make an identified record disappear. Unpriced
material-order lines honestly report that their reader lacks a price. Quoted
financial totals still use the accepted engine adapter. Units, pack strategy,
visibility and inclusion flags remain labelled; no model arithmetic, tax inference
or price conversion was added. Duplicate internal/customer-price candidates can
legitimately require the user to choose which meaning of cost they want.

Only the strict one-field rate grammar or the existing P3 tool can create an
internal `propose_component` intent. Parent and child are reverified, then the
**original P3 proposal** function handles eligibility, snapshot, units and guards.
`applied` is always false on a resolver result. Confirm remains the existing
requester-bound action card, with its original permission/state revalidation and
audit proof. Selected non-editable/sent quotes can still be correctly refused.
Do not loosen a domain refusal merely to make a test produce a proposal.

## Catalogue reader and SQL

The additive draft is
`backend/supabase/migrations/20260927150000_sa_v2_resolver_v171.sql`, generated by
`scripts/generate-sa-resolver-sql.cjs` using the accepted P1.7 template and
`scripts/sa-resolver/resolution-state.sql.in`. Old migrations are raw unchanged.
The two older generators' check mode now normalizes line endings for comparison
only; it does not rewrite any migration or alter their generated SQL meaning.

The new business reader is STABLE SECURITY INVOKER with row_security on, the same
admitted scope, strict source/field/relationship compiler and bounded financial
population logic. The compatible capabilities RPC adds `resolver_version=1`.
Only private assistant-state RPCs are SECURITY DEFINER; those cannot read business
records, and the metadata writer is service-role-only. Browser roles have no
state-table privileges/RLS policies. The application uses the caller client for
all actual business reads, not admin access.

For catalogue exact/words searches, alphanumeric tokens of length >=3 generate
parameterized necessary `search_text ILIKE` predicates before expensive ranking.
The prefilter is permitted only for default raw search or mapped raw-cell fields,
not for catalogue_name, which is not an imported cell. This depends on the existing
import pipeline placing all raw-cell values in search_text; validate it on real
imports and mapping changes. Default registry searchFields remains search_text.
The final existing rank/word semantics still decide results after prefiltering.

A preflight counts at most 1,501 candidates. More than 1,500 raises P1711/too_broad
before expensive ranking or aggregate presentation. This is NOT sampling. Natural
catalogue ranking and nested related catalogue-row searches raise P1712 with a
supported direct/narrow query instruction. Short/common terms and parent-name
searches may still require a narrower catalogue/description clue. The app retains
bounded repair; do not re-enable an unbounded scan to avoid that clarification.

An indexable predicate is not proof PostgreSQL uses an index. Actual imports,
100k scale, EXPLAIN (ANALYZE, BUFFERS), dense term refusal, cancellation and query
plans are mandatory gates in DATABASE_ACCEPTANCE.md. No new index is invented
without that evidence; existing trigram index definitions are unchanged.

## Performance budgets, diagnostics and limits

`RESOLVER_LIMITS`: five displayed choices, ten rows per source, four concurrent
reads, 28 business reads, two clarification turns, twenty rejected IDs, 12-second
resolver budget, four-second per-read budget, 30,000-byte state. Order-date child
discovery currently binds at most ten matching parent orders; more asks for a
narrower parent, never ranks a sample. Canonical P1.5 commands remain faster where
applicable. A broad cold search can still be slower than an exact lookup.

`sa_entity_resolution` reports run ID, read counts, searched/failed/truncated/
skipped source names, broadening, clarification count and elapsed time; no names,
IDs of business records, values, transcript or credentials are logged by it.
`sa_retrieval_capabilities` reports resolverByServer/resolverVersion/resolverActive.
`sa_turn_performance` uses path=resolver for the direct path and existing model/
tool counts on model paths. The existing turn-end telemetry remains the canonical
admission/finish timing source. Do not compare pipelineMs alone to wall-clock turn
latency. A one-model resolver path may report path=model with a resolver tool call.

Measure cold and warm p50/p95, first and follow-up turns, model calls/tokens,
database work, resolver reads, total-to-finish and task correctness separately.
No live speed claim is made here. A client abort is not proof the SQL query stopped;
verify real PostgREST/server statement cancellation before approving scale.

## Rollout and rollback

Keep SMART_ASSISTANT_RESOLVER_ENABLED off through build/schema/security checks.
Preserve existing P1.6/P1.7 settings and the approved one-company test restriction.
After the sole new migration passes acceptance, enable the server flag only on
that testing deployment and verify capability/tool/reader diagnostics. P4 and
knowledge remain off. Missing version/table/function or a mid-turn rollback must
fail safely; never send an opaque old selection to Luna as free text.

Rollback is flag-off, returning new ordinary requests to accepted P1.7. Do not
undo the migration destructively during traffic. Old resolution buttons then
report unavailable/expired rather than becoming approvals or model prompts.
The narrow boolean decoder fix remains in the code with the flag off.

Release gates are not satisfied by this package: full application types/build,
real migration/RLS, browser, model, scale and cancellation must be done by Gavin
in the normal integration environment. Return exact evidence and unresolved
examples, not a blanket “tests passed”.
