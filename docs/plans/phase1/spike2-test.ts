/**
 * Phase 2 Spike - Verify supplier types, adapters, capabilities, and known-price/fixed support.
 * Run: node --import tsx docs/plans/phase1/spike-import-test.ts
 */

import assert from 'node:assert/strict';

import {
  // Types
  type SupplierContext,
  type SupplierSummary,
  type SupplierCatalogue,
  type SupplierAdapter,
  type EnquiryAdapter,
  type ResultAdapter,
  type SharedTakeoffSnapshot,
  type TakeoffCapabilities,
  // Values
  DEFAULT_CAPABILITIES,
  isCustomFixed,
  computeKnownPriceCost,
  registerCustomKind,
  makeCustomSection,
  makeInitialSections,
  makeEntry,
  calculateTakeoffSections,
  type Entry,
  type CustomComponentDef,
  type RoofComponentDef,
} from '@quote-core/roof-takeoff';

console.log('[spike2] All imports OK');

// Test 1: DEFAULT_CAPABILITIES
assert.equal(DEFAULT_CAPABILITIES.supplierSelection, false);
assert.equal(DEFAULT_CAPABILITIES.knownPriceEntries, false);
assert.equal(DEFAULT_CAPABILITIES.fixedQuantityComponents, false);
console.log('[spike2] DEFAULT_CAPABILITIES: OK');

// Test 2: known-price calculation
const entry: Entry = {
  id: 'e1',
  label: 'Test',
  inputMode: 'actual',
  pitchDegrees: 0,
  computedValue: 100,
  selectedComponentId: null,
  knownPrice: 25,
};
const kpCost = computeKnownPriceCost(100, 25);
assert.equal(kpCost, 2500);
console.log('[spike2] Known price calculation: OK (100 * $25 =', kpCost, ')');

// Test 3: fixed-quantity component
const fixedDef: CustomComponentDef = {
  id: 'custom-fixed-test',
  name: 'Fixed Item',
  measurementType: 'fixed',
  pitchType: 'none',
  wastePercent: 0,
};
const fixedSection = makeCustomSection(fixedDef);
assert.equal(fixedSection.wastePercent, 0);
assert.ok(isCustomFixed(fixedDef.id), 'Should be registered as fixed');
console.log('[spike2] Fixed-quantity component: OK');

// Test 4: Engine handles knownPrice
const sections = makeInitialSections();
const testEntry: Entry = {
  ...makeEntry(0),
  inputMode: 'actual',
  actualValue: 50,
  computedValue: 50,
  knownPrice: 10,
  selectedComponentId: null,
};
sections.roof_area.entries.push(testEntry);
const result = calculateTakeoffSections(sections, ['roof_area'], () => null, true);
assert.equal(result.sections.roof_area.materialCost, 500, `Expected 500, got ${result.sections.roof_area.materialCost}`);
console.log('[spike2] Engine known-price: OK (50 * $10 =', result.sections.roof_area.materialCost, ')');

// Test 5: Adapter types are constructable
const mockAdapter: SupplierAdapter = {
  async listSuppliers() { return []; },
  async loadCatalogue() {
    return {
      slug: 'test',
      supplierName: 'Test Supplier',
      currency: 'USD',
      currencySymbol: '$',
      unitSystem: 'metric' as const,
      components: [],
    };
  },
};
assert.ok(mockAdapter);
console.log('[spike2] SupplierAdapter type: OK');

// Test 6: Snapshot type is usable
const snapshot: SharedTakeoffSnapshot = {
  version: '1.0',
  measureMode: 'actual',
  unitSystem: 'metric',
  pricingMode: 'material',
  roofType: null,
  supplierSlug: 'test-supplier',
  catalogueVersion: '1',
  sections: {},
  sectionOrder: [],
  masterPitchDegrees: 25,
  capabilities: DEFAULT_CAPABILITIES,
  calculation: result,
};
assert.ok(snapshot);
console.log('[spike2] SharedTakeoffSnapshot type: OK');

console.log('\n[spike2] ALL TESTS PASSED - Phase 2 types and functions are working.');
