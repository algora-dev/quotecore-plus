import type { ReactNode } from 'react';
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { birdsmouthConfig } from '../free-calculators/configs/birdsmouth';

export const metadata = buildTradeMetadata(birdsmouthConfig);

export default function BirdsmouthCalculatorLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={birdsmouthConfig}>{children}</TradeLayoutShell>;
}
