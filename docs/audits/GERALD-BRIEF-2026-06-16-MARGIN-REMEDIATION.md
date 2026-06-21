# Gerald Re-Audit Brief — Margin System Remediation
**Date:** 2026-06-16
**Bundle HEAD:** `1146f09` (branch: `development`)
**Scope:** Remediation of findings from `quotecore-plus-margin-system-audit-2026-06-16/04-report.md`
**Requested by:** Shaun
**Prepared by:** Gavin

---

## Context

Gerald's audit (`04-report.md`, 2026-06-16) raised 1 Critical, 3 High, 2 Medium findings against the margin system. All Critical and High findings plus M-01 have been addressed in this commit. M-02 is deferred (post-launch, see below).

One finding (H-01) was implemented differently to Gerald's recommendation, per Shaun's product decision — see details below.

---

## Fixes Shipped

### C-01 — Apply Global Margins persisting stale override prices ✅ Fixed

**What changed:** `handleApplyGlobalMargins` in `CustomerQuoteEditor.tsx`

Previously the function cleared per-line override flags (`lineMarginPercent`/`lineLaborMarginPercent`) but left `line.amount` untouched — meaning lines that had overrides were never recalculated, so their old override price was saved as the new "global" price.

**Now:** when clearing overrides, each line's amount is recomputed:
- **Component lines** (have `baseMaterialCost` + `baseLabourCost`): recomputed from true base costs at `globalMarginPercent` + `globalLaborMarginPercent`.
- **Custom lines with stored base cost** (new lines added after patch-018): recomputed from `baseMaterialCost` at `globalMarginPercent`.
- **Old custom lines without base cost** (pre-patch-018): proportional conversion using the outgoing `lineMarginPercent` — `base = amount / (1 + lineMarginPercent/100)`, `newAmount = base * (1 + globalMarginPercent/100)`.
- **Lines with no override** (`lineMarginPercent === null`): unchanged (already at global rate).

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx`

---

### H-01 — Custom line behaviour with global material slider ✅ Fixed (per Shaun's spec, not Gerald's recommendation)

**Product decision:** Gerald recommended exempting custom final-price lines from the global material slider. Shaun's spec is the opposite: the "price" field in the Add Line modal is a **base cost** (cost price before margin), and the global material margin is applied immediately on add. The slider should affect all lines. Labour margin never applies to custom lines — only components with labour defined in the quote builder phase carry labour margin.

**What changed:**

1. **`AddLineItemModal.tsx`** — "Unit Price" label renamed to "Unit Cost" on all three tabs (Custom / Catalog / Component) to communicate that the field is a base cost.

2. **`handleAddLineItem` in `CustomerQuoteEditor.tsx`** — On add, `amount = lineTotal * (1 + globalMarginPercent/100)`. `unitPrice` is also margin-adjusted for display. `baseMaterialCost = lineTotal` (the raw base cost) is stored in line state.

3. **`handleGlobalMarginChange` in `CustomerQuoteEditor.tsx`** — Custom lines with `baseMaterialCost` stored now use the direct formula `newAmount = baseMaterialCost * (1 + newMargin/100)` instead of the proportional fallback. Proportional fallback retained only for old lines without a stored base cost.

4. **DB migration `patch_018`** — Added `base_unit_cost NUMERIC DEFAULT NULL` to `customer_quote_lines`. Stored as `baseMaterialCost / qty` on save; restored as `base_unit_cost * qty` on load. Null for pre-018 rows and component lines (which use `quote_components.material_cost` instead).

5. **`saveCustomerQuoteLines` in `quotes/actions.ts`** — Accepts and persists `baseUnitCost` field → `base_unit_cost` column.

6. **Labour margin isolation confirmed:** `handleGlobalLaborMarginChange` opens with `if (line.type !== 'component') return line` — custom lines are never touched by the labour slider. `lineLaborMarginPercent` is not set for custom lines anywhere.

**Files:** `app/components/AddLineItemModal.tsx`, `CustomerQuoteEditor.tsx`, `quotes/actions.ts`, `backend/supabase/quotecore_v2_patch_018_base_unit_cost.sql`

---

### H-02 — Line pencil editor using stale material margin ✅ Fixed

**What changed:** `QuotePreview.tsx` `defaultMaterialMarginPercent` prop passed to `LineEditForm`.

Previously used `quote.material_margin_percent` (DB field, stale after live slider changes). Now mirrors the labour pattern: prefers `globalMarginPercent` (live prop from editor state) and falls back to the DB field when no live value is present.

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/QuotePreview.tsx`

---

### H-03 — applyExpiry=false marking never-tokened quotes as sent ✅ Fixed

**What changed:** `generateAcceptanceToken` in `quotes/actions.ts`, else branch (no existing token).

Previously the else branch always wrote `acceptance_token_expires_at` and `job_status: 'sent'` regardless of `applyExpiry`. Opening URL or email mode on a never-sent quote would silently mark it sent and start the expiry clock.

**Now:** the else branch always stores the token (so the URL is stable), but `acceptance_token_expires_at` and `job_status: 'sent'` are only written when `applyExpiry=true` (i.e. the user actually sends or copies the link).

Follow-on: the next call with `applyExpiry=true` hits the "live token exists" branch (token present, not withdrawn, not expired), which commits expiry + status as before.

**Files:** `app/(auth)/[workspaceSlug]/quotes/actions.ts`

---

### M-01 — Snapshot write unawaited on first render ✅ Fixed

**What changed:** `summary/page.tsx` original snapshot creation block.

Previously fire-and-forget (`.then(() => {})`), meaning silent failures and the Original/Current tabs not appearing on first visit. Now `await`ed with `console.error` on failure. On a successful first write, `snapshotRow` is updated in-place so `resolvedSnapshotData` picks up the new snapshot — Original tab appears immediately without a reload.

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx`

---

## Deferred

**M-02 — `quote_component_id` not bound to same quote/company (server-side validation)**
Deferred post-launch per original audit scope. No change in this bundle.

---

## Verification Suggestions

- Test against supplied quote `2370a7fe-be73-4c91-925b-af839a006889`
- Add a custom line (free text / catalog / component library tab), confirm margin is applied immediately at add time
- Move global material slider after adding a custom line, confirm amount recalculates from base cost (not proportionally from margin-included amount)
- Open a never-sent quote in URL/email mode without actually sending — confirm `job_status` stays `unsent` and no expiry is set
- Apply Global Margins on a quote with per-line overrides — confirm saved amounts match current global margin rate
- Pencil-edit a line after moving the material slider — confirm the default material % in the form matches the slider, not the DB

---

## Out of Scope for This Bundle
- L-02 assistant workflow allowlist/rate-limit (deferred, Shaun's call)
- M-02 component ID server-side validation (deferred post-launch)
