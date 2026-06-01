# Smoke Test Checklist — LIVE

> Single source of truth for **what still needs verifying on dev**. Gavin adds items here when he ships; Shaun ticks them off. Keep it brief — one line per item. Detailed per-tier walkthrough scripts live alongside this file (starter / professional / storage-limit) and are referenced, not duplicated.
>
> **Status keys:** `[ ]` pending · `[x]` passed · `[!]` failed (note why) · `[~]` partial/needs retest
> When an item passes, Gavin moves it to **Passed (recent)** on the next update and prunes anything older than the current release window.
> Test env: `quotecore-plus-dev.vercel.app` (dev = one Supabase DB shared with main).

---

## Pending verification

### Attachments — post-smoke-test fixes (dev HEAD `9f72453`)
- [ ] **#1 Send picker** — Send Quote/Order modal: file list is a dropdown showing "N files attached"; tickboxes inside; clear works.
- [ ] **#2 Order email copy** — sent order email + public order page read "Order ON-…" (no "Material").
- [ ] **#3a Download all** — public quote/order page with >1 attachment: "Download all" saves every file.
- [ ] **#3b Download (single)** — per-file Download saves to device (not opens in browser).
- [ ] **#3c View vs Download** — each attachment row: View opens inline (new tab); Download forces save.
- [ ] **#4 Post-decision page** — after accept/decline, quote URL still shows the document + status banner ("You accepted on …"), accept/decline DISABLED, Request Changes still works, attachments section present + accumulates files from follow-up messages.
- [ ] **#5 Catalog Units toggle** — catalog-added quote line: toggling Units off hides the quantity (and hyphenated descriptions are NOT truncated); component lines unchanged.

### Gerald re-audit fixes (dev HEAD `f37f8b8`)
- [ ] **Failed-send attachment cleanup (H-01)** — if an email send fails with an attachment selected, that file does NOT appear on the public quote/order page afterwards. (Hard to trigger manually; mainly code-verified — optional.)
- [ ] **Catalog import blocked when red (H-02)** — a company already over storage cannot start a NEW catalog import (server-side, not just the modal).
- [ ] **Standalone file download (M-02)** — a sent attachment-only message's `/file/<token>` page: Download saves to device (not opens inline).

### Multi-page takeoff (dev HEAD `e28cbff`)
- [ ] **Component area on Plan 2 (existing-area mode)** — measurement records correctly (last known bug, fixed in `e28cbff`, unconfirmed). If pass → clears the takeoff merge-to-main gate.

---

## Passed (recent)
_(empty — move items here as they pass)_

---

## Detailed scripts (reference, run when doing a full tier pass)
- `smoke-test-starter.md` — Starter-tier end-to-end walkthrough.
- `smoke-test-professional.md` — Professional-tier end-to-end walkthrough.
- `storage-limit-smoke-test.md` — storage-red / over-limit blocking across portals.
