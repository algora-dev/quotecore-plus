---
title: Trade docs variants — reference
description: Roofing → Generic rewrite worksheet for the in-app help docs. Generic becomes the master template; future trades derive from Generic, not from Roofing.
status: draft
updated: 2026-05-24
---

# Trade docs variants — reference

## Purpose

The in-app help docs (`content/docs/**/*.mdx`) are currently written in roofing language. We want them to work for any trade.

**Approach:**

1. **Rewrite Roofing → Generic.** Strip roofing-specific terms, examples, and assumptions out of the source docs. The result is the new master ("Generic").
2. **Derive per-trade variants from Generic.** Cladding, flooring, foundations, etc. are produced from the Generic version. Many trades may need zero changes once the Generic doc is well-written — the goal is for the Generic doc to be the default that ships, with trade overlays only when needed.

**Why this order matters:** Going Roofing → Generic → Trade keeps a single source of truth. If we forked Roofing → Cladding directly, we would have to repeat that work for every future trade.

## Scope

After scanning every doc under `content/docs/`, only 5 docs contain roofing-specific content that needs rewriting. Everything else (account, billing, customer-facing, templates, material orders, files, support) is already trade-neutral and stays as-is.

The 5 docs that need a Generic rewrite:

| # | Doc | Why it needs a rewrite |
|---|-----|------------------------|
| 1 | `building-a-quote/digital-takeoff.mdx` | Lead, opening paragraphs, and "what gets saved" all skew to roofing. Biggest rewrite. |
| 2 | `components/creating-a-component.mdx` | Measurement method bullets, pitch section, and the three walked examples are all roofing. |
| 3 | `concepts/waste-and-pitch.mdx` | Entire pitch section + worked example need a generic concept (slope / height multiplier). |
| 4 | `components/overview.mdx` | "What can be a component" examples and the "tailored for roofing" framing. |
| 5 | `concepts/glossary.mdx` | "Roofing terms" section + roofing references inside QuoteCore+ definitions. |

## How to use this doc

Each section below has:

