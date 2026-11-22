import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLine } from './auto-match';
import { guessUnitForKind, initialStatusFor } from './domain';

const comp = (id: string, name: string, measurement_type = 'lineal') =>
  ({ id, name, sku: null, measurement_type } as const);

test('plain component outranks a qualified one for a bare label (owner 2026-11-22)', () => {
  const result = matchLine('Valleys', 'lineal', [comp('t', 'Tapered Valley Flashing'), comp('p', 'Valley Flashing')]);
  assert.equal(result.componentId, 'p');
});

test('a qualified match is never HIGH confidence for a bare label', () => {
  const result = matchLine('Valleys', 'lineal', [comp('t', 'Tapered Valley Flashing')]);
  assert.equal(result.componentId, 't');
  assert.notEqual(result.confidence, 'high');
});

test('exact name agreement is the only automatic HIGH', () => {
  const result = matchLine('Roof area', 'area', [comp('r', 'Roof Area', 'irregular_area')]);
  assert.equal(result.componentId, 'r');
  assert.equal(result.confidence, 'high');
});

test('ridges matches roll top ridging via slot + gerund alias', () => {
  const result = matchLine('Ridges', 'lineal', [comp('rt', 'Roll Top Ridging')]);
  assert.equal(result.componentId, 'rt');
});

test('barges match barge flashing through the plural slot', () => {
  const result = matchLine('Barges', 'lineal', [comp('b', 'Barge Flashing')]);
  assert.equal(result.componentId, 'b');
});

test('no sensible match stays empty', () => {
  const result = matchLine('Chimney sweep visit', 'lineal', [comp('b', 'Barge Flashing')]);
  assert.equal(result.componentId, null);
  assert.equal(result.confidence, 'none');
});

test('unit guesses map by kind and gate the initial selected state', () => {
  assert.equal(guessUnitForKind('area'), 'm²');
  assert.equal(guessUnitForKind('lineal'), 'm');
  assert.equal(guessUnitForKind('quantity'), 'ea');
  assert.equal(initialStatusFor({ matchedComponentId: 'x', unit: 'm' }), 'selected');
  assert.equal(initialStatusFor({ matchedComponentId: null, unit: 'm' }), 'candidate');
  assert.equal(initialStatusFor({ matchedComponentId: 'x', unit: '' }), 'candidate');
});
