// Geometry validation & helpers tests (spec §6.3, §6.4, §8.4, §17.4 E).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEOMETRY_TOLERANCE,
  MIN_CLOSED_OUTLINE_VERTICES,
  findSelfIntersection,
  hasBlockingIssue,
  isFinitePoint,
  newVertexId,
  pointsDistinct,
  polygonArea,
  polygonPerimeter,
  sceneDeltaFromClientDelta,
  validateOutline,
  verticesDistinct,
  verticesFromPoints,
  windingSign,
} from './precisionGeometry';
import type { EditableGeometry, EditTarget, EditContext, Vertex } from './precisionTypes';

function ctx(): EditContext {
  return {
    quoteId: 'q1', pageId: 'p1', imageRevision: 'rev-1',
    coordinateFrame: 'takeoff-scene-v1', sessionVersion: 4, contextEpoch: 7,
  };
}

const outlineTarget: EditTarget = { kind: 'outline', geometryId: 'g1', quoteRoofAreaId: 'ra-1' };

function draft(points: readonly { x: number; y: number }[], closed = true): EditableGeometry {
  return {
    target: outlineTarget,
    context: ctx(),
    vertices: points.map((p, i) => ({ id: `v${i}`, point: p })),
    closed,
    localGeometryRevision: 0,
  };
}

const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

test('square has area 10000, perimeter 400, winding preserved', () => {
  const d = draft(SQUARE);
  assert.equal(polygonArea(d.vertices), 10000);
  assert.equal(polygonPerimeter(d.vertices, true), 400);
  const sign = windingSign(d.vertices);
  const reversed = draft([...SQUARE].reverse());
  assert.equal(windingSign(reversed.vertices), -sign);
});

test('minimum closed outline constant is 3', () => {
  assert.equal(MIN_CLOSED_OUTLINE_VERTICES, 3);
});

test('collinear midpoint insertion is permitted (never an issue)', () => {
  const points = [...SQUARE, { x: 0, y: 50 }]; // collinear midpoint on closing edge
  const issues = validateOutline(draft(points));
  assert.equal(issues.length, 0);
});

test('triangle (minimum valid closed outline) passes', () => {
  const issues = validateOutline(draft([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]));
  assert.equal(issues.length, 0);
});

test('concave polygon is valid', () => {
  const L = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 50 }, { x: 0, y: 50 }];
  assert.equal(validateOutline(draft(L)).length, 0);
});

test('duplicate vertices are blocking', () => {
  const issues = validateOutline(draft([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 }]));
  assert.ok(issues.some((i) => i.code === 'duplicate-vertex' && i.severity === 'blocking'));
  assert.ok(hasBlockingIssue(issues));
});

test('zero-area degenerate outline is blocking', () => {
  const issues = validateOutline(draft([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]));
  assert.ok(issues.some((i) => i.code === 'degenerate-area'));
});

test('self-intersecting bowtie is blocking with vertex ids', () => {
  // Asymmetric bowtie (nonzero area) so the self-intersection rule — not the
  // degenerate-area rule — is what fires.
  const bowtie = [{ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
  const issues = validateOutline(draft(bowtie));
  const si = issues.find((i) => i.code === 'self-intersection');
  assert.ok(si, 'self-intersection issue expected');
  assert.equal(si!.severity, 'blocking');
  assert.equal(si!.vertexIds!.length, 2);
});

test('adjacent edges sharing a joint never self-intersect', () => {
  assert.equal(findSelfIntersection(draft(SQUARE).vertices), null);
});

test('overlapping collinear edges are a self-intersection', () => {
  // Spike retracing along the bottom edge: edge v4->v5 lies on edge v0->v1.
  const overlap = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    { x: 50, y: 100 }, { x: 50, y: 0 }, { x: 30, y: 0 },
  ];
  assert.ok(findSelfIntersection(draft(overlap).vertices) != null);
});

test('non-finite coordinates are blocking and short-circuit', () => {
  const issues = validateOutline(draft([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: NaN, y: 100 }]));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'non-finite-coordinate');
  assert.equal(isFinitePoint({ x: NaN, y: 0 }), false);
});

test('insufficient vertices on closed outline is blocking', () => {
  const issues = validateOutline(draft([{ x: 0, y: 0 }, { x: 10, y: 0 }]));
  assert.ok(issues.some((i) => i.code === 'insufficient-vertices'));
});

test('open path with <3 points flags outline-open; empty open path is silent', () => {
  assert.ok(validateOutline(draft([{ x: 0, y: 0 }, { x: 5, y: 5 }], false)).some((i) => i.code === 'outline-open'));
  assert.equal(validateOutline(draft([], false)).length, 0);
});

test('out-of-raster points produce a warning, not blocking', () => {
  const issues = validateOutline(draft(SQUARE), { sceneWidth: 50, sceneHeight: 50 });
  const oob = issues.find((i) => i.code === 'vertex-out-of-raster');
  assert.ok(oob);
  assert.equal(oob!.severity, 'warning');
  assert.equal(hasBlockingIssue(issues), false);
});

test('distinctness uses tolerance', () => {
  assert.equal(pointsDistinct({ x: 0, y: 0 }, { x: GEOMETRY_TOLERANCE * 0.5, y: 0 }), false);
  assert.equal(pointsDistinct({ x: 0, y: 0 }, { x: 0.01, y: 0 }), true);
  assert.equal(verticesDistinct(draft(SQUARE).vertices), true);
});

test('vertex ids are random and never coordinate-derived', () => {
  const a = newVertexId();
  const b = newVertexId();
  assert.notEqual(a, b);
  assert.ok(a.length >= 8);
  const imported = verticesFromPoints(SQUARE);
  assert.equal(imported.length, 4);
  assert.equal(new Set(imported.map((v) => v.id)).size, 4);
});

// Spec §17.4 E — remote-drag invariance.
test('worked example E: client delta maps through inverse linear part only', () => {
  // scene->client zoom 2 (uniform), translation arbitrary. Inverse linear part
  // for zoom z is 1/z in both axis slots of the affine (a=1/2, d=1/2).
  const inverseZoom2 = [0.5, 0, 0, 0.5, 12, -34]; // translation MUST be ignored for deltas
  const p = sceneDeltaFromClientDelta(inverseZoom2, { x: 40, y: -20 });
  assert.equal(p.x, 20);
  assert.equal(p.y, -10);
  // Finger delta (40,-20) from scene (100,80) => (120,70) at zoom 2.
  assert.deepEqual(
    { x: 100 + p.x, y: 80 + p.y },
    { x: 120, y: 70 },
  );
  const inverseZoomHalf = [2, 0, 0, 2, -5, 9];
  const q = sceneDeltaFromClientDelta(inverseZoomHalf, { x: 40, y: -20 });
  // (180,40) at zoom 0.5. Same delta, different zoom -> different scene move,
  // and the inverse translation terms never contribute.
  assert.deepEqual({ x: 100 + q.x, y: 80 + q.y }, { x: 180, y: 40 });
});

test('vertex type is plain data', () => {
  const v: Vertex = { id: 'x', point: { x: 1, y: 2 } };
  assert.equal(JSON.parse(JSON.stringify(v)).id, 'x');
});
