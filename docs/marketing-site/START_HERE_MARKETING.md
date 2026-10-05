# START HERE — QuoteCore+ Marketing Website (external agent)

You are receiving the complete QuoteCore+ repository at commit `6dc0eea7` (branch `ux/phase-4`).

**Your brief:** `quotecore-plus/docs/marketing-site/HANDOFF_2026-09-27.md` — read it fully before touching anything.

**Key facts:**
1. One app, one build — marketing (`quote-core.com`) and product (`app.quote-core.com`) split by hostname. You got the full repo so your build runs; your WRITABLE SURFACE is marketing-only (defined in the brief).
2. The mission: bring every marketing page up to date with the product's new capability — mobile-first takeoff, Smart Assistant, Document Studio — and fix stale claims (the app is PAID-ONLY: no free trial, no free plan; 30-day money-back guarantee replaces the trial).
3. Prices are owner-locked: presentation may change, numbers may not.
4. `/free-trial` page and "plans from free" copy are known-stale — fix or flag per the brief.

**Order of operations:**
1. Read the brief.
2. Baseline your build: `npx tsc --noEmit` + `npm run build` green BEFORE changing anything.
3. Audit every marketing page + free-tool page against the product-truth list; fix copy, CTAs, structure; improve the mobile-capability story.
4. Re-verify (tsc + build), then return: full-source zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at zip root, `FILE_CHANGES.json` + `RETURN_NOTES.md` + owner decision points in `docs/marketing-site/`.
