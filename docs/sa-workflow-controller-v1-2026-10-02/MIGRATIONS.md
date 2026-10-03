# Migration and rollout contract

**Applied here: none. These four new SQL files require PostgreSQL execution and security review on staging.**

## Existing prerequisites — inventory first

The package contains `backend/supabase/migrations/`, `supabase/migrations/`, and other historical migration material. The runner used by the live project must be identified; never assume directory order is the deployment order.

The existing full application schema and assistant evolution are prerequisites, including:

- `backend/supabase/migrations/20260924110000_sa_v2_p0_foundations.sql`
- P1/P2/P3/P4 migrations through `20260924133000_sa_v2_p4_drafts.sql`
- Existing speed/retrieval/resolver migrations and `20260928153000_sa_v2_task_context.sql`
- `20260928190000_sa_v2_p173_release_hardening.sql`
- `20260929193000_sa_v2_roof_area_edit.sql`
- `20260930120000_sa_v2_library_workflow.sql`

This is a dependency inventory, **not a standalone database bootstrap list**. Core quotes, components, users, companies, alerts, notification preferences, MFA and billing schema must already be present. Check the installed function bodies/signatures, not just filenames in a ledger. The old September 30 return reported its migration as unapplied; this environment cannot determine current live state.

The baseline also includes `supabase/migrations/20261002150000_draft_brief_edit_in_place.sql`. It adds `produced_quote_id` and a destructive helper. Its column is defensively added by the new controller migration if absent. If the project's ledger requires the old migration, apply it **before** the four new files and with workflow behavior disabled. Never apply/reapply it afterward. It is not permission to run the old edit implementation.

## New files — exact order

All four are under `backend/supabase/migrations/`:

1. `20261002180000_sa_workflow_v1_vocabulary.sql`: concepts/aliases/epochs; safe mapping constraint; one default per concept; manager-only transactional configuration RPCs; scoped read policies.
2. `20261002181000_sa_workflow_v1_controller.sql`: versioned brief lifecycle, snapshot/epoch/task checks; private wrapping of installed creation claim/finish/uncertain functions; incremental atomic edit; quote-binding transaction; revised unique index; disabled destructive helper.
3. `20261002181500_sa_workflow_v1_task_lifecycle.sql`: wrap task close and action cancel, preserving the old permission/proof/run checks; expire only preparation, never approve a mutation.
4. `20261002182000_pwa_alert_push_foundation.sql`: owned subscriptions/deliveries; opt-in RPCs; alert-triggered outbox; leases/retries/eligibility/cleanup; authenticated and service-role grants separated.

Each new file is transactional (`BEGIN`/`COMMIT`). They are migrations, not indefinitely repeatable scripts: renamed functions and newly added columns/tables must not be replayed as though idempotent. Run with stop-on-error and retain migration logs. Refresh the PostgREST schema cache through the normal Supabase deployment process after application.

## Review / staging assertions

Use `SQL_PREFLIGHT.sql` as a read-only inventory helper. Check the actual function definitions with `pg_get_functiondef` and privileges with `has_function_privilege`. The `*_pre_controller_v1` and internal writer/snapshot helpers must be inaccessible to PUBLIC/anon/authenticated/service_role direct callers. Public trusted mutation transports must require service role and derive the actor's current company/permissions; client subscription/task/cancel transports require authenticated ownership.

The new `sa_v2_created_quote_once` must be a **partial** unique index for creation actions (`payload->>'editQuoteId' IS NULL`), not an index that prevents the second edit to a quote. Confirm/finish must bind the durable brief and full snapshot in the same transaction as the completed children/audit. No direct model RPC or new parent insert was introduced.

Inspect existing settings before enabling: explicit old `assistant_role` mappings bootstrap `concept_key`; unmapped Takeoff suggestions do not become execution authority. Test old/duplicate/invalid default rows and inactive/moved components. Legacy briefs are deliberately marked `needs_review`; their IDs/baselines are not invented.

## Rollout and rollback

Set `SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED=false` and `PWA_PUSH_ENABLED=false` during schema/code integration. These flags do not automatically enable any company rollout, permission or P4 phase. Full Beta behavior additionally requires the existing task-context/resolver/retrieval gates and capability versions; test them together.

On failure, disable these two flags and keep the reviewed schema installed while investigating. The original generic P4 create path remains available under its existing gates when workflow is off; unsafe old workflow edit proposals are refused. Do not restore the old destructive helper or roll the app back to a binary that depends on it. If a full database rollback is required, coordinate it explicitly with the application and backups; there is no automatic destructive down migration.

Push flag-off stops dispatch/registration through the HTTP layer; it does not by itself revoke every existing subscription or remove the browser service worker. Existing minimal notifications can already be in transport. The service worker never caches auth/application data. For permanent withdrawal, disable subscriptions through reviewed administrative operations and retire the worker deliberately.
