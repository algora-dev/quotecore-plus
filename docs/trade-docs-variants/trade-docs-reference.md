# Trade Docs Variant Reference
**Created:** 2026-05-23  
**Purpose:** Every passage in the user-facing docs that needs a trade-specific version.  
**How to use:** The current (roofing) text is shown under each item. The CLADDING column is blank for Shaun to fill in. When you are done, duplicate this file per trade and fill in your wording. The app will serve the right version based on the user's default trade.

---

## Structure at a glance

| Doc file | Trade-neutral? | Needs variant |
|---|---|---|
| `getting-started/set-up-your-company.mdx` | ✅ Mostly | 1 mention of "measurement units" could reference trade |
| `getting-started/your-first-quote.mdx` | ✅ Mostly | Step 4 (Areas description) |
| `building-a-quote/digital-takeoff.mdx` | ❌ No | Page description, what you can measure, worked flow |
| `building-a-quote/quote-builder.mdx` | ❌ No | Phase 1 (Areas) description |
| `building-a-quote/manual-quote.mdx` | ✅ Mostly | One "re-roofs" reference, plan/actual example |
| `building-a-quote/quote-summary.mdx` | ✅ Yes | Nothing needs changing |
| `components/overview.mdx` | ❌ No | What can be a component, system description |
| `components/creating-a-component.mdx` | ❌ No | Measurement method, pitch section, walked examples |
| `concepts/waste-and-pitch.mdx` | ❌ No | Entire pitch section + worked example + valleys/hips |
| `concepts/glossary.mdx` | ❌ No | "Roofing terms" section entirely, some QuoteCore+ terms |
| `customer-facing/*` | ✅ Yes | Nothing needs changing |
| `account/*` | ✅ Yes | Nothing needs changing |
| `templates/*` | ✅ Yes | Nothing needs changing |
| `files-and-quotes/*` | ✅ Yes | Nothing needs changing |

---

## 1. `building-a-quote/digital-takeoff.mdx`

This is the most trade-specific doc. Almost every sentence is roofing-flavoured.

---

### 1.1 — Page description (frontmatter + opening)

**ROOFING (current):**
```
description: Measure directly from a digital plan or image. One of the best tools for roofers and trades that quote from plans.

The digital takeoff system is one of our best solutions for roofers and trades who want to measure directly from a digital plan or image.

All you need is a reliable scale or defined measurement on that plan that you know is correct. In digital takeoff, the first step is calibrating the measurement system using that scale.

So long as you are confident in the accuracy of that measurement, you can essentially measure anything that is an area or a lineal item. The system is designed for roofs, but is also used for cladding, flooring, foundations, and more.
```

**CLADDING:**
> _[Shaun to fill in]_

---

### 1.2 — What you can measure

**ROOFING (current):**
```
- Multiple areas or roof sections, each with its own pitch.
- Individual components by area, lineal length, or as points for fixed or quantity-based components.
```

**CLADDING:**
> _[Shaun to fill in]_

---

### 1.3 — What happens next

**ROOFING (current):**
```
When you continue from digital takeoff into the quote builder, you will see each roof area, each component you measured, and its associated items.
```

**CLADDING:**
> _[Shaun to fill in — swap "roof area" for "wall area"]_

---

## 2. `building-a-quote/quote-builder.mdx`

Only Phase 1 (Areas) changes per trade. The rest is trade-neutral.

---

### 2.1 — Phase 1: Areas description

**ROOFING (current):**
```
### 1. Areas

Add or edit areas (main, garage, lean-to, dormer, etc.) and their names, the pitch if applicable, and the actual area measurements.
```

**CLADDING:**
> _[Shaun to fill in — example area names will be elevation names, no pitch]_

---

### 2.2 — Phase 2: Components description (minor)

**ROOFING (current):**
```
### 2. Components

Add or edit all aspects of the components you want in the quote: which areas they apply to, individual lengths, units, and items. Each component can be flipped between Plan and Actual here.
```

**CLADDING:**
> _[Likely minimal change — "Plan and Actual" may not apply the same way if pitch is not involved. Decide if this section needs a note or can stay as-is.]_

---

## 3. `building-a-quote/manual-quote.mdx`

Mostly neutral. Two spots to check.

---

### 3.1 — Plan vs Actual explanation

**ROOFING (current):**
```
Plan applies pitch and waste; Actual assumes you have already accounted for pitch yourself or measured the real length.

This is especially useful for re-roofs, or when you want to do a proper site measure after the initial plan-based quote was accepted.
```

