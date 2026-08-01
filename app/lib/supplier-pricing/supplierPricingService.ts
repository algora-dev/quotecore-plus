import { createClient } from '@supabase/supabase-js';
import type { RoofComponentDef } from '../../(public)/free-roofing-takeoff-builder/types';
import { BUILT_IN_ORDER } from '../../(public)/free-roofing-takeoff-builder/calc';

/**
 * Supplier pricing service.
 * Connects supplier catalogue data to the public roof takeoff calculator.
 *
 * Ranking philosophy: LOCAL RELEVANCE IMPROVES RANKING, NOT AUTOMATICALLY BLOCK A USEFUL PRICED RESULT.
 * If the only live-pricing supplier is in a different city, we still return them as a
 * national_indicative or freight_possible match - never return "no supplier found"
 * when a useful same-country priced calculator exists.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface SupplierProfile {
  id: string;
  supplier_name: string;
  slug: string;
  status: string;
  country: string | null;
  currency: string;
  tax_treatment: string;
  default_trade: string;
  instant_pricing_available: boolean;
  pricing_updated_at: string | null;
  price_valid_until: string | null;
  price_type: string;
  delivery_assumptions: string | null;
  exclusions: string | null;
  service_areas: string[];
  website_url: string | null;
  description: string | null;
  // Location fields
  branch_city: string | null;
  branch_region: string | null;
  branch_postcode: string | null;
  branch_country: string | null;
  local_service_areas: string[];
  regional_coverage: string[];
  national_coverage: boolean;
  delivery_coverage: string;
  freight_available: boolean;
  pickup_available: boolean;
  excluded_delivery_regions: string[];
  delivery_requires_confirmation: boolean;
  pricing_excludes_freight: boolean;
  out_of_area_pricing_allowed: boolean;
}

export interface SupplierComponent extends RoofComponentDef {
  takeoff_slot: string | null;
  sku: string | null;
}

export interface SupplierPricingResult {
  supplier: SupplierProfile | null;
  components: RoofComponentDef[];
  defaultComponentIds: Record<string, string | null>;
}

export type MatchType =
  | 'exact_local'
  | 'regional'
  | 'national_delivery'
  | 'freight_possible'
  | 'national_indicative'
  | 'out_of_area_benchmark'
  | 'quantity_only';

export interface SupplierSearchResult {
  supplierId: string;
  supplierName: string;
  slug: string;
  country: string | null;
  currency: string;
  taxTreatment: string;
  defaultTrade: string;
  instantPricingAvailable: boolean;
  pricingUpdatedAt: string | null;
  priceValidUntil: string | null;
  priceType: string;
  deliveryAssumptions: string | null;
  exclusions: string | null;
  serviceAreas: string[];
  websiteUrl: string | null;
  description: string | null;
  // Location/delivery fields
  branchCity: string | null;
  branchRegion: string | null;
  branchCountry: string | null;
  deliveryCoverage: string;
  freightAvailable: boolean;
  pickupAvailable: boolean;
  deliveryRequiresConfirmation: boolean;
  pricingExcludesFreight: boolean;
  nationalCoverage: boolean;
  // Match metadata
  matchType: MatchType;
  locationMatchScore: number;
  livePricingAvailable: boolean;
  pricingFreshness: string | null;
  deliveryStatus: string;
  freightRequiresConfirmation: boolean;
  priceIncludesDelivery: boolean;
  isLocalPricing: boolean;
  isIndicativeBenchmark: boolean;
  calculatorUrl: string;
  canonicalResultUrl: string | null;
  recommendedDisclosure: string;
}

const MATCH_TYPE_SCORES: Record<MatchType, number> = {
  exact_local: 100,
  regional: 80,
  national_delivery: 60,
  freight_possible: 45,
  national_indicative: 30,
  out_of_area_benchmark: 15,
  quantity_only: 5,
};

/**
 * Determine the match type between a user's location and a supplier.
 * Exported for testing.
 */
