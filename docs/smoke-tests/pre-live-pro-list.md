# Pre-Live Tier Test — PROFESSIONAL

> **Treat this as a go/no-go gate for production (real money, real customers).** If every item passes (or the failures are fixed), Pro + the whole `development → main` backlog is cleared to merge + go live.
>
> **URL:** https://app.quote-core.com (LIVE production) — *unless an item is explicitly marked DEV, for features not yet merged to main.*
> **Plan under test:** Professional ($39/mo) — **Card B** (real card, different from Card A; will be charged $39)
> **Persona:** A multi-trade contractor on the full-feature plan.
>
> **Status keys:** `[ ]` pending · `[x]` pass · `[!]` fail (note why) · `[~]` partial/needs retest
>
> This list folds in the **entire dev backlog smoke pass** (attachments, catalog library, storage policy, generic-trade labelling) plus the carried-over findings from the previous Pro run. Items already verified on dev this session are marked **[PRE-VERIFIED dev]** — re-confirm on the live build after merge.

---

## Before you start
- Fresh email, different from the Starter account.
- Card B ready (different card from Card A — $39 real charge).
- A second email inbox you control (the "customer") + ideally a third (a "supplier").
- Note exact signup time.

---

## SECTION A — Signup, default trade, seeding, copilot (NEW since last tier test)

### A1 — Sign up + choose default trade = **a Generic trade** (e.g. Landscaping)
1. Sign up fresh; complete onboarding.
2. **On the trade step, choose a non-roofing trade — `Landscaping`.**
3. **Pass:** Onboarding completes, lands in-app, trial banner visible. No roofing-specific assumptions leak into the UI.

### A2 — Copilot intro flow (generic-trade variant)
1. Step through the post-onboarding copilot intro.
2. **Pass:** Copilot appears + completes cleanly. Any trade-specific guidance reads correctly for a generic trade (not roofing-only wording). Flag steps pointing at renamed/missing buttons (e.g. the Drawings & Images rename).

### A3 — Starter components seeded (Roofing + Generic both)
1. **Components** → **Pass:** both **"Roofing"** and **"Generic"** collections exist, pre-filled (Roofing ~7, Generic ~9). *(Both seed regardless of chosen trade — intended.)*

### A4 — Chosen trade pre-selects on new quote
1. **New Quote** → **Pass:** **Landscaping** pre-selected; no roof-area/pitch requirement forced.

---

## SECTION B — Billing activation

### B1 — Upgrade to Professional via Stripe (+ session-persist check)
1. **Account → Billing** → upgrade → **Professional ($39/mo)** → Stripe Checkout with Card B.
2. After redirect, **wait 30–60s, sign out, sign back in.**
3. **Pass:** Billing shows **Professional — Active** + period end. NO feature gates anywhere. *(Confirms webhook persisted.)*

---

## SECTION C — Core Pro feature pass

### C1 — Generic trade quote (Landscaping)
1. **New Quote → Landscaping** → customer + job, no roof area required → builder.
2. **Pass:** Quote creates; no roofing-only fields shown.

### C2 — length_x_height pricing (H-02 live verification)
1. **Components** → create a component, measurement type **Length × Height**, height **2.4m**, rate **$25/m²**, waste none, pitch none.
2. Add to the Landscaping quote; enter length **10m**.
3. **Pass:** area = **24m²** (10 × 2.4), line subtotal **$600.00**. *(If you see 10m²/$250 the height multiplier broke — stop + report.)*

### C3 — Digital takeoff — single area
1. **New Quote** → pick a trade → **Digital takeoff** path → upload a plan image → draw ≥2 measurements → **Save & Continue to Components**.
2. **Pass:** Takeoff saves; measurements become component entries with correct values; canvas preserved on reload.

### C4 — Digital takeoff — MULTI-AREA / second takeoff (CARRIED-OVER BUG — last run = FAIL)
> Last run: opening a second digital takeoff **wiped the first area's data and mis-summed**. Intended behaviour: when a user with a saved takeoff starts another, they should be **asked**: add a **new area** (second page/plan upload) OR **add to the existing area** (new measurements stack ON TOP of the originals, never replace).
1. From a quote that already has a saved takeoff, start another takeoff.
2. **Pass:** User is prompted new-area vs add-to-existing; existing measurements are **retained**; new measurements **sum correctly** with the originals. *(This is a known failure — verify the fix or confirm still broken.)*

