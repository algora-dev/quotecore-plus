# Gerald Re-Audit Brief — Margin Remediation Round 2
**Date:** 2026-06-16
**Bundle HEAD:** `996e164` (branch: `development`)
**Scope:** Remediation of findings from `05-reaudit-remediation-1146f09.md`
**Requested by:** Shaun
**Prepared by:** Gavin

---

## Context

Gerald's re-audit (`05-reaudit-remediation-1146f09.md`) raised 2 new High findings and 1 Medium against the first remediation bundle `1146f09`. All three are addressed in this commit `996e164`.

---

## Fixes Shipped

### H-04 — Custom-line pencil edits saving as final price, stale base_unit_cost ✅ Fixed

**What changed:** `LineEditForm.tsx`, `QuotePreview.tsx`, `CustomerQuoteEditor.tsx`

The pencil (edit) path for custom lines now mirrors the add path — the user edits a **base cost**, and margin is applied at save time.

**`LineEditForm.tsx`:**
- Added `isCustomWithBaseCost` flag: `!isComponentLine && baseMaterialCost !== undefined`
- Amount field initialises from base cost, not margin-included price:
  - Qty column: `baseMaterialCost / initialQty`
  - No qty column: `baseMaterialCost`
- `recalcForMarginChange` returns early for custom base-cost lines — the base cost doesn't change when margin % changes; final amount is computed at save time
- On submit for custom base-cost lines: `newBaseCostTotal = editedUnitCost * qty`, `marginedTotal = newBaseCostTotal * (1 + effectiveMargin/100)`, `marginedUnitPrice = editedUnitCost * (1 + effectiveMargin/100)`. `baseMaterialCost` (the new base total) passed as 9th parameter to `onSave`
- Labels updated: "Unit Cost" (qty column) / "Cost" (no qty column) for custom lines, matching the add modal
- `onSave` signature extended with optional `baseMaterialCost?: number`

**`QuotePreview.tsx`:**
- `onSaveLine` prop signature extended with optional `baseMaterialCost?: number`
- Lambda passes `bmc` through to `onSaveLine`

**`CustomerQuoteEditor.tsx`:**
- `updateLine` extended with optional `newBaseMaterialCost?: number`
- When provided, `baseMaterialCost` in line state is updated so the next slider move recalculates from the edited base, not the pre-edit stale value
- `onSaveLine` callback passes `bmc` through to `updateLine`

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/LineEditForm.tsx`, `QuotePreview.tsx`, `CustomerQuoteEditor.tsx`

---

### H-05 — Copy Email exporting active no-expiry quote URL without committing sent/expiry state ✅ Fixed

**What changed:** `SendQuoteButton.tsx`

`handleCopyEmail` now calls `await ensureToken(true)` before building/copying the email text. Copying an email body containing a quote URL is a real export action — `acceptance_token_expires_at` and `job_status='sent'` are now committed before the URL leaves the app.

**Files:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx`

---

### M-03 — Lint errors on touched files ✅ Fixed

**What changed:** Four lint errors cleared across three files.

- `CustomerQuoteEditor.tsx`: `laborMarginEnabled` → `_laborMarginEnabled` (unused destructured state)
- `QuotePreview.tsx`: `showMarginInPreview` → `_showMarginInPreview` (unused destructured param)
- `AddLineItemModal.tsx`: removed unused `uuid()` helper function
- `AddLineItemModal.tsx`: `workspaceSlug` → `_workspaceSlug` (unused destructured prop)
- `AddLineItemModal.tsx`: catalog-loading `useEffect` rewritten as async `load()` with cancellation flag — fixes the synchronous setState-in-effect rule violation

**Files:** `CustomerQuoteEditor.tsx`, `QuotePreview.tsx`, `app/components/AddLineItemModal.tsx`

---

## Still Deferred

- **M-02** — `quote_component_id` not bound to same quote/company (server-side validation). Post-launch hardening, no change in this bundle.
- **L-02** — Assistant workflow allowlist/rate-limit. Shaun's call pre/post launch.

---

## Recommended Verification

1. Add a custom line (any tab) with a base unit cost at current global margin — confirm customer amount = base × (1 + margin%)
2. Pencil-edit that custom line — confirm the amount field shows the base cost (not the margin-included price), and label reads "Unit Cost" / "Cost"
3. Edit the unit cost to a new value and save — confirm saved customer amount reflects the new base × margin, and `base_unit_cost` in DB matches the edited base
4. Move global material slider after the edit — confirm recalculation uses the edited base cost, not the pre-edit value
5. Use Copy Email on a never-sent quote — confirm `job_status='sent'` and `acceptance_token_expires_at` are set before the clipboard write completes
6. Run targeted lint on touched files — confirm 0 errors
