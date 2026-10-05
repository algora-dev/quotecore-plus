# QuoteCore+ — UX Phase 7 handoff (external agent) — REV 2

**Baseline commit:** `01fc47e1` (branch `ux/phase-4`). This zip is that exact tree plus ONLY the `docs/ux/phase-7/` handoff files. All drift checks anchor here.
**Date:** 2026-09-27. **From:** Gavin (integration owner). **Owner:** Shaun (approves all merges).

## Standing design language (applies to all your work)

Phase 6 shipped, passed the owner's first review ("pretty good"), and is live on the testing deployment. Do not regress it. The standard is now:
- **P6-D01 (owner-approved):** v2 orange-gradient primary, near-black secondary, rounded rectangular controls, visible keyboard focus. Do NOT bring legacy black-pill button rules into migrated or new surfaces.
- Primitives: `QcJourney`/`qc-journeys.css` (C63, composes C27 QcDialog + C53 QcHostedDialog), PasswordField/TaxEditor `appearance="v2"` opt-in pattern.
- Reference implementations IN THIS BASELINE: `QuotesList.tsx`, `orders-hub.tsx`, `InvoiceList.tsx`, `catalog-list.tsx` (dedicated 190px row-actions column — the owner-requested pattern for row actions), `AccountTabs.tsx`, login/signup/paywall pages.

## What changed since your Phase 6 return (integration context)

Gavin integrated your Phase 6 return (all 60 files, zero drift, zero conflicts), ran all release gates (TypeScript exact parity, lint zero problems in changed files, Next build green), deployed, and the owner tested it. On top of your work, Gavin shipped two owner-requested fixes that are in this baseline:
1. **Resource Library button REMOVED from the quotes list** (owner decision — do not re-add it).
2. **Catalog list rows: dedicated 190px Actions column** (hover icons no longer overlap Last Activity; Size/Status columns tightened; header matches). This is now the reference pattern for row actions.

## Phase 7 scope

### A. Owner-flagged (mandatory)

1. **Mobile back-button sweep.** Several pages on mobile have no visible way back except the browser back button. Every page reachable on mobile gets an easy-to-see back control matching the breadcrumb/back pattern used across already-migrated pages (consistent placement + behaviour). Audit ALL app surfaces — Phase 6 pages included — desktop consistency where natural. This is the owner's #1 annoyance.
2. **Resources hub + template surfaces** (not yet migrated): `/resources` index + `/resources/[topic]`; quote templates (list / create / build / save-from-quote / `[id]` edit — incl. `TemplateBuilder.tsx` / `TemplateEditor.tsx`); customer quote templates (list / create / build / edit); message templates; order-header templates; quote-header templates; invoice templates (list / new / `[id]` edit); resources attachments (verify consistency with Phase 6 upload patterns).
3. **Pricing Library (Smart Components):** `/[workspaceSlug]/components` surfaces to the new language.
4. **Supplier surfaces:** `/[workspaceSlug]/supplier` portal + `/supplier-directory` + library detail pages.
5. **Inbox / message center** (`/[workspaceSlug]/inbox`).

### B. Carry-over items you flagged in your Phase 6 return — now in your scope

From your `docs/ux/phase-6/AGENT_TODOS.md`:
- **P6-DATA-01:** pass the Quotes loader's existing error context through to `QuotesList` under the owned contract — no fabricated "empty = success".
- **P6-DATA-03:** quote/template creation pickers — distinguishable empty vs error states in the owned loading code.
- **P6-CATALOG-01:** move `AddFromCatalogModal`'s render-time `loadMyCatalogs()` (useMemo) to an effect with correct dependencies/cancellation.
- **P6-ONBOARD-01:** completed-onboarding literal `href="/${companySlug}/tutorials"` — resolve to the correct current tutorials route.
- **P6-BILLING-01:** signup/paywall hardcoded prices/guarantee copy — align with the actual plan data already passed in (prices themselves are owner-locked values; use existing plan inputs, no new numbers).

(Remaining P6 items — real-dialog focus/Escape checks, mobile shell safe-area checks, entitlement timing — are runtime verification and stay with Gavin.)

### Quality bar — mobile-first

**390px audit of ALL Phase 6 surfaces + your new work:** rows, bulk trays, dialogs, soft-keyboard behaviour, no horizontal overflow, nothing unreachable. Mobile usability is the owner's core strategic theme this cycle — treat phone-width as a first-class deliverable, not an afterthought. Also check ~320px and landscape.

## Protected — read-only, do not modify

- Smart Assistant (all code), Takeoff + mobile takeoff flows, C59/C60 shared recipient renderers, pricing/calc engines, billing/Stripe LOGIC (labels/presentation may improve; numbers and flows may not), auth/cookie/middleware logic, `app/lib/conversions.ts` (truncated constants by design), `app/lib/supabase/database.types.ts` (**UTF-16 LE — edit tools corrupt it**), API routes, server actions, migrations, configs, dependencies. No new GitHub Actions workflows.
- **Quote builder internals (`/quotes/[id]/build`, labor, blank-build) are NOT in scope this phase.** Presentation-only touches require an explicit owner-decision entry.
- Prices everywhere are owner-locked. Presentation may change, numbers may not.
- Real status enums (never invent values): quote `draft|confirmed|sent|accepted|declined|expired|archived`; invoice `draft|sent|viewed|payment_reported|paid|disputed|cancelled`; orders menu keeps its six legacy action states (ready/ordered/delivered/paid/pickup/waiting).

## Verification approach (REV 2 — owner-approved)

**Do NOT attempt `npm install`, `npx tsc`, or `npm run build`.** Your environment cannot run them, and that is expected — the owner has approved this loop. This is exactly how Phase 6 shipped and it integrated cleanly.

Instead:
- Run the source-level checks you can do (syntax/transpilation of changed files, static fixture renders, your source-invariant comparisons) as you did in Phase 6.
- Be precise and truthful about what was and wasn't verified in your return notes.
- **ALL release gates — dependency-complete TypeScript, Next build, runtime testing, drift verification — are Gavin's at integration.** That worked perfectly for Phase 6 (zero new type errors, zero lint problems, green build, zero drift outside manifest).

## Return format

- Full-source zip with `quotecore-plus/` wrapper.
- `START_HERE_RETURN.md` at zip ROOT.
- `RETURN_NOTES.md`, `FILE_CHANGES.json` (complete added/modified list), `DESIGN_CHANGES.md` in `docs/ux/phase-7/`.
- Every owner decision point listed explicitly — never chosen silently.
- LF line endings in all new/changed files.
