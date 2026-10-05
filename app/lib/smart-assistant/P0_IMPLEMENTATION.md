# Smart Assistant V2 - P0 foundations

Delivery date: 2026-09-24. Scope: P0 only. Baseline: the supplied archive identifies `main@20b3f54c`; no repository service was contacted to verify a newer commit. Root `SMART_ASSISTANT_BRIEF.md` and `docs/SMART_ASSISTANT_V2_PLAN.md` remain unmodified. Owner amendments in the conversation add independent Draft quotes and approve Hidden / View / Edit with six View defaults and three Hidden defaults.

## Behaviour boundary

P0 prepares permissions and the audit schema. It does not register/filter tools, change prompts, run quotas, enable voice tiers, change chat/navigation, create/stage/revert actions, or modify PWA/auth behaviour. The new UI explicitly distinguishes prepared V2 settings from currently effective V1 access. Setting Hidden is not represented as a live security restriction; setting Edit grants no new capability in this release.

Workspace owner/admin writes to the new configuration are server-enforced now. Actual assistant tool admission must consume and enforce the saved map in the later approved phases. Do not conflate these two different enforcement points.

## Files and data flow

```text
account/smart-assistant/page.tsx (existing flag gate retained)
  -> readSectionPermissions(authenticated client)
     -> sa_v2_permissions_read() [auth.uid -> company + current role + flag]
  -> AssistantPermissionsPanel [nine native radio groups]
     -> saveAssistantSectionPermissions(unknown payload)
        -> strict TS map/revision validation
        -> sa_v2_permissions_save(map, expected revision, expected workspace)
           -> current owner/admin + rollout gate
           -> complete SQL validation
           -> lock NEW permission row, compare revision, update atomically
           -> return actual stored map/revision
        -> update client only on acknowledgement; page-only revalidation

admin/smart-assistant/page.tsx (existing site-admin/access controls retained)
  -> AssistantV2AdminSection [existing requireAdmin + service-role READ only]
     -> exact permission rows for companies already loaded by the old panel
     -> read-only summary, defaults only after a successful absent-row result
```

No new API routes. Neither server action accepts a caller-selected write tenant or user/role authority. The save includes the workspace ID from its loaded snapshot solely as an expectation guard: SQL compares it to the current authenticated company and refuses stale pages after a workspace/account switch. They reuse the existing request-scoped client and context helpers without modifying those helpers. SQL repeats the authorization based on the authenticated caller. Delegated `members_can_manage` applies only to existing V1 settings/knowledge; it cannot elevate access-map permissions.

## Storage choice

`assistant_section_permissions` is a company-config child table, separate from `assistant_configs`. This avoids changing the existing service-role identity upsert or giving its delegated-manager path a way to overwrite access levels. The new table is one map per company, saved atomically rather than nine independent row writes. There is no permission row until the first explicit Save. Defaults are returned only by a successful read with no row, never because an RPC/table is missing or unavailable.

Nine exact keys: `quotes`, `draft_quotes`, `orders`, `invoices`, `components`, `customers`, `emails`, `billing`, `settings`. Stored levels: `hidden`, `read_only`, `edit`. UI labels: Hidden, View, Edit. First six default to `read_only`; last three default to `hidden`. Future draft searches must honour the independent draft key even when drafts share a quotes table or appear in a combined list. Domain-specific draft classification is a P1 mapping exercise, not a schema guess in P0.

A monotonic revision provides optimistic concurrency. Two browser tabs starting from the same revision cannot silently overwrite one another. A snapshot also carries its server-derived company ID; it is checked, never trusted as a tenant selector, so a stale tab cannot apply its choices to a newly signed-in workspace. The first INSERT and row lock only touch this new table; they do not reuse or change the locked quota reservation/flag-row path. Conflict or network-unknown outcomes retain the current draft and require explicit reload before retry. The client uses an immediate ref lock plus explicit pending state, not an async transition whose pending semantics might differ in the supplied React version.

## Ledger draft

`sa_action_log` includes the plan's company/user/run/action/entity identifiers, nullable before/after payloads, status, method, voice phrase and timestamps. `verification_mode` records Mode A (`chat_summary`) versus Mode B (`navigate_and_show`); nullable `confirmed_by` distinguishes the sign-off actor from the requester.

Status values are exactly `proposed | confirmed | committed | reverted | expired`. Confirmation methods are exactly `button | voice` as in the written plan. Signed statuses require complete confirmation metadata and an offered verification mode. Voice proof must be nonempty and is only the explicit confirmation phrase, not the entire conversation. No action writer, confirmation endpoint or ledger viewer is added in P0.

Authenticated clients have company-owner/admin SELECT only. They cannot manufacture or alter proof with direct INSERT/UPDATE/DELETE. The trusted service role may insert/finalise records in P3; this is not a cryptographically tamper-proof event journal. There is no automatic purge or application deletion grant.

Audit identity fields intentionally do not cascade with deleted conversations/runs or block existing account deletion. P3 must validate all referenced identities/tenant associations before writing. Retention/redaction after an account is deleted, and text-versus-voice confirmation policy, need the explicit decisions in `RETURN_NOTES.md`. This phase neither changes existing account deletion nor starts collecting action data.

## SQL review points

The single draft migration creates only new objects. It does not replace the eight locked V1 functions/policies or change auth/tenant helpers. Function search paths are restricted to `pg_catalog, pg_temp`; application relations/helpers are schema-qualified. New PUBLIC/anonymous grants are explicitly revoked. Read/write configuration RPCs derive company from `auth.uid()` and are callable only by authenticated users. Service-role reads in the admin page happen only after the existing site-admin gate.

The migration is transactional and intentionally single-application. Conflicting pre-existing V2 objects require integration review instead of silent `CREATE OR REPLACE` reconciliation. No existing row is backfilled or company flag enabled. The schema extension is local under the assistant tree because the canonical generated types are outside this delivery's change boundary.

## Design and next phase

The supplied design standard is used only on the new permission/admin panels. See `app/components/smart-assistant/ui/UI_INTEGRATION.md` for exact component mapping, token provenance, and the owner's future two-control header, voice/text preference and in-conversation button contract. The live shell is unchanged because P0 acceptance explicitly says no assistant behaviour change yet.

Next phase after P0 approval: **P1 Navigation**. Resolve authorized entities, return internal navigation actions, and make one tap open the correct app page and hide the assistant without losing task state. Include the agreed minimal shell in that phase's plan/approval. Attention remains P2; writes/confirmation enforcement and action logging P3; creation/edit flows P4; voice P5a/P5b; streaming/admin usage P6; PWA notifications/platform work P7. Do not begin any of those as part of P0 integration.

## Static validation versus runtime proof

See `validation/P0_STATIC_REVIEW.md` for checks actually performed and `validation/P0_ACCEPTANCE.md` for required on-owner-side tests. The pure TS test source is supplied but not executed. No app, database migration, role simulation, OpenAI request, device test, build, lint or browser harness was run in this static-only delivery.

Supporting implementation references (consulted, not a substitute for the pinned repo):

- Next.js revalidatePath: https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- PostgreSQL function security: https://www.postgresql.org/docs/current/sql-createfunction.html
- PostgreSQL row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

The existing repo's Next/Supabase/React versions and patterns remain authoritative; these references are not permission to upgrade dependencies or alter locked helpers.
