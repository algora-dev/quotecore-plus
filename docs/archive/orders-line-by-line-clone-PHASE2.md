# Phase 2 — Line-by-Line Orders = cloned Customer Quote Editor

> Handoff spec. Phase 1 (Customer Quote Editor unified "Add New Line" modal) is
> SHIPPED on `development` (HEAD `21da3fe` at handoff). This doc is the locked
> plan for Phase 2. Shaun signed off all decisions below on 2026-06-04.

## Goal
Replace the bespoke line-by-line order editor with a CLONE of the Customer
Quote Editor system (same pattern as the labor-sheet reuse), repurposed for
orders. Single/double-column order layouts stay **100% untouched** — this only
replaces the `layout_mode = 'line_by_line'` path.

## What to clone vs repurpose (quote → order)
| Quote editor piece | Order clone |
|---|---|
| `QuoteRow` + quote id | `material_orders` row + **order_number** |
| Save → `customer_quote_lines` (`saveCustomerQuoteLines`) | Save → `material_orders.line_by_line_data` (JSONB) via an order save action (reuse `saveDraftOrder` shape or a focused new action) |
| Header/footer → quote `cq_*` cols + `saveCustomerQuoteBranding` | **SWAP IN the existing ORDER header system** (supplier/contact/delivery/order number/dates/colours/logo/header_notes) — do NOT use the quote header |
| Templates → `customer_quote_templates` | **Order Templates** (`material_order_templates`) dropdown — must pre-populate the header |
| Taxes → `quote_taxes`, force-seeded from company defaults | **Optional taxes**: default = NO tax. User can add a custom tax, OR pull the company default tax setting. NOT auto-seeded/forced. |
| Components from quote takeoff | The new **3-option "Add New Line"** modal (custom / component / catalog) — already built in Phase 1, reuse it |
| Body + preview + footer + line edit (pencil) | Clone as-is |

## Locked decisions (Shaun, 2026-06-04)
1. **Taxes**: optional. Default none. Offer (a) add custom tax, and (b) apply
   company default tax setting. Never auto-force like the quote editor does.
2. **Line storage**: reuse `material_orders.line_by_line_data` (JSONB). NO new
   table, NO migration. The cloned editor's line shape
   (text, quantityText, amount, showPrice, showUnits, isVisible,
   includeInTotal, sortOrder, type, componentId) maps into this JSONB.
   Existing shape is `LineByLineItem` in `material-orders/lineByLine.ts` —
   reconcile: extend that type or map between the editor line and it. Existing
   `OrderBody` render + preview/PDF already consume `LineByLineItem`, so the
   saved JSONB MUST stay compatible with `parseLineByLineData` / `lineDisplayText`.
3. **Header**: SWAP — keep the existing structured order header form
   (supplier/contact/delivery/order number etc.), wired to Order Templates for
   pre-population. Use the cloned quote editor for everything else (body,
   preview, footer notes, add-line modal). PREFERRED: header also drives the
   live preview. ACCEPTABLE FALLBACK: if live-wiring the order header into the
   cloned preview is too invasive, header connects on save (preview reflects it
   after save) — that's fine.
4. **Order-from-quote** (CONFIRM with Shaun if not already answered): assume
   YES — carry the quote's lines/components into the line-by-line editor as
   starting lines (preserve current order-from-quote mapping). Verify before
   building.

## Key source files
- Clone FROM: `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` (953 lines)
  - Reusable precedent: `app/(auth)/[workspaceSlug]/quotes/[id]/labor-sheet/LaborSheetEditorWrapper.tsx` (uses the editor via `customSaveAction`/title/`taxAudience` props)
  - Already-built shared modal: `customer-edit/AddLineModal.tsx` (+ `CatalogSearchModal.tsx`, `LineEditForm.tsx`, `QuotePreview.tsx`, `EditHeaderModal.tsx`, `EditFooterModal.tsx`)
- Order side:
  - `material-orders/create/order-create-form.tsx` (orchestrator; has the layout gate + AddItemModal for components layout)
  - `material-orders/create/OrderLineByLineEditor.tsx` (the bespoke editor to RETIRE for line_by_line)
  - `material-orders/create/order-actions.ts` (`saveDraftOrder`, SaveOrderInput — header + lineByLineData JSONB + material_order_lines)
  - `material-orders/create/order-loader.ts`, `create/page.tsx`, `create/quote-loader.ts`
  - `material-orders/lineByLine.ts` (`LineByLineItem`, `parseLineByLineData`, `lineDisplayText`, `lineByLineTotal`)
  - Templates: `material-orders/template-*.ts(x)`
  - `material_orders` columns (confirmed in database.types.ts): order_number, line_by_line_data (Json), layout_mode, template_id, header_notes, logo_url, supplier_name/contact, contact_person/details, delivery_date/address, order_date, order_type, colours, job_name, quote_id (nullable)

## Build order (suggested)
1. Decide reuse-vs-clone of `CustomerQuoteEditor`. Recommendation: CLONE to a new
   `OrderQuoteEditor.tsx` (Shaun explicitly said "copy the entire system"),
   because order header/taxes/save diverge enough that prop-threading would
   bloat the quote editor. Keep AddLineModal/CatalogSearchModal/LineEditForm
   SHARED (import from customer-edit) — don't duplicate those.
2. New order save action: persist editor lines → `line_by_line_data` JSONB
   (compatible with `LineByLineItem` consumers) + header fields.
3. Wire Order Templates dropdown → pre-populate header.
4. Optional taxes UI (default off; custom + company-default options).
5. Mount the clone for `layout_mode==='line_by_line'` in order-create-form
   (custom order AND order-from-quote). Leave single/double untouched.
6. Order-from-quote: seed lines from quote (confirm decision #4 first).
7. `next build` must pass. Verify preview + PDF still render line_by_line via
   `OrderBody`. Smoke-test add-line (all 3 tabs), save, reopen, preview, PDF.

## Guardrails
- No schema change expected (decision #2). If one becomes necessary, it's
  pre-authorized (additive/nullable) per MEMORY STANDING PERMISSIONS — but
  confirm it's truly needed first.
- Do NOT touch single/double-column order layouts.
- Keep AddLineModal & friends shared, not duplicated.
- This is architecture work → run on Opus, plan before bulk edits.
