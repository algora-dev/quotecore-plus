import Link from 'next/link';
import { notFound } from 'next/navigation';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery, type PublicTakeoffResult } from '../public-contract';
import { BUILT_IN_ORDER, COMPONENT_DEFS } from '../calc';

export const dynamic = 'force-dynamic';

interface CalculatePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: 'Roof Takeoff Result | QuoteCore+',
  robots: { index: false, follow: true },
};

function formatValue(value: number, units: string): string {
  return `${value.toFixed(2)} ${units}`;
}

function plainLanguageSummary(result: PublicTakeoffResult): string {
  const parts: string[] = [];
  const modeLabel = result.mode === 'actual' ? 'actual final measurements' : 'plan measurements adjusted for pitch';
  parts.push(`This roof takeoff was calculated using ${modeLabel} in ${result.units} units at ${result.pitchDegrees} degrees pitch.`);

  const visibleComponents = Object.entries(result.results.components).filter(([, c]) => c.count > 0);
  if (visibleComponents.length === 0) {
    parts.push('No measurements were supplied, so no takeoff components were calculated.');
    return parts.join(' ');
  }

  const componentSummaries = visibleComponents.map(([, c]) => {
    const wasteNote = c.wastePercent > 0 ? ` (including ${c.wastePercent}% waste: ${c.withWaste.toFixed(2)} ${c.unit})` : '';
    return `${c.label}: ${c.rawTotal.toFixed(2)} ${c.unit}${wasteNote}`;
  });
  parts.push(`The takeoff includes: ${componentSummaries.join('; ')}.`);

  if (result.warnings.includes('pricing_unavailable')) {
    parts.push('No published catalogue pricing was available, so material and labour costs are not shown.');
  } else if (result.results.grandTotal > 0) {
    parts.push(`Estimated total cost: ${result.results.grandTotal.toFixed(2)} (materials ${result.results.materialTotal.toFixed(2)}, labour ${result.results.labourTotal.toFixed(2)}).`);
  }

  return parts.join(' ');
}

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

  // Build supplied inputs display
  const suppliedItems: Array<{ label: string; value: string }> = [];
  suppliedItems.push({ label: 'Mode', value: result.mode === 'actual' ? 'Actual (final measurements)' : 'Plan (adjusted for pitch)' });
  suppliedItems.push({ label: 'Units', value: result.units });
  suppliedItems.push({ label: 'Pitch', value: `${result.pitchDegrees} degrees` });
  if (input.area ?? input.roofArea) suppliedItems.push({ label: 'Roof Area', value: `${(input.area ?? input.roofArea)!.toFixed(2)}` });
  if (input.hips?.length) suppliedItems.push({ label: 'Hips', value: input.hips.map(h => typeof h === 'number' ? `${h}m` : `${h?.length ?? 0}m`).join(', ') });
  const ridgeInput = input.ridges ?? (input.ridge ? (Array.isArray(input.ridge) ? input.ridge : [input.ridge]) : []);
  if (ridgeInput.length) suppliedItems.push({ label: 'Ridges', value: ridgeInput.map(r => typeof r === 'number' ? `${r}m` : `${r?.length ?? 0}m`).join(', ') });
  if (input.valleys?.length) suppliedItems.push({ label: 'Valleys', value: input.valleys.map(v => typeof v === 'number' ? `${v}m` : `${v?.length ?? 0}m`).join(', ') });
  if (input.barges?.length) suppliedItems.push({ label: 'Barges', value: input.barges.map(b => typeof b === 'number' ? `${b}m` : `${b?.length ?? 0}m`).join(', ') });
  const spouting = input.spouting ?? input.gutters ?? input.gutter;
  if (spouting) {
    const spoutingArr = Array.isArray(spouting) ? spouting : [spouting];
    if (spoutingArr.length) suppliedItems.push({ label: 'Spouting/Gutter', value: spoutingArr.map(s => typeof s === 'number' ? `${s}m` : `${s?.length ?? 0}m`).join(', ') });
  }
  if (input.underlay) suppliedItems.push({ label: 'Underlay', value: `${input.underlay}` });
  if (input.fixings) suppliedItems.push({ label: 'Fixings', value: `${input.fixings}` });

  // Normalized values from the calculation
  const normalizedValues = result.normalizedInputs as { values: Record<string, number[]>; wastePercent: Record<string, number> };
  const normalizedItems: Array<{ label: string; value: string }> = [];
  for (const kind of BUILT_IN_ORDER) {
    const vals = normalizedValues.values[kind];
    if (vals && vals.length > 0) {
      const def = COMPONENT_DEFS[kind];
      const unit = kind === 'roof_area' || kind === 'underlay' || kind === 'fixings'
        ? (result.units === 'metric' ? 'm2' : result.units === 'imperial' ? 'sq ft' : 'squares')
        : result.units === 'metric' ? 'm' : 'ft';
      const total = vals.reduce((a, b) => a + b, 0);
      normalizedItems.push({
        label: def.label,
        value: `${vals.length} entr${vals.length === 1 ? 'y' : 'ies'}, total ${total.toFixed(2)} ${unit}, waste ${normalizedValues.wastePercent[kind] ?? 0}%`,
      });
    }
  }

  const summary = plainLanguageSummary(result);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">QuoteCore+ Free Tool</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Roof Takeoff Result</h1>
          <p className="mt-2 text-sm text-slate-500">
            {result.mode === 'actual' ? 'Actual final measurements' : 'Plan measurements adjusted for pitch'} - {result.units} - {result.pitchDegrees} pitch
          </p>
        </header>

        {/* Supplied inputs */}
        <section aria-labelledby="supplied-inputs" className="py-6">
          <h2 id="supplied-inputs" className="text-lg font-semibold text-slate-900">Supplied inputs</h2>
          <dl className="mt-4 space-y-2">
            {suppliedItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between border-b border-slate-100 pb-2">
                <dt className="text-sm font-medium text-slate-600">{item.label}</dt>
                <dd className="text-right text-sm text-slate-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Normalized values */}
        {normalizedItems.length > 0 && (
          <section aria-labelledby="normalized-values" className="py-6">
            <h2 id="normalized-values" className="text-lg font-semibold text-slate-900">Normalized values</h2>
            <p className="mt-1 text-xs text-slate-500">How the supplied inputs were parsed and normalized before calculation.</p>
            <dl className="mt-4 space-y-2">
              {normalizedItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between border-b border-slate-100 pb-2">
                  <dt className="text-sm font-medium text-slate-600">{item.label}</dt>
                  <dd className="text-right text-sm text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Takeoff results */}
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
          {result.results.grandTotal > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Materials: {result.results.materialTotal.toFixed(2)}</p>
              <p className="text-sm text-slate-600">Labour: {result.results.labourTotal.toFixed(2)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Total: {result.results.grandTotal.toFixed(2)}</p>
            </div>
          )}
        </section>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <section aria-labelledby="takeoff-warnings" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h2 id="takeoff-warnings" className="text-sm font-semibold text-amber-800">Notes</h2>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
              {result.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
            </ul>
          </section>
        )}

        {/* Plain-language summary for crawlers and screen readers */}
        <section aria-labelledby="result-summary" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h2 id="result-summary" className="text-sm font-semibold text-slate-700">Summary</h2>
          <p className="mt-2 text-sm text-slate-600">{summary}</p>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={populatedBuilderUrl} className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
            Edit in Roof Takeoff Builder
          </Link>
          <Link href="/free-roofing-takeoff-builder" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Start a new takeoff
          </Link>
          <Link href="/docs/roof-takeoff-api" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            API documentation
          </Link>
          <Link href="/docs/roof-takeoff-calculate" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            GET calculation docs
          </Link>
        </div>
      </article>
    </main>
  );
}
