# Smart Assistant P1.5 — speed-first implementation handoff

Date: 2026-09-25. Source baseline: `quotecore-plus-SA-handoff-2026-09-25.zip` supplied by the owner. This document supersedes earlier *proposed* speed work, not the locked quota/auth/pricing contracts. Read root `RETURN_NOTES.md` first.

## Delivery status

Actual source changes are supplied, not pseudocode. They are **not deployed or certified for live use**. No SQL was applied, no real user turns were sent, and no billing/quota/feature configuration was changed. P2/P3/P4 remain off. The existing `gpt-5.6-luna` default and environment override contract are unchanged.

The shipped offline tests cover real pure functions, orchestration, scope/tool adapters and the turn route with explicit dependency stubs. They do not substitute for a successful Next build, authenticated database/RLS tests, live model evaluation or browser/device tests. Dependency installation failed in this environment; see the validation evidence.

## 1. Objective and completed implementation plan

The owner explicitly moved visual UX, microphone/speech, PWA notifications and new editable domains out of this pass. This is the runtime/data-read foundation for those later phases.

| Batch | Implementation | Principal files |
|---|---|---|
| A. Bound the fast grammar | Whole-utterance deterministic intent parser; qualifiers/compound/negated requests fall back rather than being truncated | `speed/intent.ts`, `speed/records.ts` |
| B. Share retrieval operations | Existing P1 search/read/navigation authority reused by both deterministic commands and composite model tools | `speed/operations.server.ts`, `v2/tools.server.ts` |
| C. Remove avoidable work | Skip config/history/session/model for self-contained commands; lazy session; parallel independent bootstrap reads; page context travels with the turn | `orchestrator.ts`, `V2ChatClient.tsx`, turn route |
| D. Shorten model loops | Explicit safe-read concurrency (maximum three); ordering barriers for cards/proposals; repeated-call detection; strict argument parsing; one terminal synthesis on repeats | `speed/model-loop.ts`, `speed/tool-batch.ts` |
| E. Authoritative facts | Exact scoped counts and bounded quote-total snapshots; existing pricing/tax/currency engines; no model arithmetic | `speed/facts.server.ts`, `speed/quote-totals.ts`, additive SQL draft |
| F. Observe and validate | Stage timings, model/tool call counts, metering, provider first-token timing, HTTP finalisation timing; offline regression tests; 45-case corpus and opt-in benchmark | `speed/telemetry.ts`, new `scripts/*smart-assistant-speed*` |

All `speed/*` paths above are under `app/lib/smart-assistant/`.

## 2. Execution paths

### Canonical command

Authenticated user → unchanged `sa_admit_run` reservation/replay decision → profile and V2 runtime/scope binding → exact deterministic grammar → authoritative P1 operation → fresh final access check → unchanged service-role `sa_finish_run` wrapper → existing client session/navigation reconciliation.

There are **zero LLM calls and zero model tokens** on this path. The request is still an admitted, reserved assistant turn: zero tokens do **not** mean a free turn or bypassed quota. No full company prompt, raw transcript or V2 session is loaded for a self-contained command. Current-page commands with no inline hint may still need the existing session lookup.

Examples with the speed flag on:

- `Open my latest draft`, `Take me to my latest quote`, `Open my latest invoice`.
- `Show invoices`, `Show my orders`, `List draft quotes`, `Show customers`.
- `Open quote 1234`, `Open invoice INV-1042`, `Open order MO-1042`.
- `Show this order`, `Show this quote` with an authorised current page hint.
- `What can you help me with?` (permission/phase-aware capabilities).

With the separate facts flag and verified migration:

- `What's the total of my most recent quote?`, `What is the total for quote 1234?`.
- `Count quotes`, `Count draft quotes`.
- `How many quotes did I create this month?`, `How many draft quotes did we create this month?`.

“Latest” deliberately retains P1's **last-update** ordering, not creation ordering. Responses/card notes disclose that. “My latest” retains the workspace-record meaning of P1; the **count** operation's `owner=me` specifically filters the actual creator. Requests such as “latest quote I created” do not match the deterministic grammar.

