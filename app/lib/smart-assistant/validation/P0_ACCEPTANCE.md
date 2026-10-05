# Smart Assistant V2 P0 acceptance gates

Status: test instructions and pure tests supplied; no application, database, provider or browser tests run by the external implementer. Run against an isolated preview with synthetic fixtures, not production. Approval of P0 does not approve P1.

## Environment and static gates

1. Start from the source handoff's `main@20b3f54c`. Reconcile only the files listed in root `RETURN_NOTES.md` against subsequent changes. Do not replace the parallel UX branch wholesale.
2. Read `backend/supabase/migrations/20260924110000_sa_v2_p0_foundations.sql`. It is a DRAFT and intentionally fails if its objects already exist. Review/apply the entire transaction once. A missing migration must leave the old identity/knowledge settings and chat working while the new panel shows an explicit storage-not-ready message.
3. Regenerate canonical Supabase types on your side after application, or initially use the supplied narrow `AssistantV2Database` extension. Check signatures against the database rather than editing auth/client helpers. No application dependency changes are needed.
4. Run the full pinned `npm run build`, `npm run lint`, existing V1 assistant harness and relevant browser regression suites. The project includes React 18.3.1 and Next 16.2.12; do not upgrade them to make this patch pass.
5. Run `node --import tsx --test app/lib/smart-assistant/section-permissions.test.ts`. These tests exercise pure validation only, not security enforcement or persistence.
6. Confirm the existing quota/turn, pricing, auth, feature-flag write and chat privacy paths are byte-identical to the supplied baseline, except later changes already reviewed on your branch. No new API route is part of P0, so no new route harness is required.

## Required disposable fixtures

Use two companies A/B. For A: owner A1, admin A2, ordinary member A3, and member A4 with the existing `members_can_manage` option enabled. For B: owner B1. Use an anonymous client and a separate site-admin login for admin visibility. All fixtures must use the actual membership/role setup on your side. Do not grant `service_role` to any browser client.

Turn the existing assistant rollout flag on for A/B using the unchanged approved admin path. Use a separate flag-off fixture. No new flag, quota allowance, plan entitlement, Stripe or auth setup is introduced by this phase.

## Database gates (authenticated roles, not just service-role tests)

| ID | Check | Expected |
|---|---|---|
| DB01 | Read permissions for an enabled company with no row | Exactly the nine agreed defaults, source `default`, revision 0, null update time. Read must not create a row. |
| DB02 | Owner saves a complete map at expected revision 0 | One row, revision 1, caller company/actor derived in SQL; return the actual saved values. |
| DB03 | Read again with a fresh request/session | Same map and revision, source `saved`. |
| DB04 | Workspace admin changes a level | Allowed; revision increments exactly once. |
| DB05 | Ordinary member or delegated manager calls save RPC directly | `42501`, no write, regardless of UI or `members_can_manage`. |
| DB06 | Member reads the enabled workspace map | Allowed, `can_manage=false`, no edit grant. |
| DB07 | Owner A reads the table filtered for B | No B rows under RLS. The read RPC has no arguments. The save's expected-company ID is only compared against the authenticated company; passing B while authenticated as A must return `42501`, never select B. |
| DB08 | Authenticated direct INSERT, UPDATE or DELETE on permission table | Denied by table privileges and absence of mutation policies. |
| DB09 | Anonymous RPC/table access | Denied. |
| DB10 | Enabled owner, malformed/missing/unknown level or extra section key | `22023`, no saved mutation. String/numeric/null/array payloads rejected. |
| DB11 | Two concurrent saves with the same expected revision, including first-save race | Exactly one succeeds; other gets `40001`. Losing transaction does not overwrite anything. |
| DB12 | Save with old revision after another owner changed permissions | `40001`. No silent last-writer-wins overwrite. |
| DB13 | Existing flag switched off before a read/save request | Denied. Flag itself, quota reservations and assistant config remain unchanged. |
| DB14 | Authenticated client attempts to INSERT/UPDATE/DELETE a ledger row or forge a confirmed row | Denied. No client ledger writer exists in P0. |
| DB15 | Seed synthetic ledger records with service role for A/B; read as A owner/admin/member | A owner/admin only see A. Members see none. No cross-tenant ledger rows. |
| DB16 | Service-role attempt to create `confirmed`/`committed` without complete proof | CHECK failure. No confirmation method/actor/time/verification mode means no signed status. |
| DB17 | Voice proof empty/null, or button proof with a voice phrase | CHECK failure. A valid verbatim voice confirmation plus actor/time/mode is accepted. |
| DB18 | Revoke config management from a member | Existing V1 behaviour unchanged; they could never save V2 permissions even before revocation. |
| DB19 | Inspect new grants | Only read RPC/save RPC executable by authenticated. Service-role helper grants are narrow. No DELETE/TRUNCATE ledger grant added. |
| DB20 | Delete a synthetic private conversation after seeding an audit record | Ledger is not cascaded away. Do not infer automatic account-deletion/redaction policy from this; see open P3 decision. |
| DB21 | Keep an A settings tab, change authenticated account/workspace to B, then submit A's draft | `42501`, no A or B mutation. Expected-company guard is not a tenant selector. |

