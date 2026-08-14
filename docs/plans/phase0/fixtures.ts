/**
 * Phase 0 Fixtures - Known-good inputs and expected outputs for parity testing.
 *
 * These fixtures capture the EXACT behaviour of the current QuoteCore+ takeoff builder
 * before the shared-package migration. After migration, the shared package must produce
 * identical results for every fixture.
 *
 * Every fixture is a frozen snapshot. Do NOT edit these values - add new fixtures instead.
 * The migration parity tests will compare shared-package output against these expectations.
 */

// Inline the RoofComponentDef type to avoid path resolution issues with (public) directory
export interface FixtureRoofComponentDef {
  id: string;
  component_kind: string;
  name: string;
  description: string | null;
  unit: string;
  price_per_unit: number;
  pricing_strategy: string;
  pack_size: number | null;
  pack_price: number | null;
  labour_rate: number;
  labour_unit: string;
  suggested_waste_percent: number;
  pitch_type: string;
  is_active: boolean;
  sort_order: number;
}

// ─── Test Components ─────────────────────────────────

export const FIXTURE_COMPONENTS: FixtureRoofComponentDef[] = [
  {
    id: 'fix-roof-area',
    component_kind: 'roof_area' as any,
    name: 'Corrugate .40g',
    description: 'Fixture corrugated iron',
    unit: 'm2',
    price_per_unit: 30,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 7.5,
    labour_unit: 'per_unit',
    suggested_waste_percent: 3,
    pitch_type: 'rafter',
    is_active: true,
    sort_order: 0,
  },
  {
    id: 'fix-roof-area-pack',
    component_kind: 'roof_area' as any,
    name: 'Metal Tile Pack',
    description: 'Pack-priced metal tile',
    unit: 'm2',
    price_per_unit: 32,
    pricing_strategy: 'pack',
    pack_size: 3,
    pack_price: 90,
    labour_rate: 18,
    labour_unit: 'per_unit',
    suggested_waste_percent: 7,
    pitch_type: 'rafter',
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'fix-ridge',
    component_kind: 'ridge' as any,
    name: 'Roll Top Ridging',
    description: 'Fixture ridge',
    unit: 'm',
    price_per_unit: 25,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 5,
    labour_unit: 'per_unit',
    suggested_waste_percent: 5,
    pitch_type: 'none',
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'fix-hip',
    component_kind: 'hip' as any,
    name: 'Hip Capping',
    description: 'Fixture hip',
    unit: 'm',
    price_per_unit: 14,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 10,
    labour_unit: 'per_unit',
    suggested_waste_percent: 5,
    pitch_type: 'hip_valley',
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'fix-valley',
    component_kind: 'valley' as any,
    name: 'Valley Tray',
    description: 'Fixture valley',
    unit: 'm',
    price_per_unit: 16,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 12,
    labour_unit: 'per_unit',
    suggested_waste_percent: 5,
    pitch_type: 'hip_valley',
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'fix-barge',
    component_kind: 'barge' as any,
    name: 'Barge Flashing',
    description: 'Fixture barge',
    unit: 'm',
    price_per_unit: 10,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 7,
    labour_unit: 'per_unit',
    suggested_waste_percent: 3,
    pitch_type: 'rafter',
    is_active: true,
    sort_order: 5,
  },
  {
    id: 'fix-spouting',
    component_kind: 'spouting' as any,
    name: 'Spouting/Gutter',
    description: 'Fixture spouting',
    unit: 'm',
    price_per_unit: 22,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 10,
    labour_unit: 'per_unit',
    suggested_waste_percent: 3,
    pitch_type: 'none',
    is_active: true,
    sort_order: 6,
  },
  {
    id: 'fix-underlay',
    component_kind: 'underlay' as any,
    name: 'Roofing Underlay',
    description: 'Fixture underlay',
    unit: 'm2',
    price_per_unit: 4.5,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 3,
    labour_unit: 'per_unit',
    suggested_waste_percent: 10,
    pitch_type: 'rafter',
    is_active: true,
    sort_order: 7,
  },
  {
    id: 'fix-fixings',
    component_kind: 'fixings' as any,
    name: 'Roofing Screws',
    description: 'Fixture fixings',
    unit: 'm2',
    price_per_unit: 3.5,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 2,
    labour_unit: 'per_unit',
    suggested_waste_percent: 5,
    pitch_type: 'rafter',
    is_active: true,
    sort_order: 8,
  },
];