**CLADDING:**
> _[Shaun to fill in — no pitch for cladding, "re-roofs" doesn't apply. What is the equivalent scenario?]_

---

## 4. `components/overview.mdx`

---

### 4.1 — What can be a component?

**ROOFING (current):**
```
Roofing tiles, longrun iron, metal flashings (ridge, hips, valleys, barge, custom), roofing underlay, netting, insulation, roofing membrane, fixings, skylights, metal fascia, gutter or spouting, downpipes. Absolutely anything that you use or install on a roof or job can be configured as a component.
```

**CLADDING:**
> _[Shaun to fill in — list cladding equivalents: cladding panels, battens, fixings, flashing, trims, sealant, etc.]_

---

### 4.2 — System description

**ROOFING (current):**
```
The library scales with the work. The system is tailored for roofing but can be adapted to include cladding, foundations, windows, flooring, and more.
```

**CLADDING:**
> _[Shaun to fill in — for cladding users this line should position it as built for cladding, not "adapted"]_

---

### 4.3 — Components overview intro

**ROOFING (current):**
```
Each component has a name, measurement type (lineal or area squared), cost per unit, labor cost per unit, pitch calculations for roofing, component waste settings, ability to add to orders, and more.
```

**CLADDING:**
> _[Remove "pitch calculations for roofing" — replace with measurement type note relevant to cladding, e.g. Wall Length × Height]_

---

## 5. `components/creating-a-component.mdx`

The most content to swap. Three sections plus the walked examples.

---

### 5.1 — Measurement method field description

**ROOFING (current):**
```
Measurement method. How your component is normally measured:

- Area (Rs / ft2 / m2) - for main roofing materials like tiles, longrun, membrane.
- Lineal - for flashings, gutter, spouting.
- Quantity or Fixed - for downpipes, chimney flashings, skylights, items priced per unit.
```

**CLADDING:**
> _[Shaun to fill in — add Wall Length × Height as the primary method; give cladding-specific examples for each type]_

---

### 5.2 — Pitch calculation field description

**ROOFING (current):**
```
Pitch calculation. Tick to apply a pitch type:

- Rafter pitch - main roof areas (tiles, longrun, underlay).
- Hip pitch - hip rafters.
- Valley pitch - valley rafters.

Pitch auto-calculates plan measurements into actual lengths, with waste added. You enter the actual pitch angle later during the quote builder. The hip and valley pitch types currently support 45-degree angles in plan view; tapered hips or valleys need extra length added manually.
```

**CLADDING:**
> _[This entire section is hidden in the UI for cladding users. The doc should either omit it entirely or replace it with a brief note explaining that cladding components don't require pitch — the height dimension is set on the component itself for Wall Length × Height types.]_

---

### 5.3 — Walked example: roofing tiles

**ROOFING (current):**
```
## Walked example: roofing tiles
1. Name: Roofing tiles - terracotta.
2. Type: Main.
3. Measurement: Area.
4. Material price: $10 per m2.
5. Labor price: $5 per m2.
6. Waste: Percentage, 5%.
7. Pitch: Rafter pitch.
8. Material orders: On.
```

**CLADDING:**
> _[Shaun to fill in — e.g. a cladding panel example: panel name, area or Wall Length × Height, material + labour price, waste %, no pitch, orders on]_

---

### 5.4 — Walked example: ridge cap

**ROOFING (current):**
```
## Walked example: ridge cap
1. Name: Ridge cap - 240 standard.
2. Type: Main.
3. Measurement: Lineal.
...
7. Pitch: Off (ridges sit horizontally).
```

**CLADDING:**
> _[Shaun to fill in — replace with a cladding lineal component, e.g. window reveal trim, aluminium channel, or similar]_

---

### 5.5 — Skip hire example (Extra)

This one is trade-neutral. No change needed.

---

## 6. `concepts/waste-and-pitch.mdx`

This page needs the most restructuring for non-roofing trades. For cladding the pitch concept is replaced by the height dimension on the component.

---

### 6.1 — Page title and description

**ROOFING (current):**
```
title: Waste and pitch
description: How the app converts a plan number into the quantity you actually order.
```

**CLADDING:**
> _[Shaun to fill in — title and description that covers waste + the height concept instead of pitch]_

---

### 6.2 — Pitch section (entire block)

**ROOFING (current):**
```
## Pitch

Roof areas are usually measured flat on a plan, but the real material runs along the slope. Pitch is the angle of the slope; the pitch factor scales the flat plan number up to the actual material length or area.

Three pitch types in the app:
- Rafter pitch. For the main roof slope. Covers tiles, longrun, underlay, membrane.
- Hip pitch. For hip rafters.
- Valley pitch. For valley rafters.

Pitch is only applied when the component has pitch enabled AND the quote is using a Plan measurement. If the component is set to Actual, the pitch step is skipped because the number is already the real one.

[Warning callout: Pitch type can't be added later in the quote builder...]
```

**CLADDING:**
> _[Shaun to fill in — explain the Wall Height concept: how you set the wall height on a component once, and the system multiplies your measured lineal length by the height to get area. Compare to how a roofer enters pitch: you set it on the component, the maths happens automatically.]_

---

### 6.3 — Worked example

**ROOFING (current):**
```
A roof plan shows 100 m2. Pitch is 30 degrees (rafter pitch factor ~1.155). Waste is 5%.

- Plan, pitch on, 5% waste: 100 x 1.155 x 1.05 = ~121 m2 ordered.
- Plan, pitch off, 5% waste: 100 x 1.05 = 105 m2 ordered.
- Actual, pitch on, 5% waste: 100 x 1.05 = 105 m2 ordered.
```

**CLADDING:**
> _[Shaun to fill in — e.g. "A floor plan shows a 20m wall run. Component has wall height of 3m set. Waste is 10%. Result: 20 × 3 × 1.10 = 66 m2 ordered."]_

---

### 6.4 — Valleys and hips section

**ROOFING (current):**
```
## Valleys and hips
The hip and valley pitch types currently support the standard 45-degree angle in plan view...
```

**CLADDING:**
> _[This section does not apply to cladding. Replace with a note about any irregular cladding scenarios — e.g. angled or curved wall sections, how to handle them (measure as Actual / use irregular area tool).]_

---

## 7. `concepts/glossary.mdx`

---

### 7.1 — Page subtitle

**ROOFING (current):**
```
Short definitions of the QuoteCore+ and roofing terms you will see in the app.
```

**CLADDING:**
> _[Shaun to fill in — swap "roofing terms" for "cladding terms"]_

---

### 7.2 — Plan measurement definition

**ROOFING (current):**
```
Plan measurement. A flat number off a roof plan or aerial image, before pitch is applied.
```

**CLADDING:**
> _[Shaun to fill in — for cladding a "plan measurement" is typically a floor plan lineal length before height is applied, not a roof plan area]_

---

### 7.3 — Entire "Roofing terms" section

**ROOFING (current):**
```
## Roofing terms
Barge, Downpipe, Fascia, Fixings, Gutter/Spouting, Hip, Longrun, Rafter pitch, Ridge, Underlay, Valley.
```

**CLADDING:**
> _[Shaun to fill in — replace with a "Cladding terms" section. Suggested terms to define: Panel, Batten/furring strip, Cavity, Flashing (cladding context), Reveal, Soffit, Trim, Wall height, Elevation (plan type), Lineal run.]_

---

## 8. `getting-started/your-first-quote.mdx`

Mostly trade-neutral. One line in Step 4 references Areas specifically.

---

### 8.1 — Step 4 description

**ROOFING (current):**
```
Build the quote. The quote builder walks you through Areas, Components, Extras, and Review.
```

**CLADDING:**
> _[Shaun to fill in — swap "Areas" for "Wall Areas". Could also add a brief note that wall areas are optional if you use line measurements only.]_

---

## 9. `getting-started/set-up-your-company.mdx`

---

### 9.1 — Default measurement units description

**ROOFING (current):**
```
Default measurement units. Metric, imperial feet, or imperial roofing squares. New quotes lock to this at creation; existing quotes do not change if you flip the default later.
```

**CLADDING:**
> _[Minor — "imperial roofing squares" is roofing-specific terminology. For cladding users this option is irrelevant but still technically available. Either leave as-is or add a note that Roofing Squares is a roofing-specific unit and metric or imperial feet is recommended for cladding.]_

---

## Summary: what is trade-neutral and never needs changing

These docs can be served to all trades with no modifications:

- `building-a-quote/quote-summary.mdx`
- `building-a-quote/blank-quote.mdx`
- `customer-facing/` (all three files)
- `account/` (all files)
- `templates/` (all files)
- `files-and-quotes/` (all files)
- `labor-and-installers/` 
- `material-orders/`
- `help/`
- `concepts/components-vs-extras.mdx`
- `concepts/plan-vs-actual.mdx` _(minor: one roofing example but the concept is universal)_
- `flashings/flashings.mdx` _(roofing-only feature, not shown for cladding)_

---

## Files to create per new trade

For each trade added (Cladding, Fencing, Electrical, etc.), create:

```
docs/trade-docs-variants/
  roofing.md        ← base (current content, already exists in the live docs)
  cladding.md       ← Shaun fills in from this reference doc
  [next-trade].md   ← same structure, new wording
```

The app serves the right variant based on `companies.default_trade`. Sections not listed above are shared and served identically to all trades.
