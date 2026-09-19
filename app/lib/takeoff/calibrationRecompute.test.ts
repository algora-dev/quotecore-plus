// P3 tests: deterministic recalibration recompute + dependency provenance
// (spec 10.2/10.3, continuation section 14 suite 'calibration-recompute').
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCalibrationRecompute,
  type RecomputeMeasurementRecord,
  type RecomputeRoofAreaRecord,
  type RecomputeInput,
} from './calibrationRecompute';
import { computeEffectiveCalibration } from './calibration';
import type { EffectiveCalibration } from './calibrationTypes';

const eff = (scale: number, unit: 'meters' | 'feet' = 'meters'): EffectiveCalibration => ({
  scale,
  unit,
  aggregationPolicy: 'mean-distance-per-scene-pixel-v1',
  contributingCalibrationIds: ['t'],
  validCalibrationCount: 1,
  scaleRangePct: 0,
  disagreementWarning: null,
});

const SQUARE_100 = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

const line = (id: string, p1: { x: number; y: number }, p2: { x: number; y: number }, value: number): RecomputeMeasurementRecord =>
  ({ id, type: 'line', value, points: [p1, p2] });

const area = (id: string, points: Array<{ x: number; y: number }>, value: number): RecomputeMeasurementRecord =>
  ({ id, type: 'area', value, points });

const roof = (id: string, points: Array<{ x: number; y: number }>, areaValue: number, pitch = 0): RecomputeRoofAreaRecord =>
  ({ id, points, area: areaValue, pitch, quoteRoofAreaId: 'ra-1' });

const run = (input: RecomputeInput) => computeCalibrationRecompute(input);

test('scale change updates line lengths linearly and areas quadratically', () => {
  const oldScale = 0.1; // ft/px
  const newCal = eff(0.2, 'feet'); // 2x linear -> 4x area
  const r = run({
    measurements: [
      line('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, 10),
      area('A1', SQUARE_100, 100),
    ],
    roofAreas: [],
    oldScale,
    newCalibration: newCal,
  });
  assert.ok(r.ok, JSON.stringify(r.errors));
  const l = r.measurementUpdates.find((u) => u.id === 'L1')!;
  const a = r.measurementUpdates.find((u) => u.id === 'A1')!;
  assert.equal(l.value, 100 * 0.2); // 20 ft (linear)
  assert.equal(a.value, 10000 * 0.2 * 0.2); // 400 sq ft (quadratic)
});

test('mixed record set: dependent records updated, independent point count skipped and listed', () => {
  const r = run({
    measurements: [
      line('L1', { x: 0, y: 0 }, { x: 50, y: 0 }, 5),
      { id: 'P1', type: 'point', value: 7 },
    ],
    roofAreas: [roof('R1', SQUARE_100, 100)],
    oldScale: 0.1,
    newCalibration: eff(0.1, 'meters'),
  });
  assert.ok(r.ok);
  assert.equal(r.measurementUpdates.length, 1);
  assert.equal(r.roofAreaUpdates.length, 1);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].id, 'P1');
  assert.match(r.skipped[0].reason, /scale-independent/);
  // point value must not be rewritten anywhere
  assert.ok(!r.measurementUpdates.some((u) => u.id === 'P1'));
});

test('stale scale does not survive: every scale-dependent value is recomputed from pixels', () => {
  // Values below carry deliberately wrong (stale) magnitudes.
  const r = run({
    measurements: [
      line('L1', { x: 0, y: 0 }, { x: 200, y: 0 }, 999), // stale
      area('A1', SQUARE_100, 1), // stale
    ],
    roofAreas: [roof('R1', SQUARE_100, 0.5)],
    oldScale: 0.05,
    newCalibration: eff(0.05, 'meters'),
  });
  assert.ok(r.ok);
  assert.equal(r.measurementUpdates.find((u) => u.id === 'L1')!.value, 10);
  assert.equal(r.measurementUpdates.find((u) => u.id === 'A1')!.value, 25);
  assert.equal(r.roofAreaUpdates.find((u) => u.id === 'R1')!.area, 25);
});

