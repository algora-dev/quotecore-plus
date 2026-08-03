import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery, type PublicRoofTakeoffInput, type SupplierSlotMap } from './public-contract';
import { createResultToken, verifyResultToken, buildResultUrl } from './result-token';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from './public-contract';
import type { RoofComponentDef } from './types';

// Phase 0 baseline tests: snapshot critical calculation + supplier behavior
// before the supplier takeoff V2 changes begin.
// These tests MUST stay green through every phase. If any breaks, stop.

// --- Calculation baseline: actual mode, metric, with supplier pricing ---

const baselineSupplierComponents: RoofComponentDef[] = [
  {
    id: 'base-roof-area',
    component_kind: 'roof_area' as any,
    name: 'Corrugate .40g',
    description: 'Baseline corrugated iron',
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
    id: 'base-ridge',
    component_kind: 'ridge' as any,
    name: 'Roll Top Ridging',
    description: 'Baseline ridge',
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
    sort_order: 1,
  },
];

const baselineSlotMap: SupplierSlotMap = {
  roof_area: { componentId: 'base-roof-area', componentName: 'Corrugate .40g', componentSku: 'CRG-040', unitPrice: 30 },
  ridge: { componentId: 'base-ridge', componentName: 'Roll Top Ridging', componentSku: 'RT-001', unitPrice: 25 },
  hip: null,
  valley: null,
  barge: null,
  spouting: null,
  underlay: null,
  fixings: null,
};

test('baseline: actual mode with supplier pricing produces correct material costs', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'actual', units: 'metric', pitchDegrees: 25, area: 100, ridges: [10] },
    baselineSupplierComponents,
    baselineSlotMap,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  // roof_area: 100 m2 actual, 10% waste default, $30/m2 material, $7.5/m2 labour
  // materialCost is per-entry (no waste applied), labourCost is per-entry
  const ra = result.results.components.roof_area;
  assert.equal(ra.rawTotal, 100);
  assert.ok(Math.abs(ra.withWaste - 110) < 1e-10);
  // costQuantity = computedValue = 100 (actual mode, no pitch factor on roof_area in actual mode)
  assert.ok(Math.abs(ra.materialCost - 100 * 30) < 1e-10, `Expected ${100*30}, got ${ra.materialCost}`);
  assert.ok(Math.abs(ra.labourCost - 100 * 7.5) < 1e-10, `Expected ${100*7.5}, got ${ra.labourCost}`);
  assert.equal(ra.componentName, 'Corrugate .40g');
  assert.equal(ra.componentSku, 'CRG-040');
  assert.equal(ra.unitPrice, 30);

  // ridge: 10m, 5% waste default
  const ri = result.results.components.ridge;
  assert.equal(ri.rawTotal, 10);
  assert.ok(Math.abs(ri.withWaste - 10.5) < 1e-10);
  assert.ok(Math.abs(ri.materialCost - 10 * 25) < 1e-10);
  assert.ok(Math.abs(ri.labourCost - 10 * 5) < 1e-10);
  assert.equal(ri.componentName, 'Roll Top Ridging');
});

test('baseline: plan mode pitch factors are applied correctly', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'plan', units: 'metric', pitchDegrees: 45, area: 100, ridges: [10] },
    baselineSupplierComponents,
    baselineSlotMap,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  // plan mode 45 degrees: roof_area = 100 / cos(45) = 100 / 0.7071... = 141.42...
  const ra = result.results.components.roof_area;
  assert.ok(Math.abs(ra.rawTotal - (100 / Math.cos(45 * Math.PI / 180))) < 1e-10);
});

test('baseline: no supplier components triggers pricing_unavailable warning', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'actual', units: 'metric', area: 100 },
    [],
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.warnings.includes('pricing_unavailable'));
  // Material and labour costs should be 0 without components
  assert.equal(result.results.components.roof_area.materialCost, 0);
  assert.equal(result.results.components.roof_area.labourCost, 0);
});

test('baseline: imperial units pass through (no auto-conversion to metric)', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'actual', units: 'imperial', pitchDegrees: 25, area: 1200 },
    baselineSupplierComponents,
    baselineSlotMap,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  // Imperial: area value passes through as-is (1200 sq ft, no conversion)
  const ra = result.results.components.roof_area;
  assert.equal(ra.rawTotal, 1200);
  assert.equal(ra.unit, 'sq ft');
});