- **Location:** file path of the source doc.
- **Passage:** the existing roofing-flavoured text.
- **Generic rewrite:** blank — fill this in.
- **Notes:** anything to keep in mind (UI labels that can't change, callouts, links).

Work through each passage and write the Generic version. Once Generic is locked, we can run a diff pass to spot any wording that still leans roofing.

---

## 1. `building-a-quote/digital-takeoff.mdx`

### 1a. Frontmatter description

**Location:** top of file (`description:` field).

**Roofing (current):**
> Measure directly from a digital plan or image. One of the best tools for roofers and trades that quote from plans.

**Generic rewrite:**
> _[blank]_

---

### 1b. Lead paragraph

**Roofing (current):**
> The digital takeoff system is one of our best solutions for roofers and trades who want to measure directly from a digital plan or image.

**Generic rewrite:**
> _[blank]_

---

### 1c. Calibration paragraph

**Roofing (current):**
> All you need is a reliable scale or defined measurement on that plan that you know is correct. In digital takeoff, the first step is calibrating the measurement system using that scale.
>
> So long as you are confident in the accuracy of that measurement, you can essentially measure anything that is an area or a lineal item. The system is designed for roofs, but is also used for cladding, flooring, foundations, and more.

**Generic rewrite:**
> _[blank]_

**Notes:** This paragraph is the strongest place to position the tool as universal. Suggested angle: define digital takeoff as "measuring from any scaled plan or image", with a short list of common trades.

---

### 1d. "What you can measure"

**Roofing (current):**
> - Multiple areas or roof sections, each with its own pitch.
> - Individual components by area, lineal length, or as **points** for fixed or quantity-based components.
>
> All measurements are saved and auto-calculated to pre-populate the next phase in the quote builder.

**Generic rewrite:**
> _[blank]_

**Notes:** "Roof sections" is the main roofing word. The generic equivalent in the codebase is "area" (`roof_areas` table, but the user-facing label varies). Keep it consistent with whatever the create-quote form labels them as in non-roofing trades.

---

### 1e. "What happens next"

**Roofing (current):**
> When you continue from digital takeoff into the [quote builder](/docs/building-a-quote/quote-builder), you will see each roof area, each component you measured, and its associated items. You can edit and adjust if needed, or continue quickly to the next step.

**Generic rewrite:**
> _[blank]_

---

### 1f. "What gets saved"

**Roofing (current):**
> - Your initial image or plan.
> - A digital takeoff version of the image showing your lines, measurements, areas, and items overlaid on the plan.
> - A clean image without your uploaded image and only your digital takeoff lines / items, so you can clearly see what you measured.
>
> These are useful for printing out and doing site measures, or to clearly define what you actually measured at a later point if you need to reference it.

**Generic rewrite:**
> _[blank]_

**Notes:** Mostly trade-neutral already. Just check "site measures" reads OK for every trade.

---

## 2. `components/creating-a-component.mdx`

### 2a. Measurement method bullets

**Roofing (current):**
> - **Area** (Rs / ft2 / m2) - for main roofing materials like tiles, longrun, membrane.
> - **Lineal** - for flashings, gutter, spouting.
> - **Quantity** or **Fixed** - for downpipes, chimney flashings, skylights, items priced per unit.

**Generic rewrite:**
> _[blank]_

**Notes:** The unit labels (Area / Lineal / Quantity / Fixed) ARE the UI labels and don't change. Only the example items need to be generic. Suggested generic examples: cladding boards / flooring sheets / membrane (area); trim / edge profile / skirting (lineal); fixings / fittings / per-unit items (quantity / fixed).

---

### 2b. Pitch calculation section

**Roofing (current):**
> **Pitch calculation.** Tick to apply a pitch type:
>
> - **Rafter pitch** - main roof areas (tiles, longrun, underlay).
> - **Hip pitch** - hip rafters.
> - **Valley pitch** - valley rafters.
>
> Pitch auto-calculates plan measurements into actual lengths, with waste added. You enter the actual pitch angle later during the quote builder. The hip and valley pitch types currently support 45-degree angles in plan view; tapered hips or valleys need extra length added manually.

**Generic rewrite:**
> _[blank]_

**Notes:** This is the biggest conceptual rewrite. For cladding and similar trades, the equivalent of pitch is **height** (a wall has a length on plan and a height that multiplies it into area). The Generic doc needs a clean way of describing "the multiplier that converts a plan measurement into an actual material quantity" without locking it to roof slope. One option: describe pitch / height / multiplier as a single family of "plan-to-actual multipliers" and list the variants the system supports. Keep the existing roof variants accessible from the Roofing overlay; the Generic version explains the concept.

---

### 2c. Walked example 1 — roofing tiles

**Roofing (current):**
> 1. **Name:** Roofing tiles - terracotta.
> 2. **Type:** Main.
> 3. **Measurement:** Area.
> 4. **Material price:** $10 per m2.
> 5. **Labor price:** $5 per m2.
> 6. **Waste:** Percentage, 5%.
> 7. **Pitch:** Rafter pitch.
> 8. **Material orders:** On.

**Generic rewrite (suggested: a cladding board or flooring sheet as the area example):**
> _[blank]_

---

### 2d. Walked example 2 — ridge cap

**Roofing (current):**
> 1. **Name:** Ridge cap - 240 standard.
> 2. **Type:** Main.
> 3. **Measurement:** Lineal.
> 4. **Material price:** per linear meter.
> 5. **Labor price:** per linear meter.
> 6. **Waste:** Fixed, 100mm per length.
> 7. **Pitch:** Off (ridges sit horizontally).
> 8. **Material orders:** On. Attach a flashing drawing if you have one.

**Generic rewrite (suggested: a trim / edge profile / skirting as the lineal example):**
> _[blank]_

---

### 2e. Walked example 3 — skip hire

**Roofing (current):**
> 1. **Name:** Skip hire.
> 2. **Type:** Extra.
> 3. **Measurement:** Quantity.
> 4. **Material price:** flat amount per skip.
> 5. **Labor price:** 0.
> 6. **Waste:** Off.
> 7. **Pitch:** Off.
> 8. **Material orders:** Off.

**Generic rewrite:**
> _[blank]_

**Notes:** Skip hire is already pretty universal across building trades — could stay. Or generalise to "site cleanup" / "delivery fee" if you want full neutrality.

---

## 3. `concepts/waste-and-pitch.mdx`

### 3a. Doc title and frontmatter

**Roofing (current):**
> title: Waste and pitch

**Generic rewrite:**
> _[blank — e.g. "Waste and multipliers" or "Waste and plan-to-actual"]_

**Notes:** The slug `waste-and-pitch` is referenced from at least 3 other docs. If we rename, we either keep the slug and just retitle, or add a redirect. Simpler: keep the slug, retitle to something more generic.

---

### 3b. Pitch section (the whole block)

**Roofing (current):**
> ## Pitch
>
> Roof areas are usually measured flat on a plan, but the real material runs along the slope. Pitch is the angle of the slope; the pitch factor scales the flat plan number up to the actual material length or area.
>
> Three pitch types in the app:
>
> - **Rafter pitch.** For the main roof slope. Covers tiles, longrun, underlay, membrane.
> - **Hip pitch.** For hip rafters.
> - **Valley pitch.** For valley rafters.
>
> Pitch is only applied when the component has pitch enabled AND the quote is using a [Plan](/docs/concepts/plan-vs-actual) measurement. If the component is set to Actual, the pitch step is skipped because the number is already the real one.
>
> <Callout type="warning">
> Pitch type can't be added later in the quote builder. It has to be set on the component itself. If you forget to enable rafter pitch on a roofing material, you will under-order. Double-check before saving the component.
> </Callout>

**Generic rewrite:**
> _[blank]_

**Notes:** This is the core rewrite. The Generic version needs to describe the concept of a **plan-to-actual multiplier** (pitch for roofs, height for cladding, etc.). The Callout should be kept but reworded to reference "the multiplier" rather than "pitch type". The trade-specific multiplier names (rafter pitch, hip pitch, height) live in trade overlays.

---

### 3c. Worked example

**Roofing (current):**
> ## A worked example
>
> A roof plan shows 100 m2. Pitch is 30 degrees (rafter pitch factor ~1.155). Waste is 5%.
>
> - **Plan, pitch on, 5% waste:** 100 x 1.155 x 1.05 = ~121 m2 ordered.
> - **Plan, pitch off, 5% waste:** 100 x 1.05 = 105 m2 ordered.
> - **Actual, pitch on, 5% waste:** 100 x 1.05 = 105 m2 ordered. (Pitch skipped because the number is already real.)

**Generic rewrite:**
> _[blank]_

**Notes:** Either generalise the example (e.g. "a plan shows 100 m of wall length, height 2.4m, so 240 m2 of material with 5% waste = 252 m2"), or keep two examples (one roofing, one cladding) inside the Generic doc to show the same maths applies to both. The latter is probably clearer.

---

### 3d. Valleys and hips section

**Roofing (current):**
> ## Valleys and hips
>
> The hip and valley pitch types currently support the standard 45-degree angle in plan view. Tapered valleys or hips will need either extra length added manually, or you can measure them as Actual and enter the real length.

**Generic rewrite:**
> _[blank — likely "remove from Generic, keep in Roofing overlay only"]_

**Notes:** This section is roofing-only. Recommended: drop it from the Generic doc entirely and keep it in a roofing-specific overlay.

---

## 4. `components/overview.mdx`

### 4a. Intro paragraph

**Roofing (current):**
> Components are the core of the targeted quoting system. This is where you create, edit, and define what items end up in your quote or pricing. Each component has a name, measurement type (lineal or area squared), cost per unit, labor cost per unit, pitch calculations for roofing, component waste settings, ability to add to orders, and more.

**Generic rewrite:**
> _[blank]_

**Notes:** "pitch calculations for roofing" is the only roofing-specific phrase. Replace with "plan-to-actual multipliers (pitch, height, etc.)" or similar.

---

### 4b. "What can be a component"

**Roofing (current):**
> ## What can be a component?
>
> Roofing tiles, longrun iron, metal flashings (ridge, hips, valleys, barge, custom), roofing underlay, netting, insulation, roofing membrane, fixings, skylights, metal fascia, gutter or spouting, downpipes. Absolutely anything that you use or install on a roof or job can be configured as a component.
>
> You may only have 4 or 5 key components that you use, or you may have hundreds. Either way, you can create and fully customise everything about them.

**Generic rewrite:**
> _[blank]_

**Notes:** Suggested generic list: "Materials, fittings, trims, fixings, consumables, hire items, or anything else you use or install on a job." Keep the 4-or-5 vs hundreds line — that's universal.

---

### 4c. "Why components matter"

**Roofing (current):**
> Set them up once and every quote after that is faster, more consistent, and harder to get wrong. You change a price once and every new quote uses the new price.
>
> The library scales with the work. The system is tailored for roofing but can be adapted to include cladding, foundations, windows, flooring, and more.

**Generic rewrite:**
> _[blank]_

**Notes:** Remove "tailored for roofing" — the Generic doc positions the system as trade-agnostic by default. Keep the trade list as an "any of these" example.

---

## 5. `concepts/glossary.mdx`

### 5a. Frontmatter description

**Roofing (current):**
> Short definitions of the QuoteCore+ and roofing terms you will see in the app.

**Generic rewrite:**
> _[blank]_

---

### 5b. "Roofing terms" section (the whole block)

**Roofing (current):**
> ## Roofing terms
>
> **Barge.** The flashing along the gable end of a roof - the angled edge.
>
> **Downpipe.** The vertical pipe that takes water from the gutter to the ground.
>
> **Fascia.** The horizontal board (often metal) along the eaves where the gutter mounts.
>
> **Fixings.** Screws, nails, clips, brackets - anything that holds materials in place.
>
> **Gutter / Spouting.** The horizontal channel along the eaves that catches roof water.
>
> **Hip.** The external angle where two roof slopes meet, running from ridge to eave.
>
> **Longrun.** Long-length metal roofing iron, run from ridge to eave in a single sheet.
>
> **Rafter pitch.** The pitch type for the main roof slope. Covers tiles, longrun, underlay.
>
> **Ridge.** The horizontal line at the top of the roof where two slopes meet. Also the flashing that covers it.
>
> **Underlay.** The membrane laid under the roofing material for water protection.
>
> **Valley.** The internal angle where two roof slopes meet, running from ridge to gutter.

**Generic rewrite:**
> _[blank — recommended: REMOVE this entire section from the Generic doc and keep it in a Roofing-only overlay. The Generic glossary covers only QuoteCore+ and Billing terms.]_

**Notes:** This whole "Roofing terms" section is the only trade-specific vocabulary in any doc. The Generic doc should drop it. Cladding, flooring, etc. don't need a glossary section unless they have novel terms.

---

### 5c. Roofing references inside QuoteCore+ terms

Two QuoteCore+ glossary entries mention roofing or pitch implicitly:

**"Component" (current):**
> A re-usable line you put in quotes. Has a name, measurement type, material price, labor price, waste, and optional pitch settings.

**Generic rewrite:**
> _[blank — replace "optional pitch settings" with the generic equivalent, e.g. "optional plan-to-actual multiplier"]_

**"Plan measurement" (current):**
> A flat number off a roof plan or aerial image, before pitch is applied.

**Generic rewrite:**
> _[blank — e.g. "A flat number off a digital plan or image, before any plan-to-actual multiplier is applied"]_

**"Manual quote" (current — note: this is duplicated in the source, both entries):**
> A quote built line-by-line for trades that do not need takeoff or pitch maths.

**Generic rewrite:**
> _[blank — drop "pitch maths" specifically, e.g. "for jobs that do not need digital takeoff"]_

---

## Cross-cutting decisions to lock before filling in blanks

These come up repeatedly across the rewrite. Decide once, apply everywhere.

1. **Naming for "the multiplier that converts plan to actual".** Roofing has pitch. Cladding has height. Suggested umbrella term: **"plan-to-actual multiplier"** or simply **"multiplier"**. Pick one and use it consistently in the Generic doc.

2. **Naming for the area entity.** Roofing has "roof area". The code calls it `roof_areas`. The UI may or may not show "Area" / "Section" depending on trade. Decide what the Generic doc calls it — "area", "section", or "zone" are all candidates.

3. **Treatment of pitch types in the Generic doc.** Two options:
   - **(a)** Generic doc describes the concept of multipliers abstractly, never names rafter / hip / valley. The Roofing overlay lists them.
   - **(b)** Generic doc lists every multiplier supported by the system (rafter pitch, hip pitch, valley pitch, height, etc.) as a single combined list, with a note that they appear contextually based on trade. This is more transparent but more cluttered.

   Recommend (a) for the help docs, (b) for the internal docs.

4. **Where roofing-specific content lives after the rewrite.** Two options:
   - **(a)** Trade-specific overlay docs (a small set of `.mdx` files that exist only for trades with extra vocabulary). Loaded conditionally based on the company's `default_trade`.
   - **(b)** Inline "When you're in roofing mode" callouts inside the Generic doc.

   Recommend (a) — keeps the Generic doc clean and lets each trade add only what it needs.

---

## After Generic is done

1. Apply the Generic rewrites back to the 5 source `.mdx` files (those become the Generic versions).
2. Create a `content/docs/_trade-overlays/roofing/` folder (or similar) with the bits that were stripped out — roofing glossary terms, pitch type descriptions, the valleys-and-hips note. Wire these in via a trade-aware doc loader (TBD; check if the docs site already has any trade-awareness, otherwise this is a new feature).
3. For the next trade (cladding), duplicate the roofing overlay pattern but with cladding-specific content. The Generic doc itself shouldn't change.

## Source files touched

- `content/docs/building-a-quote/digital-takeoff.mdx`
- `content/docs/components/creating-a-component.mdx`
- `content/docs/concepts/waste-and-pitch.mdx`
- `content/docs/components/overview.mdx`
- `content/docs/concepts/glossary.mdx`

## Files that do NOT need changing

Verified trade-neutral after a full sweep of `content/docs/`:

- All of `account/**`
- All of `customer-facing/**`
- All of `email-templates/**`
- All of `files/**`
- All of `labor-and-installers/**`
- All of `material-orders/**`
- All of `support/**`
- All of `templates/**`
- `building-a-quote/manual-quote.mdx`
- `building-a-quote/blank-quote.mdx`
- `building-a-quote/quote-builder.mdx`
- `building-a-quote/quote-summary.mdx`
- `components/components-vs-extras.mdx`
- `concepts/plan-vs-actual.mdx`
- `concepts/measurement-systems.mdx`
- `index.mdx` (verify after rewrite — currently mentions roofing once in passing)

(If the sweep missed anything, add it here as it's found.)
