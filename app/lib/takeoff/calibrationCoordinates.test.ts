// Transform tests (spec 5.5): round trips, crop offsets, non-integer ratios,
// portrait/landscape, singular/NaN rejection, out-of-bounds rejection,
// reversed endpoint order and viewport independence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CANVAS_DIM,
  TransformError,
  analysisPointToScene,
  applyAffine,
  assertPointInRaster,
  buildAnalysisToSource,
  buildSourceToScene,
  composeAffine,
  distance,
  invertAffine,
  isAffineInvertible,
  isPointInRaster,
  roundTripError,
} from './calibrationCoordinates';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('source <-> scene round trip with fractional coords, landscape', () => {
  const s = buildSourceToScene(4000, 3000); // scale 0.5
  close(s.transform[0], 0.5);
  close(s.sceneWidth, 2000); close(s.sceneHeight, 1500);
  const p = { x: 1234.567, y: 987.654 };
  const scene = applyAffine(s.transform, p);
  close(scene.x, 617.2835); close(scene.y, 493.827);
  close(roundTripError(s.transform, p), 0, 1e-12);
});

test('portrait image keeps aspect with uniform scale', () => {
  const s = buildSourceToScene(1000, 3000);
  close(s.transform[0], MAX_CANVAS_DIM / 3000);
  close(s.sceneWidth, 1000 * (MAX_CANVAS_DIM / 3000));
  close(s.sceneHeight, MAX_CANVAS_DIM);
  const small = buildSourceToScene(800, 600); // no enlargement below the cap
  close(small.transform[0], 1);
});

test('square-ish non-integer scene dims are not rounded or stretched', () => {
  const s = buildSourceToScene(3511, 2400);
  close(s.transform[0], s.transform[3]); // uniform
  close(s.sceneWidth, 3511 * (2000 / 3511), 1e-12);
});

test('source <-> analysis round trip: crop offsets and non-integer resize ratio', () => {
  const a2s = buildAnalysisToSource(120, 80, 500, 400, 733, 587);
  const p = { x: 100.5, y: 50.25 };
  const src = applyAffine(a2s, p);
  close(src.x, 120 + 100.5 * (500 / 733));
  close(src.y, 80 + 50.25 * (400 / 587));
  const result = analysisPointToScene(a2s, [1, 0, 0, 1, 0, 0], p);
  close(result.roundTripErrorPx, 0, 1e-9);
});

test('full-image analysis crop degenerates to identity', () => {
  const t = buildAnalysisToSource(0, 0, 1920, 1080, 1920, 1080);
  const p = { x: 17.25, y: 99.5 };
  close(distance(applyAffine(t, p), p), 0, 1e-12);
});

test('compose/invert agree with direct application', () => {
  const s2s = buildSourceToScene(6000, 4000).transform;
  const a2s = buildAnalysisToSource(50, 60, 1000, 800, 500, 400);
  const combined = composeAffine(s2s, a2s);
  const p = { x: 123.456, y: 234.567 };
  close(distance(applyAffine(combined, p), applyAffine(s2s, applyAffine(a2s, p))), 0, 1e-9);
  close(roundTripError(combined, p), 0, 1e-9);
});

test('singular, NaN and zero-size transforms are rejected', () => {
  assert.equal(isAffineInvertible([1, 0, 0, 0, 0, 0]), false); // y collapsed
  assert.equal(isAffineInvertible([2, 0, 4, 0, 0, 0]), false);
  assert.throws(() => invertAffine([1, 0, 0, 0, 0, 0]), TransformError);
  assert.throws(() => invertAffine([Number.NaN, 0, 0, 1, 0, 0]), TransformError);
  assert.throws(() => applyAffine([1, 0, 0, 1, 0, Number.POSITIVE_INFINITY], { x: 1, y: 1 }), TransformError);
  assert.throws(() => buildAnalysisToSource(0, 0, 0, 100, 50, 50), TransformError);
  assert.throws(() => buildSourceToScene(-1, 100), TransformError);
});

test('out-of-raster points are rejected, not clamped', () => {
  assert.equal(isPointInRaster({ x: 5, y: 5 }, 10, 10), true);
  assert.equal(isPointInRaster({ x: 10, y: 10 }, 10, 10), true); // geometric edge is valid
  assert.equal(isPointInRaster({ x: 10.001, y: 5 }, 10, 10), false);
  assert.throws(() => assertPointInRaster({ x: -0.01, y: 0 }, 10, 10, 'test'), TransformError);
  assert.throws(() => assertPointInRaster({ x: 11, y: Number.NaN }, 10, 10, 'test'), TransformError);
  // documented tiny tolerance only
  assert.doesNotThrow(() => assertPointInRaster({ x: 10 + 1e-9, y: 0 }, 10, 10, 'test'));
});

test('reversed endpoint order yields identical scene mapping', () => {
  const t = buildSourceToScene(5000, 5000).transform;
  const p1 = { x: 100.5, y: 200.5 };
  const p2 = { x: 900.5, y: 800.5 };
  const f = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(
      (applyAffine(t, a).x - applyAffine(t, b).x),
      (applyAffine(t, a).y - applyAffine(t, b).y),
    );
  close(f(p1, p2), f(p2, p1), 0);
});

test('viewport independence: scene result is a pure function of source geometry', () => {
  // Simulated viewport states (zoom/pan/devicePixelRatio) must not feed any transform.
  const viewports = [
    { zoom: 1, panX: 0, panY: 0, dpr: 1 },
    { zoom: 3.75, panX: -420.5, panY: 88, dpr: 2 },
    { zoom: 0.4, panX: 1200, panY: -300, dpr: 3 },
  ];
  const t = buildSourceToScene(8000, 6000).transform;
  const p = { x: 3210.75, y: 1234.25 };
  const expected = applyAffine(t, p);
  for (const _v of viewports) {
    // builders/apply take no viewport state; result must be byte-identical each call
    assert.deepEqual(applyAffine(buildSourceToScene(8000, 6000).transform, p), expected);
  }
});
