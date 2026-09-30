// Corner counting tests (owner request 2026-09-30): classification,
// near-collinear noise suppression, winding invariance, aggregation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyOutlineCorners,
  cornerTotalsAcross,
  cornerSelection,
  cornerValueBasis,
  cornerBasisFromValueBasis,
  isCornerValueBasis,
} from './cornerCount';

const rect = [
  { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 },
];
const lShape = [
  { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
  { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 },
];

test('rectangle: 4 external, 0 internal', () => {
  const c = classifyOutlineCorners(rect);
  assert.equal(c.externalCount, 4);
  assert.equal(c.internalCount, 0);
  assert.equal(c.totalCount, 4);
});

test('L-shape: 5 external, 1 internal (the notch)', () => {
  const c = classifyOutlineCorners(lShape);
  assert.equal(c.externalCount, 5);
  assert.equal(c.internalCount, 1);
  assert.deepEqual(c.internalPoints[0], { x: 100, y: 100 });
});

test('winding-invariant: reversed polygon gives identical counts', () => {
  const cw = classifyOutlineCorners(lShape);
  const ccw = classifyOutlineCorners([...lShape].reverse());
  assert.equal(ccw.externalCount, cw.externalCount);
  assert.equal(ccw.internalCount, cw.internalCount);
  assert.equal(ccw.internalPoints[0].x, 100);
  assert.equal(ccw.internalPoints[0].y, 100);
});

test('near-collinear scan noise is ignored', () => {
  // Extra vertex 3px off the top edge (~2.3 deg deviation) - noise, not a corner.
  const noisy = [
    { x: 0, y: 0 }, { x: 150, y: 3 }, { x: 300, y: 0 },
    { x: 300, y: 200 }, { x: 0, y: 200 },
  ];
  const c = classifyOutlineCorners(noisy);
  assert.equal(c.externalCount, 4);
  assert.equal(c.internalCount, 0);
});

test('a genuine 30-degree direction change counts as a corner', () => {
  // Kink of 15 deg each side of the top edge = 30 deg total turn.
  const joggle = [
    { x: 0, y: 0 }, { x: 150, y: -40 }, { x: 300, y: 0 },
    { x: 300, y: 200 }, { x: 0, y: 200 },
  ];
  const c = classifyOutlineCorners(joggle);
  assert.equal(c.totalCount, 5);
});

test('a sub-threshold 8-degree direction change is ignored', () => {
  // 4 deg each side = 8 deg total turn, below the 10 deg default.
  const subtle = [
    { x: 0, y: 0 }, { x: 150, y: -10.5 }, { x: 300, y: 0 },
    { x: 300, y: 200 }, { x: 0, y: 200 },
  ];
  const c = classifyOutlineCorners(subtle);
  assert.equal(c.totalCount, 4);
});

test('degenerate input returns zeros, never throws', () => {
  assert.equal(classifyOutlineCorners([]).totalCount, 0);
  assert.equal(classifyOutlineCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }]).totalCount, 0);
  assert.equal(classifyOutlineCorners(null).totalCount, 0);
  // Collinear points = zero area.
  assert.equal(classifyOutlineCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]).totalCount, 0);
});

test('cornerTotalsAcross aggregates across outlines and skips degenerate', () => {
  const t = cornerTotalsAcross([
    { points: rect },
    { points: lShape },
    { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    null,
  ]);
  assert.equal(t.externalCount, 9);
  assert.equal(t.internalCount, 1);
  assert.equal(t.totalCount, 10);
});

test('cornerSelection returns count + marker points per basis', () => {
  const t = cornerTotalsAcross([{ points: lShape }]);
  assert.equal(cornerSelection(t, 'all').count, 6);
  assert.equal(cornerSelection(t, 'external').count, 5);
  assert.equal(cornerSelection(t, 'internal').count, 1);
  assert.equal(cornerSelection(t, 'internal').points.length, 1);
  assert.equal(cornerSelection(t, 'all').points.length, 6);
});

test('value-basis helpers round-trip', () => {
  assert.equal(cornerValueBasis('all'), 'corner_all');
  assert.equal(cornerValueBasis('external'), 'corner_external');
  assert.equal(cornerValueBasis('internal'), 'corner_internal');
  assert.ok(isCornerValueBasis('corner_internal'));
  assert.ok(!isCornerValueBasis('pitched'));
  assert.ok(!isCornerValueBasis(undefined));
  assert.equal(cornerBasisFromValueBasis('corner_external'), 'external');
});
