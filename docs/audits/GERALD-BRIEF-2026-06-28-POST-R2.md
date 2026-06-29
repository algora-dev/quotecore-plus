# Gerald Audit Brief — 2026-06-28 Post-R2 Bundle

**Audit type:** Full security audit of all changes since Gerald's R2 clearance
**Responds to:** Gerald R2 re-audit `06-reaudit-r2.md` (cleared commit `4b2dbb2` for go-live)
**Audit range:** `4b2dbb2..00dc8d9` on `development` (44 commits, 68 files, +3848/-840 lines)
**Bundle HEAD:** `00dc8d9`
**Date:** 2026-06-28
**Author:** Gavin (file-based handoff per STANDING PERMISSIONS)

---

## Summary

Since Gerald's R2 sign-off on `4b2dbb2` (2026-06-21), the following work has landed on `development`. No new API routes were added. No new public-facing endpoints. No new authentication surfaces. The changes are predominantly **client-side UI/UX** (drawing tools, angle calculator, order editor) and **pricing/display logic** (Fixed Quantity pricing model, pack-count display). Five new additive/nullable migrations were applied to the shared Supabase DB.

**Key security-relevant surfaces for Gerald to audit:**
1. Server action `addComponentEntry` — new `options` parameter with bypass flags that skip server-side multipliers
2. Server action `saveDraftOrder` — expanded `entry_mode` values + new `priced_quantity`/`measurement_display` columns written to DB
3. Five new DB migrations (all additive/nullable — no destructive changes)
4. `component_library` CHECK constraint relaxation on `depth_value_mm` for volume type

---

## 1. New Database Migrations (5, all additive/nullable)

### `20260622110000_fixed_quantity_priced_qty.sql`
- Adds `priced_quantity numeric NULL` to `quote_components`.
- Stores the rounded-up purchasable unit count (e.g. 5 bundles) used for Fixed Quantity pricing.
- NULL for per_unit components. No backfill required — `recalcComponentFromEntries` populates on next quote save.
- **Audit note:** No RLS change needed — column lives on existing `quote_components` table which already has company-scoped RLS.

### `20260622120000_pack_size_snapshot.sql`
- Adds `pack_size_snapshot numeric NULL` to `quote_components`.
- Captures pack size at pricing time so display can compute fractional pack counts without joining to `component_library`.
- NULL for per_unit. Additive/nullable, safe on shared DB.

### `20260622130000_add_solar_trade.sql`
- `ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'solar'`.
- Additive enum extension. No data change.

### `20260622140000_entry_mode_constraint.sql`
- Drops and recreates `material_order_lines_entry_mode_check` CHECK constraint.
- Old: `entry_mode IN ('single', 'multiple')`.
- New: `entry_mode IN ('single', 'multiple', 'linear', 'area', 'volume')`.
- **Audit note:** This is a constraint relaxation (more values accepted), not a tightening. No rows can violate the new constraint that didn't violate the old one.

### `20260628170000_order_lines_fixed_qty_display.sql`
- Adds `priced_quantity numeric NULL` and `measurement_display text NULL` to `material_order_lines`.
- Stores Fixed Quantity display overrides for order lines (mirrors `quote_components` columns).
- Additive/nullable. No backfill.

### `backend/supabase/migrations/20260628120000` + `20260628130000` (volume depth constraint)
- Two-step fix to `ck_component_library_depth_for_volume` CHECK constraint on `component_library`.
- **Before:** volume type REQUIRED `depth_value_mm` to be set.
- **After:** volume type can have ANY depth (including NULL) — `CHECK (measurement_type = 'volume' OR depth_value_mm IS NULL)`.
- Rationale: the new "Volume" manual entry toggle bypasses preset depth (direct m³ entry), so a volume component can be created without a preset depth.
- **Audit note:** This is a constraint relaxation. `NOT VALID` flag means existing rows aren't re-validated. Server-side code (`addComponentEntry` with `bypassDepthMultiplier`) handles the NULL-depth case gracefully (produces 0 volume if depth is NULL for area/volume modes that need it).
- **NOTE for Gerald:** These two migrations live in `backend/supabase/migrations/` (not `supabase/migrations/`). **Verified applied to shared DB — see §8 below for live DB proof.** The `20260628130000` version has the correct logic; `20260628120000` had a bug and was immediately superseded.

---

## 2. Server Action Changes

### `app/(auth)/[workspaceSlug]/quotes/actions.ts` — `addComponentEntry`