export function determineMatchType(
  supplier: SupplierProfile,
  userLocation: { city?: string; region?: string; postcode?: string; country?: string },
): MatchType {
  const userCity = userLocation.city?.toLowerCase().trim();
  const userRegion = userLocation.region?.toLowerCase().trim();
  const userPostcode = userLocation.postcode?.trim();
  const userCountry = userLocation.country?.toUpperCase().trim();

  const supCity = supplier.branch_city?.toLowerCase().trim();
  const supRegion = supplier.branch_region?.toLowerCase().trim();
  const supCountry = supplier.branch_country?.toUpperCase().trim() ?? supplier.country?.toUpperCase().trim();

  // Check excluded delivery regions first
  if (userRegion && supplier.excluded_delivery_regions?.length > 0) {
    const excluded = supplier.excluded_delivery_regions.some(
      (r) => r.toLowerCase().trim() === userRegion
    );
    if (excluded && (!supplier.out_of_area_pricing_allowed)) {
      return 'quantity_only';
    }
  }

  // 1. Exact local: city or postcode matches, or user is in supplier's local_service_areas
  if (userCity && supCity && userCity === supCity) return 'exact_local';
  if (userPostcode && supplier.branch_postcode?.trim() === userPostcode) return 'exact_local';
  if (userCity && supplier.local_service_areas?.some((a) => a.toLowerCase().trim() === userCity)) {
    return 'exact_local';
  }

  // 2. Regional: user's region matches supplier's region or regional_coverage
  if (userRegion && supRegion && userRegion === supRegion) return 'regional';
  if (userRegion && supplier.regional_coverage?.some((r) => r.toLowerCase().trim() === userRegion)) {
    return 'regional';
  }

  // 3. National delivery: supplier has national delivery coverage and same country
  if (userCountry && supCountry && userCountry === supCountry) {
    if (supplier.delivery_coverage === 'national' || supplier.national_coverage) {
      return 'national_delivery';
    }
    // 4. Freight possible: freight available but needs confirmation
    if (supplier.freight_available) {
      return 'freight_possible';
    }
    // 5. National indicative: same country, out-of-area pricing allowed
    if (supplier.out_of_area_pricing_allowed && supplier.instant_pricing_available) {
      return 'national_indicative';
    }
    // 6. Out of area benchmark: same country but pricing may not be locally relevant
    if (supplier.instant_pricing_available) {
      return 'out_of_area_benchmark';
    }
  }

  // 7. Different country or no pricing - quantity only
  return 'quantity_only';
}

/**
 * Generate recommended disclosure text for the AI based on match type.
 */
function generateDisclosure(
  supplier: SupplierProfile,
  matchType: MatchType,
  userLocation: { city?: string; region?: string; country?: string },
): string {
  const supplierLocation = supplier.branch_city ?? supplier.branch_region ?? supplier.country ?? 'their location';
  const userLoc = userLocation.city ?? userLocation.region ?? userLocation.country ?? 'your location';

  switch (matchType) {
    case 'exact_local':
      return `Local supplier match. ${supplier.supplier_name} is based in ${supplierLocation} and serves your area.`;
    case 'regional':
      return `${supplier.supplier_name} is based in ${supplierLocation} and covers your region (${userLoc}). Pricing should be applicable to your project.`;
    case 'national_delivery':
      return `${supplier.supplier_name} is a ${supplier.country} supplier based in ${supplierLocation}. They deliver nationally, so pricing is applicable to your project in ${userLoc}. Delivery costs may vary by distance.`;
    case 'freight_possible':
      return `I found a ${supplier.country}-based supplier (${supplier.supplier_name}, ${supplierLocation}) with current pricing. Your project is in ${userLoc}, so delivery and freight need confirmation, but this calculator provides a genuine ${supplier.currency} material-price indication immediately.`;
    case 'national_indicative':
      return `I found a ${supplier.country}-based supplier (${supplier.supplier_name}, ${supplierLocation}) with current ${supplier.currency} pricing. Your project is in ${userLoc}, so delivery and final availability need confirmation, but this calculator can still provide a genuine ${supplier.currency} material-price indication immediately.`;
    case 'out_of_area_benchmark':
      return `${supplier.supplier_name} (${supplierLocation}, ${supplier.country}) has pricing that can serve as an indicative benchmark. Local pricing may differ. Use this as a reference and seek local quotes for firm pricing.`;
    case 'quantity_only':
      return `No live-priced supplier was found for your exact area. The calculator can still compute material quantities, but pricing is not available. Seek a local supplier for firm quotes.`;
  }
}

