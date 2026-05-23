# Audit Brief: QuoteCore+ — Round 7
**Date:** 2026-05-23
**Branch:** `development` (HEAD: `45046c2`)
**Auditor:** Gerald
**Requested by:** Gavin / Shaun

---

## Context

Round 6 findings have all been addressed (H-01, H-02, H-03, M-02, M-03). This round covers the new **Cladding trade system** and supporting changes shipped since round 6. The generic trades flag (`NEXT_PUBLIC_GENERIC_TRADES_V1` / `GENERIC_TRADES_V1_ENABLED`) is still ON for preview, OFF for production.

---

## What Changed Since Round 6

### 1. Trade config system (`app/lib/trades/labels.ts`)
The `TradeLabels` interface was significantly expanded. All UI copy that varies by trade (area labels, modal titles, pitch requirement, tool guidance notes, instructions text, builder step labels, customer quote section labels, measurement type display name overrides) now lives in one config object per trade. `getTradeLabels(trade)` is the single accessor used everywhere.

**Three trades now defined:** `roofing`, `cladding`, `generic`.

Key new fields on `TradeLabels`:
- `pitchRequired` — controls pitch visibility throughout the app
- `areaIsOptional` — drives the post-calibration modal branch
- `createAreaModalTitle`, `areaNamePlaceholder` — AreaNameModal copy
- `toolGuidanceNote` — cladding-specific tip shown in the post-calibration modal
- `firstAreaInstructionsTitle/Body/ConfirmCta` — instructions modal content
- `builderStepLabel`, `emptyAreaGuardMessage` — quote builder copy
- `customerQuoteSectionLabel` — customer-facing quote
- `measurementTypeLabels` — per-trade overrides (e.g. `multi_lineal_lxh` → "Wall Length × Height" for cladding)

### 2. Cladding trade — DB
- New migration `20260523130000`: `cladding` added to the `trade` enum via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- Applied to production Supabase. Both `quotes.trade` and `companies.default_trade` accept `cladding`.

### 3. Measurement type whitelist (`app/lib/trades/measurement-type-whitelist.ts`)
`cladding` entry added. Allowed types: `area`, `multi_lineal_lxh`, `length_x_height`, `irregular_area`, `lineal`, `linear`, `multi_lineal`, `quantity`, `count`, `fixed`.

### 4. TakeoffWorkstation (`TakeoffWorkstation.tsx`)
- `quoteIsGeneric` boolean now derived from `tradeConfig.pitchRequired` rather than a hard `=== 'generic'` check. Covers all non-roofing trades.
- Post-calibration instructions modal is fully config-driven via `tradeConfig` (title, body, CTA, optional area prompt, tool guidance note).
- `AreaNameModal` receives `isRoofing`, `modalTitle`, `namePlaceholder` from trade config.
- Sidebar heading ("Areas" vs "Roof Areas" vs "Wall Areas") driven by config.
- Tool button tooltips (line/point) no longer show roofing-gate text for non-roofing quotes.
- All `strokeWidth` values halved from round 6, then line widths increased 25% and point marker radii decreased 25%.

### 5. Quote builder (`quote-builder.tsx`)
- Step 1 label uses `tradeLabels.builderStepLabel`.
- Empty area guard dialog uses `tradeLabels.emptyAreaGuardMessage`.
- Remove-area dialog title and fallback label are trade-aware.
- Area name input placeholder is trade-aware.
- `ExpandableComponent` sub-component uses `getTradeLabels(quote.trade)` for the "Use X area total" button.
- `quoteIsGeneric` now derived from `tradeLabels.areaIsOptional`.

### 6. Quote creation form (`QuoteDetailsForm.tsx`, `new/actions.ts`, `billing/quote-creation.ts`)
- `cladding` option added to the Trade dropdown.
- Type updated to `'roofing' | 'cladding' | 'generic'` in all three files.

### 7. Company Settings — default trade (`CompanySettingsForm.tsx`, `settings/actions.ts`)
- Default trade selector changed from radio buttons to a `<select>` dropdown.
- `cladding` added as an option.
- **New migration `20260523140000`:** `GRANT UPDATE (default_trade) ON public.companies TO authenticated` — this column was missing from the column-level whitelist introduced in round-3 H-01, causing a 500 on every Company Settings save. Applied to production.

### 8. Component library (`component-list.tsx`, `components/page.tsx`, `lib/data/company-context.ts`)
- `company.default_trade` now fetched and passed to `ComponentList`.
- `pitchVisible = getTradeLabels(companyDefaultTrade).pitchRequired` — pitch checkbox hidden for non-roofing company default trades (both create and edit forms).
- Roofing companies retain full pitch behaviour.
- Per-quote trade and company default trade are intentionally independent: a roofing company can create a cladding quote with no conflict.

