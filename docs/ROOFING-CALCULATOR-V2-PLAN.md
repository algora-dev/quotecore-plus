# Free Roofing Calculator v2 — Fix List Plan

> Fable 5 planning session, 2026-07-10
> Based on Shaun's screenshot feedback + verbal fix list

---

## Shaun's Directive Summary

### Layout Overhaul
1. **Tab-based layout** (like quote summary page tabs), not stacked panels
2. **Calculate buttons** on every calculation — don't show results until clicked (opens door for modal popups)
3. **Tabs on left side or inside associated section**, same style as Metric/Imperial toggle
4. **Tab order:**
   - Tab 1: "Roof Area" (start tab)
   - Tab 2: "Rafter / Hip & Valley Pitch" — internal toggle for Pitch vs Hip/Valley
   - Tab 3: "Draft Smart Component (Cost estimator)"
   - Tab 4: "Angle Finder" (port existing angle calculator)

### Hero Subtitle Change
> "Calculate roof pitch, rafter length, roof surface area, quantities and complex pricing. No signup required - works on mobile and desktop."

### Roof Area Tab Fixes
- Remove hip/valley and "flat" pitch type options. Area is calculated by pitch factor only. If flat, user inputs 0°.
- Add **pitch/ratio toggle** — one shows degrees input, the other shows ratio input. Both with hover tooltips.
- Add "Calculate" button — don't show results until clicked.
- Keep "Use this area for pricing" button.

### Rafter / Hip & Valley Tab Fixes
- Offer both degrees and ratio inputs (same toggle as Roof Area).
- **Fix the drawing**: rafter length is per-side. Show ONE side of the roof only (not symmetric triangle). The "span" in the drawing should be from low edge to ridge, not full building width.
- Move degrees/ratio label further right so it doesn't overlap the angle arc.
- **Internal toggle**: "Rafter" tab and "Hip/Valley" tab inside this section.
- Don't calculate until user clicks "Calculate" button.
- **Hip/Valley 3D visual**: asked for a visual showing 2 roofs meeting at a hip/valley. Feasibility assessment below.

### Angle Finder Tab (NEW)
- Port the existing `AngleCalculatorModal` logic into a free-tool tab.
- Same flow: ask user what they're trying to figure out (Hip/Valley, Ridge, Change of Pitch, Upstand onto Roof, Roof into Upstand).
- Same input patterns, same calculation engine (`roofAngleCalculator.ts`).
- This is a reuse task — the math and UX already exist in `app/lib/roofAngleCalculator.ts` and `AngleCalculatorModal.tsx`.

### Material Estimator → "Draft Smart Component (Cost estimator)"
- Rename tab.
- **Left side (component spec)**: mimic EXACTLY the roofing industry "create component" form from `component-list.tsx`. Same fields, same dropdowns, same behavior.
- **Right side (measurement input)**: show input types dictated by component settings — same as the quote builder's component entry phase (`ExpandableComponent.tsx`). Same input options (direct, dims, volume, area_depth depending on measurement type).
- Add "Calculate" button.

---

## 3D Hip/Valley Visual Feasibility Assessment

### Option A: SVG Isometric (RECOMMENDED)
- Pure SVG, no libraries, no performance concern
- Isometric view showing two roof planes meeting at a hip line
- Can show: pitch angle, hip length, roof slope direction
- Static or semi-dynamic (updates with calculated values)
- **Verdict: lightweight, professional, doable now**

### Option B: CSS 3D Transform
- Use CSS `transform: rotateX() rotateY()` on div planes
- More "3D" feel but fragile across mobile browsers
- **Verdict: overkill, skip**

### Option C: Three.js / React Three Fiber
- True 3D, interactive (rotate, zoom)
- Heavy dependency (~500KB), slow LCP, hurts SEO scores
- **Verdict: too heavy for a free tool page, skip**

**Recommendation: Option A (SVG isometric).** A clean 2D isometric diagram showing two roof slopes meeting at a hip/valley line. Labels for pitch, hip length, and angle. Updates when user clicks Calculate. No external dependencies, no performance impact, works perfectly on mobile.

---

## Tab Structure (Detailed)

### Tab 1: Roof Area
```
[Pitch input] ← toggle: Degrees | Ratio
  - Degrees: number input + quick-select pills (10°, 15°, 20°, 25°, 30°, 35°, 40°, 45°)
  - Ratio: two inputs (1 : ___) with tooltip explaining ratio
[Width input] (m or ft)
[Length input] (m or ft)
[Calculate button] ← primary CTA, bg-black, rounded-full

→ After Calculate:
  - Plan area result (bg-slate-50 card)
  - Pitch factor result (bg-slate-50 card)
  - Actual roof area result (bg-orange-50/50, primary)
  - Expandable "Show calculation"
  - "Use this area for pricing" button → scrolls to Tab 3, pre-fills area
```

