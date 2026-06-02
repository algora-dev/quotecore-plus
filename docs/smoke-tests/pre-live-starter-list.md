# Pre-Live Tier Test — STARTER

> **Treat this as a go/no-go gate for production (real money, real customers).** If every item passes, Starter is cleared to go live. Any failure = fix-or-block before launch.
>
> **URL:** https://app.quote-core.com (LIVE production)
> **Plan under test:** Starter ($19/mo) — **Card A** (real card, will be charged $19)
> **Persona:** A roofing contractor signing up for the first time, on the cheapest paid plan.
>
> **Status keys:** `[ ]` pending · `[x]` pass · `[!]` fail (note why) · `[~]` partial/needs retest
>
> **Priority labels:** **[SECURITY-BLOCKER]** security/data-isolation issue; blocks launch. **[BLOCKER]** correctness/revenue/customer-impacting issue; blocks launch. **[EVIDENCE-GATE]** not a manual step — Gavin must attach release evidence before merge. **[NICE]** should fix, does not block launch if core behaviour passes.
>
> **Reading this if you've never used the app:** Each test tells you exactly what to click and what a PASS looks like. Just follow the numbered steps. Where a step needs Gavin to check something technical behind the scenes, it says **(Gavin verifies)** — you don't need to do anything for those beyond reporting what you saw.
>
> Scope note: Starter is the floor tier. The job here is (1) the **happy path of core quoting works end-to-end**, (2) the **new signup → trade → seeding → copilot** flow is correct, and (3) **every higher-tier feature is correctly gated/blocked**. Keep it tight.

---

## Before you start
- Fresh email never registered on QuoteCore+.
- Card A ready (will be charged $19 — real).
- A second email inbox you control (acts as the "customer").
- Note the exact signup time (for webhook/seeding checks).

---

## SECTION A — Signup, default trade, seeding, copilot (NEW since last tier test)

### A1 — Sign up + choose default trade = **Roofing** **[BLOCKER]**
1. Sign up with a fresh email.
2. Complete onboarding: company name, currency, language, measurement system.
3. **On the trade step, explicitly choose `Roofing` as the default trade.**
4. **Pass:** Onboarding completes, you land in-app. No errors. Trial banner visible with days remaining.

### A2 — Copilot intro flow **[BLOCKER]**
1. Immediately after onboarding, the **copilot intro/guide** should kick in (post-onboarding step).
2. Step through it.
3. **Pass:** Copilot intro appears, steps advance correctly, and it can be completed/dismissed without breaking the dashboard. (Flag any step that points at a renamed/missing button.)

### A3 — Starter components were seeded (Roofing + Generic both) **[BLOCKER]**
1. Go to **Components**.
2. **Pass:** TWO collections exist out of the box — **"Roofing"** and **"Generic"** — each pre-filled with starter components (Roofing ~7, Generic ~9). Components have sensible names, rates, and measurement types. *(Seeding always creates both collections regardless of chosen trade — this is intended.)*

### A4 — Chosen trade pre-selects on new quote **[BLOCKER]**
1. Click **New Quote**.
2. **Pass:** **Roofing** is pre-selected as the trade (matches the A1 choice). Roofing-specific flow (roof area + pitch) is present.

---

## SECTION B — Core quoting happy path (must work end-to-end)

### B1 — Upgrade to Starter via Stripe (+ session-persist check) **[BLOCKER]**
1. **Account → Billing** → confirm **Trialing** with a trial end date.
2. Upgrade → **Starter ($19/mo)** → complete Stripe Checkout with Card A.
3. After redirect, **wait 30–60s, sign out, sign back in.**
4. **Pass:** After fresh login, Billing shows **Starter — Active** with a period-end date, no trial banner. *(Confirms the webhook persisted, not just the redirect.)*

### B2 — Manual Roofing quote with seeded components **[BLOCKER]**
1. **New Quote** → Roofing → customer name, job name, one roof area (with pitch).
2. Add at least 2 components from the seeded **Roofing** collection.
3. **Pass:** Quote saves, line items + totals calculate (non-zero), no errors.

### B3 — PDF download **[BLOCKER]**
1. From the quote summary, download the quote PDF.
2. **Pass:** PDF generates + downloads. Customer name, job name, line items all visible.

### B4 — Customer acceptance on live domain **[BLOCKER]**
1. Quote summary → **Send Quote → Copy Link**.
2. Open in incognito / another device. URL must be `https://app.quote-core.com/accept/<token>`.
3. Accept as the customer.
4. **Pass:** Acceptance page loads; after accepting, dashboard status flips to **Accepted**.

### B4a — Invalid acceptance link is safe **[SECURITY-BLOCKER]**
1. Take the `https://app.quote-core.com/accept/<token>` link from B4 and change a few characters in the long code at the end (e.g. swap a couple of letters/numbers).
2. Open that altered link in an incognito window (logged out).
3. **Pass:** you get a plain "not found" or "expired" page. You do NOT see anyone's quote, customer name, company details, or any error/technical text. *(Gavin verifies: no info leak in the response.)*

