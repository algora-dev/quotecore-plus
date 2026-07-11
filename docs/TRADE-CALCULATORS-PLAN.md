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

## Master slug list — 30-50+ pages (added 2026-07-11, Shaun-approved mission)

Goal: every plausible "best/free <trade> calculator" search gets its own page. Each page =
one config file assigned to a **base calculator** + unique wording/tips/FAQs. Bases:

- **A — Construction base** (Area & Materials · Member Lengths · Smart Component · Angle Finder)
- **B — Roofing base** (Roof Area · Rafter/Hip & Valley · Smart Component · Angle Finder)
- **C — Landscaping base** (Area · Slope & Gradient · Smart Component · Angle Finder)
- **D — Concrete base** (Volume-first · Area · Smart Component · Falls & Gradients)

| # | Trade / audience | Slug | Base | Wording & SEO angle |
|---|---|---|---|---|
| 1 | Carpentry & joinery | `/free-carpentry-calculator` | A | mitre angles, stringers, studs; "timber cut calculator" |
| 2 | Framing (US) | `/free-framing-calculator` | A | studs @16"/24" OC, headers; US spelling/units first |
| 3 | Drywall (US) | `/free-drywall-calculator` | A | sheets, mud, screws; "how much drywall do I need" |
| 4 | Plastering | `/free-plastering-calculator` | A | coverage per bag, coats, board counts |
| 5 | Rendering | `/free-rendering-calculator` | A | render coats, sand/cement ratio, mesh |
| 6 | Cladding | `/free-cladding-calculator` | A | wall L×H areas, battens, membrane |
| 7 | Insulation | `/free-insulation-calculator` | A | roll/slab coverage, rafter vs stud bays |
| 8 | Tiling | `/free-tiling-calculator` | A | tiles-per-m², adhesive, grout; 10/15% waste straight/diagonal |
| 9 | Flooring | `/free-flooring-calculator` | A | packs from room area; "how many packs of flooring" |
| 10 | Laminate flooring | `/free-laminate-flooring-calculator` | A | pack coverage, expansion gaps |
| 11 | Carpet | `/free-carpet-calculator` | A | roll widths, seams, gripper |
| 12 | Epoxy flooring | `/free-epoxy-flooring-calculator` | A | kit coverage per coat, garage floors |
| 13 | Painting & decorating | `/free-painting-calculator` | A | walls minus openings, 12m²/L, coats |
| 14 | Wallpaper | `/free-wallpaper-calculator` | A | rolls from wall H×perimeter, pattern repeat |
| 15 | Bricklaying | `/free-brick-calculator` | A | 60 bricks/m², mortar volume |
| 16 | Blockwork | `/free-block-calculator` | A | 10 blocks/m², cavity walls |
| 17 | Stud walls | `/free-stud-wall-calculator` | A | studs/plates/noggins from wall length |
| 18 | Staircases | `/free-staircase-calculator` | A | stringer length, rise/going, regs limits |
| 19 | Loft conversion | `/free-loft-conversion-calculator` | A | rake areas, dwarf walls, headroom at pitch |
| 20 | Renovation / general | `/free-renovation-calculator` | A | room-by-room areas, multi-material |
| 21 | Handyman (US) | `/free-handyman-calculator` | A | quick areas + per-hour labour pricing |
| 22 | Metal roofing | `/free-metal-roofing-calculator` | B | sheet coverage, laps; "metal roof cost calculator" |
| 23 | Shingles (US) | `/free-shingle-calculator` | B | squares (100 sq ft), bundles = ⅓ square |
| 24 | Flat roofing | `/free-flat-roofing-calculator` | B | membrane/felt rolls, minimal falls, upstands |
| 25 | Tile roofing | `/free-roof-tile-calculator` | B | tiles/m² by format, battens, ridge |
| 26 | Guttering & fascia | `/free-guttering-calculator` | B | eaves runs, downpipes per m² roof, fascia lengths |
| 27 | Solar installers | `/free-solar-panel-calculator` | B | usable roof area at pitch, panel count |
| 28 | Roof windows | `/free-skylight-calculator` | B | opening sizes vs rafter spacing, flashing angles |
| 29 | Turf | `/free-turf-calculator` | C | rolls from lawn area; "how much turf do I need" |
| 30 | Sod (US) | `/free-sod-calculator` | C | US wording of turf page, sq ft first |
| 31 | Topsoil | `/free-topsoil-calculator` | C | area × depth → m³ → bulk bags |
| 32 | Mulch | `/free-mulch-calculator` | C | 50-75mm depth, m³ → bags |
| 33 | Gravel | `/free-gravel-calculator` | C | depth presets, tonnes via 1.8t/m³ |
| 34 | Paving & patios | `/free-paving-calculator` | C | slab counts, laying pattern waste, falls |
| 35 | Artificial grass | `/free-artificial-grass-calculator` | C | roll widths, joins, infill sand |
| 36 | Decking | `/free-decking-calculator` | C | board counts, joists, posts from area |
| 37 | Fencing | `/free-fencing-calculator` | C | panels/posts/gravel boards from run length |
| 38 | Garden design | `/free-garden-design-calculator` | C | mixed beds/lawn/paving zones |
| 39 | Irrigation | `/free-irrigation-calculator` | C | zone areas, pipe runs, falls |
| 40 | Excavation | `/free-excavation-calculator` | D | dig volume, spoil bulking +25-30%, muck-away loads |
| 41 | Foundations | `/free-foundation-calculator` | D | strip/trench/pad volumes, rebar |
| 42 | Footings | `/free-footing-calculator` | D | trench L×W×D, 10% over-dig waste |
| 43 | Screed | `/free-screed-calculator` | D | thin depths 50-75mm, bags vs ready-mix |
| 44 | Asphalt / tarmac | `/free-asphalt-calculator` | D | tonnes via 2.3t/m³, compaction |
| 45 | Driveways | `/free-driveway-calculator` | D | 150mm preset, sub-base + surface layers |
| 46 | Sand | `/free-sand-calculator` | D | 1.6t/m³, bedding depths |
| 47 | Aggregate / hardcore | `/free-aggregate-calculator` | D | MOT Type 1, compacted depth |
| 48 | Cement / mortar | `/free-cement-calculator` | D | mix ratios, bags from volume |
| 49 | Groundworks | `/free-groundworks-calculator` | D | dig + cart-away + backfill combined |
| 50 | Pool builders | `/free-pool-calculator` | D | excavation + shell volume, backfill |

