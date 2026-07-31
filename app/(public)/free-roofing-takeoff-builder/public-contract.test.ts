import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery } from './public-contract';

test('acceptance fixture produces deterministic actual measurements', () => {
  const result = calculatePublicRoofTakeoff({
    mode: 'actual',
    units: 'metric',
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.results.components.roof_area.rawTotal, 126);
  assert.equal(result.results.components.hip.rawTotal, 20);
  assert.equal(result.results.components.ridge.rawTotal, 8);
  assert.equal(result.results.components.valley.rawTotal, 8);
  assert.equal(result.results.components.spouting.rawTotal, 18);
  assert.equal(result.results.components.roof_area.withWaste, 138.60000000000002);
  assert.ok(result.warnings.includes('pricing_unavailable'));
});

test('documented object measurements produce the same totals', () => {
  const result = calculatePublicRoofTakeoff({
    mode: 'actual', units: 'metric', roofArea: 126, pitchDegrees: 25,
    hips: [{ length: 5 }, { length: 5 }, { length: 5 }, { length: 5 }],
    ridges: [{ length: 8 }], valleys: [{ length: 4 }, { length: 4 }],
    spouting: [{ length: 18 }],
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.results.components.hip.rawTotal, 20);
  assert.equal(result.results.components.ridge.rawTotal, 8);
  assert.equal(result.results.components.valley.rawTotal, 8);
  assert.equal(result.results.components.spouting.rawTotal, 18);
});

test('plan mode applies rafter and hip-valley pitch factors', () => {
  const result = calculatePublicRoofTakeoff({ mode: 'plan', units: 'metric', pitchDegrees: 60, area: 100, hips: [10] });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(Math.abs(result.results.components.roof_area.rawTotal - 200) < 1e-10);
  assert.ok(Math.abs(result.results.components.hip.rawTotal - (10 * Math.sqrt(2.5))) < 1e-10);
});

test('query aliases normalize gutter and ridge values', () => {
  const input = parseQueryInput(new URLSearchParams('mode=actual&units=metric&area=126&hips=5,5&ridge=8&gutter=18'));
  assert.deepEqual(input.ridges, [8]);
  assert.deepEqual(input.spouting, [18]);
});

test('generated result queries restore every supported built-in length', () => {
  const original = {
    mode: 'actual' as const, units: 'metric' as const, area: 126,
    hips: [5, 5, 5, 5], ridges: [8], valleys: [4, 4], barges: [3], spouting: [18],
  };
  const restored = parseQueryInput(new URLSearchParams(toResultQuery(original)));
  assert.deepEqual(restored.hips, original.hips);
  assert.deepEqual(restored.ridges, original.ridges);
  assert.deepEqual(restored.valleys, original.valleys);
  assert.deepEqual(restored.barges, original.barges);
  assert.deepEqual(restored.spouting, original.spouting);
});

test('invalid pitch returns an explicit validation error', () => {
  const result = calculatePublicRoofTakeoff({ mode: 'plan', pitchDegrees: 90, area: 100 });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.errors, [{ field: 'pitchDegrees', message: 'Pitch must be between 0 and 89 degrees.' }]);
});
