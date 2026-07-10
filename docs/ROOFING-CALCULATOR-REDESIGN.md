# Free Tools Roofing Calculator — Redesign Plan

> Authored with Fable 5. Based on the Free Ecosystem Strategy doc + Shaun's directives.
> Date: 2026-07-10

---

## What Shaun Wants

1. **Industry-specific calculator pages**, not one mega-calculator. Start with roofing. Each page is a dedicated SEO landing page (e.g. `/roofing-calculator`).
2. **Fewer tabs, more focused.** The current 8-tab approach is "half useful." Consolidate into a tighter, more intentional flow.
3. **No emojis anywhere.** Professional, clean — match the app's existing design language exactly.
4. **Draft Smart Components concept.** The "Material" tab evolves into a Draft Smart Component builder: user enters component specs (material, waste, pitch, pricing) on one side, enters measurements on the other, clicks calculate. Subtle pop-ups guide toward "do this in the app with a free trial."
5. **Expandable answers.** Show the answer first, then an "Show calculation" expand that reveals the formula and steps. Builds trust + SEO content.
6. **Trade-relevant tips** on the page for SEO and trust building.
7. **Related tool chain.** Every calculator recommends the next logical step. No dead ends.
8. **Local storage.** Calculations and draft components persist locally. "Sync across devices" is a conversion CTA, not a login wall.

---

## Current State Assessment

### What's Good (Keep)
- `calculator.ts` math engine — all pure functions, well-tested, reuses `engine.ts`
- Unit conversion system (metric/imperial)
- Pitch factor functions from `engine.ts`
- Basic component structure

### What's Wrong
1. **Emojis everywhere** in tab labels — violates design system, looks unprofessional
2. **8 tabs is too many** — fragmented, hard to find what you need, no flow between them
3. **No expandable answers** — results just appear, no explanation of formula
4. **No related tools** — dead end after calculation
5. **No local storage** — calculations lost on refresh
6. **No Draft Smart Component** — Material Estimator is too simplistic, doesn't connect to the component concept
7. **Sticky CTA is generic** — doesn't flow naturally from the calculation
8. **SEO content is generic** — needs trade-specific copy, formulas, tips
9. **Layout doesn't match app quality** — feels like a bolt-on, not part of the ecosystem

---

## Redesigned Roofing Calculator

### URL
`/roofing-calculator` (primary SEO target: "roofing calculator", "roof calculator", "roof pitch calculator")

### Page Structure (Top to Bottom)

#### 1. Header (shared layout)
- QuoteCore+ logo left
- "Free Tools" link + "Sign up" accent button right
- No emojis, clean white header with backdrop blur

#### 2. Hero Section
- H1: "Free Roofing Calculator"
- Subtitle: "Calculate roof pitch, area, rafter lengths, and material quantities. No signup required."
- Unit toggle (Metric / Imperial) — prominent, right-aligned

#### 3. Calculator Section (3 focused panels, not 8 tabs)

**Panel 1: Roof Pitch & Rafter**
- Pitch input (degrees) with quick-select buttons (10°, 15°, 20°, 25°, 30°, 35°, 40°, 45°)
- Auto-shows: ratio, rafter pitch factor, hip/valley factor
- Span input → rafter length calculated live
- Expandable answer: "Show calculation" reveals formula and steps
- SVG diagram (clean, no emojis) showing roof cross-section at entered pitch

**Panel 2: Roof Area**
- Width + Length inputs (plan dimensions)
- Pitch auto-inherits from Panel 1 (or can be overridden)
- Pitch type selector (Rafter / Hip-Valley / Flat) — pill buttons
- Result: plan area, pitch factor, actual roof area
- Expandable answer: shows pitch factor formula and calculation
- "Use this area for material estimation" button → scrolls to Panel 3 and pre-fills

**Panel 3: Material Estimator (Draft Smart Component preview)**
- Left side: Component spec builder
  - Material type dropdown (concrete tiles, clay tiles, metal sheets, asphalt shingles, membrane, corrugated iron)
  - Waste % slider/input
  - Price per unit (optional — shows estimated cost if entered)
  - Pitch (inherited, read-only display)
- Right side: Measurement input
  - Area (pre-filled from Panel 2, editable)
  - "Calculate" button
- Result: quantity needed, area with waste, estimated cost
- Expandable answer: shows coverage rate, waste calculation
- **Subtle CTA**: "Save as Smart Component" → gentle popup: "Create a free QuoteCore+ account to save and reuse this component across quotes." (Dismissable, not blocking)

#### 4. Related Tools Section
- "Related calculators" heading
- 3-4 linked cards (clean, no emojis):
  - "Free Quote Generator — Turn these measurements into a professional quote"
  - "Volume Calculator — Calculate concrete, gravel, or fill volumes" (future)
  - "Triangle Solver — Solve any right triangle" (future)
  - "Start free trial — Full quoting, takeoff, and job management"
- Each card uses the design system's action card pattern (border-2, hover:border-[#FF6B35])

