# Smoke Test — Professional Plan
**URL:** https://app.quote-core.com  
**Card:** Card B (your choice — real card, will be charged $39)  
**Goal:** Verify all Pro-only features work end-to-end — generic trades, digital takeoff, email pipeline, automated follow-ups, flashings, material orders, and multi-library quoting.

---

## Before you start
- Use a different fresh email address to the Starter account
- Have Card B ready (different card to Account A)
- Have a second email address you can receive mail on (used as the "customer")

---

## Test 1 — Sign up & upgrade to Professional
1. Go to `https://app.quote-core.com` and sign up with a fresh email
2. Complete onboarding (company name, currency, security questions)
3. Go to **Account → Billing** → upgrade to **Professional** ($39/month)
4. Complete Stripe Checkout with Card B
5. After the Stripe redirect, **wait 30–60 seconds, then sign out and sign back in**
6. **Pass:** After fresh login, Billing page still shows **Professional — Active** with a period end date. No feature gates visible anywhere in the app. *(This confirms the Stripe webhook persisted the subscription, not just the redirect.)*

## Test 2 — Generic trade quote (Landscaping)
1. Click **New Quote**
2. Select trade: **Landscaping** (confirms generic trades are live on production)
3. Fill in customer name and job name — no roof area required
4. Proceed to quote builder
5. **Pass:** Quote creates successfully with Landscaping trade. No roofing-specific fields are shown.

## Test 3 — length_x_height component pricing (H-02 smoke test)
1. Go to **Components** and create a component with measurement type **Length × Height**
2. Set height = **2.4m**, unit rate = **$25/m²**, waste = **none**, pitch = **none**
3. Add this component to the Landscaping quote from Test 2
4. Enter a length of **10m** in the manual builder
5. **Pass:** The calculated area shows **24m²** (10 × 2.4), not 10m². The line subtotal before tax = **$600.00**, not $250. This confirms the H-02 fix is working on production. *(If you see $250 the height multiplier is not applying — stop and report.)*

## Test 4 — Digital takeoff
1. Open a quote and go to the **Takeoff** tab
2. Upload a plan image and draw at least 2 measurements
3. Click **Save & Continue to Components**
4. **Pass:** Takeoff saves without error. Measurements appear as component entries with correct values. Canvas is preserved on reload.

## Test 5 — Send quote via email pipeline
1. From a quote summary page, click **Send Quote → Send via QuoteCore+**
2. Enter the customer email address and send
3. **Pass:** Email arrives in the customer inbox within 2 minutes. Sender shows as `info@quote-core.com`. The "View Quote" button links to `https://app.quote-core.com/accept/<token>`. No spam landing.

## Test 6 — Schedule automated follow-up
1. After sending the quote (Test 5), the post-send follow-up prompt appears
2. Enable the **No response** rule, set delay to **1 day**, select a template
3. Click **Schedule selected**
4. **Pass:** Follow-up is scheduled. It appears in the Scheduled Messages list on the quote summary with a fire date ~1 day from now.

## Test 7 — Customer acceptance on live domain
1. Open the email received in Test 5 and click **View Quote**
2. Confirm URL is `https://app.quote-core.com/accept/<token>`
3. Accept the quote as the customer
4. **Pass:** Acceptance page loads and works. Quote status in the dashboard updates to **Accepted**.
5. Back in the dashboard, go to the Scheduled Messages list on the quote summary
6. Force-run the no-response follow-up row (the one from Test 6)
7. **Pass:** Row marks as **Cancelled** with a reason of "Customer accepted the quote". No email is sent to the customer. This confirms the suppress-on-acceptance logic works at dispatch time.

## Test 8 — Activity card
1. Open the quote from Tests 5–7
2. Click the **Activity** tab on the quote summary
3. **Pass:** Activity card shows the full timeline: quote created → sent (with recipient + timestamp) → accepted (with timestamp). No blank or error states.

## Test 9 — Flashing drawing
1. Go to **Flashings** in the sidebar
2. Create a new flashing drawing — draw at least one shape
3. Save it to the flashing library
4. **Pass:** Flashing saves. It appears in the flashing library list and can be reopened.

## Test 10 — Material order
1. Open a completed quote with components
2. Create a material order from the quote
3. Add at least one item, set a supplier name and email
4. Send the order to the supplier email
5. **Pass:** Material order saves and sends. Supplier receives the order email. Order appears in **Material Orders** list with correct status.

## Test 11 — Multiple component libraries
1. Go to **Components**
2. Create a second library named "Generic Trade Components"
3. Add 2–3 components to it (use generic measurement types — volume, hours, etc.)
4. Create a new quote, select the "Generic Trade Components" library
5. Add components from that library to the quote
6. **Pass:** Library selection works. Only components from the selected library appear. Quote totals calculate correctly.

## Test 12 — Settings: company default trade
1. Go to **Settings → Company**
2. Set the default trade to **Landscaping**
3. Save
4. Create a new quote — confirm **Landscaping** is pre-selected as the trade
5. **Pass:** Default trade persists and pre-populates on new quote creation.

## Test 13 — Cancel subscription (cleanup)
1. Go to **Account → Billing**
2. Note down the Stripe subscription ID shown on the page (or retrieve from Stripe dashboard) for ops records
3. Click **Cancel subscription** and confirm
4. **Pass:** Status updates to **Cancellation pending**. Access continues until period end. A cancellation banner is visible.
5. Record the Stripe customer ID and subscription ID for reconciliation.

---

## Summary checklist
- [ ] T1 Sign up + upgrade to Professional via Stripe (+ fresh session verify)
- [ ] T2 Generic trade quote (Landscaping)
- [ ] T3 length_x_height pricing correct — 24m² / $600 (H-02 live verification)
- [ ] T4 Digital takeoff — save, reload, components populate
- [ ] T5 Email send — arrives at customer inbox from info@quote-core.com
- [ ] T6 Automated follow-up scheduled
- [ ] T7 Customer accepts via app.quote-core.com/accept/<token> + force-run follow-up cancels
- [ ] T8 Activity card shows full timeline
- [ ] T9 Flashing drawing saved to library
- [ ] T10 Material order created and sent
- [ ] T11 Multiple component libraries used in quote
- [ ] T12 Default trade setting persists
- [ ] T13 Cancel subscription + record Stripe IDs
