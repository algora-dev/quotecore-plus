import Link from 'next/link';
import { notFound } from 'next/navigation';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery } from '../public-contract';

export const dynamic = 'force-dynamic';

interface CalculatePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: 'Roof Takeoff Result | QuoteCore+',
  robots: { index: false, follow: true },
};

export default async function CalculatePage({ searchParams }: CalculatePageProps) {
  const supplied = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(supplied)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(','));
  }
  const input = parseQueryInput(params);
  const result = calculatePublicRoofTakeoff(input);
  if (!result.success) notFound();

  const populatedQuery = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const populatedBuilderUrl = `/free-roofing-takeoff-builder?${populatedQuery}`;
  const visibleComponents = Object.entries(result.results.components).filter(([, component]) => component.count > 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">QuoteCore+ Free Tool</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Roof Takeoff Result</h1>
          <p className="mt-2 text-sm text-slate-500">
            {result.mode === 'actual' ? 'Actual final measurements' : 'Plan measurements adjusted for pitch'} · {result.units} · {result.pitchDegrees}° pitch
          </p>
        </header>

        <section aria-labelledby="takeoff-results" className="py-6">
          <h2 id="takeoff-results" className="text-lg font-semibold text-slate-900">Complete takeoff</h2>
          <dl className="mt-4 space-y-3">
            {visibleComponents.map(([key, component]) => (
              <div key={key} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <dt className="text-sm font-medium text-slate-700">{component.label}</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">
                  {component.rawTotal.toFixed(2)} {component.unit}
                  {component.wastePercent > 0 && <span className="block text-xs font-normal text-slate-400">With {component.wastePercent}% waste: {component.withWaste.toFixed(2)} {component.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {result.warnings.length > 0 && (
          <section aria-labelledby="takeoff-warnings" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h2 id="takeoff-warnings" className="text-sm font-semibold text-amber-800">Notes</h2>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
              {result.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
            </ul>
          </section>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={populatedBuilderUrl} className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
            Edit this calculation
          </Link>
          <Link href="/free-roofing-takeoff-builder" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Start a new takeoff
          </Link>
        </div>
      </article>
    </main>
  );
}
