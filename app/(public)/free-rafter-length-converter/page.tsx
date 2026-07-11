import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-rafter-length-converter');

export default function Page() {
  return <TradePage config={config} />;
}
