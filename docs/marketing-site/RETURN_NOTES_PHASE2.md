# RETURN NOTES — Marketing V2 Phase 2

**Date:** 2026-09-27
**Implemented by:** Gavin (in-repo, per owner tasking — Phase 1A integration commit `2e9bf3df` is the working baseline)
**Scope:** `quote-core.com` marketing pages only. Zero product/app code, pricing values, free-tool logic, homepage, dependencies or routing changes.

## What shipped

Core commercial repositioning per `PHASE2_CORE_REPOSITIONING.md` + `PHASE2_PAGE_MATRIX.md`: measurement → pricing → quote as the dominant story, mobile-first workflow made explicit, Smart Assistant positioned as an interface/force multiplier with propose-then-confirm control language.

### Shared component (new)

- `components/ThreeWaysToWork.tsx` — configurable "three ways to work" section (Measure / Enter measurements / Ask Smart Assistant). Marketing-surface only; every page passes page-specific copy. No shared component was modified, so the frozen homepage is untouched.

### Tier A — substantial updates (6 pages)

1. **`/features`** — "Four ways to quote" replaced by the three-ways model (blank/line-by-line kept as supporting footnote with accelerators); mobile added to hero/workflow intro/metadata; Smart Assistant row added to the feature table; Assistant messaging stays retrieval+confirmation.
2. **`/roofing-estimating-software`** — three-ways section after demo card (with one conversational example); mobile in metadata/hero/step 01/what-is/takeoff card; 2 new FAQs (phone/tablet estimating, what is Smart Assistant) — schema auto-syncs via `buildFaqSchema(faqs)`.
3. **`/roofing-quoting-software`** — three-ways section; 2 new bullets (mobile workflow, Smart Assistant); mobile sentence in workflow intro; 2 new FAQs (quote from phone, what can Smart Assistant do — includes the verified rate-adjustment example with confirmation language).
4. **`/roofing-takeoff-software`** — full mobile takeoff explicit in metadata/hero/what-is; **staged AI scan workflow** (scan → review/correct outline → component detection) in step 01 + AI FAQ + three-ways card; save-and-continue in step 02; new phone/tablet takeoff FAQ. Assistant deliberately secondary.
5. **`/construction-quoting-software`** — three-ways section; mobile in metadata/OG/hero/step 01; "site as much as office" added to who-it's-for list; 2 new FAQs added to BOTH the visible `faqs` array AND the separate `faqSchema` literal (this page duplicates them — kept in sync).
6. **`/construction-takeoff-software`** — mobile in metadata/OG/hero/what-is; paid-app vs free-tools mobile scoping kept honest; save-and-continue sentence; one light Smart Assistant sentence in the full-app workflow section; new phone/tablet FAQ.

### Tier B — feature pages (3)

7. **`/features/digital-roof-takeoff`** — phone/tablet/desktop in metadata/OG/hero/step 1; staged workflow in the AI card; mobile FAQ added to both schema and array.
8. **`/features/ai-scan-assist`** — H1 softened from "priced takeoff in seconds" to "scan the plan, review the result, keep control"; staged workflow in hero + step 2 (outline correction with draggable vertices); mobile FAQ + metadata.
9. **`/features/smart-components`** — new "Your logic, reused — by you or Smart Assistant" section (Assistant operates the user's saved rules, never invents pricing logic); Assistant FAQ.

### Tier C — light downstream updates (3)

10. **`/features/sending-and-tracking`** — mobile/Assistant status-check section + hero sentence + Assistant FAQ (follow-up automation claims unchanged).
11. **`/features/material-ordering`** — orders-live-with-the-job + Assistant order retrieval sentence; Assistant FAQ (creation/sending stays in the order builder — no overclaim).
12. **`/features/invoicing`** — unpaid/disputed invoice retrieval via Assistant sentence + FAQ (verified product capability).

### Tier D — reviewed, unchanged

- **`/done-for-you-setup`** — reviewed per matrix. No mobile/Assistant mentions exist; a concise addition would improve alignment BUT would imply setup-service scope (what Shaun's DFY service includes) that only the owner can define. Left unchanged; flagged as owner decision.

## Claim verification basis

- Mobile full takeoff (upload → scan → components → save & continue on phone/tablet): verified product capability.
- Staged AI scan (scan → correct outline vertices → component detection): verified product capability.
- Smart Assistant retrieval of jobs/quotes/orders/invoices + status (incl. unpaid invoices): verified product capability.
- Propose-then-confirm actions (e.g. rate adjustment on a quote): verified product capability.
- Assistant does NOT: perform takeoff geometry, create orders/invoices, act autonomously — copy never implies it does.

## Gates

- `npx tsc --noEmit`: **80 errors = exact baseline parity**.
- ESLint changed files: **0 new problems** vs HEAD (1227 before = 1227 after; new component 0).
- `npm run build`: **green** (clean re-run after an incidental stash window during the first pass — first pass also exited 0).
- `node scripts/seo-check.mjs`: 3 errors + 16 warnings — **identical to pre-change baseline** (all 3 errors are the pre-existing quotecore-nz sibling project, out of scope; no finding references a changed file).
- Greps: 0 "App Demo" claims/links in changed files; 0 "no card required"/desktop-only strings introduced. All canonical URLs preserved.

## Owner decisions still open

1. `/free-trial` slug retirement/redirect (carried from Phase 1A — unchanged).
2. Homepage stale structured/FAQ offer language (frozen; own controlled release).
3. Whether DFY setup packages should mention mobile/Assistant onboarding (service-scope claim = owner).
4. Free-tools mobile recoding (separate project per brief).
