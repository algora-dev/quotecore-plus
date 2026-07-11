import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-metal-roofing-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
