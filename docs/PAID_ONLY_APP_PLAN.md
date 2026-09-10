# Remove Free Trial + Free Tier - Paid-Only App Plan

**Status:** PLANNED - not started. Approved direction by Shaun 2026-09-10 (audio). Do NOT code until Shaun kicks it off.
**Target window:** week of 2026-09-14.

## Goal
- Kill the 14-day free trial and the free/light tier. App is paid-only.
- Free tools (takeoff demo, calculators, supplier tools) ARE the trial.
- Sign-up completes only when the user selects a paid option.
- 30-day money-back guarantee replaces the trial as risk-reversal (manual refund process to start).
- Done-For-You option at paywall: $499/$999, includes 6 months pro + setup + onboarding call + 6 months support.

## Decision: existing trial users (Shaun, 2026-09-10)
- All users currently on free trial get upgraded to Pro for free for 1 month (use comp_until or admin_override, NOT trial).
- Email all of them: "we've given you a month of Pro free" + ask if anything else we can help with / anything the app is missing / mention we build custom solutions.
- After the free Pro month ends, decide per-user (extend or paywall). Figure out later.
- End state of this migration: NO users remain on free trial.

## Surface map (audited 2026-09-10)
1. Plan resolution: `company_effective_plan_code()` (Postgres, patch 027). Precedence: admin override -> comp_until -> trial -> subscription status. Expired trial -> 'free', grace/cancel -> 'free'. All 16 gating DB functions route through it.
2. Trial lifecycle: `companies.trial_ends_at` / `trial_started_at` trigger, Vercel cron `app/api/cron/expire-trials/`, `EntitlementBanner` (countdown states), `TrialRolledToFreeBanner`.
3. Onboarding: `app/(auth)/onboarding/` (OnboardingForm.tsx, GoogleOnboardingForm.tsx) -> redirects into workspace. `app/signup/page.tsx` has "Free 14-day trial, no card needed" copy.
4. Upgrade surface: `app/components/UpgradeModal.tsx`, `BillingPanel.tsx` (Stripe Checkout works).
5. Free-tools bridge: SaveToAppButton, check-save-eligibility, free-tools account-status API - assume account lands in usable app.
6. Misc: admin panels (signups/users show trial state), assistant costGuard, ~10 auth pages with trial copy.
7. `entitlements.ts` (status 'trialing', trialEndsAt), `features.ts` (trial feature set).

## Phases (one push per phase)

### Phase 1 - DB migration (additive, pre-authorized)
- New unpaid state: either `subscription_status = 'unpaid'` or redefine plan_code 'free' as locked-unpaid (16 gating fns already collapse to free = minimal change preferred).
- Stop setting `trial_ends_at` on company creation (trigger change).
- Keep trial columns + trial branch in effective-plan fn for comped-legacy users during migration; remove later if desired.
- Migration script for existing trial users: set 1 month Pro comp (comp_until), plan_code pro, status active.

### Phase 2 - Onboarding paywall
- New final step after company creation: plan selection (reuse BillingPanel cards) + DFY option ($499/$999, manual Stripe Payment Links initially) + 30-day money-back guarantee messaging + "Not ready? Keep using the free tools" exit link.
- Auth layout gate: unpaid users redirect to paywall on every visit until they pay.
- Signup/onboarding not complete until plan chosen.

### Phase 3 - Guarantee plumbing
- Paywall + pricing copy: 30-day money-back guarantee with clear guidelines (terms page).
- Refund request = manual: button/email that notifies us. No Stripe refund automation yet.

### Phase 4 - Cleanup
- Remove trial countdown banners, TrialRolledToFreeBanner, expire-trials cron, signup/auth trial copy, admin panel trial labels, costGuard trial branches.
- User emails sent (Phase 1 decision) - manual/Shaun-approved send.

## Out of scope (follow-ups)
- Marketing site trial mentions: pricing page, /free-trial landing page, ~50 blog posts. Separate pass.
- Refund automation in Stripe.
- DFY productized checkout (beyond payment links).

## Open questions for build session
- Exact refund eligibility guidelines wording (30-day money-back terms).
- DFY pricing tiers $499 vs $999 - what differs (scope of setup).
- Whether 'free' plan row stays in subscription_plans as unpaid-lock or is retired.
