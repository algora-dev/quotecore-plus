import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-roof-replacement-cost-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