Lists remain the existing bounded record choices (up to ten), not complete lists or counts. Numbered records are exact-filtered after authorised search. Fuzzy matches never become exact-number navigation. Components/customers do not have a newly invented number-lookup contract.

`Open my latest draft for Smith`, `Show invoices over $1000`, `Do not open quote 1234`, `Open quote 1234 and email it`, and unsupported aggregations deliberately do **not** enter the fast grammar. Natural-language model interpretation remains subject to the same tools and permissions.

### Model-assisted request

V2 scope is established before any transcript query. Company config, lazy scoped session context and the existing bounded raw-history query then run independently. The latest-30/current-message-once rule and the V2 visible-message intersection are preserved.

The preferred ordinary shape is **one tool-planning model step → authoritative composite operation / independent reads → one synthesis model step**. It is a target shape, not a guarantee that every natural request takes two model calls.

New tools:

- `resolve_records`: selection plus the existing navigation/choice card in one operation. A read request returns a compact record; an explicit open request prepares one auto-open card. Ambiguity produces choices without opening a guessed result. A current record is not re-read redundantly.
- `count_quote_records`: exact fixed-shape count with explicit kind, period and owner.
- `resolve_quote_totals`: selection **and** totals in one tool when the ID is not yet known. Avoids another model step just to pass a found ID to a total reader.
- `read_quote_totals`: totals for an already-known authorised quote ID.

Existing P1 tools remain available for legacy/specialised reads. Full bounded roof/component details remain in `read_record`; they are removed from the compact composite summary, with an explicit omission note. Recent already-authorised record-card references are included as **untrusted, stale identity hints**, not fresh business facts. Values must be re-read.

Only explicitly declared read tools run concurrently, at most three. Card/proposal operations remain ordering barriers. Every existing low-level reader retains its authoritative fresh-access check. Only redundant adjacent outer guards were removed. No permission or result cache is shared across requests.

Exact repeated tool calls in a turn are not executed again. The model gets a repeat/error result and one tools-disabled synthesis opportunity. Unavailable/invalid tools are not executed with default empty arguments. Limits remain five model calls and ten total tool calls. Intermediate “I will look it up” prose is never reused as a final answer when the terminal completion is empty. Usage reported by completed provider steps is preserved on loop/permission/provider failures. Usage never returned by a failed/aborted provider call remains unknown under the existing model-client contract; this batch does not invent or recertify it.

The 90-second signal remains cooperative. It covers provider calls and checkpoints; it does **not** prove every in-flight PostgREST statement is physically cancelled. Parallel tool batches drain siblings before failure reaches finalisation. Validate database/proxy timeouts on the real deployment; do not treat a function-local `statement_timeout` setting as proof of a hard whole-turn deadline.

## 3. Optional facts: definitions, not guesses

SQL draft: `backend/supabase/migrations/20260925160000_sa_v2_speed_facts.sql`.

Prerequisites are integrated P0/P1 only. Do **not** apply P2/P3/P4 merely to use this read-only batch.

The draft adds a narrow scope-check helper and two read-only RPCs:

- `sa_v2_speed_scope`: verifies authenticated requester/company, active admitted run, owned conversation, bound run scope, current permission revision and P1 gate. Security definer only for the private scope proof, with pinned search path and explicit grants.
- `sa_v2_speed_count`: security invoker, caller RLS and company filters. Fixed enums: quote/draft, all time/this month, workspace/me. No dynamic SQL or arbitrary model filter expression. Count is a decimal string to avoid JS bigint precision loss. Complete results must explicitly say UTC and complete.
- `sa_v2_speed_quote_snapshot`: security invoker; one stable read snapshot of authorised quote inputs. Only the minimum financial inputs are returned, not broad table rows or personal details. Components are absent when Components is Hidden. More than 500 component rows, 500 customer lines or 100 tax rows returns `complete=false`, never a partial financial total.

The quote total adapter calls the unchanged `computeQuoteTotals`, `computeTaxLines`, `getEffectiveCurrency` and `formatCurrency` implementations. It intentionally does **not** call a send-document action or render the summary page: those paths import or perform unrelated operations, including lazy snapshot writes.

There are two existing legitimate total definitions, so the assistant returns **labelled** values rather than inventing one universal total:

1. **Builder summary total, current**: stored component material/labour costs and existing margins, plus visible/included custom lines and quote taxes. Matches the summary page's current calculation; not its historical “Original” snapshot.
2. **Saved customer quote total**: all saved included customer-line amounts and quote taxes, with the positive legacy tax-rate fallback only when there are no quote-tax rows. Matches `computeQuoteTotalForMerge`/the customer send adapter. It is not unsaved editor state.

Components hidden means builder total unavailable, not zero. No customer lines means no saved customer total, not zero. Invalid or incomplete inputs fail closed. No measurement conversions were changed.

Counts are **current-status** quote/draft counts, not a historical status-transition report. “This month” is explicitly the UTC calendar month, not a guessed user/workspace timezone. `me` uses `quotes.created_by_user_id = auth.uid()`; workspace includes colleagues. No customer/status/date/custom filter beyond the registered contract is accepted.

Not implemented: highest-value quote ranking, cross-quote ridge sums, a general analytics DSL, or arbitrary database exploration. Those require agreed total/unit/status definitions and broader database evaluation. The prompt explicitly forbids turning a capped search into an aggregate or scanning many records to fake completeness.

These SQL functions are additional authenticated read capabilities subject to existing P1/run/permission checks. The environment flag controls **assistant tool registration/routing**, not SQL privileges. Like existing P1 reads, direct RPC privileges are enforced by SQL, not by a server environment variable.

## 4. Admission, finish, replay and failures

`sa_admit_run`, reservation tables, quota calculations, billing/pricing/auth infrastructure SQL, `sa_finish_run` and its service-role-only grant are unchanged. Existing migration files are byte-for-byte preserved.

The route has one targeted failure-path correction: after admission, a missing/failed company-profile lookup now reaches a failed trusted finish instead of returning early and leaving the active reservation to stale-run recovery. There is exactly one finish attempt after the pipeline outcome. If finish fails or its response is uncertain, the route returns an uncertain failure; it does not rerun the model, attempt a second conflicting finish, or return unverified success.

Duplicate/replay/refused admission responses still return before profile, tools, model or finish. Existing client request keys, session reconciliation, navigation reauthorisation and scope visibility are preserved.

The V2 client no longer POSTs page context separately before every send. The turn body optionally includes `{pageContext:{companyId,pathname}}`. The server validates it, compares company identity and resolves it only as an untrusted hint. It is not part of permission/confirmation authority and does not change the admission request-hash contract. Old clients without this field continue to use stored session context.

No layout, CSS, microphone behavior, composer, PWA or general QuoteCore screen was redesigned. Deploy the client and turn route together so the transport optimisation is used.

## 5. Flags, deployment order and rollback

New server flags default **off**:

```text
SMART_ASSISTANT_SPEED_ENABLED=false
SMART_ASSISTANT_FACTS_ENABLED=false
```

They do not replace `SMART_ASSISTANT_V2_ENABLED` or the account/company P1 gates. Preserve the existing Luna configuration and all existing P2/P3/P4 gates.

Recommended integration sequence:

1. Review the changed-files manifest/patch against the recorded baseline. If the live branch has advanced, merge the changed files rather than overwriting newer work with the full snapshot. Install with the unchanged lockfile in the normal environment. Run full typing, changed-file lint and Next production build. Run all three new offline suites and source checks. Do not deploy through a failed build.
2. Deploy to **testing** with both new flags off. Smoke-test legacy/V2 admission, replay, request reconciliation and current-page context. Main remains V1 unless separately approved.
3. Enable **speed only** on the testing deployment. No new SQL is required for canonical navigation/composite retrieval. Verify zero model calls, zero model tokens but a normal reservation/finish for canonical turns. Check real navigation/hide/reopen and current draft-vs-quote permissions.
4. Review and apply the **new facts SQL draft only** through the agent's normal migration process. Check actual schema types, RLS/grants, scope/revision races and query plans on representative data. Do not blindly run all outstanding migration files: P2-P4 in the source are still unapproved drafts.
5. Enable the facts flag only after those database gates and quote-engine parity tests pass. Run the extended benchmark and manual permission matrix.
6. Compare measured results, then seek the owner's existing rollout approval before production enablement.