**Change:** New optional `options` parameter: `{ bypassHeightMultiplier?: boolean; bypassDepthMultiplier?: boolean }`.

When `bypassHeightMultiplier` is true, the server skips the height-multiplier application for `length_x_height`/`multi_lineal_lxh` types (user provided their own area). When `bypassDepthMultiplier` is true, the server skips the depth-multiplier for `volume` type (user provided direct m³).

**Security analysis:**
- The `options` parameter is passed from client-side code. A malicious client could send `bypassHeightMultiplier: true` to skip the multiplier and store a smaller area → lower price.
- **However:** This is not a privilege escalation. The user owns the quote and is setting their own measurement. The multiplier is a UX convenience (user enters length, server multiplies by preset height). Bypassing it just means the user entered the final area directly — which they could also do by calculating it themselves and using a different entry mode.
- The `verifyComponentOwnership` check still runs before any DB write. Company isolation is intact.
- **Risk: LOW.** The bypass flags affect calculation semantics, not authorization. A user can only bypass multipliers on their own company's components. The result is a different (potentially lower) price on their own quote — not a data breach or cross-company access.

**Other change:** `recalcComponentFromEntries` now returns the computed totals (including `priced_quantity`) instead of `void`. `addComponentEntry` and `removeComponentEntry` now return the updated component totals to the client. No security impact — same data the client already had access to via the quote.

**New `computePackCount` import** from pricing engine — pure calculation function, no DB access.

### `app/(auth)/[workspaceSlug]/material-orders/create/order-actions.ts` — `saveDraftOrder`

**Changes:**
1. `entry_mode` type expanded from `'single' | 'multiple'` to `'single' | 'linear' | 'area' | 'volume' | 'multiple'`. Matches the DB constraint change.
2. `lengths` array now stores entries for all non-`'single'` modes (was `'multiple'` only). Includes new optional `calcLength`/`calcWidth`/`calcDepth` fields per entry.
3. New `pricedQuantity` and `measurementDisplay` fields written to `material_order_lines` (the new nullable columns).
4. Error logging improved — full Supabase error JSON + first item sample logged to Vercel function logs.

**Security analysis:**
- All writes go through existing `requireCompanyContext()` + company-scoped insert. No new authorization surface.
- `pricedQuantity` and `measurementDisplay` are display-only fields stored from client input. A malicious client could inject arbitrary display strings. **Risk: LOW** — these are text/numeric display fields rendered in the order preview, not used for pricing or billing. XSS risk depends on rendering path (confirm OrderBody.tsx escapes/renders as text, not dangerouslySetInnerHTML).
- The expanded `entry_mode` values are validated by the DB CHECK constraint. Invalid values are rejected at the DB level.
- **Error logging change:** `console.error` now logs full error JSON including `linesError.message` and `lineItemsData[0]` (first order line). This could log PII (customer name, component names) to Vercel function logs. **Risk: LOW-MEDIUM** — Vercel logs are scoped to the project owner, but consider whether order line data should be in error logs.

### `app/(auth)/[workspaceSlug]/settings/actions.ts`
- Added `'solar'` to the `defaultTrade` union type in `CompanySettings`. Matches the DB enum extension. No other change.

---

## 3. Client-Side Changes (no server surface)

### Drawing / Flashings Canvas (`FlashingCanvas.tsx`, `AngleCalculatorWidget.tsx`, `AngleCalculatorModal.tsx`)
- Major rewrite of the angle calculator: new draggable floating widget, Change of Pitch direction (internal/external), Rafter Pitch calculator, Hip/Valley multi-pitch formula.
- New "Finish" button in FlashingCanvas toolbar (deselects everything, exits to neutral).
- New "Select All / Deselect All" behaviour.
- New per-measurement visibility toggles (text, arc ring, point markers).
- **No server-side changes.** All client-side canvas/Fabric.js logic. No new fetch calls, API routes, or server actions.

### Takeoff Workstation (`TakeoffWorkstation.tsx`)
- New Rectangle drag-to-draw area tool.
- Compact area sub-tool selector, tighter zoom controls.
- Updated tooltips/guidance text.
- **No server-side changes.** Uses existing `saveTakeoffMeasurements` server action.