#### 5. Tips & Knowledge Section (SEO)
- "Roofing calculation tips" heading
- 4-6 trade-specific tips with real value:
  - How to measure roof pitch on-site
  - When to use rafter vs hip/valley pitch factors
  - Common waste percentages by material type
  - Why plan area differs from actual roof area
  - How to account for complex roof shapes
  - When to add extra material for cuts and overlaps
- Each tip is 2-3 sentences, practical, no fluff

#### 6. Formula Reference (SEO)
- Collapsible sections showing the actual formulas:
  - Rafter length = (span / 2) / cos(pitch)
  - Pitch factor = 1 / cos(pitch) (rafter type)
  - Hip/valley factor = √(rafter_factor² + 1)
  - Material quantity = (area × (1 + waste%)) / coverage_per_unit
- These are in expandable `<details>` elements — indexable by Google, not cluttering the UI

#### 7. FAQ Section (SEO)
- 4-5 real FAQs with schema.org FAQPage JSON-LD
- "How do I calculate roof pitch?", "What is a pitch factor?", etc.

#### 8. Footer (shared)
- Cross-links to other free tools
- "Start free trial" CTA
- QuoteCore+ branding

### Design Details

**No emojis.** Replace all emoji icons with either:
- Nothing (just text labels on tabs/buttons)
- Heroicons outline SVGs where an icon genuinely helps (following DESIGN_SYSTEM.md icon rules)

**Tab/pill buttons:** Use the filter tab pattern from DESIGN_SYSTEM.md:
- `rounded-full border text-xs` — active = `bg-slate-900 text-white border-slate-900`

**Result boxes:** Use a consistent pattern:
- Primary result: `rounded-xl bg-orange-50/50 border border-orange-100 p-4` with large text
- Secondary metrics: `rounded-xl bg-slate-50 border border-slate-100 p-4`
- Expandable: `<details>` with `summary` that says "Show calculation"

**Inputs:** `rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none`

**Unit toggle:** Pill style, same as existing but without emojis

**Sticky CTA:** Replace generic CTA with context-aware one:
- After pitch calc: "Calculate roof area with this pitch →"
- After area calc: "Estimate materials for this roof →"
- After material calc: "Turn this into a professional quote →" (links to free quote generator)

### Local Storage
- Key: `qcp:roofing-calc` — stores all panel inputs
- Auto-saves on input change (debounced 500ms)
- Restores on page load
- No UI for this — just happens silently
- "Sync across devices" CTA appears after material estimation (subtle, dismissable)

### Expandable Answer Pattern
```tsx
<details className="mt-3 group">
  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
    Show calculation
  </summary>
  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
    <p className="text-xs text-slate-600 font-mono">
      rafter = (span / 2) / cos(pitch)
      <br />
      rafter = ({span} / 2) / cos({pitch}°)
      <br />
      rafter = {span/2} / {Math.cos(pitch * RAD).toFixed(4)}
      <br />
      rafter = <strong>{result.toFixed(3)} {unit}</strong>
    </p>
  </div>
</details>
```

---

## File Structure

```
app/(public)/roofing-calculator/
├── layout.tsx              # SEO metadata, JSON-LD, shared header/footer
├── page.tsx                # Hero, calculator, SEO content, FAQ
├── RoofingCalculator.tsx   # Main client component (3 panels, unit context, local storage)
├── lib/
│   └── calculator.ts       # Reuse existing math (import from free-construction-calculator/lib/calculator.ts OR move to shared)
└── components/
    ├── PitchRafterPanel.tsx    # Panel 1: pitch + rafter
    ├── RoofAreaPanel.tsx       # Panel 2: roof area
    └── MaterialPanel.tsx       # Panel 3: material estimator / Draft Smart Component preview
```

### Shared Calculator Lib
Move `calculator.ts` to a shared location so both the roofing calculator and future calculators can use it:
```
app/(public)/lib/calculator.ts  ← shared math functions
```

Keep the existing `/free-construction-calculator/` route alive for now (redirect or just leave it). Eventually we'll have:
- `/roofing-calculator`
- `/construction-calculator` (general building)
- `/concrete-calculator` (concrete specific)
- etc.

---

## Migration Plan

1. Create shared `app/(public)/lib/calculator.ts` (copy existing functions)
2. Build `/roofing-calculator` with the 3-panel design above
3. Update middleware, sitemap, robots for the new route
4. Test build
5. Leave old `/free-construction-calculator` in place for now (can redirect later)
6. Future: duplicate the roofing calculator template for other industries (just change SEO copy, material types, tips)

---

## What NOT to Build Yet

- Draft Smart Component full system (localStorage + account migration) — design the UI preview, but don't build the full draft-to-account pipeline yet. The "Save as Smart Component" button can show a gentle popup CTA.
- AI tools (quote/order/invoice generators) — separate phase
- Toolbox hub page — separate phase
- Auth infrastructure — already set up on Supabase side, but not needed for this calculator redesign

---

## Design Principles (from strategy doc)

1. **Extremely simple** — mobile first, large touch targets
2. **Fast** — static rendered, no API calls, pure client-side math
3. **No login required** — everything works anonymously
4. **Consistent** — match app design system exactly
5. **Clear outputs** — answer first, expandable explanation below
6. **No dead ends** — every result leads to a next step
7. **No emojis** — professional throughout
