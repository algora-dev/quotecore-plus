import { buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { getSlopeSlugConfig } from '../free-calculators/configs/slopeSlugs';

const config = getSlopeSlugConfig('free-pipe-slope-calculator')!;

export const metadata = buildTradeMetadata(config);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