Use throwaway entities and approved cleanup procedures. No synthetic data is written by simply opening P0; all ledger rows stay empty unless a tester deliberately seeds them. The external implementer has not run these checks.

## Owner/settings browser gates

| ID | Journey | Expected |
|---|---|---|
| UI01 | Open account Smart Assistant settings with rollout flag on | New access panel plus the unchanged identity, knowledge and Add to phone features. |
| UI02 | Select Hidden / View / Edit at 390px and 320px, keyboard-only, and desktop | Label + selected radio; every target at least 44px; no page overflow; visible focus and native radio navigation. |
| UI03 | Save defaults, then change Draft quotes only and save again | Values persist after full reload; Quotes remains independent. |
| UI04 | Rapid double-tap Save under slow network | One in-flight action. Button reads Saving permissions; no success until acknowledged. |
| UI05 | Network failure/unknown response after submit | No false Saved. Current draft remains visible, retry requires explicit reload of persisted state. |
| UI06 | Two owner tabs save different maps | Losing tab shows conflict and retains its draft; explicit Discard draft and reload obtains latest map. |
| UI07 | Member/delegated manager | New radios are read-only and explained. Existing V1 persona/knowledge capabilities are not changed. |
| UI08 | Missing migration / invalid stored map / DB read failure | Explicit non-success state, no enabled default grants, original config UI still available. |
| UI09 | Save permissions while identity form has unsaved edits | Separate submit action; identity fields, enabled state and members_can_manage are not posted or changed. |
| UI10 | Save old V1 identity/knowledge settings | V2 permission map is preserved. Its revision does not change. |
| UI11 | Save a level as Hidden, then exercise current V1 chat | Behaviour still matches the baseline. Notice must explicitly explain P0 is not runtime enforcement. No new tool is registered. |
| UI12 | Save a level as Edit, then exercise current V1 chat | No action, creation, send, pricing calculation or entitlement is unlocked. |
| UI13 | Switch workspace while the settings route is mounted | Permission component gets a fresh company-scoped instance; no previous tenant draft leaks. |
| UI14 | Reduced motion / forced colours | Usable radio selection, borders, focus and disabled state remain apparent without colour-only communication. |

## Site-admin browser gates

| ID | Journey | Expected |
|---|---|---|
| AD01 | Open admin Smart Assistant page | Original grant/revoke/search controls unchanged; separate read-only V2 section. |
| AD02 | Select a company with/without an override | Exact map or explicitly labelled defaults. No admin edit control for company permissions. |
| AD03 | Storage not ready or failed | Warning only in the new section. Never claim all companies are using defaults after a failed query. |
| AD04 | Normal non-site-admin tries the admin surface | Existing requireAdmin gate refuses. |
| AD05 | Inspect admin data/network/rendered markup | No conversation, action payload or confirmation phrase is fetched or exposed. |

## Rollout/rollback

Apply schema and code to preview, execute gates, then ask the owner for P0 approval. Do not enable V2 runtime tools. Returning the two modified pages to baseline removes all P0 UI entry points; the additive tables/functions can remain unused. Do not drop data to roll back presentation.

P1 starts only after approval: scoped entity search and navigation/minimise. Incorporate the agreed minimal shell and action-button design in that review. Actual write enforcement, confirmation execution and proof writing belong to P3, not P0.
