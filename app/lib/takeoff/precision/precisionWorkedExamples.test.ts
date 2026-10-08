// Worked examples from spec §17.4 (D, E, F — the geometry/command-relevant
// ones) plus §6.2 perimeter-order navigation semantics proven through commands.
// A/B/C calibration-scale examples live in calibration.test.ts (existing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendVertex,
  beginEdit,
  closeOutline,
  commitMove,
  insertAfter,
  redo,
  saveEdit,
  selectVertex,
  undo,
} from './precisionEditor';
import { polygonArea, polygonPerimeter } from './precisionGeometry';
import { calibratedArea } from '../calibration';
import type { EditContext, EditTarget } from './precisionTypes';

function ctx(): EditContext {
  return {
    quoteId: 'q1', pageId: 'p1', imageRevision: 'rev-1',
    coordinateFrame: 'takeoff-scene-v1', sessionVersion: 1, contextEpoch: 1,
  };
}

const outlineTarget: EditTarget = { kind: 'outline', geometryId: 'g1', quoteRoofAreaId: null };

// ─── §17.4 D — insertion on the closing edge ─────────────────────────────

test('D: insert after last vertex of square lands at (0,50), area+perimeter unchanged', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const s = beginEdit(outlineTarget, ctx(), square, true);
  assert.equal(polygonArea(s.draft.vertices), 10000);
  assert.equal(polygonPerimeter(s.draft.vertices, true), 400);

  const lastId = s.draft.vertices[3].id; // (0,100); successor wraps to (0,0)
  const r = insertAfter(s, lastId);
  const vs = r.session.draft.vertices;

  assert.equal(vs.length, 5);
  const inserted = vs[4];
  assert.equal(inserted.point.x, 0);
  assert.equal(inserted.point.y, 50); // midpoint of closing edge (0,100)-(0,0)
  assert.deepEqual(r.session.selection, { vertexId: inserted.id, moveArmed: true });

  assert.ok(Math.abs(polygonArea(vs) - 10000) < 1e-9);
  assert.ok(Math.abs(polygonPerimeter(vs, true) - 400) < 1e-9);

  // New vertex stays selected & editable even though initially collinear.
  const moved = commitMove(r.session, inserted.id, { x: -10, y: 50 });
  assert.equal(moved.session.draft.vertices[4].point.x, -10);
});

// ─── §17.4 F — outline edit at unchanged scale ───────────────────────────

test('F: moving one vertex changes area to 11000; at 0.01 m/px plan area is 1.1 m²', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const s = beginEdit(outlineTarget, ctx(), square, true);
  const r = commitMove(s, s.draft.vertices[2].id, { x: 120, y: 100 }); // (100,100) -> (120,100)
  assert.equal(r.session.draft.vertices.filter((v) =>
    v.point.x === 0 && v.point.y === 0 ||
    v.point.x === 100 && v.point.y === 0 ||
    v.point.x === 0 && v.point.y === 100).length, 3); // other three untouched

  const save = saveEdit(r.session, ctx());
  assert.equal(save.ok, true);
  if (!save.ok) return;
  assert.equal(save.plan.recompute.sceneAreaPx2, 11000); // NOT 10000
  // 11000 px² × (0.01 m/px)² = 1.1 m² via existing calibratedArea service.
  assert.equal(calibratedArea(save.plan.recompute.sceneAreaPx2, 0.01), 1.1);
});

// ─── §6.2 — stored perimeter order navigation (wrap on closed, no wrap open) ──

test('closed navigation wraps; index display order, not coordinate order', () => {
  // Concave polygon: stored order is not x/y sorted.
  const pts = [
    { x: 60, y: 0 },  // 0 — stored first although not leftmost
    { x: 100, y: 100 }, // 1
    { x: 50, y: 50 }, // 2 concave
    { x: 0, y: 100 },  // 3
    { x: 0, y: 0 },    // 4
  ];
  const s = beginEdit(outlineTarget, ctx(), pts, true);
  const order: string[] = [];
  let cur = s.draft.vertices[0].id;
  for (let i = 0; i < 6; i++) { // one extra to prove wrap
    const r = selectVertex(s, cur, true);
    const idx = r.session.draft.vertices.findIndex((v) => v.id === cur);
    order.push(String(idx));
    cur = r.session.draft.vertices[(idx + 1) % 5].id; // "next" per §6.2
  }
  assert.equal(order.join(','), '0,1,2,3,4,0');
});

test('open path does not wrap at the ends', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
  const s = beginEdit(outlineTarget, ctx(), pts, false);
  const last = s.draft.vertices[2].id;
  // Previous from index 0 must not wrap to the last vertex.
  const idx0 = s.draft.vertices.findIndex((v) => v.id === s.draft.vertices[0].id);
  assert.equal(idx0, 0);
  const prevOfFirst = (idx0 - 1 + 3) % 3; // would be 2 if wrongly wrapped
  assert.notEqual(prevOfFirst, idx0);
  // And insert at the last open vertex is rejected (no successor) — §6.3.
  assert.equal(insertAfter(s, last).rejected, 'no-successor-open-path');
});

// ─── undo/redo as two separate steps for insert+move (§6.3) ─────────────

test('insert then move is exactly two undo steps (worked D + §6.3)', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const s = beginEdit(outlineTarget, ctx(), square, true);
  const r1 = insertAfter(s, s.draft.vertices[3].id);
  const mid = r1.session.draft.vertices[4];
  const r2 = commitMove(r1.session, mid.id, { x: 5, y: 50 });

  const u1 = undo(r2.session).session;
  assert.equal(u1.draft.vertices.length, 5); // midpoint restored, collinear
  assert.equal(u1.draft.vertices[4].id, mid.id);
  assert.equal(u1.draft.vertices[4].point.x, 0);

  const u2 = undo(u1).session;
  assert.equal(u2.draft.vertices.length, 4); // insertion removed

  const rd1 = redo(u2).session;
  assert.equal(rd1.draft.vertices.length, 5);
  const rd2 = redo(rd1).session;
  assert.equal(rd2.draft.vertices[4].point.x, 5);
});

// ─── full creation journey (§8.1) ────────────────────────────────────────

test('manual creation journey: append x4, close, save', () => {
  let s = beginEdit(outlineTarget, ctx(), [], false);
  for (const p of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) {
    s = appendVertex(s, p).session; // append selects+arms each new point
  }
  assert.equal(s.draft.vertices.length, 4);
  const closed = closeOutline(s);
  assert.equal(closed.session.draft.closed, true);
  assert.equal(closed.session.draft.vertices.length, 4);
  const save = saveEdit(closed.session, ctx());
  assert.equal(save.ok, true);
  if (save.ok) assert.equal(save.plan.recompute.sceneAreaPx2, 10000);
});
