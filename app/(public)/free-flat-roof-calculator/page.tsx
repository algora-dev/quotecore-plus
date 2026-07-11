import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-flat-roof-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
