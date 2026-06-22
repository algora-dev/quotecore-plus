# Smoke Test Checklist - LIVE

> Single source of truth for **what needs verifying on dev**. Gavin adds items when he ships; Shaun ticks them off. One line per item - detailed per-tier walkthrough scripts live alongside (starter / professional / storage-limit) and are referenced, not duplicated.
>
> **Status keys:** `[ ]` pending Â· `[x]` passed Â· `[!]` failed (note why) Â· `[~]` partial/needs retest
> Passed items move to **Passed (recent)** on the next update; stale ones pruned.
> Test env: `quotecore-plus-dev.vercel.app` (dev = one Supabase DB shared with main).

---

# âš ï¸ PRE-GO-LIVE / PROD PROMOTION TASKS (do at `development -> main` merge)

> Infra steps that MUST happen when promoting dev to production. Not feature tests - hard release gates.

- [ ] **pg_cron dispatch job points at PROD** (added 2026-06-11, commit 2802e6e): the scheduled-follow-up dispatcher now runs via Supabase pg_cron (`cron.job` name `dispatch-scheduled-messages`, every 1 min) calling `/api/cron/dispatch-scheduled-messages`. It currently targets the **DEV** URL `https://quotecore-plus-dev.vercel.app` with the **DEV** `CRON_SECRET`. At go-live: re-run an updated copy of migration `20260611150000_pg_cron_dispatch_scheduled_messages.sql` pointing `net.http_get` at the **production** URL and the **production** `CRON_SECRET` bearer. The migration is idempotent (unschedules the old job first). Verify after: `select status_code from net._http_response order by created desc limit 1` returns 200. NOTE: one Supabase DB serves dev+main, so there is only ONE cron job - repointing it to prod means dev stops being swept unless you add a second job. Decide whether dev needs its own job post-merge.
- [ ] **vercel.json**: confirm the old `*/30 dispatch-scheduled-messages` cron stays REMOVED on main (replaced by pg_cron). Daily maintenance crons (prune-rate-limits, sweep-orphan-objects, expire-trials, process-billing-lifecycle) remain.

---

# GERALD GO-LIVE AUDIT REMEDIATION R1 (2026-06-21, commit `35ca401`)

> Blockers H-01..H-04 + M-01..M-03 from `quotecore-plus-golive-security-2026-06-21`. DB objects already verified present (RPC, trigger, 5 CHECK constraints, base_unit_cost col). Behavioural verification pending. Re-audit brief: `docs/audits/GERALD-BRIEF-2026-06-21-REMEDIATION-R1.md`.

- [ ] **H-01 atomic quote-line save**: edit a customer quote with multiple lines, save â†’ lines persist correctly. (Race/failure path now rolled back atomically via RPC.)
- [ ] **H-03 invoice-from-quote tamper**: start invoice-from-quote, tamper `lines=` to a bogus id in URL â†’ expect error "None of the selected quote lines could be found", NOT a full-component invoice.
- [ ] **H-04 accept/decline guard**: accept a quote, then try decline from a stale tab â†’ second action rejected with conflict, no duplicate alert. Accept after expiry â†’ rejected.
- [ ] **M-01/M-02 (DB-enforced, low manual priority)**: normal quote save unaffected; negative qty / cross-quote component only reachable via direct API (constraints confirmed present).
- [ ] **M-03 rate-limit fail-closed**: no behavioural change in normal use; only matters during a rate-limit RPC outage.

---