test('plan_value derived from source area refreshes with provenance (source_geometry_id)', () => {
  const newCal = eff(0.2, 'feet');
  const derived: RecomputeMeasurementRecord = {
    id: 'D1',
    type: 'area',
    value: 100 * Math.sqrt(2), // pitched snapshot at 45 deg
    points: [], // geometry-free attached entry
    entryInputs: { value_basis: 'pitched', plan_value: 100, source_geometry_id: 'R1' },
    quoteRoofAreaId: 'ra-1',
  };
  const r = run({
    measurements: [derived],
    roofAreas: [roof('R1', SQUARE_100, 100, 45)],
    oldScale: 0.1,
    newCalibration: newCal,
  });
  assert.ok(r.ok, JSON.stringify(r.errors));
  const u = r.measurementUpdates.find((m) => m.id === 'D1')!;
  assert.equal(u.planValue, 400); // 10000 px^2 * 0.2^2
  // pitched basis: plan * rafterPitchFactor(45deg), pitch applied exactly once
  assert.ok(Math.abs(u.value - 400 / Math.cos((45 * Math.PI) / 180)) < 1e-9);
  assert.equal(r.provenance.length, 1);
  assert.equal(r.provenance[0].measurementId, 'D1');
  assert.equal(r.provenance[0].sourceGeometryId, 'R1');
  assert.equal(r.provenance[0].resolution, 'source_geometry_id');
  // source polygon itself rescaled quadratically, pitch field untouched by recompute
  assert.equal(r.roofAreaUpdates.find((a) => a.id === 'R1')!.area, 400);
});

test('legacy derived entry without source link resolves via unique area match; ambiguous match blocks', () => {
  const derived: RecomputeMeasurementRecord = {
    id: 'D1',
    type: 'area',
    value: 100,
    points: [],
    entryInputs: { value_basis: 'plan', plan_value: 100 },
    quoteRoofAreaId: 'ra-1',
  };
  const unique = run({
    measurements: [derived],
    roofAreas: [roof('R1', SQUARE_100, 100)],
    oldScale: 0.1,
    newCalibration: eff(0.1, 'meters'),
  });
  assert.ok(unique.ok);
  assert.equal(unique.provenance[0].resolution, 'unique_area_match');
  assert.equal(unique.measurementUpdates.find((m) => m.id === 'D1')!.planValue, 100);

  const ambiguous = run({
    measurements: [derived],
    roofAreas: [roof('R1', SQUARE_100, 100), roof('R2', SQUARE_100, 100)],
    oldScale: 0.1,
    newCalibration: eff(0.2, 'meters'),
  });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.errors[0].code, 'AMBIGUOUS_SOURCE');
  assert.equal(ambiguous.errors[0].recordId, 'D1');
});

test('derived entry with unresolvable source falls back to ratio only when old scale is known', () => {
  const derived: RecomputeMeasurementRecord = {
    id: 'D9',
    type: 'area',
    value: 100,
    points: [],
    entryInputs: { value_basis: 'plan', plan_value: 100 },
    quoteRoofAreaId: 'ra-gone',
  };
  const withOld = run({
    measurements: [derived],
    roofAreas: [],
    oldScale: 0.1,
    newCalibration: eff(0.2, 'meters'),
  });
  assert.ok(withOld.ok);
  assert.equal(withOld.measurementUpdates.find((m) => m.id === 'D9')!.planValue, 400); // 100 * 2^2
  assert.equal(withOld.provenance[0].resolution, 'scale_ratio');
  assert.equal(withOld.provenance[0].sourceGeometryId, null);

  const noOld = run({
    measurements: [derived],
    roofAreas: [],
    oldScale: null,
    newCalibration: eff(0.2, 'meters'),
  });
  assert.equal(noOld.ok, false);
  assert.equal(noOld.errors[0].code, 'MISSING_OLD_SCALE');
});

test('malformed / missing-geometry records are rejected as errors, never silently dropped', () => {
  const r = run({
    measurements: [
      { id: 'BAD', type: 'line', value: 5, points: [{ x: 0, y: 0 }] }, // 1 point only
      { id: 'WORSE', type: 'line', value: 5 }, // no points at all
      { id: 'ZERO', type: 'area', value: 5, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] }, // degenerate
    ],
    roofAreas: [roof('RBAD', [{ x: 0, y: 0 }, { x: 1, y: 1 }], 10)], // < 3 points
    oldScale: 0.1,
    newCalibration: eff(0.2, 'meters'),
  });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 4);
  assert.ok(r.errors.every((e) => e.code === 'MISSING_GEOMETRY'));
  assert.deepEqual(r.errors.map((e) => e.recordId).sort(), ['BAD', 'RBAD', 'WORSE', 'ZERO']);
  // no partial result: nothing applied
  assert.equal(r.measurementUpdates.length, 0);
  assert.equal(r.roofAreaUpdates.length, 0);
});

