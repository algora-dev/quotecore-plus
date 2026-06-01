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
- [ ] **Library** — Pro+ account: upload file to Attachment Library; rename; archive; delete. Non-Pro: library hidden/locked.
- [ ] **Template default** — set a default attachment on an email template; it pre-selects on send.
- [ ] **#1 Send picker** — Send Quote/Order modal: file list is a dropdown ("N files attached"), tickboxes inside, Clear works.
- [ ] **Send quote w/ attachment** — recipient email has the link button (NOT a MIME attachment); link opens the public quote page.
- [ ] **#3c View vs Download** — each attachment row: View opens inline (new tab); Download forces save-to-device.
- [ ] **#3a Download all** — public page with >1 attachment: "Download all" saves every file.
- [ ] **#4 Post-decision page** — after accept/decline, the quote URL STILL shows doc + status banner ("You accepted on …"), accept/decline DISABLED, Request Changes still works, attachments section persists + accumulates follow-up files.
- [ ] **Order attachments** — send order w/ library file; public order page lists + downloads it.
- [ ] **Standalone send (M-02)** — attachment-only message → `/file/<token>` page: View inline (images), Download saves to device.
- [ ] **Failed-send cleanup (H-01)** — (optional/hard to trigger) failed send with attachment selected does NOT leave the file on the public page. Mainly code-verified.

## B. Catalog Library + import
- [ ] **Import wizard** — upload CSV → name → preview/map columns → save; catalog appears.
- [ ] **Catalog search in quote** — CustomerQuoteEditor + Blank Quote: Catalog Search adds a line (desc + price + qty).
- [ ] **#5 Units toggle** — catalog line: toggle Units off hides the quantity; hyphenated descriptions NOT truncated; component lines unchanged.
- [ ] **Red-state import gate (H-02)** — company already over storage CANNOT start a new catalog import (server-blocked, not just modal).
- [ ] **Catalog ACL (C-01)** — code-verified live (postgres + service_role only); evidence in `release-evidence-catalog-rpc-acl-2026-06-01.md`. No UI test.

## C. Storage-red policy
- [ ] **Over-limit blocks uploads** — red company: catalog/attachment/quote-file/logo uploads all blocked w/ banner + modal across portals.
- [ ] **Quote/component/drawing still work** — these use separate quotas, NOT blocked by storage-red.
- [ ] **Catalog import option-3** — an in-flight import may finish + push over (capped 10MB/catalog); company goes red after.

## D. Resource Library restructure
- [ ] **/resources route** — old `/templates` links redirect to `/resources`; tabs (templates + attachments) all load.

## E. Generic trades (flags already ON on main)
- [ ] **Non-roofing quote** — create a quote in a generic trade; labels/flow correct.

## F. Multi-page takeoff (P1-3, dev `e28cbff`)
- [ ] **Component area on Plan 2 (existing-area mode)** — measurement records correctly (last known bug, fixed `e28cbff`, unconfirmed). Pass → clears takeoff gate.

---

# GERALD MUST-TEST ITEMS (to be added)
> _Pending: Gavin sends this checklist to Gerald; Gerald appends his required product-level checks (live sends, failed-send retry, downloads in target browsers, over-quota red UX, live ACL screenshot). Section finalised before tomorrow's test run._

---

## Passed (recent)
_(empty — move items here as they pass)_

---

## Deferred / not blocking this merge (forward work)
- Email template hotfix (`9697519`) — await Shaun merge confirm.
- FOLLOW-UP A: richer over-storage billing-page UI (what's using space, per-file delete).
- FOLLOW-UP B: Stripe storage-upgrade products (own session; no Stripe key yet).
- P1-3 backlog: material-order entitlement gates + status pill migration + Confirm Order alert.
- P1-4: cancel-subscription button on plan card.
- Attachment `pending/published_at` lifecycle column (Gerald non-blocking preference).

---

## Detailed scripts (reference, run for a full tier pass)
- `smoke-test-starter.md` · `smoke-test-professional.md` · `storage-limit-smoke-test.md`