# PRE-MERGE RELEASE PASS - `development â†’ main` (66 commits, baseline `8fac898` 2026-05-25)

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
- [x] **Standalone send (M-02)** - attachment-only message â†’ `/file/<token>` page: View inline (images), Download saves to device.
> Pass
- [x] **Failed-send cleanup (H-01)** - GAVIN-VERIFIED (no Shaun test needed). Hard to trigger manually; cleanup logic confirmed in code. Skip.
## B. Catalog Library + import
- [x] **Import wizard** - upload CSV â†’ name â†’ preview/map columns â†’ save; catalog appears.
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
> BOUNDARY PASS (2026-06-02): set used to 500KB-under limit, attempted 0.68MB attachment upload â†’ blocked pre-commit with "Storage quota exceeded: ... would exceed limit". Confirms attachment/quote-file/logo uploads are gated BEFORE commit (assertCanUseStorage), not allowed to tip over. (Catalog import is the only allowed-to-overspill path - separate item.)
- [x] **Quote/component/drawing still work** - these use separate quotas, NOT blocked by storage-red.
> PASS (2026-06-02): while red, attachment/logo/quote-file/2nd-catalog-import all blocked; quote/component/drawing creation all still worked.
- [x] **Catalog import option-3** - an in-flight import may finish + push over (capped 10MB/catalog); company goes red after.
> PASS (2026-06-02): from 500KB-under, imported a 781KB CSV (6,590 rows) â†’ import allowed to start, completed (catalog Ready), account flipped red afterward with banner. Banner CTA wrap fixed `5ca8217`.
- [x] **Top-up threshold (Gavin #4)** - company with a storage top-up is NOT flagged red below `limit + topup` (red triggers only past the combined threshold).
> PASS (2026-06-02): 100MB top-up, used=base+50MB â†’ NOT red, upload allowed; bumped used past base+topup â†’ red + uploads blocked. Confirmed effective limit = base + topup.

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
- [ ] **Multi-page takeoff (P1-3, dev `e28cbff`)** - component area on Plan 2 (existing-area mode) records correctly (last known bug, fixed `e28cbff`, unconfirmed). Pass â†’ clears takeoff gate.
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
> GAVIN-VERIFIED PASS (2026-06-02): hit dev download route with a random valid-format token + file id â†’ generic 404, empty body, no existence leak. My job, done. No Shaun test needed.
---

## H. AI Assistant - Guide-me re-architecture (dev only, flag-gated; in the merge bundle but OFF on main via flags)
_Re-architected 2026-06-03 eve, dev 3cfbd60. Legacy Copilot fully removed; assistant is the sole helper. Core calibration CONFIRMED by Shaun. Remaining = confirmatory pass + items below._
- [x] **Ask-first** - Guide-me orients on current screen and ASKS what you want (no forced tour). Shaun confirmed.
- [x] **Cross-page routing** - a goal on another page routes you there (e.g. add a component to a quote, from Components). Shaun confirmed.
- [x] **Next / Back / Reset** - instant step nav; Reset re-syncs to real step (or asks if ambiguous). Shaun confirmed.
- [x] **Highlight release on click** - glow clears on any click incl. the target, stays cleared until step changes; Backâ†’Next re-fires. Shaun confirmed.
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

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Gerald pre-live audit remediation H-02..H-05 + Mediums, 2026-06-13, commits 86ec34d..feb65c3)
- [ ] **H-02 invoice gating** - on a Free/expired-trial company with EXISTING invoices: editing lines/meta, reset, mark-paid, change status (non-cancel), save payment details, share-link send, and create/update invoice template all show the upgrade prompt (not a crash). Still allowed: view, PDF export, cancel, delete draft, resolve dispute, delete template.
- [ ] **H-03 atomic invoice create** - normal invoice creation (blank + from-quote) still works end-to-end; at the monthly cap the create shows the limit/upgrade prompt. (Race itself is structural - covered by RPC advisory lock.)
- [ ] **H-04 child integrity** - invoice detail + public /invoice/[token] still render lines correctly (composite FK + company_id read filter didn't break normal reads).
- [ ] **H-05 Q assistant scoping** - a user in 2 workspaces: open Q in workspace A, switch to workspace B -> B starts a fresh thread (no A history bleed); each workspace keeps its own thread on return.
- [ ] **M-01 race guards** - reporting payment / disputing a normal sent invoice still works; an already-paid/cancelled invoice returns 409 on those public actions.
- [ ] **M-03/M-05 assistant guards** - normal Q chat still streams + completes; (optional) oversized/invalid-role direct API body is rejected 400/413; a stalled turn surfaces a timeout error rather than hanging.
- [ ] **M-07 follow-up cap** - scheduling a 4th open follow-up on one quote/order/invoice is refused (UX message); double-click can't sneak past.

---

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Tutorials page + Welcome modal, 2026-06-12)
- [ ] **/tutorials hub** - new route renders 13 cards in Resource-Library style; each card opens a modal (not a link); multi-page cards show pager dots + Back/Next; single-page cards (Drawings, Downloading, Q&Docs) have no pager.
- [ ] **"Go to feature" CTA** - accent button navigates to the right page per card (Quotes/Components/Catalogs/Attachments/Drawings=/flashings/Orders=/material-orders/Invoices/Inbox/Resources).
- [ ] **"Walk me through with Q" CTA** - shows only when a guide exists (hidden on Templates, Follow-ups, Downloading, Q&Docs); clicking navigates to the start page AND launches the correct Q guide (no LLM round-trip). Test at least Quotes(create-quote), Components, Drawings(flashing-draw), Invoices(create-invoice), Message Center(message-center).
- [ ] **Q button hidden when assistant OFF** - if user has assistant disabled, no Q button on any card.
- [ ] **Entry points** - (a) Help/Docs slider shows "Tutorials" button under Search, above the doc tree -> /tutorials + closes drawer; (b) Resources page top-right "Tutorials" button; (c) Account -> Support "Help & learning" card has Tutorials link + "Open help docs" button (opens the drawer).
- [ ] **Welcome modal (first login)** - a brand-new user (users.tutorials_seen_at NULL) sees the Welcome modal once on the dashboard; "Start with Tutorials" -> /tutorials + stamps seen; "Maybe later"/X/overlay all dismiss + stamp; does NOT reappear on reload.
> Migration `20260612180000_users_tutorials_seen_at` APPLIED to shared dev+prod DB; types regenerated. `next build` passed. Q-launch uses new `qcp:start-guide` CustomEvent bridge in AssistantWidget (Option A). Card->guide mapping richer than original plan: Drawings/Invoices/Message Center now HAVE guides.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Pricing Tier v2 gating, 2026-06-11, commit `52312e1`)
- [ ] **Plan ladder** - billing page shows Free Trial / Free / Starter $19 / Pro $39; growth GONE; pro_plus/premium still present as higher/coming-soon.
- [ ] **Free tier** (`free` plan): 5 quotes/mo cap bites; URL-link send works; QCP email send BLOCKED; `/inbox` shows upgrade splash (not the inbox); Orders/Invoices/Drawings/Catalogs/Attachments/Follow-ups/Activity all locked; bell+email alerts still arrive.
- [ ] **Starter** ($19): Orders create works + caps at 5/mo (P0016 upgrade error on 6th); Invoices create works + caps at 5/mo (P0015 on 6th); Message Center opens; QCP email send works; Flashings/Drawings + Digital Measuring + Catalogs + Attachments + Follow-ups + Activity LOCKED; components cap 20.
- [ ] **Pro** ($39): everything unlocked; Invoices cap 20/mo; Orders cap 20/mo; Drawings/Flashings cap 20 (per-account); components 30; catalogs 3; attachments 10.
- [ ] **Drawings = Flashings** (one tool): Resource Library "Drawings & Images" card -> /flashings; trade label flips roofing<->generic; single cap enforced.
- [ ] **AI tokens per-plan**: assistant refuses once monthly_ai_tokens for the effective plan is hit (Free 600k / Trial 1M / Starter 1.5M / Pro 3M); premium = unlimited.
- [ ] **Edit-not-blocked**: editing an EXISTING order/invoice while AT the monthly cap still works (gate only fires on create).
> Migration `20260611160000_pricing_tier_v2` already APPLIED to the shared dev+prod DB (plan rows + functions live). App gates shipped on dev. `next build` passed. UI polish (BillingPanel new-tier cards/labels) NOT yet done - billing page may still show old copy until that lands.

