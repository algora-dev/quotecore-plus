# Integration prompt — Workflow Controller V1 / Smart Assistant V1 Beta

Integrate the code in this package into the **testing/staging app first**, preserving current live-branch changes rather than overwriting them blindly. This is an implementation candidate, not a verified production release. No credentials, generated VAPID keys, applied migrations or successful live tests are included.

## Provenance and first reads

Baseline: `quotecore-plus-lean-20261002-29a0e0a7.zip` (uploaded with `(1)` in its filename).
Baseline SHA-256: `ee7b93610292dc116809b58657da017aa9214ac550cb2732f7b89127cecadca7`.

Read `AGENTS.md`, `RETURN_NOTES.md`, the source diff/`WORKFLOW_V1_CHANGED_FILES.json`, then the following folder:

`docs/sa-workflow-controller-v1-2026-10-02/`

Its key files are `MIGRATIONS.md`, `TEST_RESULTS.md`, `LIVE_ACCEPTANCE.md`, `KNOWN_LIMITATIONS.md`, `ENGINEERING_NOTES.md` and `PUSH_PROTOCOL.md`. Older handoffs and test evidence are historical. Do not treat their live-test claims as evidence for this return.

## Integration sequence

1. Create an integration branch from the actual current application. Check baseline drift against the supplied change manifest. Preserve unrelated live changes. Keep both new workflow and push behavior disabled while integrating; the workflow uses an existing flag, so explicitly turn it off if that environment already has it on.
2. Install the **unchanged lockfile** with `npm ci`; do not solve unavailable packages by silently upgrading Next, React, Supabase, pricing or billing dependencies. Follow the installed Next instructions in `AGENTS.md`. This restricted build environment could not download dependencies.
3. Inventory the applied SQL history in all repository migration roots. Follow `MIGRATIONS.md`; do not blindly glob one directory. Review every new `SECURITY DEFINER`, grant/revoke, actor check, lock order, partial unique index and trigger. Apply the four new migrations to an isolated/staging database with the correct existing schema; none was applied here.
4. Regenerate the project's Supabase types using its normal process. The current main `database.types.ts` is UTF-16LE in the baseline and was not re-encoded; additive RPC types are local to this change. Resolve real compile issues without weakening runtime validation. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `node scripts/run-smart-assistant-workflow-v1-offline.mjs`.
5. Restore missing historical fixture/manifest files from the canonical repository before running the full existing assistant regression/security suites. Do not invent fixture results or rewrite tests merely to make them green. The new return includes the exact attempted commands, failures and logs.
6. Verify actual SQL behavior with two workspaces/users: direct RPC privilege rejection, ownership, permission downgrade, stale revision/epoch/task, duplicate/concurrent confirm, edit-versus-builder race, create/checkpoint/finish failure windows, and repeated incremental edits preserving stable child IDs. **Do not enable P4 based solely on offline counts.**
7. In a testing workspace, deliberately enable the existing V2/P4/retrieval/resolver/task-context capabilities and grant the required Edit permissions. Configure Corrugate concepts/products/defaults in Account → Smart Assistant. Enable `SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED=true` only after the database/build checks pass. Preserve all existing run admission/quota/replay/finish behavior.
8. Run the exact James Smith continuous conversation and inspect the real database before and after confirmation/correction. Test both mobile text and sequential voice. Verify all three 5m hips, site address, plan basis, per-area pitch, selected products, engine quantities/costs, audit records and **exactly one intended draft**. Capture owner effort, user-visible pauses and request timings instead of substituting test counts for usability.
9. For push, configure server-only environment values from `.env.workflow-v1.example`. Generate a fresh VAPID pair locally with `node scripts/generate-pwa-vapid-keys.cjs`; store the private key securely, never in a ZIP/client bundle. Reuse the deployment's existing protected `CRON_SECRET`; do not rotate unrelated cron credentials inadvertently. Enable `PWA_PUSH_ENABLED` only after subscription/outbox/RLS checks. Verify actual Apple/FCM/Firefox delivery and tap behavior on supported devices, including denied/revoked permission and logout/account changes.
10. Run the installed-PWA session matrix: iPhone, Android and normal browser; close/reopen, restart, foreground/background, token refresh, offline/reconnect, legitimate expiry and MFA. Preserve auth security; do not increase cookie/session lifetimes as a substitute for fixing a verified defect.

## Locked boundaries

QuoteCore owns state, calculations and mutations. AI supplies intent and validated deltas. No arbitrary model SQL. No conversational yes/Done/Move on as mutation authority. Keep explicit proof-bound Confirm and auditing. Do not reintroduce `sa_v2_draft_edit_clear`, replace child rows wholesale, create duplicate drafts on failure, or rewrite Universal Retrieval/task architecture without new evidence.

## Return after integration

Return the full latest merged source, applied migration list, actual install/type/lint/build and security/workflow evidence, database IDs/results for disposable fixtures, PWA/push device matrix, latency/owner feedback and explicit remaining failures. Do not label this V1 Beta release-ready until those live gates pass. Cleanup must be scoped to created test fixtures, not customer data.
