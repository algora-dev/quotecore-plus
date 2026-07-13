import type { TradeConfig } from '../_shared/types';

export const landscapingConfig: TradeConfig = {
  slug: 'free-landscaping-calculator',
  defaultCurrency: 'GBP',
  name: 'Landscaping Calculator',
  metaTitle: 'Free Landscaping Calculator - Turf, Topsoil & Slopes | QuoteCore+',
  metaDescription:
    'Free landscaping calculator. Work out garden and lawn areas, turf and topsoil quantities, slopes and gradients, and material pricing. No signup required.',
  ogTitle: 'Free Landscaping Calculator - Turf, Topsoil & Slopes',
  ogDescription:
    'Free landscaping calculator. Garden and lawn areas, turf and topsoil quantities, slopes, gradients and falls. No signup required.',

  tabs: [
    { id: 'garden-area', label: 'Garden & Lawn Area', kind: 'area' },
    { id: 'slope-gradient', label: 'Slope & Gradient', kind: 'gradient' },
    { id: 'smart-component', label: 'Draft Smart Component™', kind: 'smart' },
    { id: 'angle-finder', label: 'Angle Finder', kind: 'angle' },
  ],

  area: {
    heading: 'Garden & Lawn Area Calculator',
    subtitle: 'Calculate plot, lawn, and banked garden areas from dimensions',
    slopeWord: 'Slope',
    planLabel: 'Plot area',
    actualLabel: 'Actual ground area',
    planHint: 'Enter plan-view dimensions, slope applied',
    actualHint: 'Enter the measured ground area directly',
    actualDimsNote: 'In Actual mode, use the Area input to enter the measured ground area directly.',
    useSlopeFactor: true,
    commonSlopes: [0, 5, 10, 15, 20, 25, 30, 35, 45],
    defaultSlope: '0',
    useForPricingLabel: 'Use this area for pricing',
  },

  gradient: {
    heading: 'Slope & Gradient Calculator',
    subtitle: 'Convert between 1-in-X, percent and degrees, and work out the fall over a run',
    commonRatios: [10, 20, 40, 60, 80, 100],
    runLabel: 'Run length',
    runHint: 'Horizontal distance the slope covers - a path, drain run, or bank',
    fallWord: 'fall',
  },

  smart: {
    heading: 'Draft Smart Component',
    subtitle: 'Build a component with pricing, waste, and labour rules, then calculate cost from measurements',
    defaultName: 'Turf rolls',
    defaultMeasurementType: 'area',
    defaultWasteValue: '7.5',
    defaultPricePerUnit: '5.50',
    defaultPitchEnabled: false,
    areaPlaceholder: 'Enter area or use from garden area tab',
    prefillNote: 'Pre-filled from garden area calculation',
  },

  angle: {
    heading: 'Angle Finder',
    subtitle: 'Calculate meeting angles for edging, retaining junctions, and banks',
    angleWord: 'Angle',
    angleWordImperial: 'Angle',
    inputPrefix: '',
    rafterPitchLabel: 'Slope Angle',
    tooltipOverrides: {
      hipValley: 'Use when two sloped surfaces meet around an internal or external corner (usually a 90° corner).',
      rafterPitch: 'Used where sloped surfaces run in the same direction - banks, ramps, and retaining junctions.',
      ridge: 'Use where two slopes meet at a crest or apex. Formula: 180° − Angle 1 − Angle 2',
      changeOfPitch: 'Use where one slope changes into another running in the same direction. Formula: 180° − Upper Angle + Lower Angle.',
      upstandOntoRoof: 'Use where a junction starts on a vertical face (wall, edging) and turns down onto the slope. Formula: 90° + Angle.',
      roofIntoUpstand: 'Use where a junction starts on the slope and turns up into a vertical face. Formula: 90° − Angle.',
    },
  },

  content: {
    h1: 'Landscaping Calculator',
    heroText:
      'Free landscaping calculator for gardeners and landscapers. Work out garden and lawn areas, turf and topsoil quantities, slopes, gradients and falls, and material pricing. No signup required - works on mobile and desktop.',
    tipsHeading: 'Landscaping calculation tips',
    tips: [
      {
        title: 'How much turf do I need?',
        body: 'Measure the lawn area in square metres, then add 5% waste for straight-edged lawns or 10% for curved borders and island beds - curves force more offcuts. Standard turf rolls cover 1 m² each, so a 48 m² lawn with curves needs roughly 53 rolls. Lay within 24 hours of delivery.',
      },
      {
        title: 'Topsoil quantities are volumes, not areas',
        body: 'Multiply the area by the depth you need: 100mm (0.1m) for laying turf, 150mm for new beds, up to 300mm for raised planters. A 50 m² lawn at 100mm needs 5 m³ of topsoil. Bulk bags are typically 0.7-0.9 m³, so check the supplier figure before converting to bags.',
      },
      {
        title: 'Understanding 1-in-X falls',
        body: 'A 1-in-80 fall drops 1 unit vertically for every 80 units of horizontal run - that is 12.5mm per metre. Patios need at least 1-in-80 away from the house; paths are comfortable up to about 1-in-20; anything steeper than 1-in-12 becomes hard work with a wheelbarrow and may need steps.',
      },
      {
        title: 'Sloped banks hold more ground than the plan shows',
        body: 'A banked garden covers more surface than its footprint suggests. On a 30-degree bank, 20 m² of plan is actually 23.1 m² of ground to turf, membrane, or plant. Use the slope factor when ordering materials for banks and terraced gardens or you will run short.',
      },
      {
        title: 'Paving and decking waste allowances',
        body: 'Paving slabs: 10% waste laid straight, 15% for diagonal or circular patterns. Decking boards: 10-15% depending on board length versus deck dimensions. Gravel and decorative aggregate: order by volume at 50mm depth minimum and add 10% for settlement into the sub-base.',
      },
      {
        title: 'Mulch and bark coverage',
        body: 'Mulch is spread at 50-75mm depth to suppress weeds effectively. One cubic metre covers about 13-20 m² depending on depth. Multiply your bed area by depth in metres to get volume, and round up - thin mulch is a false economy because weeds break through within a season.',
      },
    ],
    formulas: [
      { name: 'Lawn / plot area', formula: 'area = width × length' },
      { name: 'Slope factor (banks)', formula: 'factor = 1 / cos(slope°)' },
      { name: 'Gradient conversions', formula: '1 in X = (1/X) × 100% = arctan(1/X)°' },
      { name: 'Fall over a run', formula: 'fall = run × tan(gradient°)' },
      { name: 'Topsoil / mulch volume', formula: 'volume = area × depth' },
      { name: 'Material quantity', formula: 'quantity = (area × (1 + waste%)) / coverage_per_unit' },
    ],
    faqs: [
      {
        q: 'How much turf do I need for my lawn?',
        a: 'Measure the lawn area (width × length in metres), then add 5% waste for straight edges or 10% for curved borders. Standard rolls cover 1 m², so a 40 m² lawn with curves needs about 44 rolls. This calculator works it out and can price it in the Draft Smart Component tab.',
      },
      {
        q: 'How do I calculate topsoil volume?',
        a: 'Multiply the area in square metres by the depth in metres. For turfing, use 100mm (0.1m): a 60 m² lawn needs 6 m³. For new planting beds, use 150mm. Add 5-10% for settlement and uneven ground.',
      },
      {
        q: 'What is a 1-in-80 fall?',
        a: 'A 1-in-80 fall means the surface drops 1 unit for every 80 units of horizontal distance - 12.5mm per metre. It is the standard minimum fall for patios so water drains away from the house. Use the Slope & Gradient tab to convert between 1-in-X, percent, and degrees.',
      },
      {
        q: 'How much gravel do I need for a path?',
        a: 'Multiply the path area by a 50mm depth (0.05m) to get volume in cubic metres, then add 10% for settlement. A 15 m² path needs about 0.83 m³ - roughly one bulk bag. Use a compacted sub-base beneath for a path that lasts.',
      },
      {
        q: 'What is the best free landscaping calculator?',
        a: 'The best free landscaping calculator handles lawn and plot areas, sloped banks, gradients and falls, volumes for topsoil and mulch, and material pricing in one place - exactly what this tool does, free and with no signup. Everything runs in your browser.',
      },
    ],
    related: [
      {
        href: '/free-concrete-calculator',
        title: 'Free Concrete Calculator',
        desc: 'Slab and footing volumes with depth presets',
      },
      {
        href: '/free-construction-calculator',
        title: 'Free Construction Calculator',
        desc: 'Areas, timber lengths, and building materials',
      },
      {
        href: '/free-quote-generator',
        title: 'Free Quote Generator',
        desc: 'Turn measurements into a professional quote',
      },
    ],
  },
};
