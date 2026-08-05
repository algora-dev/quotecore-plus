# Calculator Audit Brief — Gerald

> Created: 2026-07-11
> Scope: Full audit of all trade calculator pages, engine, and SEO structure
> Bundle HEAD: `e7e5d02` on `development` (26 new roofing slugs + fixes uncommitted)

## What was built

### 1. Trade Calculator Engine (shipped 2026-07-11)
Config-driven calculator engine at `app/(public)/free-calculators/`. One shared engine, N trade pages. Adding a trade = one config file + thin layout/page pair.

**5 live calculators (base trades):**
1. `/free-roofing-calculator` — Roof Area, Rafter/Hip&Valley, Smart Component, Angle Finder
2. `/free-construction-calculator` — Area & Materials, Timber & Stud Lengths, Smart Component, Angle Finder
3. `/free-concrete-calculator` — Slab & Footing Volume, Area & Formwork, Smart Component, Falls & Gradients
4. `/free-landscaping-calculator` — Garden & Lawn Area, Slope & Gradient, Smart Component, Angle Finder
5. `/free-birds-mouth-calculator` — Bird's Mouth, Smart Component, Angle Finder

### 2. Roofing SEO Slug Expansion (shipped 2026-07-11)
26 roofing-specific SEO pages, all using the base roofing calculator engine but with unique copy:

**Pages (all static prerendered):**
- free-roof-pitch-calculator, free-roof-pitch-converter
- free-roof-area-calculator, free-rafter-length-calculator, free-rafter-length-converter
- free-hip-valley-calculator, free-hip-valley-converter
- free-roofing-material-calculator, free-metal-roofing-calculator
- free-shingle-calculator, free-roof-tile-calculator
- free-flat-roof-calculator, free-gable-roof-calculator, free-hip-roof-calculator
- free-skillion-roof-calculator
- free-roof-squares-calculator, free-roof-square-metre-calculator, free-roof-square-footage-calculator
- free-roof-sheathing-calculator, free-roofing-waste-calculator, free-roof-sheet-calculator
- free-guttering-calculator, free-roof-flashing-calculator
- free-roof-replacement-cost-calculator, free-roofing-takeoff-calculator, free-roofing-quote-calculator

### 3. Bird's Mouth Calculator Fixes (shipped 2026-07-11)
- Fixed missing header (now uses TradeLayoutShell like all other calculator pages)
- Cleaned up SVG diagram: removed redundant black A/B labels, enlarged blue angle annotations 50%, repositioned heel/notch text to eliminate overlap
- Converted Tips to collapsible `<details>` elements across all calculator pages

## Architecture

### File structure
```
app/(public)/free-calculators/
├── _shared/
│   ├── types.ts              # TradeConfig interface, currency defs, tab types
│   ├── TradeCalculator.tsx   # Client component: tabs, unit toggle, currency dropdown
│   ├── TradePage.tsx         # Server component: hero, calculator, tips, formulas, FAQ
│   ├── TradeLayoutShell.tsx  # Layout: header, footer, JSON-LD (WebApplication + FAQPage)
│   ├── roofingSlugPage.ts    # Helper for roofing slug pages
│   ├── AngleDiagram.tsx      # SVG diagrams (AngleVertexDiagram + BirdsmouthDiagram)
│   └── tabs/
│       ├── AreaTab.tsx       # Plan/actual area with pitch factor
│       ├── MembersTab.tsx    # Rafter, hip/valley, bird's mouth lengths
│       ├── GradientTab.tsx   # Degrees ⇄ 1-in-X ⇄ percent
│       ├── VolumeTab.tsx     # L×W×D with depth presets
│       ├── SmartComponentTab.tsx  # Draft Smart Component™ (QuoteCore+ lead-in)
│       └── AngleTab.tsx      # Angle finder (hip/valley, ridge, upstand)
├── configs/
│   ├── roofing.ts            # Base roofing config
│   ├── construction.ts       # Base construction config
│   ├── concrete.ts           # Base concrete config
│   ├── landscaping.ts        # Base landscaping config
│   ├── birdsmouth.ts         # Bird's mouth config
│   ├── registry.ts           # Combines base trades for hub page
│   ├── roofingSlugs1.ts      # Roofing slug defs 1-7 + SlugDef type + toConfig()
│   ├── roofingSlugs2.ts      # Roofing slug defs 8-14
│   ├── roofingSlugs3.ts      # Roofing slug defs 15-21
│   ├── roofingSlugs4.ts      # Roofing slug defs 22-26
│   └── roofingSlugRegistry.ts # Combines all roofing slugs + lookup
├── layout.tsx                # Hub page layout
└── page.tsx                  # Hub page: lists all calculators + roofing slugs
```

### Config structure
Each trade config (`TradeConfig` in `types.ts`) drives:
- **Tabs:** which calculator tabs appear (area, members, gradient, volume, smart, angle)
- **Tab configs:** labels, units, presets, terminology per tab
- **Content:** H1, hero text, 4-6 "Did you know?" tips (collapsible), 4-5 formulas, 4-5 FAQs
- **Metadata:** title, description, OG tags, canonical URL
- **JSON-LD:** WebApplication + FAQPage schema auto-generated from config

### Roofing slug pattern
Each of the 26 roofing slug pages is a thin wrapper:
- `app/(public)/free-<slug>/layout.tsx` — 4 lines: imports config, calls `buildTradeMetadata` + `TradeLayoutShell`
- `app/(public)/free-<slug>/page.tsx` — 3 lines: imports config, renders `TradePage`

