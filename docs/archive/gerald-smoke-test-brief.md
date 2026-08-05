# Gerald — Smoke Test Review Brief
**Date:** 2026-05-25  
**Author:** Gavin  
**Purpose:** Pre-launch smoke test plan review. We're about to run two controlled live tests. Please review the test lists and flag anything missing, wrong, or in the wrong order.

---

## Context

QuoteCore+ is now live at `https://app.quote-core.com` with:
- Live Stripe payments active (`STRIPE_MODE=live`)
- Generic trades enabled on production
- All Round 8 security findings resolved (your sign-off at `06-recheck-v2`)

We are running two smoke test accounts before opening to the public:
- **Account A:** Starter plan ($19/month, Card A)
- **Account B:** Professional plan ($39/month, Card B)

Test files:
- `docs/smoke-tests/smoke-test-starter.md`
- `docs/smoke-tests/smoke-test-professional.md`

---

## Design principles applied

1. **No double testing** — each test appears in exactly one account's list
2. **Equal depth** — 12 tests per account
3. **Starter tests the floor** — core quoting + gate enforcement for all 4 gated features (email_send, digital_takeoff, flashings, material_orders)
4. **Pro tests the ceiling** — every Pro-only feature exercised end-to-end
5. **H-02 live verification** — Pro Test 3 specifically validates the length×height pricing fix on production (10m length × 2.4m height = 24m² area, $600 not $250)
6. **Live domain verified** — both accounts test the `/accept/<token>` flow on `app.quote-core.com`
7. **No manual cap-hitting** — we don't manually create 50 quotes to test the monthly cap

---

## Feature gate coverage

| Feature | Gated at | Tested in |
|---|---|---|
| `email_send` | Growth+ | Starter T6 (gate fires) + Pro T5 (works) |
| `digital_takeoff` | Growth+ | Starter T7 (gate fires) + Pro T4 (works) |
| `flashings` | Pro+ | Starter T8 (gate fires) + Pro T9 (works) |
| `material_orders` | Pro+ | Starter T9 (gate fires) + Pro T10 (works) |
| `followups` | Pro+ | Not gate-tested on Starter (redundant with above) + Pro T6 (works) |
| `activity_card` | Growth+ | Pro T8 (works) |

---

## What we're asking you to review

1. **Are the gate tests correct?** Starter T6–T9 assume Starter gets none of: email_send, digital_takeoff, flashings, material_orders. Does that match the DB seed rows in `backend/supabase/migrations/20260515160000_subscription_tiers_phase1.sql`?

2. **Is the H-02 smoke test (Pro T3) sound?** The test enters 10m length on a `length_x_height` component with 2.4m height and expects 24m² area. Is the expected output correct given how `addComponentEntry` now applies the multiplier?

3. **Is the follow-up cancellation on acceptance correct (Pro T7)?** We expect the no-response follow-up to deactivate when the customer accepts. Does the acceptance handler actually cancel/skip scheduled messages with trigger `quote_sent` + `require_no_response=true` when the customer responds?

4. **Anything missing?** Any edge cases in billing, RLS, or the webhook flow that should be exercised in a controlled live test before public launch?

5. **Test order** — any sequencing issues? (e.g. should billing cancel in Starter come earlier/later?)

---

## What we don't need from you

- You don't need to verify the Stripe live keys or webhook config — that's operational
- You don't need to run these tests yourself — we'll execute and report back
- You don't need to re-audit the code — this is test plan review only

---

Please reply with any changes to the test lists before we execute.
