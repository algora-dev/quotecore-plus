# QuoteCore+ — UX Phase 7 handoff (external agent)

**Baseline commit:** `01fc47e1` (branch `ux/phase-4`). This zip is that exact tree plus ONLY the `docs/ux/phase-7/` handoff files. All drift checks anchor here.
**Date:** 2026-09-27. **From:** Gavin (integration owner). **Owner:** Shaun (approves all merges).

## Standing design language (applies to all your work)

Phase 6 shipped and is owner-reviewed (verdict: "pretty good" — do not regress it). The standard is now:
- **P6-D01 (owner-approved):** v2 orange-gradient primary, near-black secondary, rounded rectangular controls, visible keyboard focus. Do NOT bring legacy black-pill button rules into migrated or new surfaces.
- Primitives: `QcJourney`/`qc-journeys.css` (C63, composes C27 QcDialog + C53 QcHostedDialog), PasswordField/TaxEditor `appearance="v2"` opt-in pattern.
- Reference implementations IN THIS BASELINE: `QuotesList.tsx`, `orders-hub.tsx`, `InvoiceList.tsx`, `catalog-list.tsx` (note the dedicated 190px row-actions column — the owner-requested pattern for row actions), `AccountTabs.tsx`, login/signup/paywall pages.
- Owner decisions already locked in baseline (do not undo): Resource Library button REMOVED from quotes list; catalog row actions in their own column.

## Phase 7 scope

**Mandatory — owner-flagged from his 2026-09-27 pass:**

1. **Mobile back-button sweep.** Several pages on mobile have no visible way back except the browser back button. Every page reachable on mobile gets an easy-to-see back control matching the breadcrumb/back pattern used across already-migrated pages (consistent placement + behaviour). Audit ALL app surfaces — Phase 6 pages included — desktop consistency where natural. This is the owner's #1 annoyance.
2. **Resources hub + template surfaces** (not yet migrated): `/resources` index + `/resources/[topic]`; quote templates (list / create / build / save-from-quote / `[id]` edit — incl. `TemplateBuilder.tsx` / `TemplateEditor.tsx`); customer quote templates (list / create / build / edit); message templates; order-header templates; quote-header templates; invoice templates (list / new / `[id]` edit); resources attachments (verify consistency with Phase 6 upload patterns).
3. **Pricing Library (Smart Components):** `/[workspaceSlug]/components` surfaces to the new language.
4. **Supplier surfaces:** `/[workspaceSlug]/supplier` portal + `/supplier-directory` + library detail pages.
5. **Inbox / message center** (`/[workspaceSlug]/inbox`).

**Quality bar — mobile-first:**

6. **390px audit of ALL Phase 6 surfaces + your new work:** rows, bulk trays, dialogs, soft-keyboard behaviour, no horizontal overflow, nothing unreachable. Mobile usability is the owner's core strategic theme this cycle — treat phone-width as a first-class deliverable, not an afterthought. Also check ~320px and landscape.

## Protected — read-only, do not modify

- Smart Assistant (all code), Takeoff + mobile takeoff flows, C59/C60 shared recipient renderers, pricing/calc engines, billing/Stripe LOGIC (labels/presentation may improve; numbers and flows may not), auth/cookie/middleware logic, `app/lib/conversions.ts` (truncated constants by design), `app/lib/supabase/database.types.ts` (**UTF-16 LE — edit tools corrupt it**), API routes, server actions, migrations, configs, dependencies. No new GitHub Actions workflows.
- **Quote builder internals (`/quotes/[id]/build`, labor, blank-build) are NOT in scope this phase.** Presentation-only touches require an explicit owner-decision entry.
- Prices everywhere are owner-locked. Presentation may change, numbers may not.
- Real status enums (never invent values): quote `draft|confirmed|sent|accepted|declined|expired|archived`; invoice `draft|sent|viewed|payment_reported|paid|disputed|cancelled`; orders menu keeps its six legacy action states (ready/ordered/delivered/paid/pickup/waiting).

## Verification bar (your return is rejected without these)

- **`npx tsc --noEmit` — zero NEW errors vs baseline, and `npm run build` green — RUN THEM YOURSELVES before returning.** The Phase 6 return shipped without either (locked deps unavailable); the owner approved it once as P6-D02 — that exception will NOT be granted again. Budget for install time; if install fails, stop and report instead of returning unverified source.
- LF line endings in all new/changed files.
- Zero changes outside your scope manifest.

## Return format

- Full-source zip with `quotecore-plus/` wrapper.
- `START_HERE_RETURN.md` at zip ROOT.
- `RETURN_NOTES.md`, `FILE_CHANGES.json` (complete added/modified list), `DESIGN_CHANGES.md` in `docs/ux/phase-7/`.
- Every owner decision point listed explicitly — never chosen silently.
