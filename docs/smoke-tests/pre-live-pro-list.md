# Pre-Live Tier Test — PROFESSIONAL

> **Treat this as a go/no-go gate for production (real money, real customers).** If every item passes (or the failures are fixed), Pro + the whole `development → main` backlog is cleared to merge + go live.
>
> **URL:** https://app.quote-core.com (LIVE production) — *unless an item is explicitly marked DEV, for features not yet merged to main.*
> **Plan under test:** Professional ($39/mo) — **Card B** (real card, different from Card A; will be charged $39)
> **Persona:** A multi-trade contractor on the full-feature plan.
>
> **Status keys:** `[ ]` pending · `[x]` pass · `[!]` fail (note why) · `[~]` partial/needs retest
>
> **Priority labels:** **[SECURITY-BLOCKER]** security/data-isolation issue; blocks launch. **[BLOCKER]** correctness/revenue/customer-impacting issue; blocks launch. **[EVIDENCE-GATE]** not a manual step — Gavin must attach release evidence before merge. **[NICE]** should fix, does not block launch if core behaviour passes.
>
> **Reading this if you've never used the app:** Each test tells you what to click and what a PASS looks like — just follow the numbered steps. The security tests in Section D have a couple of "techy" actions (changing part of a web link, checking an account can't see another's data); each one spells out exactly what to type/click. Steps marked **(Gavin verifies)** are checked behind the scenes — you just report what you saw on screen.
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

### A1 — Sign up + choose default trade = **a Generic trade** (e.g. Landscaping) **[BLOCKER]**
1. Sign up fresh; complete onboarding.
2. **On the trade step, choose a non-roofing trade — `Landscaping`.**
3. **Pass:** Onboarding completes, lands in-app, trial banner visible. No roofing-specific assumptions leak into the UI.

### A2 — Copilot intro flow (generic-trade variant) **[BLOCKER]**
1. Step through the post-onboarding copilot intro.
2. **Pass:** Copilot appears + completes cleanly. Any trade-specific guidance reads correctly for a generic trade (not roofing-only wording). Flag steps pointing at renamed/missing buttons (e.g. the Drawings & Images rename).

### A3 — Starter components seeded (Roofing + Generic both) **[BLOCKER]**
1. **Components** → **Pass:** both **"Roofing"** and **"Generic"** collections exist, pre-filled (Roofing ~7, Generic ~9). *(Both seed regardless of chosen trade — intended.)*

### A4 — Chosen trade pre-selects on new quote **[BLOCKER]**
1. **New Quote** → **Pass:** **Landscaping** pre-selected; no roof-area/pitch requirement forced.

---

## SECTION B — Billing activation

### B1 — Upgrade to Professional via Stripe (+ session-persist check) **[BLOCKER]**
1. **Account → Billing** → upgrade → **Professional ($39/mo)** → Stripe Checkout with Card B.
2. After redirect, **wait 30–60s, sign out, sign back in.**
3. **Pass:** Billing shows **Professional — Active** + period end. NO feature gates anywhere. *(Confirms webhook persisted.)*

---

## SECTION C — Core Pro feature pass

### C1 — Generic trade quote (Landscaping) **[BLOCKER]**
1. **New Quote → Landscaping** → customer + job, no roof area required → builder.
2. **Pass:** Quote creates; no roofing-only fields shown.

### C2 — length_x_height pricing (H-02 live verification) **[BLOCKER]**
1. **Components** → create a component, measurement type **Length × Height**, height **2.4m**, rate **$25/m²**, waste none, pitch none.
2. Add to the Landscaping quote; enter length **10m**.
3. **Pass:** area = **24m²** (10 × 2.4), line subtotal **$600.00**. *(If you see 10m²/$250 the height multiplier broke — stop + report.)*

### C3 — Digital takeoff — single area **[BLOCKER]**
1. **New Quote** → pick a trade → **Digital takeoff** path → upload a plan image → draw ≥2 measurements → **Save & Continue to Components**.
2. **Pass:** Takeoff saves; measurements become component entries with correct values; canvas preserved on reload.

### C4 — Digital takeoff — MULTI-AREA / second takeoff (CARRIED-OVER BUG — last run = FAIL) **[BLOCKER]**
> Last run: opening a second digital takeoff **wiped the first area's data and mis-summed**. Intended behaviour: when a user with a saved takeoff starts another, they should be **asked**: add a **new area** (second page/plan upload) OR **add to the existing area** (new measurements stack ON TOP of the originals, never replace).
1. From a quote that already has a saved takeoff, start another takeoff.
2. **Pass:** User is prompted new-area vs add-to-existing; existing measurements are **retained**; new measurements **sum correctly** with the originals. *(This is a known failure — verify the fix or confirm still broken.)*

### C5 — Email send pipeline **[BLOCKER]**
1. Quote summary → **Send Quote → Send via QuoteCore+** → enter customer email → send.
2. **Pass:** Email arrives <2 min, sender `info@quote-core.com`, "View Quote" button → `https://app.quote-core.com/accept/<token>`, not flagged as spam.

