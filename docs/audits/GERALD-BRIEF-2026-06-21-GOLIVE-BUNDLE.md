# Gerald Audit Brief — 2026-06-21 Go-Live Bundle

**Bundle:** `development → main` merge, new `main` HEAD = `70b0ca4`
**Audit range:** `3d8d311` (last main baseline, 2026-06-13) → `70b0ca4`
**Scope:** Everything merged to production since the 2026-06-13 pre-live remediation bundle.
**Stats:** 79 files changed, +6,836 / −1,903

---

## 1. Database Migrations (PRIORITY — RLS + integrity)

All applied to the shared Supabase project (`aaavvfttkesdzblttmby`). Audit RLS, tenant isolation, and constraint integrity on each:

| Migration | Purpose |
|---|---|
| `20260614100000_quantity_column.sql` | Adds `quantity` + `unit_price` to `customer_quote_lines`; `show_quantity_column` on `quotes`. |
| `20260614110000_hide_price_toggles.sql` | Adds `hide_line_prices` + `hide_totals` to `quotes` + `invoices`. |
| `20260614120000_margin_system.sql` | Per-line / blank-quote margin override system fields. |
| `20260614130000_quote_notes.sql` | New `quote_notes` table — **verify RLS tenant scoping.** |
| `20260615120000_quote_notes_integrity.sql` | Cross-tenant note integrity fix (Gerald H-02 class). |
| `20260615140000_quote_notes_length_caps_v2.sql` | Length caps on note fields (100/2000). |
| `backend/supabase/quotecore_v2_patch_018_base_unit_cost.sql` | Base unit cost field patch. |

---

## 2. New API Routes (audit auth + method guards)

| Route | Notes |
|---|---|
| `app/api/cron/expire-quotes/route.ts` | **Cron — auto-expire quotes.** Verify cron-secret auth + atomicity. |
| `app/api/invoices/quote-search/route.ts` | Quote search for invoice-from-quote. Verify tenant scoping. |

---

## 3. Feature Areas (by theme)

### Quantity Column + Shared Line Modal
- New `AddLineItemModal.tsx` (shared invoice-style modal).
- `customer_quote_lines` qty/unit_price; `BlankQuoteBuilder` **removed**, replaced by `CustomerQuoteEditor` with empty areas.
- `QuotePreview` table layout for qty alignment.
- `lineByLine.ts`: `hideAllPrices` split → `hideLinePrices` + `hideTotals`.

### Margin System
- Per-line margin overrides; blank-quote margin system; Material/Labour split margin preview rows.
- Original/Current Summary tabs with JSONB snapshot on first visit.
- **Already passed Gerald re-audit rounds (H-04, H-05, M-03)** — re-verify in merged context.

### Quote Expiry
- Auto-expire cron + alerts; expiry display/edit on summary; expired badge.
- Gerald H-01 (atomic cron) + M-02 (customer expiry notification) previously applied.

### Quote Notes
- DB-backed CRUD, collapsible panel on quote summary.
- Cross-tenant integrity (H-02) + length caps (L-01) previously applied.

### Send / Token Security
- All send/export exits use committed token body (H-07).
- Stale token on expired-quote copy/email fixed (H-06).

### Invoice-from-Quote / Order-from-Quote
- New full-page line selectors (`InvoiceLineSelector`, `LineSelector`).
- Free-tier invoice gate; consistent nav gating (lock icon + splash) for Orders + Invoices.

### Takeoff / Components
- Left sidebar redesign (card layout, three-dot menu, search).
- Mid-quote Smart Component™ creation (`CreateSmartComponentModal.tsx`).
- Delete component library action + confirm modal.

### UX / Rebrand (text-only, low risk)
- Smart Components™ rebrand (URLs/identifiers unchanged).
- Tutorials button + "Start Here" tutorial card; Invoices card replaces Flashings on dashboard.
- "Item Cost" rename throughout; Flashings → Drawings/Images.
- Freestyle component renames: "Length × Height – Freestyle" → "Length x Height: Custom (m²)"; "Multi-Line Height × Length – Freestyle" → "Length x Height: Multi-Length Custom (m²)".

---

## 4. Prior Gerald Audit Coverage (context)

Briefs already in `docs/audits/` covering parts of this range — **already remediated, re-verify in merged state:**
- `GERALD-BRIEF-2026-06-14.md` (quote expiry + notes)
- `GERALD-BRIEF-2026-06-16-MARGIN-REMEDIATION{,-2,-3,-4}.md`

**Net new since those briefs (NOT yet audited):** the 2026-06-17→2026-06-20 UX/rebrand batch, mid-quote Smart Component creation, component-library delete, and the final modal/label fixes (`9203c2f`).

---

## 5. Suggested Audit Focus (80/20)

1. **`quote_notes` RLS + the two new cron routes** — highest risk (new tables, new auth surfaces).
2. **`CreateSmartComponentModal` save path** — writes to component library + quote; verify tenant scoping.
3. **Margin/qty money-math** — confirm no price/total drift in merged context.
4. Rebrand/label changes — low risk, spot-check only.

---

*Full commit list: `git log --oneline 3d8d311..70b0ca4` in repo.*
