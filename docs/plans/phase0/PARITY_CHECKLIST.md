# Parity Checklist - Shared Roof Takeoff Migration

**Purpose:** Every behaviour the shared package must reproduce before cutover.
Check each item against both Guided and Fast layouts.
Mark PASS only after automated or manual verification on Vercel preview.

## 1. Measurement Modes

- [ ] Actual mode: enter final roof dimensions, no pitch calculation
- [ ] Plan mode: enter plan dimensions + pitch, sloped values calculated
- [ ] Plan mode: rafter pitch factor applied to roof_area, barge, underlay, fixings
- [ ] Plan mode: hip/valley pitch factor applied to hip, valley
- [ ] Plan mode: no pitch factor on ridge, spouting (pitchType: none)
- [ ] Plan mode: master pitch change recalculates all entries in real time
- [ ] Plan mode: pitch input accepts both degrees and ratio (5:12)
- [ ] Plan mode: ratio <-> degrees conversion is correct for metric (rise:10) and imperial (rise:12)

## 2. Unit Systems

- [ ] Metric: lengths in m, areas in m2
- [ ] Imperial: lengths in ft, areas in sq ft
- [ ] Squares: areas in squares, no auto-conversion for total input
- [ ] Squares: plan-mode dimensions divide by 100 (areaValueForUnit)
- [ ] Unit system driven by supplier context when supplier selected

## 3. Component Types (Built-in)

- [ ] roof_area: width x length or total area input
- [ ] roof_area: dimensions mode and total mode toggle
- [ ] ridge: linear measurement
- [ ] hip: linear measurement, hip_valley pitch
- [ ] valley: linear measurement, hip_valley pitch
- [ ] barge: linear measurement, rafter pitch
- [ ] spouting: linear measurement, no pitch
- [ ] underlay: area measurement, rafter pitch, "Use Roof Area" button
- [ ] fixings: area measurement, rafter pitch, "Use Roof Area" button

## 4. Custom Components

- [ ] Create custom linear component (name, measurementType: linear, pitchType, waste)
- [ ] Create custom area component (measurementType: area)
- [ ] Create custom fixed component (measurementType: fixed)
- [ ] Fixed component: rawTotal = sum of quantities (not computed values)
- [ ] Fixed component: no waste applied
- [ ] Fixed component: known-price supported
- [ ] Remove custom component
- [ ] Custom component persists in section state

## 5. Known-Price Entries

- [ ] Entry with knownPrice uses knownPrice * quantity for materialCost
- [ ] Known-price entry does not use component pricing
- [ ] Known-price entry still contributes to labourCost if component selected
- [ ] Known-price = 0 or null falls back to component pricing

## 6. Pricing

- [ ] Per-unit pricing: qty * price_per_unit
- [ ] Pack pricing: ceil(qty / pack_size) * pack_price
- [ ] Pack pricing: pack_price falls back to price_per_unit if null
- [ ] Labour: per_unit (qty * labour_rate)
- [ ] Labour: fixed (labour_rate, regardless of qty)
- [ ] Labour: hourly (qty * labour_rate)
- [ ] Labour: 0 rate produces 0 labour cost
- [ ] Material-only mode: no labour shown
- [ ] Material + install mode: labour shown
- [ ] Grand total = materialTotal + labourTotal

## 7. Waste

- [ ] Default waste per component type (roof_area: 10%, others: 5%)
- [ ] Custom waste override per section
- [ ] Waste applied to withWaste total
- [ ] Waste applied to material cost calculation (materialQuantity = computedValue * (1 + waste%))
- [ ] Waste NOT applied to labour cost calculation (uses raw computedValue)
- [ ] Fixed components: 0% waste

## 8. Supplier Selection

- [ ] Supplier search by name
- [ ] Supplier filter by location
- [ ] Supplier filter by roof type
- [ ] Supplier preselection via /free-roofing-takeoff-builder/[supplierSlug]
- [ ] Supplier not found: show unavailable state
- [ ] Supplier catalogue loads into component dropdowns
- [ ] Supplier currency drives display
- [ ] Supplier unit system drives measurement units
- [ ] Supplier tax treatment displayed correctly
- [ ] Supplier change after data entry: confirmation before clearing
- [ ] No supplier selected: default components, pricing_unavailable warning

## 9. Results

- [ ] Results modal shows all sections with entries
- [ ] Per-section: raw total, with-waste total, material cost, labour cost
- [ ] Grand total displayed
- [ ] Print/PDF generates correct output
- [ ] Convert to quote redirects to quote builder with pre-filled data
- [ ] Result URL creation (result-token)
- [ ] Result page renders server-side (no JS required)
- [ ] Result token is deterministic (same input = same token)
- [ ] Tampered token rejected

## 10. Supplier Enquiry

- [ ] Enquiry modal opens from results
- [ ] Submits supplierSlug only (no email in client payload)
- [ ] Server resolves supplier email from slug
- [ ] Success confirmation shown
- [ ] Error state handled

## 11. Session and Navigation

- [ ] State persists to sessionStorage during builder use
- [ ] Leave warning when unsaved changes
- [ ] Start over resets all state
- [ ] Layout switching (Guided <-> Fast) preserves all entries
- [ ] Back button navigation works in Guided mode

## 12. API and Agent Access

- [ ] GET /free-roofing-takeoff-builder/calculate?... redirects to result page
- [ ] /api/public/roof-takeoff/schema returns correct JSON
- [ ] /api/public/roof-takeoff/calculate returns correct JSON
- [ ] /api/public/roof-takeoff/openapi returns correct spec
- [ ] /mcp endpoint works
- [ ] Result page is server-rendered, no JS needed
- [ ] URL encoding: only values encoded, not separators

## 13. Mobile

- [ ] All step screens render correctly on mobile
- [ ] Forms are usable on mobile (touch targets >= 44px)
- [ ] Results modal scrolls correctly on mobile
- [ ] Print/PDF works on mobile
- [ ] Supplier search usable on mobile

## 14. Desktop

- [ ] All layouts render correctly at desktop widths
- [ ] Fast layout (classic) accordion expand/collapse works
- [ ] Guided layout (forms) step navigation works
- [ ] Hover states work on desktop
- [ ] Keyboard navigation works

## Completion Criteria

- All items PASS
- No P0/P1 parity failures
- Shaun approves preview
- Rollback verified (feature flag can disable shared builder)
