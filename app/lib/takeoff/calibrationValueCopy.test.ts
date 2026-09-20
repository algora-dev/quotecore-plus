// P1-11 (Phase E audit 2026-09-20): review copy adapts to the partial-read
// valueState instead of a generic "could not read the distance".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueStateCopy } from './calibrationValueCopy';

test('valueStateCopy: readable keeps the AI-read phrasing', () => {
  const text = valueStateCopy({ valueState: 'readable', suggestedDistance: 6.42, suggestedUnit: 'm', sourceLabelText: '6.42 m' });
  assert.match(text, /AI read 6\.42 m/);
  assert.match(text, /Check the printed distance/);
});

test('valueStateCopy: needs_unit names the read number and asks for the unit', () => {
  const text = valueStateCopy({ valueState: 'needs_unit', suggestedDistance: 6420, suggestedUnit: null, sourceLabelText: '6420' });
  assert.match(text, /read the number 6420/);
  assert.match(text, /unit/);
  assert.doesNotMatch(text, /could not read the distance\./);
});

test('valueStateCopy: needs_distance names the read unit and asks for the number', () => {
  const text = valueStateCopy({ valueState: 'needs_distance', suggestedDistance: null, suggestedUnit: 'mm', sourceLabelText: null });
  assert.match(text, /unit appears to be mm/);
  assert.match(text, /could not read the number/);
});

test('valueStateCopy: needs_both says both fields are missing', () => {
  const text = valueStateCopy({ valueState: 'needs_both', suggestedDistance: null, suggestedUnit: null, sourceLabelText: null });
  assert.match(text, /distance or unit/);
});

test('valueStateCopy: defensive fallbacks when partial fields are unexpectedly null', () => {
  // needs_distance without a unit (defensive): still instructs distance entry.
  const a = valueStateCopy({ valueState: 'needs_distance', suggestedDistance: null, suggestedUnit: null, sourceLabelText: null });
  assert.match(a, /Enter the distance/);
  // needs_unit without a number (defensive): still instructs distance entry.
  const b = valueStateCopy({ valueState: 'needs_unit', suggestedDistance: null, suggestedUnit: null, sourceLabelText: null });
  assert.match(b, /Enter the distance/);
});
