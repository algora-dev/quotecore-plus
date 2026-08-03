import { searchSuppliersRanked } from '@/app/lib/supplier-pricing/supplierPricingService';
import { listReadyTakeoffLibraries } from '@/app/lib/supplier-pricing/publishedTakeoffLibrary';
import { determineMatchType } from '@/app/lib/supplier-pricing/supplierPricingService';

/**
 * GET /api/public/suppliers/search
 *
 * Search for approved suppliers with ranked match types.
 * Local relevance improves ranking, never blocks a useful priced result.
 *
 * Query params (V1 - backwards compatible):
 * - country: ISO 2-letter country code (e.g. "NZ", "AU", "GB")
 * - trade: trade type (e.g. "roofing", "construction")
 * - capability: required capability (e.g. "live_pricing", "roof_takeoff")
 * - city: user's city for location-based ranking
 * - region: user's region/state for location-based ranking
 * - postcode: user's postcode for exact local matching
 *
 * Query params (V2 - collection-aware, additive):
 * - q: free-text search across supplier name, description, keywords
 * - roofingType: filter by roofing type (e.g. "residential", "commercial")
 * - productCategory: filter by product category
 * - brand: filter by brand
 * - page: pagination page (default 1)
 * - limit: results per page (default 20, max 50)
 *
 * Returns: ranked array of supplier results with matchType, locationMatchScore,
 * delivery status, disclosure text, calculator URLs, and collection metadata.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') ?? undefined;
  const trade = url.searchParams.get('trade') ?? undefined;
  const capability = url.searchParams.get('capability') ?? undefined;
  const city = url.searchParams.get('city') ?? undefined;
  const region = url.searchParams.get('region') ?? undefined;
  const postcode = url.searchParams.get('postcode') ?? undefined;

  // V2 params
  const q = url.searchParams.get('q') ?? undefined;
  const roofingType = url.searchParams.get('roofingType') ?? undefined;
  const productCategory = url.searchParams.get('productCategory') ?? undefined;
  const brand = url.searchParams.get('brand') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  // If V2 params are present, use collection-aware search
  const useV2 = q || roofingType || productCategory || brand;

  if (useV2) {
    const libraries = await listReadyTakeoffLibraries();
    let filtered = libraries;

    // Free-text search
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter((lib) => {
        const searchText = [
          lib.supplierName, lib.collectionName, lib.description,
          ...lib.keywords, ...lib.brands, ...lib.productCategories,
          ...lib.roofingTypes, ...lib.serviceAreas,
          lib.branchCity, lib.branchRegion,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchText.includes(qLower);
      });
    }

    // Roofing type filter
    if (roofingType) {
      const rtLower = roofingType.toLowerCase();
      filtered = filtered.filter((lib) =>
        lib.roofingTypes.some((t) => t.toLowerCase().includes(rtLower))
      );
    }

    // Product category filter
    if (productCategory) {
      const pcLower = productCategory.toLowerCase();
      filtered = filtered.filter((lib) =>
        lib.productCategories.some((c) => c.toLowerCase().includes(pcLower))
      );
    }

    // Brand filter
    if (brand) {
      const bLower = brand.toLowerCase();
      filtered = filtered.filter((lib) =>
        lib.brands.some((b) => b.toLowerCase().includes(bLower))
      );
    }

    // Country filter (improves ranking, doesn't block same-country priced results)
    if (country) {
      const cUpper = country.toUpperCase();
      filtered = filtered.filter((lib) =>
        lib.country?.toUpperCase() === cUpper ||
        lib.branchCountry?.toUpperCase() === cUpper
      );
    }

    // Apply location ranking
    const ranked = filtered.map((lib) => {
      const matchType = determineMatchType(
        {
          branch_city: lib.branchCity,
          branch_region: lib.branchRegion,
          branch_country: lib.branchCountry,
          country: lib.country,
          national_coverage: lib.nationalCoverage,
          delivery_coverage: lib.deliveryCoverage,
          local_service_areas: lib.serviceAreas,
          regional_coverage: [],
          branch_postcode: null,
          freight_available: false,
          pickup_available: false,
          excluded_delivery_regions: [],
          delivery_requires_confirmation: false,
          pricing_excludes_freight: true,
          out_of_area_pricing_allowed: true,
          instant_pricing_available: lib.instantPricingAvailable,
        } as any,
        { city, region, postcode, country: country?.toUpperCase() },
      );

      const scores: Record<string, number> = {
        exact_local: 100, regional: 80, national_delivery: 60,
        freight_possible: 45, national_indicative: 30,
        out_of_area_benchmark: 15, quantity_only: 5,
      };

      return { ...lib, matchType, locationMatchScore: scores[matchType] };
    });

    ranked.sort((a, b) => b.locationMatchScore - a.locationMatchScore);

    // Pagination
    const start = (page - 1) * limit;
    const paged = ranked.slice(start, start + limit);

    const suppliers = paged.map((lib) => ({
      supplierId: lib.supplierId,
      supplierName: lib.supplierName,
      slug: lib.supplierSlug,
      country: lib.country,
      currency: lib.currency,
      matchType: lib.matchType,
      locationMatchScore: lib.locationMatchScore,
      livePricingAvailable: lib.instantPricingAvailable,
      enquiriesEnabled: lib.enquiriesEnabled,
      collectionId: lib.collectionId,
      collectionName: lib.collectionName,
      publicSlug: lib.publicSlug,
      branchCity: lib.branchCity,
      branchRegion: lib.branchRegion,
      branchCountry: lib.branchCountry,
      deliveryCoverage: lib.deliveryCoverage,
      nationalCoverage: lib.nationalCoverage,
      description: lib.description,
      roofingTypes: lib.roofingTypes,
      productCategories: lib.productCategories,
      brands: lib.brands,
      calculatorUrl: `${url.origin}/free-roofing-takeoff-builder/${lib.supplierSlug}`,
      calculatorApiUrl: `${url.origin}/api/public/roof-takeoff/calculate`,
      calculatorSchemaUrl: `${url.origin}/api/public/roof-takeoff/schema`,
      resultRoutePrefix: `${url.origin}/free-roofing-takeoff-builder/result`,
    }));

    return Response.json({
      count: suppliers.length,
      totalFound: ranked.length,
      page,
      limit,
      searchCriteria: {
        q: q ?? null, country: country ?? null, roofingType: roofingType ?? null,
        productCategory: productCategory ?? null, brand: brand ?? null,
        city: city ?? null, region: region ?? null, postcode: postcode ?? null,
      },
      rankingRule: 'Results are ranked by location match score. Collection-level metadata (brands, product categories, roofing types) is searched alongside supplier location data.',
      suppliers,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // V1 backwards-compatible path
  const results = await searchSuppliersRanked({
    country, trade, capability,
    userCity: city, userRegion: region, userPostcode: postcode,
  });

  const suppliers = results.map((r) => ({
    ...r,
    calculatorUrl: `${url.origin}/free-roofing-takeoff-builder?supplier=${r.slug}`,
    calculatorApiUrl: `${url.origin}/api/public/roof-takeoff/calculate`,
    calculatorSchemaUrl: `${url.origin}/api/public/roof-takeoff/schema`,
    resultRoutePrefix: `${url.origin}/free-roofing-takeoff-builder/result`,
  }));

  return Response.json({
    count: suppliers.length,
    searchCriteria: {
      country: country ?? null, trade: trade ?? null, capability: capability ?? null,
      city: city ?? null, region: region ?? null, postcode: postcode ?? null,
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
