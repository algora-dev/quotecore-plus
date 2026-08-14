/**
 * Phase 6 parity tests - verify the shared package produces identical
 * calculation results to the existing QuoteCore+ implementation.
 *
 * These tests import from @quote-core/roof-takeoff (the shared package)
 * and compare against the frozen Phase 0 fixtures.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeInitialSections,
  makeEntry,
  computeEntry,
  calculateTakeoffSections,
  rafterPitchFactor,
  hipValleyPitchFactor,
  computeMaterialCost,
  computeKnownPriceCost,
  computeLabourCost,
  isCustomFixed,
  makeCustomSection,
  registerCustomKind,
  BUILT_IN_ORDER,
} from '@quote-core/roof-takeoff';
import type { Entry, RoofComponentDef, CustomComponentDef } from '@quote-core/roof-takeoff';

describe('Phase 6: Parity - pitch factors', () => {
  test('25deg rafter factor matches QuoteCore+', () => {
    const factor = rafterPitchFactor(25);
    assert.ok(Math.abs(factor - 1.1034) < 0.001, `Expected ~1.1034, got ${factor}`);
  });

  test('25deg hip/valley factor matches QuoteCore+', () => {
    const factor = hipValleyPitchFactor(25);
    assert.ok(factor > 1.03 && factor < 1.06, `Expected ~1.045, got ${factor}`);
  });

  test('45deg rafter factor matches QuoteCore+', () => {
    const factor = rafterPitchFactor(45);
    assert.ok(Math.abs(factor - 1.4142) < 0.001, `Expected ~1.4142, got ${factor}`);
  });

  test('0deg returns 1.0', () => {
    assert.equal(rafterPitchFactor(0), 1);
    assert.equal(hipValleyPitchFactor(0), 1);
  });
});

describe('Phase 6: Parity - entry computation', () => {
  test('actual mode entry', () => {
    const entry: Entry = {
      ...makeEntry(25),
      inputMode: 'actual',
      actualValue: 100,
      computedValue: 0,
    };
    const result = computeEntry(entry, 'roof_area', 'rafter');
    assert.equal(result, 100);
  });

  test('plan mode roof_area entry (25deg)', () => {
    const entry: Entry = {
      ...makeEntry(25),
      inputMode: 'pitch_calculated',
      planWidth: 10,
      planLengthVal: 10,
      computedValue: 0,
    };
    const result = computeEntry(entry, 'roof_area', 'rafter');
    const expected = 100 * rafterPitchFactor(25);
    assert.ok(Math.abs(result - expected) < 0.001, `Expected ${expected}, got ${result}`);
  });

  test('plan mode hip entry (25deg)', () => {
    const entry: Entry = {
      ...makeEntry(25),
      inputMode: 'pitch_calculated',
      planLength: 5,
      computedValue: 0,
    };
    const result = computeEntry(entry, 'hip', 'hip_valley');
    const expected = 5 * hipValleyPitchFactor(25);
    assert.ok(Math.abs(result - expected) < 0.001, `Expected ${expected}, got ${result}`);
  });

  test('quantity multiplier', () => {
    const entry: Entry = {
      ...makeEntry(0),
      inputMode: 'actual',
      actualValue: 50,
      quantity: 3,
      computedValue: 0,
    };
    assert.equal(computeEntry(entry, 'ridge', 'none'), 150);
  });
});

describe('Phase 6: Parity - pricing', () => {
  const comp: RoofComponentDef = {
    id: 'test',
    component_kind: 'roof_area',
    name: 'Test',
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
    roof_types: null,
  };

  test('per_unit material cost', () => {
    const { cost } = computeMaterialCost(110, comp);
    assert.equal(cost, 3300);
  });

  test('known price cost', () => {
    assert.equal(computeKnownPriceCost(5, 25), 125);
    assert.equal(computeKnownPriceCost(0, 25), 0);
  });

  test('labour cost per_unit', () => {
    assert.equal(computeLabourCost(100, comp), 750);
  });

  test('pack pricing', () => {
    const packComp: RoofComponentDef = {
      ...comp,
      pricing_strategy: 'pack',
      pack_size: 10,
      pack_price: 250,
    };
    const { cost, packs } = computeMaterialCost(25, packComp);
    assert.equal(packs, 3);
    assert.equal(cost, 750);
  });
});

describe('Phase 6: Parity - fixed quantity components', () => {
  test('fixed component returns quantity only', () => {
    const fixedDef: CustomComponentDef = {
      id: 'custom-fixed-1',
      name: 'Skylight',
      measurementType: 'fixed',
      pitchType: 'none',
      wastePercent: 0,
    };
    const section = makeCustomSection(fixedDef);
    assert.equal(section.wastePercent, 0);
    assert.ok(isCustomFixed(fixedDef.id));

    const entry: Entry = {
      ...makeEntry(0),
      inputMode: 'actual',
      actualValue: 0,
      quantity: 5,
      computedValue: 0,
    };
    const computed = computeEntry(entry, fixedDef.id, 'none');
    assert.equal(computed, 5);
  });
});

describe('Phase 6: Parity - engine with knownPrice', () => {
  test('engine calculates known-price entries', () => {
    const sections = makeInitialSections();
    const entry: Entry = {
      ...makeEntry(0),
      inputMode: 'actual',
      actualValue: 100,
      computedValue: 100,
      knownPrice: 15,
      selectedComponentId: null,
    };
    sections.roof_area.entries.push(entry);

    const result = calculateTakeoffSections(sections, BUILT_IN_ORDER, () => null, true);
    assert.equal(result.sections.roof_area.materialCost, 1500);
    assert.equal(result.sections.roof_area.labourCost, 0);
    assert.equal(result.grandTotal, 1500);
  });

  test('engine calculates component-based entries', () => {
    const sections = makeInitialSections();
    const comp: RoofComponentDef = {
      id: 'comp-1',
      component_kind: 'roof_area',
      name: 'Iron',
      description: null,
      unit: 'm2',
      price_per_unit: 20,
      pricing_strategy: 'per_unit',
      pack_size: null,
      pack_price: null,
      labour_rate: 10,
      labour_unit: 'per_unit',
      suggested_waste_percent: 5,
      pitch_type: 'rafter',
      is_active: true,
      sort_order: 0,
      roof_types: null,
    };

    const entry: Entry = {
      ...makeEntry(0),
      inputMode: 'actual',
      actualValue: 100,
      computedValue: 100,
      selectedComponentId: 'comp-1',
    };
    sections.roof_area.entries.push(entry);

    const result = calculateTakeoffSections(
      sections,
      BUILT_IN_ORDER,
      (id) => id === 'comp-1' ? comp : null,
      true,
    );

    // Material cost = 100 * $20 = 2000 (waste is display-only, not applied to cost)
    assert.equal(result.sections.roof_area.materialCost, 2000);
    // Labour cost = 100 * $10 = 1000
    assert.equal(result.sections.roof_area.labourCost, 1000);
    // Grand total = 2000 + 1000 = 3000
    assert.equal(result.grandTotal, 3000);
  });
});
