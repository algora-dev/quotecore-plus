import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-smart-component-creator');

export default function Page() {
  return <TradePage config={config} />;
}
