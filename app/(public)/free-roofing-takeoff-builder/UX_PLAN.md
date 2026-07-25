# Free Roofing Takeoff Builder - UX Improvement Plan

## Goal
Make the tool feel like a guided journey - simple for beginners, fast for experts. Every step should be obvious. Every term should be explainable. Every user should be able to use as much or as little as they need.

---

## Current State
- User picks measurement mode (actual vs plan) -> picks units -> sees all 6 component sections at once
- No guidance on what each component is
- No custom components
- All sections shown equally - no sense of priority/flow
- Info icons exist on a few things but not on components

---

## Proposed Changes

### 1. Guided Step Flow (not a wizard, but prioritised steps)

**Step 1: Setup** (current - keep as is)
- "How do you want to enter measurements?" -> Actual / Plan
- "What units?" -> Metric / Imperial / Squares
- If Plan mode: pitch input

**Step 2: Roof Area** (promoted as the primary step)
- Roof Area section is expanded by default, others collapsed
- Add a heading: "Step 1: Enter your roof area"
- Info icon on Roof Area: "The total surface area of your roof. If measuring from a plan, enter the width and length of each roof plane and we'll calculate the real sloped area using your pitch."

**Step 3: Additional Components** (optional, progressive)
- Heading: "Step 2: Add components (optional)"
- Subtext: "Add ridge, hip, valley, barge, spouting, or custom components to get a complete material takeoff."
- Each component section stays collapsed with a clear "+" expand
- Components with 0 entries show a one-line description + info icon

### 2. Info Icons on Every Component

Each component gets a hover/tap info icon with a plain-English explanation:

- **Roof Area**: "The total surface area of all roof planes. This is calculated from your plan dimensions and roof pitch."
- **Ridge**: "The horizontal line at the top of a roof where two roof slopes meet. Think of it as the peak of the roof."
- **Hip**: "The angled line where two roof slopes meet on an external corner. Runs from the ridge down to the eaves."
- **Valley**: "The angled line where two roof slopes meet on an internal corner. Water flows into valleys. Runs from ridge down to the eaves."
- **Barge**: "The sloped edge of the roof at a gable end. Also called a rafter edge or verge. Runs from the ridge down to the eaves at the side of the roof."
- **Spouting**: "The gutter system along the bottom edge of the roof. Measured along the eaves/perimeter where water runs off."
- **Custom**: "Create your own component - e.g. apron flashing, soaker flashings, step flashings. Choose whether it's measured by length or area, and whether pitch affects it."

### 3. Custom Components

Add a "Custom" section after the 6 built-in components:

**How it works:**
- User clicks "Add Custom Component"
- A small form appears:
  - Name (e.g. "Apron Flashing", "Step Flashing")
  - Measurement type: Linear (length) or Area
  - Pitch type: None / Rafter pitch / Hip-Valley pitch
  - Default waste %
- Creates a new collapsible section identical to built-in components
- User can add entries to it like any other component
- If component pricing exists in the DB that matches, they can select it; otherwise it's lengths-only

**Data model:**
```ts
interface CustomComponentDef {
  id: string;
  name: string;
  measurementType: 'linear' | 'area';
  pitchType: 'rafter' | 'hip_valley' | 'none';
  wastePercent: number;
}
```

Custom components are stored in component state (not DB - this is a free tool). They get their own section with entries, waste, and the same add-form pattern.

### 4. Progressive Disclosure (keep experts fast)

- All sections are visible from the start (no forced sequence)
- But the visual hierarchy guides naturally: Roof Area is prominent, then a divider, then "Additional Components" section
- Experts can immediately expand Ridge, add values, move on
- Beginners see only Roof Area expanded and read the info icons to learn

**Layout:**
```
[Setup bar: mode, units, pitch, change/start over]

─── Roof Area ───────────────────
  [Waste] [Add form] [Entries]

─── Additional Components ───────
  Subtext: "Add ridge, hip, valley, barge, spouting, or custom components"
  
  [Ridge - 0 entries - info icon] >
  [Hip - 0 entries - info icon] >
  [Valley - 0 entries - info icon] >
  [Barge - 0 entries - info icon] >
  [Spouting - 0 entries - info icon] >
  [+ Add Custom Component]

─── Summary ─────────────────────
  [Totals, Generate Report button]
```

### 5. Component Section Visual Polish

- When a section has 0 entries: show a subtle dashed border + description text + info icon
- When a section has entries: solid border, count badge, total shown in header
- Collapsed state shows: icon, name, entry count (if >0), total (if >0), chevron
- Expanded state shows: waste, add form, entry list (current pattern)

### 6. Empty State Guidance

When a user first arrives at the component sections (no entries anywhere):
- Roof Area is expanded with the add form visible
- A subtle hint: "Start here - add your roof area measurements"
- Other sections show their description + info icon in collapsed state

---

## Implementation Order

1. **Info icons on all components** - quick win, add tooltips to each section header
2. **Visual hierarchy** - divide into "Roof Area" and "Additional Components" sections
3. **Custom components** - add custom component creation + dynamic sections
4. **Progressive disclosure polish** - empty states, descriptions, flow refinement
5. **Microcopy refinement** - review all text for clarity and brevity

---

## What NOT to Do

- Don't force a multi-page wizard (experts will hate it)
- Don't hide components behind menus (they should be visible, just collapsed)
- Don't require all components to be filled (most users won't use all 6)
- Don't over-explain (info icons are optional, not mandatory reading)

---

## Open Questions for Shaun

1. Should custom components persist in sessionStorage (so they survive a refresh) or be ephemeral?
2. Should we pre-build common custom components (apron flashing, step flashing, soaker) as suggestions?
3. For the info icons - tooltip on hover, or click to expand a small text block? (Hover doesn't work on mobile)
