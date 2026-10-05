# QuoteCore+ — UX Phase 6 handoff (external agent)

**Baseline commit:** `4106026a` (branch `ux/phase-4`). All drift checks anchor here. This zip is that exact tree plus ONLY the `docs/ux/phase-6/` handoff files (brief + this START_HERE).
**Date:** 2026-09-27. **From:** Gavin (integration owner). **Owner:** Shaun (approves all merges).

## What this codebase already contains

Phases 1–5 of the UX overhaul are INTEGRATED and live on the testing deployment:

- **Phase 1–2ab:** shell, navigation, workspace surfaces.
- **Phase 3:** Job Spaces index + single orange sidebar edge tab. (Draft-quotes split was CANCELLED by owner — `/quotes` structure stays as-is.)
- **Phase 4:** desktop takeoff (workstation, modals, scan flow) + six owner fix rounds.
- **Phase 5 (Document Studio):** quote/order/invoice editors — C55 workspace, C58 inspector/toolbar, C59/C60 SHARED recipient renderers (QuotePreview/InvoicePreview/OrderBody used across authenticated + public + export surfaces), order family picker + line editor, embedded component editor, Apply-changes line-draft gating.
- Post-Phase-5 polish: quote + invoice "load from saved template" dropdowns, hover-overlay exclusion fix in `qc-document.css`, italics/spacing, canvas component-picker fix + Alt-drag pan.

The Smart Assistant V2 lane (P0–P4, P1.5/P1.6/P1.7 retrieval intelligence) is also fully integrated in this tree. It is NOT part of your scope.

## Phase 6 scope (owner's gap list)

Bring the REMAINING surfaces up to the new design language, desktop + mobile:

1. **List/index pages:** quotes list (`/quotes`), orders hub, invoices list. Keep structure; restyle + interactions. Job Spaces index is already new — match it.
2. **In-between modals:** every pop-up connecting the already-redesigned major steps (send/share quote, confirm dialogs, pickers, wizards). Mixed old/new between major steps is the current known state — you are filling exactly these gaps.
3. **Catalog upload + catalog-to-components flow.**
4. **File uploads.**
5. **Account settings / billing pages.**
6. **Auth flow: login, signup, onboarding, paywall.** This is a PAID-ONLY app: no free trial, no free signup. New signup → onboarding → `/paywall` → pay → workspace. The paywall gate lives in `[workspaceSlug]/layout.tsx` on `!entitlements.isActive`. Do NOT redesign the business logic of the funnel, only its UX.

## Hard rules — read before writing any UI

1. **Read `docs/DESIGN_SYSTEM.md` first.** Non-negotiable patterns: `rounded-full` buttons (primary `bg-black`, accent `bg-[#FF6B35]`), Heroicons outline 24×24, list-row hover `hover:bg-orange-50/40 hover:border-orange-200`, status badges `rounded-full px-2.5 py-1 text-xs` with dot, filter tabs `text-xs` active `bg-slate-900`, modal overlay `backdrop-blur-sm bg-black/40`, inputs `rounded-lg focus:border-orange-500` no ring. Reference implementations: `QuotesList.tsx`, `orders-hub.tsx`, `ConfirmModal.tsx`, and the Phase 5 Document Studio CSS scope.
2. **Protected surfaces — do not modify:**
   - All Smart Assistant code: assistant/sa API routes, lib, `sa_*` migrations, `scripts/test-sa-*`, env flags.
   - `app/lib/conversions.ts` — constants are TRUNCATED by design (M_TO_FT=3.28084 etc.). Never "fix" them.
   - `app/lib/supabase/database.types.ts` — **UTF-16 LE file; standard edit tools corrupt it.** If a type genuinely must change, use a Node script (read/write utf16le, preserve BOM). Prefer not changing it.
   - Pricing/calculation logic, Stripe billing logic, RLS policies.
   - M10/M11 mobile takeoff flows (touch presentation, overlay canvases, one-panel rule: no footer-pinned buttons over rails).
   - Auth cookie config (180-day maxAge is intentional — fixes PWA logout).
   - C59/C60 shared recipient renderers: list/detail pages must LINK into editors and REUSE them; never fork a second preview renderer.
3. **Real status enums (never invent values):** quote `draft|confirmed|sent|accepted|declined|expired|archived`; invoice `draft|sent|viewed|payment_reported|paid|disputed|cancelled`; orders `ready|ordered`.
4. **Mobile:** standard responsive patterns; any touch-specific takeoff rules stay untouched.
5. No new GitHub Actions workflows. No dependency upgrades. No env changes.

## Verification bar (your return is rejected without these)

- `npx tsc --noEmit` — zero NEW errors vs baseline (your Phase 5 return shipped with tsc never run; that caused integration build failures — this time run it).
- `npm run build` green, on the locked dependency set.
- LF line endings everywhere new/changed.
- Zero changes outside your scope manifest.

## Return format

- Full-source zip with `quotecore-plus/` wrapper (flat exports read as "missing stuff").
- `START_HERE_RETURN.md` at zip ROOT.
- `RETURN_NOTES.md`, `FILE_CHANGES.json` (full list, added/modified), `DESIGN_CHANGES.md` in `docs/ux/phase-6/`.
- List any owner decision points you hit, explicitly — do not silently choose.

## Known context you may need

- Public share/export surfaces reuse the same renderers as the editors — links/exports from your list pages must hit the same components.
- `quotes.quote_number` is string|number at the DB-type level; drafts have NO quote number.
- Supabase numeric fields arrive as strings at runtime.
- The old UX still lives in the steps BETWEEN redesigned surfaces — that is expected; you are replacing those, not reconciling them.
