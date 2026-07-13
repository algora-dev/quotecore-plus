import type { TradeConfig, RelatedLink } from '../_shared/types';
import { roofingConfig } from './roofing';

/** Compact slug definition - only the unique parts per SEO page. */
export interface SlugDef {
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
  /** Tab id to show on page load. Defaults to tabs[0]. */
  defaultTab?: string;
}

const REL: RelatedLink[] = [
  { href: '/free-roofing-calculator', title: 'Free Roofing Calculator', desc: 'Full roofing calculator - pitch, area, rafters, materials' },
  { href: '/free-birds-mouth-calculator', title: "Free Bird's Mouth Calculator", desc: 'Seat cut and plumb cut angles with ⅓-depth check' },
  { href: '/free-construction-calculator', title: 'Free Construction Calculator', desc: 'Areas, timber lengths, and building materials' },
  { href: '/free-quote-generator', title: 'Free Quote Generator', desc: 'Turn measurements into a professional quote' },
];

export function toConfig(d: SlugDef): TradeConfig {
  return {
    ...roofingConfig,
    slug: d.slug,
    name: d.name,
    metaTitle: d.mTitle,
    metaDescription: d.mDesc,
    ogTitle: d.ogTitle,
    ogDescription: d.ogDesc,
    defaultTab: d.defaultTab,
    content: {
      h1: d.h1,
      heroText: d.hero,
      tipsHeading: d.tipsH,
      tips: d.tips.map(([title, body]) => ({ title, body })),
      formulas: d.formulas.map(([name, formula]) => ({ name, formula })),
      faqs: d.faqs.map(([q, a]) => ({ q, a })),
      related: REL,
    },
  };
}

