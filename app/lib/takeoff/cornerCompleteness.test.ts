/**
 * Corner completeness + calibration tolerance tests (owner rule 2026-10-02).
 * Run: node --import tsx --test app/lib/takeoff/cornerCompleteness.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerCompletenessPass, nearPairReviewRule } from './cornerCompleteness';
import { computeScanTolerances, pxPerMmToImageSpace, SCAN_SNAP_MM } from './scanTolerances';
import { classifyOutlineVertices, enforceHipValleyAngleRule } from './outlineGeometry';
import type { V3Line, V3Point } from './ai-prompt-v3';

const line = (id: string, x1: number, y1: number, x2: number, y2: number): V3Line =>
  ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, confidence: 0.7 });

function runCorner(params: {
  outline: V3Point[];
  lines: V3Line[];
  types: Record<string, string>;
  review: V3Line[];
  edgeTypes?: Record<string, string>;
  snap?: number;
}) {
  const n = params.outline.length;
  const classificationByLineId = new Map(Object.entries(params.types).map(([id, type]) => [id, { type }]));
  const edgeLineById = new Map<string, { start: V3Point; end: V3Point; type: string }>();
  for (let i = 0; i < n; i++) {
    edgeLineById.set(`E${i}`, {
      start: params.outline[i],
      end: params.outline[(i + 1) % n],
      type: params.edgeTypes?.[`E${i}`] ?? 'spouting',
    });
  }
  return cornerCompletenessPass({
    outlinePoints: params.outline,
    lines: params.lines,
    classificationByLineId,
    edgeLineById,
    reviewLines: params.review,
    snapTolerance: params.snap ?? 15,
  });
}

// L-shaped outline: (60,40) is the concave (internal) corner. Edge types are
// realistic (barge on the gable runs) so only the concave corner is active in
// the concave-focused tests; all-spouting edges would legitimately expect hips
// at every convex corner.
const L_EDGE_TYPES: Record<string, string> = {
  E0: 'barge', E1: 'spouting', E2: 'spouting', E3: 'barge', E4: 'barge', E5: 'spouting',
};
const L_OUTLINE: V3Point[] = [
  { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 100, y: 40 },
  { x: 100, y: 100 }, { x: 0, y: 100 },
];

test('no candidate at a concave corner emits a pink circle marker', () => {
  const result = runCorner({
    outline: L_OUTLINE,
    lines: [line('L1', 20, 70, 80, 70)],
    types: { L1: 'ridge' },
    review: [],
    edgeTypes: L_EDGE_TYPES,
  });
  assert.equal(result.cornerMarkers.length, 1);
  assert.equal(result.cornerMarkers[0].cornerType, 'concave');
  assert.equal(result.cornerMarkers[0].x, 60);
  assert.equal(result.cornerMarkers[0].y, 40);
});

test('review candidate that reconnects to the network is promoted to a valley', () => {
  const result = runCorner({
    outline: L_OUTLINE,
    lines: [line('L1', 20, 70, 80, 70)],
    types: { L1: 'ridge' },
    review: [line('R1', 61, 41, 60, 72)], // starts at the concave corner, far end on the ridge
    edgeTypes: L_EDGE_TYPES,
  });
  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].type, 'valley');
  // endpoint snapped exactly onto the corner
  assert.deepEqual(result.promoted[0].line.start, { x: 60, y: 40 });
  assert.equal(result.cornerMarkers.length, 0);
});

test('review candidate whose far end connects to nothing is surfaced for review', () => {
  const result = runCorner({
    outline: L_OUTLINE,
    lines: [line('L1', 20, 70, 80, 70)],
    types: { L1: 'ridge' },
    review: [line('R1', 61, 41, 95, 5)], // far end in empty space
    edgeTypes: L_EDGE_TYPES,
  });
  assert.equal(result.promoted.length, 0);
  assert.equal(result.reviewSurfaced.length, 1);
  assert.equal(result.cornerMarkers.length, 0);
});

test('simple gable roof with no internal structure stays quiet (no marker flood)', () => {
  const rect: V3Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }];
  const result = runCorner({
    outline: rect,
    lines: [],
    types: {},
    review: [],
    edgeTypes: { E0: 'spouting', E1: 'spouting', E2: 'barge', E3: 'barge' },
  });
  assert.equal(result.cornerMarkers.length, 0);
});

test('convex spouting corner with internal structure promotes a review candidate to a hip', () => {
  const rect: V3Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }];
  const result = runCorner({
    outline: rect,
    lines: [line('L1', 50, 5, 50, 55)],
    types: { L1: 'ridge' },
    review: [line('R1', 1, 1, 50, 6)], // from corner (0,0) toward the ridge
    edgeTypes: { E0: 'spouting', E1: 'spouting', E2: 'spouting', E3: 'spouting' },
  });
  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].type, 'hip');
});

// ── Near-pair review rule ───────────────────────────────────────────────

test('parallel lines closer than the calibration distance both go to review', () => {
  const a = line('A', 10, 50, 90, 50);
  const b = line('B', 10, 58, 90, 58); // 8px apart, parallel
  const types = new Map([['A', { type: 'hip' }], ['B', { type: 'valley' }]]);
  const r = nearPairReviewRule({ lines: [a, b], classificationByLineId: types, nearPairTolerance: 15 });
  assert.ok(r.reviewIds.has('A') && r.reviewIds.has('B'));
});

test('a hip and valley further apart than the calibration distance keep their classifications', () => {
  const a = line('A', 10, 50, 90, 50);
  const b = line('B', 10, 90, 90, 90); // 40px apart
  const types = new Map([['A', { type: 'hip' }], ['B', { type: 'valley' }]]);
  const r = nearPairReviewRule({ lines: [a, b], classificationByLineId: types, nearPairTolerance: 15 });
  assert.equal(r.reviewIds.size, 0);
});

test('perpendicular lines meeting at a junction are not flagged', () => {
  const a = line('A', 10, 50, 90, 50);
  const b = line('B', 50, 50, 50, 90); // perpendicular, shares endpoint (50,50)
  const types = new Map([['A', { type: 'ridge' }], ['B', { type: 'broken_hip' }]]);
  const r = nearPairReviewRule({ lines: [a, b], classificationByLineId: types, nearPairTolerance: 15 });
  assert.equal(r.reviewIds.size, 0);
});

// ── Calibration tolerances ──────────────────────────────────────────────

test('150mm snap converts through px-per-mm and is capped by the roof diagonal', () => {
  // 5 px/mm -> 750px raw, capped at 6% of a 1000px diagonal = 60px
  const t = computeScanTolerances(5, 1000);
  assert.equal(t.legacy, false);
  assert.equal(t.snap, 60);
  assert.equal(SCAN_SNAP_MM, 150);
});

test('fine calibration yields the raw 150mm distance when under the cap', () => {
  // 0.05 px/mm -> 150mm = 7.5px, under the 6%-of-diagonal cap (60px): the
  // snap distance honours the owner's 150mm rule exactly (no over-snapping).
  const t = computeScanTolerances(0.05, 1000);
  assert.equal(t.legacy, false);
  assert.equal(t.snap, 7.5);
  assert.equal(t.nearPair, 7.5);
});

test('no calibration falls back to legacy pixel behaviour', () => {
  const t = computeScanTolerances(null, 1000);
  assert.equal(t.legacy, true);
  assert.equal(t.snap, 15);
  assert.equal(t.connectivity, 10);
  assert.equal(t.nearPair, null);
});

test('canvas px/mm converts to analysis-image space by the width ratio', () => {
  assert.equal(pxPerMmToImageSpace(2, 2000, 1000), 4);
  assert.equal(pxPerMmToImageSpace(null, 2000, 1000), null);
});

// ── Bisector angle gate (corner-relative) ───────────────────────────────

test('valley along a non-square (135 degree) corner bisector passes the angle gate', () => {
  // Hexagonal outline whose only concave corner is D(50,100): the edges from
  // D run toward C(100,100) [direction (1,0)] and E(10,140) [direction
  // (-0.707, 0.707)] - 135 degrees apart. The inward bisector is
  // (0.383, 0.924): 67.5 degrees from each edge, impossible under the old
  // 45-from-both-edges rule, correct under the bisector rule.
  const outline: V3Point[] = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    { x: 50, y: 100 }, { x: 10, y: 140 }, { x: 0, y: 140 },
  ];
  const vertices = classifyOutlineVertices(outline);
  const concave = vertices.find(v => v.cornerType === 'concave');
  assert.ok(concave, 'fixture must contain a concave corner');
  assert.equal(concave.x, 50);
  assert.equal(concave.y, 100);

  // A valley leaving the concave corner along the inward bisector.
  const bis = { x: 0.3827, y: 0.9239 }; // 67.5 deg between the two edge directions
  const start = { x: concave.x, y: concave.y };
  const end = { x: concave.x + bis.x * 60, y: concave.y + bis.y * 60 };
  const augmented = [{
    id: 'L1', start, end, confidence: 0.8,
    startOutlineVertexId: concave.id, startOutlineCornerType: 'concave' as const,
    endOutlineVertexId: null, endOutlineCornerType: null,
  }];
  const r = enforceHipValleyAngleRule(
    [{ line_id: 'L1', type: 'valley', confidence: 0.8, reason: 'test' }],
    augmented,
    vertices,
  );
  assert.equal(r.classifications[0].type, 'valley');
  assert.equal(r.corrections.length, 0);

  // A valley running parallel to an edge (far off the bisector) is still demoted.
  const offBis = { x: 0.99, y: 0.14 };
  const bad = [{
    id: 'L2', start, end: { x: start.x + offBis.x * 60, y: start.y + offBis.y * 60 }, confidence: 0.8,
    startOutlineVertexId: concave.id, startOutlineCornerType: 'concave' as const,
    endOutlineVertexId: null, endOutlineCornerType: null,
  }];
  const r2 = enforceHipValleyAngleRule(
    [{ line_id: 'L2', type: 'valley', confidence: 0.8, reason: 'test' }],
    bad,
    vertices,
  );
  assert.equal(r2.classifications[0].type, 'uncertain');
  assert.equal(r2.corrections.length, 1);
});
