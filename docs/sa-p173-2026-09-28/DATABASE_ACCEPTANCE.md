# P1.7.3 database / rollout acceptance

## Migration under test

`backend/supabase/migrations/20260928190000_sa_v2_p173_release_hardening.sql`

Do not apply unrelated pending migrations merely because this file is present.

## Session reader

On a clone/testing database:

1. Capture representative `sa_v2_session_read(conversation_id)` output before the migration.
2. Apply the P1.7.3 migration only.
3. Re-read the same conversation as the owning authenticated user.
4. Confirm all pre-existing session fields/cards/actions/messages/task/page data remain equivalent.
5. Confirm each recent-run object now includes bounded `error_code` when present.
6. Confirm another user cannot read the conversation.
7. Confirm a user in another company cannot read/infer its run errors.
8. Confirm rows before the existing `history_after` fence are not added back.
9. Confirm only `authenticated` can execute the public wrapper and the renamed base implementation is not directly executable by `authenticated`, `anon` or `PUBLIC`.
10. Verify query/runtime impact on a normal session read.

If the deployed `sa_v2_session_read(uuid)` differs from the supplied baseline, stop and reconcile the migration rather than applying a rename/wrapper blindly.

## Rollout behavior

With `SMART_ASSISTANT_TASK_CONTEXT_ENABLED=true`, test three workspaces/users:

- retrieval/resolver approved and ready: task context works exactly as P1.7.2;
- no `assistant_v2_retrieval_rollout` row: no 503; assistant uses the pre-task-context permitted path and does not gain retrieval/task-context capability;
- explicit rollout row `enabled=false`: same safe fallback; remains disabled.

Then induce a genuine setup incompatibility (testing environment only) and prove `migration_required` still fails closed and is rendered explicitly.

## Security invariants

Repeat the current tenant/RLS/permission battery. This pass must not alter company scoping, Hidden/View/Edit behavior, P3 confirmation or audit.
