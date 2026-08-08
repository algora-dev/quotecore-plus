import { TradePage, getRoofingPageConfig } from '../free-calculators/_shared/roofingSlugPage';
import Link from 'next/link';

const config = getRoofingPageConfig('free-roofing-takeoff-calculator');

export default function Page() {
  return (
    <>
      <TradePage config={config} />
      <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Related guides</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/blog/how-to-do-a-roof-takeoff" className="text-[#BD4A1A] hover:underline">How to Do a Roof Takeoff</Link> — complete takeoff method guide</li>
          <li><Link href="/blog/how-to-measure-a-roof" className="text-[#BD4A1A] hover:underline">How to Measure a Roof</Link> — measurement methods including digital takeoff</li>
          <li><Link href="/blog/roofing-material-list" className="text-[#BD4A1A] hover:underline">Roofing Material List: What You Need and Why</Link> — material categories and quantities</li>
        </ul>
      </section>
    </>
  );
}
