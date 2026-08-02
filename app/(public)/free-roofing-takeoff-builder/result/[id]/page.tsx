import Link from 'next/link';
import { notFound } from 'next/navigation';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery, type PublicTakeoffResult, type SupplierSlotMap } from '../../public-contract';
import { verifyResultToken, buildResultUrl } from '../../result-token';
import { BUILT_IN_ORDER, COMPONENT_DEFS } from '../../calc';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from '../../public-contract';
import { getSupplierBySlug, getSupplierDefaultComponents, autoResolveSupplier } from '@/app/lib/supplier-pricing/supplierPricingService';

export const dynamic = 'force-dynamic';

interface ResultPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Roof Takeoff Result | QuoteCore+',
  robots: { index: false, follow: true },
};

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

export default async function StableResultPage({ params }: ResultPageProps) {
  const { id: token } = await params;
  const payload = verifyResultToken(token);
  if (!payload) notFound();

  // Reconstruct the input from the canonical query string stored in the token
  const searchParams = new URLSearchParams(payload.q);
  const input = parseQueryInput(searchParams);

  // Load supplier pricing - auto-resolve best supplier if none specified
  let components: Awaited<ReturnType<typeof getSupplierDefaultComponents>>['components'] = [];
  let slotMap: SupplierSlotMap = {};
  let supplierProfile: Awaited<ReturnType<typeof getSupplierBySlug>> = null;
  let autoResolved = false;

  if (input.supplier) {
    supplierProfile = await getSupplierBySlug(input.supplier);
    if (supplierProfile) {
      const result = await getSupplierDefaultComponents(supplierProfile.id);
      components = result.components;
      for (const comp of components) {
        const slot = (comp as any).takeoff_slot;
        if (slot) {
          slotMap[slot] = {
            componentId: comp.id,
            componentName: comp.name,
            componentSku: (comp as any).sku ?? null,
            unitPrice: comp.price_per_unit,
          };
        }
      }
    }
  } else {
    // Auto-resolve best supplier with live pricing
    const resolved = await autoResolveSupplier();
    if (resolved) {
      supplierProfile = resolved.profile;
      components = resolved.components;
      autoResolved = true;
      for (const comp of components) {
        const slot = (comp as any).takeoff_slot;
        if (slot) {
          slotMap[slot] = {
            componentId: comp.id,
            componentName: comp.name,
            componentSku: (comp as any).sku ?? null,
            unitPrice: comp.price_per_unit,
          };
        }
      }
    }
  }

  const result = calculatePublicRoofTakeoff(input, components, slotMap);
  if (!result.success) notFound();

  // Attach pricing provenance to result for display
  if (supplierProfile) {
    result.pricing = {
      supplierId: supplierProfile.id,
      supplierName: supplierProfile.supplier_name,
      country: supplierProfile.country,
      currency: supplierProfile.currency,
      taxTreatment: supplierProfile.tax_treatment,
      priceType: supplierProfile.price_type,
      pricingUpdatedAt: supplierProfile.pricing_updated_at,
      priceValidUntil: supplierProfile.price_valid_until,
      deliveryAssumptions: supplierProfile.delivery_assumptions,
      exclusions: supplierProfile.exclusions,
      estimateStatus: supplierProfile.instant_pricing_available ? 'indicative' : 'unavailable',
    };
  }

  const populatedQuery = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const populatedBuilderUrl = `/free-roofing-takeoff-builder?${populatedQuery}`;
  const visibleComponents = Object.entries(result.results.components).filter(([, component]) => component.count > 0);

  // Canonical result URL (this page)
  const canonicalResultUrl = buildResultUrl(token);

  // Supplied inputs display
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

  // Normalized values
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

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QuoteCore+ Free Roof Takeoff Builder',
    applicationCategory: 'ConstructionApplication',
    calculationVersion: ROOF_TAKEOFF_CALCULATION_VERSION,
    mode: result.mode,
    units: result.units,
    pitchDegrees: result.pitchDegrees,
    inputs: {
      mode: result.mode,
      units: result.units,
      pitchDegrees: result.pitchDegrees,
      area: input.area ?? input.roofArea ?? null,
      hips: input.hips ?? null,
      ridges: input.ridges ?? input.ridge ?? null,
      valleys: input.valleys ?? null,
      barges: input.barges ?? null,
      spouting: input.spouting ?? input.gutters ?? input.gutter ?? null,
      underlay: input.underlay ?? null,
      fixings: input.fixings ?? null,
    },
    outputs: {
      components: Object.fromEntries(
        visibleComponents.map(([key, c]) => [key, {
          label: c.label,
          rawTotal: c.rawTotal,
          withWaste: c.withWaste,
          wastePercent: c.wastePercent,
          count: c.count,
          unit: c.unit,
          materialCost: c.materialCost,
          labourCost: c.labourCost,
          totalCost: c.totalCost,
        }])
      ),
      totalEntries: result.results.totalEntries,
      materialTotal: result.results.materialTotal,
      labourTotal: result.results.labourTotal,
      grandTotal: result.results.grandTotal,
    },
    warnings: result.warnings,
    summary,
    resultUrl: canonicalResultUrl,
    calculationUrl: `/free-roofing-takeoff-builder/calculate?${populatedQuery}`,
    editUrl: populatedBuilderUrl,
    calculator: 'QuoteCore+ Free Roof Takeoff Builder',
    calculationTimestamp: result.timestamp,
    pricing: result.pricing ?? null,
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">QuoteCore+ Free Tool</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Roof Takeoff Result</h1>
          <p className="mt-2 text-sm text-slate-500">
            {result.mode === 'actual' ? 'Actual final measurements' : 'Plan measurements adjusted for pitch'} - {result.units} - {result.pitchDegrees} pitch - calculation v{ROOF_TAKEOFF_CALCULATION_VERSION}
          </p>
          {/* Canonical result URL - visible for easy copying by AI agents */}
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">Result URL (copy exactly, do not modify):</p>
            <code className="block mt-1 text-xs text-slate-700 break-all">{canonicalResultUrl}</code>
          </div>
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
                <dt className="text-sm font-medium text-slate-700">
                  {component.label}
                  {component.componentName && (
                    <span className="block text-xs text-slate-400">{component.componentName}{component.componentSku ? ` - SKU: ${component.componentSku}` : ''}</span>
                  )}
                </dt>
                <dd className="text-right text-sm font-semibold text-slate-900">
                  {component.rawTotal.toFixed(2)} {component.unit}
                  {component.wastePercent > 0 && <span className="block text-xs font-normal text-slate-400">With {component.wastePercent}% waste: {component.withWaste.toFixed(2)} {component.unit}</span>}
                  {component.materialCost > 0 && (
                    <span className="block text-xs font-normal text-slate-500">
                      {component.componentName ? `${component.materialCost.toFixed(2)} ${result.pricing?.currency ?? ''}` : ''}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {result.results.grandTotal > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Materials: {result.results.materialTotal.toFixed(2)} {result.pricing?.currency}</p>
              <p className="text-sm text-slate-600">Labour: {result.results.labourTotal.toFixed(2)} {result.pricing?.currency}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Total: {result.results.grandTotal.toFixed(2)} {result.pricing?.currency}</p>
              {result.pricing?.taxTreatment && (
                <p className="mt-1 text-xs text-slate-400">Prices are {result.pricing.taxTreatment} of tax</p>
              )}
            </div>
          )}
        </section>

        {/* Pricing provenance */}
        {result.pricing && (
          <section aria-labelledby="pricing-provenance" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
            <h2 id="pricing-provenance" className="text-sm font-semibold text-blue-900">Pricing provenance</h2>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <dt className="text-blue-700">Supplier</dt>
                <dd className="text-blue-900">{result.pricing.supplierName}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-blue-700">Currency</dt>
                <dd className="text-blue-900">{result.pricing.currency} ({result.pricing.taxTreatment} tax)</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-blue-700">Price type</dt>
                <dd className="text-blue-900">{result.pricing.priceType}</dd>
              </div>
              {result.pricing.pricingUpdatedAt && (
                <div className="flex justify-between text-xs">
                  <dt className="text-blue-700">Pricing updated</dt>
                  <dd className="text-blue-900">{new Date(result.pricing.pricingUpdatedAt).toLocaleDateString()}</dd>
                </div>
              )}
              {result.pricing.priceValidUntil && (
                <div className="flex justify-between text-xs">
                  <dt className="text-blue-700">Valid until</dt>
                  <dd className="text-blue-900">{new Date(result.pricing.priceValidUntil).toLocaleDateString()}</dd>
                </div>
              )}
              {result.pricing.deliveryAssumptions && (
                <div className="flex justify-between text-xs">
                  <dt className="text-blue-700">Delivery</dt>
                  <dd className="text-blue-900">{result.pricing.deliveryAssumptions}</dd>
                </div>
              )}
              {result.pricing.exclusions && (
                <div className="flex justify-between text-xs">
                  <dt className="text-blue-700">Exclusions</dt>
                  <dd className="text-blue-900">{result.pricing.exclusions}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-xs text-blue-600">
              This is an {result.pricing.estimateStatus} price based on current supplier catalogue data. Verify with the supplier before ordering.
            </p>
          </section>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <section aria-labelledby="takeoff-warnings" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h2 id="takeoff-warnings" className="text-sm font-semibold text-amber-800">Notes</h2>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
              {result.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
            </ul>
          </section>
        )}

        {/* Plain-language summary */}
        <section aria-labelledby="result-summary" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h2 id="result-summary" className="text-sm font-semibold text-slate-700">Summary</h2>
          <p className="mt-2 text-sm text-slate-600">{summary}</p>
        </section>

        {/* Machine-readable result URL for AI agents */}
        <section aria-labelledby="result-url" className="mt-4">
          <h2 id="result-url" className="sr-only">Canonical result URL</h2>
          <p className="text-xs text-slate-400" data-result-url={canonicalResultUrl}>
            Canonical result URL: {canonicalResultUrl}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Return this URL exactly as shown. Do not reconstruct, re-encode, shorten, or add tracking parameters.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={populatedBuilderUrl} className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
            Edit this calculation
          </Link>
          <Link href="/free-roofing-takeoff-builder" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Start a new takeoff
          </Link>
          <Link href="/docs/roof-takeoff-calculate" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            GET calculation docs
          </Link>
        </div>
      </article>
    </main>
  );
}
