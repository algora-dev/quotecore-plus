/**
 * Tests for the deterministic topology-completion pass (owner directive
 * 2026-10-02). Synthetic topology rules plus the Roof #4 golden regression
 * fixture captured from the live testing scan (quote 778adfa1, canvas
 * space, 2026-10-02).
 *
 * Run: npm run test:topology   (node --import tsx --test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topologyCompletionPass, AUTO_PROMOTE_OVERRIDE_SCORE } from './topologyCompletion';
import { cornerCompletenessPass } from './cornerCompleteness';
import type { V3Point, V3Line } from './ai-prompt-v3';
import type { CornerMarker } from './cornerCompleteness';

// ── helpers ─────────────────────────────────────────────────────────────

const P = (x: number, y: number): V3Point => ({ x, y });
const L = (id: string, x1: number, y1: number, x2: number, y2: number): V3Line =>
  ({ id, start: P(x1, y1), end: P(x2, y2), confidence: 0.8 });

const SNAP = 15;

/** Run cornerCompletenessPass with an empty review pool and return its
 *  unresolved corner markers - the realistic production input for the
 *  topology-completion pass. */
function unresolvedCorners(outline: V3Point[], lines: V3Line[], snap = SNAP): CornerMarker[] {
  const classMap = new Map(lines.map(l => [l.id, { type: 'ridge' }]));
  const edgeLineById = new Map<string, { start: V3Point; end: V3Point; type: string }>();
  return cornerCompletenessPass({
    outlinePoints: outline,
    lines,
    classificationByLineId: classMap,
    edgeLineById,
    reviewLines: [],
    snapTolerance: snap,
  }).cornerMarkers;
}

function run(outline: V3Point[], lines: V3Line[], snap = SNAP) {
  return topologyCompletionPass({
    outlinePoints: outline,
    lines,
    cornerMarkers: unresolvedCorners(outline, lines, snap),
    snapTolerance: snap,
  });
}

const near = (p: V3Point, x: number, y: number, tol = 40) =>
  Math.hypot(p.x - x, p.y - y) <= tol;

// ── Roof #4 golden fixture (canvas space, captured 2026-10-02) ──────────
// 14-vertex outline; concave corners v2 (1235,239), v5 (1235,1080),
// v8 (539,1080), v11 (137,703), v12 (137,515). The scan stored lines for
// every corner EXCEPT v12 and v8 - the two missing valleys.

const R4_OUTLINE: V3Point[] = [
  P(103, 204), P(1235, 204), P(1235, 239), P(1480, 239), P(1480, 1080),
  P(1235, 1080), P(1235, 1114), P(539, 1114), P(539, 1080), P(103, 1080),
  P(103, 703), P(137, 703), P(137, 515), P(103, 515),
];

/** The 21 internal component lines the scan actually kept (spouting and
 *  barge run along the outline and are excluded by the structural filter). */
const R4_LINES: V3Line[] = [
  L('R1', 103, 359, 291, 359),
  L('R2', 513, 581, 513, 642),
  L('R3', 513, 642, 513, 703),
  L('R4', 513, 642, 797, 642),
  L('R5', 814, 659, 1101, 659),
  L('R6', 1101, 616, 1101, 659),
  L('R7', 1101, 659, 1101, 703),
  L('R8', 291, 891, 324, 891),
  L('R9', 886, 727, 886, 769),
  L('H1', 797, 642, 1235, 204),
  L('H2', 1101, 617, 1480, 239),
  L('H3', 1101, 703, 1480, 1080),
  L('H4', 103, 703, 291, 891),
  L('H5', 103, 1080, 291, 891),
  L('H6', 539, 1114, 886, 769),
  L('H7', 886, 769, 1235, 1114),
  L('V1', 814, 659, 1235, 239),
  L('V2', 137, 703, 324, 891),
  L('V3', 886, 727, 1235, 1080),
  L('B1', 291, 359, 513, 581),
  L('B3', 513, 703, 324, 891),
];

