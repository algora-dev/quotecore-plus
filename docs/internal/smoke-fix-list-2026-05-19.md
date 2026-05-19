# Smoke-Test Fix List — 2026-05-19
Source: Shaun's smoke pass through Gerald's 6-item checklist on `feature/tier-gating-v2` HEAD `112276e` (now merged to `development`). All fixes ship in one batch after smoke completes.

## #1 — Trial state copy is confusing (smoke 1 + 2)
**Where:** `BillingPanel.tsx` lines 281–305, `EntitlementBanner.tsx` line 119.
**Bugs:**
- `trialDaysLeft()` clamps `diffMs <= 0` to `0`, so day-14 (last day) and day-15+ (expired) both render "Trial ends today" — Shaun's screenshot at day-20 still says "Trial ends today."
- Current copy: `Starter (downgraded from trial) ... trialing pill ... Trial ends today — pick a plan to keep your data alive.` Conflates two distinct states (last-day-still-active vs expired-and-locked).

**Required UX:**
- Days N..1 remaining (pre-expiry): "Trial ends in {N} days." (or "1 day" for N=1).
- Day of expiry (less than 24h to go): "Trial ends today."
- Post-expiry: "Your trial has expired. Choose a plan now to keep your data and continue using QuoteCore+."
- Drop the "(Downgraded From Trial)" sublabel post-expiry — replace with the expired-state banner.

## #2 — Expired trial users can still write (smoke 2)
**Where:** DB function `public.company_effective_plan_active()`, migration `20260515160000_subscription_tiers_phase1.sql:~488`.
**Bug:** Returns `true` for any company with `subscription_status='trialing'`, even if `trial_ends_at < now()` and there's no Stripe subscription. So a user at day 20 of a 14-day trial:
- `effective_plan` correctly collapses to `'starter'` (read-only on gated features),
- but `isActive=true`, so `assertCanCreateQuote()`, `assertCanUseStorage()`, etc. ALL succeed under Starter's caps (25 quotes/month, 200 MB),
- meaning the user can keep creating quotes for up to 25 more, despite a fully expired trial.
- `expire-trials` cron eventually flips status to `canceled` (daily 06:09 UTC), at which point gates close. **Window of unauthorised writes: up to 24h.**

**Required behaviour (Shaun):** expired trial = read-only. Existing data viewable; NO new quotes / components / flashings / orders. Same as a cancelled paid sub.

**Fix:** tighten `company_effective_plan_active()` to return `false` when `subscription_status='trialing' AND trial_ends_at < now() AND stripe_subscription_id IS NULL`. Same condition the plan-code resolver already uses for the starter collapse. Closes the limbo window everywhere consistently (server actions + RLS + scheduled gates).

## #3 — Plan-switch UX while subscription is active (smoke 3)
**Where:** `BillingPanel.tsx` — H-02 server guard works, but UI hides/disables the "Choose plan" buttons on other tiers entirely when a paid sub is active.
**Bug:** Shaun successfully bought Starter via test Stripe Checkout. Going back to the plans table, the other tier cards are non-actionable. There's no path to upgrade from Starter → Growth/Pro without first cancelling the existing sub.
**Required UX (Shaun):**
- Other tier cards remain clickable.
- Clicking opens a modal: "You already have an active subscription. Cancel your current plan first, then choose your new tier." with a primary button linking to `/account?tab=billing` (or directly invoking `createCustomerPortalSession()`).
- Modal text uses "Manage Subscription" wording consistent with the existing CTA.

Note: this is purely a UX adjustment. The H-02 server-side guard stays — it correctly refuses a fresh Checkout call. We just need to surface that with a useful modal instead of silently disabling buttons.

## #4 — Status pill copy for cancelled-but-still-active subscriptions (smoke 3)
**Where:** `BillingPanel.tsx` — status pill renders only `subscription_status.replace('_', ' ')`.
**Bug:** When a user cancels via Customer Portal with `cancel_at_period_end=true`, the pill still says "active" alone. Loses the critical context that the sub is winding down.
**Required UX (Shaun):**
- Keep the existing "active" pill.
- ADD a second pill next to it: "Cancelled — ending {date}" (using `cancel_at` or computed period_end).
- Same pattern for any other "winding down" state (cancellation_pending).

## #5 — File-upload Server-Components render error (smoke 5)
**Where:** Manual-Mode quote builder, `/{slug}/quotes/{id}` page. Both `<RoofPlanUploadPanel />` and `<SupportingFilesPanel />` render an error: *"An error occurred in the Server Components render."*
**Suspected cause:** `app/lib/files/signed-upload.ts` is marked `'use server'` AND exports `MintUploadInput` interface + `MintUploadResult` type. Under React 19 / Next 16's stricter server-action contract, a `'use server'` module may only export async functions; non-function exports cause the module to throw at server-render time when re-imported through a client component boundary. (Build doesn't catch it — only runtime SSR.)

**Fix:**
1. Split `app/lib/files/signed-upload.ts` into:
   - `app/lib/files/signed-upload-types.ts` — `MintUploadInput`, `MintUploadResult`. No `'use server'`.
   - `app/lib/files/signed-upload.ts` — keep `'use server'`, ONLY exports the async function. Imports types from the new file.
2. Update the three client-component imports (`FilesManager.tsx`, `SummaryFilesPanel.tsx`, `QuoteDetailsForm.tsx`) to pull types from `signed-upload-types.ts` if they reference them, function from `signed-upload.ts`. If they only use the function, no change needed.
3. Add a regression test: assert that quote-detail page server-renders without throwing under a starter-tier company. (Lightweight — just hit the route with a session cookie.)

## #6 — robots.txt + sitemap.xml — DONE
**Verified via curl-equivalent against `https://quotecore-plus-dev.vercel.app`:**
- `/robots.txt` → 200 `text/plain; charset=utf-8` length 456, body starts `User-Agent: * Allow: /...`
- `/sitemap.xml` → 200 `application/xml` length 8956, body starts `<?xml version="1.0"...`

No fix needed.

---

## Batching strategy

All five fixes land on `development` in one commit chain after Shaun finishes the remaining smoke items. The order:
1. Migration: tighten `company_effective_plan_active()` (#2). Bumps existing companies' enforcement at-rest — no app code can rely on the old behaviour.
2. Code: split signed-upload module (#5). Restores file uploads.
3. Code: BillingPanel copy + tri-state day counter + EntitlementBanner copy (#1, #4).
4. Code: BillingPanel plan-switch modal (#3).
5. Regression coverage: extend `test-trial-reactivation-blocked.mjs` with a day-15 fixture asserting `isActive=false` + write attempts refused; add quote-page smoke test for #5 fix.

After Shaun signs off smoke on this branch's preview, fast-forward `development → main`.
