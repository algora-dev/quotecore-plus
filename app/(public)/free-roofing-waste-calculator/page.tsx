import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-roofing-waste-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
