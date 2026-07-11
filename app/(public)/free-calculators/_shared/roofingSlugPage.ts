import { TradeLayoutShell, buildTradeMetadata } from './TradeLayoutShell';
import { TradePage } from './TradePage';
import { getRoofingSlugConfig } from '../configs/roofingSlugRegistry';

export function getRoofingPageConfig(slug: string) {
  const config = getRoofingSlugConfig(slug);
  if (!config) throw new Error(`Unknown roofing slug: ${slug}`);
  return config;
}

export { TradeLayoutShell, buildTradeMetadata, TradePage };