/** The two valleys the vision model missed (ground truth for the fixture). */
const R4_V4_UPPER_LEFT = L('V4', 137, 515, 291, 359);
const R4_V5_PULLOUT = L('V5', 539, 1080, 886, 727);

// ── 1. Golden regression: Roof #4 recovers exactly the two valleys ──────

test('Roof #4 golden fixture: recovers both missing valleys and nothing else', () => {
  const result = run(R4_OUTLINE, R4_LINES);
  assert.equal(result.promoted.length, 2,
    `expected exactly 2 promotions, got ${result.promoted.length}: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.ok(result.promoted.every(p => p.type === 'valley'), 'both promotions must be valleys');

  const upperLeft = result.promoted.find(p => near(p.line.start, 137, 515, 5));
  assert.ok(upperLeft, `upper-left valley must start at concave corner v12 (137,515), starts: ${result.promoted.map(p => `(${p.line.start.x},${p.line.start.y})`).join(' ')}`);
  assert.ok(near(upperLeft.line.end, 291, 359, 10),
    `upper-left valley should end near the ridge junction (291,359), got (${upperLeft.line.end.x},${upperLeft.line.end.y})`);

  const pullout = result.promoted.find(p => near(p.line.start, 539, 1080, 5));
  assert.ok(pullout, `pullout valley must start at concave corner v8 (539,1080), starts: ${result.promoted.map(p => `(${p.line.start.x},${p.line.start.y})`).join(' ')}`);
  assert.ok(near(pullout.line.end, 886, 727, 10),
    `pullout valley should end near junction (886,727), got (${pullout.line.end.x},${pullout.line.end.y})`);
});

// ── 2. Missing valley from a concave outline vertex (upper-left alone) ──

test('concave outline vertex with no line recovers exactly one valley', () => {
  // Roof #4 with the pullout valley PRESENT (V5) - only the upper-left
  // valley (V4) is missing.
  const lines = [...R4_LINES, R4_V5_PULLOUT];
  const result = run(R4_OUTLINE, lines);
  assert.equal(result.promoted.length, 1,
    `expected exactly 1 promotion, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.equal(result.promoted[0].type, 'valley');
  assert.ok(near(result.promoted[0].line.start, 137, 515, 5));
  assert.ok(near(result.promoted[0].line.end, 291, 359, 10));
});

// ── 3. One missing side of a paired / up-and-over valley ────────────────

test('up-and-over with one valley missing recovers the twin without suppressing the parallel hip', () => {
  // Roof #4 with the upper-left valley PRESENT (V4) - only the pullout
  // valley (V5) is missing. H6 runs parallel to the recovery ~35px apart.
  const lines = [...R4_LINES, R4_V4_UPPER_LEFT];
  const result = run(R4_OUTLINE, lines);
  assert.equal(result.promoted.length, 1,
    `expected exactly 1 promotion, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  const twin = result.promoted[0];
  assert.equal(twin.type, 'valley');
  assert.ok(near(twin.line.start, 539, 1080, 5));
  assert.ok(near(twin.line.end, 886, 727, 10) || near(twin.line.end, 886, 769, 10));
  // The recovery must NOT have been rejected for running near-parallel to
  // the existing hip H6 (539,1114 -> 886,769).
  const parallelSeparation = Math.abs(1114 - 1080); // start separation, px
  assert.ok(parallelSeparation < 60, 'fixture sanity: the pair really is near-parallel');
});

// ── 4. Nearby parallel hip + valley pair is never duplicated ────────────

test('nearby parallel hip + valley pair is untouched and not duplicated', () => {
  const result = run(R4_OUTLINE, R4_LINES);
  // The right-side pair V3 (886,727)->(1235,1080) + H7/H6 already exists:
  // completion must not add a corridor duplicate of it.
  const dup = [...result.promoted, ...result.reviewCandidates].find(c =>
    near(c.line.start, 886, 727, 10) && near(c.line.end, 1235, 1080, 10));
  assert.ok(!dup, 'no duplicate of the existing parallel valley may be created');
  assert.equal(result.promoted.length, 2);
});

// ── 5. Dangling internal line ───────────────────────────────────────────

test('dangling internal endpoint connects onward to the network', () => {
  // A vertical ridge ending mid-air above a horizontal ridge junction.
  const outline = [P(100, 100), P(600, 100), P(600, 500), P(100, 500)];
  const lines = [
    L('R1', 100, 300, 380, 300),   // ridge, ends mid-roof
    L('V1', 600, 100, 600, 300),   // valley down the right side (outline-adjacent ends)
    L('R2', 380, 150, 380, 240),   // vertical ridge ending mid-air above R1's end
  ];
  const result = run(outline, lines);
  const healed = result.promoted.find(p =>
    near(p.line.start, 380, 240, 20) || near(p.line.end, 380, 240, 20));
  assert.ok(healed, `dangling R2 end (380,240) should be connected, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.ok(near(healed.line.start, 380, 300, 10) || near(healed.line.end, 380, 300, 10),
    'the connection should reach the junction at (380,300)');
});

// ── 6. Ambiguous connection produces a review candidate, not an auto line

test('two equally plausible targets surface as a review candidate only', () => {
  // Concave notch corner with two junctions symmetric at +45/-45 above it.
  const outline = [P(100, 100), P(500, 100), P(500, 500), P(300, 500), P(300, 400), P(100, 400)];
  const lines = [
    L('J1', 180, 280, 420, 280),
    L('J2', 180, 280, 180, 180),
    L('J3', 420, 280, 420, 180),
  ];
  const result = run(outline, lines);
  const forCorner = [...result.promoted, ...result.reviewCandidates]
    .filter(c => near(c.line.start, 300, 400, 5));
  assert.ok(forCorner.length <= 1, 'ambiguous corner yields at most one candidate');
  assert.ok(
    forCorner.length === 0 || result.reviewCandidates.some(c => near(c.line.start, 300, 400, 5)),
    'when ambiguous, the candidate must be a REVIEW candidate, not auto-promoted',
  );
});

// ── 7. Legitimate external corner creates no false valley ───────────────

test('ordinary external (convex) corners never create lines', () => {
  // Plain rectangular roof with a ridge: every corner is barge/gable
  // territory - nothing may be invented anywhere.
  const outline = [P(100, 100), P(500, 100), P(500, 500), P(100, 500)];
  const lines = [L('R1', 100, 300, 500, 300)];
  const result = run(outline, lines);
  assert.equal(result.promoted.length, 0,
    `no promotions expected, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.equal(result.reviewCandidates.length, 0);
});

// ── 8. Complete roof stays unchanged ────────────────────────────────────

test('complete Roof #4 (with both valleys present) stays unchanged', () => {
  const complete = [...R4_LINES, R4_V4_UPPER_LEFT, R4_V5_PULLOUT];
  const result = run(R4_OUTLINE, complete);
  assert.equal(result.promoted.length, 0,
    `expected zero promotions on a complete roof, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.equal(result.reviewCandidates.length, 0,
    `expected zero review candidates on a complete roof, got: ${result.reviewCandidates.map(p => p.reason).join(' | ')}`);
});

// ── 9. A diagonal heal is never auto-typed a ridge (owner 2026-10-02) ────

test('a 45-degree dangling heal surfaces as pink review, never an auto ridge', () => {
  // A diagonal line ends mid-roof; the nearest junction lies at +45deg.
  // Before the guard this auto-promoted as a "ridge" sitting at 45deg to
  // the spouting frame - geometrically impossible on a real roof.
  const outline = [P(100, 100), P(600, 100), P(600, 500), P(100, 500)];
  const lines = [
    L('D1', 150, 100, 350, 300),   // 45deg diagonal, start on the top edge, end dangling mid-roof
    L('J2', 450, 400, 590, 400),   // junction target at (450,400), far end on the right edge
  ];
  const result = run(outline, lines);
  assert.equal(result.promoted.length, 0,
    `no auto-promotion expected, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.equal(result.reviewCandidates.length, 1,
    `exactly one review candidate expected, got: ${result.reviewCandidates.map(c => c.reason).join(' | ')}`);
  const c = result.reviewCandidates[0];
  assert.ok(
    (near(c.line.start, 350, 300, 10) && near(c.line.end, 450, 400, 10))
    || (near(c.line.start, 450, 400, 10) && near(c.line.end, 350, 300, 10)),
    `the diagonal heal (350,300)<->(450,400) must be the review candidate, got (${c.line.start.x},${c.line.start.y})->(${c.line.end.x},${c.line.end.y})`,
  );
  assert.ok(c.score >= 0.72, `sanity: it would have auto-promoted before the guard (score ${c.score.toFixed(2)})`);
});

// ── 10. Redundant dangling heal is dropped entirely (owner 2026-10-02) ──

test('a dangling heal whose endpoints both become junctions is dropped entirely', () => {
  // Notched outline: the concave corner recovers a valley onto a diagonal
  // line's dangling end, while that same end also heals toward a junction.
  // Once the corner recovery connects the end, the heal joins two
  // already-connected junctions and must vanish - no line, no pink.
  const outline = [P(100, 100), P(900, 100), P(900, 900), P(600, 900), P(600, 600), P(100, 600)];
  const lines = [
    L('V1', 100, 250, 400, 400),   // end (400,400) starts the pass dangling
    L('L2', 683, 117, 900, 117),   // junction at (683,117), far end on the right edge
    L('L3', 683, 117, 683, 100),   // second junction leg, far end on the top edge
  ];
  const result = run(outline, lines);
  const valley = result.promoted.find(p => near(p.line.start, 600, 600, 5) && near(p.line.end, 400, 400, 10));
  assert.ok(valley, `concave corner must recover its valley, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  const chord = [...result.promoted, ...result.reviewCandidates].find(c =>
    (near(c.line.start, 400, 400, 10) && near(c.line.end, 683, 117, 10))
    || (near(c.line.start, 683, 117, 10) && near(c.line.end, 400, 400, 10)));
  assert.ok(!chord, `the redundant junction-to-junction heal must be dropped entirely, found: ${chord?.reason}`);
  assert.equal(result.stats.redundantDropped, 1);
  assert.equal(result.reviewCandidates.length, 0,
    `no pink expected, got: ${result.reviewCandidates.map(c => c.reason).join(' | ')}`);
});

// ── 11. High confidence promotes without the margin (owner 2026-10-02) ──

test('a 0.94-scored corner recovery promotes despite a zero margin', () => {
  // Symmetric twins: the concave corner sees two 45deg junction targets,
  // each with a parallel twin converging on it - both score 0.94, margin 0.
  // The old margin gate held this pink; high confidence now promotes.
  const outline = [P(100, 100), P(900, 100), P(900, 900), P(500, 500), P(100, 900)];
  const lines = [
    L('A1', 100, 100, 300, 300),
    L('B1', 100, 500, 300, 300),
    L('A2', 900, 100, 700, 300),
    L('B2', 900, 500, 700, 300),
  ];
  const result = run(outline, lines);
  const fromCorner = result.promoted.filter(p => near(p.line.start, 500, 500, 5));
  assert.equal(fromCorner.length, 1,
    `the high-confidence corner recovery must auto-promote, got: ${result.promoted.map(p => p.reason).join(' | ')}`);
  assert.equal(fromCorner[0].type, 'valley');
  assert.ok(fromCorner[0].score >= AUTO_PROMOTE_OVERRIDE_SCORE,
    `promotion must be justified by the override score, got ${fromCorner[0].score.toFixed(2)}`);
});
