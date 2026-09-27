# START HERE — QuoteCore+ UX Phase 7 (resources, templates, pricing library, supplier, inbox + mobile back-button sweep)

You are receiving the complete QuoteCore+ repository at commit `01fc47e1` (branch `ux/phase-4`) — UX Phases 1–6 fully integrated and owner-reviewed, plus Smart Assistant V2 (out of scope).

**Your brief:** `quotecore-plus/docs/ux/phase-7/HANDOFF.md` — read it fully before touching anything.

**Top facts:**
1. Phase 6 shipped and passed the owner's first review — do not regress those surfaces. The v2 orange-gradient design language (P6-D01) is the standing standard.
2. Your mandatory scope: (a) mobile back-button sweep across ALL pages — the owner's #1 annoyance; (b) Resources hub + all template editors; (c) Pricing Library / Smart Components; (d) Supplier surfaces; (e) Inbox; (f) 390px mobile audit of everything.
3. **Run `npx tsc --noEmit` and `npm run build` yourself before returning** — zero new errors + green build. The Phase 6 "no deps available" exception will not be repeated. If install fails, stop and report.
4. Quote builder internals, Smart Assistant, Takeoff, billing/auth logic are protected — see the brief.

**Order of operations:**
1. Read the brief.
2. Baseline your environment: install from the unchanged lockfile, run tsc + build, confirm green BEFORE changing anything.
3. Build the Phase 7 surfaces (mobile-first quality bar).
4. Re-verify (tsc + build), then package: full-source zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at zip root, `FILE_CHANGES.json` + `RETURN_NOTES.md` + `DESIGN_CHANGES.md` in `docs/ux/phase-7/`.
