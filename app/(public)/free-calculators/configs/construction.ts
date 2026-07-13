import type { TradeConfig } from '../_shared/types';

const COMMON_SLOPES = [0, 5, 10, 15, 20, 25, 30, 40, 45];

export const constructionConfig: TradeConfig = {
  slug: 'free-construction-calculator',
  defaultCurrency: 'GBP',
  name: 'Construction Calculator',
  metaTitle: 'Free Construction Calculator - Areas, Materials & Angles | QuoteCore+',
  metaDescription:
    'Free construction calculator for builders. Work out floor and wall areas, timber and stud lengths, material quantities with waste, and cutting angles. No signup required.',
  ogTitle: 'Free Construction Calculator - Areas, Materials & Angles',
  ogDescription:
    'Free construction calculator. Floor and wall areas, timber and stud lengths, material quantities and cutting angles for builders. No signup required.',

  tabs: [
    { id: 'area-materials', label: 'Area & Materials', kind: 'area' },
    { id: 'timber-lengths', label: 'Timber & Stud Lengths', kind: 'members' },
    { id: 'battens', label: 'Battens', kind: 'batten' },
    { id: 'smart-component', label: 'Draft Smart Component™', kind: 'smart' },
    { id: 'angle-finder', label: 'Angle Finder', kind: 'angle' },
  ],

  area: {
    heading: 'Area & Materials Calculator',
    subtitle: 'Calculate floor, wall, and sloped surface areas from dimensions',
    slopeWord: 'Slope',
    planLabel: 'Floor area',
    actualLabel: 'Actual surface area',
    planHint: 'Enter plan-view dimensions, slope applied',
    actualHint: 'Enter the measured surface area directly',
    actualDimsNote: 'In Actual mode, use the Area input to enter the measured surface area directly.',
    useSlopeFactor: true,
    commonSlopes: COMMON_SLOPES,
    defaultSlope: '0',
    useForPricingLabel: 'Use this area for pricing',
  },

  members: {
    heading: 'Timber & Stud Lengths',
    subtitle: 'Calculate angled member lengths - rake studs, stringers, and braces - from angle and run',
    slopeWord: 'Angle',
    memberLabel: 'Member',
    spanLabel: 'Run',
    spanHint: 'Horizontal distance the angled member covers',
    showHipValley: false,
    showBirdsmouth: true,
    birdsmouthMemberWord: 'Rafter',
    commonSlopes: [0, 15, 22.5, 30, 35, 40, 42, 45, 60],
    defaultSlope: '35',
    diagramCaption: 'Angled member at {deg}° - run is the horizontal distance covered',
    diagramTopLabel: 'Top',
    diagramBaseLabel: 'Base',
  },

  batten: {
    heading: 'Batten Calculator',
    subtitle: 'Calculate lineal metres of battens from wall or floor area and batten spacing',
    gaugePresets: [
      { label: 'Plasterboard (600mm centres)', mm: 600 },
      { label: 'Cladding (600mm centres)', mm: 600 },
      { label: 'Tile battens (150mm gauge)', mm: 150 },
      { label: 'Tile battens (100mm gauge)', mm: 100 },
      { label: 'Render mesh (200mm)', mm: 200 },
    ],
    defaultGauge: '600',
    defaultWastePercent: '10',
    useForPricingLabel: 'Use this length for pricing',
  },

  smart: {
    heading: 'Draft Smart Component',
    subtitle: 'Build a component with pricing, waste, and labour rules, then calculate cost from measurements',
    defaultName: 'Plasterboard sheets',
    defaultMeasurementType: 'area',
    defaultWasteValue: '10',
    defaultPricePerUnit: '4.20',
    defaultPitchEnabled: false,
    areaPlaceholder: 'Enter area or use from area tab',
    prefillNote: 'Pre-filled from area calculation',
  },

  angle: {
    heading: 'Angle Finder',
    subtitle: 'Calculate meeting angles for junctions, bends, and sloped surfaces',
    angleWord: 'Angle',
    angleWordImperial: 'Angle',
    inputPrefix: '',
    rafterPitchLabel: 'Rafter Angle',
    tooltipOverrides: {
      hipValley: 'Use when two sloped surfaces meet around an internal or external corner (usually a 90° corner).',
      rafterPitch: 'Used where sloped surfaces run in the same direction. Includes Ridge/Apex, Change of Angle, Upstand onto Slope, and Slope into Upstand.',
      ridge: 'Use where two sloped surfaces meet at a ridge or apex. Formula: 180° − Angle 1 − Angle 2',
      changeOfPitch: 'Use where one slope changes into another running in the same direction. Formula: 180° − Upper Angle + Lower Angle.',
      upstandOntoRoof: 'Use where a junction starts on a vertical face and turns down onto the slope. Formula: 90° + Angle.',
      roofIntoUpstand: 'Use where a junction starts on the slope and turns up into a vertical face. Formula: 90° − Angle.',
    },
  },

  content: {
    h1: 'Construction Calculator',
    heroText:
      'Free construction calculator for builders and site managers. Work out floor and wall areas, timber and stud lengths, material quantities with waste allowances, and cutting angles. No signup required - works on mobile and desktop.',
    tipsHeading: 'Construction calculation tips',
    tips: [
      {
        title: 'Measure twice, order once',
        body: 'Always measure each room or elevation separately rather than estimating a whole floor in one go. Break L-shaped and irregular spaces into rectangles, calculate each, then add them together. Small measuring errors compound quickly when you multiply out to material quantities.',
      },
      {
        title: 'Typical waste allowances for building materials',
        body: 'Timber: 10% (more if stud spacing forces awkward cuts). Plasterboard: 10-15% depending on room complexity. Insulation: 5%. Sheet materials like OSB and ply: 10%. Flooring: 5-10% laid straight, 15% on diagonal patterns. Order to the next full pack or length above your calculated figure.',
      },
      {
        title: 'Working out stud wall materials',
        body: 'For a standard stud wall at 400mm centres: divide the wall length in mm by 400 and add one for the end stud. Add top and bottom plates (2 × wall length), noggins at mid-height (roughly one wall length), and 10% waste. A 4.8m wall needs about 13 studs plus 14.4m of plate and noggin timber.',
      },
      {
        title: 'Calculating batten quantities for drylining and cladding',
        body: 'Battens run at fixed centres across the wall or floor. Total lineal metres = surface area ÷ batten gauge (in metres). A 20 m² wall with 600mm batten centres needs 20 ÷ 0.6 = 33.3m of battens, plus 10% waste = 36.6m. Always round up to the next standard length when ordering.',
      },
      {
        title: 'Why sloped surfaces need a slope factor',
        body: 'A raked ceiling, staircase soffit, or sloped roof deck covers more surface than its footprint. The slope factor (1 / cos(angle)) converts plan area to true surface area. At 30 degrees, 50 m² of plan becomes 57.7 m² of actual surface - order for the true area, not the footprint.',
      },
      {
        title: 'Calculating stringers and rake members',
        body: 'Any angled member - a stair stringer, rake stud, or brace - is the hypotenuse of a right triangle. Divide the horizontal run by the cosine of the angle to get the member length. A staircase with a 2.7m run at 42 degrees needs stringers of 2.7 / cos(42°) = 3.63m before allowing for cuts.',
      },
      {
        title: 'Allow for openings before ordering',
        body: 'Deduct windows and doors from wall areas when ordering plasterboard, insulation, or cladding - but only deduct openings larger than about 0.5 m². Small openings generate offcuts you cannot reuse, so leaving them in your figure builds in a sensible margin.',
      },
      {
        title: "Cutting a bird's mouth in rafters and stringers",
        body: "A bird's mouth is the notch that lets a rafter or stair stringer sit flat on a wall plate or landing. The seat cut is horizontal and the plumb cut vertical: measured from the timber edge, the seat cut angle equals the slope angle and the plumb cut equals 90° minus the slope. Never notch deeper than one-third of the timber depth - it weakens the member.",
      },
    ],
    formulas: [
      { name: 'Rectangular area', formula: 'area = width × length' },
      { name: 'Slope factor', formula: 'factor = 1 / cos(slope°)' },
      { name: 'True surface area', formula: 'area = plan_area × slope_factor' },
      { name: 'Angled member length', formula: 'member = run / cos(angle°)' },
      { name: 'Material quantity', formula: 'quantity = (area × (1 + waste%)) / coverage_per_unit' },
    ],
    faqs: [
      {
        q: 'How do I calculate building material quantities?',
        a: 'Measure the area to cover (width × length for floors, length × height for walls), add a waste percentage appropriate to the material (typically 5-15%), then divide by the coverage of one unit. For example, 40 m² of wall with 10% waste needs 44 m² of plasterboard - about 15.3 standard 2.88 m² sheets, so order 16.',
      },
      {
        q: 'What waste percentage should I add for timber?',
        a: 'Add 10% for general carcassing and stud work. Increase to 15% when stud spacing or room dimensions force many offcuts shorter than a usable length. Buying standard lengths that divide cleanly into your wall heights reduces genuine waste substantially.',
      },
      {
        q: 'How do I calculate the length of an angled timber?',
        a: 'Divide the horizontal run by the cosine of the angle. A rake stud covering a 1.2m run at 35 degrees is 1.2 / cos(35°) = 1.46m. The same formula covers stair stringers, braces, and any sloped member.',
      },
      {
        q: 'How many studs do I need for a stud wall?',
        a: 'Divide the wall length by your stud spacing (400mm or 600mm centres) and add one for the closing stud. Then add top and bottom plates equal to twice the wall length, plus noggins. A 3.6m wall at 400 centres needs 10 studs.',
      },
      {
        q: 'What is the best free construction calculator?',
        a: 'The best free construction calculator covers areas, sloped surfaces, angled member lengths, material quantities with waste, and pricing in one tool - which is exactly what this calculator does. It is completely free, runs in your browser, and requires no signup.',
      },
    ],
    related: [
      {
        href: '/free-roofing-calculator',
        title: 'Free Roofing Calculator',
        desc: 'Roof pitch, rafter lengths, and roofing materials',
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
