# Smoke Test Checklist - LIVE

> Single source of truth for **what needs verifying on dev**. Gavin adds items when he ships; Shaun ticks them off. One line per item - detailed per-tier walkthrough scripts live alongside (starter / professional / storage-limit) and are referenced, not duplicated.
>
> **Status keys:** `[ ]` pending · `[x]` passed · `[!]` failed (note why) · `[~]` partial/needs retest
> Passed items move to **Passed (recent)** on the next update; stale ones pruned.
> Test env: `quotecore-plus-dev.vercel.app` (dev = one Supabase DB shared with main).

---

# PRE-MERGE RELEASE PASS - `development → main` (66 commits, baseline `8fac898` 2026-05-25)

> This merge ships the entire dev backlog to production. Verify the major features below on dev before sign-off. Gerald cleared the code; remaining risk is **behavioural/product-level**.

## A. Attachments - full feature (Phases 1-6 + post-smoke fixes #1-#5)
- [~] **Library** - Pro+ account: upload file to Attachment Library; rename; archive; delete. Non-Pro: library hidden/locked.
> DELETE CONSTRAINT ERROR: FIXED `9bdd7d6` + migration `20260602140000` (FK now ON DELETE CASCADE; Shaun option A). Hard delete now succeeds: frees storage, clears template default, removes historical send-records (old links 404 gracefully). Confirm copy updated. RETEST: delete a file that's set as a template default AND was sent on a quote - should delete cleanly with the new warning.
> ARCHIVED-COUNTS-STORAGE: already true (no change). Archive only sets archived_at; the file stays hosted and its bytes stay counted in storage_used_bytes. Bytes only freed on hard delete. Verify during storage pass.
- [x] **Template default** - set a default attachment on an email template; it pre-selects on send.
> Seems to work
- [x] **Template default change/clear (Gavin #1)** - GAVIN-VERIFIED (no Shaun test needed). Your mental model is correct: template default = no attachment; user opts in per-template only if they want auto-attach. This item just verified the edit/clear mechanics of that picker; confirmed in code, no stale default. Skip.
- [x] **Send with NO attachment (Gavin #2)** - normal send-quote flow with zero attachments selected still sends cleanly (regression after picker rework).
> Pass
- [x] **#1 Send picker** - Send Quote/Order modal: file list is a dropdown ("N files attached"), tickboxes inside, Clear works.
> Pass
- [x] **Send quote w/ attachment** - recipient email has the link button (NOT a MIME attachment); link opens the public quote page.
> Pass
- [x] **#3c View vs Download** - each attachment row: View opens inline (new tab); Download forces save-to-device.
> Pass
- [~] **#3a Download all** - public page with >1 attachment: "Download all" saves every file WITH correct extension (.pdf/.jpg/.png).
> FIXED `9bdd7d6` (download name now carries the real source-file extension). RETEST on dev: Download / Download all should save files with proper extensions + correct icons.
- [x] **#4 Post-decision page** - after accept/decline, the quote URL STILL shows doc + status banner ("You accepted on ..."), accept/decline DISABLED, Request Changes still works, attachments section persists + accumulates follow-up files.
> Pass
- [x] **Order attachments** - send order w/ library file; public order page lists + downloads it.
> Pass
- [x] **Standalone send (M-02)** - attachment-only message → `/file/<token>` page: View inline (images), Download saves to device.
> Pass
- [x] **Failed-send cleanup (H-01)** - GAVIN-VERIFIED (no Shaun test needed). Hard to trigger manually; cleanup logic confirmed in code. Skip.
## B. Catalog Library + import
- [x] **Import wizard** - upload CSV → name → preview/map columns → save; catalog appears.
> Pass
- [x] **Catalog search in quote** - CustomerQuoteEditor + Blank Quote: Catalog Search adds a line (desc + price + qty).
> Pass
- [x] **#5 Units toggle** - catalog line: toggle Units off hides the quantity; hyphenated descriptions NOT truncated; component lines unchanged.
> Pass
- [x] **Catalog tier gate (Gavin #3)** - `starter` (limit 0) cannot create a catalog; `pro` (limit 3) blocks the 4th. Entitlement path, separate from storage-red.
> Pass
- [x] **Red-state import gate (H-02)** - company already over storage CANNOT start a new catalog import (server-blocked, not just modal).
> Pass
- [x] **Catalog ACL (C-01)** - GAVIN-VERIFIED, no Shaun action. DB-permission check (only postgres/service_role can call the import RPC); evidence on file. Not a manual test. Skip.

## C. Storage-red policy
- [x] **Over-limit blocks uploads** - red company: catalog/attachment/quote-file/logo uploads all blocked w/ banner + modal across portals.
> Pass
> BOUNDARY PASS (2026-06-02): set used to 500KB-under limit, attempted 0.68MB attachment upload → blocked pre-commit with "Storage quota exceeded: ... would exceed limit". Confirms attachment/quote-file/logo uploads are gated BEFORE commit (assertCanUseStorage), not allowed to tip over. (Catalog import is the only allowed-to-overspill path - separate item.)
- [x] **Quote/component/drawing still work** - these use separate quotas, NOT blocked by storage-red.
> PASS (2026-06-02): while red, attachment/logo/quote-file/2nd-catalog-import all blocked; quote/component/drawing creation all still worked.
- [x] **Catalog import option-3** - an in-flight import may finish + push over (capped 10MB/catalog); company goes red after.
> PASS (2026-06-02): from 500KB-under, imported a 781KB CSV (6,590 rows) → import allowed to start, completed (catalog Ready), account flipped red afterward with banner. Banner CTA wrap fixed `5ca8217`.
- [x] **Top-up threshold (Gavin #4)** - company with a storage top-up is NOT flagged red below `limit + topup` (red triggers only past the combined threshold).
> PASS (2026-06-02): 100MB top-up, used=base+50MB → NOT red, upload allowed; bumped used past base+topup → red + uploads blocked. Confirmed effective limit = base + topup.

## D. Resource Library restructure
- [x] **/resources route** - old `/templates` links redirect to `/resources`; tabs (templates + attachments) all load.
> Pass
- [x] **Deep links (Gavin #5)** - GAVIN-VERIFIED (no Shaun test needed). Grepped old `/templates` links; all redirect to `/resources` + `?tab=` params preserved. Skip.
## E. Generic trades (flags already ON on main)
- [x] **Non-roofing quote** - create a quote in a generic trade; labels/flow correct.
> Pass
## F. Cross-cutting - auto-message attachment threading
- [x] **Auto-message baked attachment (Gavin #6)** - an auto/scheduled message (e.g. quote_sent chase) carries the template's baked default attachment via the resolver. Live data-model path no other item hits.

## G. Independent of merge gate (already on dev separately - fail here does NOT block the attachments merge)
- [ ] **Multi-page takeoff (P1-3, dev `e28cbff`)** - component area on Plan 2 (existing-area mode) records correctly (last known bug, fixed `e28cbff`, unconfirmed). Pass → clears takeoff gate.
- [x] **Email template hotfix (`9697519`)** - GAVIN-VERIFIED (no Shaun test needed). Rendering fix, confirmed in code. Rides the merge. Skip.
---

# GERALD MUST-TEST ITEMS
- [x] **Failed-send retry** - GAVIN-VERIFIED (no Shaun test needed). Hard to force a mid-send failure by hand; cleanup + retry-idempotency confirmed in code (same path as H-01). Skip.
- [x] **Attachment browser matrix** - Chrome, Safari, Firefox, and mobile: View opens inline where supported; Download saves to device with sane filename; Download all saves every file.
- [x] **Post-decision accumulation** - accepted/declined quote URL remains accessible; follow-up attachment sent after decision appears without re-enabling Accept/Decline.
- [~] **Storage-red edge UX** - already-red company is blocked from starting catalog, attachment-library, quote-file, and logo uploads server-side with clean user-facing copy.
> SHAUN TEST during storage pass: once I push your account red, try each upload (catalog / attachment / quote file / company logo) and confirm each is blocked with the banner + modal. Part of Bucket 3.
- [x] **Option-3 boundary** - import started while under limit may complete and turn account red; immediately starting a second import is blocked.
> Need your help to test
- [x] **Live ACL evidence retained** - GAVIN-VERIFIED, no Shaun action. Not a test - just confirms the evidence file is linked in merge notes (it is). Skip.
- [~] **Token isolation sanity** - quote/order/file attachment links from one company do not resolve for unrelated tokens or guessed `file` ids; failures return generic not-found.
> GAVIN-VERIFIED PASS (2026-06-02): hit dev download route with a random valid-format token + file id → generic 404, empty body, no existence leak. My job, done. No Shaun test needed.
---

## H. AI Assistant - Guide-me re-architecture (dev only, flag-gated; in the merge bundle but OFF on main via flags)
_Re-architected 2026-06-03 eve, dev 3cfbd60. Legacy Copilot fully removed; assistant is the sole helper. Core calibration CONFIRMED by Shaun. Remaining = confirmatory pass + items below._
- [x] **Ask-first** - Guide-me orients on current screen and ASKS what you want (no forced tour). Shaun confirmed.
- [x] **Cross-page routing** - a goal on another page routes you there (e.g. add a component to a quote, from Components). Shaun confirmed.
- [x] **Next / Back / Reset** - instant step nav; Reset re-syncs to real step (or asks if ambiguous). Shaun confirmed.
- [x] **Highlight release on click** - glow clears on any click incl. the target, stays cleared until step changes; Back→Next re-fires. Shaun confirmed.
- [x] **Finish** - last step shows Finish; clicking clears the guide bar + warm sign-off. Shaun confirmed.
- [ ] **Respond mode concise** - a how-to returns a tight summary (not a full dump) + offers Guide-me.
- [ ] **Facts auto-advance** - doing a step action on a tagged control advances the highlight without clicking Next.
- [ ] **Highlights OFF** - toggled off: assistant names the actual control (never the highlighted), no glow.
- [ ] **Read-only / no chatter** - only tells you what to click; never claims to act; no write-permission caveats volunteered.
- [ ] **No selectors leak** - (network) SSE highlight + guide_start carry only elementId / workflowId, never a CSS selector.
- [ ] **Security spot-check** - GET /api/assistant/workflow?id= resolves trade from session (not spoofable via query).
> Recommend a Gerald security re-audit of the rearchitecture before the development->main merge (read-only invariant, recentActions trust model, new workflow endpoint auth).
> App-side (NOT assistant): component-create on a read-only account shows a raw unexpected-response error - friendly-message catch later.

---

## Passed (recent)
_(empty - move items here as they pass)_

---

## Pending verification (dev - transient Read + Reset + On-Read trigger, 2026-06-10, commits 528b3a6..44d72cb)
  - [ ] **#1 Transient Read**: open a sent quote/order/invoice as the recipient so it shows "Read", then change the owner status (e.g. order Not Ordered -> Ordered; invoice -> Paid; quote -> Accepted). "Read" badge must DISAPPEAR on any status change (manual or auto), leaving just the owner's status. Action Required still wins when an action stamp exists.
  - [ ] **#2 Reset (orders + invoices)**: on a SENT order preview and a SENT invoice editor, click **Reset** -> confirm modal with the caution tooltip. After reset: the OLD public link is dead (404/expired), status is back to baseline (order Not Ordered / invoice Unsent-draft), all read/response/dispute stamps cleared, any pending follow-ups cancelled. Re-sending mints a NEW URL. Quote Withdraw/Reopen still works as before.
  - [ ] **#3 On-Read trigger**: in Send Quote/Order/Invoice -> Add follow-ups, pick **"On read (opened, no response)"**, set a short delay (e.g. 0d 0h 5m), save+send. The follow-up must stay PARKED (not fire) until the recipient OPENS the item; then it fires ~5 min after the open. If the recipient takes any action (accept/decline/request info/request changes/dispute) before it fires, the On-Read follow-up is CANCELLED. Verify for all three entities.

## Pending verification (dev - followups unblock + bell decouple + invoice templates, 2026-06-10, commit `abdd25b`)
  - [ ] **#2 Order + Invoice follow-ups save (was: trigger_event check-constraint violation)**: in **Send Order -> Add follow-ups**, build the max 3 rules (e.g. a triggered "Order accepted", a time-based chase, a triggered "Order declined") and click **Save follow-ups & send** -> saves with NO "violates check constraint scheduled_messages_trigger_event_check" error. Then verify firing one event (supplier accepts) cancels the opposing/other rules. Repeat for **Invoice** follow-ups (time-based) - also saves cleanly now.
  - [ ] **#1 Bell vs Message Center are decoupled**: with several unread (orange) alerts in the Message Center, open the bell and click **Clear alerts** -> bell empties, BUT the Message Center alerts keep their unread/orange highlight and folder exactly as before (clearing the bell must NOT mark anything read in MC). Also: clicking a bell row just navigates - it does not change the MC read state.
  - [ ] **#3 Invoice send/follow-up uses MESSAGE templates**: with existing message templates (e.g. quote_send ones) and only a header/payment Invoice template, open **Send Invoice** -> your message templates now appear in the template picker (no false "no templates"); **Add follow-up** lists the same message templates; the "create a template" link goes to **Message Templates** (Resources > Message/email tab), NOT Invoice Templates. Follow-ups must never require an invoice_template doc.

## Pending verification (dev - MC badge/clear/full-text + page-aware PDF, 2026-06-10, commit `93c25d3`)
  - [ ] **#1 Action-Required badge resets**: open a dispute on an invoice (and a change/info request on an order, and a revision request on a quote) so each shows the amber "Action Required" badge. (a) **Cancel** the invoice -> badge gone; **withdraw** the quote -> badge gone. (b) In **Message Center**, mark the dispute/revision/info alert **Done** -> the badge on the matching list row clears (invoice returns to Sent, order stamps cleared, quote revision resolved).
  - [ ] **#2 Bell clear is non-destructive**: bell now has ONE action, **"Clear alerts"** -> it only marks the bell's alerts read (bell empties), but every alert STILL appears in Message Center (Active). Confirm a "View all in Message Center" link sits at the bottom of the bell dropdown. Only **Archive -> Delete** in MC permanently deletes.
  - [ ] **#3 Full message in alerts**: open a dispute leaving a Reason AND a separate comment -> the MC alert, when expanded, shows BOTH (Reason + full Message, multi-line). Same for an order **Request Info** (full supplier message) and a quote **Request Revision** (full notes, not truncated at ~200 chars).
  - [ ] **#4 Page-aware PDF (no split items)**: bulk-download multi-page orders (single AND double column) with flashing diagrams -> NO diagram/line/image is split across a page break; any item that wouldn't fit moves whole to the next page, A4 margins respected. Spot-check the same on multi-page quotes and invoices. Verify a single oversized block (e.g. one giant table) still renders (it's the only thing allowed to span pages).

## Pending verification (dev - follow-up MINUTES + html2canvas single-quote PDF, 2026-06-09)
  - [ ] **Follow-up minutes granularity + preview-faithful single-quote PDFs** (2026-06-09): in **Send Quote -> Send from QuoteCore+ -> Add Follow-ups**, both the **Triggered** (with "Add time delay" ticked) and **Time-based** rule blocks now show a **# minutes** input (0-59) beside days/hours; a triggered "fires when customer declines" rule set to 0d/0h/10m schedules the follow-up ~10 minutes after the decline (verify the parked row stores pending_wait_minutes=10 and activates correctly); a time-based 0d/0h/30m is now ACCEPTED (no longer rejected as "Pick a delay greater than zero"). Separately, the owner **Download PDF** on a quote customer page AND the summary **Download PDF** icon now capture the on-screen preview via html2canvas (oklch/lab colours handled, company logo loads, multi-page slicing for long quotes) so the downloaded PDF is a pixel match of the preview - confirm a multi-page quote with a logo renders correctly and isn't blank/clipped.

## Pending verification (dev - invoice share-link send + Read robustness + list layout, 2026-06-09)
  - [ ] **Pre-send follow-up gate + mutual-cancel across 3 triggers** (2026-06-09, Phase A): on a quote summary, **Send Quote -> Send from QuoteCore+**, compose, click **Continue** -> a pre-send gate shows two choices. **Send now** ("No follow-ups needed") sends the quote with NO follow-up prompt afterwards. **Add Follow-ups** ("Then send") opens a builder where you can add up to 3 rules: **Triggered** (Quote accepted / declined / Dispute-change-requested, optional "Add time delay" else fires immediately) and **Time-based** (chase with days/hours delay, cancels on reply); one rule per trigger (a used trigger shows "already added"). Confirm -> rules persist then the quote sends. Then verify mutual-cancel: park accepted + declined + revision rules on a quote, have the customer ACCEPT -> the accepted rule activates and BOTH the declined and revision parked rows are cancelled (reason "...other trigger follow-ups no longer needed."); repeat with a customer DISPUTE/revision-request -> revision rule activates, accepted+declined parked rows cancelled. Existing accept/decline follow-ups must still fire. Also: inbox **Settings** per-event (per-line) toggles are visibly ~30% smaller than the channel master toggles and animate on/off correctly at both sizes.
  - [ ] **Per-event EMAIL notification toggles** (2026-06-09): inbox **Settings** tab now shows TWO toggles per event — **In-app** (orange) + **Email** (blue) — with per-surface channel masters. Email defaults ON only for Quote Accepted, Re-quote Requested, Order Accepted, Order Info Requested, Invoice Disputed; OFF for all others (declines, all Read/Viewed, payment-reported). Verify: toggling an event's Email OFF stops only that email (in-app alert + status still fire); a dispute/accept/info-request now emails all company users when its blue toggle is on; order/invoice/read events that previously sent no email now send a generic branded email when enabled; the Account → Notifications email master is GONE (tab now only hosts Chat Assistant); legacy companies with bare-boolean prefs still load with correct in-app state + email defaults.
  - [ ] **Message Center notification matrix** (2026-06-09): inbox **Settings** tab now shows three channel cards (Quotes / Orders / Invoices), each with an "All <channel> alerts" MASTER toggle + per-event child toggles (all default ON; ON = notify me). Orders shows ONE "Supplier Response" event (not separate accept/decline/request-info); Invoices has NO request-info event. Turning a master OFF greys+disables+turns off its children; turning it back ON re-enables all children. Toggling an event OFF means that event's owner alert is NOT created, while the underlying status (Read/Accepted/Paid/Viewed/etc) STILL updates. Verify each of the 3 "Read" toggles independently gates its channel's Read alert, and the Account -> Notifications email-copy toggle is untouched.
  - [ ] **Notification matrix corrections** (2026-06-09): Orders channel now shows FOUR events - **Accepted / Declined / Info Requested / Read** (the old single "Supplier Response" is gone); a supplier accepting/declining/requesting-info on a sent order creates the matching distinct alert (title "Accepted / Declined / Info Requested - <supplier>"), each independently gated by its own toggle, while the order's lifecycle stamps (confirmed/declined/info-requested) + response row ALWAYS save even with the toggle OFF. Invoices channel now shows only THREE events - **Payment Made / Dispute Opened / Read** (the "Paid" toggle is removed; the invoice_paid alert still fires as before, just no longer user-configurable). Confirm all new Order alerts route to the material-order preview with the blue "Order" badge, and any historical "Supplier Response" (order_supplier_response) alerts already in the DB still render + route correctly (back-compat).
  - [ ] **Invoice share-link = Sent, Read activates, list layout** (2026-06-09): on a DRAFT invoice click **Customer View** in the editor -> status flips to **Sent** + an "Invoice Sent" alert is created (no email); recipient opens public `/invoice/<token>` -> status flips to **Viewed/Read** (+ Read alert if Notify-on-view ON) -> dispute -> **Action Required**. Invoices list now has column headers **Invoice Number | Client/Job | Value | Status | Last Activity** (Status in its own column beside Last Activity), **New Invoice** button on the right, header columns line up with rows.

## Pending verification (dev - #5 in-app plan upgrade/downgrade, 2026-06-08, commit `91eedde`) - STRIPE TEST MODE
- [ ] **Message Center Phase 3+4 (recipient statuses + breadcrumb + inbox settings)** (2026-06-09): open an item from the inbox/bell -> destination "Back" returns to `/inbox` (`?from=inbox`); recipient opening a quote/order/invoice public link stamps **Read** in that list's Status column (server-action POST, not a GET); a dispute (invoice) or change/info request (order) or pending revision (quote) shows **Action Required** (NOT "Action Needed"); Invoices list Status is now the same dropdown as Orders/Quotes; inbox **Settings** tab toggles "Notify me when recipients open (Read)" (status updates regardless; toggle only gates the Read alert).
- [ ] **Message Center alert rows (expand-in-place)** (2026-06-09, `145cb8a`): collapsed rows are single-line; clicking a row expands it (full message) + marks read; `Open <type>` button only inside the expanded view and deep-links to the right quote/order/invoice (no 404); link-less alerts show Dismiss only. Bell dropdown: clicking an order/invoice alert opens the correct item (not a quote 404); alert with no FK falls back to `/inbox`.
> Requires a company with an ACTIVE test-mode Stripe subscription. Use a Stripe test card (4242 4242 4242 4242). Verify on the dev preview, NOT locally (no Stripe keys in local env).
- [ ] **Upgrade now**: as an active Starter subscriber, click a higher tier (e.g. Growth) -> confirm modal says "Upgrade" + shows the **discounted** price (e.g. $29, not MSRP $60) -> confirm -> redirected with "Plan upgraded" banner; within seconds the Current pill moves to the new tier; Stripe test dashboard shows a prorated charge.
- [ ] **Downgrade scheduled**: as an active higher-tier subscriber, click a lower tier -> modal says "Switch ... at period end", no immediate charge -> confirm -> "Plan change scheduled" banner; Stripe shows a Subscription Schedule with the price change at period end; Current pill stays on the existing tier until the period rolls.
- [ ] **No double-subscription**: after an upgrade, Stripe test dashboard shows ONE subscription (item swapped), not two.
- [ ] **Price shown is the launch price** everywhere in the flow (card, confirm modal) - never the strikethrough MSRP as the charge amount.
- [ ] **Portal still does cancel/card only**: "Manage subscription" opens the Stripe portal for cancel + card update (no longer the plan-switch path).
- [ ] **Guards**: trying to "switch" to the current plan, or with a winding-down/canceled sub, is rejected cleanly (no Stripe call error surfaced as a crash).

---

## Pending verification (dev - starter-test fixes, 2026-06-08, commit `223e189`)
- [ ] **#1 Seed components (THE bug)**: sign up a NEW company as **Roofing** -> Components page shows the 8 Roofing starter components (not zero). Sign up another as a **generic trade** -> shows the 9 Generic starter components. (Root cause was the tier cap rolling back the seed; now seeded via cap-bypass RPC, trade-aware.)
- [ ] **#1 Cap still enforced for users**: on a Starter/trial company, after seed, manually adding components past the limit (10) is still blocked with the limit message (seed bypass must NOT disable the user cap).
- [ ] **#2 Remove line (customer quote editor)**: red **X** top-right of each line row -> ConfirmModal -> line is fully removed (not just hidden). Confirm order + invoice editors still remove cleanly too.
- [ ] **#3 Pencil edit quantity + dash (customer quote + line-by-line order)**: add a custom line with a quantity; pencil-edit from preview -> Quantity field is editable; clearing it removes the “description — quantity” dash entirely; editing description and price still work.
- [ ] **#4 Extras tooltip**: Quote Builder -> Extras phase shows the info note pointing to the customer quote editor for fully custom extra lines.
- [ ] **#6 Highlights pill**: Guide-me toggle -> OFF = grey track + white knob left; ON = **orange** track + white knob slides right (no blue).

---

## Pending verification (dev - help docs + Guide-Me coverage, 2026-06-05)
- [ ] **New help docs render** (`26dbb9c`): on `quotecore-plus-dev.vercel.app/docs`, the sidebar shows new sections **Catalog Library**, **Attachments**, **Follow-ups**, plus new pages under **Material orders** (Order layouts / Line-by-line editor / Order from a quote) and **Help** (Meet Q / Guide Me / rewritten Chat Assistant). Each page opens, MDX/Callouts render, internal cross-links resolve (no 404).
- [ ] **Help-drawer context mapping**: opening the in-app help drawer (`?`) on the Catalogs, Attachments, and Order-from-Quote screens opens the matching new doc, not the index fallback.
- [ ] **Q answers from new docs** (embed-docs ran, 127 chunks): ask Q (Respond mode) "how do I upload a catalog?", "how do I attach a file to a quote?", "how do automated follow-ups work?" → answers cite/draw from the new docs.
- [ ] **Wizard row-cap copy** (`ac7a575`): catalog upload wizard text now reads **35,000 rows** (was 20,000) in both spots.
- [ ] **Content proofread**: Shaun final read of the published pages for any wording tweaks (drafts were `docs/DRAFT-docs-additions-2026-06-05.md`).
- [x] **(Now wired) Guide-Me flows**: the 5 new walkthroughs ARE now wired into `guides.generic.ts` + `intents.ts` (`367dbfe`) with 20+ `data-copilot` anchors. See the dedicated nav + Guide-Me section below for the full test pass.
- [ ] **Guide-Me UX round 2** (`89c0140`, 2026-06-07): (1) **Nav single-click** — with a nav highlight glowing, clicking Quotes/Orders/Resources navigates on the FIRST click (was double-click). (2) **Markdown renders** — guide step bubbles show emphasis as italic/bold, no raw `_underscores_` or `**asterisks**` (re: "Order items panel"). (3) **catalog-add-to-quote** — from an unrelated page: Go to Quotes -> Open a quote -> Open Customer Quote tab (or Create customer quote) -> click edit pencil -> then the existing Add-New-Line steps; flows end-to-end. (4) **Line-by-Line card highlights** — custom order -> the "Line by Line" layout card actually glows when Q says it's highlighted. (5) **Attachments split**: ask Q *"how do I send a quote with an attachment"* -> NEW flow (quote summary -> Send Quote -> Add attachment picker), NOT the library-upload flow; ask *"how do I upload a file to my attachment library"* -> the upload flow (Resources -> Attachments -> Upload file).
- [ ] **Guide-Me nav-hop parity** (`af4ff28`, 2026-06-07): all 4 non-catalog flows now match the catalog flow's nav-hop behaviour. Launch EACH from an unrelated page (e.g. an open quote) and confirm the synthetic nav hop highlights + behaves like catalog: **catalog-add-to-quote** now shows a highlighted "Go to Quotes" hop (was missing entirely) -> click Quotes -> press Next; **attachments-send** "Go to Resources" hop AUTO-advances on landing (no manual Next); **order-line-by-line** + **order-from-quote** "Go to Orders" hop AUTO-advances on landing. After the hop, steps proceed individually as before.

## Pending verification (dev - navigation + Resources hub + Guide-Me flows, 2026-06-05)

> Commits: Part A nav `ec6b100`, Guide-Me anchors+flows `367dbfe`, Part B Resources hub `6932d8a`. Assistant is dev-only (flag-gated); these need the AI Assistant ON (it is on the dev project).

### N. Navigation changes (Part A)
- [ ] **Nav order + labels**: main nav now reads **Components · Quotes · Orders · Resources**. "Material Orders" is renamed **Orders**; a new **Resources** item appears. Active-pill highlight follows the page you're on (no false highlight of Resources when on Orders, etc.).
- [ ] **Orders link still works**: clicking **Orders** lands on the material-orders hub (same page as before, just renamed). Pro-gating unchanged: on a non-Pro account the Orders item still shows the lock + upgrade modal.
- [ ] **Resources link works**: clicking **Resources** opens the new `/resources` cards hub.

### O. Resources cards hub (Part B)
- [ ] **Hub renders as cards**: `/resources` shows 8 cards styled like the dashboard (icon tile + title + description, orange hover glow), NO tab bar. Cards: Components, Drawings & Images, Catalogs, Attachments, Quote Templates, Quote Header Templates, Message Templates, Order Header Templates.
- [ ] **Redirect cards**: **Components** card → `/components` (existing page); **Drawings & Images** card → `/flashings` (existing page). Both load their real pages unchanged.
- [ ] **Sub-route cards — each opens its own URL with ONLY that section, no tab bar, page title = section name:**
  - Catalogs → `/resources/catalogs`
  - Attachments → `/resources/attachments`
  - Quote Templates → `/resources/quote-templates`
  - Quote Header Templates → `/resources/quote-header-templates`
  - Message Templates → `/resources/message-templates`
  - Order Header Templates → `/resources/order-header-templates`
- [ ] **Section content intact**: inside each sub-route the existing UI works exactly as before (create/edit/delete templates; upload/rename/archive catalogs + attachments; Pro-gating + storage limits still enforced). Nothing about the panels changed — only the wrapper.
- [ ] **Back button**: each sub-route has a Back button returning to the Resources hub. Hub itself has NO back button (it's a top-level destination).
- [ ] **Back-compat redirects**: visiting old links `/resources?tab=catalogs`, `?tab=attachments`, `?tab=quote`, `?tab=customer`, `?tab=email`, `?tab=order` each 302-redirect to the matching new sub-route (no 404, no dead tab page). The dashboard "Resource Library" card (→ `/resources`) still works.
- [ ] **Help drawer per section**: the `?` help icon on each sub-route opens the right doc — Catalogs→Catalog overview, Attachments→Attachment overview, Message Templates→Email templates, Order Header Templates→Supplier templates, etc.

### P. Guide-Me flows (the 5 new walkthroughs) — run each in **Guide me** mode with **Highlights ON**
- [ ] **Flow 1 — Upload & Map a Catalog**: ask Q "how do I upload a catalog?" (or start on `/catalogs`). Steps highlight in order: Upload catalog btn → drop zone → name input → column-map section → multi-maps note → Save catalog. Each highlight lands on the correct element; Next/Back/Finish work; highlight releases on click.
- [ ] **Flow 2 — Add a Catalog Item to a Quote**: from inside a customer quote editor. Steps: (nav prompt) → **+ Add New Line** btn → **Search catalog** tab → search input → results → Save and Return. Highlights land correctly. _(Q narrates the nav into a specific quote; it can't deep-link an arbitrary quote — expected.)_
- [ ] **Flow 3 — Attach & Send Files**: Steps: **Resources** nav → **Attachments card** (on the hub) → Upload file btn (on `/resources/attachments`) → (nav to a quote) → Send Quote → attachment picker → send mode. The re-pointed Attachments **card** highlight (not the old tab) is correct.
- [ ] **Flow 4 — Build a Line-by-Line Order**: Steps: **Orders** nav → Custom Order card → layout picker → **Line by Line** card → Order items panel → + Add New Line → line controls → Footer → Taxes. Highlights land; layout-picker + line-by-line editor anchors resolve.
- [ ] **Flow 5 — Create an Order from a Quote**: Steps: **Orders** nav → **Order from Quote** card → layout picker (Line by Line) → quote list → **Create Order** confirm btn → supplier header form → Save Order. The confirm button highlight matches the real **"Create Order"** label.
- [ ] **Intent routing**: typing natural phrases routes to the right flow — e.g. "add a catalog item to a quote", "attach a file to a quote", "turn a quote into a material order", "build a line by line order".
- [ ] **No stale anchors / console errors**: stepping through all 5 flows produces no "element not found" highlight failures and no console errors. Highlights release on any click (dismissedKeyRef) and the last step shows **Finish**.

## Pending verification (dev - line-by-line order UX + collapsible panels, 2026-06-05)
- [ ] **Order-from-quote → line-by-line populates** (`67779c0`): create order from a quote choosing the Line-by-Line layout → editor pre-fills priced lines (lines + prices + descriptions, matching the customer quote) + footer; **tax starts EMPTY by default** (user opts in). Reference pre-filled `Order for <n>`. Custom blank line-by-line still starts empty (untouched).
- [ ] **Order-from-quote repeat save** (`b3e61e2`): save an order from the SAME quote twice → 2nd gets `ON-<n>-2` suffix, NO "Failed to save" error. Also: two custom orders back-to-back get consecutive numbers (no spurious `-2`, `3157462`).
- [ ] **Hide-all-prices persists** (`5dcd23f`): tick "Hide all prices" beside Order items → Save → saved order, public/sent page, and Print/PDF all show ZERO pricing (no per-line price, subtotal, tax, total, Price header blank). Untick = per-line prices as set. Works on both new + edited orders.
- [ ] **Line-by-line scroll + width** (`67779c0`→`57c61ae`): footer + taxes reachable by scrolling on any screen ratio; body lines up with full-width header; preview is the wider section; header is a rounded card.
- [ ] **Collapsible panels — all editors** (`c2b16cc`→`8bf3a7a`): line-by-line order, components/column order, customer quote, AND labor sheet — click `«` to collapse the left controls → preview smoothly fills the space; expand tab (top-left, vertical label) returns to original dims. Header-collapse + panel-collapse work together. **Quote/labor: collapse preview is dominant when expanded.** Saving with a panel collapsed changes nothing (verified in code: save keyed to isDirty / data only; panelCollapsed is isolated layout state).
- [ ] **Order editor tip** (`8bf3a7a`): both order editors show "Tip: to view the full preview with header, save, then view order." next to the preview label.

## Pending verification (dev - line-by-line orders + catalog UX, 2026-06-04)
- [ ] **Customer Quote Editor — unified "Add New Line" modal (Phase 1)** (`20b14f9`): under Components & Items there is now ONE "+ Add New Line" button (replaced the old Add Custom Line + Search Catalog pair). Clicking it opens a modal with 3 tabs:
  - **Custom line**: Description (text) + Quantity/detail (text) + Price (number) → adds line + shows in preview.
  - **Add a component**: Library dropdown (All + each collection) → Component dropdown (filtered, default All) → "Add to Quote" → line lands with component NAME only, qty + price blank, editable via the right-side pencil.
  - **Search catalog**: opens the existing catalog search (unchanged) → add row works as before.
  Verify all 3 paths add correctly, preview updates, save persists. (Phase 2 = clone this editor into the orders line-by-line flow — not yet built.)
- [ ] **Takeoff component-add library selector** (`117bde2`): in a quote's takeoff panel, the Available components section shows a "Library" dropdown when collections exist. "All components" lists every company component (rows show `· LibraryName` suffix); selecting a named library filters to just that library's components. Defaults to the quote's pinned library if set, else All. Empty library shows "No components in this library."
- [ ] Catalog upload preview: no "first row contains titles" toggle; shows `COL A` + title (when present); no duplicate letters; same in Maps tab + mapping dropdowns. (commits `d11c396`,`51e16c5`)
- [ ] Assistant chat panel ~25% shorter. (`d11c396`)
- [ ] **Line-by-line order SAVE now works** (was failing pre-`0d8f047` due to layout_mode CHECK constraint; migration `20260604180000` applied). Create line-by-line order → add lines → Save → appears in orders list → reopen edit (lines rehydrate) → `/preview` + public token page + Print/PDF show priced table + header + correct currency.
- [ ] **Line-by-line order editor — Phase 2 parity** (`f96825c`): pick "Line by Line" from the orders layout picker → editor shows: (1) header card with **Order Template dropdown** (selecting one pre-fills To/From/Ref/etc.) + To/From/Ref/Date/Notes; (2) **"+ Add New Line" modal** with 3 tabs — Custom line (desc+qty+price+show-price), Add a component (Library dropdown → component, lands name-only), Search catalog (live search → adds line); (3) left list per-line Show/Price/In-total toggles + reorder ▲▼ + Remove; (4) right preview **pencil edit** per line (text+price+show-price); (5) **Footer** free-text; (6) **optional Taxes** (default none — add custom tax OR tick a company default; subtotal/tax rows/total appear). Save → orders list → reopen edit (lines+footer+taxes rehydrate) → `/preview` + public token page + Print/PDF all show priced table + footer + tax lines + correct currency. Verify legacy line-by-line orders (saved pre-`f96825c` as a bare array) still render (back-compat envelope parse).

## Pending verification (dev — Invoice System MVP, 2026-06-07, commit `4c00a21`)
- [ ] **Nav: Invoices tab** — visible between Quotes and Orders in the workspace nav. Clicking navigates to `/invoices`.
- [ ] **Invoice Library empty state** — fresh account shows empty state with "No invoices yet" + "New Invoice" CTA.
- [ ] **Create blank invoice** — click New Invoice → Blank Invoice → enter customer name (+ optional email) → Create → lands on invoice editor with correct INV-YYYY-NNNNNN number and QCP-INV-YYYY-NNNNNN payment reference.
- [ ] **Create from quote** — click New Invoice → From a Quote → search + select a quote → Create → invoice editor pre-populated with customer name, branding (cq_* fields), and line items imported from customer_quote_lines (visible lines only).
- [ ] **From Job disabled** — "From a Job" option is disabled/greyed with "Coming soon" tooltip.
- [ ] **Invoice editor: add custom line** — Add Line Item → Custom tab → fill title/qty/unit/unit price → Add → line appears in left panel + live preview updates. Line total = qty × unit price.
- [ ] **Invoice editor: catalog line** — Add Line Item → Catalog tab → pick catalog → pick row → set qty/price → Add → line in preview.
- [ ] **Invoice editor: inline edit** — click pencil on a line → inline form → edit title/description/qty/unit price → line total recalculates → Done.
- [ ] **Invoice editor: reorder lines** — ▲▼ arrows move lines; preview updates order.
- [ ] **Invoice editor: hide price** — uncheck "Show price" on a line → preview shows "—" for that line's price/total.
- [ ] **Invoice editor: Details tab** — set invoice date, due date, notes, terms; preview reflects all changes.
- [ ] **Invoice editor: Business Details** — click Edit → fill company name/address/email/phone/footer → Apply → preview header updates.
- [ ] **Invoice editor: save** — click Save → "Saved" indicator → reload page → all lines + metadata persist.
- [ ] **Invoice editor: auto-save** — make a change → wait 2s → "Saved" appears without clicking Save.
- [ ] **Invoice totals** — subtotal in left panel and preview equals sum of visible show-price lines.
- [ ] **Public invoice view** — open Customer View link from editor → `/invoice/<token>` renders: business header, customer block, line items table, totals, payment instructions with payment reference + copy button.
- [ ] **Payment Sent flow** — on public view, click "Payment Sent" → optional message → Confirm → status on library changes to "Payment Reported"; alert fires in the app.
- [ ] **Confirm Payment Received** — on editor with status payment_reported, click "Confirm Payment" → invoice status → Paid.
- [ ] **Dispute flow** — on public view, click "Dispute Invoice" → fill name/reason/message → Submit → invoice status → Disputed; alert fires in app.
- [ ] **Invoice Activity tab** — editor Activity tab shows: created, edited, viewed, payment_reported entries with timestamps.
- [ ] **Cancel draft** — three-dot menu on library row → Delete Draft → removed from list.
- [ ] **Cancel sent invoice** — three-dot menu → Cancel Invoice → status → Cancelled; public view shows "Invoice Not Found".
- [ ] **Status filter tabs** — filter by Paid / Disputed / etc. shows correct subset.
- [ ] **Search** — search by customer name or invoice number filters correctly.
- [ ] **Invoice number uniqueness** — create 3 invoices → each gets a unique sequential number (INV-YYYY-000001, -000002, -000003).

## Pending verification (dev - Send Invoice phase, 2026-06-07)
- [ ] **Send Invoice — Send from QuoteCore+** — open invoice editor → click Send Invoice → "Send from QuoteCore+" → enter recipient email → fill subject/body → Send Invoice → invoice status updates to Sent; Activity tab logs "sent" event; in-app alert fires.
- [ ] **Send Invoice — Copy URL** — Send Invoice → Copy URL Link → paste into browser → `/invoice/<token>` opens customer public view.
- [ ] **Send Invoice — Generate Email** — Send Invoice → Generate Email → subject/body pre-filled (with template if one exists) → Copy Email copies both.
- [ ] **Send Invoice — entitlement gate** — Starter plan (no email send): Send from QuoteCore+ shows plan-gate error; Copy URL still works.
- [ ] **Send Invoice — invoice_send template** — create an email template with kind=invoice_send in Resources → Templates; it appears in the send modal dropdown and placeholders {{invoice_number}}, {{invoice_total}}, {{invoice_link}}, {{due_date}} all substitute correctly.
- [ ] **Send Invoice — suppression** — send to a suppressed email → shows "blocked" message, invoice status stays draft.
- [ ] **Send Invoice — hidden on paid/cancelled** — Send Invoice button absent on paid + cancelled invoices.

## Pending verification (dev - Orders/Invoices bulk multi-select, 2026-06-09)
- [ ] **Orders & Invoices bulk multi-select** - on both the Orders and Invoices lists: header "select all visible" + per-row checkboxes select up to 25 (cap notice past 25); "Download N as ZIP" produces one ZIP of per-item PDFs; "Delete Selected" opens a ConfirmModal then deletes (orders: any; invoices: drafts only, non-drafts skipped with a count); selection clears after each action; Quotes list still works unchanged.

## Pending verification (dev - PDF pixel-match downloads, 2026-06-09)
- [ ] **PDF == on-screen preview (single + bulk)** - eyeball that downloads are a pixel match of the preview: (a) Quotes bulk ZIP -> each `Quote-####-Name/01-Customer-Quote.pdf` matches the customer-edit QuotePreview (logo, lines, totals, footer) and `02-Labour-Sheet.pdf` appears only when a visible labour sheet exists; (b) Orders bulk ZIP + owner Order Preview "Download PDF" both match the OrderBody (TO/FROM, flashing images, line-by-line/components layout, totals); (c) Invoices bulk ZIP + owner invoice editor "Download PDF" both match the InvoicePreview (dark header, meta bar, line table, payment box) with NO recipient action forms/buttons; (d) 25-cap + progress modal + best-effort (one bad item doesn't abort the ZIP) still work on all three lists; (e) public window.print() buttons on /accept/[token] + /orders/[token] are unchanged. Watch specifically for: company-logo CORS taint (Supabase public URLs should be fine; a tainted canvas would blank the logo or throw — caught per-item) and long multi-page orders/invoices slicing across A4 pages correctly.

## Pending verification (dev - Order follow-ups, 2026-06-09)
- [ ] **Order follow-ups (send-time gate + engine)** - Order Preview -> Send Order -> Send from QuoteCore+ -> Continue shows the pre-send gate: "Send now" sends with no follow-ups; "Add Follow-ups" lets you add up to 3 rules (Triggered = Order accepted / Order declined only, optional add-delay days/hours/minutes; Time-based chase = order_sent, cancels on response) then sends. Verify on the public `/orders/[token]`: supplier Accept activates the order_accepted rule (fires per delay) and cancels the parked declined rule; Decline does the reverse; Request Info cancels BOTH parked order rules and fires nothing. A due-now triggered rule dispatches a real supplier email (order merge context + "View order" CTA at `/orders/<token>`). Confirm quote follow-ups still behave unchanged.

## Pending verification (dev - Invoice follow-ups, Phase C, 2026-06-09)
- [ ] **Invoice follow-ups (time-based only)** - Invoice editor -> Send Invoice -> Send from QuoteCore+ -> Continue shows the pre-send gate: "Send now" sends with no follow-ups; "Add Follow-ups" (Pro only) lets you add up to 3 TIME-BASED reminders (days/hours/minutes; NO triggered/event option) then sends. When a reminder is due: if the invoice is still sent/viewed it fires a real `invoice_send` email (merge: {{invoice_number}}/{{invoice_total}}/{{invoice_link}}/{{due_date}} + "View Invoice" CTA at `/invoice/<token>`); if the recipient has acted (status payment_reported / paid / disputed / cancelled) it CANCELS instead of sending. Verify the public `/invoice/[token]` "Paid" button (payment_reported) and Dispute both proactively cancel any pending reminder; "Read"/viewed does NOT cancel. Confirm quote + order follow-ups still behave unchanged.

## Deferred / not blocking this merge (forward work)
- Supplier (order) templates: add optional includable/excludable FOOTER (orders have no template footer yet; line-by-line footer is manual entry for now).
- FOLLOW-UP A: richer over-storage billing-page UI (what's using space, per-file delete).
- FOLLOW-UP B: Stripe storage-upgrade products (own session; no Stripe key yet).
- P1-3 backlog: material-order entitlement gates + status pill migration + Confirm Order alert.
- P1-4: cancel-subscription button on plan card.
- Attachment `pending/published_at` lifecycle column (Gerald non-blocking preference).

---

## Detailed scripts (reference, run for a full tier pass)
- `smoke-test-starter.md` · `smoke-test-professional.md` · `storage-limit-smoke-test.md`