## Passed (recent)
_(empty - move items here as they pass)_

---

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - #4 Activity card for orders & invoices, 2026-06-10, commit ba68dfe)
  - [ ] **#4 Order Activity card**: open a SENT order preview -> Activity card shows below the order (Unresolved / Scheduled / Sent tabs). Sent tab lists outbound order messages + any supplier replies; Scheduled tab lists parked order follow-ups; Unresolved tab shows open supplier responses (questions / change requests / declines / info requests) and is empty/clean for a plain-confirmed order. "Schedule follow-up" modal creates an order follow-up; "Delete all" clears the order's sent messages. (Replaces the old standalone Supplier responses panel.)
  - [ ] **#4 Activity card LAYOUT (Orders + Invoices)** (commit 5822a35, 2026-06-11): Activity card must sit COMPLETELY ABOVE the body and match the Quotes summary width (max-w-5xl). Orders preview: card + order body both at Quotes content width (no longer narrow A4/210mm); PDF/print output unchanged. Invoices: card spans full width above the two-pane split (Line Items | preview), NOT nested inside/above the preview pane. Cross-check side-by-side against the Quotes summary page as master.
  - [ ] **#4 Invoice Activity card**: open a SENT (non-draft) invoice -> Activity card shows below the editor. Sent/Scheduled tabs as above keyed to the invoice; Unresolved tab lists open invoice disputes with a working **Mark resolved** (optimistic, moves to the resolved drawer). Schedule-follow-up + Delete-all work. Draft invoices show NO card.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - transient Read + Reset + On-Read trigger, 2026-06-10, commits 528b3a6..44d72cb)
  - [ ] **#1 Transient Read**: open a sent quote/order/invoice as the recipient so it shows "Read", then change the owner status (e.g. order Not Ordered -> Ordered; invoice -> Paid; quote -> Accepted). "Read" badge must DISAPPEAR on any status change (manual or auto), leaving just the owner's status. Action Required still wins when an action stamp exists.
  - [ ] **#2 Reset (orders + invoices)**: on a SENT order preview and a SENT invoice editor, click **Reset** -> confirm modal with the caution tooltip. After reset: the OLD public link is dead (404/expired), status is back to baseline (order Not Ordered / invoice Unsent-draft), all read/response/dispute stamps cleared, any pending follow-ups cancelled. Re-sending mints a NEW URL. Quote Withdraw/Reopen still works as before.
  - [ ] **#3 On-Read trigger**: in Send Quote/Order/Invoice -> Add follow-ups, pick **"On read (opened, no response)"**, set a short delay (e.g. 0d 0h 5m), save+send. The follow-up must stay PARKED (not fire) until the recipient OPENS the item; then it fires ~5 min after the open. If the recipient takes any action (accept/decline/request info/request changes/dispute) before it fires, the On-Read follow-up is CANCELLED. Verify for all three entities.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - followups unblock + bell decouple + invoice templates, 2026-06-10, commit `abdd25b`)
  - [ ] **#2 Order + Invoice follow-ups save (was: trigger_event check-constraint violation)**: in **Send Order -> Add follow-ups**, build the max 3 rules (e.g. a triggered "Order accepted", a time-based chase, a triggered "Order declined") and click **Save follow-ups & send** -> saves with NO "violates check constraint scheduled_messages_trigger_event_check" error. Then verify firing one event (supplier accepts) cancels the opposing/other rules. Repeat for **Invoice** follow-ups (time-based) - also saves cleanly now.
  - [ ] **#1 Bell vs Message Center are decoupled**: with several unread (orange) alerts in the Message Center, open the bell and click **Clear alerts** -> bell empties, BUT the Message Center alerts keep their unread/orange highlight and folder exactly as before (clearing the bell must NOT mark anything read in MC). Also: clicking a bell row just navigates - it does not change the MC read state.
  - [ ] **#3 Invoice send/follow-up uses MESSAGE templates**: with existing message templates (e.g. quote_send ones) and only a header/payment Invoice template, open **Send Invoice** -> your message templates now appear in the template picker (no false "no templates"); **Add follow-up** lists the same message templates; the "create a template" link goes to **Message Templates** (Resources > Message/email tab), NOT Invoice Templates. Follow-ups must never require an invoice_template doc.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - MC badge/clear/full-text + page-aware PDF, 2026-06-10, commit `93c25d3`)
  - [ ] **#1 Action-Required badge resets**: open a dispute on an invoice (and a change/info request on an order, and a revision request on a quote) so each shows the amber "Action Required" badge. (a) **Cancel** the invoice -> badge gone; **withdraw** the quote -> badge gone. (b) In **Message Center**, mark the dispute/revision/info alert **Done** -> the badge on the matching list row clears (invoice returns to Sent, order stamps cleared, quote revision resolved).
  - [ ] **#2 Bell clear is non-destructive**: bell now has ONE action, **"Clear alerts"** -> it only marks the bell's alerts read (bell empties), but every alert STILL appears in Message Center (Active). Confirm a "View all in Message Center" link sits at the bottom of the bell dropdown. Only **Archive -> Delete** in MC permanently deletes.
  - [ ] **#3 Full message in alerts**: open a dispute leaving a Reason AND a separate comment -> the MC alert, when expanded, shows BOTH (Reason + full Message, multi-line). Same for an order **Request Info** (full supplier message) and a quote **Request Revision** (full notes, not truncated at ~200 chars).
  - [ ] **#4 Page-aware PDF (no split items)**: bulk-download multi-page orders (single AND double column) with flashing diagrams -> NO diagram/line/image is split across a page break; any item that wouldn't fit moves whole to the next page, A4 margins respected. Spot-check the same on multi-page quotes and invoices. Verify a single oversized block (e.g. one giant table) still renders (it's the only thing allowed to span pages).

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - follow-up MINUTES + html2canvas single-quote PDF, 2026-06-09)
  - [ ] **Follow-up minutes granularity + preview-faithful single-quote PDFs** (2026-06-09): in **Send Quote -> Send from QuoteCore+ -> Add Follow-ups**, both the **Triggered** (with "Add time delay" ticked) and **Time-based** rule blocks now show a **# minutes** input (0-59) beside days/hours; a triggered "fires when customer declines" rule set to 0d/0h/10m schedules the follow-up ~10 minutes after the decline (verify the parked row stores pending_wait_minutes=10 and activates correctly); a time-based 0d/0h/30m is now ACCEPTED (no longer rejected as "Pick a delay greater than zero"). Separately, the owner **Download PDF** on a quote customer page AND the summary **Download PDF** icon now capture the on-screen preview via html2canvas (oklch/lab colours handled, company logo loads, multi-page slicing for long quotes) so the downloaded PDF is a pixel match of the preview - confirm a multi-page quote with a logo renders correctly and isn't blank/clipped.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - invoice share-link send + Read robustness + list layout, 2026-06-09)
  - [ ] **Pre-send follow-up gate + mutual-cancel across 3 triggers** (2026-06-09, Phase A): on a quote summary, **Send Quote -> Send from QuoteCore+**, compose, click **Continue** -> a pre-send gate shows two choices. **Send now** ("No follow-ups needed") sends the quote with NO follow-up prompt afterwards. **Add Follow-ups** ("Then send") opens a builder where you can add up to 3 rules: **Triggered** (Quote accepted / declined / Dispute-change-requested, optional "Add time delay" else fires immediately) and **Time-based** (chase with days/hours delay, cancels on reply); one rule per trigger (a used trigger shows "already added"). Confirm -> rules persist then the quote sends. Then verify mutual-cancel: park accepted + declined + revision rules on a quote, have the customer ACCEPT -> the accepted rule activates and BOTH the declined and revision parked rows are cancelled (reason "...other trigger follow-ups no longer needed."); repeat with a customer DISPUTE/revision-request -> revision rule activates, accepted+declined parked rows cancelled. Existing accept/decline follow-ups must still fire. Also: inbox **Settings** per-event (per-line) toggles are visibly ~30% smaller than the channel master toggles and animate on/off correctly at both sizes.
  - [ ] **Per-event EMAIL notification toggles** (2026-06-09): inbox **Settings** tab now shows TWO toggles per event â€” **In-app** (orange) + **Email** (blue) â€” with per-surface channel masters. Email defaults ON only for Quote Accepted, Re-quote Requested, Order Accepted, Order Info Requested, Invoice Disputed; OFF for all others (declines, all Read/Viewed, payment-reported). Verify: toggling an event's Email OFF stops only that email (in-app alert + status still fire); a dispute/accept/info-request now emails all company users when its blue toggle is on; order/invoice/read events that previously sent no email now send a generic branded email when enabled; the Account â†’ Notifications email master is GONE (tab now only hosts Chat Assistant); legacy companies with bare-boolean prefs still load with correct in-app state + email defaults.
  - [ ] **Message Center notification matrix** (2026-06-09): inbox **Settings** tab now shows three channel cards (Quotes / Orders / Invoices), each with an "All <channel> alerts" MASTER toggle + per-event child toggles (all default ON; ON = notify me). Orders shows ONE "Supplier Response" event (not separate accept/decline/request-info); Invoices has NO request-info event. Turning a master OFF greys+disables+turns off its children; turning it back ON re-enables all children. Toggling an event OFF means that event's owner alert is NOT created, while the underlying status (Read/Accepted/Paid/Viewed/etc) STILL updates. Verify each of the 3 "Read" toggles independently gates its channel's Read alert, and the Account -> Notifications email-copy toggle is untouched.
  - [ ] **Notification matrix corrections** (2026-06-09): Orders channel now shows FOUR events - **Accepted / Declined / Info Requested / Read** (the old single "Supplier Response" is gone); a supplier accepting/declining/requesting-info on a sent order creates the matching distinct alert (title "Accepted / Declined / Info Requested - <supplier>"), each independently gated by its own toggle, while the order's lifecycle stamps (confirmed/declined/info-requested) + response row ALWAYS save even with the toggle OFF. Invoices channel now shows only THREE events - **Payment Made / Dispute Opened / Read** (the "Paid" toggle is removed; the invoice_paid alert still fires as before, just no longer user-configurable). Confirm all new Order alerts route to the material-order preview with the blue "Order" badge, and any historical "Supplier Response" (order_supplier_response) alerts already in the DB still render + route correctly (back-compat).
  - [ ] **Invoice share-link = Sent, Read activates, list layout** (2026-06-09): on a DRAFT invoice click **Customer View** in the editor -> status flips to **Sent** + an "Invoice Sent" alert is created (no email); recipient opens public `/invoice/<token>` -> status flips to **Viewed/Read** (+ Read alert if Notify-on-view ON) -> dispute -> **Action Required**. Invoices list now has column headers **Invoice Number | Client/Job | Value | Status | Last Activity** (Status in its own column beside Last Activity), **New Invoice** button on the right, header columns line up with rows.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - #5 in-app plan upgrade/downgrade, 2026-06-08, commit `91eedde`) - STRIPE TEST MODE
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

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - starter-test fixes, 2026-06-08, commit `223e189`)
- [ ] **#1 Seed components (THE bug)**: sign up a NEW company as **Roofing** -> Components page shows the 8 Roofing starter components (not zero). Sign up another as a **generic trade** -> shows the 9 Generic starter components. (Root cause was the tier cap rolling back the seed; now seeded via cap-bypass RPC, trade-aware.)
- [ ] **#1 Cap still enforced for users**: on a Starter/trial company, after seed, manually adding components past the limit (10) is still blocked with the limit message (seed bypass must NOT disable the user cap).
- [ ] **#2 Remove line (customer quote editor)**: red **X** top-right of each line row -> ConfirmModal -> line is fully removed (not just hidden). Confirm order + invoice editors still remove cleanly too.
- [ ] **#3 Pencil edit quantity + dash (customer quote + line-by-line order)**: add a custom line with a quantity; pencil-edit from preview -> Quantity field is editable; clearing it removes the â€œdescription â€” quantityâ€ dash entirely; editing description and price still work.
- [ ] **#4 Extras tooltip**: Quote Builder -> Extras phase shows the info note pointing to the customer quote editor for fully custom extra lines.
- [ ] **#6 Highlights pill**: Guide-me toggle -> OFF = grey track + white knob left; ON = **orange** track + white knob slides right (no blue).