### C5 — Email send pipeline
1. Quote summary → **Send Quote → Send via QuoteCore+** → enter customer email → send.
2. **Pass:** Email arrives <2 min, sender `info@quote-core.com`, "View Quote" button → `https://app.quote-core.com/accept/<token>`, not flagged as spam.

### C6 — Email link hygiene / hyperlink system (CARRIED-OVER ENHANCEMENT — last run flagged)
> Last run: raw full-URL text links look unprofessional + risk spam flagging. Desired: a **drop-in hyperlink system** — user picks a system-generated URL (quote/order link), defines the **display text** (e.g. "Click Here"), and that anchor is inserted instead of a raw URL. Enforce at template creation AND when a user types a raw URL into a message (warn + offer the hyperlink tool).
1. In a template/message, attempt to paste a raw full URL.
2. **Pass (if built):** system warns about raw URLs + offers the hyperlink insert (URL + custom display text, URL limited to system-generated links). **If not built:** mark `[!]` — decide block vs ship-as-follow-up.

### C7 — Automated follow-up + Pro gating boundary (CARRIED-OVER BUG — last run = FAIL)
> Last run: the post-send follow-up prompt **did not appear** for Pro. Need to confirm whether follow-ups are a Pro feature or higher, then make the gating + prompt match.
1. After sending (C5), the post-send follow-up prompt should appear (if Pro is entitled).
2. Enable **No response**, delay **1 day**, pick a template, **Schedule selected**.
3. **Pass:** follow-up schedules + appears in Scheduled Messages with fire date ~1 day out. *(If Pro is NOT meant to have follow-ups, the prompt should be cleanly gated instead — confirm which is correct and that it behaves accordingly.)*

### C8 — Customer acceptance + suppress-on-accept
1. Open the C5 email → **View Quote** → URL `…/accept/<token>` → accept.
2. **Pass:** status → **Accepted**.
3. Scheduled Messages → force-run the no-response follow-up row.
4. **Pass:** row marks **Cancelled** ("Customer accepted the quote"); no email sent. *(Blocked last run by C7 — retest once C7 works.)*

### C9 — Activity card
1. Quote from C5–C8 → **Activity** tab.
2. **Pass:** full timeline: created → sent (recipient + ts) → accepted (ts). No blank/error.

### C10 — Material order create + send
1. Completed quote with components → create a material order → add ≥1 item, supplier name + email → send.
2. **Pass:** order saves + sends; supplier receives email; order in **Material Orders** with correct status.

### C11 — Material order action buttons (CARRIED-OVER BUG — last run = FAIL)
> Last run: the **Confirm Order** button on the order did nothing. All buttons tied to order URLs must do something real (e.g. confirm → alert/notify the user the order was received/confirmed; status updates). Will later tie into project-manager mode.
1. Open the order's public/supplier URL; click **Confirm Order** (and any other action buttons).
2. **Pass:** each button performs its action (confirm registers + notifies the owner; status reflects it). No dead buttons.

### C12 — Multiple component libraries in a quote
1. **Components** → create "Generic Trade Components" → add 2–3 generic-type components (volume, hours, etc.).
2. New quote → select that library → add its components.
3. **Pass:** library selection works; only that library's components show; totals correct.

### C13 — Default trade setting persists
1. **Settings → Company** → set default trade **Landscaping** → save.
2. New quote → **Pass:** Landscaping pre-selected.

---

## SECTION D — Dev-backlog features (PRE-VERIFIED on dev this session; RE-CONFIRM on live after merge)

### D1 — Attachments full feature **[PRE-VERIFIED dev]**
1. Attachment Library: upload / rename / archive / delete (delete-while-template-default + sent now works cleanly, frees storage, old links 404).
2. Set a template default attachment; send → link button in email (not MIME attachment); public page lists + View (inline) / Download (saves with correct **.pdf/.jpg/.png** extension) / Download all.
3. Post-decision page persists doc + status + accumulates follow-up attachments.
4. **Pass:** all of the above on live.