The configs use a compact `SlugDef` format (tuples instead of objects) and a `toConfig()` helper that spreads the base `roofingConfig` and overrides only SEO content.

## What to audit

### 1. SEO correctness
- [ ] Each page has unique H1, hero text, tips, FAQs, and meta tags (no duplicate content)
- [ ] JSON-LD schema is valid (WebApplication + FAQPage) on every page
- [ ] Canonical URLs are correct (`https://quote-core.com/free-<slug>`)
- [ ] All 26 roofing slugs + 5 base trades are in `sitemap.ts`
- [ ] Hub page at `/free-calculators` links to all calculator pages
- [ ] Related links on each page point to relevant siblings
- [ ] OG tags are present and correct

### 2. Calculator engine correctness
- [ ] Pitch factor formula (1 ÷ cos(pitch°)) is correct across all tabs
- [ ] Rafter length (run ÷ cos(pitch°)) is correct
- [ ] Hip/valley length formula is correct (sqrt((1/cos)² + 1))
- [ ] Bird's mouth: seat angle = pitch, plumb angle = 90° − pitch
- [ ] Bird's mouth: heel = seat × tan(pitch), notch = seat × sin(pitch)
- [ ] Bird's mouth: ⅓-depth check logic (PASS if notch ≤ depth/3)
- [ ] Area tab: plan/actual mode toggle works correctly
- [ ] Volume tab: L×W×D with depth presets produces correct m³
- [ ] Gradient tab: degrees ⇄ percentage ⇄ 1-in-X conversions are correct
- [ ] Angle finder: all 5 angle types produce correct results
- [ ] Smart Component: pricing with waste, packs, and pitch factor works
- [ ] Unit system toggle (metric ⇄ imperial) converts correctly throughout
- [ ] Currency dropdown does not affect calculations (display only)

### 3. Bird's mouth diagram
- [ ] Black A/B labels are removed
- [ ] Blue angle annotations are 14px (50% larger than previous 9px)
- [ ] Heel text is positioned left of the heel line (no overlap)
- [ ] Notch text is positioned right with adequate spacing (no overlap)
- [ ] Diagram scales correctly at pitches from 5° to 75°
- [ ] All measurements (seat width, heel, notch, depth) display correctly

### 4. UX/UI
- [ ] Tips are collapsible (`<details>` / `<summary>`) on all calculator pages
- [ ] Tab navigation works correctly
- [ ] Mobile layout is usable (tabs scroll horizontally)
- [ ] Hub page lists all calculators including the 26 roofing slugs
- [ ] Bird's mouth page has the same header as other calculator pages
- [ ] All pages have consistent header/footer (TradeLayoutShell)

### 5. Performance
- [ ] All pages are static prerendered (○ in build output)
- [ ] No unnecessary client-side JavaScript on SEO pages
- [ ] Shared engine code is not duplicated per page

### 6. Content quality
- [ ] Tips are genuinely useful and trade-specific (not reworded copies)
- [ ] FAQs answer real user questions
- [ ] Formulas are correct and use correct terminology
- [ ] No placeholder text or TODOs remain

## Known limitations / future work

1. **Roofing slug pages share the same calculator engine** — the tabs and inputs are identical to the base roofing calculator. The differentiation is purely in SEO copy (H1, hero, tips, FAQs). This is by design but means the user experience is the same across all 26 pages.

2. **No per-slug calculator customization** — e.g., `/free-roof-pitch-calculator` could default to the Rafter tab instead of the Roof Area tab. Currently all pages default to the first tab. This is a future enhancement.

3. **The plan doc (`docs/TRADE-CALCULATORS-PLAN.md`)** outlines 50+ more slugs for other trades (concrete, construction, landscaping variants). Not yet built.

4. **"Converter" pages** (pitch converter, rafter converter, hip-valley converter) are functionally identical to their "calculator" counterparts. The differentiation is in SEO copy framing ("convert" vs "calculate").

5. **Bird's mouth diagram** could benefit from leader lines instead of absolute positioning. Current fix reduces overlap but doesn't eliminate it at extreme pitches.

## Files for Gerald to review

### Core engine
- `app/(public)/free-calculators/_shared/types.ts`
- `app/(public)/free-calculators/_shared/TradeCalculator.tsx`
- `app/(public)/free-calculators/_shared/TradePage.tsx`
- `app/(public)/free-calculators/_shared/TradeLayoutShell.tsx`
- `app/(public)/free-calculators/_shared/AngleDiagram.tsx`
- `app/(public)/free-calculators/_shared/tabs/*.tsx` (6 tab components)

### Configs
- `app/(public)/free-calculators/configs/roofing.ts`
- `app/(public)/free-calculators/configs/birdsmouth.ts`
- `app/(public)/free-calculators/configs/roofingSlugs{1-4}.ts`
- `app/(public)/free-calculators/configs/roofingSlugRegistry.ts`

### Sample slug pages (verify pattern)
- `app/(public)/free-roof-pitch-calculator/{layout,page}.tsx`
- `app/(public)/free-roofing-quote-calculator/{layout,page}.tsx`

### Hub + sitemap
- `app/(public)/free-calculators/page.tsx`
- `app/sitemap.ts`

### Docs
- `docs/TRADE-CALCULATORS-PLAN.md` (full strategy + 50-slug master list)

---

Shaun: kick off Gerald when ready. The brief above covers the full scope. Results should land in `workspace-gerald/audits/`.