### 9. Upload copy (trade-neutral)
- `QuoteDetailsForm`: "Upload Roof Plan" → "Upload Plans / Images" throughout.
- `FilesManager`: "Roof Plan" → "Plan / Image" throughout.
- `TakeoffWorkstation`: calibration tip updated to: *"Tip: Use existing dimensions on your image, we suggest using the longest lengths to calibrate from."*

### 10. Supabase types regenerated
`database.types.ts` regenerated twice — after `multi_lineal_lxh`/`fixed_per_segment` additions (round 6) and after `cladding` enum addition (this round).

---

## Audit Focus Areas

### Priority 1 — Security / correctness
1. **Column GRANT completeness:** `20260523140000` adds `default_trade` to the authenticated UPDATE whitelist. Are there any other columns recently added to `companies` that are missing from the whitelist and could cause silent failures?

2. **Trade enum on `create_quote_atomic`:** The RPC and surrounding server actions now accept `'cladding'`. Verify the server-side flag check in `new/actions.ts` (`genericFlagOn`) correctly gates cladding as it does generic — a request with `trade: 'cladding'` and flag off should fall back to the company default, not error.

3. **assertComponentCompatibleWithQuote:** Now called with `trade = 'cladding'`. Confirm it correctly uses the cladding allowlist from `measurement-type-whitelist.ts` and doesn't fall through to roofing or generic silently.

4. **`quoteIsGeneric` semantic change:** In `TakeoffWorkstation` and `quote-builder`, `quoteIsGeneric` now means `!pitchRequired` (true for cladding AND generic). Review any logic that should remain generic-only vs any-non-roofing — particularly the "Components visible without area" block in the quote builder that shows all components when `quoteIsGeneric && roofAreas.length === 0`.

### Priority 2 — Data integrity
5. **Pitch stored as 0 for cladding areas:** Generic/cladding areas are saved with `pitch = 0` via `handleSaveArea(name, 0)`. Verify the pricing engine doesn't apply a pitch factor when pitch is 0 (it should be a no-op, but confirm there's no divide-by-zero or unexpected multiplier).

6. **`recalcAllQuoteComponents` fan-out:** Added in round 6 H-03. Called after every `save_takeoff_atomic`. If a quote has many components this could be slow or hit Supabase rate limits. Assess whether this needs batching or a short-circuit for `per_unit` strategy components.

### Priority 3 — UX / correctness
7. **Cladding quote builder — area section heading:** The quote builder renders a hardcoded "Areas" heading in the areas phase panel. Confirm `tradeLabels.areaPluralLabel` (not the old hardcoded string) is used everywhere the heading appears in the builder, not just the step nav.

8. **Customer quote section label:** `tradeLabels.customerQuoteSectionLabel` is defined but confirm it's actually wired into the customer-facing quote render (`/quotes/[id]/customer`) — or flag if it's defined but not yet consumed.

9. **`measurementTypeLabels` consumption:** `TradeLabels.measurementTypeLabels` (e.g. cladding overrides `multi_lineal_lxh` → "Wall Length × Height") is defined but confirm it's consumed in the component form and quote builder display — or flag as defined-but-not-wired.

10. **M-01 carry-over (from round 6):** Manual quote builder doesn't apply height for `length_x_height` / `multi_lineal_lxh` components. This was deferred. Flag current state and risk for cladding users who manually add entries.

### Out of scope for this round
- Live Stripe / billing flows (unchanged)
- Full production build (run in Gavin's CI)
- Browser/manual UX testing

---

## Key Files

| Area | Path |
|---|---|
| Trade config | `app/lib/trades/labels.ts` |
| Measurement whitelist | `app/lib/trades/measurement-type-whitelist.ts` |
| TakeoffWorkstation | `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` |
| Quote builder | `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` |
| Quote create form | `app/(auth)/[workspaceSlug]/quotes/new/QuoteDetailsForm.tsx` |
| Quote create actions | `app/(auth)/[workspaceSlug]/quotes/new/actions.ts` |
| Company settings form | `app/(auth)/[workspaceSlug]/settings/CompanySettingsForm.tsx` |
| Settings actions | `app/(auth)/[workspaceSlug]/settings/actions.ts` |
| Component list | `app/(auth)/[workspaceSlug]/components/component-list.tsx` |
| Files manager | `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx` |
| Billing quote creation | `app/lib/billing/quote-creation.ts` |
| DB migrations | `backend/supabase/migrations/20260523120000_strategy_compat_multi_lineal_lxh.sql` |
| | `backend/supabase/migrations/20260523130000_trade_enum_cladding.sql` |
| | `backend/supabase/migrations/20260523140000_grant_default_trade_update.sql` |
| Generated types | `app/lib/supabase/database.types.ts` |