test('unit conversion m <-> ft: imperial page recalibrated in meters yields exact metric values', () => {
  const oldScale = 0.1; // ft/px
  const newCal = eff(0.03048, 'meters'); // exactly 0.1 ft/px in meters
  const r = run({
    measurements: [
      line('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, 10), // 10 ft before
      area('A1', SQUARE_100, 100), // 100 sq ft before
    ],
    roofAreas: [roof('R1', SQUARE_100, 100)],
    oldScale,
    newCalibration: newCal,
  });
  assert.ok(r.ok);
  const l = r.measurementUpdates.find((u) => u.id === 'L1')!;
  assert.ok(Math.abs(l.value - 3.048) < 1e-12); // 10 ft -> 3.048 m
  const a = r.measurementUpdates.find((u) => u.id === 'A1')!;
  assert.ok(Math.abs(a.value - (10000 * 0.03048 * 0.03048)) < 1e-12); // sq m
});

test('freestyle and volume values use metric pixel scale with entered height/depth unchanged', () => {
  const r = run({
    measurements: [
      {
        id: 'F1',
        type: 'length_x_height_freestyle',
        value: 50,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        entryInputs: { height_m: 2 },
      },
      {
        id: 'V1',
        type: 'volume_3d',
        value: 50,
        points: SQUARE_100,
        entryInputs: { depth_m: 0.5 },
      },
    ],
    roofAreas: [],
    oldScale: 0.03048,
    newCalibration: eff(0.06096, 'meters'),
  });
  assert.ok(r.ok, JSON.stringify(r.errors));
  const f = r.measurementUpdates.find((u) => u.id === 'F1')!;
  assert.ok(Math.abs(f.value - (100 * 0.06096 * 2)) < 1e-12); // length * height, height preserved
  const v = r.measurementUpdates.find((u) => u.id === 'V1')!;
  assert.ok(Math.abs(v.value - (10000 * 0.06096 * 0.06096 * 0.5)) < 1e-12); // plan area * depth
});

test('identity case: same scale -> no numeric churn beyond FP epsilon', () => {
  const oldScale = 0.03048;
  const newCal = eff(oldScale, 'meters');
  const pxL1 = Math.hypot(731.2 - 10.5, 400.125 - 3.25);
  const r = run({
    measurements: [
      line('L1', { x: 10.5, y: 3.25 }, { x: 731.2, y: 400.125 }, pxL1 * oldScale),
      area('A1', SQUARE_100, 10000 * oldScale * oldScale),
      {
        id: 'M1',
        type: 'multi_lineal',
        value: 200 * oldScale, // 100+100 px polyline
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      },
    ],
    roofAreas: [roof('R1', SQUARE_100, 10000 * oldScale * oldScale)],
    oldScale,
    newCalibration: newCal,
  });
  assert.ok(r.ok);
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const before: Record<string, number> = {
    L1: pxL1 * oldScale,
    A1: 10000 * oldScale * oldScale,
    M1: 200 * oldScale,
  };
  for (const u of r.measurementUpdates) {
    assert.ok(near(u.value, before[u.id]), `${u.id}: ${u.value} vs ${before[u.id]}`);
  }
  assert.ok(near(r.roofAreaUpdates[0].area, 10000 * oldScale * oldScale));
});

test('effective calibration from computeEffectiveCalibration drives identical recompute (integration contract)', () => {
  const e = computeEffectiveCalibration(
    [
      { id: 'c1', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 500, y: 0 }, confirmedDistance: 10, confirmedUnit: 'm' },
      { id: 'c2', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 1000, y: 0 }, confirmedDistance: 20.5, confirmedUnit: 'm' },
    ],
    'meters',
  );
  const r = run({
    measurements: [line('L1', { x: 0, y: 0 }, { x: 250, y: 0 }, 5)],
    roofAreas: [],
    oldScale: 0.02,
    newCalibration: e,
  });
  assert.ok(r.ok);
  assert.ok(Math.abs(r.measurementUpdates[0].value - 250 * e.scale) < 1e-12);
});