---

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - help docs + Guide-Me coverage, 2026-06-05)
- [ ] **New help docs render** (`26dbb9c`): on `quotecore-plus-dev.vercel.app/docs`, the sidebar shows new sections **Catalog Library**, **Attachments**, **Follow-ups**, plus new pages under **Material orders** (Order layouts / Line-by-line editor / Order from a quote) and **Help** (Meet Q / Guide Me / rewritten Chat Assistant). Each page opens, MDX/Callouts render, internal cross-links resolve (no 404).
- [ ] **Help-drawer context mapping**: opening the in-app help drawer (`?`) on the Catalogs, Attachments, and Order-from-Quote screens opens the matching new doc, not the index fallback.
- [ ] **Q answers from new docs** (embed-docs ran, 127 chunks): ask Q (Respond mode) "how do I upload a catalog?", "how do I attach a file to a quote?", "how do automated follow-ups work?" â†’ answers cite/draw from the new docs.
- [ ] **Wizard row-cap copy** (`ac7a575`): catalog upload wizard text now reads **35,000 rows** (was 20,000) in both spots.
- [ ] **Content proofread**: Shaun final read of the published pages for any wording tweaks (drafts were `docs/DRAFT-docs-additions-2026-06-05.md`).
- [x] **(Now wired) Guide-Me flows**: the 5 new walkthroughs ARE now wired into `guides.generic.ts` + `intents.ts` (`367dbfe`) with 20+ `data-copilot` anchors. See the dedicated nav + Guide-Me section below for the full test pass.
- [ ] **Guide-Me UX round 2** (`89c0140`, 2026-06-07): (1) **Nav single-click** â€” with a nav highlight glowing, clicking Quotes/Orders/Resources navigates on the FIRST click (was double-click). (2) **Markdown renders** â€” guide step bubbles show emphasis as italic/bold, no raw `_underscores_` or `**asterisks**` (re: "Order items panel"). (3) **catalog-add-to-quote** â€” from an unrelated page: Go to Quotes -> Open a quote -> Open Customer Quote tab (or Create customer quote) -> click edit pencil -> then the existing Add-New-Line steps; flows end-to-end. (4) **Line-by-Line card highlights** â€” custom order -> the "Line by Line" layout card actually glows when Q says it's highlighted. (5) **Attachments split**: ask Q *"how do I send a quote with an attachment"* -> NEW flow (quote summary -> Send Quote -> Add attachment picker), NOT the library-upload flow; ask *"how do I upload a file to my attachment library"* -> the upload flow (Resources -> Attachments -> Upload file).
- [ ] **Guide-Me nav-hop parity** (`af4ff28`, 2026-06-07): all 4 non-catalog flows now match the catalog flow's nav-hop behaviour. Launch EACH from an unrelated page (e.g. an open quote) and confirm the synthetic nav hop highlights + behaves like catalog: **catalog-add-to-quote** now shows a highlighted "Go to Quotes" hop (was missing entirely) -> click Quotes -> press Next; **attachments-send** "Go to Resources" hop AUTO-advances on landing (no manual Next); **order-line-by-line** + **order-from-quote** "Go to Orders" hop AUTO-advances on landing. After the hop, steps proceed individually as before.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - navigation + Resources hub + Guide-Me flows, 2026-06-05)