### Quote Builder (`quote-builder.tsx`)
- New manual entry toggles for area/volume/l×h measurement types.
- Entry mode label renames: Manual→Component Quote, Digital→Digital Measure, Blank→Standard Quote.
- `addComponentEntry` now called with `options` (bypass flags) for direct-area/direct-volume entry modes.
- W×H tab renamed to W×L.
- **Server interaction:** Calls `addComponentEntry` with the new `options` parameter (see server action analysis above).

### Order Editor (`order-create-form.tsx`, `OrderLineByLineEditor.tsx`, `OrderBody.tsx`)
- Order items collapsed by default.
- Component header row click-to-expand.
- Fixed Quantity display: `Quantity: N (measurement)` with N in black, measurement in light grey.
- Editable Fixed Quantity display in order editor modal (number input + unit dropdown).
- Unit selector adapts to measurement system (metric/imperial_rs/imperial_ft).
- **No new server actions.** Uses existing `saveDraftOrder` with the expanded fields (see server action analysis above).

### Pricing Engine (`engine.ts`)
- New `fixed_per_segment` waste type in `applyWaste()` — falls back to fixed-waste behaviour for manual entries (1 segment per entry).
- New `computePackCount` export — pure calculation, no DB access.

### Conversions (`conversions.ts`)
- New `convertVolumeFt3`, `convertVolumeFt3ToMetric`, `volumeInputToMetric` functions — pure math, no I/O.

### Types (`types.ts`)
- New `addComponentEntry()` options type, `handleAddEntry()` options, entry mode types, `measurementTypeLabel()`, `getUnitLabel()`.
- All pure type/label functions.

### Trades (`labels.ts`, `measurement-type-whitelist.ts`)
- Added 'solar' trade labels and measurement type whitelist entry.

### Display Helpers (`displayHelpers.ts`)
- New `getUnitLabel()` function for measurement type → unit string mapping.

---

## 4. Files Changed (68 total)

### Server-side (security-relevant)
| File | Change |
|------|--------|
| `quotes/actions.ts` | `addComponentEntry` options + `recalcComponentFromEntries` return value |
| `material-orders/create/order-actions.ts` | Expanded `entry_mode`, new display fields, improved error logging |
| `settings/actions.ts` | `'solar'` trade type added |

### Database
| Migration | Change |
|-----------|--------|
| `20260622110000` | `quote_components.priced_quantity` (additive) |
| `20260622120000` | `quote_components.pack_size_snapshot` (additive) |
| `20260622130000` | `trade` enum + `'solar'` |
| `20260622140000` | `material_order_lines.entry_mode` CHECK constraint expanded |
| `20260628170000` | `material_order_lines.priced_quantity` + `measurement_display` (additive) |
| `backend/20260628120000` + `20260628130000` | `component_library.depth_value_mm` CHECK constraint relaxed for volume |

### Client-side (no server surface)
All other 60+ files are client-side React components, type definitions, calculation utilities, documentation, and smoke-test checklist updates.

---

## 5. Recommended Audit Focus

1. **`addComponentEntry` bypass flags** — Confirm that `bypassHeightMultiplier`/`bypassDepthMultiplier` cannot be exploited to affect other companies' data or bypass `verifyComponentOwnership`. (Expected: safe — user can only manipulate their own quote calculations.)

2. **`saveDraftOrder` display fields** — Confirm `priced_quantity` and `measurement_display` are rendered as text in `OrderBody.tsx` (not `dangerouslySetInnerHTML`). Confirm they're not used in any pricing/billing calculation on the server.

3. **Error logging PII** — `saveDraftOrder` now logs `lineItemsData[0]` to Vercel function logs on error. Assess whether this leaks customer/component PII beyond what's acceptable.

4. **Volume depth constraint relaxation** — Confirm the `NOT VALID` CHECK constraint on `component_library` doesn't allow non-volume components to set `depth_value_mm` (the constraint logic is `measurement_type = 'volume' OR depth_value_mm IS NULL` — verify this is correct).

5. **No new public endpoints** — Confirm no new routes under `app/api/` or `app/orders/[token]/` were added. (Expected: none — `OrderBody.tsx` changes are presentational only.)

