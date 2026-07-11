import type { TradeConfig } from '../_shared/types';
import { toConfig, SLUGS_1 } from './roofingSlugs1';
import { SLUGS_2 } from './roofingSlugs2';
import { SLUGS_3 } from './roofingSlugs3';
import { SLUGS_4 } from './roofingSlugs4';

/**
 * All roofing SEO slug configs combined.
 * Each produces a unique page at /free-<slug> using the same roofing
 * calculator engine but with unique SEO copy.
 */

const ALL_SLUG_DEFS = [...SLUGS_1, ...SLUGS_2, ...SLUGS_3, ...SLUGS_4];

export const ROOFING_SLUG_CONFIGS: TradeConfig[] = ALL_SLUG_DEFS.map(toConfig);

export const ROOFING_SLUG_MAP: Map<string, TradeConfig> = new Map(
  ROOFING_SLUG_CONFIGS.map((c) => [c.slug, c]),
);

export const ROOFING_SLUGS: string[] = ALL_SLUG_DEFS.map((d) => d.slug);

/** Look up a roofing slug config by URL slug. Returns undefined if not found. */
export function getRoofingSlugConfig(slug: string): TradeConfig | undefined {
  return ROOFING_SLUG_MAP.get(slug);
}
