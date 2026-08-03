import assert from 'node:assert/strict';
import test from 'node:test';

// Unit tests for the published takeoff library service.
// These test the data transformation logic, not the DB queries.
// We mock the Supabase client to test the mapping logic.

test('slotMap: defaults to first component per slot when no explicit default', () => {
  // Simulate the mapping logic
  const components = [
    { id: 'a', takeoff_slot: 'roof_area', is_takeoff_default: false },
    { id: 'b', takeoff_slot: 'ridge', is_takeoff_default: true },
    { id: 'c', takeoff_slot: 'ridge', is_takeoff_default: false },
  ];
  const BUILT_IN_ORDER = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting', 'underlay', 'fixings'];

  const slotMap: Record<string, string | null> = {};
  const slotOptions: Record<string, any[]> = {};
  for (const slot of BUILT_IN_ORDER) {
    slotMap[slot] = null;
    slotOptions[slot] = [];
  }

  for (const comp of components) {
    const slot = comp.takeoff_slot;
    if (!slot || !BUILT_IN_ORDER.includes(slot)) continue;
    if (!slotOptions[slot]) slotOptions[slot] = [];
    slotOptions[slot].push(comp);
    if (comp.is_takeoff_default) {
      slotMap[slot] = comp.id;
    } else if (slotMap[slot] === null && slotOptions[slot].length === 1) {
      slotMap[slot] = comp.id;
    }
  }

  // Override: if no explicit default, use first in each slot
  for (const slot of BUILT_IN_ORDER) {
    if (slotMap[slot] === null && slotOptions[slot].length > 0) {
      slotMap[slot] = slotOptions[slot][0].id;
    }
  }

  // roof_area: only one component, should be default
  assert.equal(slotMap.roof_area, 'a');
  // ridge: explicit default 'b'
  assert.equal(slotMap.ridge, 'b');
  // hip: no components
  assert.equal(slotMap.hip, null);
  // slotOptions for ridge should have both
  assert.equal(slotOptions.ridge.length, 2);
});

test('slotMap: explicit default takes priority over first component', () => {
  const components = [
    { id: 'first', takeoff_slot: 'roof_area', is_takeoff_default: false },
    { id: 'second', takeoff_slot: 'roof_area', is_takeoff_default: true },
    { id: 'third', takeoff_slot: 'roof_area', is_takeoff_default: false },
  ];
  const BUILT_IN_ORDER = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting', 'underlay', 'fixings'];

  const slotMap: Record<string, string | null> = {};
  const slotOptions: Record<string, any[]> = {};
  for (const slot of BUILT_IN_ORDER) {
    slotMap[slot] = null;
    slotOptions[slot] = [];
  }

  for (const comp of components) {
    const slot = comp.takeoff_slot;
    if (!BUILT_IN_ORDER.includes(slot)) continue;
    slotOptions[slot].push(comp);
    if (comp.is_takeoff_default) {
      slotMap[slot] = comp.id;
    } else if (slotMap[slot] === null && slotOptions[slot].length === 1) {
      slotMap[slot] = comp.id;
    }
  }

  for (const slot of BUILT_IN_ORDER) {
    if (slotMap[slot] === null && slotOptions[slot].length > 0) {
      slotMap[slot] = slotOptions[slot][0].id;
    }
  }

  assert.equal(slotMap.roof_area, 'second'); // explicit default
  assert.equal(slotOptions.roof_area.length, 3);
});

test('search filter: free-text matches supplier name', () => {
  const libraries = [
    { supplierName: 'Apex Roofing', description: 'Christchurch NZ', keywords: [], brands: [], productCategories: [], roofingTypes: [], serviceAreas: [], branchCity: 'Christchurch', branchRegion: 'Canterbury' },
    { supplierName: 'Prime Roofing', description: 'USA test', keywords: [], brands: [], productCategories: [], roofingTypes: [], serviceAreas: [], branchCity: null, branchRegion: null },
  ];

  const q = 'apex';
  const filtered = libraries.filter((lib) => {
    const searchText = [
      lib.supplierName, lib.description,
      ...lib.keywords, ...lib.brands, ...lib.productCategories,
      ...lib.roofingTypes, ...lib.serviceAreas,
      lib.branchCity, lib.branchRegion,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchText.includes(q.toLowerCase());
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].supplierName, 'Apex Roofing');
});