// ─── Fixture: Actual mode, metric, supplier pricing ──────────────

export const FIXTURE_ACTUAL_METRIC = {
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 100,
    ridges: [10],
  },
  expected: {
    roof_area: {
      rawTotal: 100,
      withWaste: 110, // 10% default waste
      materialCost: 3000, // 100 * 30
      labourCost: 750, // 100 * 7.5
      totalCost: 3750,
      componentName: 'Corrugate .40g',
      componentSku: 'CRG-040',
      unitPrice: 30,
      wastePercent: 10,
    },
    ridge: {
      rawTotal: 10,
      withWaste: 10.5, // 5% default waste
      materialCost: 250, // 10 * 25
      labourCost: 50, // 10 * 5
      totalCost: 300,
      componentName: 'Roll Top Ridging',
      wastePercent: 5,
    },
  },
} as const;

// ─── Fixture: Plan mode, metric, 45 degree pitch ────────────────

export const FIXTURE_PLAN_45DEG = {
  input: {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 45,
    area: 100,
    ridges: [10],
  },
  expected: {
    roof_area: {
      // 100 / cos(45) = 100 / 0.70710678118... = 141.421356237...
      rawTotal: 100 / Math.cos(45 * Math.PI / 180),
      // rafter pitch factor applied
    },
    // ridge: pitchType 'none', so no pitch factor
    ridge: {
      rawTotal: 10,
    },
  },
} as const;

// ─── Fixture: Plan mode, hip/valley pitch ───────────────────────

export const FIXTURE_PLAN_HIP_VALLEY = {
  input: {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 30,
    area: 100,
    hips: [8],
    valleys: [6],
  },
  expected: {
    roof_area: {
      // rafter: 100 / cos(30) = 100 / 0.866025... = 115.470053837...
      rawTotal: 100 / Math.cos(30 * Math.PI / 180),
    },
    hip: {
      // hip_valley: sqrt(1 + tan^2(30)/2) = sqrt(1 + 0.166666.../2) = sqrt(1.08333...) = 1.040832...
      rawTotal: 8 * Math.sqrt(1 + (Math.tan(30 * Math.PI / 180) ** 2) / 2),
    },
    valley: {
      rawTotal: 6 * Math.sqrt(1 + (Math.tan(30 * Math.PI / 180) ** 2) / 2),
    },
  },
} as const;

// ─── Fixture: Imperial units pass-through ───────────────────────

export const FIXTURE_IMPERIAL = {
  input: {
    mode: 'actual' as const,
    units: 'imperial' as const,
    pitchDegrees: 25,
    area: 1200,
  },
  expected: {
    roof_area: {
      rawTotal: 1200,
      unit: 'sq ft',
    },
  },
} as const;

// ─── Fixture: Squares units pass-through ────────────────────────

export const FIXTURE_SQUARES = {
  input: {
    mode: 'actual' as const,
    units: 'squares' as const,
    pitchDegrees: 25,
    area: 10,
  },
  expected: {
    roof_area: {
      rawTotal: 10,
      unit: 'squares',
    },
  },
} as const;

// ─── Fixture: Pack pricing ──────────────────────────────────────

export const FIXTURE_PACK_PRICING = {
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 100,
  },
  componentOverride: 'fix-roof-area-pack',
  expected: {
    // pack_size: 3, pack_price: 90
    // packs = ceil(110 / 3) = 37 (110 = 100 * 1.1 waste)
    // cost = 37 * 90 = 3330
    // NOTE: in the engine, materialCost uses computedValue * (1 + wastePercent/100)
    // computedValue = 100 (actual), waste = 10% default
    // materialQuantity = 100 * 1.1 = 110
    // packs = ceil(110 / 3) = 37
    // cost = 37 * 90 = 3330
    materialCost: 37 * 90,
    packs: 37,
  },
} as const;

