import type { TradeConfig } from '../_shared/types';

export const birdsmouthConfig: TradeConfig = {
  slug: 'free-birds-mouth-calculator',
  defaultCurrency: 'GBP',
  name: "Bird's Mouth Calculator",
  metaTitle: "Free Bird's Mouth Calculator - Rafter & Stringer Seat Cuts | QuoteCore+",
  metaDescription:
    "Free bird's mouth calculator. Work out seat cut and plumb cut angles, heel height, and notch depth for rafters and stair stringers. Includes the ⅓-depth structural check.",
  ogTitle: "Free Bird's Mouth Calculator - Rafter & Stringer Seat Cuts",
  ogDescription:
    "Free bird's mouth calculator. Seat cut and plumb cut angles, heel height, notch depth, and ⅓-depth pass/fail check for rafters and stair stringers.",

  tabs: [
    { id: 'birdsmouth', label: "Bird's Mouth", kind: 'members' },
    { id: 'smart-component', label: 'Draft Smart Component™', kind: 'smart' },
    { id: 'angle-finder', label: 'Angle Finder', kind: 'angle' },
  ],

  members: {
    heading: "Bird's Mouth Cut Calculator",
    subtitle: 'Calculate seat cut and plumb cut angles, heel height, and notch depth from pitch and timber size',
    slopeWord: 'Angle',
    memberLabel: 'Rafter',
    spanLabel: 'Run',
    spanHint: 'Horizontal distance the rafter or stringer covers',
    showHipValley: false,
    showBirdsmouth: true,
    birdsmouthMemberWord: 'Rafter',
    commonSlopes: [15, 22.5, 30, 35, 40, 42, 45, 50, 60],
    defaultSlope: '35',
    diagramCaption: 'Rafter at {deg}° - run is the horizontal distance covered',
    diagramTopLabel: 'Top',
    diagramBaseLabel: 'Base',
  },

  smart: {
    heading: 'Draft Smart Component',
    subtitle: 'Price up rafter timber, fixings, and labour with waste and quantity rules',
    defaultName: 'Rafter timber',
    defaultMeasurementType: 'lineal',
    defaultWasteValue: '10',
    defaultPricePerUnit: '8.50',
    defaultPitchEnabled: false,
    areaPlaceholder: 'Enter length or use from birdsmouth tab',
    prefillNote: 'Pre-filled from rafter calculation',
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
    h1: "Bird's Mouth Calculator",
    heroText:
      "Free bird's mouth calculator for roofers, carpenters, and stair builders. Work out seat cut and plumb cut angles, heel height, and notch depth from the pitch and timber size. Includes the ⅓-depth structural check so you don't weaken the rafter. No signup required.",
    tipsHeading: "Bird's mouth calculation tips",
    tips: [
      {
        title: 'What is a bird\'s mouth cut?',
        body: "A bird's mouth is the notch cut into the bottom of a rafter or stair stringer where it sits on a wall plate or landing. The seat cut is the horizontal flat that bears on the plate; the plumb cut is the vertical face that butts against the wall. Together they position the rafter at the correct pitch and transfer the roof load onto the wall plate evenly.",
      },
      {
        title: 'Seat cut angle and plumb cut angle',
        body: "Measured from the bottom edge of the rafter, the seat cut angle equals the pitch angle and the plumb cut angle equals 90° minus the pitch. At 35° pitch, the seat cut is 35° from the edge and the plumb cut is 55°. These two angles always add up to 90° because the seat is horizontal and the plumb is vertical.",
      },
      {
        title: 'The ⅓-depth rule for notch depth',
        body: "The notch depth (the perpendicular distance the bird's mouth cuts into the rafter) must never exceed one-third of the rafter depth. A 200mm deep rafter allows a maximum 66.7mm notch. Deeper notches remove too much material from the heel (the portion above the seat), weakening the rafter at the point of maximum bending stress. If your notch is too deep, reduce the seat width or use a deeper timber section.",
      },
      {
        title: 'Heel height and why it matters',
        body: "The heel is the vertical distance from the top of the seat cut to the top edge of the rafter. It determines how much insulation can fit above the wall plate and whether the rafter has enough material remaining to carry load. A small heel means the rafter is severely weakened at the bird's mouth - the ⅓-depth rule exists to protect the heel.",
      },
      {
        title: 'Bird\'s mouth on stair stringers',
        body: "Stair stringers use the same principle: the seat cut rests on the landing or floor, the plumb cut butts against the header. The pitch is set by the rise and going of the stairs - UK building regs typically cap stair pitch at 42° for domestic stairs. The ⅓-depth rule applies equally to stringers; an over-cut stringer will crack under load.",
      },
      {
        title: 'Choosing the seat width',
        body: "The seat width should match the wall plate width so the rafter bears fully on the timber below - commonly 75mm or 100mm in the UK. A wider seat gives more bearing area but increases the notch depth. If the notch exceeds ⅓ of the rafter depth at your chosen seat width, move to a deeper rafter rather than reducing the bearing.",
      },
    ],
    formulas: [
      { name: 'Seat cut angle', formula: 'seat_angle = pitch (measured from rafter edge)' },
      { name: 'Plumb cut angle', formula: 'plumb_angle = 90° − pitch (measured from rafter edge)' },
      { name: 'Heel height', formula: 'heel = seat_width × tan(pitch°)' },
      { name: 'Notch depth', formula: 'notch = seat_width × sin(pitch°)' },
      { name: 'Max notch', formula: 'max_notch = rafter_depth ÷ 3' },
      { name: 'Notch check', formula: 'PASS if notch ≤ max_notch, else FAIL' },
    ],
    faqs: [
      {
        q: "How do I calculate a bird's mouth cut?",
        a: "Enter the pitch angle and the seat width (usually matching the wall plate width, e.g. 100mm). The calculator works out the seat cut angle (= pitch), plumb cut angle (= 90° − pitch), heel height (= seat × tan(pitch)), and notch depth (= seat × sin(pitch)). It also checks the notch against ⅓ of the rafter depth.",
      },
      {
        q: "What is the maximum depth of a bird's mouth notch?",
        a: "The notch must not exceed one-third of the rafter depth. For a 200mm rafter, the maximum notch is 66.7mm. If your calculated notch is deeper, reduce the seat width or use a deeper rafter. Cutting deeper weakens the heel - the remaining timber above the seat that carries the bending load.",
      },
      {
        q: "What angle is the plumb cut on a bird's mouth?",
        a: "The plumb cut angle equals 90° minus the pitch. At 35° pitch the plumb cut is 55° from the rafter edge. The seat cut is the complement: 35° from the edge. Together they always sum to 90° because one is horizontal and the other vertical.",
      },
      {
        q: "Does the bird's mouth calculator work for stair stringers?",
        a: "Yes. Stair stringers use the same geometry - a seat cut that rests on the landing and a plumb cut that butts the header. Enter the stair pitch (typically up to 42° for domestic stairs) and the stringer depth. The ⅓-depth rule applies the same way.",
      },
      {
        q: "What is the best free bird's mouth calculator?",
        a: "The best free bird's mouth calculator shows seat cut and plumb cut angles, heel height, notch depth, and a pass/fail check against the ⅓-depth rule - with a clear diagram labelling every measurement. This calculator does all of that, free and with no signup.",
      },
    ],
    related: [
      {
        href: '/free-roofing-calculator',
        title: 'Free Roofing Calculator',
        desc: 'Roof pitch, rafter lengths, and roofing materials',
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
