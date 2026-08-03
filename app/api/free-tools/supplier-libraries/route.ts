import { NextResponse } from 'next/server';
import { listReadyTakeoffLibraries } from '@/app/lib/supplier-pricing/publishedTakeoffLibrary';

/**
 * GET /api/free-tools/supplier-libraries
 *
 * Returns all ready, published takeoff supplier libraries.
 * Used by the builder's supplier selection step.
 *
 * Optional query params:
 * - country: filter by country (ISO 2-letter)
 * - city: user's city for location display
 * - region: user's region for location display
 * - q: free-text search
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  try {
    const libraries = await listReadyTakeoffLibraries();
    let filtered = libraries;

    if (country) {
      const cUpper = country.toUpperCase();
      filtered = filtered.filter((lib) =>
        lib.country?.toUpperCase() === cUpper ||
        lib.branchCountry?.toUpperCase() === cUpper
      );
    }

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

    return NextResponse.json({
      count: filtered.length,
      libraries: filtered.map((lib) => ({
        supplierId: lib.supplierId,
        supplierName: lib.supplierName,
        supplierSlug: lib.supplierSlug,
        country: lib.country,
        currency: lib.currency,
        collectionId: lib.collectionId,
        collectionName: lib.collectionName,
        publicSlug: lib.publicSlug,
        branchCity: lib.branchCity,
        branchRegion: lib.branchRegion,
        branchCountry: lib.branchCountry,
        nationalCoverage: lib.nationalCoverage,
        instantPricingAvailable: lib.instantPricingAvailable,
        enquiriesEnabled: lib.enquiriesEnabled,
        description: lib.description,
        roofingTypes: lib.roofingTypes,
        productCategories: lib.productCategories,
        brands: lib.brands,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load supplier libraries' }, { status: 500 });
  }
}
