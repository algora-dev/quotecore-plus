import { TradePage } from '../free-calculators/_shared/TradePage';
import { getConcreteSlugConfig } from '../free-calculators/configs/concreteSlugs';

const config = getConcreteSlugConfig('free-footing-calculator')!;

export default function Page() {
  return <TradePage config={config} />;
}
