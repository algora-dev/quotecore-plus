import { TradeLayoutShell, buildTradeMetadata, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-roof-pitch-calculator');

export const metadata = buildTradeMetadata(config);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TradeLayoutShell config={config}>{children}</TradeLayoutShell>;
}
