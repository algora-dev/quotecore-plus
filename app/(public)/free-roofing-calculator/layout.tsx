import type { ReactNode } from 'react';
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { roofingConfig } from '../free-calculators/configs/roofing';

export const metadata = buildTradeMetadata(roofingConfig);

export default function RoofingCalculatorLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={roofingConfig}>{children}</TradeLayoutShell>;
}
