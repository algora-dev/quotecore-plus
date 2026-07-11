import type { TradeConfig } from '../_shared/types';
import { constructionConfig } from './construction';

interface ConstrSlugDef {
  slug: string;
  name: string;
  mTitle: string;
  mDesc: string;
  ogTitle: string;
  ogDesc: string;
  h1: string;
  hero: string;
  tipsH: string;
  defaultTab?: string;
  tips: [string, string][];
  formulas: [string, string][];
  faqs: [string, string][];
  workedExample: string[];
  assumptions: string[];
  whenToAskPro: string;
}

function toConfig(d: ConstrSlugDef): TradeConfig {
  return {
    ...constructionConfig,
    slug: d.slug,
    name: d.name,
    metaTitle: d.mTitle,
    metaDescription: d.mDesc,
    ogTitle: d.ogTitle,
    ogDescription: d.ogDesc,
    defaultTab: d.defaultTab,
    content: {
      ...constructionConfig.content,
      h1: d.h1,
      heroText: d.hero,
      tipsHeading: d.tipsH,
      tips: d.tips.map(([title, body]) => ({ title, body })),
      formulas: d.formulas.map(([name, formula]) => ({ name, formula })),
      faqs: d.faqs.map(([q, a]) => ({ q, a })),
      workedExample: {
        title: d.workedExample[0],
        steps: d.workedExample.slice(1),
      },
      assumptions: d.assumptions,
      whenToAskPro: d.whenToAskPro,
      related: [
        { href: '/free-construction-calculator', title: 'Free Construction Calculator', desc: 'Full construction calculator' },
        { href: '/free-roofing-calculator', title: 'Free Roofing Calculator', desc: 'Roof area, rafters, and materials' },
        { href: '/free-quote-generator', title: 'Free Quote Generator', desc: 'Turn measurements into a quote' },
      ],
    },
  };
}