> Commits: Part A nav `ec6b100`, Guide-Me anchors+flows `367dbfe`, Part B Resources hub `6932d8a`. Assistant is dev-only (flag-gated); these need the AI Assistant ON (it is on the dev project).

### N. Navigation changes (Part A)
- [ ] **Nav order + labels**: main nav now reads **Components Â· Quotes Â· Orders Â· Resources**. "Material Orders" is renamed **Orders**; a new **Resources** item appears. Active-pill highlight follows the page you're on (no false highlight of Resources when on Orders, etc.).
- [ ] **Orders link still works**: clicking **Orders** lands on the material-orders hub (same page as before, just renamed). Pro-gating unchanged: on a non-Pro account the Orders item still shows the lock + upgrade modal.
- [ ] **Resources link works**: clicking **Resources** opens the new `/resources` cards hub.

### O. Resources cards hub (Part B)
- [ ] **Hub renders as cards**: `/resources` shows 8 cards styled like the dashboard (icon tile + title + description, orange hover glow), NO tab bar. Cards: Components, Drawings & Images, Catalogs, Attachments, Quote Templates, Quote Header Templates, Message Templates, Order Header Templates.
- [ ] **Redirect cards**: **Components** card â†’ `/components` (existing page); **Drawings & Images** card â†’ `/flashings` (existing page). Both load their real pages unchanged.
- [ ] **Sub-route cards â€” each opens its own URL with ONLY that section, no tab bar, page title = section name:**
  - Catalogs â†’ `/resources/catalogs`
  - Attachments â†’ `/resources/attachments`
  - Quote Templates â†’ `/resources/quote-templates`
  - Quote Header Templates â†’ `/resources/quote-header-templates`
  - Message Templates â†’ `/resources/message-templates`
  - Order Header Templates â†’ `/resources/order-header-templates`
