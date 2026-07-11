import { TradePage } from '../free-calculators/_shared/TradePage';
import { getSlopeSlugConfig } from '../free-calculators/configs/slopeSlugs';

const config = getSlopeSlugConfig('free-slope-calculator')!;

export default function Page() {
  return <TradePage config={config} />;
}