Improvements to existing names

A few of your current pages may be too broad or use weaker search wording:

Painting & decorating: use /free-paint-calculator as the main page. “Paint calculator” is generally the clearer direct intent.
Carpentry & joinery: keep the hub, but add separate /free-mitre-angle-calculator, /free-stair-stringer-calculator, /free-stud-calculator and /free-timber-cut-calculator.
Renovation/general: “renovation calculator” is ambiguous. Decide whether it calculates cost, area, or materials, and name it accordingly.
Garden design: also too broad unless it becomes a multi-zone material planner. Consider /free-landscape-area-calculator.
Groundworks: retain it as a hub, but standalone trench, excavation, spoil and backfill pages will target clearer intent.
Pool: split into /free-pool-volume-calculator, /free-pool-excavation-calculator and /free-pool-water-calculator.
Irrigation: split later into zone area, pipe sizing and sprinkler spacing.
Plastering: consider both /free-plaster-calculator and a regionally relevant plasterboard/drywall page, but avoid duplicating identical content.

Do not create 100 nearly identical pages with only a changed heading. Search engines and users will get more value from this structure:

/free-roofing-calculators
├── /free-roof-pitch-calculator
├── /free-roof-area-calculator
├── /free-rafter-length-calculator
├── /free-hip-valley-calculator
├── /free-metal-roofing-calculator
├── /free-shingle-calculator
└── /free-roof-tile-calculator

Each page should have genuinely unique:

inputs and outputs
diagrams
worked examples
FAQs
terminology
related tools
Draft Smart Component™ conversion
trade-specific CTA

My recommended first 20 beyond your current list

Prioritise these:

Concrete
Concrete slab
Roof pitch
Roof area
Rafter length
Hip/valley
Plywood/sheet count
Retaining wall
Slope/grade
Trench
Wall area
Pipe fall
Cable/voltage drop
HVAC/BTU
Markup
Profit margin
Labour charge-out rate
Waste
Pack quantity
Job price

Additions:

