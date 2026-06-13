# QuoteCore+ — TODO / Unfinished Work

> Living backlog of work NOT yet finished. Gavin maintains this; ticks/prunes as items ship. Companion to `docs/smoke-tests/CHECKLIST.md` (which tracks what needs *testing*, not what needs *building*).
> Status: `[ ]` not started · `[~]` in progress · `[x]` done (prune soon) · `[B]` blocked
> Last updated: 2026-06-01

---

## 0. GATING THE BIG MERGE (`development → main`, 66 commits)
- [~] **Finalise pre-merge smoke checklist** — Gavin's list done; sent to Gerald to append must-test items (`docs/smoke-tests/gerald-smoke-finalise-brief-2026-06-01.md`).
- [ ] **Gerald finalises smoke list** — awaiting his additions.
- [ ] **Run smoke pass on dev** — scheduled tomorrow (Shaun + Gavin).
- [ ] **Shaun merge sign-off** → merge `development → main`. Gerald already cleared code-level.

---

## 1. Awaiting Shaun retest / confirm (built, not verified)
- [ ] **Multi-page takeoff retest** (P1-3, `e28cbff`) — component area on Plan 2 in existing-area mode. Last bug fixed, unconfirmed. Pass → clears takeoff gate.
- [ ] **Email template hotfix** (`9697519`) — on dev, await Shaun confirm before it rides the merge.

---

## 2. P1 backlog — not started
- [ ] **Material-order entitlement gates** — gate order features by plan.
- [ ] **Material-order status pill migration** — status pill + supporting migration.
- [ ] **Confirm Order alert** — alert when a supplier confirms an order.
- [ ] **P1-3 M-02/M-03 fixes** — (original P1-3 backlog items, distinct from Gerald's M-02/M-03).
- [ ] **P1-4 — Cancel subscription button** on the plan card.

---

## 3. Storage / billing follow-ups
- [ ] **FOLLOW-UP A — over-storage billing UI** — richer billing-page view: what's using space, per-file delete prompts. (Banner + blocking modal already done.)
- [B] **FOLLOW-UP B — Stripe storage-upgrade products** — combined tiers (e.g. "Pro + Storage" ~$49/mo). BLOCKED: Stripe billing not wired, no Stripe key. Needs its own session. Until shipped, red users escape only by deleting.

---

## 4. Attachments — non-blocking polish (Gerald preference)
- [ ] **`pending/published_at` lifecycle column** on `message_attachments` — stronger than current delete-on-failure against process-death mid-dispatch. Gerald flagged as preference, NOT a merge blocker.

---

## 5. P2 queue — not started
- [ ] Hyperlink token system
- [ ] Copilot overhaul + audit doc
- [ ] Trade-aware labels
- [ ] Order activity table
- [ ] Billing quota boxes
- [ ] Radio visual
- [ ] Em-dash sweep

---

## 6. Tech debt / housekeeping
- [ ] **`database.types.ts` staleness** — periodic regen drift; some tables still `as any` cast (catalog tables, Phase 2 cols, takeoff page cols). Regen command in MEMORY.md.
- [ ] **"Drawings & Images" label** — Shaun hasn't confirmed final name for non-roofing trades. Do not assume.
- [ ] **Canvas shape reconstruction** — deferred; lines-only image overlay is the current UX workaround.

---

## Decision needed from Shaun (to unblock / prioritise)
- Merge sign-off after smoke pass (Section 0).
- Whether to build FOLLOW-UP A before or after the next feature block.
- Confirm "Drawings & Images" label naming.
- When to start FOLLOW-UP B (needs Stripe key + dedicated session).
