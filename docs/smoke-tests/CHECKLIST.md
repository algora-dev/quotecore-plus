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

## Pending verification (dev - help docs + Guide-Me coverage, 2026-06-05)
- [ ] **New help docs render** (`26dbb9c`): on `quotecore-plus-dev.vercel.app/docs`, the sidebar shows new sections **Catalog Library**, **Attachments**, **Follow-ups**, plus new pages under **Material orders** (Order layouts / Line-by-line editor / Order from a quote) and **Help** (Meet Q / Guide Me / rewritten Chat Assistant). Each page opens, MDX/Callouts render, internal cross-links resolve (no 404).
- [ ] **Help-drawer context mapping**: opening the in-app help drawer (`?`) on the Catalogs, Attachments, and Order-from-Quote screens opens the matching new doc, not the index fallback.
- [ ] **Q answers from new docs** (embed-docs ran, 127 chunks): ask Q (Respond mode) "how do I upload a catalog?", "how do I attach a file to a quote?", "how do automated follow-ups work?" → answers cite/draw from the new docs.
- [ ] **Wizard row-cap copy** (`ac7a575`): catalog upload wizard text now reads **35,000 rows** (was 20,000) in both spots.
- [ ] **Content proofread**: Shaun final read of the published pages for any wording tweaks (drafts were `docs/DRAFT-docs-additions-2026-06-05.md`).
- [ ] **(Deferred) Guide-Me flows**: the 5 new walkthroughs (`docs/DRAFT-guideme-flows-2026-06-05.md`) are NOT yet wired into `guides.generic.ts` — pending Shaun review of that draft + adding any missing `data-copilot` anchors.

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
