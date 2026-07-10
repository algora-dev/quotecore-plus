# Trade Calculator Variants — SEO Expansion Plan

> Drafted 2026-07-10 (Fable 5, Shaun-requested). Goal: one underlying calculator engine,
> N trade-specific pages, each with its own URL, wording, and SEO copy — to capture
> "free/best <trade> calculator" searches and funnel signups to QuoteCore+.

## Strategy

The roofing calculator (`/free-roofing-calculator`) is the template. Its four tabs map to
generic capabilities any trade needs:

| Roofing tab | Generic capability |
|---|---|
| Roof Area | Area × factor + waste % + material quantity |
| Rafter / Hip & Valley | Trig lengths (rise/run/slope) |
| Draft Smart Component™ | Material estimating (QuoteCore+ lead-in) |
| Angle Finder | Angle/trig solver |

The calculator engine, unit system, and component structure are **shared**. What changes
per trade: page copy (H1, intro, tips, FAQs, formulas), tab names, input labels,
placeholder values, waste presets, example components, and metadata. That's enough
differentiation for each page to rank for its own trade terms without duplicate-content
risk — provided each page carries ~400-500 words of genuinely trade-specific copy.

**"Best X calculator" targeting:** every page gets an FAQ answering
"What is the best free <trade> calculator?" plus a benefits-led intro. Title format:
`Free <Trade> Calculator — <benefit> | QuoteCore+`.

## Trade pages

### Phase 1 (build first — Shaun's list)

**1. Building & Construction — `/free-construction-calculator`** *(reuse existing URL — already indexed; replace the old-format page with the new 4-tab format)*
- H1: "Construction Calculator" · Title: "Free Construction Calculator — Areas, Materials & Angles"
- Tabs: `Area & Materials` · `Timber & Stud Lengths` · `Draft Smart Component™` · `Angle Finder`
- Wording: "plan area" → "floor/wall area"; "pitch" → "slope/angle"; rafter examples → stud walls, joists, staircases
- Waste presets: timber 10%, plasterboard 10-15%, insulation 5%
- Keywords: construction calculator, building calculator, building materials calculator, timber calculator
- FAQs: "How do I calculate building material quantities?", "What waste % for timber?", "Best free construction calculator?"

**2. Landscaping — `/free-landscaping-calculator`**
- H1: "Landscaping Calculator" · Title: "Free Landscaping Calculator — Turf, Topsoil & Slopes"
- Tabs: `Garden & Lawn Area` · `Slope & Gradient` · `Draft Smart Component™` · `Angle Finder`
- Wording: "plan area" → "plot area"; "pitch" → "slope/gradient (or 1-in-X fall)"; lengths → paths, edging, fencing runs
- Waste presets: turf 5-10%, paving 10%, decking boards 10-15%, topsoil/mulch by depth (volume mode)
- Example components: turf rolls, topsoil m³, membrane, sleepers, paving slabs
- Keywords: landscaping calculator, turf calculator, topsoil calculator, garden calculator, mulch calculator
- FAQs: "How much turf do I need?", "How do I calculate topsoil volume?", "What is a 1-in-80 fall?"

**3. Concrete & Foundations — `/free-concrete-calculator`** *(highest search volume of the whole set — "concrete calculator" is a monster keyword)*
- H1: "Concrete Calculator" · Title: "Free Concrete Calculator — Slabs, Footings & Volumes"
- Tabs: `Slab & Footing Volume` (volume-first!) · `Area & Formwork` · `Draft Smart Component™` · `Falls & Gradients`
- Wording: volume-led — L × W × depth in m³; slab depth presets (100mm patio, 150mm driveway, 225mm footing); "pitch" → "fall" (drainage falls, 1-in-60/1-in-80)
- Example components: ready-mix m³, rebar mesh sheets, DPM, formwork timber
- Keywords: concrete calculator, concrete volume calculator, footing calculator, slab calculator, how much concrete do I need
- FAQs: "How much concrete for a slab?", "How many m³ in a foundation trench?", "What depth slab for a driveway?"

