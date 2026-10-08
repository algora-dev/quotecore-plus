/** Content and route identity only. Numerical logic lives in calculator-model. */
export type Trade = 'construction' | 'birdsmouth';
export type Tab = 'area' | 'members' | 'battens' | 'pricing' | 'angles';
export interface CalculatorProfile {
  id: Trade;
  slug: string;
  name: string;
  heroTitle: string;
  eyebrow: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  tabs: { id: Tab; label: string; description: string; icon: string }[];
  headings: Record<Tab, { title: string; subtitle: string }>;
  faqs: { q: string; a: string }[];
  related: { label: string; href: string }[];
}
const commonHeadings: CalculatorProfile['headings'] = {
  area: { title: 'Start with the surface.', subtitle: 'A floor, a wall, or a sloping surface. We’ll keep the units clear.' },
  members: { title: 'Find the length. Understand the cut.', subtitle: 'Choose an angled member length or a birdsmouth detail.' },
  battens: { title: 'From spacing to a material allowance.', subtitle: 'Turn a measured surface and centre spacing into linear length.' },
  pricing: { title: 'Put a price to your measurements.', subtitle: 'Keep materials, waste and labour together in a Smart Component™ draft.' },
  angles: { title: 'See how the two surfaces meet.', subtitle: 'The finished included angle and the bend from flat, side by side.' },
};
const commonFaqs = [
  { q: 'Are these calculators free?', a: 'Yes. The calculations, copy, CSV and print tools run in your browser without signing up. Reusing a Smart Component in the paid QuoteCore+ app is a separate next step.' },
  { q: 'What happens when I change units?', a: 'Existing dimensions and per-unit material rates are converted. Metric uses metres for lengths and millimetres for small details; imperial uses feet and inches. Currency changes only the currency label, not the exchange rate.' },
  { q: 'Can I turn the result into a quote?', a: 'Yes. Send a length, area or priced material to the Free Quote Generator and review the details there. Tax, margin and delivery are not included in the calculator estimate. Cut depths and angles are not transferred as material quantities.' },
];
export const PROFILES: Record<Trade, CalculatorProfile> = {
  construction: {
    id: 'construction', slug: 'free-construction-calculator', name: 'Construction Calculator',
    heroTitle: 'Construction calculator', eyebrow: 'BUILT FOR THE WAY YOU BUILD',
    intro: 'Measure the space. Allow for materials. Know the cost.',
    metaTitle: 'Construction Calculator - Areas & Angles',
    metaDescription: 'Free construction calculator for floor and wall areas, angled timber, battens, material pricing and junction angles. Metric and imperial. No signup required.',
    tabs: [
      { id: 'area', label: 'Area & materials', description: 'Floors, walls & slopes', icon: 'area' },
      { id: 'members', label: 'Timber & cuts', description: 'Lengths & birdsmouths', icon: 'ruler' },
      { id: 'battens', label: 'Battens', description: 'Spacing to quantity', icon: 'battens' },
      { id: 'pricing', label: 'Material pricing', description: 'A Smart Component™ draft', icon: 'calculator' },
      { id: 'angles', label: 'Angle finder', description: 'Junctions & bends', icon: 'angle' },
    ],
    headings: commonHeadings,
    faqs: [
      { q: 'Do I need a slope for a wall or a floor?', a: 'No. Choose Floor or Wall / ceiling and enter dimensions measured along that surface. A vertical wall is not entered as a 90° roof pitch. Choose Sloping surface only when you need to convert flat plan measurements or enter a measured sloping area.' },
      { q: 'Can I subtract windows and doors?', a: 'Open “Deduct openings” and enter the combined measured area of the openings. Deductions come off the actual surface area, after any slope adjustment. Cutting layout, usable offcuts and product coverage can change what you need to buy.' },
      { q: 'How is the batten quantity estimated?', a: 'Total linear length is surface area divided by centre spacing, then your waste allowance is added. This is an area-based estimate, not a layout or an exact row count. Perimeter pieces, additional supports and cut lengths need a separate check.' },
      { q: 'Does Timber & cuts calculate a complete stud wall?', a: 'It calculates the geometric length of an angled member from horizontal run and angle, or a birdsmouth detail. It does not count studs, noggins, trimmers, fixings or plates and does not size timber structurally.' },
      ...commonFaqs,
    ],
    related: [
      { label: 'Roofing calculator', href: '/free-roofing-calculator' },
      { label: 'Birdsmouth & roof angles', href: '/free-birds-mouth-calculator' },
      { label: 'Free Quote Generator', href: '/free-quote-generator' },
      { label: 'All calculators', href: '/free-calculators' },
    ],
  },
  birdsmouth: {
    id: 'birdsmouth', slug: 'free-birds-mouth-calculator', name: 'Birdsmouth & Roof Angle Calculator',
    heroTitle: 'Birdsmouth & roof angles', eyebrow: 'A CLEARER VIEW OF EVERY CUT',
    intro: 'Understand the pitch. See the notch. Check your dimensions.',
    metaTitle: 'Birdsmouth & Roof Angle Calculator - Seat and Plumb Cuts',
    metaDescription: 'Calculate birdsmouth seat and plumb angles, perpendicular notch depth, vertical heel cut, rafter length and roof junction angles. Planning geometry, not structural approval.',
    tabs: [
      { id: 'members', label: 'Birdsmouth & rafters', description: 'Cut geometry & lengths', icon: 'ruler' },
      { id: 'pricing', label: 'Material pricing', description: 'Timber, waste & labour', icon: 'calculator' },
      { id: 'angles', label: 'Roof angles', description: 'Ridges, junctions & bends', icon: 'angle' },
    ],
    headings: { ...commonHeadings, members: { title: 'Understand your birdsmouth cut.', subtitle: 'Start with the pitch and two measured timber details. See what each dimension means.' } },
    faqs: [
      { q: 'Which timber dimensions do I enter?', a: 'Seat length is the horizontal bearing length of the cut. Rafter depth is the actual section depth measured perpendicular to the rafter edges, not its width or a vertical measurement. Use millimetres or decimal inches, as labelled.' },
      { q: 'What is the difference between notch depth and the heel cut?', a: 'Perpendicular notch depth is seat length × sin(pitch). The vertical heel cut is seat length × tan(pitch). They measure the same notch in different directions and must not be treated as interchangeable.' },
      { q: 'How is height above the seat calculated?', a: 'At the deepest heel, the vertical height above the seat is (rafter depth − perpendicular notch depth) ÷ cos(pitch). The diagram labels this as HAP. It is not the vertical depth of the cut.' },
      { q: 'Does a result within the selected allowance mean the cut is approved?', a: 'No. The 1/3, 1/4 and custom comparisons are numerical planning references, not automatically selected building-code limits. Local rules, bearing, timber product, overhangs, loads and the specific detail need project verification. This tool does not approve a rafter, engineered joist or stair stringer.' },
      { q: 'Are these the settings for my saw?', a: 'No. Seat and plumb angles are measured from the rafter edge, and add to 90°. Tool scales and cutting orientation vary. The illustrated detail is a labelled schematic, not a full-size cutting template.' },
      { q: 'Can I enter roof pitch as rise and run?', a: 'Yes. Switch from Degrees to Rise : run. Enter both in the same unit; 6 : 12 is about 26.565°. The pitch is calculated using the arctangent of rise divided by run. Rafter length takes a separate horizontal run, not the full building span.' },
      ...commonFaqs,
    ],
    related: [
      { label: 'Roofing calculator', href: '/free-roofing-calculator' },
      { label: 'Construction calculator', href: '/free-construction-calculator' },
      { label: 'Free Quote Generator', href: '/free-quote-generator' },
      { label: 'All calculators', href: '/free-calculators' },
    ],
  },
};
export const profileFor = (trade: Trade): CalculatorProfile => PROFILES[trade];
export const storageKey = (trade: Trade): string => `qcp:${trade}-calculator:v1`;
