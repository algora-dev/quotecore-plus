import { TradePage } from '../free-calculators/_shared/TradePage';
import { getConstructionSlugConfig } from '../free-calculators/configs/constructionSlugs';

const config = getConstructionSlugConfig('free-wall-area-calculator')!;

export default function Page() {
  return <TradePage config={config} />;
}