### Tab 2: Rafter / Hip & Valley Pitch
```
Internal toggle: [Rafter] [Hip/Valley] ← pill buttons, same style as Metric/Imperial

[Pitch input] ← toggle: Degrees | Ratio (same as Tab 1)
[Span input] (m or ft)
[Calculate button]

→ After Calculate (Rafter mode):
  - Rafter length (primary result)
  - Ratio, rafter factor (secondary)
  - Expandable "Show calculation"
  - SVG diagram: SINGLE-SIDE roof cross-section
    - One slope from left edge to ridge
    - Labels: span (horizontal), rafter (slope), pitch angle
    - Angle label positioned right of the arc, no overlap

→ After Calculate (Hip/Valley mode):
  - Hip/valley length (primary result)
  - Hip/valley factor (secondary)
  - Expandable "Show calculation"
  - SVG isometric diagram: two roof planes meeting at hip line
    - Shows both pitches, hip line length, plan angle
```

### Tab 3: Draft Smart Component (Cost estimator)
```
Left column — Component spec (mirrors component-list.tsx create form):
  - Component name (text input)
  - Measurement type dropdown (area, lineal, quantity, fixed, volume, etc.)
  - Material/unit name (text input)
  - Waste type dropdown (none, percent, fixed)
  - Waste value input (conditional on waste type)
  - Price per unit (currency input)
  - Pitch enabled checkbox (if roofing)
  - Pitch type (if enabled: rafter, valley_hip)

Right column — Measurement input (mirrors ExpandableComponent entry):
  - Input fields change based on measurement type:
    - area: single area input (m² or ft²)
    - lineal: single length input (m or ft)
    - quantity: direct count
    - volume: dimensions (W × L × D) or area × depth
    - length_x_height: length + height inputs
  - "Calculate" button

→ After Calculate:
  - Quantity result (primary)
  - Cost estimate (if price entered)
  - Breakdown: raw measurement, waste applied, coverage
  - Expandable "Show calculation"
  - "Save as Smart Component" popup CTA
  - "Sync across devices" hint
```

### Tab 4: Angle Finder
```
Port of AngleCalculatorModal.tsx as an inline tab (not a modal).

Step 1: "What are you calculating?"
  - Hip / Valley (radio + tooltip)
  - Ridge (radio + tooltip)
  - Change of Pitch (radio + tooltip)
  - Upstand onto Roof (radio + tooltip)
  - Roof into Upstand (radio + tooltip)

Step 2: Dynamic inputs based on selection:
  - Hip/Valley: pitch1, pitch2 (or "same as pitch1" checkbox), corner angle
  - Ridge: pitch1, pitch2 (or "same as pitch1" checkbox)
  - Change of Pitch: upper pitch, lower pitch
  - Upstand/Roof into Upstand: single pitch

[Calculate button]

→ After Calculate:
  - Finished angle (primary result)
  - Bend angle from flat (secondary)
  - Angle type badge (internal/external/straight)
  - Expandable "Show calculation" with formula
  - Visual: angle diagram showing the fold/intersection
```

---

## Calculate Button Pattern

All Calculate buttons use the primary CTA style from DESIGN_SYSTEM.md:
```tsx
<button className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30">
  Calculate
</button>
```

Results hidden until Calculate is clicked. This enables future modal popups on Calculate (gentle upsell CTAs).

---

## Tab Style

Same pattern as quote summary page tabs — pill buttons using the filter tab style:
```tsx
<button className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
  isActive
    ? 'bg-slate-900 text-white border-slate-900'
    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
}`}>
  {label}
</button>
```

Positioned on the left side or inside the calculator card header.

---

## Pitch/Ratio Toggle

Small inline toggle within the Roof Area and Rafter tabs:
```tsx
<div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
  <button className={`rounded-full px-3 py-1 text-xs font-medium transition ${
    mode === 'degrees' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
  }`}>Degrees</button>
  <button className={`rounded-full px-3 py-1 text-xs font-medium transition ${
    mode === 'ratio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
  }`}>Ratio</button>
</div>
```

With tooltips (hover) explaining what each mode means.

---

## File Structure

```
app/(public)/free-roofing-calculator/
├── layout.tsx                    # (keep, update subtitle)
├── page.tsx                      # (keep SEO content, update subtitle)
├── RoofingCalculator.tsx         # (rewrite: tab system, 4 tabs)
├── lib/
│   └── calculator.ts             # (shared, already exists)
└── components/
    ├── RoofAreaTab.tsx           # (new: pitch/ratio toggle, calculate button)
    ├── PitchRafterTab.tsx        # (rewrite: Rafter/Hip-Valley toggle, single-side diagram, isometric hip/valley)
    ├── MaterialPanel.tsx         # (rewrite: full component spec form + dynamic measurement inputs)
    └── AngleFinderTab.tsx        # (new: port of AngleCalculatorModal as inline tab)
```

---

## Implementation Order

1. Rewrite `RoofingCalculator.tsx` with tab system
2. Build `RoofAreaTab.tsx` (pitch/ratio toggle, calculate button, no results until clicked)
3. Build `PitchRafterTab.tsx` (Rafter/Hip-Valley internal toggle, fixed single-side SVG diagram, isometric hip/valley SVG)
4. Port `AngleFinderTab.tsx` from existing `AngleCalculatorModal` + `roofAngleCalculator.ts`
5. Rewrite `MaterialPanel.tsx` to mirror component creation form + dynamic measurement entry
6. Update `page.tsx` subtitle
7. Build + test + push

---

## What I Need from Shaun Before Building

Nothing — this plan is actionable now. The angle finder math already exists, the component form pattern already exists, the measurement entry pattern already exists. All reuse.