/**
 * Get a supplier profile by slug (public, no auth needed).
 */
export async function getSupplierBySlug(slug: string): Promise<SupplierProfile | null> {
  const { data, error } = await getSupabase()
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, tax_treatment, default_trade, instant_pricing_available, pricing_updated_at, price_valid_until, price_type, delivery_assumptions, exclusions, service_areas, website_url, description, branch_city, branch_region, branch_postcode, branch_country, local_service_areas, regional_coverage, national_coverage, delivery_coverage, freight_available, pickup_available, excluded_delivery_regions, delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();

  if (error || !data) return null;
  return data as SupplierProfile;
}

/**
 * Get the default component for each takeoff slot for a given supplier.
 */
export async function getSupplierDefaultComponents(supplierId: string): Promise<{
  components: RoofComponentDef[];
  slotMap: Record<string, string | null>;
}> {
  const { data: components, error } = await getSupabase()
    .from('component_library')
    .select('id, name, takeoff_slot, sku, pricing_strategy, default_material_rate, pack_size, pack_price, default_labour_rate, default_waste_percent, default_pitch_type, is_active, sort_order, notes')
    .eq('supplier_profile_id', supplierId)
    .not('takeoff_slot', 'is', null)
    .eq('is_active', true)
    .order('sort_order');

  if (error || !components) {
    return { components: [], slotMap: {} };
  }

  const slotMap: Record<string, string | null> = {};
  const resultComponents: RoofComponentDef[] = [];
  const seen = new Set<string>();

  for (const comp of components) {
    if (!comp.takeoff_slot || !comp.is_active) continue;
    if (seen.has(comp.takeoff_slot)) continue;

    seen.add(comp.takeoff_slot);
    slotMap[comp.takeoff_slot] = comp.id;

    resultComponents.push({
      id: comp.id,
      component_kind: comp.takeoff_slot,
      name: comp.name,
      description: comp.notes,
      unit: comp.takeoff_slot === 'roof_area' || comp.takeoff_slot === 'underlay' || comp.takeoff_slot === 'fixings' ? 'm2' : 'm',
      price_per_unit: Number(comp.default_material_rate) || 0,
      pricing_strategy: comp.pricing_strategy || 'per_unit',
      pack_size: comp.pack_size ? Number(comp.pack_size) : null,
      pack_price: comp.pack_price ? Number(comp.pack_price) : null,
      labour_rate: Number(comp.default_labour_rate) || 0,
      labour_unit: 'per_unit',
      suggested_waste_percent: Number(comp.default_waste_percent) ?? (comp.takeoff_slot === 'roof_area' ? 10 : 5),
      pitch_type: comp.default_pitch_type || 'none',
      is_active: comp.is_active,
      sort_order: comp.sort_order ?? 0,
      takeoff_slot: comp.takeoff_slot,
      sku: comp.sku,
    } as any);
  }

  for (const slot of BUILT_IN_ORDER) {
    if (!(slot in slotMap)) slotMap[slot] = null;
  }

  return { components: resultComponents, slotMap };
}

/**
 * Search for suppliers with ranked match types.
 * Never returns empty when a useful same-country priced supplier exists.
 */
