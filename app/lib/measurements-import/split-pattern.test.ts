import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSplitPairs, readSplit, guessUnitForKind, initialStatusFor } from './domain';

test('split: a decimal number is the measurement, a round number the count ("4.5 x 4")', () => {
  const pairs = parseSplitPairs('Hips - 4.5 x 4');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].a, 4.5);
  assert.equal(pairs[0].b, 4);
  assert.equal(pairs[0].sep, 'x');
  assert.equal(pairs[0].ambiguous, false);
  const reading = readSplit(pairs);
  assert.deepEqual(reading.entries, [4.5, 4.5, 4.5, 4.5]);
  assert.equal(reading.unit, null);
  assert.equal(reading.ambiguous, false);
});

test('split: multiple pairs on one line each contribute entries', () => {
  const reading = readSplit(parseSplitPairs('Ridges - 2.8 x 1, 2.6 x 1'));
  assert.deepEqual(reading.entries, [2.8, 2.6]);
  assert.equal(reading.ambiguous, false);
});

test('split: a written unit marks the measurement side ("4 x 5.5m")', () => {
  const reading = readSplit(parseSplitPairs('4 x 5.5m'));
  assert.deepEqual(reading.entries, [5.5, 5.5, 5.5, 5.5]);
  assert.equal(reading.unit, 'm');
  assert.equal(reading.ambiguous, false);
});

test('split: "at" means quantity first ("2 at 4" = two 4m runs)', () => {
  const reading = readSplit(parseSplitPairs('2 at 4'));
  assert.deepEqual(reading.entries, [4, 4]);
  assert.equal(reading.ambiguous, false);
  const atUnit = readSplit(parseSplitPairs('2 @ 4m'));
  assert.deepEqual(atUnit.entries, [4, 4]);
  assert.equal(atUnit.unit, 'm');
});

test('split: both round with x is ambiguous, defaults to quantity first ("2 x 4" = 2 runs of 4)', () => {
  const pairs = parseSplitPairs('2 x 4');
  assert.equal(pairs[0].ambiguous, true);
  const reading = readSplit(pairs);
  assert.deepEqual(reading.entries, [4, 4]);
  assert.equal(reading.ambiguous, true);
  // One-tap swap flips the interpretation and clears the ambiguity flag upstream.
  const swapped = readSplit(pairs, true);
  assert.deepEqual(swapped.entries, [2, 2, 2, 2]);
});

test('split: single-number lines are not pair patterns', () => {
  assert.equal(parseSplitPairs('Roof area - 68.9m2').length, 0);
  assert.equal(parseSplitPairs('Spouting - 33m').length, 0);
});

test('split: a non-integer count is not a count – keep both numbers, flag it', () => {
  const reading = readSplit(parseSplitPairs('2.5 x 4.5'));
  assert.deepEqual(reading.entries, [2.5, 4.5]);
  assert.equal(reading.ambiguous, true);
});

test('split: an area unit on the measurement side reads the pair as area', () => {
  const pairs = parseSplitPairs('Sheets - 2 x 30m2');
  assert.equal(pairs[0].bUnit, 'm2');
  const reading = readSplit(pairs);
  assert.deepEqual(reading.entries, [30, 30]);
  assert.equal(reading.unit, 'm2');
});

test('guess unit follows the account measurement system (owner 2026-11-24)', () => {
  assert.equal(guessUnitForKind('lineal', 'metric'), 'm');
  assert.equal(guessUnitForKind('lineal', 'imperial_ft'), 'ft');
  assert.equal(guessUnitForKind('area', 'metric'), 'm²');
  assert.equal(guessUnitForKind('area', 'imperial_ft'), 'ft²');
  assert.equal(guessUnitForKind('area', 'imperial_rs'), 'RS');
  assert.equal(guessUnitForKind('quantity', 'imperial_ft'), 'ea');
  // No system given = metric (back-compat with v2.2 callers).
  assert.equal(guessUnitForKind('lineal'), 'm');
});

test('ambiguous splits never auto-select (owner 2026-11-24)', () => {
  assert.equal(initialStatusFor({ matchedComponentId: 'x', unit: 'm', split: { ambiguous: true } }), 'candidate');
  assert.equal(initialStatusFor({ matchedComponentId: 'x', unit: 'm', split: { ambiguous: false } }), 'selected');
  assert.equal(initialStatusFor({ matchedComponentId: 'x', unit: 'm' }), 'selected');
});
