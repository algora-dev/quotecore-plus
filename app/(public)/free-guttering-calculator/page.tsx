import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';

const config = getRoofingPageConfig('free-guttering-calculator');

export default function Page() {
  return <TradePage config={config} />;
}
