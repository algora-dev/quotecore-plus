import type { ReactNode } from 'react';
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { constructionConfig } from '../free-calculators/configs/construction';

export const metadata = buildTradeMetadata(constructionConfig);

export default function ConstructionCalculatorLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={constructionConfig}>{children}</TradeLayoutShell>;
}
