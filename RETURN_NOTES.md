# RETURN NOTES — P1.7.3 Release Hardening (2026-09-28)

## Start here

This package is based on the supplied `quotecore-plus-SA-next-round-handoff-2026-09-28.zip`, whose contained source tree is the authority for this pass.

**NOT DEPLOYED. NEW SQL NOT APPLIED. No live latency, browser or provider-health claim is made.**

P1.7.3 is deliberately small. It does not redesign task context, Universal Retrieval, P3, quota/admission, or the Smart Assistant UX. It hardens four release risks identified in the latest agent handoff: missing rollout rows, common interpretation anchors, provider/tool-schema health detection, and honest setup/access failure presentation.

The prior root return notes are preserved at `docs/sa-p173-2026-09-28/BASELINE_RETURN_NOTES.md`.

## What changed

### 1. Missing retrieval rollout rows no longer turn task context into a blanket 503

`createV2Scope()` now distinguishes an ordinary staged-rollout `disabled` capability state from an actually incompatible deployment.

- `disabled` — including no rollout row, or an explicit `enabled=false` row — falls back to the pre-task-context assistant path.
- `setup_required`, or a supposedly ready deployment without the required resolver capability, still fails closed with `migration_required`.
- Explicit rollout disablement remains disabled; this does **not** silently enable retrieval or task context.
- A sanitized `sa_task_rollout_fallback` diagnostic records the fallback without user text.

This fixes the release-blocking condition where accounts not yet provisioned for retrieval could fail every Smart Assistant request when the server task-context flag was globally enabled.

### 2. Common edit/customer wording is anchored more consistently

The deterministic anchor layer now recognizes common component-edit shapes for material rate, labour/labor rate, quantity/qty, waste and pitch while preserving the component name supplied by the user. It also recognizes customer qualifiers on plural quote/draft/invoice/job/order requests, including material orders.

Examples covered offline include:

- `Set Ridge labour rate to 25 per m on quote 1014`
- `Set Ridge quantity to 40 on quote 1014`
- `Change the waste on Ridge component to 10% on quote 1014`
- `Change the pitch of Ridge component to 25 degrees on quote 1014`
- `Show me quotes for John Smith`
- `Show orders for John Smith`

The existing P3 validator/proposal/Confirm path still owns the requested mutation and value. Anchors only preserve entity/qualifier identity so the model cannot casually switch records/components.

### 3. Admin-only provider canary

A new admin page at `/admin/smart-assistant/health` runs one tiny real configured-model request containing a no-op function schema. Its purpose is to catch provider/model contract regressions — especially function-tool request incompatibilities — immediately after deployment.

The canary:

- requires `requireAdmin()`;
- uses the existing configured Smart Assistant model/client;
- includes a deliberately unused function-tool schema;
- sends no company/customer/conversation data;
- creates no Smart Assistant run and invokes no QuoteCore business tool;
- reports healthy/degraded/unavailable, latency, model and token counts.

This is a manual/admin operational probe, not a background monitor and not a substitute for end-to-end assistant acceptance.

### 4. Canonical setup/access failures are visible instead of generic retry noise

The public V2 session contract now retains the bounded canonical `error_code` from recent assistant runs. One additive SQL wrapper extends `sa_v2_session_read(uuid)` so recent run outcomes include that field while retaining the existing owner/company/history fences.

The existing failed-turn UI can therefore distinguish:

- `migration_required` / setup incomplete — explicit setup message, not retryable;
- access/workspace/permission change — explicit reopen/access message, not retryable;
- ordinary failed/timed-out turns — existing single logical failure/retry behavior.

No provider body, prompt, stack, secret or model-authored SQL is exposed.

## Locked boundaries preserved

- Existing `sa_admit_run` / reservation / quota / replay / trusted finish behavior is unchanged.
- Existing turn route and canonical turn finalization are unchanged.
- GPT-5.6 Luna configuration and reasoning client are unchanged.
- P1.7.2 task semantics, Universal Retrieval, P2 and P3 confirmation/audit remain in place.
- P4 remains gated.
- No arbitrary SQL/database tool was added.
- No existing migration was edited. The package adds one draft migration only.
- No visual Smart Assistant redesign, voice, image, PWA or analytics expansion is included.

## Important validation-manifest correction

The supplied authoritative ZIP already failed its own `check-smart-assistant-task-quality-source.cjs` before P1.7.3 changes because `docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json` contained stale hashes from an older tree. This was reproduced on a clean extraction.

P1.7.3 refreshes that **validation metadata only** against the actual supplied authoritative ZIP, then runs the protected-source gate. The application source was not altered merely to satisfy the manifest.

## Required Gavin integration sequence

1. Reconcile this package against the current integration branch; do not blindly overwrite newer fixes.
2. Keep all current production/testing feature flags as they are. The rollout fallback is compiled behavior, not a new customer-facing enable flag.
3. Install dependencies and run real `tsc`, lint and `npm run build` in the normal environment.
4. Run:
   - `node scripts/run-smart-assistant-task-quality-offline.mjs`
   - `node scripts/run-smart-assistant-resolver-offline.mjs`
5. Review/test **only** `backend/supabase/migrations/20260928190000_sa_v2_p173_release_hardening.sql`; do not mass-apply pending migrations.
6. On a database clone/testing environment, prove the wrapped session reader preserves all existing session content and now returns recent-run `error_code` only for the authenticated owner/company/history scope. Test forged conversation IDs, another user/company, expired history and authenticated grants.
7. Test two account classes with task context server-side enabled:
   - approved/ready retrieval rollout: P1.7.2 task context still works;
   - no rollout row and explicit `enabled=false`: assistant falls back normally rather than 503, without gaining retrieval/task-context access.
8. Re-run the owner continuous P1.7.2 acceptance sequences and P3 proposal/Confirm tests. Confirm no wrong-record/component regression from the new anchors.
9. As admin, open `/admin/smart-assistant/health` and run the canary against the actual configured provider/model. Confirm it is admin-only and contains no customer data in request/logs.
10. Inject/observe `migration_required`, access-changed and ordinary failed turns in testing and verify one clear inline outcome, not a generic retry loop.
11. Return the complete latest source/handoff ZIP with actual build, SQL/RLS, canary and live acceptance evidence before moving to UX/multimodal work.

## Actual evidence from this environment

- `node scripts/run-smart-assistant-task-quality-offline.mjs` — **PASS**, 981 executable TAP checks across the retained suites and new P1.7.3 checks, plus source/static gates.
- `node scripts/run-smart-assistant-resolver-offline.mjs` — **PASS**, including 203 resolver cases and retained source boundaries.
- New P1.7.3 source/migration checker — **PASS**.
- Baseline-vs-new `npx tsc --noEmit` — both fail because this environment lacks installed React/Next/Supabase/Node types. The updated tree produces 28 additional diagnostics, all attributable to the new admin canary route/components missing those same framework modules/JSX types. This is **not** a successful semantic typecheck.
- Baseline-vs-new `npm run build` — both run `check-server-deps` successfully, then fail identically with `next: not found` because dependencies are not installed. This is **not** a successful production build.
- No live PostgreSQL/RLS, browser, Luna/provider, account rollout, P3 mutation, or latency test was run here.

See `docs/sa-p173-2026-09-28/validation/VALIDATION.md` for exact limitations.

## Release decision

P1.7.3 is ready for Gavin to integrate and validate, not ready to declare production-safe from this environment alone. If its live gates pass, this should be the final small backend hardening pass before freezing the assistant foundation and moving into the Smart Assistant UX/multimodal phase.