- [ ] **Section content intact**: inside each sub-route the existing UI works exactly as before (create/edit/delete templates; upload/rename/archive catalogs + attachments; Pro-gating + storage limits still enforced). Nothing about the panels changed â€” only the wrapper.
- [ ] **Back button**: each sub-route has a Back button returning to the Resources hub. Hub itself has NO back button (it's a top-level destination).
- [ ] **Back-compat redirects**: visiting old links `/resources?tab=catalogs`, `?tab=attachments`, `?tab=quote`, `?tab=customer`, `?tab=email`, `?tab=order` each 302-redirect to the matching new sub-route (no 404, no dead tab page). The dashboard "Resource Library" card (â†’ `/resources`) still works.
- [ ] **Help drawer per section**: the `?` help icon on each sub-route opens the right doc â€” Catalogsâ†’Catalog overview, Attachmentsâ†’Attachment overview, Message Templatesâ†’Email templates, Order Header Templatesâ†’Supplier templates, etc.

### P. Guide-Me flows (the 5 new walkthroughs) â€” run each in **Guide me** mode with **Highlights ON**
- [ ] **Flow 1 â€” Upload & Map a Catalog**: ask Q "how do I upload a catalog?" (or start on `/catalogs`). Steps highlight in order: Upload catalog btn â†’ drop zone â†’ name input â†’ column-map section â†’ multi-maps note â†’ Save catalog. Each highlight lands on the correct element; Next/Back/Finish work; highlight releases on click.
- [ ] **Flow 2 â€” Add a Catalog Item to a Quote**: from inside a customer quote editor. Steps: (nav prompt) â†’ **+ Add New Line** btn â†’ **Search catalog** tab â†’ search input â†’ results â†’ Save and Return. Highlights land correctly. _(Q narrates the nav into a specific quote; it can't deep-link an arbitrary quote â€” expected.)_
- [ ] **Flow 3 â€” Attach & Send Files**: Steps: **Resources** nav â†’ **Attachments card** (on the hub) â†’ Upload file btn (on `/resources/attachments`) â†’ (nav to a quote) â†’ Send Quote â†’ attachment picker â†’ send mode. The re-pointed Attachments **card** highlight (not the old tab) is correct.
- [ ] **Flow 4 â€” Build a Line-by-Line Order**: Steps: **Orders** nav â†’ Custom Order card â†’ layout picker â†’ **Line by Line** card â†’ Order items panel â†’ + Add New Line â†’ line controls â†’ Footer â†’ Taxes. Highlights land; layout-picker + line-by-line editor anchors resolve.
- [ ] **Flow 5 â€” Create an Order from a Quote**: Steps: **Orders** nav â†’ **Order from Quote** card â†’ layout picker (Line by Line) â†’ quote list â†’ **Create Order** confirm btn â†’ supplier header form â†’ Save Order. The confirm button highlight matches the real **"Create Order"** label.
- [ ] **Intent routing**: typing natural phrases routes to the right flow â€” e.g. "add a catalog item to a quote", "attach a file to a quote", "turn a quote into a material order", "build a line by line order".
- [ ] **No stale anchors / console errors**: stepping through all 5 flows produces no "element not found" highlight failures and no console errors. Highlights release on any click (dismissedKeyRef) and the last step shows **Finish**.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - line-by-line order UX + collapsible panels, 2026-06-05)
- [ ] **Order-from-quote â†’ line-by-line populates** (`67779c0`): create order from a quote choosing the Line-by-Line layout â†’ editor pre-fills priced lines (lines + prices + descriptions, matching the customer quote) + footer; **tax starts EMPTY by default** (user opts in). Reference pre-filled `Order for <n>`. Custom blank line-by-line still starts empty (untouched).
- [ ] **Order-from-quote repeat save** (`b3e61e2`): save an order from the SAME quote twice â†’ 2nd gets `ON-<n>-2` suffix, NO "Failed to save" error. Also: two custom orders back-to-back get consecutive numbers (no spurious `-2`, `3157462`).
- [ ] **Hide-all-prices persists** (`5dcd23f`): tick "Hide all prices" beside Order items â†’ Save â†’ saved order, public/sent page, and Print/PDF all show ZERO pricing (no per-line price, subtotal, tax, total, Price header blank). Untick = per-line prices as set. Works on both new + edited orders.
- [ ] **Line-by-line scroll + width** (`67779c0`â†’`57c61ae`): footer + taxes reachable by scrolling on any screen ratio; body lines up with full-width header; preview is the wider section; header is a rounded card.
- [ ] **Collapsible panels â€” all editors** (`c2b16cc`â†’`8bf3a7a`): line-by-line order, components/column order, customer quote, AND labor sheet â€” click `Â«` to collapse the left controls â†’ preview smoothly fills the space; expand tab (top-left, vertical label) returns to original dims. Header-collapse + panel-collapse work together. **Quote/labor: collapse preview is dominant when expanded.** Saving with a panel collapsed changes nothing (verified in code: save keyed to isDirty / data only; panelCollapsed is isolated layout state).
- [ ] **Order editor tip** (`8bf3a7a`): both order editors show "Tip: to view the full preview with header, save, then view order." next to the preview label.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - line-by-line orders + catalog UX, 2026-06-04)
- [ ] **Customer Quote Editor â€” unified "Add New Line" modal (Phase 1)** (`20b14f9`): under Components & Items there is now ONE "+ Add New Line" button (replaced the old Add Custom Line + Search Catalog pair). Clicking it opens a modal with 3 tabs:
  - **Custom line**: Description (text) + Quantity/detail (text) + Price (number) â†’ adds line + shows in preview.
  - **Add a component**: Library dropdown (All + each collection) â†’ Component dropdown (filtered, default All) â†’ "Add to Quote" â†’ line lands with component NAME only, qty + price blank, editable via the right-side pencil.
  - **Search catalog**: opens the existing catalog search (unchanged) â†’ add row works as before.
  Verify all 3 paths add correctly, preview updates, save persists. (Phase 2 = clone this editor into the orders line-by-line flow â€” not yet built.)
