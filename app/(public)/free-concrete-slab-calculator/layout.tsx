import { buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { getConcreteSlugConfig } from '../free-calculators/configs/concreteSlugs';

const config = getConcreteSlugConfig('free-concrete-slab-calculator')!;

export const metadata = buildTradeMetadata(config);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
