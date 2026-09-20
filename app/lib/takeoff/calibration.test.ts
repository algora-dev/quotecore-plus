// Golden numerical tests for deterministic calibration maths (spec 9.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibratedArea,
  calibratedLength,
  computeEffectiveCalibration,
  convertScale,
  type CalibrationReferenceInput,
} from './calibration';

const ref = (
  id: string,
  x1: number, y1: number, x2: number, y2: number,
  confirmedDistance: number,
  confirmedUnit: CalibrationReferenceInput['confirmedUnit'],
): CalibrationReferenceInput => ({
  id, sceneP1: { x: x1, y: y1 }, sceneP2: { x: x2, y: y2 },
  confirmedDistance, confirmedUnit,
});

test('golden A alone: 1000 px / 10 m -> 0.0100 m/px', () => {
  const e = computeEffectiveCalibration([ref('A', 0, 0, 1000, 0, 10, 'm')], 'meters');
  assert.ok(Math.abs(e.scale - 0.01) < 1e-12);
  assert.equal(e.validCalibrationCount, 1);
  assert.equal(e.scaleRangePct, 0);
  assert.equal(e.disagreementWarning, null);
  assert.equal(e.aggregationPolicy, 'mean-distance-per-scene-pixel-v1');
});

test('golden A+B mean -> 0.0101 m/px; line 2.02 m; area 1.0201 m2', () => {
  const e = computeEffectiveCalibration(
    [ref('A', 0, 0, 1000, 0, 10, 'm'), ref('B', 0, 0, 500, 0, 5.1, 'm')],
    'meters',
  );
  assert.ok(Math.abs(e.scale - 0.0101) < 1e-12);
  assert.deepEqual(e.contributingCalibrationIds, ['A', 'B']);
  assert.ok(Math.abs(calibratedLength(200, e.scale) - 2.02) < 1e-9);
  assert.ok(Math.abs(calibratedArea(10000, e.scale) - 1.0201) < 1e-9);
  // disagreement: (0.0102-0.0100)/0.0101 = 1.98% < 10% -> no warning
  assert.equal(e.disagreementWarning, null);
});

test('golden C+D: mean 0.03048 m/px and 0.1 ft/px (unit mix m + ft)', () => {
  const inMetres = computeEffectiveCalibration(
    [ref('C', 0, 0, 100, 0, 10, 'ft'), ref('D', 0, 0, 200, 0, 6.096, 'm')],
    'meters',
  );
  assert.ok(Math.abs(inMetres.scale - 0.03048) < 1e-12);
  const inFeet = computeEffectiveCalibration(
    [ref('C', 0, 0, 100, 0, 10, 'ft'), ref('D', 0, 0, 200, 0, 6.096, 'm')],
    'feet',
  );
  assert.ok(Math.abs(inFeet.scale - 0.1) < 1e-12);
  assert.ok(Math.abs(convertScale(inMetres.scale, 'meters', 'feet') - 0.1) < 1e-12);
});

test('single reference mean equals that reference scale', () => {
  const e = computeEffectiveCalibration([ref('only', 10, 10, 10, 835, 12, 'ft')], 'feet');
  assert.ok(Math.abs(e.scale - 12 / 825) < 1e-15);
});

test('long rejected segment has zero effect (only accepted refs enter the mean)', () => {
  // The long candidate was rejected by the user, so it is never part of the accepted
  // reference set handed to computeEffectiveCalibration.
  const accepted = [ref('short', 0, 0, 100, 0, 1, 'm')];
  const e = computeEffectiveCalibration(accepted, 'meters');
  const shortAlone = computeEffectiveCalibration([ref('short', 0, 0, 100, 0, 1, 'm')], 'meters');
  assert.equal(e.scale, shortAlone.scale);
  assert.ok(Math.abs(e.scale - 0.01) < 1e-15);
  // Contrast: if both were accepted, mean-of-ratios differs from the
  // length-weighted ratio-of-sums (15.1/1500); neither may substitute for acceptance.
  const both = computeEffectiveCalibration(
    [ref('short', 0, 0, 100, 0, 1, 'm'), ref('long', 0, 0, 1400, 0, 14.1, 'm')],
    'meters',
  );
  close2(both.scale, (0.01 + 14.1 / 1400) / 2);
  assert.ok(Math.abs(both.scale - 15.1 / 1500) > 1e-6);
});

function close2(a: number, b: number, eps = 1e-12) {
  assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
}