export const SLUGS_1: SlugDef[] = [
  {
    slug: 'free-roof-pitch-calculator',
    defaultTab: 'pitch-rafter',
    name: 'Roof Pitch Calculator',
    mTitle: 'Free Roof Pitch Calculator - Degrees, Ratio & Rise/Run | QuoteCore+',
    mDesc: 'Free roof pitch calculator. Convert between degrees, rise/run ratio, and percentage. Calculate pitch from angle or measurements. No signup required.',
    ogTitle: 'Free Roof Pitch Calculator - Degrees, Ratio & Rise/Run',
    ogDesc: 'Free roof pitch calculator. Convert between degrees, rise/run, and percentage.',
    h1: 'Roof Pitch Calculator',
    hero: 'Calculate roof pitch in degrees, as a rise/run ratio, or as a percentage. Enter any one value and the calculator converts instantly. Includes pitch factor for surface area. Free, no signup.',
    tipsH: 'Roof pitch - did you know?',
    tips: [
      ['What exactly is roof pitch?', 'Roof pitch is the steepness of a roof, expressed as an angle in degrees or as a ratio of rise to run. UK uses degrees (e.g. 35°). US uses rise/run (e.g. 6:12 = 6 inches rise per 12 inches run). Both describe the same thing.'],
      ['Degrees vs ratio conversion', 'To convert ratio to degrees: pitch° = arctan(rise ÷ run). A 6:12 roof = arctan(0.5) = 26.57°. To convert degrees to ratio: tan(pitch°). At 35°, tan(35) = 0.700, so the ratio is ~7:10.'],
      ['Why pitch matters for materials', 'Pitch determines roof surface area. The pitch factor (1 ÷ cos(pitch°)) converts plan area to actual roof area. At 35°, the factor is 1.221 - 100 m² plan becomes 122.1 m² of roof surface.'],
      ['Minimum pitch by material', 'Concrete/clay tiles need 17.5°+ in UK; metal standing seam 3°+; slate 20°+; felt/membrane flat roofs need 1:80 fall (~0.7°). Below minimums, water ponds and penetrates.'],
    ],
    formulas: [
      ['Pitch from rise/run', 'pitch° = arctan(rise ÷ run)'],
      ['Rise/run from pitch', 'ratio = tan(pitch°)'],
      ['Pitch as percentage', 'percent = (rise ÷ run) × 100'],
      ['Pitch factor', 'factor = 1 ÷ cos(pitch°)'],
    ],
    faqs: [
      ['How do I calculate roof pitch in degrees?', 'Measure rise over a known run (e.g. 300mm over 1000mm) and calculate arctan(0.3) = 16.7°. Or use a digital level on the roof surface.'],
      ['What is a 6:12 pitch in degrees?', 'arctan(6/12) = 26.57°. One of the most common US residential roof pitches.'],
      ['What pitch factor should I use?', '1 ÷ cos(pitch°). At 25° = 1.103, at 35° = 1.221, at 45° = 1.414. Multiply plan area by this factor for actual roof surface area.'],
      ['What is the best free roof pitch calculator?', 'One that converts between degrees, ratios, and percentages, and shows the pitch factor. This tool does all of that, free with no signup.'],
    ],
  },
  {
    slug: 'free-roof-pitch-converter',
    defaultTab: 'pitch-rafter',
    name: 'Roof Pitch Converter',
    mTitle: 'Free Roof Pitch Converter - Degrees to Ratio & Percentage | QuoteCore+',
    mDesc: 'Convert roof pitch between degrees, rise/run ratio, and percentage. Free online pitch converter. No signup required.',
    ogTitle: 'Free Roof Pitch Converter - Degrees ⇄ Ratio ⇄ Percentage',
    ogDesc: 'Free roof pitch converter. Switch between degrees, rise/run, and percentage.',
    h1: 'Roof Pitch Converter',
    hero: 'Convert roof pitch between degrees, rise/run ratio, and percentage instantly. Enter any one value and get the others automatically. Free, no signup.',
    tipsH: 'Pitch conversion - did you know?',
    tips: [
      ['Why three pitch formats exist', 'Degrees (UK/Europe - precise). Rise/run ratios (US - directly describes rafter geometry). Percentages (commercial flat roofing - 1:80 fall = 1.25%).'],
      ['Degrees to ratio', 'Calculate tan(pitch°). At 35°, tan(35) = 0.700, ratio = 7:10. For Imperial 12-based: 0.700 × 12 = 8.4, so 8.4:12.'],
      ['Ratio to degrees', 'arctan(rise ÷ run). For 9:12: arctan(0.75) = 36.87°. Most common conversion between UK and US specs.'],
      ['Common pitch values', '15° = 1:3.73 = 26.8% · 22.5° = 1:2.41 = 41.4% · 30° = 1:1.73 = 57.7% · 35° = 1:1.43 = 70% · 45° = 1:1.00 = 100%.'],
    ],
    formulas: [
      ['Degrees → ratio', 'ratio = tan(pitch°)'],
      ['Ratio → degrees', 'pitch° = arctan(rise ÷ run)'],
      ['Degrees → percentage', 'percent = tan(pitch°) × 100'],
      ['Percentage → degrees', 'pitch° = arctan(percent ÷ 100)'],
    ],
    faqs: [
      ['How do I convert degrees to a ratio?', 'Calculate tan(pitch°). At 35°, tan(35) = 0.700, ratio ~7:10 or 8.4:12 Imperial.'],
      ['How do I convert 4:12 to degrees?', 'arctan(4/12) = 18.43°. A low-slope roof common in modern US construction.'],
      ['What is 35 degrees as a ratio?', 'tan(35°) = 0.700, ratio ~1:1.43 or 8.4:12 in Imperial terms.'],
      ['Is there a free roof pitch converter?', 'Yes - this converter is free, handles degrees/ratio/percentage, no signup required.'],
    ],
  },
  {
    slug: 'free-roof-area-calculator',
    defaultTab: 'roof-area',
    name: 'Roof Area Calculator',
    mTitle: 'Free Roof Area Calculator - Plan & Surface Area from Pitch | QuoteCore+',
    mDesc: 'Free roof area calculator. Calculate actual roof surface area from plan dimensions and pitch. Includes pitch factor and waste. No signup required.',
    ogTitle: 'Free Roof Area Calculator - Plan & Surface Area',
    ogDesc: 'Free roof area calculator. Calculate actual roof surface area from plan and pitch.',
    h1: 'Roof Area Calculator',
    hero: 'Calculate actual roof surface area from plan dimensions and pitch. Enter footprint area and pitch to get the true sloped surface area, with optional waste allowance. Free, no signup.',
    tipsH: 'Roof area - did you know?',
    tips: [
      ['Plan area vs actual roof area', 'Plan area is the footprint from above. Actual roof area is the sloped surface. At 35°, 100 m² plan = 122.1 m² roof. Forgetting this is the #1 cause of under-ordering.'],
      ['The pitch factor formula', 'Factor = 1 ÷ cos(pitch°). The sloped surface is the hypotenuse; plan area is the adjacent side. Dividing by cosine gives the true area.'],
      ['Measuring irregular roofs', 'Break into rectangles and triangles. L-shaped: each rectangle separately. Hipped ends: base × height ÷ 2. Add sections before applying pitch factor.'],
      ['Metric vs imperial', 'UK/AU: m². US: "squares" (1 square = 100 sq ft). 1 m² = 10.764 sq ft = 0.1076 squares. 1 square = 9.29 m².'],
    ],
    formulas: [
      ['Roof surface area', 'area = plan_area × (1 ÷ cos(pitch°))'],
      ['Pitch factor', 'factor = 1 ÷ cos(pitch°)'],
      ['Material quantity', 'qty = area × (1 + waste%) ÷ coverage'],
      ['Squares (US)', 'squares = roof_area_sqft ÷ 100'],
    ],
    faqs: [
      ['How do I calculate roof area from plan?', 'Multiply plan area by pitch factor (1 ÷ cos(pitch°)). 100 m² at 35° = 100 × 1.221 = 122.1 m².'],
      ['What is the pitch factor for 30°?', '1 ÷ cos(30°) = 1.155. At 35° = 1.221, at 40° = 1.305, at 45° = 1.414.'],
      ['How much extra material should I order?', '5-10% concrete tiles, 10-15% clay/shingles, 5% metal. Add 5% extra for complex roofs.'],
      ['What is the best free roof area calculator?', 'One that takes plan + pitch, applies pitch factor, and adds waste. This tool does all of that, free.'],
    ],
  },
  {
    slug: 'free-rafter-length-calculator',
    defaultTab: 'pitch-rafter',
    name: 'Rafter Length Calculator',
    mTitle: 'Free Rafter Length Calculator - Span, Pitch & Overhang | QuoteCore+',
    mDesc: 'Free rafter length calculator. Calculate rafter length from span and pitch, including overhang. Hip/valley lengths included. No signup required.',
    ogTitle: 'Free Rafter Length Calculator - Span, Pitch & Overhang',
    ogDesc: 'Free rafter length calculator. Calculate from span and pitch.',
    h1: 'Rafter Length Calculator',
    hero: 'Calculate rafter length from span and pitch. Enter horizontal run (wall to ridge) and pitch for true rafter length, with overhang and hip/valley. Free, no signup.',
    tipsH: 'Rafter length - did you know?',
    tips: [
      ['The rafter length formula', 'Rafter = run ÷ cos(pitch°). Run is wall-to-ridge horizontal distance. At 35° with 4m run: 4 ÷ cos(35) = 4.88m.'],
      ['Span vs run - critical difference', 'Span is total building width (wall to wall). Run is half the span. Rafter length uses run. 8m wide building = 4m run.'],
      ['Adding overhang', 'Total = (run + overhang) ÷ cos(pitch°). 4m run + 0.3m overhang at 35° = 5.25m. Account for bird\'s mouth when ordering.'],
      ['Hip and valley lengths', 'Hip = hip_run × sqrt((1/cos(pitch°))² + 1). At 35° with 4m hip run: 6.31m. Significantly longer than common rafters.'],
    ],
    formulas: [
      ['Rafter length', 'rafter = run ÷ cos(pitch°)'],
      ['With overhang', 'total = (run + overhang) ÷ cos(pitch°)'],
      ['Hip/valley', 'hip = hip_run × sqrt((1/cos(pitch°))² + 1)'],
      ['Run from span', 'run = span ÷ 2 (gable)'],
    ],
    faqs: [
      ['How do I calculate rafter length?', 'Divide run by cos(pitch°). 4m run at 35° = 4.88m. Add overhang ÷ cos for total length.'],
      ['Difference between span and run?', 'Span = total building width. Run = half span = wall-to-ridge distance. Calculations use run.'],
      ['How do I calculate hip rafter length?', 'Hip = hip_run × sqrt((1/cos(pitch°))² + 1). At 35°, 4m hip run = 6.31m.'],
      ['Best free rafter length calculator?', 'One that takes span + pitch, includes overhang and hip/valley. This tool does all, free.'],
    ],
  },
  {
    slug: 'free-rafter-length-converter',
    defaultTab: 'pitch-rafter',
    name: 'Rafter Length Converter',
    mTitle: 'Free Rafter Length Converter - Metric & Imperial | QuoteCore+',
    mDesc: 'Free rafter length converter. Convert between metric and imperial. Calculate from span and pitch in any unit. No signup required.',
    ogTitle: 'Free Rafter Length Converter - Metric ⇄ Imperial',
    ogDesc: 'Free rafter length converter. Metric and imperial.',
    h1: 'Rafter Length Converter',
    hero: 'Convert rafter lengths between metric (metres) and imperial (feet, inches). Enter span and pitch in any unit and get results in both. Free, no signup.',
    tipsH: 'Rafter conversion - did you know?',
    tips: [
      ['Metric to imperial', '1m = 3.281ft = 39.37in. A 4.88m rafter = 16.01ft. Round up to next standard Imperial length when ordering.'],
      ['Imperial to metric', '1ft = 0.3048m. 1in = 25.4mm. A 16ft rafter = 4.877m. Verify converted length is available locally.'],
      ['Converting pitch ratios', 'US: rise:12 (e.g. 6:12). To degrees: arctan(rise/12). UK degrees to US: tan(pitch°) × 12. At 35°: 8.4:12.'],
      ['Standard timber lengths', 'UK: 4.8m, 5.4m, 6.0m. US: 12ft, 14ft, 16ft, 20ft. AU: 4.8m, 5.4m, 6.0m. Check local availability.'],
    ],
    formulas: [
      ['Metres → feet', 'feet = metres × 3.281'],
      ['Feet → metres', 'metres = feet × 0.3048'],
      ['Rafter (any unit)', 'rafter = run ÷ cos(pitch°)'],
      ['US ratio → degrees', 'pitch° = arctan(rise ÷ 12)'],
    ],
    faqs: [
      ['Convert rafter length metres to feet?', 'Multiply by 3.281. 4.88m = 16.01ft.'],
      ['Convert 6:12 pitch to degrees?', 'arctan(6/12) = 26.57°. At 4m run: rafter = 4.47m.'],
      ['Can I use imperial units?', 'Yes - toggle to Imperial, enter span in feet. Switch back for metric equivalent.'],
      ['35 degrees as US ratio?', 'tan(35°) × 12 = 8.4, so 8.4:12.'],
    ],
  },
  {
    slug: 'free-hip-valley-calculator',
    defaultTab: 'pitch-rafter',
    name: 'Hip & Valley Calculator',
    mTitle: 'Free Hip & Valley Calculator - Hip Rafter Length & Angles | QuoteCore+',
    mDesc: 'Free hip and valley calculator. Calculate hip rafter length, valley length, and compound angles from pitch. No signup required.',
    ogTitle: 'Free Hip & Valley Calculator - Length & Angles',
    ogDesc: 'Free hip and valley calculator. Lengths and compound angles.',
    h1: 'Hip & Valley Calculator',
    hero: 'Calculate hip and valley rafter lengths from pitch and plan dimensions. Get diagonal length, backing angle, and compound cut angles. Free, no signup.',
    tipsH: 'Hip & valley - did you know?',
    tips: [
      ['What makes hip rafters different', 'Hip rafter runs diagonally corner-to-ridge at 45° plan view, longer than common rafter. hip = hip_run × sqrt((1/cos(pitch°))² + 1). At 35°, 4m hip run = 6.31m.'],
      ['Valleys - mirror of hips', 'Valley is the internal equivalent - where two slopes meet in a V. Same length formula. Hips carry weight; valleys carry water and need waterproofing.'],
      ['The backing angle', 'Top edge of hip must be bevelled so roofing lies flat both sides. backing = arctan(sin(pitch°) ÷ sqrt(2)). At 35°: ~24.2°.'],
      ['Compound angle cuts', 'Hip top cut is compound - pitch angle AND 45° plan bevel. side_cut = arctan(cos(pitch°) ÷ sin(45°)). At 35°: 49.2°. One of roofing\'s trickiest cuts.'],
    ],
    formulas: [
      ['Hip/valley length', 'hip = hip_run × sqrt((1/cos(pitch°))² + 1)'],
      ['Backing angle', 'backing = arctan(sin(pitch°) ÷ sqrt(2))'],
      ['Side cut angle', 'side_cut = arctan(cos(pitch°) ÷ sin(45°))'],
      ['Common rafter', 'rafter = run ÷ cos(pitch°)'],
    ],
    faqs: [
      ['How do I calculate hip rafter length?', 'hip_run × sqrt((1/cos(pitch°))² + 1). At 35°, 4m hip run = 6.31m.'],
      ['Difference between hip and valley?', 'Hip = external ridge (corner). Valley = internal junction (V channel for water). Same length formula.'],
      ['What is the backing angle?', 'arctan(sin(pitch°) ÷ sqrt(2)). At 35°: ~24.2°. Bevels the hip top so both roof planes lie flat.'],
      ['Best free hip and valley calculator?', 'One that gives hip length, backing angle, and side cut. This tool does all, free.'],
    ],
  },
  {
    slug: 'free-hip-valley-converter',
    defaultTab: 'pitch-rafter',
    name: 'Hip & Valley Converter',
    mTitle: 'Free Hip & Valley Converter - Length & Angle Units | QuoteCore+',
    mDesc: 'Convert hip and valley rafter lengths and angles between metric and imperial. Free online converter. No signup required.',
    ogTitle: 'Free Hip & Valley Converter - Length & Angle Units',
    ogDesc: 'Convert hip and valley lengths and angles between metric and imperial.',
    h1: 'Hip & Valley Converter',
    hero: 'Convert hip and valley rafter lengths and angles between metric and imperial. Enter pitch and run in any system, get results in both. Free, no signup.',
    tipsH: 'Hip & valley conversion - did you know?',
    tips: [
      ['Hip length metric vs imperial', 'A 6.31m hip (35°, 4m run) = 20.70ft. Standard US lumber: 22ft would cover it with waste. UK: 6.6m or 7.2m C24.'],
      ['Backing angle in degrees and ratio', 'Backing angle is always in degrees (it is a bevel, not a slope). At 35° pitch: 24.2° backing. Convert to percentage: tan(24.2°) × 100 = 44.9%.'],
      ['Side cut as a bevel angle', 'Side cut = arctan(cos(pitch°) ÷ sin(45°)). At 35°: 49.2°. This is set on a circular saw bevel gauge. In Imperial: same degrees - angles are unit-independent.'],
      ['Why angles don\'t need conversion', 'Angles in degrees are the same in metric and imperial. Only linear measurements (lengths) need conversion. A 49.2° cut is 49.2° whether you measure the timber in mm or inches.'],
    ],
    formulas: [
      ['Hip length (metric→imperial)', 'feet = metres × 3.281'],
      ['Hip length (imperial→metric)', 'metres = feet × 0.3048'],
      ['Backing angle (always degrees)', 'backing = arctan(sin(pitch°) ÷ sqrt(2))'],
      ['Side cut (always degrees)', 'side_cut = arctan(cos(pitch°) ÷ sin(45°))'],
    ],
    faqs: [
      ['Do I need to convert backing angles?', 'No - angles in degrees are the same in metric and imperial. Only convert lengths (m↔ft).'],
      ['How long is a 6.31m hip in feet?', '6.31 × 3.281 = 20.70ft. Order 22ft lumber to allow for cuts and waste.'],
      ['Can I calculate hip lengths in imperial?', 'Yes - toggle to Imperial. Enter hip run in feet; get hip length in feet. Switch to Metric for metres.'],
      ['Is there a free hip and valley converter?', 'Yes - this converter handles lengths and angles in both unit systems, free.'],
    ],
  },
];
