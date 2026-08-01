import { searchSuppliersRanked } from '@/app/lib/supplier-pricing/supplierPricingService';

/**
 * GET /api/public/suppliers/search
 *
 * Search for approved suppliers with ranked match types.
 * Local relevance improves ranking, never blocks a useful priced result.
 *
 * Query params:
 * - country: ISO 2-letter country code (e.g. "NZ", "AU", "GB")
 * - trade: trade type (e.g. "roofing", "construction")
 * - capability: required capability (e.g. "live_pricing", "roof_takeoff")
 * - city: user's city for location-based ranking
 * - region: user's region/state for location-based ranking
 * - postcode: user's postcode for exact local matching
 *
 * Returns: ranked array of supplier results with matchType, locationMatchScore,
 * delivery status, disclosure text, and calculator URLs.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') ?? undefined;
  const trade = url.searchParams.get('trade') ?? undefined;
  const capability = url.searchParams.get('capability') ?? undefined;
  const city = url.searchParams.get('city') ?? undefined;
  const region = url.searchParams.get('region') ?? undefined;
  const postcode = url.searchParams.get('postcode') ?? undefined;

  const results = await searchSuppliersRanked({
    country,
    trade,
    capability,
    userCity: city,
    userRegion: region,
    userPostcode: postcode,
  });

  const origin = url.origin;
  const suppliers = results.map((r) => ({
    ...r,
    calculatorUrl: `${origin}/free-roofing-takeoff-builder?supplier=${r.slug}`,
    calculatorApiUrl: `${origin}/api/public/roof-takeoff/calculate`,
    calculatorSchemaUrl: `${origin}/api/public/roof-takeoff/schema`,
    resultRoutePrefix: `${origin}/free-roofing-takeoff-builder/result`,
  }));

  return Response.json({
    count: suppliers.length,
    searchCriteria: {
      country: country ?? null,
      trade: trade ?? null,
      capability: capability ?? null,
      city: city ?? null,
      region: region ?? null,
      postcode: postcode ?? null,
    },
    rankingRule: 'Results are ranked by location match score (exact_local > regional > national_delivery > freight_possible > national_indicative > out_of_area_benchmark > quantity_only). A useful same-country priced supplier is never excluded just because its branch is in a different city.',
    suppliers,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