51	Concrete	/free-concrete-calculator	slabs, walls, pads, columns, bags, m³/yd³
52	Concrete slab	/free-concrete-slab-calculator	slab area × thickness, mesh, over-order
53	Concrete bags	/free-concrete-bag-calculator	20/25/40 kg and 60/80 lb bags
54	Concrete column/pier	/free-concrete-column-calculator	circular and rectangular piers
55	Rebar	/free-rebar-calculator	spacing, laps, bar lengths, weight
56	Roof pitch	/free-roof-pitch-calculator	degrees, ratio, rise/run
57	Roof area	/free-roof-area-calculator	plan area adjusted by pitch
58	Rafter length	/free-rafter-length-calculator	span, run, overhang, ridge allowance
59	Hip and valley	/free-hip-valley-calculator	diagonal plan run, slope, true length
60	Gable roof	/free-gable-roof-calculator	area, rafters, ridge, sheets
61	Shed roof	/free-shed-roof-calculator	mono-pitch area and rafter length
62	Plywood/sheeting	/free-plywood-calculator	sheet count, orientation, waste
63	Timber/lumber	/free-lumber-calculator	lengths, board feet, cubic volume
64	Board feet	/free-board-foot-calculator	strong US search intent
65	Sheet optimiser	/free-sheet-cutting-calculator	plywood, plasterboard, panels
66	Linear to area	/free-linear-to-square-calculator	length × product width
67	Slope/grade	/free-slope-calculator	degrees, %, ratio, rise/run
68	Ramp	/free-ramp-calculator	rise, run, gradient, accessibility warning
69	Retaining wall	/free-retaining-wall-calculator	blocks, drainage gravel, backfill
70	Drainage	/free-drainage-calculator	pipe falls, trench volume, aggregate
71	Pipe fall	/free-pipe-slope-calculator	gradient, drop over length
72	Trench	/free-trench-calculator	excavation, bedding, backfill, spoil
73	Wall area	/free-wall-area-calculator	openings, multiple walls, perimeter × height
74	Ceiling area	/free-ceiling-calculator	boards, battens, insulation, paint
75	Room area	/free-room-area-calculator	irregular rooms and multiple zones

Possible others:

Cable size	/free-cable-size-calculator	current, length, voltage drop; jurisdiction disclaimer
Voltage drop	/free-voltage-drop-calculator	AC/DC, cable length and conductor
Conduit fill	/free-conduit-fill-calculator	cable count and conduit size
Electrical load	/free-electrical-load-calculator	watts, amps, volts, phases
Lighting	/free-lighting-calculator	room area, lumens, fixture count
Pipe volume	/free-pipe-volume-calculator	diameter × length
Pipe flow	/free-pipe-flow-calculator	diameter, velocity, flow rate
Plumbing fall	/free-plumbing-slope-calculator	required drop over run
Radiator sizing	/free-radiator-size-calculator	room dimensions and heat requirement
HVAC/BTU	/free-btu-calculator	room volume, insulation and climate
Duct sizing	/free-duct-size-calculator	airflow and duct dimensions
Heat loss	/free-heat-loss-calculator	walls, windows, insulation and temperature

NOTE: For regulated calculations, clearly say the result is an estimate and must be checked against local codes and qualified design requirements. Blocklayer similarly warns that its geometric outputs do not replace local engineering and regulatory checks.

Other potential calculators purely for getting people on the page that have simple calculation methods:

Markup	/free-markup-calculator	Save pricing rule as Smart Component™
Margin	/free-profit-margin-calculator	Build reusable quote pricing
Labour rate	/free-labour-rate-calculator	Save employee/crew rate
Charge-out rate	/free-charge-out-rate-calculator	overhead + profit + utilisation
Job cost	/free-job-cost-calculator	convert directly into quote
Quote price	/free-quote-price-calculator	materials + labour + waste + margin
GST	/free-gst-calculator	NZ/AU localisation
VAT	/free-vat-calculator	UK localisation
Sales tax	/free-sales-tax-calculator	US localisation
Break-even	/free-break-even-calculator	business-focused lead
Material waste	/free-waste-calculator	save waste rule
Pack quantity	/free-pack-quantity-calculator	round up to purchasable packs

US-audience duplicates (sod/framing/drywall/shingles/handyman) use imperial-first defaults and US
terminology — same engine, config flag only. Beyond these 50, the same pattern extends to niche
searches (sheetrock, pergola, retaining wall, driveway sealer) once traffic data shows demand.

**Rollout after Phase 1:** batches of 5-8 pages, each page needing only a config + ~500 words
unique copy (~1-2h each). Hub page and sitemap update automatically via the registry.

## Open questions for Shaun

1. Approve trade list + slugs above? Any to add/drop?
2. Concrete calculator: volume-first tab order OK?
3. Hub page at `/free-calculators` — yes/no?
4. Draft Smart Component™ branding stays identical on all pages (it's the QuoteCore hook) — agreed?