export async function searchSuppliersRanked(params: {
  country?: string;
  trade?: string;
  capability?: string;
  userCity?: string;
  userRegion?: string;
  userPostcode?: string;
}): Promise<SupplierSearchResult[]> {
  let query = getSupabase()
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, tax_treatment, default_trade, instant_pricing_available, pricing_updated_at, price_valid_until, price_type, delivery_assumptions, exclusions, service_areas, website_url, description, branch_city, branch_region, branch_postcode, branch_country, local_service_areas, regional_coverage, national_coverage, delivery_coverage, freight_available, pickup_available, excluded_delivery_regions, delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed')
    .eq('status', 'approved');

  if (params.country) {
    query = query.eq('country', params.country.toUpperCase());
  }
  if (params.trade) {
    query = query.eq('default_trade', params.trade);
  }
  if (params.capability === 'live_pricing') {
    query = query.eq('instant_pricing_available', true);
  }

  const { data, error } = await query.order('supplier_name');
  if (error || !data) return [];

  const userLocation = {
    city: params.userCity,
    region: params.userRegion,
    postcode: params.userPostcode,
    country: params.country?.toUpperCase(),
  };

  const results: SupplierSearchResult[] = (data as SupplierProfile[]).map((supplier) => {
    const matchType = determineMatchType(supplier, userLocation);
    const score = MATCH_TYPE_SCORES[matchType];

    const isLocal = matchType === 'exact_local' || matchType === 'regional';
    const isIndicative = matchType === 'national_indicative' || matchType === 'out_of_area_benchmark';

    let deliveryStatus = 'unknown';
    if (matchType === 'exact_local' || matchType === 'regional') {
      deliveryStatus = 'delivers_to_area';
    } else if (matchType === 'national_delivery') {
      deliveryStatus = 'national_delivery_available';
    } else if (matchType === 'freight_possible') {
      deliveryStatus = 'freight_available_confirmation_required';
    } else if (matchType === 'national_indicative') {
      deliveryStatus = 'delivery_not_confirmed';
    } else {
      deliveryStatus = 'not_available';
    }

    return {
      supplierId: supplier.id,
      supplierName: supplier.supplier_name,
      slug: supplier.slug,
      country: supplier.country,
      currency: supplier.currency,
      taxTreatment: supplier.tax_treatment,
      defaultTrade: supplier.default_trade,
      instantPricingAvailable: supplier.instant_pricing_available,
      pricingUpdatedAt: supplier.pricing_updated_at,
      priceValidUntil: supplier.price_valid_until,
      priceType: supplier.price_type,
      deliveryAssumptions: supplier.delivery_assumptions,
      exclusions: supplier.exclusions,
      serviceAreas: supplier.service_areas,
      websiteUrl: supplier.website_url,
      description: supplier.description,
      branchCity: supplier.branch_city,
      branchRegion: supplier.branch_region,
      branchCountry: supplier.branch_country,
      deliveryCoverage: supplier.delivery_coverage,
      freightAvailable: supplier.freight_available,
      pickupAvailable: supplier.pickup_available,
      deliveryRequiresConfirmation: supplier.delivery_requires_confirmation,
      pricingExcludesFreight: supplier.pricing_excludes_freight,
      nationalCoverage: supplier.national_coverage,
      matchType,
      locationMatchScore: score,
      livePricingAvailable: supplier.instant_pricing_available,
      pricingFreshness: supplier.pricing_updated_at,
      deliveryStatus,
      freightRequiresConfirmation: supplier.freight_available && supplier.delivery_requires_confirmation,
      priceIncludesDelivery: !supplier.pricing_excludes_freight,
      isLocalPricing: isLocal,
      isIndicativeBenchmark: isIndicative,
      calculatorUrl: '', // filled by caller with origin
      canonicalResultUrl: null,
      recommendedDisclosure: generateDisclosure(supplier, matchType, userLocation),
    };
  });

  // Sort by match score (highest first)
  results.sort((a, b) => b.locationMatchScore - a.locationMatchScore);

  return results;
}

/**
 * Legacy search - delegates to ranked search for backwards compatibility.
 */
export async function searchSuppliers(params: {
  country?: string;
  trade?: string;
  capability?: string;
}): Promise<SupplierProfile[]> {
  let query = getSupabase()
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, tax_treatment, default_trade, instant_pricing_available, pricing_updated_at, price_valid_until, price_type, delivery_assumptions, exclusions, service_areas, website_url, description, branch_city, branch_region, branch_postcode, branch_country, local_service_areas, regional_coverage, national_coverage, delivery_coverage, freight_available, pickup_available, excluded_delivery_regions, delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed')
    .eq('status', 'approved');

  if (params.country) {
    query = query.eq('country', params.country.toUpperCase());
  }
  if (params.trade) {
    query = query.eq('default_trade', params.trade);
  }
  if (params.capability === 'live_pricing') {
    query = query.eq('instant_pricing_available', true);
  }

  const { data, error } = await query.order('supplier_name');
  if (error || !data) return [];
  return data as SupplierProfile[];
}