### Phase 2 (fast follows — high search volume, easy mapping)

**4. Carpentry & Joinery — `/free-carpentry-calculator`**
- Angle Finder is the star: mitre angles, compound cuts, birdsmouth. Lengths: stair stringers, studs, noggins
- Keywords: carpentry calculator, mitre angle calculator, stair stringer calculator, timber cut calculator

**5. Tiling & Flooring — `/free-tiling-calculator`**
- Area-first: room area, tile size → tile count + waste (10% straight, 15% diagonal)
- Keywords: tiling calculator, tile calculator, flooring calculator, how many tiles do I need

**6. Painting & Decorating — `/free-painting-calculator`**
- Wall/ceiling area minus openings, coverage per litre (12m²/L emulsion), coats
- Keywords: painting calculator, paint calculator, wallpaper calculator, how much paint do I need

**7. Bricklaying — `/free-bricklaying-calculator`**
- Wall area → bricks (60/m²) or blocks (10/m²), mortar volume, waste 5-10%
- Keywords: brick calculator, bricklaying calculator, block calculator, mortar calculator

### Phase 3 (optional — evaluate after phase 1/2 traffic data)

**8. Groundworks & Excavation — `/free-excavation-calculator`** — dig volume, spoil bulking (+25-30%), muck-away loads
**9. Decking & Fencing — `/free-decking-calculator`** — board counts from area, post/rail/panel counts from run length
**10. Plastering & Drywall — `/free-plastering-calculator`** — wall/ceiling area, coverage per bag, board counts

## Per-page uniqueness requirements (anti-duplicate-content)

Each page MUST have unique:
1. H1 + hero paragraph (trade language, ~50 words)
2. 6 trade-specific Tips (~60 words each — genuine trade knowledge, not reworded copies)
3. 5 trade-specific FAQs (one targeting "best free <trade> calculator")
4. Formula reference in trade terminology
5. Waste/coverage presets appropriate to the trade
6. Meta title + description; canonical; OG tags
7. JSON-LD: `WebApplication` + `FAQPage` schema

Shared without SEO harm: the calculator engine, tab components, unit-system toggle, layout shell.

## Architecture

1. **Config-driven refactor**: extract `TradeConfig` interface — tab labels, input labels,
   placeholders, presets, terminology, related links, signup ref. `RoofingCalculator.tsx`
   becomes `TradeCalculator.tsx` taking a config prop. Roofing page passes the roofing config.
2. **Route per trade**: `app/(public)/free-<trade>-calculator/{layout.tsx,page.tsx}` —
   layout has metadata, page has unique copy + `<TradeCalculator config={...} />`.
3. **Hub page**: `/free-calculators` — links every trade calculator (internal link equity,
   plus it can rank for "free trade calculators"). Add to top nav footer.
4. **Cross-linking**: each page's "Related calculators" links 2-3 sibling trades + free
   quote generator + signup (`/signup?ref=free-<trade>-calculator` for attribution).
5. **Sitemap**: add all pages to `app/sitemap.ts`.
6. Old `/free-construction-calculator` content is REPLACED by the new-format construction
   variant (keeps its indexed URL — no redirect needed).

## Effort estimate

- Config refactor of roofing calculator: **0.5-1 day** (careful, no visual changes to roofing page)
- Each trade page after that: **~2-3h** (bulk is copywriting, not code)
- Phase 1 (3 pages + hub + sitemap): **~2 days**
- Phase 2 (4 pages): **~1.5 days**

## Open questions for Shaun

1. Approve trade list + slugs above? Any to add/drop?
2. Concrete calculator: volume-first tab order OK?
3. Hub page at `/free-calculators` — yes/no?
4. Draft Smart Component™ branding stays identical on all pages (it's the QuoteCore hook) — agreed?
