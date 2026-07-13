import type { TradeConfig } from '../_shared/types';
import { concreteConfig } from './concrete';

/** Compact slug definition for concrete SEO pages. */
export interface ConcreteSlugDef {
  slug: string;
  name: string;
  mTitle: string;
  mDesc: string;
  ogTitle: string;
  ogDesc: string;
  h1: string;
  hero: string;
  tipsH: string;
  tips: [string, string][];
  formulas: [string, string][];
  faqs: [string, string][];
  workedExample: string[];
  assumptions: string[];
  whenToAskPro: string;
  defaultTab?: string;
}

export function toConcreteConfig(d: ConcreteSlugDef): TradeConfig {
  return {
    ...concreteConfig,
    slug: d.slug,
    name: d.name,
    metaTitle: d.mTitle,
    metaDescription: d.mDesc,
    ogTitle: d.ogTitle,
    ogDescription: d.ogDesc,
    defaultTab: d.defaultTab,
    content: {
      ...concreteConfig.content,
      h1: d.h1,
      heroText: d.hero,
      tipsHeading: d.tipsH,
      tips: d.tips.map(([title, body]) => ({ title, body })),
      formulas: d.formulas.map(([name, formula]) => ({ name, formula })),
      faqs: d.faqs.map(([q, a]) => ({ q, a })),
      workedExample: d.workedExample ? {
        title: d.workedExample[0],
        steps: d.workedExample.slice(1),
      } : undefined,
      assumptions: d.assumptions,
      whenToAskPro: d.whenToAskPro,
      related: [
        { href: '/free-concrete-calculator', title: 'Free Concrete Calculator', desc: 'Full concrete calculator with slabs, footings, and gradients' },
        { href: '/free-construction-calculator', title: 'Free Construction Calculator', desc: 'Areas, timber lengths, and building materials' },
        { href: '/free-quote-generator', title: 'Free Quote Generator', desc: 'Turn your calculations into a professional quote' },
      ],
    },
  };
}