### B5 — Component library create + use **[BLOCKER]**
1. **Components** → create a new library "Test Library" → add a component with a unit rate.
2. **Pass:** Library + component save; component is selectable in a new quote.

### B6 — Billing page accuracy **[BLOCKER]**
1. **Account → Billing** — verify: Plan **Starter**, Status **Active**, period end ~1 month out, quotes-used reflects quotes created.
2. **Pass:** All values accurate + consistent.

---

## SECTION C — Higher-tier gating (Starter must be BLOCKED from these)

> Every one of these must show a clean upgrade prompt and refuse the action. No silent failures, no half-open features. *(These are revenue gates — Starter paid for less, so it must not get Pro features.)*

### C1 — Email send blocked **[BLOCKER]**
- Open a quote → **Send Quote → Send via QuoteCore+** → **Pass:** you get an upgrade prompt and NO email is sent.

### C2 — Digital takeoff blocked **[BLOCKER]**
- Open a quote → click the **Takeoff** tab → **Pass:** an upgrade prompt appears; the drawing canvas does not open.

### C3 — Drawings & Images / Flashings blocked **[BLOCKER]**
- Go to **Components** → click the **Flashings** button → **Pass:** upgrade prompt; you cannot create a drawing. *(On a roofing account the button is labelled "Flashings".)*

### C4 — Material orders blocked **[BLOCKER]**
- Sidebar → **Material Orders** → **Pass:** upgrade prompt; you cannot create an order.

### C5 — Follow-ups blocked **[BLOCKER]**
- Open a quote → try to schedule a follow-up → **Pass:** the option is hidden or shows an upgrade prompt; no follow-up is scheduled. *(Note: confirm with the Pro list whether follow-ups are a Pro feature or higher — the boundary must be consistent.)*

### C6 — Activity card gated **[BLOCKER]**
- Open a quote → look for an **Activity** tab/card → **Pass:** it's hidden or upgrade-prompted; no activity timeline is shown.

### C7 — Catalogs blocked **[BLOCKER]** *(+ direct-route check is **[SECURITY-BLOCKER]**)*
1. Sidebar/Components → look for **Catalog Library / import** → **Pass:** upgrade prompt (catalogs are Pro+; Starter gets 0). You cannot create or import a catalog.
2. **Direct-route check (Gavin will give you the exact URL):** while logged in as this Starter account, paste a catalog/import URL straight into the address bar.
3. **Pass:** still blocked — no import wizard opens, nothing uploads, no catalog or rows get created. *(Gavin verifies server-side: nothing was created.)*

### C8 — Attachment Library blocked **[BLOCKER]** *(+ direct-route check is **[SECURITY-BLOCKER]**)*
1. **Resources → Attachments** tab → **Pass:** the library is hidden or locked for Starter.
2. **Direct-route check:** paste `https://app.quote-core.com/<your-workspace>/resources?tab=attachments` into the address bar.
3. **Pass:** no upload button/action is available; nothing changes your storage usage.

---

## SECTION D — Subscription management

### D1 — Cancel subscription **[BLOCKER]**
1. Billing → **Cancel subscription** → confirm flow.
2. **Pass:** Status → **Cancellation pending** (NOT immediate suspension — access until period end). Cancellation banner visible.
3. **Also verify (carried from last test):** the plan-card cancel path works, not only "Manage subscription → Stripe". Confirm the live-mode Stripe customer resolves (no "No such customer / test mode" error). *(This bug hit the Pro account last round — verify on Starter too.)*

---

## Summary checklist
- [ ] A1 Signup + default trade = Roofing
- [ ] A2 Copilot intro flow works
- [ ] A3 Both Roofing + Generic collections seeded with components
- [ ] A4 Chosen trade pre-selects on new quote
- [ ] B1 Upgrade to Starter via Stripe (+ fresh-session persist)
- [ ] B2 Manual Roofing quote w/ seeded components
- [ ] B3 PDF download
- [ ] B4 Customer accepts on app.quote-core.com/accept/<token>
- [ ] B4a Invalid acceptance token fails closed **[SECURITY-BLOCKER]**
- [ ] B5 Component library create + use
- [ ] B6 Billing page accuracy
- [ ] C1 Email send gated
- [ ] C2 Digital takeoff gated
- [ ] C3 Drawings/Flashings gated
- [ ] C4 Material orders gated
- [ ] C5 Follow-ups gated
- [ ] C6 Activity card gated
- [ ] C7 Catalogs gated + direct route blocked **[BLOCKER / direct-route SECURITY-BLOCKER]**
- [ ] C8 Attachment library gated + direct route blocked **[BLOCKER / direct-route SECURITY-BLOCKER]**
- [ ] D1 Cancel subscription (+ plan-card cancel + live Stripe customer resolves)

---

## Notes / failures (fill in during run)
_(record per-item failures here with the test id)_
