# Gerald Security Audit Brief — 2026-06-14

**Bundle HEAD:** `c3ffe4c` (branch: `development`)
**Requested by:** Shaun
**Scope:** Two new features shipped 2026-06-14 on top of the previously-audited bundle (`3d8d311`).

---

## Feature 1 — Quote Expiry System

### What it does
When a user sends a quote (or generates a shareable URL), they choose a validity period (e.g. 30 days). The system stores this as `acceptance_token_expires_at` on the `quotes` row. A Vercel cron runs hourly and:
1. Finds quotes past their expiry that have not been accepted, declined, or withdrawn.
2. Sets `job_status = 'expired'`.
3. Creates an in-app alert (gated by company notification prefs).
4. Sends an email notification (gated by company email prefs).

Users can view the remaining validity on the quote summary and edit the expiry date (extend or shorten). Editing from an expired state also resets `job_status → sent`. Re-sending an expired quote mints a fresh token + URL, clearing the expired status.

### Files added / changed
| File | Change |
|------|--------|
| `app/api/cron/expire-quotes/route.ts` | **NEW** — hourly cron, finds expired quotes, updates status, inserts alert, sends email |
| `vercel.json` | Added cron schedule `0 * * * *` for the above |
| `app/lib/alerts/prefs.ts` | Added `quote_expired` to `NOTIFICATION_CHANNELS.quotes` and `EMAIL_ON_BY_DEFAULT` |
| `app/(auth)/[workspaceSlug]/inbox/InboxList.tsx` | Added `quote_expired` to the notification matrix UI |
| `app/(auth)/[workspaceSlug]/quotes/QuotesList.tsx` | Added `expired` badge + filter tab to JOB_STATUS_CONFIG |
| `app/(auth)/[workspaceSlug]/quotes/actions.ts` | Fixed `generateAcceptanceToken` to mint fresh token on expired re-send; added `updateQuoteExpiry` server action |
| `app/lib/email/notify.ts` | Added `notifyQuoteExpired` function |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/QuoteExpiryEditor.tsx` | **NEW** — client component: shows expiry badge, inline edit UI |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` | Wired `QuoteExpiryEditor` and `QuoteNotesPanel` into the server page |

### Security areas to review
- **Cron auth** — `expire-quotes/route.ts` uses `CRON_SECRET` bearer token gate, same pattern as other crons. Confirm no bypass.
- **`updateQuoteExpiry` action** — verify company-scoped ownership check: does the action correctly prevent one company from editing another company's quote expiry? Check `requireCompanyContext()` + `.eq('company_id', ...)` chain.
- **Alert insertion in cron** — cron uses admin client (bypasses RLS). Confirm alert rows are always scoped to the correct `company_id` (not user-controlled input).
- **`generateAcceptanceToken` change** — the re-send path now mints a new token when `job_status='expired'`. Does this create any race condition where an expired-but-still-valid token could be extended client-side? (Old token stays dead because the DB acceptance_token is overwritten.)
- **Expiry edit validation** — `updateQuoteExpiry` clamps days to 1–365. Verify the action can't be called on a finalised (accepted/declined) quote by a non-owner.

---

## Feature 2 — Quote Notes

### What it does
Users can attach titled notes to any quote at any stage. Each note has a title, body, created_at, and updated_at. Notes appear in a collapsible panel on the quote summary page (below the files section). Users can add, edit, and delete their own notes.

### DB changes
New table: `public.quote_notes`
```
id                  UUID PK
quote_id            UUID FK → quotes(id) ON DELETE CASCADE
company_id          UUID FK → companies(id) ON DELETE CASCADE
created_by_user_id  UUID FK → users(id) ON DELETE SET NULL
title               TEXT NOT NULL
body                TEXT NOT NULL
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now() (trigger-managed)
```
RLS: `company_members_manage_quote_notes` — FOR ALL using `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())`.

Migration file: `supabase/migrations/20260614130000_quote_notes.sql`

### Files added / changed
| File | Change |
|------|--------|
| `supabase/migrations/20260614130000_quote_notes.sql` | **NEW** — table + indexes + RLS + updated_at trigger |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/quote-notes-actions.ts` | **NEW** — `addQuoteNote`, `updateQuoteNote`, `deleteQuoteNote` server actions |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/QuoteNotesPanel.tsx` | **NEW** — full client component: collapsible section, add/edit/delete UI |
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` | Loads notes via server query, renders `QuoteNotesPanel` |

### Security areas to review
- **RLS policy** — `FOR ALL` with `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())`. Does this correctly prevent cross-company note access? Is the policy restrictive enough that a company member with no ownership of a specific quote could still insert a note for that quote?
- **`addQuoteNote` ownership** — action verifies `requireCompanyContext()` and inserts with `company_id = profile.company_id`. No explicit check that `quote_id` belongs to the same company before inserting. **Potential IDOR**: a user could supply a `quoteId` from a different company if they know it. Recommend adding `verifyQuoteOwnership(supabase, quoteId, profile.company_id)` before insert. The RLS policy alone may not catch this if the `company_id` on the insert is the attacker's own valid company but the `quote_id` is from another company.
- **`updateQuoteNote` / `deleteQuoteNote`** — operate on `noteId` only, relying entirely on RLS (`company_id` filter). No explicit `company_id` filter in the UPDATE/DELETE query — RLS should protect this but worth confirming RLS is active and correct on the table.
- **No rate limiting** on note creation — a user could spam many notes. Low risk for V1 but worth flagging.
- **Input length** — title and body are TEXT with no length cap in the DB or action layer. Consider a MAX constraint or truncation.
- **`created_by_user_id`** — set to `profile.id` server-side, not user-supplied. Confirm the profile comes from the authenticated session, not a request parameter.

---

## Previously audited
All items from the pre-live bundle (`3d8d311`) and Gerald re-audit (`b300972`) are considered resolved. This brief covers only the delta above.

## Delivery
Gerald: please write findings to `workspace-gerald/audits/quotecore-plus-2026-06-14/` using the standard format. Shaun will coordinate timing.