export const CONSTRUCTION_SLUGS: ConstrSlugDef[] = [
  {
    slug: 'free-wall-area-calculator',
    name: 'Wall Area Calculator',
    mTitle: 'Free Wall Area Calculator — Paint, Plaster & Render | QuoteCore+',
    mDesc: 'Calculate wall area for painting, plastering, rendering, and tiling. Subtract windows and doors automatically. No signup required.',
    ogTitle: 'Free Wall Area Calculator',
    ogDesc: 'Calculate wall surface area for paint, plaster, render, and tiles. Free, no signup.',
    h1: 'Wall Area Calculator',
    hero: 'Calculate wall surface area for painting, plastering, rendering, and tiling. Enter wall dimensions and openings to get net area instantly.',
    tipsH: 'Wall area calculation tips',
    defaultTab: 'area-materials',
    tips: [
      ['Measuring walls for paint', 'Measure wall width and height in metres. Multiply to get gross area, then subtract doors (typically 1.9 m² each) and windows (typically 1.5 m² each). One litre of paint covers approximately 10 m² per coat on smooth walls.'],
      ['Plastering quantities', 'Undercoat plaster: 2mm thickness requires about 2kg/m². Skim coat: 2mm requires about 2kg/m². A 25kg bag of multi-finish covers about 10 m² at 3mm thickness. Order 10% extra for waste.'],
      ['Rendering calculations', 'Scratch coat (10mm): about 18kg/m² of render. Top coat (6mm): about 11kg/m². A 25kg bag of render covers about 1.5 m² at 10mm. Add 10-15% waste for uneven walls.'],
      ['Tiling wall area', 'Calculate net wall area, then divide by tile size (including grout gap). For 300×600mm tiles: 1/(0.3×0.6) = 5.56 tiles/m². Add 10% waste for straight lay, 15% for diagonal. Order extra — dye-lots change between batches.'],
    ],
    formulas: [
      ['Gross wall area', 'A = width × height'],
      ['Net wall area', 'A_net = A - (doors × door_area) - (windows × window_area)'],
      ['Paint needed', 'litres = A_net / coverage_per_litre × coats'],
      ['Tiles needed', 'tiles = ceil(A_net × (1 + waste%) / tile_area)'],
    ],
    faqs: [
      ['How much paint do I need for a 4m × 2.5m wall with one door?', 'Gross area = 10 m². Minus door (1.9 m²) = 8.1 m². At 10 m²/L per coat, 2 coats: 8.1 × 2 / 10 = 1.62 litres. Buy a 2L tin.'],
      ['How do I calculate render quantity?', 'Net wall area × thickness in mm × 1.8 kg = kg of render needed. For 20 m² at 10mm: 20 × 10 × 1.8 = 360 kg = 15 bags of 25kg. Add 10% waste: 17 bags.'],
      ['How many tiles do I need per square metre?', 'For 300×600mm tiles: 1/(0.3×0.6) = 5.56 tiles/m². For 600×600mm: 1/(0.6×0.6) = 2.78 tiles/m². For 150×150mm: 1/(0.15×0.15) = 44.4 tiles/m². Add 10% waste.'],
      ['Should I subtract skirting boards?', 'Skirting boards are typically 100-150mm tall. For a 4m wide wall, that\'s 0.4-0.6 m² — usually negligible for paint calculations but worth subtracting for expensive tiles.'],
    ],
    workedExample: [
      'Worked example: 5m × 2.4m wall with 1 door and 1 window, painting 2 coats',
      'Gross area = 5 × 2.4 = 12.0 m²',
      'Door area = 0.9 × 2.1 = 1.89 m²',
      'Window area = 1.2 × 1.0 = 1.2 m²',
      'Net paintable area = 12.0 - 1.89 - 1.2 = 8.91 m²',
      'Paint (10 m²/L, 2 coats): 8.91 × 2 / 10 = 1.78 litres',
      'Buy 2L tin (nearest available size)',
    ],
    assumptions: [
      'Standard door area assumed at 1.9 m² (0.9m × 2.1m). Adjust for non-standard sizes.',
      'Standard window area assumed at 1.5 m². Measure actual openings for accuracy.',
      'Paint coverage of 10 m²/L is for smooth surfaces on a primed wall. Rough surfaces reduce coverage by 20-30%.',
      'Tile calculations include a 2mm grout gap. Larger gaps slightly reduce tiles needed.',
    ],
    whenToAskPro: 'For rendering over 15mm thick, external wall insulation systems, or damp-proofing, consult a specialist contractor. Structural wall modifications (removing walls, enlarging openings) require a structural engineer and building control approval.',
  },
  {
    slug: 'free-paint-calculator',
    name: 'Paint Calculator',
    mTitle: 'Free Paint Calculator — How Much Paint Do I Need? | QuoteCore+',
    mDesc: 'Calculate how much paint you need for walls, ceilings, and rooms. Enter dimensions, get litres needed and cost. No signup required.',
    ogTitle: 'Free Paint Calculator',
    ogDesc: 'Work out paint quantities for any room. Litres, coats, and cost. Free, no signup.',
    h1: 'Paint Calculator',
    hero: 'Calculate exactly how much paint you need. Enter room or wall dimensions, number of coats, and get litres required and estimated cost.',
    tipsH: 'Paint calculation tips',
    defaultTab: 'area-materials',
    tips: [
      ['Paint coverage by type', 'Emulsion: 10-14 m²/L per coat on smooth walls. Gloss/eggshell: 12-15 m²/L. Masonry paint: 6-8 m²/L on rough render. Primer: 8-12 m²/L. Always check the tin — coverage varies by manufacturer and surface texture.'],
      ['How many coats do I need?', 'Two coats is standard for a colour change. Three coats for dark colours over light, or when painting over strong existing colours. Use a primer/sealer first when covering very dark walls or stains.'],
      ['Painting new plaster', 'New plaster needs a mist coat (diluted emulsion at 70:30 paint:water) before the first full coat. Allow new plaster to dry fully — typically 4-6 weeks for sand/cement plaster, 1-2 weeks for skim coat.'],
      ['Wastage and leftover paint', 'Order 10% extra for touch-ups and wastage. Keep leftover paint sealed and stored upright in a frost-free location for future touch-ups. Write the room name on the tin with a marker.'],
    ],
    formulas: [
      ['Paintable area', 'A = wall_area - openings'],
      ['Paint volume', 'V = (A × coats) / coverage_per_litre'],
      ['With waste', 'V_total = V × 1.10'],
      ['Cost', 'cost = V_total × price_per_litre'],
    ],
    faqs: [
      ['How much paint for a standard room (4m × 4m × 2.4m)?', 'Wall area = 2×(4+4)×2.4 = 38.4 m². Minus 1 door (1.9) + 1 window (1.5) = 35.0 m². Ceiling = 16 m². Total = 51 m². Two coats at 12 m²/L: 51×2/12 = 8.5L. Buy 2×5L tins.'],
      ['How much does paint cost per litre?', 'Trade emulsion: £3-6/L. Designer emulsion: £8-15/L. Gloss: £5-8/L. Masonry: £3-5/L. Buying 5L tins is cheaper per litre than 1L tins. Trade paint is generally better value than retail.'],
      ['Can I use this for exterior painting?', 'Yes — enter the wall dimensions and use masonry paint coverage (6-8 m²/L on rough render). Add 15% waste for exterior work due to overspray and uneven surfaces. Don\'t paint in direct sunlight or below 5°C.'],
      ['How long does paint last?', 'Unopened: 2-5 years if stored correctly. Opened: 1-2 years if resealed properly. Water-based paint that has been frozen is unusable. Oil-based paint lasts longer but check for skinning before use.'],
    ],
    workedExample: [
      'Worked example: Living room 5m × 4m × 2.4m, 1 door, 2 windows, 2 coats',
      'Wall area = 2×(5+4)×2.4 = 43.2 m²',
      'Openings: 1 door (1.9) + 2 windows (3.0) = 4.9 m²',
      'Net wall area = 43.2 - 4.9 = 38.3 m²',
      'Ceiling area = 5 × 4 = 20 m²',
      'Total paintable = 58.3 m²',
      'Paint at 12 m²/L, 2 coats: 58.3 × 2 / 12 = 9.7L',
      'With 10% waste: 10.7L — buy 2×5L + 1L tins',
      'Cost at £5/L: about £55',
    ],
    assumptions: [
      'Coverage of 12 m²/L is typical for trade emulsion on smooth, primed walls.',
      'Two coats assumed for colour changes. Use one coat only for like-for-like refresh.',
      'Standard door = 1.9 m², standard window = 1.5 m². Measure actual openings for accuracy.',
      '10% waste allowance covers roller absorption, tray residue, and touch-ups.',
      'Ceiling paint calculated separately if using a different paint type.',
    ],
    whenToAskPro: 'For lead paint removal (pre-1970s properties), specialist encapsulation or removal is required by law. For high-rise exterior painting, use a qualified contractor with appropriate access equipment and insurance.',
  },
  {
    slug: 'free-tile-calculator',
    name: 'Tile Calculator',
    mTitle: 'Free Tile Calculator — How Many Tiles Do I Need? | QuoteCore+',
    mDesc: 'Calculate how many tiles you need for floors and walls. Enter dimensions and tile size, get quantity, waste, and cost. No signup.',
    ogTitle: 'Free Tile Calculator',
    ogDesc: 'Work out tile quantities for any surface. Includes waste, cost, and pattern allowances. Free, no signup.',
    h1: 'Tile Calculator',
    hero: 'Calculate how many tiles you need for floors, walls, and splashbacks. Enter area dimensions and tile size to get exact quantities with waste allowance.',
    tipsH: 'Tile calculation tips',
    defaultTab: 'area-materials',
    tips: [
      ['Waste allowance by pattern', 'Straight lay: 10% waste. Diagonal (45°): 15% waste. Herringbone/chevron: 15-20% waste. Complex patterns with multiple tile sizes: 20-25%. Always order extra — dye-lots change between production runs.'],
      ['Tile sizes and coverage', 'Common sizes: 300×300mm = 11.1 tiles/m², 300×600mm = 5.6 tiles/m², 600×600mm = 2.8 tiles/m², 150×150mm = 44.4 tiles/m². Larger tiles mean fewer cuts but more waste per cut.'],
      ['Grout quantities', 'Grout needed depends on tile size, joint width, and tile depth. For 300×300mm tiles with 3mm joints: about 0.5 kg/m². For 600×600mm with 5mm joints: about 0.4 kg/m². A 5kg bag covers about 10 m².'],
      ['Ordering tiles — buy extra', 'Always order 10-15% more than calculated. Keep 1-2 boxes for future repairs. Tile batches vary in colour and calibration — mixing boxes during installation gives a more uniform appearance.'],
    ],
    formulas: [
      ['Area to tile', 'A = length × width - openings'],
      ['Tiles per m²', 'tiles_per_m² = 1 / (tile_w × tile_h)'],
      ['Total tiles', 'tiles = ceil(A × (1 + waste%) × tiles_per_m²)'],
      ['Cost', 'cost = (tiles / tiles_per_box) × price_per_box'],
    ],
    faqs: [
      ['How many 600×600mm tiles do I need for 20 m²?', 'Tiles per m² = 1/(0.6×0.6) = 2.78. With 10% waste: 20 × 1.10 × 2.78 = 61.2 → 62 tiles. If sold in boxes of 4: buy 16 boxes (64 tiles).'],
      ['How much grout do I need?', 'For 300×300mm tiles with 3mm joints: 0.5 kg/m². For a 20 m² floor: 10 kg = 2 bags of 5kg. For larger tiles or wider joints, use an online grout calculator for precision.'],
      ['What waste percentage should I add for diagonal tiling?', 'Use 15% waste for diagonal (45°) laying. For herringbone or complex patterns, use 15-20%. The more cuts at the perimeter, the more waste you generate.'],
      ['Can I use floor tiles on walls?', 'Yes, most floor tiles can be used on walls, but wall tiles cannot be used on floors — they\'re not rated for foot traffic. Check the PEI rating: PEI 3+ for floors, PEI 1-2 for walls only.'],
    ],
    workedExample: [
      'Worked example: 4m × 3m bathroom floor with 300×600mm tiles, straight lay',
      'Floor area = 4 × 3 = 12 m²',
      'Tiles per m² = 1 / (0.3 × 0.6) = 5.56',
      'With 10% waste: 12 × 1.10 = 13.2 m²',
      'Tiles needed: ceil(13.2 × 5.56) = 74 tiles',
      'Grout at 0.5 kg/m²: 12 × 0.5 = 6 kg (2 bags of 5kg)',
      'Cost at £2.50/tile: 74 × £2.50 = £185.00',
    ],
    assumptions: [
      'Tile dimensions include grout gap in calculation. Actual tile size may vary by ±1mm.',
      '10% waste is standard for straight lay. Use 15% for diagonal, 20% for herringbone.',
      'Grout calculation is approximate — use manufacturer\'s calculator for exact quantities.',
      'Boxes may not divide evenly — round up to full boxes.',
      'Always check tile batch numbers match before installation.',
    ],
    whenToAskPro: 'For wet rooms, waterproof tanking must be installed before tiling by a specialist. For heavy stone tiles on walls, verify the substrate can support the weight (max 32 kg/m² for plaster, 50 kg/m² for tile backer board).',
  },
  {
    slug: 'free-flooring-calculator',
    name: 'Flooring Calculator',
    mTitle: 'Free Flooring Calculator — Laminate, Wood & Vinyl | QuoteCore+',
    mDesc: 'Calculate how much laminate, wood, or vinyl flooring you need. Enter room dimensions and pack size for accurate quantities. No signup.',
    ogTitle: 'Free Flooring Calculator',
    ogDesc: 'Work out flooring quantities for any room. Includes waste, packs needed, and cost. Free, no signup.',
    h1: 'Flooring Calculator',
    hero: 'Calculate how many packs of laminate, wood, or vinyl flooring you need. Enter room dimensions and pack coverage to get exact quantities with waste.',
    tipsH: 'Flooring calculation tips',
    defaultTab: 'area-materials',
    tips: [
      ['Waste allowance for flooring', 'Straight lay: 5-10% waste. Diagonal: 10-15%. In rooms with lots of doorways, alcoves, or irregular shapes: 12-15%. Always buy full packs — you can\'t buy individual planks.'],
      ['Acclimatising flooring', 'Laminate and engineered wood must acclimatise in the room for 48 hours before installation. Leave boxes flat, unopened, in the centre of the room. Do not install cold flooring in a warm room — it will expand and buckle.'],
      ['Underlay types', 'Standard foam underlay: 3mm, for sound reduction only. Wood fibre underlay: 5-7mm, for sound and thermal insulation. Combination underlay with DPM: for concrete subfloors. Always use the manufacturer\'s recommended underlay.'],
      ['Doorway transitions', 'Leave a 10mm expansion gap at all doorways and edges. Use T-profiles for same-height transitions, reducer profiles for different heights. Measure doorway widths before ordering transition strips.'],
    ],
    formulas: [
      ['Room area', 'A = length × width'],
      ['With waste', 'A_total = A × (1 + waste%)'],
      ['Packs needed', 'packs = ceil(A_total / pack_coverage)'],
      ['Cost', 'cost = packs × price_per_pack'],
    ],
    faqs: [
      ['How much laminate do I need for a 4m × 3m room?', 'Area = 12 m². With 10% waste: 13.2 m². If each pack covers 1.48 m²: ceil(13.2 / 1.48) = 9 packs. Check the pack — coverage varies by manufacturer and plank thickness.'],
      ['How much underlay do I need?', 'Order the same area as your flooring plus 5% waste. Underlay comes in rolls (typically 10 m² or 15 m²) or as click-together tiles. For 12 m²: order 15 m² of underlay.'],
      ['Can I install laminate over existing floorboards?', 'Yes, if the floorboards are flat and secure. Use combination underlay with DPM over concrete. Over wooden subfloors, lay at 90° to the existing floorboards for stability. Check for squeaks and fix before installation.'],
      ['How much expansion gap do I need for laminate?', '10mm minimum around all edges, doorways, and fixed obstacles (pipes, radiators). The gap is hidden by skirting boards or scotia/quarter-round beading. Failure to leave gaps causes buckling.'],
    ],
    workedExample: [
      'Worked example: 5m × 4m living room, laminate at 1.48 m²/pack, £28/pack',
      'Room area = 5 × 4 = 20 m²',
      'With 10% waste: 20 × 1.10 = 22 m²',
      'Packs needed: ceil(22 / 1.48) = 15 packs',
      'Underlay (15 m² rolls): ceil(22 / 15) = 2 rolls',
      'Cost: 15 × £28 = £420.00 (flooring only)',
      'Add underlay at £30/roll: +£60 = £480 total',
    ],
    assumptions: [
      'Pack coverage varies by manufacturer — always check the box label for m² per pack.',
      '10% waste is standard for straight lay in rectangular rooms.',
      'Underlay area should match flooring area plus 5% for waste and cuts.',
      'Expansion gaps of 10mm are required at all perimeters for floating installations.',
      'Subfloor must be flat (max 3mm deviation over 2m) before installation.',
    ],
    whenToAskPro: 'For solid wood flooring (not engineered), installation over underfloor heating requires specialist advice. For concrete subfloors with high moisture content, a damp-proof membrane is essential. Uneven subfloors (deviation >3mm over 2m) need self-levelling compound before installation.',
  },
];

export const CONSTRUCTION_SLUG_CONFIGS = CONSTRUCTION_SLUGS.map(toConfig);

export function getConstructionSlugConfig(slug: string): TradeConfig | undefined {
  return CONSTRUCTION_SLUG_CONFIGS.find(c => c.slug === slug);
}
