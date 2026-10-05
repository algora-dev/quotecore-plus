# P1.7.2 Task Context Quality - engineering handoff

## Scope and status

Implemented from `quotecore-plus-SA-quality-handoff-2026-09-28.zip`, agent branch `ux/phase-4` / `482513c8`. No deployed changes. The new SQL is a draft. New task routing/UI defaults off. Existing Luna configuration and reasoning fix, turn HTTP route, quota/admission/replay/finish, pricing engines, P2/P3 and original SQL remain unchanged.

This corrects a design regression introduced in our P1.7.1 implementation, not an agent integration failure. An unresolved resolver state was intercepting complete new requests. A literal plural missed Ridge; an apparent broaden repeated the same query; exact #1014 inherited the old Ridge condition. Passing isolated plan-shaped tests did not establish conversational quality.

## One boundary decision, not a second reasoning engine

Separate conversation history (retained), task (current goal) and run (existing admitted execution). Before fast/resolver/model execution, `tasks/controller.server.ts` reads one checkpoint and makes a single shared new/continue/correct/close/ask-boundary decision. The old P171 continuation heuristic is bypassed when this controller is active; it remains available only for rollback.

Clear complete new requests discard old filters and current-task references. A bare exact parent answers a typed parent question when appropriate, but cannot inherit a failed LIST's child condition. Expected short answers can refine an active pending question. Dependent pronouns retain task context. Complex language is delegated to the EXISTING first tool-planning model pass; grammar failure is not a failed database search. Acknowledgements with a new request work; `Thanks, what about its labour?` remains dependent. Unknown ambiguous fragments can ask Continue / New using a server-stored pending message that the user need not retype.

Examples tested through the real router/resolver with mock transports:

- Failed `show quotes with ridges` -> `quote 1014`: fresh exact quote, no old component condition.
- `How much does Ridge cost?` -> a genuine parent question -> `quote 1014`: keep cost/Ridge and constrain its parent.
- Quote result -> `What about its labour?`: same-task model context, current facts still reread.
- `No, ... quote with 200 ridges ...`: correction to first model interpretation, not a literal new customer-name value.

The prior latest-30 history query/current-turn exclusion is unchanged. Task run IDs apply an additional visibility mask to prior messages, record references and action context, along with all existing permission/history cutoffs. Current input appears once. A boundary choice resumes the stored original input once, excluding its previous boundary-question run from model history. No hidden synthetic prompt replaces admission text or request-key identity.

## Metadata and security

Two additive private metadata tables hold one current checkpoint and immutable admitted-run -> task/version bindings. They are not a mirrored QuoteCore database. Database readers enforce owner/company/permission/history/knowledge epoch. Trusted begin/finish writers enforce admitted running scope, current actor, rollout and epoch; the caller cannot set arbitrary task labels/history visibility through a model tool. All entity/pricing/P3 reads and mutations still use the existing authoritative paths.

Task version is compare-and-swap fenced. Closure and new-task changes cannot race an unresolved run to silently forget its outcome. Late responses, old task buttons, old selected candidate state and out-of-task model references cannot reopen a closed task. Metadata finish is deliberately NOT canonical run finish. A failure after model usage preserves that usage for the unchanged outer trusted finish.

Task context expires after 15 minutes (matching the bounded resolver context), not the entire transcript. A five-minute gap influences otherwise ambiguous short fragments; clear new requests work immediately and clearly dependent requests can still continue before expiry. No timer-generated nag, background model or automatic success inference. Exact names/IDs/candidate clicks, not fuzzy confidence, remain entity authority.

## Retrieval corrections

`tasks/interpretation.ts` consumes only whole supported requests. Unknown conjunctions/time/status/quantity qualifiers are not silently dropped. Supported owner list/restatement forms lead to real relationship reads. Possessive customer lists use the customer predicate. Latest/most recent/newest/last and earliest/first/oldest sort creation timestamp with stable ID tie-break, and pick ONE header rather than ask for a name. Under TASK_CONTEXT, these bypass legacy last-updated fast selection. Explicit Open still creates navigation; ordinary factual requests show a card.

Bare `latest NAME quote` tries customer first. Only a complete empty customer result permits an explicit name-search fallback. An explicit `for NAME` never drops its customer constraint; errors/truncation never trigger that fallback. Answers state creation-date semantics. Requests for other business timestamps remain model/registered-query work.

Whole Ridge/ridges/ridging words normalize in component-word search and component relationship predicates, preserving the other words. This is a small controlled vocabulary, not a general fuzzy synonym engine: `Ridge flashing` must not become plain Ridge, and unrelated words such as Ridgetop/Bridge stay unchanged. Exact equality/name semantics are not rewritten. Shared intelligent-query normalization also serves the model path. No arbitrary SQL, embeddings or shadow data store.

