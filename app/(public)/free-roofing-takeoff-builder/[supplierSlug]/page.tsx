import { RoofTakeoffBuilder } from '../RoofTakeoffBuilder';
import { listReadyTakeoffLibraries, loadPublishedTakeoffLibraryBySlug } from '@/app/lib/supplier-pricing/publishedTakeoffLibrary';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

/**
 * /free-roofing-takeoff-builder/[supplierSlug]
 *
 * Supplier-specific takeoff builder page.
 * Pre-selects the supplier's library and shows their branding/name.
 */


export async function generateMetadata({
  params,
}: {
  params: Promise<{ supplierSlug: string }>;
}): Promise<Metadata> {
  const { supplierSlug } = await params;
  const libraries = await listReadyTakeoffLibraries();
  const lib = libraries.find((l) => l.supplierSlug === supplierSlug);

  if (!lib) return { title: 'Supplier not found' };

  const title = `${lib.supplierName} Roof Takeoff Builder | QuoteCore+`;
  const description = lib.description
    ? `${lib.description} Free roof takeoff builder with ${lib.supplierName} pricing.`
    : `Free roof takeoff builder with ${lib.supplierName} component pricing. Calculate roof area, materials, and costs.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default async function SupplierTakeoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ supplierSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supplierSlug } = await params;
  const libraries = await listReadyTakeoffLibraries();
  const lib = libraries.find((l) => l.supplierSlug === supplierSlug);

  if (!lib) notFound();

  const supplied = await searchParams;
  const params_ = new URLSearchParams();
  for (const [key, value] of Object.entries(supplied)) {
    if (typeof value === 'string') params_.set(key, value);
    else if (Array.isArray(value)) params_.set(key, value.join(','));
  }

  // Parse initial input if query params present
  const { parseQueryInput } = await import('../public-contract');
  const initialInput = params_.size > 0 ? parseQueryInput(params_) : undefined;

  return (
    <>
      {/* Supplier header banner */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-4 md:py-6 text-center">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Powered by QuoteCore+</p>
          <h1 className="mt-1 text-lg md:text-2xl font-semibold tracking-tight text-slate-900">
            {lib.supplierName} Roof Takeoff Builder
          </h1>
          {lib.description && (
            <p className="mt-1 text-sm text-slate-500 max-w-2xl mx-auto">{lib.description}</p>
          )}
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            {lib.branchCity && (
              <span className="text-xs text-slate-400">
                {lib.branchCity}{lib.branchRegion ? `, ${lib.branchRegion}` : ''}
              </span>
            )}
            {lib.country && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{lib.country}</span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{lib.currency}</span>
            {lib.instantPricingAvailable && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">Live pricing</span>
            )}
          </div>
        </div>
      </section>

      <RoofTakeoffBuilder
        initialInput={initialInput}
        initialSupplierSlug={supplierSlug}
        embed
      />

      {/* SEO content for supplier page */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-sm font-semibold text-slate-700">
            About {lib.supplierName} roofing components
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This free roof takeoff builder uses component pricing from {lib.supplierName}.
            Calculate roof area, ridge, hip, valley, barge, spouting, underlay, and fixings quantities
            with {lib.currency} pricing. Prices are indicative - contact {lib.supplierName} for a formal quote.
          </p>
          {lib.enquiriesEnabled && (
            <p className="mt-2 text-xs text-green-600 font-medium">
              You can send your takeoff results directly to {lib.supplierName} from this tool.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
