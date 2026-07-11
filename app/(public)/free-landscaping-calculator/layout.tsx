import type { ReactNode } from 'react';
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { landscapingConfig } from '../free-calculators/configs/landscaping';

export const metadata = buildTradeMetadata(landscapingConfig);

export default function LandscapingCalculatorLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={landscapingConfig}>{children}</TradeLayoutShell>;
}