// ─── Fixture: Known-price entry ─────────────────────────────────

export const FIXTURE_KNOWN_PRICE = {
  description: 'Entry with knownPrice should use knownPrice * quantity instead of component pricing',
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 100,
  },
  // When an entry has knownPrice = 45 and computedValue = 100:
  // materialCost = 100 * 45 = 4500
  // labourCost comes from the selected component (if any)
  expected: {
    materialCost: 4500, // 100 * 45
    knownPrice: 45,
  },
} as const;

// ─── Fixture: Fixed-quantity custom component ───────────────────

export const FIXTURE_FIXED_COMPONENT = {
  description: 'Custom component with measurementType=fixed: rawTotal = sum of quantities, no waste, no pitch',
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
  },
  customDef: {
    id: 'fix-custom-fixed',
    name: 'Roof Vents',
    measurementType: 'fixed' as const,
    pitchType: 'none' as const,
    wastePercent: 0,
  },
  entries: [
    { quantity: 3, knownPrice: 85 },
    { quantity: 2, knownPrice: 85 },
  ],
  expected: {
    rawTotal: 5, // 3 + 2 (quantity sum, not computed values)
    withWaste: 5, // no waste on fixed
    materialCost: 425, // (3 * 85) + (2 * 85) = 255 + 170 = 425
    wastePercent: 0,
  },
} as const;

// ─── Fixture: No supplier (pricing unavailable) ─────────────────

export const FIXTURE_NO_SUPPLIER = {
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    area: 100,
  },
  components: [] as FixtureRoofComponentDef[],
  expected: {
    warnings: ['pricing_unavailable'],
    roof_area: {
      materialCost: 0,
      labourCost: 0,
    },
  },
} as const;

// ─── Fixture: Supplier slot map ─────────────────────────────────

export const FIXTURE_SUPPLIER_SLOT_MAP = {
  roof_area: { componentId: 'fix-roof-area', componentName: 'Corrugate .40g', componentSku: 'CRG-040', unitPrice: 30 },
  ridge: { componentId: 'fix-ridge', componentName: 'Roll Top Ridging', componentSku: 'RT-001', unitPrice: 25 },
  hip: { componentId: 'fix-hip', componentName: 'Hip Capping', componentSku: 'HC-001', unitPrice: 14 },
  valley: { componentId: 'fix-valley', componentName: 'Valley Tray', componentSku: 'VT-001', unitPrice: 16 },
  barge: { componentId: 'fix-barge', componentName: 'Barge Flashing', componentSku: 'BF-001', unitPrice: 10 },
  spouting: { componentId: 'fix-spouting', componentName: 'Spouting/Gutter', componentSku: 'SG-001', unitPrice: 22 },
  underlay: { componentId: 'fix-underlay', componentName: 'Roofing Underlay', componentSku: 'RU-001', unitPrice: 4.5 },
  fixings: { componentId: 'fix-fixings', componentName: 'Roofing Screws', componentSku: 'RS-001', unitPrice: 3.5 },
} as const;

// ─── Fixture: Result token round-trip ───────────────────────────

export const FIXTURE_RESULT_TOKEN = {
  input: {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    gutter: [18],
  },
  // Token must round-trip: same input -> same token -> same calculation
  expected: {
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    gutter: [18],
  },
} as const;

// ─── Fixture: Supplier enquiry (slug only, no email) ────────────

export const FIXTURE_SUPPLIER_ENQUIRY = {
  description: 'Enquiry submits supplierSlug only. Server resolves email. Client never sees destination email.',
  input: {
    supplierSlug: 'apex-roofing',
    takeoffSnapshot: {
      measureMode: 'actual',
      unitSystem: 'metric',
      grandTotal: 3750,
      totalEntries: 2,
    },
  },
  expected: {
    clientPayload: {
      supplierSlug: 'apex-roofing',
      // NO supplierEmail field in client payload
    },
  },
} as const;
