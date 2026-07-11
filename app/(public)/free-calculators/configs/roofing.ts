import type { TradeConfig } from '../_shared/types';

const COMMON_PITCHES = [10, 15, 20, 25, 30, 35, 40, 45];

export const roofingConfig: TradeConfig = {
  slug: 'free-roofing-calculator',
  defaultCurrency: 'GBP',
  name: 'Roofing Calculator',
  metaTitle: 'Roofing Calculator — Pitch, Area, Rafter Length, Materials | QuoteCore+',
  metaDescription:
    'Free roofing calculator. Calculate roof pitch, rafter length, roof surface area, quantities and complex pricing. No signup required - works on mobile and desktop.',
  ogTitle: 'Roofing Calculator — Pitch, Area, Rafter Length, Materials',
  ogDescription:
    'Free roofing calculator. Calculate roof pitch, rafter length, roof surface area, and material quantities. No signup required.',

  tabs: [
    { id: 'roof-area', label: 'Roof Area', kind: 'area' },
    { id: 'pitch-rafter', label: 'Rafter / Hip & Valley', kind: 'members' },
    { id: 'battens', label: 'Battens', kind: 'batten' },
    { id: 'smart-component', label: 'Draft Smart Component™', kind: 'smart' },
    { id: 'angle-finder', label: 'Angle Finder', kind: 'angle' },
  ],

  area: {
    heading: 'Roof Area Calculator',
    subtitle: 'Calculate actual roof surface area from plan dimensions and pitch',
    slopeWord: 'Pitch',
    planLabel: 'Plan area',
    actualLabel: 'Actual roof area',
    planHint: 'Enter plan-view dimensions, pitch applied',
    actualHint: 'Enter actual roof area directly',
    actualDimsNote: 'In Actual mode, use the Area input to enter the measured roof surface area directly.',
    useSlopeFactor: true,
    commonSlopes: COMMON_PITCHES,
    defaultSlope: '25',
    useForPricingLabel: 'Use this area for pricing',
  },

  members: {
    heading: 'Rafter / Hip & Valley',
    subtitle: 'Calculate rafter and hip/valley lengths from pitch and span',
    slopeWord: 'Pitch',
    memberLabel: 'Rafter',
    spanLabel: 'Span',
    spanHint: 'Plan-view distance from wall to ridge (one rafter)',
    showHipValley: true,
    hipPlanLabel: 'Plan length',
    hipPlanHint: 'Plan-view diagonal from corner to ridge',
    showBirdsmouth: true,
    birdsmouthMemberWord: 'Rafter',
    commonSlopes: COMMON_PITCHES,
    defaultSlope: '25',
    diagramCaption: 'Rafter at {deg}° pitch — span is wall to ridge (one rafter)',
    diagramTopLabel: 'Ridge',
    diagramBaseLabel: 'Eaves',
  },

  smart: {
    heading: 'Draft Smart Component',
    subtitle: 'Build a component with pricing, waste, and labour rules, then calculate cost from measurements',
    defaultName: 'Concrete tiles',
    defaultMeasurementType: 'area',
    defaultWasteValue: '10',
    defaultPricePerUnit: '2.50',
    defaultPitchEnabled: true,
    areaPlaceholder: 'Enter area or use from roof area tab',
    prefillNote: 'Pre-filled from roof area calculation',
  },

  batten: {
    heading: 'Batten Calculator',
    subtitle: 'Calculate lineal metres of roofing battens from roof area and batten gauge',
    gaugePresets: [
      { label: 'Concrete tile', mm: 345 },
      { label: 'Clay pantile', mm: 345 },
      { label: 'Plain tile', mm: 100 },
      { label: 'Slate (500mm)', mm: 200 },
      { label: 'Slate (600mm)', mm: 250 },
    ],
    defaultGauge: '345',
    defaultWastePercent: '10',
    useForPricingLabel: 'Use this length for pricing',
  },

  angle: {
    heading: 'Angle Finder',
    subtitle: 'Calculate roof angles for flashing, bends, and junctions',
  },

  content: {
    h1: 'Roofing Calculator',
    heroText:
      'Calculate roof pitch, rafter length, roof surface area, quantities and complex pricing. No signup required - works on mobile and desktop.',
    tipsHeading: 'Roofing calculation tips',
    tips: [
      {
        title: 'How to measure roof pitch on-site',
        body: 'Use a digital level or smartphone app placed on the roof surface to get a direct degree reading. Alternatively, measure 1 metre horizontally from the roof edge, then measure the vertical rise at that point. The arctangent of rise / run gives you the pitch in degrees.',
      },
      {
        title: 'When to use rafter vs hip/valley pitch factors',
        body: 'Use the rafter pitch factor for simple gable or lean-to roofs where the slope runs in one direction. Use the hip/valley factor for hipped roofs where the slope changes direction — this includes the compound angle that increases the actual surface area.',
      },
      {
        title: 'Common waste percentages by material',
        body: 'Concrete tiles: 5-10%. Clay tiles: 10-15% (fragile, more breakage). Metal sheets: 5%. Asphalt shingles: 10-15%. Membrane: 5%. Add an extra 5% for complex roof shapes with many valleys, hips, or dormers that require numerous cuts.',
      },
      {
        title: 'Why plan area differs from actual roof area',
        body: 'Plan area is the footprint of the building viewed from above. A pitched roof covers more surface than the flat plan because it slopes upward. The pitch factor (1 / cos(pitch)) accounts for this difference. At 25 degrees, a 100 m² plan has about 110.3 m² of actual roofing surface.',
      },
      {
        title: 'Accounting for complex roof shapes',
        body: 'For roofs with multiple sections (L-shaped, T-shaped, with dormers), calculate each rectangular section separately using the same pitch, then add the areas together. For triangular sections (hips), use base × height / 2 with the pitch-adjusted height.',
      },
      {
        title: 'When to add extra material for cuts and overlaps',
        body: 'Beyond the standard waste percentage, add extra material for roofs with many penetrations (chimneys, skylights, vents), complex valley junctions, or when using materials that require specific overlap patterns. A rule of thumb: add 2-3 extra units per penetration or junction.',
      },
    ],
    formulas: [
      { name: 'Rafter length', formula: 'rafter = span / cos(pitch°)' },
      { name: 'Rafter pitch factor', formula: 'factor = 1 / cos(pitch°)' },
      { name: 'Hip/valley factor', formula: 'factor = sqrt((1/cos(pitch°))² + 1)' },
      { name: 'Roof surface area', formula: 'area = plan_area × pitch_factor' },
      { name: 'Material quantity', formula: 'quantity = (area × (1 + waste%)) / coverage_per_unit' },
    ],
    faqs: [
      {
        q: 'How do I calculate roof pitch?',
        a: 'Roof pitch is measured in degrees from horizontal. Use a digital level or smartphone app on the roof surface, or measure the rise over run ratio and convert to degrees using: pitch = arctan(rise / run).',
      },
      {
        q: 'What is a pitch factor?',
        a: 'A pitch factor converts flat plan area to actual sloped roof area. For a rafter-type roof, the factor is 1 / cos(pitch angle). At 25 degrees, the factor is approximately 1.103, meaning 100 m² of plan area has about 110.3 m² of actual roofing surface.',
      },
      {
        q: 'How is rafter length calculated?',
        a: 'Rafter length equals the span divided by the cosine of the pitch angle. The span is the plan-view distance from the wall to the ridge (one rafter). For a 10m span at 25 degrees: rafter = 10 / cos(25) = 11.03m.',
      },
      {
        q: 'What waste percentage should I add for roofing materials?',
        a: 'Typical waste percentages: concrete tiles 5-10%, clay tiles 10-15% (fragile), metal sheets 5%, asphalt shingles 10-15%, membrane 5%. Add more for complex roof shapes with many cuts.',
      },
      {
        q: 'What is the best free roofing calculator?',
        a: 'The best free roofing calculator handles pitch, rafter lengths, hip/valley lengths, surface area, waste, and material pricing in one place — exactly what this tool does, completely free with no signup. All calculations run in your browser and no data is sent anywhere.',
      },
    ],
    related: [
      {
        href: '/free-construction-calculator',
        title: 'Free Construction Calculator',
        desc: 'Areas, timber lengths, and building materials',
      },
      {
        href: '/free-concrete-calculator',
        title: 'Free Concrete Calculator',
        desc: 'Slab and footing volumes with depth presets',
      },
      {
        href: '/free-quote-generator',
        title: 'Free Quote Generator',
        desc: 'Turn measurements into a professional quote',
      },
    ],
  },
};
