import type { TradeConfig } from '../_shared/types';
import { landscapingConfig } from './landscaping';

interface SlopeSlugDef {
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

function toConfig(d: SlopeSlugDef): TradeConfig {
  return {
    ...landscapingConfig,
    slug: d.slug,
    name: d.name,
    metaTitle: d.mTitle,
    metaDescription: d.mDesc,
    ogTitle: d.ogTitle,
    ogDescription: d.ogDesc,
    defaultTab: d.defaultTab,
    content: {
      ...landscapingConfig.content,
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
        { href: '/free-landscaping-calculator', title: 'Free Landscaping Calculator', desc: 'Garden areas, slopes, and materials' },
        { href: '/free-construction-calculator', title: 'Free Construction Calculator', desc: 'Areas, timber, and materials' },
        { href: '/free-quote-generator', title: 'Free Quote Generator', desc: 'Turn measurements into a quote' },
      ],
    },
  };
}

export const SLOPE_SLUGS: SlopeSlugDef[] = [
  {
    slug: 'free-slope-calculator',
    name: 'Slope Calculator',
    mTitle: 'Free Slope Calculator - Gradient, Angle & Ratio | QuoteCore+',
    mDesc: 'Calculate slope, gradient, and angle for landscaping, drainage, and construction. Convert between degrees, percentage, and ratio. No signup.',
    ogTitle: 'Free Slope Calculator',
    ogDesc: 'Calculate slope gradient, angle, and ratio for any project. Free, no signup.',
    h1: 'Slope Calculator',
    hero: 'Calculate slope, gradient, and angle for drainage, landscaping, ramps, and construction. Convert between degrees, percentage, and rise:run ratio.',
    tipsH: 'Slope calculation tips',
    defaultTab: 'gradient',
    tips: [
      ['Minimum gradients for drainage', 'Surface water drainage requires a minimum 1:100 (1%) fall. Soakaways and French drains: 1:80 minimum. Sewer connections: 1:40 to 1:80 depending on pipe size. Patio drainage: 1:60 to 1:80. Always check building regulations.'],
      ['Ramp gradients for accessibility', 'UK Building Regulations Part M: maximum 1:12 for ramps up to 5m. For 5-10m: maximum 1:15. Over 10m: maximum 1:20. Landings required every 5m of ramp run at 1:15 or steeper.'],
      ['Converting between slope formats', 'Percentage = (rise / run) × 100. Degrees = arctan(rise / run). Ratio = 1 : (run / rise). A 1:20 slope = 5% = 2.86°. A 1:12 ramp = 8.33% = 4.76°. A 45° slope = 100% = 1:1.'],
      ['Measuring slope on-site', 'Use a spirit level and a straight edge (1m or 2m). Measure the gap under the level at one end - that\'s the rise over the length of the level. For a 1m level with a 20mm gap: slope = 20mm/1000mm = 1:50 = 2%.'],
    ],
    formulas: [
      ['Slope percentage', 'slope% = (rise / run) × 100'],
      ['Slope in degrees', 'angle = arctan(rise / run)'],
      ['Slope ratio', 'ratio = 1 : (run / rise)'],
      ['Length on slope', 'L = sqrt(run² + rise²)'],
    ],
    faqs: [
      ['What is a 1 in 40 slope?', 'A 1:40 slope means for every 40 units of horizontal distance, the ground drops 1 unit. This equals 2.5% gradient or about 1.43°. It is a common gradient for drainage pipes.'],
      ['What is the minimum slope for a patio?', 'Minimum 1:60 (1.67%) for patios. Recommended 1:50 to 1:80. The fall should direct water away from buildings. A 3m patio needs to drop at least 50mm over its length.'],
      ['How steep is a 10 degree slope?', '10° = 17.6% = approximately 1:5.7. This is walkable but would feel quite steep. Wheelchair ramps must be much shallower (max 1:12 = 4.76°). A 10° slope is typical for a moderately steep garden.'],
      ['How do I convert slope percentage to degrees?', 'Degrees = arctan(percentage / 100). For 5%: arctan(0.05) = 2.86°. For 10%: arctan(0.10) = 5.71°. For 100%: arctan(1.0) = 45°. Use a calculator or our tool for instant conversion.'],
    ],
    workedExample: [
      'Worked example: 10m drainage pipe at 1:80 gradient',
      'Gradient = 1:80 = 1.25%',
      'Angle = arctan(1/80) = 0.72°',
      'Total drop over 10m: 10 × (1/80) = 0.125m = 125mm',
      'Pipe length on slope: sqrt(10² + 0.125²) ≈ 10.001m (negligible difference)',
      'At 1:80, a 10m pipe drops 125mm from start to finish',
    ],
    assumptions: [
      'Slope calculations assume a constant gradient. Variable terrain requires section-by-section calculation.',
      'Drainage gradients are UK building regulation minimums. Local water authority may require steeper falls.',
      'Ramp gradients follow UK Building Regulations Part M. Other countries have different requirements.',
      'All calculations assume straight-line slope. Curved or benched slopes need professional surveying.',
    ],
    whenToAskPro: 'For drainage connections to public sewers, soakaway design, and any slope stability concerns (retaining walls over 1m, embankments, or sloped building sites), consult a civil engineer or drainage specialist. Building control approval is required for drainage works.',
  },
  {
    slug: 'free-pipe-slope-calculator',
    name: 'Pipe Slope Calculator',
    mTitle: 'Free Pipe Slope Calculator - Drainage Fall & Gradient | QuoteCore+',
    mDesc: 'Calculate pipe slope, fall, and gradient for drainage systems. Enter pipe length and required fall for instant results. No signup required.',
    ogTitle: 'Free Pipe Slope Calculator',
    ogDesc: 'Calculate drainage pipe slope, fall, and gradient. Free, no signup.',
    h1: 'Pipe Slope Calculator',
    hero: 'Calculate the correct slope and fall for drainage pipes. Enter pipe length and gradient ratio to get the required drop, or calculate gradient from known fall.',
    tipsH: 'Pipe slope calculation tips',
    defaultTab: 'gradient',
    tips: [
      ['Minimum pipe gradients by size', '100mm foul drain: 1:40 minimum (1.5°). 150mm foul drain: 1:60 minimum. 225mm sewer: 1:90 minimum. Surface water 100mm: 1:80 minimum. Always check local building control and water authority requirements.'],
      ['Self-cleansing velocity', 'Drainage pipes need a minimum flow velocity of 0.75 m/s to prevent solids settling. At 1:40 on a 100mm pipe, flow velocity is approximately 1.0 m/s. Too steep (over 1:10) causes liquids to run away from solids.'],
      ['Pipe material and gradient', 'Clay and PVC pipes have different friction coefficients. PVC is smoother and can achieve self-cleansing velocity at slightly shallower gradients. Always use the manufacturer\'s flow data for critical drainage design.'],
      ['Access points on long runs', 'Building regulations require access points (rodding eyes, inspection chambers) at every change of direction, every 15m on straight runs for 100mm pipes, and every 30m for 150mm+ pipes. Plan access points before setting gradients.'],
    ],
    formulas: [
      ['Fall from gradient', 'fall = pipe_length × (1 / ratio)'],
      ['Gradient from fall', 'ratio = 1 : (pipe_length / fall)'],
      ['Percentage gradient', 'slope% = (fall / pipe_length) × 100'],
      ['Angle', 'angle = arctan(fall / pipe_length)'],
    ],
    faqs: [
      ['What is the minimum slope for a 100mm drainage pipe?', 'UK Building Regulations: 1:40 (2.5%) for 100mm foul drains, 1:80 (1.25%) for 100mm surface water. Check local water authority for specific requirements - some require steeper gradients.'],
      ['How much fall do I need on a 15m drain at 1:40?', 'Fall = 15 × (1/40) = 0.375m = 375mm. The inlet needs to be 375mm higher than the outlet. At 1:80 (surface water): 15 × (1/80) = 187.5mm fall.'],
      ['What happens if a drain slope is too steep?', 'If the gradient exceeds about 1:10 (10%), liquids flow too fast and leave solids behind, causing blockages. The ideal range is 1:40 to 1:80 for most domestic drains. For steep sites, use drop chambers to maintain proper gradient between sections.'],
      ['Can I use this for sewer lateral calculations?', 'Yes, but sewer connections must comply with local water authority specifications. Typical lateral gradients are 1:40 to 1:80 for 100-150mm pipes. Always get water company approval before connecting to a public sewer.'],
    ],
    workedExample: [
      'Worked example: 12m of 100mm foul drain at 1:40 gradient',
      'Gradient ratio: 1:40 = 2.5%',
      'Angle: arctan(1/40) = 1.43°',
      'Total fall: 12 × (1/40) = 0.3m = 300mm',
      'Invert level at start: 300mm higher than at outlet',
      'Flow velocity ≈ 1.0 m/s (adequate self-cleansing)',
      'Access point needed at mid-point (12m > 15m limit is fine, but add one if there\'s a bend)',
    ],
    assumptions: [
      'Minimum gradients follow UK Building Regulations Approved Document H. Local water authority may require different gradients.',
      'Self-cleansing velocity of 0.75 m/s assumed for flow calculations. Actual velocity depends on pipe material, roughness, and flow rate.',
      'Calculations assume uniform gradient along the pipe run. Changes in gradient require access points.',
      'Pipe diameter must be specified by a drainage designer based on expected flow rates.',
    ],
    whenToAskPro: 'Drainage design for new builds, connections to public sewers, and any drainage works within 3m of a building require building control approval. For complex drainage systems, shared drains, or sites with high water tables, consult a drainage engineer.',
  },
];

export const SLOPE_SLUG_CONFIGS = SLOPE_SLUGS.map(toConfig);

export function getSlopeSlugConfig(slug: string): TradeConfig | undefined {
  return SLOPE_SLUG_CONFIGS.find(c => c.slug === slug);
}
