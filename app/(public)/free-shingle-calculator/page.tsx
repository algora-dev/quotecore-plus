import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-shingle-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
