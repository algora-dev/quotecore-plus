# Gerald Audit Brief — QuoteCore+ (2026-06-12)

**Requested by:** Shaun (via Gavin)
**Bundle HEAD:** `67edb0e` on `development` (246 commits ahead of `main`, baseline `8fac898`).
**Last proper Gerald audit:** 2026-06-01 (attachments/catalog/follow-up bundle, baseline ~`9dbec15`, all findings CLOSED).
**Scope:** Everything merged into `development` SINCE 2026-06-01 that has NOT been code-/security-audited. This is the pre-merge gate for the big `development → main` promotion.

Reports land in `workspace-gerald/audits/...`. Shaun coordinates kicking off the run.

---

## Audit priorities (highest risk first)

### 1. AI Assistant ("Q") re-architecture — NEVER security-audited
Highest priority. The assistant was re-architected and has had **no** Gerald review.
- **Read-only invariant:** Q must only READ/explain, never mutate. Verify no tool path can write. Files: `app/lib/assistant/orchestrator.ts`, `toolRegistry.ts`, `app/api/assistant/chat/route.ts`, `app/api/assistant/workflow/route.ts`.
- **Endpoint auth:** `/api/assistant/chat` + `/api/assistant/workflow` — confirm company-scoped auth, no IDOR, rate-limited (`app/lib/assistant/rateLimit.ts`, `costGuard.ts`).
- **`recentActions` trust model:** server treats client-reported recent actions as OBSERVATION only — confirm it can't be used to escalate/forge state. See `useBrowserFacts.ts` / `contextResolver.ts`.
- **Highlight executor:** `request_ui_highlight` validates elementId server-side against a registry + visible set; client executor (`useAssistantHighlight.ts`) trusts that validation. Confirm no selector injection.
- **Token/cost guard:** per-plan `monthly_ai_tokens` enforced server-side; confirm a client can't bypass.
- **NEW this session — guide-launch bridge:** `app/components/assistant/startGuide.ts` dispatches a `qcp:start-guide` window CustomEvent that `AssistantWidget` acts on (opens panel + `startWorkflow`). Confirm this client-only event can't be abused beyond starting a known workflow (no privilege/data exposure; workflowId is just an id).

### 2. Pricing Tier v2 — gates, quotas, entitlements (commits `52312e1`, `8fac898`..; mig `20260611160000`)
- `company_has_feature` / `company_effective_plan_code` / `company_effective_plan_active` SQL functions: verify gating is server-enforced (RLS / RPC), not just UI. Mutations must refuse when feature not in effective plan.
- Per-month caps (quotes/invoices/orders) + lifetime caps (components/flashings/catalogs/attachments): confirm atomic enforcement (race on the Nth create), error codes P0015/P0016 etc.
- **NEW this session — trial→Free (mig `20260612190000`):** expired-trial-no-stripe now resolves to `free` + **active** (was `starter` + read-only). REVIEW CAREFULLY: this flips previously-locked accounts to active-on-Free. Confirm paid features stay locked (resolve from the `free` plan row) and there's no path where an expired trial gains a paid feature. Also `expire-trials` cron now writes `plan_code='free', subscription_status='active'`.

### 3. Invoices system (commits `4c00a21`, `274d49f`; migs `20260607120000`–`170000`)
- Public invoice endpoints: `/api/invoices/public/[token]/payment-sent`, `/dispute`, `/invoice/[token]`. Token unguessable, scoped, **state-mutating routes must be POST** (GET-on-mutate is a known bug class here — email scanners GET URLs). Verify.
- RLS on `invoices` + `invoice_lines`; confirm cross-company isolation.
- Payment-reported → confirm-paid flow can't be forged by the customer to mark themselves paid without owner confirm.

### 4. Follow-up system + pg_cron dispatch (commits `2802e6e`, `abdd25b`, `274d49f`, `4cd4d85`; migs `20260611150000`, `20260610150000`, `20260610170000`)
- **pg_cron + pg_net dispatcher** (`/api/cron/dispatch-scheduled-messages`): runs every 1 min via Supabase pg_cron calling the DEV URL with `CRON_SECRET`. Verify secret check, no unauth dispatch, idempotency, no double-send. NOTE pre-go-live: migration currently targets DEV URL/secret — see `docs/smoke-tests/CHECKLIST.md` pre-go-live gate.
- Scheduled-message engine `app/lib/messages/scheduled.ts` (keys on quote_id|order_id|invoice_id): cap 3/doc, one-per-trigger, one-trigger-cancels-others. Confirm no way to schedule for another company's entity.
- `require_no_response` honoured only for chase triggers; sentinel `fire_at='9999-01-01'` pattern.

### 5. Message Center / alerts (commits `93c25d3`, `abdd25b`; migs `20260608160000`, `20260608170000`, `20260610*`)
- `/api/alerts/*` (read/delete/bulk/clear-all/read-all): company-scoped, no IDOR.
- Bell decouple (`alerts.bell_cleared_at`): clearing the bell must NOT delete inbox rows.

### 6. PDF pipeline (commits `34b9e84`, `93c25d3`, `abe8b52`, `f4e3ce0`)
- Bulk ZIP + single owner downloads render real on-screen previews (html2canvas). Confirm no SSRF / arbitrary-file read, company-scoped, no other-company data in a ZIP.

### 7. This session's smaller surfaces
- **Tutorials** (`app/(auth)/[ws]/tutorials/*`): mostly static copy + client modals. Low risk. Confirm `tutorials.data.tsx` has no XSS via the copy (it's plain strings rendered as text — verify no `dangerouslySetInnerHTML`). WelcomeModal/intro gated by `users.tutorials_seen_at` + localStorage.
- **Send "test it first" tip** (`app/components/send/*`; mig `20260612200000`): purely a UI gate on `users.send_test_tip_seen_at`. Confirm `dismissSendTestTip` only updates the caller's own user row (it filters `.eq('id', profile.id).is(...null)`).
- **Account "Q Assistant" rename:** cosmetic.

## Migrations in-scope (all applied to the shared dev+prod DB already)
Since 2026-06-01, notably: `20260607120000`–`170000` (invoices), `20260608160000/170000` (alerts), `20260610150000/170000` (on-read trigger, related_invoice_id), `20260611150000` (pg_cron dispatch), `20260611160000` (pricing tier v2), `20260612180000` (tutorials_seen_at), `20260612190000` (trial→free functions), `20260612200000` (send_test_tip). One DB serves dev+main — additive/nullable changes are safe; flag anything destructive.

## What's already cleared (do NOT re-audit)
Attachments / catalog-library / generic-trades / the 2026-06-01 follow-up bundle were Gerald-cleared at code level (`workspace-gerald/audits/quotecore-plus-attachments-followup-fixes-recheck-2026-06-01/04-report.md`). Only review them if a later commit touched them.

## Known non-blockers / context
- DEV = PRODUCTION (both dev+main are live; dev is where we build/test, main is further behind). One Supabase DB serves both.
- Feature flags: generic trades ON on main; AI Assistant ON on dev only (OFF on main until merge).
- `stripe_launch_coupon_id` column is DEAD/unused (left to avoid destructive migration).
