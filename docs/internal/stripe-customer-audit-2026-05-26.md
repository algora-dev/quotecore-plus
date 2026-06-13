# Stripe Customer Audit — 2026-05-26

**Triggered by:** T13 smoke test failure — Pro account "Manage subscription" returned:
> `No such customer: 'cus_UXWHxulYOoHgHJ'; a similar object exists in test mode, but a live mode key was used to make this request.`

**Auditor:** Gavin

---

## All companies with a stripe_customer_id (as of 2026-05-26)

| Company | stripe_customer_id | stripe_subscription_id | plan_code | subscription_status | current_period_end | created_at | Assessment |
|---|---|---|---|---|---|---|---|
| Residential Roofing | `cus_UXWHxulYOoHgHJ` | NULL | pro | active | 2026-06-18 | 2026-04-01 | ⚠️ BAD — test-mode customer, no subscription ID |
| Cece's Business | `cus_UaEHpzaxi1IFqg` | `sub_1Tb3ocPIfO8jS1dmmApfNtEd` | starter | active | 2026-06-25 | 2026-05-25 | ✅ Clean |
| Smoke Test | `cus_UaEHMZLyFodlCH` | `sub_1Tb3obPIfO8jS1dmSD4nbfRw` | pro | active | 2026-06-25 | 2026-05-25 | ✅ Clean |

---

## Findings

### 1. Scope is limited to one test account

Only **"Residential Roofing"** (secarter23@gmail.com's old Pro test account) has a broken customer ID. The two real paying customers (Cece's Business, Smoke Test) are clean — both have live-mode `cus_UaEH*` IDs and proper `sub_1Tb3o*` subscription IDs.

### 2. Why the bad row exists

"Residential Roofing" was created on 2026-04-01 — before the live Stripe keys were fully set up. Checkout was completed against a test-mode Stripe instance. Key indicators:
- `stripe_customer_id = cus_UXWHxulYOoHgHJ` exists in Stripe test mode, not live mode
- `stripe_subscription_id = NULL` — a real webhook completion would always write the subscription ID; this was never written, confirming no live-mode webhook fired
- `subscription_status = 'active'` and `current_period_end = 2026-06-18` — these were written by the checkout redirect handler (client-side), not by a webhook

### 3. Action on bad row

**Per Shaun's instruction (2026-05-26): "If it's only something that affects this test user, don't do anything yet."**

The broken customer ID affects only this test account. No action taken on the row itself. The account continues to show "Manage subscription" errors, which is acceptable for a test account.

---

## What we're building to prevent future occurrences

### 1. `stripe_mode` column on `companies`

New column `companies.stripe_mode text` (nullable, values `'test'` or `'live'`).
- Set by checkout session creation and by webhook on every Stripe write going forward
- Backfilled to `'live'` for existing rows with a valid `stripe_subscription_id` (Cece's Business, Smoke Test)
- Backfilled to `'test'` for "Residential Roofing" (for accuracy, since that's what it is)
- Allows future debugging to immediately identify mode mismatches without hitting the Stripe API

### 2. `repairStripeCustomerIfStale()` helper

New helper in `app/lib/billing/stripe.ts`. Called when a Stripe portal/checkout API returns a "No such customer" or "live mode key, test mode object" error.

Logic:
1. If `stripe_subscription_id` is set → retrieve subscription in current mode → if valid, repair `stripe_customer_id = subscription.customer`
2. If status is `active`/`past_due`/`trialing` AND repair fails → do NOT null → return `STRIPE_CUSTOMER_REPAIR_FAILED` (surface "contact support" to user)
3. Only if status is terminal (`cancelled`, `suspended`, never paid) AND no valid subscription → safe to null `stripe_customer_id`

This ensures a live paying customer can never silently lose their billing identity.

---

## Conclusion

- **Impact:** 1 test account. 0 real paying customers affected.
- **Action on bad row:** None (test account, Shaun confirmed no action).
- **Preventive build:** `stripe_mode` column + `repairStripeCustomerIfStale()` helper — protects all future users.
