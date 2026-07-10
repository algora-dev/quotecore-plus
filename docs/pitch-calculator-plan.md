# All-in-One Construction Calculator — Public Lead-Gen Page

## Goal
Build the best all-in-one construction calculator on the internet at `app.quote-core.com/free-construction-calculator`. Free, no auth, SEO-optimized, mobile-first. Covers pitch/angle, area², volume, rafter length, hip/valley, and material estimation. Drives traffic, captures leads, converts to QuoteCore+ users.

> See also: `docs/free-tools-plan.md` — master plan for all free tools.

## Route
`app/(public)/free-construction-calculator/page.tsx` — sits in the `(public)` route group. No auth wall.

## What's Already Built (reusable)
- `rafterPitchFactor(degrees)` — `1 / cos(degrees * RAD)`
- `hipValleyPitchFactor(degrees)` — `sqrt(rafter_factor² + 1)` for 45° hip/valley
- `pitchFactor(degrees, pitchType)` — dispatcher
- `applyPitchAndWaste(...)` — full pipeline
- Pitch type enum: `'none' | 'rafter' | 'valley_hip'`
- All in `app/lib/pricing/engine.ts`

## Build Plan

### Phase 1: Core Calculator (this session)
Single page with tabbed/sectioned calculators:

**1. Pitch Degree ↔ Ratio Converter**
- Input: pitch degrees → output: ratio (e.g. 25° = 1:2.144)
- Input: ratio (e.g. 1:2.14) → output: degrees
- Show common pitches quick-select (10°, 15°, 20°, 25°, 30°, 35°, 40°, 45°)
- Visual: roof cross-section diagram that updates with the angle

**2. Rafter Length Calculator**
- Inputs: span (m/ft), pitch (degrees)
- Output: rafter length = (span/2) / cos(pitch)
- Toggle metric/imperial

**3. Roof Area Calculator**
- Inputs: plan width × length, pitch (degrees), pitch type (rafter/hip_valley)
- Output: actual roof area = plan area × pitch factor
- Show factor used

**4. Hip/Valley Length Calculator**
- Inputs: span, run, pitch
- Output: hip/valley length using compound angle formula

**5. Area Squared Calculator**
- Inputs: width × length (m/ft)
- Output: area in m² or ft² (or RS for imperial roofing)
- Quick shapes: rectangle, triangle, trapezoid, circle
- Add multiple shapes → running total

**6. Volume Calculator**
- Inputs: area × depth OR width × length × depth
- Output: volume in m³ or ft³
- Use cases: concrete pour, fill material, excavation
- Material weight estimate (optional density input)

**7. Angle/Trig Quick Calculator**
- Right triangle solver: enter 2 sides or 1 side + 1 angle → solve all
- Useful for: ramp angles, cut angles, diagonal measurements

**8. Material Estimator (bonus)**
- Input: area + material type (tiles, sheets, membrane rolls)
- Output: estimated quantity needed (with waste factor)
- Tie-in to pitch factor for sloped roofs

### Phase 2: Layout & Marketing
- Hero section: "Free Roofing Pitch Calculator" + value prop
- Calculator cards in a clean grid (mobile-first, stacked)
- Sticky CTA bar: "Turn this into a full quote →" linking to signup
- "Email me these results" capture (no auth, just email + results payload)
- Footer with links to other calculators (future) + QuoteCore+ signup
- Meta tags: title, description, OG image, schema.org WebApplication structured data
- Canonical URL: `app.quote-core.com/pitch-calculator`

### Phase 3: Future Enhancements (post-launch)
- Additional calculator pages: `/roof-area-calculator`, `/rafter-length-calculator`
- "Save calculation" → free account
- Interactive roof diagram (SVG that redraws with inputs)
- Common roof type presets (gable, hip, valley)
- Material estimator (area → bundles/sheets needed)

## Tech Decisions
- **No Supabase, no auth** for the calculator itself — pure client-side math
- **No API routes needed** — all calculations run in-browser
- **Reuse engine functions** from `app/lib/pricing/engine.ts` (pure functions, no DB dependency)
- **Next.js SSG** (`generateStaticParams` or static rendering) for fast LCP + SEO
- **Tailwind + DESIGN_SYSTEM.md** patterns — match app visual language
- **Mobile-first** — big touch inputs, large result numbers

## SEO Targets
- Primary: "roofing pitch calculator"
- Secondary: "roof angle calculator", "rafter length calculator", "roof pitch ratio"
- Meta description: "Free roofing pitch calculator — convert degrees to ratio, calculate rafter length, roof area, and hip/valley lengths. No signup required."
- Schema.org WebApplication with name, description, applicationCategory, offers (free)

## Files to Create
1. `app/(public)/free-construction-calculator/page.tsx` — main page (server component for SEO meta)
2. `app/(public)/free-construction-calculator/ConstructionCalculator.tsx` — client component with all calculators
3. `app/(public)/free-construction-calculator/layout.tsx` — public layout (header with logo + signup CTA, no app nav)
4. `app/(public)/free-construction-calculator/components/` — individual calculator modules (PitchConverter, RafterCalculator, RoofAreaCalculator, HipValleyCalculator, AreaCalculator, VolumeCalculator, TrigCalculator, MaterialEstimator)

## Effort
~1.5 days for Phase 1+2. All math is already in the engine, main work is UI + SEO + the additional calculators (area², volume, trig, material estimator).
