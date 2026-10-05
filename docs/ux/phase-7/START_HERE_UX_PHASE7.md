# START HERE — QuoteCore+ UX Phase 7 (REV 2)

You are receiving the complete QuoteCore+ repository at commit `01fc47e1` (branch `ux/phase-4`) — UX Phases 1–6 fully integrated, owner-reviewed and live on testing, plus Smart Assistant V2 (out of scope).

**Your brief:** `quotecore-plus/docs/ux/phase-7/HANDOFF.md` — read it fully before touching anything.

**Top facts:**
1. Your Phase 6 return integrated cleanly (Gavin ran all gates: zero new type errors, lint clean, green build) and passed the owner's review. Two owner-requested fixes were layered on top (Resource Library button removed from quotes list; catalog rows got a dedicated 190px Actions column) — both locked, don't undo.
2. Your scope: (a) mobile back-button sweep across ALL pages — the owner's #1 annoyance; (b) Resources hub + all template editors; (c) Pricing Library / Smart Components; (d) Supplier surfaces; (e) Inbox; (f) 390px mobile audit of everything; PLUS (g) your own carry-over items from AGENT_TODOS (P6-DATA-01, P6-DATA-03, P6-CATALOG-01, P6-ONBOARD-01, P6-BILLING-01) — listed in the brief.
3. **Do NOT attempt npm install / tsc / build** — your environment can't run them and that's expected (owner-approved). Do your source-level checks like Phase 6; Gavin runs all release gates at integration.
4. Quote builder internals, Smart Assistant, Takeoff, billing/auth logic are protected — see the brief.

**Order of operations:**
1. Read the brief.
2. Build the Phase 7 surfaces (mobile-first quality bar).
3. Run your source-level checks; be truthful about what was verified.
4. Package: full-source zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at zip root, `FILE_CHANGES.json` + `RETURN_NOTES.md` + `DESIGN_CHANGES.md` in `docs/ux/phase-7/`, owner decision points explicit.
