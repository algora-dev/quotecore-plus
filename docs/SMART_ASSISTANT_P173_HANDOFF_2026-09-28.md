# Smart Assistant P1.7.3 Release Hardening — engineering handoff

## Purpose

P1.7.3 deliberately avoids another resolver redesign. P1.7.2 established the conversation/task/run boundary; this pass closes four concrete release risks from the latest agent testing without expanding product scope.

## A. Rollout fallback contract

Task context is a capability layered on an approved retrieval/resolver rollout. The previous implementation treated any unavailable resolver capability as fatal once `SMART_ASSISTANT_TASK_CONTEXT_ENABLED=true`, which made an unprovisioned company susceptible to a 503 on every assistant turn.

The new rule in `v2/tools.server.ts` is:

- `resolverAvailable(capabilities)` → run P1.7.2 task preparation normally.
- `capabilities.state === 'setup_required'` → fail closed `migration_required`.
- `capabilities.state === 'ready'` but resolver unavailable → fail closed `migration_required`; the deployment says it is ready but is internally incompatible.
- ordinary `disabled` state → do **not** create task metadata; continue through the existing pre-task-context assistant behavior.

The fallback does not turn retrieval on, grant permissions, manufacture a rollout row or bypass the existing tenant/assistant permission checks. An explicit disabled row remains disabled.

## B. Interpretation hardening is intentionally narrow

`resolver/anchors.ts` gained deterministic structural anchors for the common component edit phrases already supported by P3 and customer qualifiers on normal plural entity requests.

This is not a new NLP engine. The anchor is a constraint on model planning: if the human explicitly supplies `Ridge` and Quote #1014, the model is not allowed to silently substitute another component or parent. The mutation semantics/value still go through the existing registered proposal path and human Confirm.

Do not respond to future interpretation failures by growing this regex layer without owner examples. Complex language should continue into the normal Luna planning/retrieval route.

## C. Provider canary

New endpoint: `POST /api/admin/smart-assistant/health`.

New admin page: `/admin/smart-assistant/health`.

The canary deliberately exercises the configured model with a function definition while instructing it not to invoke the function. This checks the exact provider/tool-request surface that can break independently of QuoteCore code.

It is intentionally outside the normal assistant admission/quota path because it is an administrator diagnostic, not a customer assistant request. It must remain admin-only and data-free. Do not turn it into an unauthenticated uptime URL.

Expected healthy result: text `OK`, zero tool calls, HTTP 200. Any tool call/empty/unexpected text returns degraded 503; provider/client exceptions return unavailable 503.

## D. Canonical failed-run reason in session reads

The UI already renders one logical failure per stored user request. What it lacked was the canonical failure category. P1.7.3 adds `errorCode` to the bounded public `RunOutcome` and uses a SQL wrapper to include `smart_assistant_runs.error_code` in the existing session reader's recent-run envelope.

Migration strategy is additive in migration history but wraps the live function:

1. rename the current `sa_v2_session_read(uuid)` implementation to a private P1.7.3 base name;
2. revoke direct public/authenticated execution of that base;
3. create the same public function signature;
4. call the preserved base and replace only its `recent_runs` field with an owner/company/history-fenced projection that includes `error_code`;
5. grant the original public signature to `authenticated` only.

Gavin must test this against the real database before enabling it. The wrapper must preserve all existing session fields and grants. If the deployed function signature/body differs from the supplied baseline, reconcile rather than blindly apply.

## E. No changed security or billing model

P1.7.3 does not modify:

- assistant admission/reservation/quota/finalization;
- authentication/RLS model;
- Hidden/View/Edit permission semantics;
- model access to SQL;
- P3 Confirm/audit;
- P4 rollout;
- pricing/tax/currency engines;
- cross-company isolation.

## F. Acceptance requirements

Release hardening is accepted only after real integration proves:

1. an account without a retrieval rollout row can still use the baseline permitted assistant path with task-context server flag on;
2. an explicit `enabled=false` rollout remains off;
3. approved P1.7.2 companies retain task-context behavior;
4. true setup incompatibility still fails closed and displays an explicit setup error;
5. common labour/quantity/waste/pitch/customer phrases resolve the same entity/component repeatedly;
6. no wrong-parent/wrong-component P3 proposal appears;
7. admin canary is admin-only, tool-schema capable and customer-data free;
8. session reader preserves owner/company/history fences and exposes no other tenant run outcomes;
9. the full owner continuous-conversation acceptance and P3 Confirm suite still pass.

If these pass, freeze backend foundation work and proceed to the separately planned Smart Assistant UX/multimodal phase rather than adding more speculative resolver machinery.
