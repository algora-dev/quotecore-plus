# Legacy Billing System - Phased Retirement Proposal

**Status: PROPOSAL - every phase starts only on Shaun's explicit go (owner mandate: config-confirm).**
**Prepared 2026-10-19 as part of the never-again job (single resolver + billing-matrix smoke shipped alongside).**

## Why

Three production incidents on 2026-10-19 shared one root cause: code assumed only two company
kinds (legacy plan + Stripe-metered custom) while admin-granted custom is a third. The durable fix
(the single resolver `app/lib/billing/company-type.ts` + `npm run check:billing` +
`npm run smoke:billing`) is shipped. But the deeper fragility is that TWO full billing systems
exist side by side. Retiring the legacy one removes the entire class permanently and cuts the
entitlement matrix from 3 kinds x 5 metered paths to 1 system.

## Current legacy footprint (mapped 2026-10-19)

**Live customers on legacy: 1** (the paying Pro customer, live pro price `price_1Tb0qG...`, since
25 May 2026). The 10 comps were kicked 2026-10-18 (`subscription_status='canceled'`, reversible).
Everything else on legacy is fixtures/probes/test accounts.

**Legacy surfaces:**

| Surface | Location | Notes |
|---|---|---|
| Plan catalogue | `subscription_plans` table + seed rows | starter/growth/pro/pro_plus/premium |
| Plan gating SQL | `company_effective_plan_code/active` legacy arms, `require_*_slot` RPCs, `create_quote_atomic` legacy arm | |
| Calendar quote counter | `company_quote_usage` (per-month, status transitions) | custom uses the paid-period ledger instead |
| AI-points ledger | `check_and_deduct_ai_points`, `get_ai_assist_points_status`, points tables | scan quota for legacy only |
| Stripe one-item subs | starter/growth/pro/pro_plus prices (test+live) | only live pro in real use |
| Change flow | `app/lib/billing/custom/legacy-boundary.ts` + one-item Stripe swap | legacy-only by guard |
| Dunning/lifecycle | billing-lifecycle cron legacy arm, grace/pending-purge states | custom has its own (attention + 7-day) |
| UI | account/billing plan cards, LapsedCompNotice, paywall legacy mode | paywall already custom-only on testing |

## Phases

### Phase 0 - DONE (2026-10-19, this session)
Single billing-type resolver live; every metered call site (quotes / storage / scan / assistant /
voice / entitlements / SA gate) funnels through it; grep guard + billing-matrix smoke on testing.

### Phase 1 - Custom-billing live-switch (already planned, separate go)
`CUSTOM_BILLING_STRIPE_ACCOUNT_ID=acct_...` + checkout flags on main, redeploy, full funnel probe
(cs_live_), owner real-card test. After this, NEW signups are custom-only; no new legacy subs can
be created. **This is the freeze point: the legacy cohort can only shrink from here.**

### Phase 2 - Migrate the one paying legacy customer
- Offer an equivalent custom setup at the SAME price point (core + capacity matching Pro
  entitlements: 100 quotes, storage, takeoff; scan/assistant per their usage) at their renewal.
- Mechanism: Stripe custom subscription swap (reconcile already handles kind='change' swaps) or,
  if they prefer to pause payments, an admin grant for N months (same machinery as Roofline).
- Owner outreach email/call first; migration only on customer consent (revenue-first rule).
- Fallback if they decline: grandfather on legacy until churn - Phase 3 then only proceeds when
  their sub ends (check: zero active legacy subs in Stripe).

### Phase 3 - Code retirement (only when legacy active subs = 0)
Ordered PRs, each individually revertible:
1. Legacy signup/change surfaces: delete one-item change flow (`legacy-boundary.ts` callers),
   legacy paywall mode, LapsedCompNotice.
2. AI-points ledger: drop `check_and_deduct_ai_points`/`get_ai_assist_points_status` call sites
   (keep tables read-only for history), remove points columns from entitlements.
3. Slot/plan gates: `require_*_slot` RPCs collapse to custom caps; `company_quote_usage` frozen
   read-only.
4. `subscription_plans`: KEEP THE TABLE (history + effective-plan SQL reads it for display) but
   mark plans unavailable; final drop only after a fresh audit confirms zero readers.
5. Billing-matrix smoke slims to two fixtures (custom_metered + custom_admin_granted).

## Rollback / safety
- Every phase is additive-then-removal; nothing here drops data before Phase 3's final audit.
- Resolver + smoke stay the tripwire: if any legacy removal breaks a custom path, the matrix
  fails on the next testing deploy before QA sees it.
- The paying customer is never migrated without consent; grandfathering is an accepted end-state
  for Phase 2 if they decline.

## Suggested sequencing
Phase 1 is already the next planned milestone (live-switch). Phase 2 starts the week after the
real-card test passes. Phase 3 estimate: 2-3 small PRs over a few sessions once the cohort is zero.
No calendar cutover date is proposed - the gates above ARE the cutover criteria, each on your go.
