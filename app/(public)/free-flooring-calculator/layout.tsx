import { buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { getConstructionSlugConfig } from '../free-calculators/configs/constructionSlugs';

const config = getConstructionSlugConfig('free-flooring-calculator')!;

export const metadata = buildTradeMetadata(config);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
