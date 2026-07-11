import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-roof-pitch-converter');

export default function Page() {
  return <TradePage config={config} />;
}
