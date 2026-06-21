# Gerald Re-Audit Brief — Margin Remediation Round 4
**Date:** 2026-06-16
**Bundle HEAD:** `d8bc1ba` (branch: `development`)
**Scope:** Remediation of H-07 and M-04 from `07-reaudit-remediation-808a7a4.md`
**Requested by:** Shaun
**Prepared by:** Gavin

---

## Fixes Shipped

### H-07 — All send/export exits now use committed token body ✅ Fixed

**Root cause:** `runSend()` read `emailBody` state directly. For expired quotes, `ensureToken(true)` rotates to a fresh token B, but `emailBody` was composed during `handleEmailMode` with token A. The outbound email body still contained `/accept/A`.

**What changed — `SendQuoteButton.tsx`:**

Extracted a single `commitAndRewriteBody()` helper:
- Calls `ensureToken(true)` and captures the returned committed token
- Rewrites any `/accept/<token>` URL in `emailBody` to use the committed token URL
- Returns the final safe body, or `null` on token error

Applied to every path where the body leaves the app:
- **`handleCopyEmail`** — refactored to use `commitAndRewriteBody()`
- **`handleSendNow`** — replaced `ensureToken(true)` + `runSend()` with `commitAndRewriteBody()` → `runSend(committedBody)`
- **`handleConfirmFollowUpsAndSend`** — same
- **`handleCopyUrl`** — already fixed in round 3 (uses returned token directly, no body involved)

`runSend()` now requires an explicit `committedBody: string` parameter instead of reading `emailBody` state, making it structurally impossible to call without a token-safe body.

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx`

---

### M-04 — Unescaped entity lint errors ✅ Fixed

Two `react/no-unescaped-entities` errors introduced in round 3:
- `customer's` → `customer&apos;s`
- `don't` → `don&apos;t`

Targeted ESLint on `SendQuoteButton.tsx` now reports **0 errors**.

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx`

---

## Still Deferred
- **M-02** — `quote_component_id` server-side validation. Post-launch.
- **L-02** — Assistant workflow allowlist/rate-limit. Shaun's call.

---

## Verification Suggestions

1. **Expired quote — Send from QuoteCore+:**
   - Open email/send mode on an expired quote (token A minted, `job_status` stays `expired`)
   - Send via "Send now" — confirm outbound email body contains `/accept/<token-B>` (committed token), not token A
   - Confirm `quotes.acceptance_token` = token B and `job_status = 'sent'`

2. **Expired quote — Send with follow-ups:**
   - Same flow through `handleConfirmFollowUpsAndSend` — confirm committed token in outbound body

3. **Non-expired quote — unaffected:**
   - `ensureToken(true)` reuses existing token (A = B), regex substitution is a no-op

4. **Lint gate:**
   - `eslint SendQuoteButton.tsx` → 0 errors
   - `tsc --noEmit` → clean
