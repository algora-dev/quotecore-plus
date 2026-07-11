import type { TradeConfig } from '../_shared/types';

export const concreteConfig: TradeConfig = {
  slug: 'free-concrete-calculator',
  defaultCurrency: 'GBP',
  name: 'Concrete Calculator',
  metaTitle: 'Free Concrete Calculator — Slabs, Footings & Volumes | QuoteCore+',
  metaDescription:
    'Free concrete calculator. Work out slab and footing volumes in m³ with depth presets, formwork areas, drainage falls, and ready-mix pricing. No signup required.',
  ogTitle: 'Free Concrete Calculator — Slabs, Footings & Volumes',
  ogDescription:
    'Free concrete calculator. Slab and footing volumes, formwork areas, falls and gradients, and ready-mix quantities. No signup required.',

  tabs: [
    { id: 'slab-volume', label: 'Slab & Footing Volume', kind: 'volume' },
    { id: 'area-formwork', label: 'Area & Formwork', kind: 'area' },
    { id: 'smart-component', label: 'Draft Smart Component™', kind: 'smart' },
    { id: 'falls-gradients', label: 'Falls & Gradients', kind: 'gradient' },
  ],

  volume: {
    heading: 'Slab & Footing Volume',
    subtitle: 'Calculate concrete volume from length × width × depth, with slab depth presets',
    depthPresets: [
      { label: '100mm — patio/shed', mm: 100 },
      { label: '150mm — driveway', mm: 150 },
      { label: '225mm — footing', mm: 225 },
      { label: '300mm — heavy duty', mm: 300 },
    ],
    densityKgPerM3: 2400,
    densityLabel: 'wet concrete',
    defaultWastePercent: '5',
    useForPricingLabel: 'Use this volume for pricing',
  },

  area: {
    heading: 'Area & Formwork',
    subtitle: 'Calculate slab areas for formwork, mesh, and damp-proof membrane',
    slopeWord: 'Slope',
    planLabel: 'Slab area',
    actualLabel: 'Total area',
    planHint: 'Enter slab dimensions or a direct area',
    actualHint: 'Enter the measured area directly',
    actualDimsNote: 'Use the Area input to enter the measured area directly.',
    useSlopeFactor: false,
    commonSlopes: [],
    defaultSlope: '0',
    useForPricingLabel: 'Use this area for pricing',
  },

  gradient: {
    heading: 'Falls & Gradients',
    subtitle: 'Work out drainage falls — convert 1-in-X, percent and degrees, and get the fall over a run',
    commonRatios: [40, 60, 80, 100, 150],
    runLabel: 'Run length',
    runHint: 'Horizontal distance of the slab or drainage run',
    fallWord: 'fall',
  },

  smart: {
    heading: 'Draft Smart Component',
    subtitle: 'Build a component with pricing, waste, and labour rules, then calculate cost from measurements',
    defaultName: 'Ready-mix concrete',
    defaultMeasurementType: 'volume_3d',
    defaultWasteValue: '5',
    defaultPricePerUnit: '250',
    defaultPitchEnabled: false,
    areaPlaceholder: 'Enter volume or use from slab volume tab',
    prefillNote: 'Pre-filled from slab volume calculation',
  },

  content: {
    h1: 'Concrete Calculator',
    heroText:
      'Free concrete calculator for slabs, footings, and foundations. Work out volumes in m³ with depth presets, formwork and mesh areas, drainage falls, and ready-mix pricing. No signup required - works on mobile and desktop.',
    tipsHeading: 'Concrete calculation tips',
    tips: [
      {
        title: 'Always order slightly more than the calculated volume',
        body: 'Sub-bases are never perfectly level, and a slab poured 10mm deeper than planned across 30 m² swallows an extra 0.3 m³. Add 5% waste for slabs on a well-prepared base and up to 10% for trench footings in uneven ground. Running out mid-pour creates a cold joint — the most expensive mistake in concreting.',
      },
      {
        title: 'Choosing the right slab depth',
        body: 'Common depths: 100mm for patios, paths, and shed bases; 150mm for driveways and single garages; 225mm for strip footings and slabs taking heavier loads; 300mm+ for heavy-duty or reinforced bases. When in doubt, go deeper — the extra concrete is cheap compared to a failed slab.',
      },
      {
        title: 'Converting volume to ready-mix loads or bags',
        body: 'Ready-mix trucks typically carry 6-8 m³, with part-load fees below about 4 m³. For small jobs, bagged mix works: one 25kg bag yields roughly 0.011 m³, so 1 m³ needs about 90 bags — beyond 0.5 m³, ready-mix is nearly always cheaper and far less work.',
      },
      {
        title: 'Drainage falls on external slabs',
        body: 'External concrete needs a fall so water sheds away: 1-in-60 to 1-in-80 for patios and paths, 1-in-40 to 1-in-60 for driveways. A 1-in-60 fall is about 17mm per metre. Use the Falls & Gradients tab to convert between 1-in-X, percent, and degrees and get the total fall over the slab.',
      },
      {
        title: 'Do not forget the formwork and mesh',
        body: 'The Area & Formwork tab gives you the slab area for ordering reinforcement mesh and damp-proof membrane, plus the perimeter dimensions for formwork timber. Standard A142 mesh sheets are 4.8m × 2.4m (11.52 m²); overlap sheets by at least 300mm when calculating how many you need.',
      },
      {
        title: 'Concrete weight matters for access and barrows',
        body: 'Wet concrete weighs about 2,400 kg per cubic metre. A modest 2 m³ slab is nearly 5 tonnes of material — check whether the truck can discharge directly, or budget realistic time for barrowing. One builder barrow holds roughly 60 litres, so 1 m³ is about 17 loaded barrow runs.',
      },
    ],
    formulas: [
      { name: 'Slab volume', formula: 'volume = length × width × depth' },
      { name: 'Volume with waste', formula: 'order_volume = volume × (1 + waste%)' },
      { name: 'Concrete weight', formula: 'weight = volume × 2400 kg/m³' },
      { name: 'Fall over a run', formula: 'fall = run × tan(gradient°)  —  1 in X = (1/X) × 100%' },
      { name: 'Bags per m³', formula: 'bags ≈ volume / 0.011 (25kg bags)' },
    ],
    faqs: [
      {
        q: 'How much concrete do I need for a slab?',
        a: 'Multiply length × width × depth in metres. A 4m × 3m patio at 100mm deep is 4 × 3 × 0.1 = 1.2 m³. Add 5% for uneven sub-base and order 1.26 m³ — call it 1.3 m³. The Slab & Footing Volume tab does this with one tap on the depth presets.',
      },
      {
        q: 'How many cubic metres of concrete in a foundation trench?',
        a: 'Treat the trench as a long slab: length × width × depth. A 12m trench, 600mm wide and 225mm deep, is 12 × 0.6 × 0.225 = 1.62 m³. Trenches often over-dig, so add 10% waste rather than the 5% you would use for a slab on a prepared base.',
      },
      {
        q: 'What depth of concrete for a driveway?',
        a: '150mm is the standard for domestic driveways on a compacted sub-base, with reinforcement mesh. Use 100mm only for foot traffic (paths, patios, shed bases) and 225mm or more where vans or heavier vehicles will stand.',
      },
      {
        q: 'How much does a cubic metre of concrete weigh?',
        a: 'About 2,400 kg wet — nearly two and a half tonnes per cubic metre. This calculator shows the total weight of your pour so you can plan access, barrowing, and whether the ground or structure can take the load.',
      },
      {
        q: 'What is the best free concrete calculator?',
        a: 'The best free concrete calculator gives you slab and footing volumes with depth presets, waste allowance, weight, drainage falls, and ready-mix pricing in one tool — exactly what this calculator does. It is completely free, browser-based, and needs no signup.',
      },
    ],
    related: [
      {
        href: '/free-landscaping-calculator',
        title: 'Free Landscaping Calculator',
        desc: 'Garden areas, turf, topsoil, and slopes',
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
