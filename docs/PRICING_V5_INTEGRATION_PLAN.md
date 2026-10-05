# Pricing V5 Integration Plan (testing-first)

Owner directive 2026-10-05 16:14: build the V5.1 pricing selector into the app now, on the testing deployment, with Stripe test mode connected end-to-end. Marketing pricing page gets the calculator; the chosen setup persists through signup and is paid at the end of signup; the account billing page gets a "change plan" entry running the same calculator account-aware. Done-for-You stays manual (bespoke Stripe payment + admin-granted entitlement). Demo/consultation bookings share the existing Calendly calendar, 20 minutes either way, tagged by source.

Source package: `QuoteCore-Pricing-Selector-V5.1-Handoff.zip` (external pricing agent). Design base: UX Standard v2.15 Dark Focus (scoped to the calculator surface only).

## Inventory findings (2026-10-05)

- Repo state: `ux/phase-4` @ `b6b93220`; testing deployed `k32gwh9km`.
- `subscription_plans` rows: purchasable today = **starter $19 / pro $39 / pro_plus $59** (growth $29 inactive/hidden); comp tiers: trial, free, premium, demo. Legacy plan limit columns are effectively unlimited (999,999,999 quotes / 1100GB); the real gates are the `feat_*` flags + slot/assert functions.
- `companies.billing_model` does NOT exist yet (migration required).
- `company_quote_usage` exists (per-period quote usage) — foundation for the quote allowance.
- `company_ai_usage` exists; per-scan billing already lives in `app/api/takeoff/ai-scan-v3/route.ts` (2/6/12 tokens by quality, two operations per full plan).
- Stripe webhook: one endpoint `app/api/webhooks/stripe/route.ts` — `handleCheckoutCompleted` (L292), `handleSubscriptionEvent` (L330, live-state fetch), `handleInvoicePaid/Failed`, disputes. Price allowlist = single-price resolver `resolvePlanCodeForStripePrice`.
- Billing actions (`account/billing/actions.ts`): `createCheckoutSession` (single price, metadata `{company_id, plan_code}`), `changePlan` (upgrade = immediate prorate via items update; downgrade = subscriptionSchedules at period end), `createCustomerPortalSession`. Duplicate-subscription guard present.
- Paywall: `/paywall` shown after onboarding while the effective plan is inactive; it reuses BillingPanel — **the pay-at-end-of-signup seam already exists**.
- Marketing `/pricing`: `BlogHeader` + `SiteFooter` + static `pricingPlans` (`@/lib/pricing`) + SEO schema/FAQ — calculator replaces the static card grid, header/footer/schema stay.
- Admin: `adminOverridePlan`, `changePaidPlan`, pause/resume, coupons, impersonation, quota reset already exist — owner's "change users' plans to suit" is covered; extend for custom snapshots (Done-for-You 3-month grants).
- Stripe local env: `sk_test_` key, `STRIPE_MODE` unset → test mode. Verify testing project env at deploy time.
- Booking: Calendly `https://calendly.com/quote-core-info/15-minute-meeting` used site-wide. Both CTAs use it; distinguish demo vs done-for-you via URL query params captured by Calendly. Event duration (15 vs 20 min) is a Calendly-account-side setting.

## Phases

- **P1 Component mount.** Copy `app/components/pricing/calculator` from the handoff into the repo (merge against host). Reuse host `QcButton`/v2 CSS (add `variant="glass"` if the host predates it). Mount `PricingCalculator` on `/pricing` inside the existing layout behind `CUSTOM_SETUP_UI_ENABLED` (default on for testing). Scoped `.qcp` styles; `--qcp-header-offset` for the sticky header. Never ship `preview/` or `PricingSelectorPreview`.
- **P2 Storage (additive SQL).** Adapt `integration/sql/001_custom_billing_support.sql` to current schema: `companies.billing_model` discriminator, custom catalogue registry (mode-scoped price IDs), `company_custom_billing` purchased snapshots, checkout operations, period-grant records. No changes to legacy rows. Apply to Supabase (additive, nullable — standing permission).
- **P3 Stripe test catalogue.** Run `tools/stripe-catalogue-setup.mjs` plan → guarded apply with the test key: 6 products / 14 monthly prices (Core $19; Capacity $10/$20/$40; Digital Takeoff $20; Scan $10/$30/$80; Offcuts $10/$20/$40; Assistant $20/$40/$60). Store the price mapping in the DB registry + testing env. Never touch legacy families.
- **P4 New-customer flow.** Server action `createCustomCheckoutSession` (multi-item subscription, qty 1 each, operation lock + idempotency, duplicate-checkout guard reuse). Intent persistence: calculator result → `PlanIntent` (schema v2) via existing persistence helpers, carried through signup/email-verification/onboarding → paywall reads it → shows the configured setup with one pay CTA. ResultActions CTAs: demo → Calendly (`?a1=demo`), Done-for-You → Calendly (`?a1=done-for-you`), App Demo → `/demo`, free takeoff → existing free-tools page.
- **P5 Webhook extension.** In `handleSubscriptionEvent`/`handleCheckoutCompleted`: expand subscription items, classify complete item set via the custom price registry vs the legacy single-price resolver. Custom path: decode families (exactly one core + capacity, ≤1 per add-on, Digital prerequisite for Scan/Offcuts, aligned periods/currency, qty 1), verify paid invoice before flipping `billing_model=custom_setup`, write snapshot + open period grant atomically. Legacy path stays byte-identical. Unknown/mixed sets → quarantine + preserve last verified access.
- **P6 Entitlements + usage.** Extend `loadCompanyEntitlements`: `billing_model=custom_setup` → read snapshot (features: digital/scan/offcuts/assistant; capacity: quotes/storage; tokens/tasks). Chokepoints: quotes via existing `createQuoteAtomic`/`company_quote_usage` (launch default = creation-count, share-based policy behind a flag pending owner signoff); scan tokens via the existing per-scan billing path (allowance check + reserve/settle); assistant tasks = accepted user turns (SA request path); storage via existing `assertCanUseStorage` with the custom limit.
- **P7 Billing-page change flow.** BillingPanel gets "Build a new setup" (current-plan aware). Multi-item item-ID diff on the SAME subscription: pure increases can be immediate with paid proration; mixed/reductions default to period end. Proposal stored server-side; explicit confirm; effective date + amounts shown before confirming.
- **P8 Admin.** Extend `changePaidPlan`/`adminOverridePlan` to grant a custom snapshot manually with a prepaid end date (the Done-for-You bespoke flow: 3 months, then customer takes over payments).
- **P9 Verify + deploy.** Handoff unit tests (100), repo `next build` + tsc, eslint (no new errors), mobile pass with real header/footer, end-to-end test checkout (4242) → webhook → entitlements, legacy regression (starter/pro/pro_plus cards + the one Pro subscriber untouched), deploy testing from repo + `deploy-verify.ps1`, report with URL + evidence.

## Owner-authorized simplifications

- Legacy protection kept minimal: one real paying customer (Pro, handled personally); everything else expiring trials. Legacy recognition stays intact so nothing breaks, but no heavyweight migration machinery.
- Done-for-You: no service billing automation. Bespoke Stripe payment by owner + admin-granted entitlement.
- Both booking CTAs share one Calendly calendar; duration is an account-side setting.

## Open items (non-blocking)

1. Calendly event duration → 20 min (owner, Calendly dashboard).
2. Confirm $149 all-features Medium (audit corrected the earlier $129 example) — catalogue shipped as-is for testing.
3. Quote allowance policy (creation-count vs first-external-share) before LIVE charging; testing runs creation-count.
4. USD ex-tax display confirmation before production release.
