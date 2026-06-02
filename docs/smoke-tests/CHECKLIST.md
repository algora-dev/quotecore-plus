# Smoke Test Checklist — LIVE

> Single source of truth for **what needs verifying on dev**. Gavin adds items when he ships; Shaun ticks them off. One line per item — detailed per-tier walkthrough scripts live alongside (starter / professional / storage-limit) and are referenced, not duplicated.
>
> **Status keys:** `[ ]` pending · `[x]` passed · `[!]` failed (note why) · `[~]` partial/needs retest
> Passed items move to **Passed (recent)** on the next update; stale ones pruned.
> Test env: `quotecore-plus-dev.vercel.app` (dev = one Supabase DB shared with main).

---

# PRE-MERGE RELEASE PASS — `development → main` (66 commits, baseline `8fac898` 2026-05-25)

> This merge ships the entire dev backlog to production. Verify the major features below on dev before sign-off. Gerald cleared the code; remaining risk is **behavioural/product-level**.

## A. Attachments — full feature (Phases 1–6 + post-smoke fixes #1–#5)
- [~] **Library** — Pro+ account: upload file to Attachment Library; rename; archive; delete. Non-Pro: library hidden/locked. 
> "Error on delete archived file: new row for relation "message_attachments" violates check constraint "ck_message_attachments_one_source"" - This is actively selected as a default file in a message template, pop up error should do 2 things, allow a hard delete (removes that file from the template attachment slot, now that is empty), or explain they need to remove it manually from any template and replace if needed. Everything else working well. Note - Archived attachment files should be counted towards storage quota, since we are still hosting/storing them
- [x] **Template default** — set a default attachment on an email template; it pre-selects on send.
> Seems to work
- [!] **Template default change/clear (Gavin #1)** — swap the template's default to a different file, and clear it entirely; next send reflects the new state (no stale default).
> I actually think this is pointless. Shouldn't the template itself be default no attachment, if the user wants to add an attachment, they simply select it from their attachment drop down list? Or maybe I', missing the point of this feature. The main this is, that a user can select attachements to add to template messages, the default should be nothing attached, the user needs to select for each template message what file to attach only IF they want that template to auto send with that file attached. Correct me if I'm not understanding the feature.
- [x] **Send with NO attachment (Gavin #2)** — normal send-quote flow with zero attachments selected still sends cleanly (regression after picker rework).
> Pass
- [x] **#1 Send picker** — Send Quote/Order modal: file list is a dropdown ("N files attached"), tickboxes inside, Clear works.
> Pass
- [x] **Send quote w/ attachment** — recipient email has the link button (NOT a MIME attachment); link opens the public quote page.
> Pass
- [x] **#3c View vs Download** — each attachment row: View opens inline (new tab); Download forces save-to-device.
> Pass
- [~] **#3a Download all** — public page with >1 attachment: "Download all" saves every file.
> Working, but its downloading the files as literal "file" rather than pdf, jpg, png etc. They should be downloading the actual file type. Once downloaded, yes, you can open with correct viewer (image, chrome, etc) and it shows the file, but it looks off if a customer downloads a blank page icon file, it looks weird.
- [x] **#4 Post-decision page** — after accept/decline, the quote URL STILL shows doc + status banner ("You accepted on …"), accept/decline DISABLED, Request Changes still works, attachments section persists + accumulates follow-up files.
> Pass
- [x] **Order attachments** — send order w/ library file; public order page lists + downloads it.
> Pass
- [x] **Standalone send (M-02)** — attachment-only message → `/file/<token>` page: View inline (images), Download saves to device.
> Pass
- [ ] **Failed-send cleanup (H-01)** — (optional/hard to trigger) failed send with attachment selected does NOT leave the file on the public page. Mainly code-verified.
> Not sure how to achieve this, if its important give better instructions
## B. Catalog Library + import
- [x] **Import wizard** — upload CSV → name → preview/map columns → save; catalog appears.
> Pass
- [x] **Catalog search in quote** — CustomerQuoteEditor + Blank Quote: Catalog Search adds a line (desc + price + qty).
> Pass
- [x] **#5 Units toggle** — catalog line: toggle Units off hides the quantity; hyphenated descriptions NOT truncated; component lines unchanged.
> Pass
- [x] **Catalog tier gate (Gavin #3)** — `starter` (limit 0) cannot create a catalog; `pro` (limit 3) blocks the 4th. Entitlement path, separate from storage-red.
> Pass
- [x] **Red-state import gate (H-02)** — company already over storage CANNOT start a new catalog import (server-blocked, not just modal).
> Pass
- [~] **Catalog ACL (C-01)** — code-verified live (postgres + service_role only); evidence in `release-evidence-catalog-rpc-acl-2026-06-01.md`. No UI test.
> Not sure what you want me to respond to this

## C. Storage-red policy
- [x] **Over-limit blocks uploads** — red company: catalog/attachment/quote-file/logo uploads all blocked w/ banner + modal across portals.
> Pass
- [ ] **Quote/component/drawing still work** — these use separate quotas, NOT blocked by storage-red.
- [ ] **Catalog import option-3** — an in-flight import may finish + push over (capped 10MB/catalog); company goes red after.
- [ ] **Top-up threshold (Gavin #4)** — company with a storage top-up is NOT flagged red below `limit + topup` (red triggers only past the combined threshold).

## D. Resource Library restructure
- [x] **/resources route** — old `/templates` links redirect to `/resources`; tabs (templates + attachments) all load.
> Pass
- [~] **Deep links (Gavin #5)** — in-app buttons/emails that pointed at old template URLs (e.g. SendQuoteButton `goCreateTemplate` deep-link, `?tab=` params) still land correctly post-redirect.
> How do I actually test this?
## E. Generic trades (flags already ON on main)
- [x] **Non-roofing quote** — create a quote in a generic trade; labels/flow correct.
> Pass
## F. Cross-cutting — auto-message attachment threading
- [x] **Auto-message baked attachment (Gavin #6)** — an auto/scheduled message (e.g. quote_sent chase) carries the template's baked default attachment via the resolver. Live data-model path no other item hits.

## G. Independent of merge gate (already on dev separately — fail here does NOT block the attachments merge)
- [ ] **Multi-page takeoff (P1-3, dev `e28cbff`)** — component area on Plan 2 (existing-area mode) records correctly (last known bug, fixed `e28cbff`, unconfirmed). Pass → clears takeoff gate.
- [ ] **Email template hotfix (`9697519`)** — verify on dev; pass → it rides the merge. (Was previously parked in Deferred.)
> How do I test this? Do I need to?
---

# GERALD MUST-TEST ITEMS
- [~] **Failed-send retry** — force one attachment send failure, confirm no attachment appears on public quote/order/file page, then retry successfully and confirm exactly one attachment appears/downloads.
> How?
- [x] **Attachment browser matrix** — Chrome, Safari, Firefox, and mobile: View opens inline where supported; Download saves to device with sane filename; Download all saves every file.
- [x] **Post-decision accumulation** — accepted/declined quote URL remains accessible; follow-up attachment sent after decision appears without re-enabling Accept/Decline.
- [~] **Storage-red edge UX** — already-red company is blocked from starting catalog, attachment-library, quote-file, and logo uploads server-side with clean user-facing copy.
> How to test?
- [x] **Option-3 boundary** — import started while under limit may complete and turn account red; immediately starting a second import is blocked.
> Need your help to test
- [x] **Live ACL evidence retained** — confirm `release-evidence-catalog-rpc-acl-2026-06-01.md` is attached/linked in the merge evidence and shows only `postgres` + `service_role`.
> How to test?
- [~] **Token isolation sanity** — quote/order/file attachment links from one company do not resolve for unrelated tokens or guessed `file` ids; failures return generic not-found.
> How to test
---

## Passed (recent)
_(empty — move items here as they pass)_

---

## Deferred / not blocking this merge (forward work)
- FOLLOW-UP A: richer over-storage billing-page UI (what's using space, per-file delete).
- FOLLOW-UP B: Stripe storage-upgrade products (own session; no Stripe key yet).
- P1-3 backlog: material-order entitlement gates + status pill migration + Confirm Order alert.
- P1-4: cancel-subscription button on plan card.
- Attachment `pending/published_at` lifecycle column (Gerald non-blocking preference).

---

## Detailed scripts (reference, run for a full tier pass)
- `smoke-test-starter.md` · `smoke-test-professional.md` · `storage-limit-smoke-test.md`
