import type { ReactNode } from 'react';
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { concreteConfig } from '../free-calculators/configs/concrete';

export const metadata = buildTradeMetadata(concreteConfig);

export default function ConcreteCalculatorLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={concreteConfig}>{children}</TradeLayoutShell>;
}
