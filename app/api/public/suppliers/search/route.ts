import { searchSuppliers } from '@/app/lib/supplier-pricing/supplierPricingService';

/**
 * GET /api/public/suppliers/search
 *
 * Search for approved suppliers with instant pricing capability.
 *
 * Query params:
 * - country: ISO 2-letter country code (e.g. "NZ", "AU", "GB")
 * - trade: trade type (e.g. "roofing", "construction")
 * - capability: required capability (e.g. "live_pricing", "roof_takeoff")
 *
 * Returns: array of supplier profiles with calculator URLs and endpoints.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') ?? undefined;
  const trade = url.searchParams.get('trade') ?? undefined;
  const capability = url.searchParams.get('capability') ?? undefined;

  const suppliers = await searchSuppliers({ country, trade, capability });

  const origin = url.origin;
  const results = suppliers.map((s) => ({
    supplierId: s.id,
    supplierName: s.supplier_name,
    slug: s.slug,
    country: s.country,
    currency: s.currency,
    taxTreatment: s.tax_treatment,
    defaultTrade: s.default_trade,
    instantPricingAvailable: s.instant_pricing_available,
    pricingUpdatedAt: s.pricing_updated_at,
    priceValidUntil: s.price_valid_until,
    priceType: s.price_type,
    deliveryAssumptions: s.delivery_assumptions,
    exclusions: s.exclusions,
    serviceAreas: s.service_areas,
    websiteUrl: s.website_url,
    description: s.description,
    calculatorUrl: `${origin}/free-roofing-takeoff-builder?supplier=${s.slug}`,
    calculatorApiUrl: `${origin}/api/public/roof-takeoff/calculate`,
    calculatorSchemaUrl: `${origin}/api/public/roof-takeoff/schema`,
    resultRoutePrefix: `${origin}/free-roofing-takeoff-builder/result`,
  }));

  return Response.json({
    count: results.length,
    suppliers: results,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
