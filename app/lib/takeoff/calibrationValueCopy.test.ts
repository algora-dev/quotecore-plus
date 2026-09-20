// P1-11 (Phase E audit 2026-09-20): review copy adapts to the partial-read
// valueState instead of a generic "could not read the distance".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationStatusCopy, disagreementResolutionCopy, valueStateCopy } from './calibrationValueCopy';

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

// UX-2: plain-language status, no pixels-per-unit in user-facing copy.
test('calibrationStatusCopy: single accepted measurement is ready', () => {
  const c = calibrationStatusCopy({ acceptedCount: 1, disagreeing: false });
  assert.equal(c.headline, '1 measurement accepted');
  assert.equal(c.detail, 'Calibration ready.');
  assert.ok(!`${c.headline} ${c.detail}`.includes('/px'));
});

test('calibrationStatusCopy: multiple agreeing measurements say they agree closely', () => {
  const c = calibrationStatusCopy({ acceptedCount: 2, disagreeing: false });
  assert.equal(c.headline, '2 measurements accepted');
  assert.equal(c.detail, 'They agree closely.');
  const three = calibrationStatusCopy({ acceptedCount: 3, disagreeing: false });
  assert.equal(three.headline, '3 measurements accepted');
});

test('calibrationStatusCopy: disagreeing measurements say the scale may be off', () => {
  const c = calibrationStatusCopy({ acceptedCount: 2, disagreeing: true });
  assert.equal(c.headline, '2 measurements accepted');
  assert.match(c.detail, /disagree/);
  assert.match(c.detail, /scale may be off/);
});

// UX-4: disagreement resolution states the averaging behaviour explicitly.
test('disagreementResolutionCopy: states averaging plus the tolerance', () => {
  const text = disagreementResolutionCopy(24.31, 10);
  assert.match(text, /24\.31%/);
  assert.match(text, /10%/);
  assert.match(text, /average the accepted measurements/);
});