export const CONCRETE_SLUGS: ConcreteSlugDef[] = [
  {
    slug: 'free-concrete-slab-calculator',
    name: 'Concrete Slab Calculator',
    mTitle: 'Free Concrete Slab Calculator - Volume & Cost | QuoteCore+',
    mDesc: 'Calculate concrete slab volume in m³ or yd³ from length × width × depth. Includes waste, cost per m³, and bag count. No signup required.',
    ogTitle: 'Free Concrete Slab Calculator - Volume & Cost',
    ogDesc: 'Calculate concrete slab volume, cost, and bag count from dimensions. Free, no signup.',
    h1: 'Concrete Slab Calculator',
    hero: 'Calculate the volume of concrete needed for a slab, footing, or pad. Enter dimensions, choose a depth preset, and get volume, cost, and bag count instantly.',
    tipsH: 'Concrete slab calculation tips',
    defaultTab: 'slab-volume',
    tips: [
      ['How to measure for a concrete slab', 'Measure the length and width of the area to be concreted. For depth, use 100mm for patios and sheds, 150mm for driveways, and 225mm or more for footings. Always check local building codes for minimum depth requirements.'],
      ['Waste allowance for concrete', 'Add 5-10% extra concrete to account for spillage, uneven sub-base, and over-excavation. For irregular shapes or sloping ground, use 10-15%. Ordering slightly more is always better than running short mid-pour.'],
      ['Ready-mix vs bagged concrete', 'For slabs over 2m³, ready-mix delivery is usually cheaper and faster. For smaller jobs (under 1m³), bagged concrete mixed on-site is more practical. A standard 25kg bag yields about 0.0125m³ of concrete.'],
      ['Curing time and strength', 'Concrete reaches about 60% of its 28-day strength after 7 days. Keep it moist for at least 7 days (cure) to achieve full strength. Do not load heavily until at least 7 days have passed.'],
    ],
    formulas: [
      ['Volume', 'V = length × width × depth'],
      ['With waste', 'V_total = V × (1 + waste%)'],
      ['Bags needed', 'bags = ceil(V_total / yield_per_bag)'],
      ['Cost', 'cost = V_total × price_per_m³'],
    ],
    faqs: [
      ['How much concrete do I need for a 4m × 3m slab at 100mm?', 'Volume = 4 × 3 × 0.1 = 1.2 m³. With 5% waste: 1.26 m³. At £120/m³ ready-mix: about £151. You would need about 101 bags of 25kg concrete.'],
      ['What depth should my concrete slab be?', 'Patios and shed bases: 100mm. Driveways and car parks: 150mm. House footings: 225mm minimum (consult building control). Heavy-duty industrial: 200-300mm. Always check local building regulations.'],
      ['How many 25kg bags of concrete make 1m³?', 'Approximately 80 bags of 25kg concrete make 1m³ at standard mix ratio. Each bag yields about 0.0125m³. For a 1m³ slab, order at least 84 bags to account for 5% waste.'],
      ['How do I calculate concrete cost?', 'Multiply the volume in m³ by the price per m³ of ready-mix concrete. Typical UK ready-mix prices range from £100-150/m³ depending on mix design and delivery distance.'],
    ],
    workedExample: [
      'Worked example: 5m × 4m driveway slab at 150mm depth',
      'Volume = 5m × 4m × 0.15m = 3.0 m³',
      'With 5% waste: 3.0 × 1.05 = 3.15 m³',
      'Bags needed (25kg, 0.0125m³ yield): ceil(3.15 / 0.0125) = 252 bags',
      'Ready-mix cost at £120/m³: 3.15 × £120 = £378.00',
      'Ready-mix is clearly cheaper than bagged for this volume',
    ],
    assumptions: [
      'Calculations assume a rectangular slab. For irregular shapes, break into rectangles and calculate each separately.',
      'Depth presets are guidelines - always check local building codes for minimum requirements.',
      'Bag count assumes 25kg bags at 0.0125m³ yield. Actual yield varies by mix design.',
      'Waste percentages are guidelines - add more for irregular shapes or difficult access.',
      'Ready-mix prices vary by location, mix design, and delivery distance.',
    ],
    whenToAskPro: 'For structural concrete (foundations, retaining walls, suspended slabs), consult a structural engineer for mix design, reinforcement specification, and loading calculations. Building control approval may be required for concrete work in the UK.',
  },
  {
    slug: 'free-concrete-bag-calculator',
    name: 'Concrete Bag Calculator',
    mTitle: 'Free Concrete Bag Calculator - How Many Bags? | QuoteCore+',
    mDesc: 'Calculate how many bags of concrete you need from slab dimensions and bag size. Supports 25kg and 40kg bags. No signup required.',
    ogTitle: 'Free Concrete Bag Calculator',
    ogDesc: 'Work out how many bags of concrete to buy from your slab dimensions. Free, no signup.',
    h1: 'Concrete Bag Calculator',
    hero: 'Find out exactly how many bags of concrete you need. Enter your slab dimensions and bag size - get bag count, total weight, and cost instantly.',
    tipsH: 'Concrete bag calculation tips',
    defaultTab: 'slab-volume',
    tips: [
      ['Bag sizes and yields', 'A 25kg bag of concrete yields approximately 0.0125m³. A 40kg bag yields about 0.02m³. Always check the manufacturer\'s yield on the packaging - it varies by mix design and aggregate size.'],
      ['Mixing bagged concrete', 'For bagged concrete, use approximately 2.5-3 litres of clean water per 25kg bag. Too much water weakens the mix. Mix until the consistency is like thick peanut butter - workable but not runny.'],
      ['When to use bags vs ready-mix', 'Use bagged concrete for jobs under 1m³ (small pads, post holes, repairs). For anything over 2m³, ready-mix delivery is almost always cheaper, faster, and more consistent.'],
      ['Storing bagged concrete', 'Store bags off the ground on pallets, covered with waterproof sheeting. Concrete absorbs moisture from the air and will set in the bag if left exposed. Use within 6 months of purchase.'],
    ],
    formulas: [
      ['Volume', 'V = length × width × depth'],
      ['Bags needed', 'bags = ceil(V × (1 + waste%) / yield_per_bag)'],
      ['Total weight', 'weight = bags × bag_weight'],
      ['Cost', 'cost = bags × price_per_bag'],
    ],
    faqs: [
      ['How many 25kg bags of concrete do I need for 1m³?', 'You need approximately 80 bags of 25kg concrete for 1m³. With 5% waste allowance, order 84 bags. Each 25kg bag yields about 0.0125m³.'],
      ['How many 40kg bags make 1 cubic metre?', 'Approximately 50 bags of 40kg concrete make 1m³. Each 40kg bag yields about 0.02m³. With 5% waste, order 53 bags.'],
      ['How much does a bag of concrete cost?', 'In the UK, a 25kg bag of general-purpose concrete costs £4-6. In the US, an 80lb (36kg) bag costs $4-7. Bulk discounts apply for orders over 50 bags.'],
      ['Can I use this calculator for post-hole concrete?', 'Yes - enter the post hole diameter as width, depth as depth, and a small length. For a 300mm diameter hole at 600mm deep, use width=0.3, length=0.3, depth=0.6.'],
    ],
    workedExample: [
      'Worked example: 2m × 1.5m shed base at 100mm, using 25kg bags',
      'Volume = 2 × 1.5 × 0.1 = 0.3 m³',
      'With 10% waste: 0.3 × 1.10 = 0.33 m³',
      'Bags needed: ceil(0.33 / 0.0125) = 27 bags of 25kg',
      'Total weight: 27 × 25 = 675 kg',
      'Cost at £4.50/bag: 27 × £4.50 = £121.50',
    ],
    assumptions: [
      'Yield per bag is approximate (0.0125m³ for 25kg, 0.02m³ for 40kg) - check manufacturer specifications.',
      'Waste allowance of 5-10% is standard. Use 10-15% for irregular shapes or first-time mixing.',
      'Calculations assume consistent mix quality - variations in water content affect final volume.',
      'Bag weights vary by manufacturer - always verify on the packaging.',
    ],
    whenToAskPro: 'For structural concrete (foundations, retaining walls, structural slabs), consult a structural engineer. Bagged concrete is suitable for non-structural applications like shed bases, patios, and post holes. For load-bearing applications, use ready-mix with a specified mix design.',
  },
  {
    slug: 'free-footing-calculator',
    name: 'Footing Calculator',
    mTitle: 'Free Footing Calculator - Trench & Strip Footing Volume | QuoteCore+',
    mDesc: 'Calculate concrete volume for strip footings, trench fill, and pad footings. Enter dimensions and get volume, cost, and excavation quantities. No signup.',
    ogTitle: 'Free Footing Calculator',
    ogDesc: 'Calculate concrete volume for strip footings and pad footings. Free, no signup.',
    h1: 'Concrete Footing Calculator',
    hero: 'Calculate the volume of concrete needed for strip footings, trench fill, and pad footings. Enter trench dimensions and get instant volume, cost, and excavation quantities.',
    tipsH: 'Footing calculation tips',
    defaultTab: 'slab-volume',
    tips: [
      ['Strip footing vs trench fill', 'Strip footings are typically 225mm deep with a width of 600mm minimum. Trench fill is a full-depth concrete pour (usually 900mm-1m) that eliminates the need for brickwork below ground. Trench fill uses more concrete but is faster to build.'],
      ['Footing depth and building regs', 'UK building regulations require footings to be at least 1m below ground level to reach stable subsoil. In clay soils or near trees, footings may need to be 1.5-2m+ deep. Always consult building control before pouring.'],
      ['Reinforcement in footings', 'Most strip footings don\'t need reinforcement if the subsoil is stable. However, on clay, made ground, or near trees, reinforcement mesh (A193 or A252) is often specified by building control or a structural engineer.'],
      ['Excavation volume vs concrete volume', 'The excavation volume is always larger than the concrete volume because you need working space (typically 150mm each side) and the trench may be deeper than the concrete pour. Order concrete based on the actual pour dimensions, not the excavation size.'],
    ],
    formulas: [
      ['Strip footing volume', 'V = trench_length × width × depth'],
      ['With waste', 'V_total = V × (1 + waste%)'],
      ['Excavation volume', 'V_exc = trench_length × (width + 0.3) × (depth + 0.1)'],
      ['Concrete cost', 'cost = V_total × price_per_m³'],
    ],
    faqs: [
      ['How deep should a house footing be?', 'UK building regulations require footings at least 1m deep in stable subsoil. In clay or near trees, they may need to be 1.5-2.5m deep. Always check with building control before excavating.'],
      ['What width should a strip footing be?', 'Minimum 600mm for single-storey buildings, 750mm for two-storey. The width must be at least 3× the wall thickness. Consult building control for specific requirements.'],
      ['How much concrete for a 10m footing?', 'At 600mm wide × 225mm deep: V = 10 × 0.6 × 0.225 = 1.35 m³. With 5% waste: 1.42 m³. At £120/m³: about £170. For trench fill at 1m deep: 10 × 0.6 × 1.0 = 6.0 m³ = £720.'],
      ['Do I need reinforcement in my footings?', 'Most strip footings on stable ground don\'t need reinforcement. On clay, made ground, or near trees, building control may require reinforcement mesh. A structural engineer can advise on specific cases.'],
    ],
    workedExample: [
      'Worked example: 12m strip footing at 600mm wide × 225mm deep',
      'Volume = 12 × 0.6 × 0.225 = 1.62 m³',
      'With 5% waste: 1.62 × 1.05 = 1.70 m³',
      'Excavation (with 150mm working space each side): 12 × 0.9 × 0.325 = 3.51 m³',
      'Concrete cost at £120/m³: 1.70 × £120 = £204.00',
      'Order 1.75 m³ from ready-mix supplier (rounds up to nearest 0.5m³)',
    ],
    assumptions: [
      'Calculations assume a rectangular trench. For stepped footings, calculate each section separately.',
      'Footing dimensions must comply with local building regulations - always verify with building control.',
      'Excavation volume includes 150mm working space each side and 100mm over-excavation at the bottom.',
      'Concrete waste allowance of 5% is standard for footings. Use 10% for irregular trenches.',
      'Soil conditions vary - always obtain a site investigation before specifying footing depths.',
    ],
    whenToAskPro: 'Footings are structural and building-regulation controlled in the UK. Always consult building control and/or a structural engineer before excavation. Soil conditions, tree proximity, and nearby structures can all affect footing design. Never pour footings without building control inspection.',
  },
  {
    slug: 'free-rebar-calculator',
    name: 'Rebar Calculator',
    mTitle: 'Free Rebar Calculator - Reinforcement Weight & Spacing | QuoteCore+',
    mDesc: 'Calculate rebar quantities, spacing, and weight for concrete slabs and footings. Supports metric and imperial. No signup required.',
    ogTitle: 'Free Rebar Calculator',
    ogDesc: 'Work out rebar quantities, spacing, and weight for slabs and footings. Free, no signup.',
    h1: 'Rebar Calculator',
    hero: 'Calculate reinforcement steel quantities for concrete slabs and footings. Enter slab dimensions, mesh type, and spacing to get weight, number of bars, and cost.',
    tipsH: 'Reinforcement calculation tips',
    defaultTab: 'area-formwork',
    tips: [
      ['Mesh types for slabs', 'A193 (6mm wires at 200mm) is used for light-duty slabs like patios. A252 (8mm wires at 200mm) is standard for driveways and house floors. A393 (10mm wires at 200mm) is used for heavy-duty industrial slabs. The number refers to the cross-sectional area in mm²/m.'],
      ['Lap lengths for mesh', 'Mesh sheets must overlap by at least 300mm (one wire spacing) at all joints. This overlap is included in the waste allowance - order 5-10% extra to account for laps and cuts.'],
      ['Reinforcement in footings', 'Strip footings rarely need reinforcement on stable ground. When required (clay, made ground), use A193 or A252 mesh placed on 50mm concrete spacers below the pour. For pad footings, reinforcement is almost always required.'],
      ['Concrete cover for reinforcement', 'Minimum 50mm cover for footings in non-aggressive soil. 75mm for aggressive ground conditions. Use spacer blocks to maintain cover during the pour - inadequate cover leads to corrosion and concrete failure.'],
    ],
    formulas: [
      ['Mesh area', 'A = slab_length × slab_width'],
      ['Sheets needed', 'sheets = ceil(A × (1 + waste%) / sheet_area)'],
      ['Steel weight', 'weight = A × kg_per_m² (mesh type dependent)'],
      ['Cost', 'cost = sheets × price_per_sheet'],
    ],
    faqs: [
      ['What mesh do I need for a driveway slab?', 'Use A252 mesh (8mm wires at 200mm spacing) for driveways and house floor slabs. For patios and shed bases, A193 is sufficient. For heavy-duty industrial slabs, use A393.'],
      ['How much rebar mesh do I need for a 5m × 4m slab?', 'Area = 20 m². Standard mesh sheet is 4.8m × 2.4m = 11.52 m². With 5% waste: 21 m² needed. Sheets = ceil(21 / 11.52) = 2 sheets. Weight at 2.47 kg/m² (A252): 20 × 2.47 = 49.4 kg.'],
      ['How much does reinforcement mesh cost?', 'A252 mesh sheets (4.8m × 2.4m) cost approximately £30-45 per sheet in the UK. A193 is about £20-30. A393 is about £50-70. Prices vary with steel market fluctuations.'],
      ['Do I need rebar in my concrete footing?', 'Most strip footings on stable ground don\'t need reinforcement. On clay, near trees, or for pad footings, building control may require mesh. A structural engineer can advise.'],
    ],
    workedExample: [
      'Worked example: 6m × 5m driveway slab with A252 mesh',
      'Slab area = 6 × 5 = 30 m²',
      'Mesh sheet area (4.8m × 2.4m) = 11.52 m²',
      'With 10% waste for laps and cuts: 30 × 1.10 = 33 m²',
      'Sheets needed: ceil(33 / 11.52) = 3 sheets of A252',
      'Weight at 2.47 kg/m²: 30 × 2.47 = 74.1 kg',
      'Cost at £35/sheet: 3 × £35 = £105.00',
    ],
    assumptions: [
      'Standard mesh sheet size is 4.8m × 2.4m (11.52 m²). Check supplier for actual sheet sizes.',
      'Weight per m²: A193=1.71, A252=2.47, A393=3.88 kg/m². These are nominal values.',
      'Waste allowance of 5-10% covers lap joints and cuts. Use 10% for irregular shapes.',
      'Spacing assumes standard 200mm grid. Custom spacing requires individual bar calculation.',
      'Always follow structural engineer or building control specifications for mesh type and placement.',
    ],
    whenToAskPro: 'Reinforcement design is structural engineering. For load-bearing slabs, footings, retaining walls, or any building-regulation-controlled concrete work, consult a structural engineer. Incorrect reinforcement can lead to structural failure. Always follow engineer specifications and building control approval.',
  },
  {
    slug: 'free-trench-calculator',
    name: 'Trench Calculator',
    mTitle: 'Free Trench Calculator - Excavation Volume & Backfill | QuoteCore+',
    mDesc: 'Calculate trench excavation volume, backfill quantities, and concrete fill. Enter trench dimensions and get instant results. No signup required.',
    ogTitle: 'Free Trench Calculator',
    ogDesc: 'Calculate trench excavation, backfill, and concrete volumes. Free, no signup.',
    h1: 'Trench Calculator',
    hero: 'Calculate excavation volume, backfill, and concrete fill for trenches. Enter length, width, and depth to get accurate quantities for utilities, footings, and drainage.',
    tipsH: 'Trench calculation tips',
    defaultTab: 'slab-volume',
    tips: [
      ['Trench excavation working space', 'UK building regulations require 150mm working space each side of the footing. So a 600mm footing needs a 900mm trench. For deeper trenches, you may need to widen further for safe access.'],
      ['Battering and shoring', 'Trenches over 1.2m deep must be shored or battered back to prevent collapse. HSE regulations require trench support for any excavation where personnel enter. Always follow HSE guidance on trench safety.'],
      ['Backfill compaction', 'Backfill in 150mm layers, compacting each layer with a vibrating plate. Uncompacted backfill will settle over time, causing problems with paving, floors, or landscaping above. Do not use clay or organic material as backfill.'],
      ['Soil type affects trenching', 'Sand and gravel are stable and easy to excavate. Clay can be unstable when wet. Chalk is generally stable. Made ground (previously disturbed soil) is unpredictable and may need engineering assessment. Always check soil type before excavation.'],
    ],
    formulas: [
      ['Excavation volume', 'V_exc = length × (width + 0.3) × depth'],
      ['Concrete fill volume', 'V_conc = length × width × concrete_depth'],
      ['Backfill volume', 'V_back = V_exc - V_conc'],
      ['Muck-away volume', 'V_muck = V_exc (loose, typically ×1.2 bulking factor)'],
    ],
    faqs: [
      ['How do I calculate trench excavation volume?', 'Multiply trench length by trench width (including working space) by depth. For a 10m trench at 900mm wide × 1m deep: V = 10 × 0.9 × 1.0 = 9.0 m³. Remember to add 20% bulking factor for muck-away.'],
      ['How much concrete do I need for a trench fill footing?', 'For a 10m trench at 600mm wide × 1m deep (full trench fill): V = 10 × 0.6 × 1.0 = 6.0 m³. With 5% waste: 6.3 m³. At £120/m³: about £756.'],
      ['What is the bulking factor for excavated soil?', 'Typical bulking factors: sand/gravel 1.1-1.2, clay 1.2-1.3, chalk 1.3, mixed soil 1.2-1.25. This means 1m³ of in-situ soil becomes 1.1-1.3m³ when excavated and loose.'],
      ['How wide should a trench be for a footing?', 'Footing width (typically 600mm) plus 150mm working space each side = 900mm minimum. For deeper trenches over 1.5m, widen to 1.2m for safe access. Check HSE and building regulations.'],
    ],
    workedExample: [
      'Worked example: 15m trench for strip footing, 600mm wide × 225mm deep concrete, 1m deep excavation',
      'Excavation width (with 150mm each side): 0.6 + 0.3 = 0.9m',
      'Excavation volume: 15 × 0.9 × 1.0 = 13.5 m³',
      'Concrete volume: 15 × 0.6 × 0.225 = 2.025 m³',
      'With 5% waste: 2.125 m³ concrete to order',
      'Backfill volume: 13.5 - 2.025 = 11.475 m³',
      'Muck-away (with 1.2 bulking): 13.5 × 1.2 = 16.2 m³ loose',
    ],
    assumptions: [
      'Working space of 150mm each side is the UK minimum. Deeper trenches may require more.',
      'Bulking factor of 1.2 is typical for mixed soil. Actual factor depends on soil type.',
      'Trench assumed to be rectangular. For stepped or benched trenches, calculate each section.',
      'Concrete depth is the actual pour depth, not the excavation depth.',
      'Always follow HSE guidance on trench safety - excavations over 1.2m deep require shoring or battering.',
    ],
    whenToAskPro: 'Trenching is dangerous. Excavations over 1.2m deep require shoring, battering, or trench boxes under HSE regulations. Always check for underground services before excavation (dial before you dig). On unstable ground or near existing structures, consult a groundworks contractor or structural engineer.',
  },
];

export const CONCRETE_SLUG_CONFIGS = CONCRETE_SLUGS.map(toConcreteConfig);

export function getConcreteSlugConfig(slug: string): TradeConfig | undefined {
  return CONCRETE_SLUG_CONFIGS.find(c => c.slug === slug);
}
