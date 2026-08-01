import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePublicRoofTakeoff, toResultQuery, type SupplierSlotMap } from './public-contract';
import { createResultToken, verifyResultToken, buildResultUrl } from './result-token';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from './public-contract';
import type { RoofComponentDef } from './types';

// Simulated supplier components (what would come from the DB)
const demoSupplierComponents: RoofComponentDef[] = [
  {
    id: 'comp-roof-area-corrugate',
    component_kind: 'roof_area' as any,
    name: 'Corrugate .40g',
    description: 'Corrugated long-run roofing iron',
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
    id: 'comp-ridge-roll-top',
    component_kind: 'ridge' as any,
    name: 'Roll Top Ridging',
    description: 'Roll top ridge capping',
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
  {
    id: 'comp-hip-3-way',
    component_kind: 'hip' as any,
    name: '3-Way Hip Cap',
    description: 'Hip capping',
    unit: 'm',
    price_per_unit: 22,
    pricing_strategy: 'per_unit',
    pack_size: null,
    pack_price: null,
    labour_rate: 5,
    labour_unit: 'per_unit',
    suggested_waste_percent: 5,
    pitch_type: 'hip_valley',
    is_active: true,
    sort_order: 2,
  },
];

const demoSlotMap: SupplierSlotMap = {
  roof_area: { componentId: 'comp-roof-area-corrugate', componentName: 'Corrugate .40g', componentSku: 'CORR-040', unitPrice: 30 },
  ridge: { componentId: 'comp-ridge-roll-top', componentName: 'Roll Top Ridging', componentSku: 'RTR-001', unitPrice: 25 },
  hip: { componentId: 'comp-hip-3-way', componentName: '3-Way Hip Cap', componentSku: 'HIP-3W', unitPrice: 22 },
  valley: null,
  barge: null,
  spouting: null,
  underlay: null,
  fixings: null,
};

// Test: Supplier pricing produces real costs
test('supplier pricing: calculation with supplier components returns real prices', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
    supplier: 'demo-nz-supplier',
  };

  const result = calculatePublicRoofTakeoff(input, demoSupplierComponents, demoSlotMap);
  assert.equal(result.success, true);
  if (!result.success) return;

  // Roof area should have a component name and price
  assert.equal(result.results.components.roof_area.componentName, 'Corrugate .40g');
  assert.equal(result.results.components.roof_area.componentSku, 'CORR-040');
  assert.equal(result.results.components.roof_area.unitPrice, 30);
  assert.ok(result.results.components.roof_area.materialCost > 0, 'Roof area material cost must be > 0');

  // Ridge should have component
  assert.equal(result.results.components.ridge.componentName, 'Roll Top Ridging');
  assert.ok(result.results.components.ridge.materialCost > 0);

  // Grand total should be > 0
  assert.ok(result.results.grandTotal > 0, 'Grand total must be > 0 with supplier pricing');
  assert.ok(result.results.materialTotal > 0);
  assert.ok(result.results.labourTotal > 0);

  // No pricing_unavailable warning
  assert.ok(!result.warnings.includes('pricing_unavailable'), 'Should not have pricing_unavailable warning');
});

// Test: No supplier = no pricing (backward compatible)
test('no supplier: calculation without supplier returns pricing_unavailable', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
  };

  const result = calculatePublicRoofTakeoff(input);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.warnings.includes('pricing_unavailable'));
  assert.equal(result.results.grandTotal, 0);
  assert.equal(result.results.components.roof_area.componentName, undefined);
});

// Test: Supplier param flows through toResultQuery and back
test('supplier param: flows through query string round-trip', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    supplier: 'demo-nz-supplier',
  };

  const query = toResultQuery(input);
  assert.ok(query.includes('supplier=demo-nz-supplier'), 'Query must include supplier param');
});

// Test: End-to-end - supplier calculation -> token -> result URL -> re-calculate same
test('e2e: supplier calculation produces stable result URL with same prices', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
    supplier: 'demo-nz-supplier',
  };

  // First calculation
  const result1 = calculatePublicRoofTakeoff(input, demoSupplierComponents, demoSlotMap);
  assert.equal(result1.success, true);
  if (!result1.success) return;

  // Create token
  const query = toResultQuery({ ...input, mode: result1.mode, units: result1.units });
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const url = buildResultUrl(token, 'https://quote-core.co.nz');

  // Verify token
  const payload = verifyResultToken(token.split('/result/')[1] ?? token);
  assert.ok(payload);

  // Re-calculate from payload (same as the result page would do)
  // Note: the result page would also load supplier components from DB
  const { parseQueryInput } = require('./public-contract');
  const restoredInput = parseQueryInput(new URLSearchParams(payload!.q));
  assert.equal(restoredInput.supplier, 'demo-nz-supplier');

  const result2 = calculatePublicRoofTakeoff(restoredInput, demoSupplierComponents, demoSlotMap);
  assert.equal(result2.success, true);
  if (!result2.success) return;

  // Same prices
  assert.equal(result2.results.components.roof_area.materialCost, result1.results.components.roof_area.materialCost);
  assert.equal(result2.results.grandTotal, result1.results.grandTotal);
  assert.equal(result2.results.components.roof_area.componentName, 'Corrugate .40g');

  // URL is stable
  assert.ok(url.includes('/free-roofing-takeoff-builder/result/'));
  assert.ok(url.startsWith('https://quote-core.co.nz/'));
});

// Test: URL with supplier param doesn't break when copied into email/markdown
test('supplier URL: result URL with supplier param is email-safe', () => {
  const input = {
    mode: 'actual' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 100,
    supplier: 'demo-nz-supplier',
  };

  const query = toResultQuery(input);
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const url = buildResultUrl(token, 'https://quote-core.co.nz');

  // URL should not contain spaces, angle brackets, or characters that break in email/markdown
  assert.ok(!url.includes(' '));
  assert.ok(!url.includes('<'));
  assert.ok(!url.includes('>'));
  assert.ok(!url.includes('"'));
  // URL should be a valid HTTPS URL
  assert.ok(url.startsWith('https://'));
});