Rollback the new routing/tools by setting facts and speed false. Leave the additive read RPCs in place unless a separate reviewed rollback is required. Flag-off does not revert the shared route's single-finalisation correction, inline page transport, or shared model-loop validation; a complete code rollback uses the baseline source/patch. Existing V2 master and phase rollback procedures remain in force.

If a facts migration is missing while the flag is on, it fails as unavailable/setup error; it must never return zero or a guessed number. Turning facts off removes both the fast analytical path and those model tools.

## 6. Validation commands and evidence

With project dependencies installed:

```sh
node scripts/test-smart-assistant-speed.cjs
node scripts/test-smart-assistant-speed-services.cjs
node scripts/test-smart-assistant-speed-metrics.mjs
node scripts/check-smart-assistant-speed-source.cjs
npx tsc --noEmit --incremental false
npx eslint app/lib/smart-assistant/speed app/lib/smart-assistant/orchestrator.ts app/lib/smart-assistant/turn.ts app/lib/smart-assistant/v2/tools.server.ts app/lib/smart-assistant/v2/database.ts app/api/smart-assistant/turn/route.ts app/components/smart-assistant/v2/V2ChatClient.tsx
npm run build
```

The CJS offline suites use the project's existing TypeScript dependency, or an explicitly provided `TYPESCRIPT_PATH` for restricted environments. No new dependencies or package scripts were added. The loader is test-only and never imported by application code. Syntax transpilation is **not** semantic type checking.

Evidence and precise limitations: `docs/sa-speed-2026-09-25/validation/VALIDATION.md` and accompanying logs. Do not run the existing `npm run test:assistant` harness on the shared preview database casually: it uses service-role credentials and creates/deletes fixtures. No such harness was run here.

### Database/manual gates still required

- Authenticated A vs same-company B vs foreign company; inaccessible IDs, finished/unbound runs, wrong revisions, and company switching. Verify denied calls produce no data.
- Revoke Quotes/Drafts/Components/Customers during a turn. Verify terminal output/cards remain correctly scoped, including reopening history.
- Facts: exact count >10, zero, creator-vs-workspace, draft transitions, UTC month boundary, null/deleted creators and company RLS. Do not count search pages.
- Totals: normal, blank/manual/digital draft, custom discounts, hidden/excluded customer lines, multi-tax/legacy/no-tax, currency fallback, Components hidden, unsaved customer lines, >500/>100 bounds. Compare against existing UI/domain totals using the same saved state.
- Confirm no updates to quote/order/invoice/customer/component rows from new facts calls. No new external send path exists.
- Verify function privileges and private scope-table isolation. Test `EXPLAIN (ANALYZE, BUFFERS)` in an approved environment before facts enablement. No speculative new indexes were added.
- Replay identical clientRequestId; mismatch payload refusal; quota exhausted; provider failure after a paid step; terminal empty model answer; concurrent submissions; lost/false/throwing finish response; process disconnect and stale-run recovery. Never retry a possibly-running request using a new key.
- Genuine browser taps: current-page request, destination reauthorisation, navigate/hide/reopen, list choices, no duplicate navigation after reload, text and existing voice fallback. No browser/device claims are made here.

## 7. Measure the real deployment

Structured logs:

- `[smart-assistant:performance]` / `sa_turn_performance`: runId, configured model, execution path, pipeline status/time, model/tool call attempts, repeat suppressions, separate input/output tokens, bounded stage timings, backend first-model-token time.
- `[smart-assistant:request]` / `sa_request_performance`: runId, canonical/uncertain status, request, admission, profile and finish timings.
- Completed turn HTTP responses carry `Server-Timing` and `Cache-Control: no-store`.

No prompts, tool arguments, record values, customer data, credentials or tokens are logged. Existing run IDs allow correlation. Parallel stage times overlap: **do not sum them** as total elapsed time. Request timing starts after body validation and excludes network travel/browser rendering. `firstModelTokenMs` is not visible output: **streaming to the browser is intentionally not implemented in this pass**.

The model string on a fast-path log is the configured model, not evidence it was invoked. The report groups zero-call paths as `no-model`.

```sh
node scripts/benchmark-smart-assistant-speed.mjs --plan
node scripts/report-smart-assistant-speed.mjs /private/path/to/server-log.jsonl
```

