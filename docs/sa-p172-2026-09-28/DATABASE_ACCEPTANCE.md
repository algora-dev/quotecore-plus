# P1.7.2 database and runtime acceptance gates

Status: NOT EXECUTED HERE. Static SQL inspection is not PostgreSQL parsing or a security proof. Use a disposable/reviewed testing company, never create test fixtures in unrelated accounts. Preserve all canonical accounting and business mutation functions.

## Apply only the new reviewed draft

`backend/supabase/migrations/20260928150000_sa_v2_task_context.sql`. Depends on the accepted P0/P1/P1.5/P1.6/P1.7/P1.7.1 schema. All 180 original migration SQL files are unchanged. The new file does not replace any existing function. If schema drift exists, reconcile the draft, do not relax its checks.

## Objects and role expectations

- Two private RLS-enabled tables: `assistant_v2_task_context` (one checkpoint per owned conversation), `assistant_v2_task_runs` (immutable admitted-run binding).
- Direct table access revoked for anon, authenticated and service_role. Metadata functions are SECURITY DEFINER with fixed search_path and explicit identity/scope checks. Business queries still use the existing SECURITY INVOKER/RLS readers.
- Authenticated-only: `sa_v2_task_snapshot`, `sa_v2_task_read`, `sa_v2_task_close`, `sa_v2_resolution_read_v172`.
- Service-role-only: `sa_v2_task_begin`, `sa_v2_task_finish`; both require current admitted run, exact user/company/conversation, enabled rollout, run-scope permission revision and current knowledge revision. The browser cannot manufacture boundaries or certify model work.
- No externally granted execute: projection `sa_v2_task_view`, helper `sa_v2_task_trusted_run`.

## Must prove, with actual PostgreSQL/PostgREST

1. Migration compiles and exact function signatures match `v2/database.ts`; all read/close functions work with authenticated user's own JWT. Confirm direct table grants and function grants as each role, not just service-role fixture calls.
2. Reject unauthenticated callers, foreign users in the same company, foreign company conversations/tasks/runs, stale permission revisions and old knowledge epochs. Withhold old labels, state, pending messages and history as well as business results. Test a same-revision history cutoff change.
3. Reject begin/finish on non-admitted/terminal run or missing run scope. Reject authenticated calls to private writer/helper functions. Never accept browser-provided role/company as authority.
4. New request creates a new task ID. Continue/correct keeps that task ID and increments version. Read selects only completed, permitted, unexpired resolver state inside the current task, not the last conversation run. Null/expired/closed state cannot leak into a fresh model prompt.
5. Candidate selection checks latest same-task state plus explicit stored state ID; moving/deleting/repricing a record or revoking permissions after displaying choices must cause authoritative reread/refusal, not stale-label output or a substitute.
6. Done/Move on only closes metadata. Check zero writes to quotes/components/orders/actions, messages, quota/reservations and canonical runs. No generated assistant reply and no provider call from that endpoint. Existing pending proposals keep original status and guards. Typed closure is a normal admitted turn.
7. While any accepted/running run in that conversation remains unresolved, metadata closure/reset is refused. Test two tabs, concurrent begin, version collision, duplicate close, duplicate same-run begin and finish after another task supersedes it. Lock order uses owned conversation then checkpoint; verify no deadlock with actual admission/finish functions.
8. Drop the HTTP response before/after canonical finish and before/after task close. Same request key must replay canonical result, never invoke model twice. Lost close response reconciles its closed metadata. A late task response must not resurrect old context.
9. Rollout/knowledge/permission changes during provider work must fail safe; provider usage already returned must still reach unchanged trusted canonical finish. Task metadata finish failure is not a reason to rerun the provider.
10. Verify session/multi-tab behavior after permission epoch changes and 15-minute task expiry; old buttons remain harmless even if browser has not refreshed. Current-page hints never override explicit IDs.

## Timing and cancellation

Three small sequential checkpoint RPCs (read, trusted begin, metadata finish) are added to a normal task-enabled turn; a capability read is needed before them and is reused later. Snapshot is fetched in parallel with existing session refresh. Measure overhead on warm and cold deployment. EXPLAIN checkpoint/run/state lookups with realistic history volume. There is no lower-latency guarantee until measured.

Preserve existing 90-second orchestrator deadline; all provider work uses that signal. The inherited bootstrap/admin RPCs are not all independently abortable, including task metadata. Test effective PostgREST/caller timeout and reaping; do not claim total DB cancellation from an AbortController alone. No extra background worker/retry/cancellation path was added. The metadata expiry is not run expiry and never changes accounting.

Re-run the existing 47-case security battery, catalogue 100k probes and 200/201 quote totals boundary if integration touches readers. P172 does not change their SQL. Do not widen rollout on a green mock test alone.
