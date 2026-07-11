import type { TradeConfig } from '../_shared/types';
import { roofingConfig } from './roofing';
import { constructionConfig } from './construction';
import { landscapingConfig } from './landscaping';
import { concreteConfig } from './concrete';

/**
 * Every live trade calculator. Order = display order on the hub page.
 * Adding a new trade: create its config + layout/page pair, then add it here
 * (hub page and sitemap pick it up automatically).
 */
export const TRADE_CALCULATORS: TradeConfig[] = [
  roofingConfig,
  constructionConfig,
  concreteConfig,
  landscapingConfig,
];

/** Short blurbs for the hub page cards. */
export const HUB_BLURBS: Record<string, string> = {
  'free-roofing-calculator': 'Roof pitch, rafter and hip/valley lengths, surface area, and roofing material quantities.',
  'free-construction-calculator': 'Floor and wall areas, timber and stud lengths, material quantities, and cutting angles.',
  'free-concrete-calculator': 'Slab and footing volumes with depth presets, formwork areas, falls, and ready-mix pricing.',
  'free-landscaping-calculator': 'Garden and lawn areas, turf and topsoil quantities, slopes, gradients, and falls.',
};