### C5a — Send duplicate/idempotency behaviour **[BLOCKER]**
1. On Send Quote, double-click Send or retry quickly while the first send is in progress.
2. **Pass:** only one outbound message/email is created, or the second attempt is cleanly blocked with user-facing copy. No duplicate customer emails, duplicate activity rows, or duplicate attachment rows.

### C6 — Email link hygiene / hyperlink system **[NICE unless C5 deliverability fails]**
> Last run: raw full-URL text links looked unprofessional + risked spam flagging. This is **not launch-blocking by itself** if C5 deliverability passes and quote/order links work; it becomes blocking only if raw links materially hurt delivery or produce broken customer links. Desired: a **drop-in hyperlink system** — user picks a system-generated URL (quote/order link), defines the **display text** (e.g. "Click Here"), and that anchor is inserted instead of a raw URL.
1. In a template/message, attempt to paste a raw full URL.
2. **Pass (if built):** system warns about raw URLs + offers the hyperlink insert (URL + custom display text, URL limited to system-generated links). **If not built:** mark `[~]` and ship as follow-up unless C5 email delivery/link behaviour fails.

### C7 — Automated follow-up + Pro gating boundary (CARRIED-OVER BUG — last run = FAIL) **[BLOCKER]**
> **Expected entitlement:** Professional includes automated follow-ups. If product policy changes, update this test before running; do not leave this as an in-test decision. Last run: the post-send follow-up prompt **did not appear** for Pro.
1. After sending (C5), the post-send follow-up prompt should appear for Pro.
2. Enable **No response**, delay **1 day**, pick a template, **Schedule selected**.
3. **Pass:** follow-up schedules + appears in Scheduled Messages with fire date ~1 day out.

### C8 — Customer acceptance + suppress-on-accept **[BLOCKER]**
1. Open the C5 email → **View Quote** → URL `…/accept/<token>` → accept.
2. **Pass:** status → **Accepted**.
3. Scheduled Messages → force-run the no-response follow-up row.
4. **Pass:** row marks **Cancelled** ("Customer accepted the quote"); no email sent. *(Blocked last run by C7 — retest once C7 works.)*

### C9 — Activity card **[BLOCKER]**
1. Quote from C5–C8 → **Activity** tab.
2. **Pass:** full timeline: created → sent (recipient + ts) → accepted (ts). No blank/error.

### C10 — Material order create + send **[BLOCKER]**
1. Completed quote with components → create a material order → add ≥1 item, supplier name + email → send.
2. **Pass:** order saves + sends; supplier receives email; order in **Material Orders** with correct status.

### C11 — Material order action buttons (CARRIED-OVER BUG — last run = FAIL) **[BLOCKER if visible in live Pro]**
> Last run: the **Confirm Order** button on the order did nothing. All buttons tied to order URLs must do something real (e.g. confirm → alert/notify the user the order was received/confirmed; status updates). Will later tie into project-manager mode.
1. Open the order's public/supplier URL; click **Confirm Order** (and any other action buttons).
2. **Pass:** each button performs its action (confirm registers + notifies the owner; status reflects it). No dead buttons.

### C12 — Multiple component libraries in a quote **[BLOCKER]**
1. **Components** → create "Generic Trade Components" → add 2–3 generic-type components (volume, hours, etc.).
2. New quote → select that library → add its components.
3. **Pass:** library selection works; only that library's components show; totals correct.

### C13 — Default trade setting persists **[BLOCKER]**
1. **Settings → Company** → set default trade **Landscaping** → save.
2. New quote → **Pass:** Landscaping pre-selected.

---

## SECTION D — Dev-backlog features (PRE-VERIFIED on dev this session; RE-CONFIRM on live after merge)

### D1 — Attachments full feature **[PRE-VERIFIED dev] [BLOCKER]**
1. Attachment Library: upload / rename / archive / delete (delete-while-template-default + sent now works cleanly, frees storage, old links 404).
2. Set a template default attachment; send → link button in email (not MIME attachment); public page lists + View (inline) / Download (saves with correct **.pdf/.jpg/.png** extension) / Download all.
3. Post-decision page persists doc + status + accumulates follow-up attachments.
4. **Pass:** all of the above on live.

