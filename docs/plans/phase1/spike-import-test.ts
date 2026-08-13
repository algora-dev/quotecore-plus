/**
 * Phase 1 Distribution Spike - throwaway test to verify @quote-core/roof-takeoff
 * can be imported and used inside QuoteCore+.
 *
 * This file is NOT shipped. It only proves the package works.
 * Run: node --import tsx docs/plans/phase1/spike-import-test.ts
 */

import assert from 'node:assert/strict';

// Test 1: Core types and functions are importable
import {
  COMPONENT_DEFS,
  BUILT_IN_ORDER,
  calculateTakeoffSections,
  computeEntry,
  computeMaterialCost,
  computeLabourCost,
  makeInitialSections,
  makeEntry,
  rafterPitchFactor,
  hipValleyPitchFactor,
  pitchFactor,
  unitLabel,
  areaUnitLabel,
  resolvePricingModes,
  ratioToDegrees,
  degreesToRatio,
  componentLabel,
  componentDescription,
  filterComponentsForRoofType,
  type ThemeConfig,
  type RoofComponentDef,
  type Entry,
  type ComponentSection,
  type MeasureMode,
  type UnitSystem,
  type PricingMode,
  type LayoutChoice,
  type RoofType,
} from '@quote-core/roof-takeoff';

console.log('[spike] Core imports: OK');

// Test 2: Calculation engine works
const sections = makeInitialSections();
const entry = makeEntry(25);
entry.inputMode = 'actual';
entry.actualValue = 100;
entry.computedValue = computeEntry(entry, 'roof_area', 'rafter');
sections.roof_area.entries.push(entry);

const result = calculateTakeoffSections(
  sections,
  BUILT_IN_ORDER,
  (id) => null,
  true,
);
assert.ok(result.sections.roof_area.rawTotal === 100, `Expected 100, got ${result.sections.roof_area.rawTotal}`);
console.log('[spike] Calculation engine: OK (roof_area rawTotal =', result.sections.roof_area.rawTotal, ')');

// Test 3: Pitch factors work
const pf25 = rafterPitchFactor(25);
assert.ok(pf25 > 1 && pf25 < 1.2, `25deg rafter factor should be ~1.103, got ${pf25}`);
console.log('[spike] Pitch factors: OK (25deg rafter =', pf25.toFixed(4), ')');

// Test 4: Material cost calculation
const comp: RoofComponentDef = {
  id: 'test-comp',
  component_kind: 'roof_area',
  name: 'Test Iron',
  description: null,
  unit: 'm2',
  price_per_unit: 30,
  pricing_strategy: 'per_unit',
  pack_size: null,
  pack_price: null,
  labour_rate: 7.5,
  labour_unit: 'per_unit',
  suggested_waste_percent: 5,
  pitch_type: 'rafter',
  is_active: true,
  sort_order: 0,
};
const matCost = computeMaterialCost(110, comp);
assert.equal(matCost.cost, 3300, `Expected 3300, got ${matCost.cost}`);
console.log('[spike] Material cost: OK (110 * $30 =', matCost.cost, ')');

// Test 5: ThemeConfig type is usable
const theme: ThemeConfig = {
  primary: '#FF6B35',
  primaryHover: '#A03E15',
  accent: '#FF6B35',
  logoUrl: null,
  headingFont: 'Inter, sans-serif',
  bodyFont: 'Inter, sans-serif',
  currency: 'USD',
  currencySymbol: '$',
  defaultUnits: 'metric',
  supplierName: 'Test Supplier',
  supplierEmail: null,
  features: { sendToSupplier: false, convertToQuote: false, saveToApp: false },
  copy: {
    headerTitle: 'Test',
    heroTitle: 'Test',
    heroSubtitle: '',
    footerText: '',
    poweredBy: null,
  },
};
console.log('[spike] ThemeConfig type: OK');

// Test 6: Helper functions
assert.equal(unitLabel('metric'), 'm');
assert.equal(areaUnitLabel('imperial'), 'sq ft');
assert.ok(Math.abs(ratioToDegrees('5:12') - 22.62) < 0.01, `Expected ~22.62, got ${ratioToDegrees('5:12')}`);
console.log('[spike] Helpers: OK');

console.log('\n[spike] ALL TESTS PASSED - package is importable and functional in QuoteCore+.');
console.log('[spike] Next step: verify next build compiles with the package.');
