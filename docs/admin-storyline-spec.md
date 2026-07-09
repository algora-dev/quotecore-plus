# Admin Quote Storyline Viewer — Spec

## Goal
Admin can search any user's quotes (and eventually orders/invoices) from the existing admin users page, click a quote, and see the full calculation storyline — raw inputs → pitch → waste → pack → costs — with export.

## Existing Infrastructure (reusable)
- `calc_audit` JSONB on every `quote_components` row (populated by `calcTracer.ts`)
- `CalcAuditPanel.tsx` on summary page (admin-only, collapsible) — reusable as per-component renderer
- Existing `/admin/users` page + `/admin/users/[userId]` detail page

## What to Build

### 1. Add Quote Search to Existing User Detail Page
- `/admin/users/[userId]` already exists — add a "Quotes" tab/section
- Search/filter by quote name, status, date range
- Each row: name, status, created/updated, total value, component count
- Click a quote → opens storyline view (modal or dedicated route)

### 2. Storyline View
- **Header:** quote ID, customer, status, total value
- **Per-component timeline:** name → measurement type → each entry's journey:
  - Raw input value
  - Pitch applied (factor + degrees + type: rafter/valley_hip/none)
  - Waste applied (type + amount)
  - Pack rounding (if applicable)
  - Final quantity
  - Material cost → Labour cost → Total
- **Override history:** if any pitch/waste/rate was manually overridden, show: what changed, from → to
- **Takeoff measurements:** link to raw canvas measurements (area/line points, calibration scale) that fed each entry
- **Export:** "Download .txt" / "Print PDF" button (reuse CalcAuditPanel copy/download pattern)

### 3. Future Expansion
- Same search + storyline pattern extends to orders and invoices on the same user detail page
- Eventually: append-only event trail for court-grade audit (separate, bigger piece — v2)

## Data Joins (all in same DB, no new tables)
- `quotes` → `quote_components` (calc_audit + settings)
- `quote_components` → `quote_component_entries` (per-entry raw + value_after_waste + entry_inputs)
- `quote_components` → `quote_roof_areas` (area name + pitch context)
- `quote_component_entries` → `quote_takeoff_measurements` (canvas points, calibration, source)

## Effort
~1 day. Data is all there — read-only admin view with joins + UI. CalcAuditPanel reusable. Main work: quote search on user detail page + storyline layout.

## Limitation
Reconstructs story from final saved state + audit snapshots — not a keystroke log. If user deletes and redraws before saving, only final version is retained. v1 covers "show me exactly how this number was produced" (the liability question).
