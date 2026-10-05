# Remove Free Trial - Paid-Upfront App Plan (REV 3, 2026-09-16)

**Status:** PLANNED - not started. Direction confirmed by Shaun 2026-09-16 11:45 audio. Do NOT code until Shaun kicks it off.

## Goal
- Kill the 14-day free trial completely. Nobody signs up into a trial.
- **No free signup path.** The only ways into the app: (1) sign up + pay for a tier, (2) we manually assign free access (comp) to an email address.
- Free/light tier is a BACKEND-ONLY state (not shown/selectable in any plan UI). It exists for: failed-payment dunning (auto drop-down), and any account we manually restrict. User keeps app access to view/download/delete their own work; everything else restricted. We get notified; we alert them and ask if there's a problem.
- Existing ~6 trial users (mostly inactive): comp to Pro 1 month free, email them. Don't worry about the rest.
- 30-day money-back guarantee: 3-day request window after day 30, case-by-case, most refunds granted straight away, optional exit survey.
- Paywall shows: Starter / Pro / Pro Plus + larger-plan "get in touch" option + Done-For-You options ($499/$999).
- Dunning: existing paid-plan dunning infra already exists - modify/adapt it for the 3 paid tiers (week-1 grace warning, then restricted backend free state).

## Decision: existing trial users (Shaun, 2026-09-10, reconfirmed 2026-09-16)
- All users currently on free trial get switched to Pro for free for 1 month (comp_until, NOT trial). Manual/scripted switch.
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
- Redefine plan_code 'free' as the restricted fallback tier (16 gating fns already collapse to free = minimal change).
- Stop setting `trial_ends_at` on company creation (trigger change).
- Keep trial columns + trial branch in effective-plan fn for comped-legacy users during migration; remove later if desired.
- Migration script for existing trial users: set 1 month Pro comp (comp_until), plan_code pro, status active.

### Phase 1b - REV 2 NEW: dunning / failed-payment flow
- Payment fails (Stripe `invoice.payment_failed` / subscription past_due):
  - **Week 1 (grace):** everything stays ON. Warning email: "update your payment within a week or you'll lose services."
  - **Week 2:** drop to the restricted free tier (view/download/delete own data; no creation/AI/sending). Stays there until they pay. Nothing is deleted.
  - Recovery on payment is instant (plan_code preserved - existing pattern from 2026-05-15).
- Implement via existing dunning hooks + a cron check + scheduled warning emails.

### Phase 2 - Onboarding paywall
- New final step after company creation: plan selection showing Starter / Pro / Pro Plus + "larger plan? get in touch" option + DFY options ($499/$999, manual Stripe Payment Links initially) + 30-day money-back guarantee messaging + "No thanks, I'll try the free tools first" button.
- "No thanks" = CLEAN EXIT (confirmed 2026-09-16): no account is created, link goes to the free tools page. If they come back through signup later, that's fine.
- Auth layout gate: users who haven't paid see the paywall on every visit until they pay (or we manually comp them).
- Once paid: straight into the app with the features of their tier.

### Phase 3 - Guarantee plumbing
- Paywall + pricing copy: 30-day money-back guarantee with clear guidelines (terms page).
- 30-day count starts the moment a user pays. 3-day refund request window after day 30 (confirmed). No advance "day 30 is coming" email - communication happens only when THEY request the refund.
- Refund request = step-by-step questionnaire (click-through, one question per step, very easy). Working spec (2026-09-16, refine at build):
  1. Did you actually use the app? (yes / barely / no)
  2. What did you use that you thought was really good? (multi-choice: measuring/takeoff, quoting, sending quotes, smart components, other + comment)
  3. What did you use that could be better? (same choices, multi-select + comment)
  4. Why are you leaving? (too hard to learn / too complex / missing features / just don't need it / other)
  5. If "missing features": which features? (comment box)
  6. Final step - choose: (a) submit refund request, (b) request to speak to us first (book a call / send us a message).
- Answers can be minimal but must pass through the flow to reach the refund request. Every submission notifies us; we always get a chance to respond BEFORE manually issuing the refund (assess case-by-case; most refunds granted straight away; watch for abuse - maxed-out usage then refund).
- Purpose: learn + improve + retain/convert (coaching, custom solutions) before refunding.
- DO NOT BUILD the questionnaire at launch - no user can reach it for 30+ days anyway. Ship the simple manual refund button/email first; questionnaire as a fast-follow.

### Phase 4 - Cleanup
- Remove trial countdown banners, TrialRolledToFreeBanner, expire-trials cron, signup/auth trial copy, admin panel trial labels, costGuard trial branches.
- User emails sent (Phase 1 decision) - manual/Shaun-approved send.

## Out of scope (follow-ups)
- Marketing site trial mentions: pricing page, /free-trial landing page, ~50 blog posts. Separate pass.
- Refund automation in Stripe.
- DFY productized checkout (beyond payment links).

## Open questions for build session (REV 4)
- Free-tools bridge (SaveToAppButton) copy: free-tools users must now pay to save into the app - update CTA copy accordingly.
- Guarantee terms page wording (3-day window after day 30, abuse clause).
- Dunning email cadence exact copy (week 1 warning, week 2 drop notice, "any problems?" outreach).
- Comped-trial-user email copy - Shaun approves before send.
- Refund questionnaire exact wording + which system hosts it (in-app flow vs form) - fast-follow, not launch-blocking.
