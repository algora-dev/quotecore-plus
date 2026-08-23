import Link from 'next/link';
import DemoCTACard from '@/components/DemoCTACard';
import FreeQuoteBuilder from './FreeQuoteBuilder';

export default function Page() {
  return (
    <>
      <section className="sr-only" aria-labelledby="fqb-capabilities">
        <h2 id="fqb-capabilities">Free Quote Builder</h2>
        <p>Build smart components from your own price list or CSV catalog, enter your measurements, and get instant priced results. No plan upload or digital measuring required - ideal when you already have your measurements.</p>
        <h2>How it works</h2>
        <ul>
          <li>Add up to 7 components manually or import them from a CSV catalog with column mapping</li>
          <li>Each component carries material price, labour rate, waste percentage, pack pricing and pitch logic</li>
          <li>Create parent areas, add components and multiple measurement entries per area</li>
          <li>Choose actual measurements or plan measurements with automatic pitch factors</li>
          <li>Get a full priced report, then save to your QuoteCore+ account or continue in the free quote generator</li>
        </ul>
      </section>
      <FreeQuoteBuilder />
      <section className="border-t border-slate-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <DemoCTACard location="calc_free_quote_builder" variant="inline" />
        </div>
      </section>
      <section className="border-t border-slate-200 bg-white px-4 py-6">
        <p className="mx-auto max-w-5xl text-center text-sm text-slate-600">
          Measuring from a plan instead? Try the{' '}
          <Link href="/free-roofing-takeoff-builder" className="font-medium text-[#BD4A1A] hover:underline">Free Roof Takeoff Builder</Link>
          {' '}or the{' '}
          <Link href="/free-roofing-takeoff-calculator" className="font-medium text-[#BD4A1A] hover:underline">Free Roofing Takeoff Calculator</Link>.
        </p>
      </section>
    </>
  );
}
