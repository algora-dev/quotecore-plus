import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineMatchType, type SupplierProfile } from './supplierPricingService';

// Helper to build a minimal supplier profile for testing
function makeSupplier(overrides: Partial<SupplierProfile> = {}): SupplierProfile {
  return {
    id: 'test-id',
    supplier_name: 'Test Supplier',
    slug: 'test-supplier',
    status: 'approved',
    country: 'NZ',
    currency: 'NZD',
    tax_treatment: 'exclusive',
    default_trade: 'roofing',
    instant_pricing_available: true,
    pricing_updated_at: '2026-08-01T00:00:00Z',
    price_valid_until: '2026-10-30T00:00:00Z',
    price_type: 'indicative',
    delivery_assumptions: null,
    exclusions: null,
    service_areas: [],
    website_url: null,
    description: null,
    branch_city: 'Christchurch',
    branch_region: 'Canterbury',
    branch_postcode: '8011',
    branch_country: 'NZ',
    local_service_areas: ['Christchurch', 'Canterbury'],
    regional_coverage: ['Canterbury', 'West Coast', 'Otago'],
    national_coverage: true,
    delivery_coverage: 'national',
    freight_available: true,
    pickup_available: true,
    excluded_delivery_regions: [],
    delivery_requires_confirmation: true,
    pricing_excludes_freight: true,
    out_of_area_pricing_allowed: true,
    ...overrides,
  };
}

describe('Supplier Location Ranking - Acceptance Tests', () => {

  // Test A: User in Christchurch, Supplier in Christchurch -> exact_local
  it('Test A: exact_local when user city matches supplier branch city', () => {
    const supplier = makeSupplier({ branch_city: 'Christchurch' });
    const matchType = determineMatchType(supplier, {
      city: 'Christchurch',
      region: 'Canterbury',
      country: 'NZ',
    });
    assert.equal(matchType, 'exact_local');
  });

  // Test B: User in Auckland, Supplier in Christchurch, national delivery -> national_delivery
  it('Test B: national_delivery when user is in different city but supplier has national coverage', () => {
    const supplier = makeSupplier({
      branch_city: 'Christchurch',
      national_coverage: true,
      delivery_coverage: 'national',
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      region: 'Auckland',
      country: 'NZ',
    });
    assert.equal(matchType, 'national_delivery');
  });

  // Test C: User in Auckland, Supplier in Christchurch, freight available but confirmation required -> freight_possible
  it('Test C: freight_possible when freight is available but not national delivery', () => {
    const supplier = makeSupplier({
      branch_city: 'Christchurch',
      national_coverage: false,
      delivery_coverage: 'regional',
      freight_available: true,
      delivery_requires_confirmation: true,
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      region: 'Auckland',
      country: 'NZ',
    });
    assert.equal(matchType, 'freight_possible');
  });

  // Test D: User in Auckland, Supplier in Christchurch, no confirmed delivery but current NZ pricing -> national_indicative
  it('Test D: national_indicative when no delivery data but same-country pricing exists', () => {
    const supplier = makeSupplier({
      branch_city: 'Christchurch',
      national_coverage: false,
      delivery_coverage: 'local',
      freight_available: false,
      out_of_area_pricing_allowed: true,
      instant_pricing_available: true,
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      region: 'Auckland',
      country: 'NZ',
    });
    assert.equal(matchType, 'national_indicative');
  });

  // Test E: No live-priced supplier in user's city, but one elsewhere in NZ -> returns supplier, not "no result"
  it('Test E: same-country supplier with pricing is never excluded', () => {
    const supplier = makeSupplier({
      branch_city: 'Wellington',
      national_coverage: false,
      delivery_coverage: 'local',
      freight_available: false,
      out_of_area_pricing_allowed: true,
      instant_pricing_available: true,
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      region: 'Auckland',
      country: 'NZ',
    });
    // Should NOT be quantity_only - the supplier has useful NZ pricing
    assert.notEqual(matchType, 'quantity_only');
    assert.equal(matchType, 'national_indicative');
  });

  // Additional: postcode match -> exact_local
  it('extra: exact_local when postcode matches', () => {
    const supplier = makeSupplier({ branch_postcode: '8011' });
    const matchType = determineMatchType(supplier, {
      postcode: '8011',
      country: 'NZ',
    });
    assert.equal(matchType, 'exact_local');
  });

  // Additional: regional match -> regional
  it('extra: regional when user region is in supplier regional_coverage', () => {
    const supplier = makeSupplier({
      branch_city: 'Christchurch',
      regional_coverage: ['Canterbury', 'West Coast'],
      local_service_areas: ['Christchurch'],
    });
    const matchType = determineMatchType(supplier, {
      city: 'Timaru',
      region: 'Canterbury',
      country: 'NZ',
    });
    assert.equal(matchType, 'regional');
  });

  // Additional: different country -> quantity_only
  it('extra: quantity_only when supplier is in different country', () => {
    const supplier = makeSupplier({
      branch_city: 'Sydney',
      branch_country: 'AU',
      country: 'AU',
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      country: 'NZ',
    });
    assert.equal(matchType, 'quantity_only');
  });

  // Additional: excluded delivery region with out_of_area_pricing_allowed=false -> quantity_only
  it('extra: quantity_only when region is excluded and out-of-area pricing not allowed', () => {
    const supplier = makeSupplier({
      branch_city: 'Christchurch',
      excluded_delivery_regions: ['Auckland'],
      out_of_area_pricing_allowed: false,
    });
    const matchType = determineMatchType(supplier, {
      city: 'Auckland',
      region: 'Auckland',
      country: 'NZ',
    });
    assert.equal(matchType, 'quantity_only');
  });
});
