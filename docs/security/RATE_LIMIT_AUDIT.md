# Rate-limit callsite audit

Date: 2026-10-29 | Commit: see debt-baseline.json | Author: Gavin
Purpose: inventory every `checkRateLimit(` callsite and record whether it
opts into fail-closed behavior. Zero-risk documentation only; no runtime
changes in this audit.

## Mechanism (app/lib/security/rateLimit.ts)

- `checkRateLimit(...)` delegates to a distributed Postgres RPC.
- Default behavior on RPC failure is **fail open** (allow, log warning) so a
  transient DB blip does not lock real users out.
- Callers can pass `{ failClosed: true }` to deny instead when the limiter
  itself cannot run.
- `getClientIP(headers)` reads the first `x-forwarded-for` value. On Vercel
  the platform overwrites client-supplied XFF at the edge, so first value =
  real client IP in our deployment; treat any CDN change as a re-verify
  trigger (see Follow-ups).

## Callsites WITH failClosed: true (10 files)

| File | Sites | Flow |
| --- | --- | --- |
| app/login/actions.ts | 4 | login/auth attempts |
| app/login/recover/actions.ts | 4 | password recovery |
| app/lib/assistant/rateLimit.ts | 1 | Smart Assistant turn admission |
| app/lib/free-tools/aiScanGate.ts | 1 | free-tools AI scan gate |
| app/lib/demo/provision.ts | 2 | demo provisioning |
| app/lib/demo/self-send.server.ts | 2 | demo self-send |
| app/api/app/check-save-eligibility/route.ts | 1 | save eligibility check |
| app/api/demo/quote-response/route.ts | 1 | demo quote response |
| app/api/free-tools/marketing-preference/route.ts | 1 | marketing preference write |
| app/lib/security/rateLimit.ts | 1 | self (interface/docs) |

Auth, credential recovery, AI-spend and demo-provisioning flows are the
sensitive set and all carry failClosed.

## Callsites relying on fail-open default (23 files)

Public token pages: app/accept/[token]/actions.ts + page.tsx,
app/file/[token]/page.tsx, app/invoice/[token]/page.tsx,
app/m/[token]/actions.ts + page.tsx, app/orders/[token]/actions.ts + page.tsx
- anonymous view-by-token pages; limiter failure must not break valid links.

Public APIs: app/api/attachments/[token]/download, app/api/invoices/public/[token]/dispute,
app/api/invoices/public/[token]/payment-sent, app/api/public/roof-takeoff/calculate,
app/api/free-tools/{account-status,drafts,finder-event,finder-recommend,log-usage,supplier-output-log}.

Admin/internal: app/api/admin/signups, app/api/admin/unsubscribe-link,
app/admin/(dashboard)/users/[userId]/actions, app/(auth)/[workspaceSlug]/settings/email-change-actions.ts,
app/mcp/route.ts.

Rationale (current design): these are either anonymous public surfaces where
availability of valid links outweighs limiter strictness, or admin-authenticated
routes already gated by auth. Fail-open here means "DB blip bypasses the
secondary rate limit", not "auth bypassed".

## Review candidates flagged (no change made)

1. app/api/attachments/[token]/download - fail-open on a download endpoint;
   limiter is secondary protection on top of signed tokens. Acceptable today,
   worth a second opinion when quote-documents storage rules are next touched.
2. app/mcp/route.ts - MCP endpoint fail-open; confirm the toolLayer HMAC token
   gates spend before this is reachable by anonymous traffic.
3. Free-tools log-usage endpoints fail open by design (metering, not gating);
   aiScanGate (actual AI spend) is failClosed - correct split.

## Follow-ups

- Verify XFF trust assumption if the CDN/edge config ever changes.
- Re-run this audit (grep checkRateLimit) when new endpoints add limiters;
  keep the sensitive-set rule: auth + AI-spend + provisioning = failClosed.