The report accepts JSONL and prefixed log lines (or envelopes with `message`). It computes observed p50/p95 using nearest rank, deduplicates by run, distinguishes pipeline completion from confirmed finish, and leaves missing samples null. It neither infers answer accuracy nor prices tokens using guessed/current tariffs.

### Opt-in real HTTP benchmark

The supplied driver uses the **ordinary authenticated turn endpoint**. It consumes quota, may incur model cost, and persists normal conversation history. It does not create/delete fixtures, change permissions/flags, run SQL or use service-role credentials. The testing environment is not assumed isolated from production data.

Prepare an existing owned **test conversation** through the app and a local secret file containing the user's single-line Cookie header value. Keep the file out of Git/artifacts and remove it after use. Supply:

```sh
export SA_SPEED_BENCH_ACK=paid-turns-preview-is-not-isolated
export SA_SPEED_BENCH_BASE_URL=https://YOUR-APPROVED-TESTING-HOST
export SA_SPEED_BENCH_ALLOWED_HOST=YOUR-APPROVED-TESTING-HOST
export SA_SPEED_BENCH_COOKIE_FILE=/private/path/to/cookie.txt
export SA_SPEED_BENCH_COMPANY_ID=YOUR-COMPANY-UUID
export SA_SPEED_BENCH_CONVERSATION_ID=YOUR-OWNED-CONVERSATION-UUID
export SA_SPEED_BENCH_CASES=core01,core02,core03,core04,core05,core06,core07
export SA_SPEED_BENCH_LABEL=testing-luna-speed-and-facts
export SA_SPEED_BENCH_OUTPUT=/private/path/to/new-benchmark.jsonl
node scripts/benchmark-smart-assistant-speed.mjs --run
```

Use a **new output filename**; existing evidence is never overwritten. Set `SA_SPEED_BENCH_REPEATS` to 1–3 if approved. Numbered cases require `SA_SPEED_BENCH_QUOTE_NUMBER`, `...DRAFT_NUMBER`, `...INVOICE_NUMBER` or `...ORDER_NUMBER`. Current-page cases require `SA_SPEED_BENCH_PATHNAME`. The cases file documents dependencies.

Before each measured turn the driver checks an owned idle V2 conversation, matching company, P1 on and P2/P3/P4 off. That preflight is outside the turn timer and may warm application/database services: it is not proof of a hard cold-start measurement. The driver does not render the UI or execute a navigation card; measure genuine browser first-use/navigation separately. It never automatically runs manual-only safety/mutation prompts. On failure, duplicate or uncertain transport it stops without retrying. Reconcile the original request before another run. Replies are not printed or stored by the benchmark; review them/cards in the normal test conversation and correlate run IDs with logs/database evidence.

Run a controlled Luna baseline (new flags off), then speed-only, then speed+facts with comparable fixtures, permissions, model/output settings and transcript length. Label cold first requests separately from warmed requests. The agent's source handoff reports 12.1s average across eight Luna runs and ~9.6s steady-state; those are **reported baseline observations, not results reproduced in this build**. No live before/after numbers are supplied here.

Initial engineering objective: zero model calls for admitted canonical matches; materially lower warm canonical latency, ideally under two seconds in the normal deployment. That is a target, not a measured promise. For natural reads, measure completed-task accuracy, model/tool calls, end-to-end time and metered tokens together. A faster wrong or unverified answer is not a pass.

## 8. Deliberately next, not quietly claimed complete

First run the real performance/security acceptance pass. Use its traces to decide whether remaining latency sits in admission/scope, database queries, model calls, finish or client refresh/navigation. Do not simply increase model budgets or cache permissions to hide a bottleneck.

Broader deterministic analytics (highest-value/ridge), finer per-RPC instrumentation and independently measured streaming can follow that evidence. Browser streaming needs a reviewed provisional-output/replay/disconnect contract; raw provider tokens are still withheld until normal final output here. Visual redesign, microphone/speech, PWA notifications, P2 attention rollout and P3/P4 mutation activation remain separate future work. No Orders Edit or generalized mutation migration from an older package was merged into this authoritative branch.