test('baseline: squares units pass through (no auto-conversion when isTotalInput)', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'actual', units: 'squares', pitchDegrees: 25, area: 10 },
    baselineSupplierComponents,
    baselineSlotMap,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  // Squares: area value passes through as-is for total input (10 squares)
  const ra = result.results.components.roof_area;
  assert.equal(ra.rawTotal, 10);
  assert.equal(ra.unit, 'squares');
});

test('baseline: grand total = material + labour across all components', () => {
  const result = calculatePublicRoofTakeoff(
    { mode: 'actual', units: 'metric', pitchDegrees: 25, area: 100, ridges: [10] },
    baselineSupplierComponents,
    baselineSlotMap,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.ok(Math.abs(result.results.grandTotal - (result.results.materialTotal + result.results.labourTotal)) < 1e-10);
});

test('baseline: result token round-trip preserves calculation', () => {
  const input: PublicRoofTakeoffInput = {
    mode: 'actual', units: 'metric', pitchDegrees: 25, area: 100, ridges: [10],
  };
  const query = toResultQuery(input);
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const payload = verifyResultToken(token);

  assert.ok(payload, 'Token must verify');
  assert.equal(payload!.q, query);
  assert.equal(payload!.v, ROOF_TAKEOFF_CALCULATION_VERSION);

  const restored = parseQueryInput(new URLSearchParams(payload!.q));
  const rerun = calculatePublicRoofTakeoff(restored);
  assert.equal(rerun.success, true);
  if (!rerun.success) return;
  assert.equal(rerun.results.components.roof_area.rawTotal, 100);
  assert.equal(rerun.results.components.ridge.rawTotal, 10);
});

test('baseline: country param parses and uppercases', () => {
  const input = parseQueryInput(new URLSearchParams('mode=actual&units=metric&area=100&country=nz'));
  assert.equal(input.country, 'NZ');
});

test('baseline: supplier param parses', () => {
  const input = parseQueryInput(new URLSearchParams('mode=actual&units=metric&area=100&supplier=apex-roofing'));
  assert.equal(input.supplier, 'apex-roofing');
});

test('baseline: custom waste overrides apply per-slot', () => {
  const result = calculatePublicRoofTakeoff({
    mode: 'actual', units: 'metric', pitchDegrees: 25, area: 100,
    wastePercent: { roof_area: 15 },
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.results.components.roof_area.wastePercent, 15);
  assert.ok(Math.abs(result.results.components.roof_area.withWaste - 115) < 1e-10);
});

test('baseline: result URL builds with origin', () => {
  const url = buildResultUrl('abc123.def456', 'https://quote-core.com');
  assert.equal(url, 'https://quote-core.com/free-roofing-takeoff-builder/result/abc123.def456');
});

test('baseline: result URL builds without origin (relative)', () => {
  const url = buildResultUrl('abc123.def456');
  assert.equal(url, '/free-roofing-takeoff-builder/result/abc123.def456');
});

test('baseline: supplier lib + version provenance params parse', () => {
  const input = parseQueryInput(new URLSearchParams('mode=actual&units=metric&area=100&supplier=apex-roofing&supplierLib=abc-123&supplierVer=2'));
  assert.equal(input.supplier, 'apex-roofing');
  assert.equal(input.supplierLib, 'abc-123');
  assert.equal(input.supplierVer, 2);
});

test('baseline: result token round-trip preserves supplier provenance', () => {
  const input: PublicRoofTakeoffInput = {
    mode: 'actual', units: 'metric', pitchDegrees: 25, area: 100, ridges: [10],
    supplier: 'apex-roofing',
    supplierLib: 'a1e00000-0000-0000-0000-000000000001',
    supplierVer: 1,
  };
  const query = toResultQuery(input);
  assert.ok(query.includes('supplierLib='));
  assert.ok(query.includes('supplierVer=1'));
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const payload = verifyResultToken(token);
  assert.ok(payload, 'Token must verify');
  const restored = parseQueryInput(new URLSearchParams(payload!.q));
  assert.equal(restored.supplierLib, 'a1e00000-0000-0000-0000-000000000001');
  assert.equal(restored.supplierVer, 1);
});

test('baseline: tampered token fails verification', () => {
  const token = createResultToken('mode=actual&area=100', ROOF_TAKEOFF_CALCULATION_VERSION);
  const tampered = token.slice(0, -4) + 'XXXX';
  assert.equal(verifyResultToken(tampered), null);
});
