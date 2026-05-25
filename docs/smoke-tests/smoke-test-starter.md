# Smoke Test — Starter Plan
**URL:** https://app.quote-core.com  
**Card:** Card A (your choice — real card, will be charged $19)  
**Goal:** Verify core quoting works end-to-end, billing activates correctly, and all Pro/Growth-only features are properly gated.

---

## Before you start
- Use a fresh email address not previously registered on QuoteCore+
- Have Card A ready
- Have a second email address you can receive mail on (used as the "customer")

---

## Test 1 — Sign up & onboarding
1. Go to `https://app.quote-core.com` and sign up with a fresh email
2. Complete the full onboarding flow (company name, currency, security questions)
3. **Pass:** You land on the dashboard. A trial banner is visible showing days remaining.

## Test 2 — Upgrade to Starter
1. Go to **Account → Billing**
2. Confirm status shows **Trialing** with a trial end date
3. Click upgrade → select **Starter** ($19/month)
4. Complete Stripe Checkout with Card A
5. After the Stripe redirect, **wait 30–60 seconds, then sign out and sign back in**
6. **Pass:** After fresh login, Billing page still shows **Starter — Active** with a current period end date. No trial banner. *(Confirms webhook persisted the subscription, not just the redirect.)*

## Test 3 — Create a Roofing quote (manual builder)
1. Click **New Quote**
2. Select trade: **Roofing**
3. Fill in customer name, job name, and a roof area
4. Proceed to the quote builder
5. Add at least 2 components from your component library
6. Confirm line items and totals calculate correctly
7. **Pass:** Quote saves, totals are non-zero, no errors.

## Test 4 — PDF download
1. From the quote summary page, download the quote as PDF
2. **Pass:** PDF generates and downloads. Customer name, job name, and line items are visible in the PDF.

## Test 5 — Customer acceptance on live domain
1. From the quote summary, click **Send Quote → Copy Link**
2. Open that link in a private/incognito browser window (or a different device)
3. Confirm the URL is `https://app.quote-core.com/accept/<token>` (not the old Vercel URL)
4. Accept the quote as the customer
5. **Pass:** Quote acceptance page loads. After accepting, quote status in the dashboard updates to **Accepted**.

## Test 6 — Gating: email send blocked
1. On any quote summary page, click **Send Quote → Send via QuoteCore+**
2. **Pass:** An upgrade prompt appears explaining email send requires Growth or above. You cannot send. No email is dispatched.

## Test 7 — Gating: digital takeoff blocked
1. Open a quote and navigate to the **Takeoff** tab
2. **Pass:** A gate/upgrade prompt appears. The takeoff canvas does not load.

## Test 8 — Gating: flashings blocked
1. In the sidebar, click **Flashings**
2. **Pass:** An upgrade prompt appears. You cannot create a flashing drawing.

## Test 9 — Gating: material orders blocked
1. In the sidebar, click **Material Orders**
2. **Pass:** An upgrade prompt appears. You cannot create a material order.

## Test 10 — Gating: follow-ups blocked
1. Open the quote from Test 3 summary page
2. Click **Send Quote → Send via QuoteCore+** — if blocked by email gate, attempt to access the Schedule Follow-up button directly on the summary page
3. **Pass:** The schedule follow-up option either does not appear or shows an upgrade prompt for Pro. No follow-up can be scheduled.

## Test 11 — Gating: activity card hidden
1. On any quote summary page, look for an **Activity** tab or card
2. **Pass:** The activity card/tab is either hidden or shows an upgrade prompt. No activity timeline is visible.

## Test 12 — Component library
1. Go to **Components**
2. Create a new component library named "Test Library"
3. Add a component with a unit rate
4. **Pass:** Library and component are saved. Component appears in the quote builder when creating a new quote.

## Test 13 — Billing page accuracy
1. Go to **Account → Billing**
2. Verify:
   - Plan shows **Starter**
   - Status shows **Active**
   - Period end date is ~1 month from today
   - Quotes used this month reflects the quote you created
3. **Pass:** All values are accurate and consistent.

## Test 14 — Cancel subscription
1. On the Billing page, click **Cancel subscription**
2. Confirm the cancellation flow completes
3. **Pass:** Status updates to **Cancellation pending** (not immediately suspended — access continues until period end). A banner confirms cancellation.

---

## Summary checklist
- [ ] T1 Sign up + onboarding
- [ ] T2 Upgrade to Starter via Stripe (+ fresh session verify)
- [ ] T3 Manual Roofing quote with components
- [ ] T4 PDF download
- [ ] T5 Customer accepts quote on app.quote-core.com/accept/<token>
- [ ] T6 Email send gated
- [ ] T7 Digital takeoff gated
- [ ] T8 Flashings gated
- [ ] T9 Material orders gated
- [ ] T10 Follow-ups gated
- [ ] T11 Activity card gated
- [ ] T12 Component library create + use
- [ ] T13 Billing page accuracy
- [ ] T14 Cancel subscription