Per-turn successful discovery results are reused only to avoid executing an identical supposed broadening again. There is no cross-turn data cache; final selection/pricing/relationship reads remain fresh. A list request produces a bounded list (up to 10 displayed records with completeness note), not a one-record candidate picker. Ambiguous identity requests retain the existing up-to-five genuine-candidate threshold and None of these. No-match and too-broad remain distinct from permissions/setup/read failure.

Generic header lookup gives verified identity/context plus an Open card, not an automatic full pricing calculation. Numerical questions continue through registered authoritative facts/engines. The UI's existing last-final-card-only policy remains unchanged.

## Minimal functional UI

The active-task footer labels the interpreted/executed scope and shows Done for an answered task or Move on while unresolved. Not quite exposes an editable composer cue; it does not make a model call. Buttons close metadata only through a same-origin authenticated endpoint. They do not emit an assistant acknowledgement, delete chat history, create a new conversation, confirm/cancel proposals, or cancel/finish runs. They are optional: forgetting Done must not poison the next standalone request.

A typed `thanks`, `done`, `move on` or `new question` is still an ordinary admitted user message, handled without a model; it can return a short closure response and uses the existing allowance. Typed `yes`/`confirmed` is never approval. Existing explicit proposal Confirm remains separate, even after task closure. Task/candidate wire messages are never forwarded to Luna, including rollout rollback.

Canonical failed runs without an assistant reply get one inline failure next to their stored user message. No composer refill, duplicate generated error or competing generic retry banner. Unknown outcomes keep the original clientRequestId and one Check request control; reconnect only fetches status. Inline failure rendering is bounded to the existing latest run-outcome window, not fabricated for old unknown runs. New provider diagnostics log only known code/status/category, run id and hop, never prompt/body/key/stack. The original upstream incident's exact provider cause is not established by this archive.

## Rollout

New server env: `SMART_ASSISTANT_TASK_CONTEXT_ENABLED=true` only after database/build checks. Default false. Requires the already-enabled V2/P1, resolver, retrieval/V17 capability and approved company rollout. All normal access checks remain. Missing task schema or required resolver capability fails explicitly rather than silently using old continuation logic. Client functionality appears only when the session endpoint returns task metadata; no separate public flag.

Migration: apply ONLY `20260928150000_sa_v2_task_context.sql` after reviewing/testing it. No existing migration or domain SQL changed. Keep current Luna configuration, P2/P3, company restriction, P4/knowledge off as in baseline.

Rollback TASK_CONTEXT=false removes new checkpoint routing/controls and preserves conversation/metadata. It restores legacy P171 task interpretation, including its known weakness; it is not the quality fix. The resolver master switch still disables resolver routing. Shared read-only vocabulary/selection contract improvements remain compiled. No destructive down migration or quota reset is needed. Confirm stale wire payloads cannot reach a model after any rollback.

## Validation and limits

See validation/VALIDATION.md for actual command evidence. Executable mocks cover real scope/orchestrator/service code and explicit transports, not actual PostgreSQL/RLS, browser layout or Luna understanding. The supplied 20 continuous acceptance scenarios are NOT live-run. They include owner verbatim cases, corrections, true continuations, task closure, forgotten closure, pauses, stale buttons, CAS races and failed/uncertain turns.

Full tsc was attempted on baseline and implementation with absent dependencies; BOTH failed. Diffed diagnostics are missing framework/types and their cascades, not a passing semantic typecheck. Normal environment install/typecheck/lint/build are mandatory. The original historical P171 source-hash check already fails the supplied baseline at DESIGN_CHANGES.md due later agent UX changes. We preserved it unchanged and added protection against the actual 28 September baseline, rather than weakening assertions.

There is no measured live speed claim. Normal task turns add three small checkpoint RPCs (read/begin/metadata finish), reuse the capabilities read, and mask history without additional model classification. The intended improvement is fewer wrong/repair/clarification turns. Measure that AND per-turn overhead. Sanitized `sa_task_stage` logs separate read/begin/metadata finish milliseconds by run ID; `sa_task_boundary` logs the disposition/reason and inherited field names, never the user text. Bootstrap/admin cancellation limitations are documented in DATABASE_ACCEPTANCE.md; this pass does not redesign the locked run envelope.

Lower-priority generic count-copy polish, new analytics, P4, speech, PWA and visual redesign are not included. Existing scale/cancellation probes still require actual database evidence. Do not widen deployment based only on offline totals.

## Agent release decision

Run the owner four-message sequence repeatedly in ONE actual phone conversation, without New chat or Done between messages. Then prove the opposite: an appropriate follow-up retains scope. Add Done, forgotten Done, corrections, boundary choices and injected failures. Verify answer IDs/cards and current data, not just phrasing. Require no wrong-parent P3 proposal, no cross-tenant leakage, no duplicated execution/usage and no dead-air failure. Stop and report if any must-pass behaviour fails; do not paper it over by loosening constraints or adding prompt-only claims.
