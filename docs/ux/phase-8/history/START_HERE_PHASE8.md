# START HERE — QuoteCore+ UX loop: fresh baseline (post-Phase 7 acceptance)

You are receiving the complete QuoteCore+ repository at commit `a2595922` (branch `ux/phase-4`). Phase 7 is integrated, owner-tested and ACCEPTED (2026-09-27). This is the freshest truth of the app.

**Read first, in order:**
1. `quotecore-plus/docs/ux/phase-7/INTEGRATION_UPDATE.md` — everything that changed since your Phase 7 return, standing invariants, loop protocol.
2. `quotecore-plus/docs/ux/phase-7/AGENT_TODOS.md` — follow-up ledger. P7-TEMPLATE-01 (copy-existing) is DONE by Gavin and live; the rest remain open.
3. `quotecore-plus/docs/ux/phase-7/RUNTIME_CHECKLIST.md` + `DECISIONS.md` — what the owner verified and the boundaries you set.

**Your next phase:** scope it with the owner (Shaun) — same as every round. Known candidates from the integration side: P7-CACHE-01 (verify template library freshness after create/update/delete at runtime), P7-TEMPLATE-02 (legacy `/resources/new` route), the runtime-gate items listed in AGENT_TODOS ("Release gates, not implemented backend features"), plus whatever the owner prioritises next.

**Scope exclusions (hard):**
- Marketing surface (`app/(marketing)/**`, root marketing components) — owned by a separate agent lane. Present in the tree; leave untouched.
- Smart Assistant implementation, billing, middleware, dependencies, pricing values.
- Protected invariants listed in INTEGRATION_UPDATE.md (190px Actions column, removed Resource Library button, UTF-16 database.types, conversions constants, C59/C60, message-kind contracts, 6 legacy order states).
- No em dashes in any visible copy you touch (owner house style).

**Loop (REV 2, unchanged):** you source-check and self-verify; Gavin gates tsc/lint/build + drift at integration. Return = full zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at root, `FILE_CHANGES.json` with before/after hashes (declare raw vs canonical), decisions + runtime checklist in `docs/ux/phase-<n>/`.
