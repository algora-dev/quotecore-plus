# Workflow Controller V1 — implementation plan

Authoritative baseline: user-supplied `quotecore-plus-lean-20261002-29a0e0a7(1).zip`.

1. Extend the existing library workflow, not Universal Retrieval. Workspace concepts have stable keys and one supported structural behavior; per-library mappings/defaults remain explicit and tenant-scoped.
2. Retain a server-owned brief with server-allocated area/component/measurement identities. Initial intent starts a brief; subsequent turns submit validated deltas against an exact revision. Product decisions are grouped. UI controls derive from explicit workflow state.
3. Preserve P4 parent creation, quota, button confirmation and audit. Protect proposals with brief revision + configuration epoch. Bind the produced quote, committed plan and quote snapshot in the finalizer transaction. Edits use a single trusted atomic incremental writer with exact-snapshot revalidation; never clear/rebuild all children.
4. Fix the verified cookie-response replacement defect, preserving refreshed chunks on normal, demo and redirect responses. Preserve existing authentication, MFA and cookie lifetime. Resolve the legacy `/assistant` launch against authenticated company context.
5. Add opt-in alert-backed Web Push with strict endpoint validation, tenant/user ownership, a durable outbox, leased/idempotent dispatch, bounded retries, generic lock-screen text and authenticated internal navigation.
6. Execute available offline domain/boundary/regression tests. Attempt dependency/type/lint/build gates, recording actual failures. Supply SQL/static security checks and an explicit live/device acceptance checklist. No live database, device or model claims without execution.

## Rollout

Feature defaults stay off. The library workflow requires the new additive migrations before enabling `SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED`. Push is separately gated. Existing provider/model, quota/admission/finish, retrieval and pricing engines are not redesigned.

## Source findings to address

- The baseline edits a quote's names, then calls `sa_v2_draft_edit_clear`, in separate transactions.
- `sa_v2_created_quote_once` prevents more than one result action per quote, including edits.
- Brief upsert resets revision to 1 and carries `produced_quote_id` into unrelated requests.
- Active-draft prompt asks the model to regenerate the full brief on correction.
- Selection skips validation of retained IDs, ignores collection name, and may resolve products before a library is chosen.
- Takeoff role suggestions currently become execution authority without deliberate assistant mapping.
- Cookie `set`/`remove` rebuilds the response, losing earlier chunks; demo/MFA redirects also discard refreshed cookies.
- `/assistant` has no authenticated launch resolver; assistant manifest is not in metadata exceptions.
