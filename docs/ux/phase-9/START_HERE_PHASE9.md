# START HERE — UX Phase 9 (2026-09-28)

You are implementing UX Phase 9 for QuoteCore+.

**Read first, in order:**
1. `quotecore-plus/docs/ux/phase-9/HANDOFF.md` — scope rules (HARD: marketing + Smart Assistant surfaces are off-limits, other agents own them), candidate backlog, invariants, return format.
2. `quotecore-plus/docs/ux/phase-8/INTEGRATION_UPDATE.md` — your Phase 8 return was ACCEPTED by the owner (all 4 smoke tests passed 2026-09-28). One amendment is recorded there: /resources/new redirects to the Resources hub — do not revert.

**Baseline:** the commit on the zip label (also recorded in HANDOFF.md). Drift-check your return against it.

**Loop:** you scope + implement in one return; Gavin gates (tsc parity, lint, build, drift-check, deploy, owner smoke). You do not need to install deps or build.

**Golden rules:**
- The owner's phone is the acceptance device. Mobile-first on everything.
- Propose scope in RETURN_NOTES, then implement it fully — no half phases.
- Zero changes in app/(marketing), app/(public), or any Smart Assistant surface (assistant pages, ConversationCards, V2ChatClient, SA server code) — other lanes own those files right now.
