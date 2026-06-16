# Gerald Re-Audit Brief — Margin Remediation Round 3
**Date:** 2026-06-16
**Bundle HEAD:** `808a7a4` (branch: `development`)
**Scope:** Remediation of H-06 from `06-reaudit-remediation-996e164.md`
**Requested by:** Shaun
**Prepared by:** Gavin

---

## Context

Gerald's round-2 re-audit cleared H-04 and M-03, but raised H-06: expired quote copy paths could export a dead acceptance token. Fixed in this commit.

---

## Fix Shipped

### H-06 — Expired quote copy/email exporting dead acceptance token ✅ Fixed

**Root cause:** For expired quotes, `ensureToken(true)` always mints a fresh token B (the existing-token reuse branch requires `!isExpired`). If the user opened URL or email mode first (which called `ensureToken(false)` and wrote token A to the DB and composed the email body / set `acceptanceUrl` state with `/accept/A`), then clicked Copy — the clipboard received `/accept/A` while the DB had already moved to token B. Token A is no longer the quote's `acceptance_token`, so the customer's link was dead.

The same React async-state issue applied to non-expired quotes too: `setToken()` is async, so `acceptanceUrl` state can lag one render behind after `ensureToken(true)` rotates the token.

**Fix — `SendQuoteButton.tsx`:**

**`handleCopyUrl`:**
- Now uses the token returned by `await ensureToken(true)` to build `committedUrl = ${origin}/accept/${committedToken}` and copies that directly
- No longer reads the potentially-stale `acceptanceUrl` state for the clipboard write or the fallback execCommand path

**`handleCopyEmail`:**
- Uses the returned `committedToken` to build `committedUrl`
- Substitutes the committed URL into `emailBody` via regex (`/https?:\/\/[^\s]*\/accept\/[^\s\n]*/g → committedUrl`) before the clipboard write
- Ensures the link that physically leaves the app always matches the live token in the DB, regardless of when the email was composed or whether the quote was expired

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx`

---

## Verification Suggestions

- Resend/copy flow on an **expired** quote:
  1. Open URL mode (token A minted, `job_status` stays `expired`)
  2. Click Copy URL — confirm clipboard contains `/accept/<token-B>` (the freshly committed token), not token A
  3. Confirm `quotes.acceptance_token` in DB = token B and `job_status = 'sent'`
- Same for email mode on an expired quote:
  1. Open Email mode (token A in email body)
  2. Click Copy Email — confirm clipboard email body contains `/accept/<token-B>`
- Non-expired quote copy path unaffected: `ensureToken(true)` reuses the existing token so A = B and no substitution needed

---

## Still Deferred

- **M-02** — `quote_component_id` not bound to same quote/company. Post-launch.
- **L-02** — Assistant workflow allowlist/rate-limit. Shaun's call.
