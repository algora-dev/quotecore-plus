import { TradePage } from '../free-calculators/_shared/TradePage';
import { getConcreteSlugConfig } from '../free-calculators/configs/concreteSlugs';

const config = getConcreteSlugConfig('free-trench-calculator')!;

export default function Page() {
  return <TradePage config={config} />;
}