- [ ] **Takeoff component-add library selector** (`117bde2`): in a quote's takeoff panel, the Available components section shows a "Library" dropdown when collections exist. "All components" lists every company component (rows show `Â· LibraryName` suffix); selecting a named library filters to just that library's components. Defaults to the quote's pinned library if set, else All. Empty library shows "No components in this library."
- [ ] Catalog upload preview: no "first row contains titles" toggle; shows `COL A` + title (when present); no duplicate letters; same in Maps tab + mapping dropdowns. (commits `d11c396`,`51e16c5`)
- [ ] Assistant chat panel ~25% shorter. (`d11c396`)
- [ ] **Line-by-line order SAVE now works** (was failing pre-`0d8f047` due to layout_mode CHECK constraint; migration `20260604180000` applied). Create line-by-line order â†’ add lines â†’ Save â†’ appears in orders list â†’ reopen edit (lines rehydrate) â†’ `/preview` + public token page + Print/PDF show priced table + header + correct currency.
- [ ] **Line-by-line order editor â€” Phase 2 parity** (`f96825c`): pick "Line by Line" from the orders layout picker â†’ editor shows: (1) header card with **Order Template dropdown** (selecting one pre-fills To/From/Ref/etc.) + To/From/Ref/Date/Notes; (2) **"+ Add New Line" modal** with 3 tabs â€” Custom line (desc+qty+price+show-price), Add a component (Library dropdown â†’ component, lands name-only), Search catalog (live search â†’ adds line); (3) left list per-line Show/Price/In-total toggles + reorder â–²â–¼ + Remove; (4) right preview **pencil edit** per line (text+price+show-price); (5) **Footer** free-text; (6) **optional Taxes** (default none â€” add custom tax OR tick a company default; subtotal/tax rows/total appear). Save â†’ orders list â†’ reopen edit (lines+footer+taxes rehydrate) â†’ `/preview` + public token page + Print/PDF all show priced table + footer + tax lines + correct currency. Verify legacy line-by-line orders (saved pre-`f96825c` as a bare array) still render (back-compat envelope parse).

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev â€” Invoice System MVP, 2026-06-07, commit `4c00a21`)
- [ ] **Nav: Invoices tab** â€” visible between Quotes and Orders in the workspace nav. Clicking navigates to `/invoices`.
- [ ] **Invoice Library empty state** â€” fresh account shows empty state with "No invoices yet" + "New Invoice" CTA.
- [ ] **Create blank invoice** â€” click New Invoice â†’ Blank Invoice â†’ enter customer name (+ optional email) â†’ Create â†’ lands on invoice editor with correct INV-YYYY-NNNNNN number and QCP-INV-YYYY-NNNNNN payment reference.
- [ ] **Create from quote** â€” click New Invoice â†’ From a Quote â†’ search + select a quote â†’ Create â†’ invoice editor pre-populated with customer name, branding (cq_* fields), and line items imported from customer_quote_lines (visible lines only).
- [ ] **From Job disabled** â€” "From a Job" option is disabled/greyed with "Coming soon" tooltip.
- [ ] **Invoice editor: add custom line** â€” Add Line Item â†’ Custom tab â†’ fill title/qty/unit/unit price â†’ Add â†’ line appears in left panel + live preview updates. Line total = qty Ã— unit price.
- [ ] **Invoice editor: catalog line** â€” Add Line Item â†’ Catalog tab â†’ pick catalog â†’ pick row â†’ set qty/price â†’ Add â†’ line in preview.
- [ ] **Invoice editor: inline edit** â€” click pencil on a line â†’ inline form â†’ edit title/description/qty/unit price â†’ line total recalculates â†’ Done.
- [ ] **Invoice editor: reorder lines** â€” â–²â–¼ arrows move lines; preview updates order.
- [ ] **Invoice editor: hide price** â€” uncheck "Show price" on a line â†’ preview shows "â€”" for that line's price/total.
- [ ] **Invoice editor: Details tab** â€” set invoice date, due date, notes, terms; preview reflects all changes.
- [ ] **Invoice editor: Business Details** â€” click Edit â†’ fill company name/address/email/phone/footer â†’ Apply â†’ preview header updates.
- [ ] **Invoice editor: save** â€” click Save â†’ "Saved" indicator â†’ reload page â†’ all lines + metadata persist.
- [ ] **Invoice editor: auto-save** â€” make a change â†’ wait 2s â†’ "Saved" appears without clicking Save.
- [ ] **Invoice totals** â€” subtotal in left panel and preview equals sum of visible show-price lines.
- [ ] **Public invoice view** â€” open Customer View link from editor â†’ `/invoice/<token>` renders: business header, customer block, line items table, totals, payment instructions with payment reference + copy button.
- [ ] **Payment Sent flow** â€” on public view, click "Payment Sent" â†’ optional message â†’ Confirm â†’ status on library changes to "Payment Reported"; alert fires in the app.
- [ ] **Confirm Payment Received** â€” on editor with status payment_reported, click "Confirm Payment" â†’ invoice status â†’ Paid.
- [ ] **Dispute flow** â€” on public view, click "Dispute Invoice" â†’ fill name/reason/message â†’ Submit â†’ invoice status â†’ Disputed; alert fires in app.
- [ ] **Invoice Activity tab** â€” editor Activity tab shows: created, edited, viewed, payment_reported entries with timestamps.
- [ ] **Cancel draft** â€” three-dot menu on library row â†’ Delete Draft â†’ removed from list.
- [ ] **Cancel sent invoice** â€” three-dot menu â†’ Cancel Invoice â†’ status â†’ Cancelled; public view shows "Invoice Not Found".
- [ ] **Status filter tabs** â€” filter by Paid / Disputed / etc. shows correct subset.
- [ ] **Search** â€” search by customer name or invoice number filters correctly.
- [ ] **Invoice number uniqueness** â€” create 3 invoices â†’ each gets a unique sequential number (INV-YYYY-000001, -000002, -000003).

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Send Invoice phase, 2026-06-07)
- [ ] **Send Invoice â€” Send from QuoteCore+** â€” open invoice editor â†’ click Send Invoice â†’ "Send from QuoteCore+" â†’ enter recipient email â†’ fill subject/body â†’ Send Invoice â†’ invoice status updates to Sent; Activity tab logs "sent" event; in-app alert fires.
- [ ] **Send Invoice â€” Copy URL** â€” Send Invoice â†’ Copy URL Link â†’ paste into browser â†’ `/invoice/<token>` opens customer public view.
- [ ] **Send Invoice â€” Generate Email** â€” Send Invoice â†’ Generate Email â†’ subject/body pre-filled (with template if one exists) â†’ Copy Email copies both.
- [ ] **Send Invoice â€” entitlement gate** â€” Starter plan (no email send): Send from QuoteCore+ shows plan-gate error; Copy URL still works.
- [ ] **Send Invoice â€” invoice_send template** â€” create an email template with kind=invoice_send in Resources â†’ Templates; it appears in the send modal dropdown and placeholders {{invoice_number}}, {{invoice_total}}, {{invoice_link}}, {{due_date}} all substitute correctly.
- [ ] **Send Invoice â€” suppression** â€” send to a suppressed email â†’ shows "blocked" message, invoice status stays draft.
- [ ] **Send Invoice â€” hidden on paid/cancelled** â€” Send Invoice button absent on paid + cancelled invoices.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Orders/Invoices bulk multi-select, 2026-06-09)
- [ ] **Orders & Invoices bulk multi-select** - on both the Orders and Invoices lists: header "select all visible" + per-row checkboxes select up to 25 (cap notice past 25); "Download N as ZIP" produces one ZIP of per-item PDFs; "Delete Selected" opens a ConfirmModal then deletes (orders: any; invoices: drafts only, non-drafts skipped with a count); selection clears after each action; Quotes list still works unchanged.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - PDF pixel-match downloads, 2026-06-09)
- [ ] **PDF == on-screen preview (single + bulk)** - eyeball that downloads are a pixel match of the preview: (a) Quotes bulk ZIP -> each `Quote-####-Name/01-Customer-Quote.pdf` matches the customer-edit QuotePreview (logo, lines, totals, footer) and `02-Labour-Sheet.pdf` appears only when a visible labour sheet exists; (b) Orders bulk ZIP + owner Order Preview "Download PDF" both match the OrderBody (TO/FROM, flashing images, line-by-line/components layout, totals); (c) Invoices bulk ZIP + owner invoice editor "Download PDF" both match the InvoicePreview (dark header, meta bar, line table, payment box) with NO recipient action forms/buttons; (d) 25-cap + progress modal + best-effort (one bad item doesn't abort the ZIP) still work on all three lists; (e) public window.print() buttons on /accept/[token] + /orders/[token] are unchanged. Watch specifically for: company-logo CORS taint (Supabase public URLs should be fine; a tainted canvas would blank the logo or throw â€” caught per-item) and long multi-page orders/invoices slicing across A4 pages correctly.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Order follow-ups, 2026-06-09)
- [ ] **Order follow-ups (send-time gate + engine)** - Order Preview -> Send Order -> Send from QuoteCore+ -> Continue shows the pre-send gate: "Send now" sends with no follow-ups; "Add Follow-ups" lets you add up to 3 rules (Triggered = Order accepted / Order declined only, optional add-delay days/hours/minutes; Time-based chase = order_sent, cancels on response) then sends. Verify on the public `/orders/[token]`: supplier Accept activates the order_accepted rule (fires per delay) and cancels the parked declined rule; Decline does the reverse; Request Info cancels BOTH parked order rules and fires nothing. A due-now triggered rule dispatches a real supplier email (order merge context + "View order" CTA at `/orders/<token>`). Confirm quote follow-ups still behave unchanged.

## Pending verification

### Fixed Quantity pricing (2026-06-22, commit 363c7a5)
- [ ] Create an area component, Item Cost = Fixed Quantity, Quantity Amount = 50 (m2), Quantity Price = 500. Confirm 'Per Coverage Area' is GONE and labels read 'Quantity Price' / 'Quantity Amount'.
- [ ] Add to a quote, enter 220m2 area + 10% waste. Confirm Total Qty shows 5 (4.84), Item Cost = $2,500 (5 x 500), not 242 x rate.
- [ ] Per unit component still shows single qty + unchanged price (no regression).
- [ ] Customer quote line reads 'Tiles - 5 (4.84 m2)'; price matches rounded 5.
- [ ] Summary page + expandable header show 5 (4.84) for the fixed-qty line.
- [ ] Remove entry from a fixed-qty component: qty + price recalc in place (no stale per-unit flash).

## Quantity Column (2026-06-14)
- [ ] **Qty column persistence fix** - tick Qty column checkbox on a quote, save, reload: confirm it stays ticked. Untick, save, reload: confirm it stays unticked. (Task 1 stale-closure fix)
- [ ] **Blank quote: Global margin controller** - open a blank quote, set 20% margin, see all line prices inflate by 20%, margin row appears in preview ("Profit margin (20%): X incl."). Toggle "Show on customer quote" off: margin row disappears. Save, reload: margin % persists.
- [ ] **Per-line margin override** - click pencil on any line: Margin % field shows the global default. Change to 5%: price updates immediately. Save: that one line price is at 5% margin, others unchanged.
- [ ] **Component line margin (normal quote)** - click pencil on a component line from a normal quote with review-stage margins: shows both Material % and Labor % fields at their review defaults. Change material margin: only that line's price changes.
- [ ] **Order from Quote line selector** - Materials > Order from Quote > select a quote > NEW step: see list of all components with checkboxes, Select All / Deselect All controls. Deselect some, click Create Order: order editor shows only the selected components. Backward compat: quoteId directly in URL without components param still maps all. (dev - Invoice follow-ups, Phase C, 2026-06-09)
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
- `smoke-test-starter.md` Â· `smoke-test-professional.md` Â· `storage-limit-smoke-test.md`
