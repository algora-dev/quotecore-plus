# AI-Assisted Digital Takeoff — Feature Vision

> Source: Shaun voice note, 2026-07-17

## Core Concept
User uploads a plan → it loads into the canvas (pixel-based) → AI analyses the plan and auto-draws roof components → user reviews, edits, and assigns components from their library.

## Pipeline

### 1. Plan Upload & Canvas Loading
- User uploads a plan image/PDF
- Loaded into the Fabric.js canvas as pixel-based background
- AI API is programmed (taught) what to look for on the plan

### 2. Scale Detection & Calibration
- AI attempts to detect the scale from the plan automatically
- If AI detects scale → present to user for confirmation
- If AI cannot detect scale or user rejects → user manually creates the scale (existing calibration flow)
- Scale must be confirmed before AI drawing begins

### 3. AI Auto-Drawing
Once scale is confirmed, AI scans the plan and draws the following as placeholders:
- **Hips** — hip roof lines
- **Valleys** — valley lines
- **Barges** — barge board runs
- **Spouting runs** — gutter/spouting lines
- **Ridges** — ridge lines
- **Roof areas** — bounded roof area polygons

Each drawn item is a **placeholder** — a visual marker on the canvas with a type label, not yet linked to a component.

### 4. User Review & Edit
- User sees all AI-drawn placeholders overlaid on the plan
- User can:
  - **Edit** any drawn placeholder (adjust position, shape, dimensions)
  - **Remove** any placeholder that's incorrect or unwanted
  - **Add** new ones the AI missed

### 5. Component Assignment
- For each placeholder, user selects a component from their component library
- Component is applied to the placeholder's measurement
- All calculations (quantities, waste, costs) are driven by:
  - What the AI found (the measurement/geometry)
  - The selected component from the user's library (the pricing/spec)

### 6. Calculation & Output
- Measurements from AI drawings feed into the existing takeoff calculation engine
- Component library provides pricing, waste factors, pack sizes
- Results aggregate into the quote as normal

## Key Design Decisions
- AI draws **placeholders**, not final components — user stays in control
- Scale confirmation is a hard gate — nothing draws until scale is confirmed
- Every AI-drawn item is editable/removable — no "trust the AI completely"
- Component assignment is a separate step from drawing — flexibility to swap components
- Calculations use the same engine as manual takeoff — no parallel math

## Technical Notes
- Canvas: Fabric.js (already in use)
- AI: needs API selection (vision model for plan analysis + line detection)
- Line/polygon detection: computer vision to identify hips, valleys, ridges, barges, spouting from plan geometry
- Scale detection: OCR for scale text + dimension line analysis
- Placeholders: new Fabric.js object type or annotation layer on existing objects
- Integration point: after plan upload + before/within existing takeoff measurement flow

## Refined Specs (Shaun, 2026-07-17)

### Plan Quality Scope — V1
- **Works on:** proper digital plans — CAD exports, high-quality plan-view images
- **Does NOT need to work on:** satellite images, angled photos, hand-drawn sketches
- Plans are assumed **square to the page** — building outline is orthogonal, not rotated

### Geometric Assumptions (V1 simplification)
- **Ridges** = horizontal or vertical lines (0° or 90°)
- **Hips & Valleys** = 45° angles on plan view
- **Building outline** = square/rectangular to the page
- This covers the majority of standard roofing jobs. Complex non-orthogonal plans fall back to manual.

### Default Component Types (V1 — fixed set)
1. **Hips** — lineal measurement
2. **Valleys** — lineal measurement
3. **Ridges** — lineal measurement
4. **Barge Caps** — lineal measurement
5. **Spouting** — lineal measurement
6. **Roof Area** — area measurement (sqm)

No custom AI-detected types in V1. User adds custom components manually on top.

### Colour Coding System
Each default type gets a fixed colour:
- Hips = green
- Valleys = (TBD)
- Ridges = blue
- Barge Caps = (TBD)
- Spouting = (TBD)
- Roof Area = (TBD)

### Confidence Indicators
Each AI-drawn placeholder gets a confidence score shown as a coloured square box:
- 🔴 Red = low confidence
- 🟠 Orange = ~25% confidence
- 🟡 Yellow = ~50% confidence
- 🟢 Green = high confidence
- 🔵 Blue = very high confidence

### Scale Detection
- AI scans for scale text / dimension lines on the plan
- Suggests the detected scale to the user
- User confirms or manually calibrates (existing calibration flow)
- Desktop is the primary surface for this (canvas works best on larger screens)

### Pitch Detection
- AI attempts to detect roof pitch from plan annotations
- If found → suggests pitch to user
- If not found → user manually inputs pitch (they know the plan)
- Pitch applies to area calculations as normal

### Component Assignment Flow
1. AI scan completes → placeholders drawn on canvas with colour coding + confidence boxes
2. Each placeholder type shows a dropdown in the review panel
3. User selects a real component from their library (filtered by compatible measurement type — lineal for lines, area for roof area)
4. When user saves the takeoff:
   - The AI measurement (length/area) is saved **underneath** the user's selected component
   - Quote builder displays the **real component name** (e.g. "Hip Capping") not the default label ("Hip")
   - Calculations use the AI-found measurement + selected component's pricing/waste/pack specs

### What V1 Does NOT Do
- No skylight detection
- No chimney detection
- No change-of-pitch flashing detection
- No dormer detection
- No complex non-orthogonal plan handling
- All of the above = manual addition by user on top of AI placeholders

## Status
**Refined vision stage.** Ready for scoping/build when prioritised.