test('reversed endpoint order gives the same scale', () => {
  const a = computeEffectiveCalibration([ref('A', 0, 0, 1000, 0, 10, 'm')], 'meters');
  const b = computeEffectiveCalibration([ref('A', 1000, 0, 0, 0, 10, 'm')], 'meters');
  assert.equal(a.scale, b.scale);
});

test('disagreement warning above 10% threshold, configurable', () => {
  const refs = [ref('A', 0, 0, 1000, 0, 10, 'm'), ref('B', 0, 0, 1000, 0, 11.5, 'm')];
  const e = computeEffectiveCalibration(refs, 'meters');
  assert.ok(e.scaleRangePct > 10);
  assert.ok(e.disagreementWarning != null && e.disagreementWarning.includes('disagree'));
  const lenient = computeEffectiveCalibration(refs, 'meters', { disagreementThresholdPct: 20 });
  assert.equal(lenient.disagreementWarning, null);
});

test('malformed references are rejected, never silently omitted', () => {
  assert.throws(() => computeEffectiveCalibration([], 'meters'), /at least one/);
  assert.throws(() => computeEffectiveCalibration(
    [ref('A', 0, 0, 1000, 0, 10, 'm'), ref('B', 0, 0, 500, 0, 5, 'm'),
     ref('C', 0, 0, 300, 0, 3, 'm'), ref('D', 0, 0, 200, 0, 2, 'm')],
    'meters',
  ), /at most 3/);
  assert.throws(() => computeEffectiveCalibration([ref('A', 0, 0, 1000, 0, -5, 'm')], 'meters'), /positive/);
  assert.throws(() => computeEffectiveCalibration([ref('A', 0, 0, 1000, 0, 0, 'm')], 'meters'), /positive/);
  assert.throws(() => computeEffectiveCalibration([ref('A', 0, 0, 1000, 0, Number.NaN, 'm')], 'meters'), /positive/);
  assert.throws(() => computeEffectiveCalibration([ref('A', 0, 0, 0, 0, 10, 'm')], 'meters'), /zero scene pixel span/);
  assert.throws(() => computeEffectiveCalibration(
    [ref('A', Number.POSITIVE_INFINITY, 0, 1000, 0, 10, 'm')], 'meters'),
    /non-finite/);
});

test('calibratedLength/Length/Area reject invalid inputs', () => {
  assert.throws(() => calibratedLength(10, 0));
  assert.throws(() => calibratedLength(-1, 0.01));
  assert.throws(() => calibratedArea(10, Number.NaN));
});

test('full precision retained: 6.4205 m is not rounded', () => {
  const e = computeEffectiveCalibration([ref('p', 0, 0, 1000, 0, 6.4205, 'm')], 'meters');
  assert.ok(Math.abs(e.scale - 0.0064205) < 1e-15);
});

// 6.3 (audit 2026-09-20): AI-scan value computation must use the canonical
// unit-normalised effective scale, never a raw arithmetic mean of cal.scale.
import { effectiveScaleFromLegacyCalibrations } from './calibration';
import { computeAreaValue, computeLineValue } from './applyAiResults';
import type { Calibration } from './reconstructTypes';

function legacyCal(id: string, unit: 'feet' | 'meters', actualDistance: number): Calibration {
  return {
    id,
    point1: { x: 0, y: 0 },
    point2: { x: 1000, y: 0 },
    pixelDistance: 1000,
    actualDistance,
    unit,
    scale: actualDistance / 1000,
  };
}

test('computeLineValue uses the canonical effective scale for a mixed-unit calibration set', () => {
  const cals = [legacyCal('a', 'feet', 100), legacyCal('b', 'meters', 10)];
  const canonical = effectiveScaleFromLegacyCalibrations(cals);
  const rawMean = cals.reduce((s, c) => s + c.scale, 0) / cals.length;
  assert.notEqual(canonical, rawMean, 'mixed-unit raw mean is not the domain maths');

  const value = computeLineValue({ x: 0, y: 0 }, { x: 500, y: 0 }, cals);
  assert.ok(Math.abs(value - 500 * canonical) < 1e-12);
  assert.notEqual(value, 500 * rawMean);
});

test('computeAreaValue uses the canonical effective scale squared', () => {
  const cals = [legacyCal('a', 'meters', 20), legacyCal('b', 'meters', 10)];
  const canonical = effectiveScaleFromLegacyCalibrations(cals);
  const area = computeAreaValue(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    cals,
  );
  assert.ok(Math.abs(area - 10000 * canonical * canonical) < 1e-9);
});