### D1a — Attachment privacy: customers only see THEIR file **[SECURITY-BLOCKER]**
1. In the Attachment Library, upload two files: name them clearly **"File A"** and **"File B"**.
2. Send a quote to your customer email with **only File A** attached.
3. Open the public quote link (the one in the email) in an incognito window.
4. **Pass:** you see **File A only**. File B is nowhere on the page and cannot be downloaded.
5. Click **Download** on File A and copy that download link from your browser's address bar.
6. In the copied link, change a few characters in the long code, then open it.
7. **Pass:** you get a plain "not found" page — no file downloads, no error/technical text, no other customer's file. *(Gavin verifies: response leaks no file path, company id, or "right token wrong file" hint, and links use `/api/attachments/...` not a raw storage URL.)*
8. Back in the library, **delete File A** (after it's been sent).
9. Re-open the customer's public quote link.
10. **Pass:** the old File A link now fails cleanly (plain not-found), it doesn't error out.

### D2 — Catalog Library + import **[PRE-VERIFIED dev] [BLOCKER]**
1. Import a CSV catalog (wizard: upload → name → preview/map → save).
2. In a quote (CustomerQuoteEditor + Blank Quote) use **Catalog Search** to add a line (desc + price + qty); Units toggle hides quantity; hyphenated descriptions not truncated.
3. **Pass:** catalog import + quote-line population work on live.

### D2a — Catalog privacy: one company can't see another's catalog **[SECURITY-BLOCKER] [EVIDENCE-GATE]**
*(Tester steps:)*
1. On this Pro account, import a catalog (any CSV).
2. Log out, then log into the **Starter** account from the other test.
3. Look in Catalog Library, and in a quote try **Catalog Search**.
4. **Pass:** the Starter account sees **none** of the Pro account's catalog or its rows anywhere.
*(Gavin verifies behind the scenes — EVIDENCE-GATE, must exist before merge:)*
5. DB permission evidence that catalog/storage import functions can be run only by the system roles (`postgres`/owner + `service_role`), never by `anon`, `authenticated`, or `PUBLIC`.
6. Catalog limits hold: Pro blocks the 4th catalog; Starter stays at 0.

### D3 — Storage-red policy **[PRE-VERIFIED dev] [EVIDENCE-GATE]**
Already exhaustively verified on dev this session (boundary, red-blocks-all-uploads, quotes/components/drawings still work, catalog option-3 overspill, top-up threshold). Do **not** force the normal live Pro walkthrough account over storage just for this tier journey unless using a prepared/admin-controlled test company.

**Pass before merge:** retain evidence that over-limit blocks attachment/catalog/quote-file/logo uploads server-side, while quotes/components/drawings still work, catalog option-3 overspill behaves as tested, and **"Manage storage" banner button renders on one line** (fixed `5ca8217`).

### D4 — Generic-trade Drawings & Images labelling **[PRE-VERIFIED dev] [BLOCKER]**
1. With a generic trade (Landscaping), open the **Drawings & Images** button on Components.
2. **Pass:** button + page + canvas all read **"Drawings & Images" / "Drawing/Image"** (NOT "Flashings"). Roofing accounts still read "Flashings".

### D5 — Drawing/Flashing create + save (the feature itself) **[BLOCKER]**
1. Create a drawing/image — draw ≥1 shape — save to library.
2. **Pass:** saves; appears in library; reopens for edit.

### D6 — Bad/guessed links stay safe under repeated tries **[SECURITY-BLOCKER for any data leak]**
1. Take a few of the app's public links — an `/accept/<token>` quote link, an attachment View/Download link, and a file link — and for each, change part of the long code so it's invalid.
2. Open each altered link a handful of times in incognito.
3. **Pass:** every time you get a plain "not found" / "expired" page (or a clean "too many requests"). You never see a customer name, company name, file name, or any error/technical text. *(Gavin verifies: no leak in any response.)*
4. **Launch rule:** ANY leak of real data blocks launch. A missing "too many requests" limit is only a follow-up, provided responses stay generic.

---

## SECTION E — Subscription management

### E1 — Cancel subscription + plan-card cancel + LIVE Stripe customer (CARRIED-OVER BUG — last run = FAIL on Pro) **[BLOCKER]**
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
- [ ] C5a Send duplicate/idempotency behaviour **[BLOCKER]**
- [ ] C6 Hyperlink system / raw-URL warning **[NICE unless deliverability fails]**
- [ ] C7 Automated follow-up + Pro gating boundary **[known bug]**
- [ ] C8 Customer accepts + suppress-on-accept cancels follow-up
- [ ] C9 Activity card full timeline
- [ ] C10 Material order create + send
- [ ] C11 Material order action buttons do something (Confirm Order) **[known bug]**
- [ ] C12 Multiple component libraries in a quote
- [ ] C13 Default trade persists
- [ ] D1 Attachments full feature (live re-confirm)
- [ ] D1a Attachment token isolation + fail-closed download gate **[SECURITY-BLOCKER]**
- [ ] D2 Catalog library + import (live re-confirm)
- [ ] D2a Catalog ACL / company isolation evidence **[SECURITY-BLOCKER] [EVIDENCE-GATE]**
- [ ] D3 Storage-red policy evidence retained (do not force normal live account over limit) **[EVIDENCE-GATE]**
- [ ] D4 Generic Drawings & Images labelling (live re-confirm)
- [ ] D5 Drawing/Flashing create + save
- [ ] D6 Public token abuse / rate-limit sanity **[SECURITY-BLOCKER for leaks]**
- [ ] E1 Cancel via plan card + live Stripe customer resolves **[known bug]**

---

## Notes / failures (fill in during run)
_(record per-item failures here with the test id)_
