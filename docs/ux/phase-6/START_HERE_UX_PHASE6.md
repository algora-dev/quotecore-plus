# START HERE — QuoteCore+ UX Phase 6 (gap-fill)

You are receiving the complete QuoteCore+ codebase at commit `4106026a` (branch `ux/phase-4`), containing UX Phases 1–5 fully integrated plus Smart Assistant V2 (out of scope).

**Your brief:** `quotecore-plus/docs/ux/phase-6/HANDOFF.md` — read it fully before touching anything. It defines Phase 6 scope (list pages, in-between modals, catalog upload, file uploads, account settings, login/signup/paywall flow), protected surfaces you must NOT modify, the design system rules, and the return format.

**Design bible:** `quotecore-plus/docs/DESIGN_SYSTEM.md` + reference components listed in the brief.

**Order of operations:**
1. Read the brief + DESIGN_SYSTEM.md.
2. Run `npx tsc --noEmit` and `npm run build` to confirm your baseline is green before changing anything.
3. Build Phase 6 surfaces.
4. Re-verify (tsc + build), then package your return: full source, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at zip root, `FILE_CHANGES.json` + `DESIGN_CHANGES.md` in `docs/ux/phase-6/`.

**Top rule:** if a decision changes behaviour (not just styling), stop and list it as an owner decision point in RETURN_NOTES.md instead of choosing silently.