6. **RLS coverage** — Confirm the new columns on `quote_components` and `material_order_lines` are covered by existing row-level security policies (they should be — column-level changes on existing tables inherit the table's RLS).

---

## 6. Build Status

`next build` passes clean on `development` at `00dc8d9`. All `supabase/migrations/` entries applied to shared Supabase DB. The `backend/supabase/migrations/` volume-depth constraint pair (`20260628120000` + `20260628130000`) is also applied — see §8 for proof.

---

## 7. Deferred from Previous Audits (unchanged)

M-04 (quote_notes immutable-col trigger), M-05 (ws/dompurify dep advisories), M-06 (HSTS+CSP), L-01..L-04 — all unchanged from R1/R2. Still Shaun's call on timing.

---

## 8. Live DB Verification — Gerald R3 Challenge (2026-06-29)

Gerald's Post-R2 review challenged two claims from this brief. Both are now verified against the live shared Supabase DB (project `aaavvfttkesdzblttmby`). Queries were executed via Management API `POST /v1/projects/<ref>/database/query` on 2026-06-29.

### 8.1 Volume depth constraint migration — VERIFIED APPLIED

**Question:** Was `backend/supabase/migrations/20260628130000_fix_volume_depth_constraint.sql` applied to the shared DB? Does the active constraint match the `20260628130000` logic (not the buggy `20260628120000`)?

**Query used:**
```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'ck_component_library_depth_for_volume';
```

**Result:**
```
conname:    ck_component_library_depth_for_volume
definition: CHECK (((measurement_type = 'volume'::measurement_type) OR (depth_value_mm IS NULL))) NOT VALID
```

**Confirmation:**
- The active constraint IS the `20260628130000` logic: `measurement_type = 'volume' OR depth_value_mm IS NULL`.
- The earlier buggy `20260628120000` logic (`measurement_type <> 'volume' AND depth_value_mm IS NULL` — which fails for volume rows) is NOT the active constraint. It was superseded by `20260628130000`.
- The `NOT VALID` flag means existing rows were not re-validated on apply, which is expected and safe for a constraint relaxation.

### 8.2 `quote_components` RLS — VERIFIED ACTIVE

**Question:** Does `public.quote_components` have company-scoped RLS? What is the policy definition?

**Query 1 — RLS enabled?**
```sql
SELECT c.relrowsecurity, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'quote_components';
```

**Result:**
```
relrowsecurity: true
relname:        quote_components
```

**Query 2 — Policy definition:**
```sql
SELECT polname, polcmd, polroles::regrole[] AS roles,
       pg_get_expr(polqual, polrelid) AS qual,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.quote_components'::regclass;
```

**Result:**
```
polname:     quote_components_all
polcmd:      *  (ALL)
roles:       {authenticated}

qual:
(EXISTS (
  SELECT 1
  FROM (quotes q
    JOIN quote_roof_areas qra ON ((qra.quote_id = q.id)))
  WHERE (((quote_components.quote_roof_area_id = qra.id)
          OR (quote_components.quote_roof_area_id IS NULL))
         AND (q.company_id = current_company_id())
         AND (q.id = qra.quote_id))
))

with_check:
(EXISTS (
  SELECT 1
  FROM quotes q
  WHERE ((q.id = quote_components.quote_id)
         AND (q.company_id = current_company_id()))
))
```

**Confirmation:**
- RLS is enabled on `quote_components` (`relrowsecurity = true`).
- The `quote_components_all` policy applies to `authenticated` role, command `ALL` (SELECT/INSERT/UPDATE/DELETE).
- The `qual` (read filter) scopes access through `quotes.company_id = current_company_id()` — a user can only see components whose parent quote belongs to their company.
- The `with_check` (write filter) scopes inserts/updates through the same `quotes.company_id = current_company_id()` join.
- This policy was created in an earlier migration outside the `4b2dbb2..00dc8d9` audit range, which is why repo search within that diff did not find it.

### 8.3 Remediation commit — error-log PII fix

Gerald flagged `saveDraftOrder` logging `lineItemsData[0]` (raw line-item content) to Vercel logs.

**Fix:** Commit `e3ea56e` on `development` (2026-06-29 07:49 +01:00). Error log now reports `lineItemsData.length` + `Object.keys(lineItemsData[0]).join(',')` — count and key shape only, no raw component names, measurements, or supplier data.

**Push status:** `e3ea56e` is committed locally on `development`, ahead of `origin/development` by 1 commit. Will be pushed with the next push to `origin/development`.

### 8.4 XSS — measurement_display + priced_quantity render path

Gerald confirmed (and Gavin agrees): both fields render as React text nodes in `app/orders/[token]/OrderBody.tsx:265-276`. No `dangerouslySetInnerHTML` in the render path. XSS risk is LOW. No action needed.