### D2 — Catalog Library + import **[PRE-VERIFIED dev]**
1. Import a CSV catalog (wizard: upload → name → preview/map → save).
2. In a quote (CustomerQuoteEditor + Blank Quote) use **Catalog Search** to add a line (desc + price + qty); Units toggle hides quantity; hyphenated descriptions not truncated.
3. **Pass:** catalog import + quote-line population work on live.

### D3 — Storage-red policy **[PRE-VERIFIED dev]**
> Already exhaustively verified on dev this session (boundary, red-blocks-all-uploads, quotes/components/drawings still work, catalog option-3 overspill, top-up threshold). Re-confirm only the headline on live:
1. Push the account near/over its real plan limit through normal use (or confirm via billing page).
2. **Pass:** over-limit blocks file uploads with banner + modal; non-file actions (quotes/components/drawings) still work; **"Manage storage" banner button renders on one line** (fixed `5ca8217`).

### D4 — Generic-trade Drawings & Images labelling **[PRE-VERIFIED dev]**
1. With a generic trade (Landscaping), open the **Drawings & Images** button on Components.
2. **Pass:** button + page + canvas all read **"Drawings & Images" / "Drawing/Image"** (NOT "Flashings"). Roofing accounts still read "Flashings".

### D5 — Drawing/Flashing create + save (the feature itself)
1. Create a drawing/image — draw ≥1 shape — save to library.
2. **Pass:** saves; appears in library; reopens for edit.

---

## SECTION E — Subscription management

### E1 — Cancel subscription + plan-card cancel + LIVE Stripe customer (CARRIED-OVER BUG — last run = FAIL on Pro)
> Last run on Pro: only "Manage subscription" (→ Stripe) could cancel; the plan card showed an unclickable "Your current plan" button; and the Pro account hit **"No such customer: cus_… a similar object exists in test mode but a live mode key was used"**. Starter worked. Desired: plan card shows **Current** (green) with a clickable **Cancel** that goes straight to the Stripe cancel page; live-mode customer must resolve.
1. **Account → Billing** → record the Stripe customer + subscription IDs.
2. Cancel via the **plan card** (clickable Cancel), and confirm "Manage subscription" also works.
3. **Pass:** plan-card Cancel is clickable + routes to Stripe cancel; **no "No such customer / test mode" error** (live key ↔ live customer); status → **Cancellation pending**, access until period end, banner visible.

---

## Summary checklist
- [ ] A1 Signup + default trade = Landscaping
- [ ] A2 Copilot intro (generic variant) works
- [ ] A3 Both Roofing + Generic collections seeded
- [ ] A4 Chosen trade pre-selects on new quote
- [ ] B1 Upgrade to Professional via Stripe (+ fresh-session persist)
- [ ] C1 Generic trade quote (Landscaping)
- [ ] C2 length_x_height pricing 24m² / $600 (H-02 live)
- [ ] C3 Digital takeoff — single area saves + reloads
- [ ] C4 Digital takeoff — multi-area / second takeoff (new-vs-add, no data loss, correct sum) **[known bug]**
- [ ] C5 Email send arrives from info@quote-core.com
- [ ] C6 Hyperlink system / raw-URL warning **[enhancement]**
- [ ] C7 Automated follow-up + Pro gating boundary **[known bug]**
- [ ] C8 Customer accepts + suppress-on-accept cancels follow-up
- [ ] C9 Activity card full timeline
- [ ] C10 Material order create + send
- [ ] C11 Material order action buttons do something (Confirm Order) **[known bug]**
- [ ] C12 Multiple component libraries in a quote
- [ ] C13 Default trade persists
- [ ] D1 Attachments full feature (live re-confirm)
- [ ] D2 Catalog library + import (live re-confirm)
- [ ] D3 Storage-red policy headline (live re-confirm; banner button one line)
- [ ] D4 Generic Drawings & Images labelling (live re-confirm)
- [ ] D5 Drawing/Flashing create + save
- [ ] E1 Cancel via plan card + live Stripe customer resolves **[known bug]**

---

## Notes / failures (fill in during run)
_(record per-item failures here with the test id)_
