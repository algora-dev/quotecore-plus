// Command-engine tests: spec §4.3 commands, §6 insert/delete, §11.2 history,
// saveEdit boundary (§4.3/§11.3), ID stability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HISTORY_OPS,
  appendVertex,
  beginEdit,
  cancelGesture,
  closeOutline,
  commitMove,
  calibratedPlanFromSave,
  deleteVertex,
  discardEdit,
  insertAfter,
  isDirty,
  previewMove,
  redo,
  saveEdit,
  selectVertex,
  undo,
} from './precisionEditor';
import type { EditContext, EditTarget } from './precisionTypes';

function ctx(over: Partial<EditContext> = {}): EditContext {
  return {
    quoteId: 'q1', pageId: 'p1', imageRevision: 'rev-1',
    coordinateFrame: 'takeoff-scene-v1', sessionVersion: 4, contextEpoch: 7,
    ...over,
  };
}

const outlineTarget: EditTarget = { kind: 'outline', geometryId: 'g1', quoteRoofAreaId: 'ra-1' };

const SQUARE = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];

function beginSquare(): ReturnType<typeof beginEdit> {
  return beginEdit(outlineTarget, ctx(), SQUARE, true);
}

// ─── beginEdit / selection ───────────────────────────────────────────────

test('beginEdit copies saved primitives and retains an immutable base', () => {
  const s = beginSquare();
  assert.equal(s.draft.vertices.length, 4);
  assert.equal(s.draft.closed, true);
  assert.equal(isDirty(s), false);
  assert.equal(s.history.undo.length, 0);
  assert.deepEqual(s.selection, { vertexId: null, moveArmed: false });
});

test('selectVertex changes selection only; unknown id rejected', () => {
  const s = beginSquare();
  const id = s.draft.vertices[2].id;
  const r = selectVertex(s, id, true);
  assert.deepEqual(r.session.selection, { vertexId: id, moveArmed: true });
  assert.equal(r.session.draft, s.draft); // same reference: no geometry/history change
  assert.equal(r.session.history.undo.length, 0);
  const bad = selectVertex(s, 'nope', true);
  assert.equal(bad.rejected, 'unknown-vertex');
});

// ─── move / preview / cancel ─────────────────────────────────────────────

test('previewMove is transient: no draft write, no history, cancel restores', () => {
  const s = beginSquare();
  const id = s.draft.vertices[2].id;
  const p = previewMove(s, id, { x: 500, y: 500 });
  assert.equal(p.session.draft, s.draft);
  assert.deepEqual(p.session.preview, { vertexId: id, point: { x: 500, y: 500 } });
  assert.equal(p.session.history.undo.length, 0);
  const c = cancelGesture(p.session);
  assert.equal(c.session.preview, null);
  assert.equal(c.session.draft, s.draft);
  assert.equal(c.session.history.undo.length, 0);
});

test('commitMove: one vertex moves, all others unchanged, disarms, one history op', () => {
  const s = beginSquare();
  const id = s.draft.vertices[2].id;
  const armed = selectVertex(s, id, true).session;
  const r = commitMove(armed, id, { x: 120, y: 100 });
  assert.equal(r.session.draft.vertices[2].point.x, 120);
  assert.equal(r.session.draft.vertices.filter((v) => v.id !== id).every((v, i) =>
    v.point.x === SQUARE[i < 2 ? i : i + 1].x && v.point.y === SQUARE[i < 2 ? i : i + 1].y), true);
  assert.equal(r.session.draft.localGeometryRevision, 1);
  assert.equal(r.session.history.undo.length, 1);
  assert.equal(r.session.history.undo[0].kind, 'move');
  assert.deepEqual(r.session.selection, { vertexId: id, moveArmed: false });
  assert.equal(r.session.preview, null);
  assert.equal(isDirty(r.session), true);
});

test('commitMove of unknown vertex rejected without change', () => {
  const s = beginSquare();
  const r = commitMove(s, 'nope', { x: 1, y: 1 });
  assert.equal(r.rejected, 'unknown-vertex');
  assert.equal(r.session, s);
});

// ─── insert / delete (spec §6) ───────────────────────────────────────────

test('insertAfter: midpoint, new id, after index, selected+armed, area preserved', () => {
  const s = beginSquare();
  const lastId = s.draft.vertices[3].id; // (0,100); successor wraps to first (0,0)
  const r = insertAfter(s, lastId);
  const vs = r.session.draft.vertices;
  assert.equal(vs.length, 5);
  assert.equal(vs[4].point.x, 0);
  assert.equal(vs[4].point.y, 50);
  assert.deepEqual(r.session.selection, { vertexId: vs[4].id, moveArmed: true });
  // New stable id, not coordinate-derived, unique.
  assert.notEqual(vs[4].id, lastId);
  assert.equal(new Set(vs.map((v) => v.id)).size, 5);
  // Area/perimeter unchanged within floating-point tolerance (verified in
  // worked-examples file with exact numbers).
  assert.equal(r.session.history.undo.length, 1);
  assert.equal(r.session.history.undo[0].kind, 'insert');
});

test('insertAfter on last vertex of an OPEN path is rejected', () => {
  const s = beginEdit(outlineTarget, ctx(), SQUARE, false);
  const lastId = s.draft.vertices[3].id;
  const r = insertAfter(s, lastId);
  assert.equal(r.rejected, 'no-successor-open-path');
  assert.equal(r.session, s);
});

test('insertAfter works mid-path on an open path', () => {
  const s = beginEdit(outlineTarget, ctx(), SQUARE, false);
  const r = insertAfter(s, s.draft.vertices[0].id); // midpoint of (0,0)-(100,0)
  assert.equal(r.session.draft.vertices[1].point.x, 50);
  assert.equal(r.session.draft.vertices[1].point.y, 0);
  assert.equal(r.session.draft.vertices.length, 5);
});

test('collinear midpoint survives: insert then undo restores it as the pre-move state', () => {
  // Spec §6.3: insertion and the later move are TWO undo steps. First undo of a
  // post-insert move restores the (collinear) midpoint, not its deletion.
  const s = beginSquare();
  const inserted = insertAfter(s, s.draft.vertices[3].id).session;
  const midId = inserted.draft.vertices[4].id;
  const moved = commitMove(inserted, midId, { x: 10, y: 50 }).session;
  const backOne = undo(moved).session;
  assert.equal(backOne.draft.vertices.length, 5);
  const mid = backOne.draft.vertices[4];
  assert.equal(mid.id, midId);
  assert.equal(mid.point.x, 0); // collinear midpoint restored
  const backTwo = undo(backOne).session;
  assert.equal(backTwo.draft.vertices.length, 4);
});

test('deleteVertex reconnects neighbours, selects successor, disarmed', () => {
  const s = beginSquare();
  const victim = s.draft.vertices[1].id; // (100,0)
  const r = deleteVertex(s, victim);
  const vs = r.session.draft.vertices;
  assert.equal(vs.length, 3);
  assert.equal(vs[1].point.x, 100); // old index 2 shifted up
  assert.equal(r.session.selection.vertexId, vs[1].id);
  assert.equal(r.session.selection.moveArmed, false);
});

test('deleteVertex on a 3-vertex closed outline is rejected', () => {
  const s = beginEdit(outlineTarget, ctx(), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], true);
  const r = deleteVertex(s, s.draft.vertices[0].id);
  assert.equal(r.rejected, 'outline-needs-minimum-vertices');
  assert.equal(r.session, s);
});

test('delete on open path may reduce to zero points (returns to placement state)', () => {
  let s = beginEdit(outlineTarget, ctx(), [{ x: 1, y: 1 }], false);
  s = deleteVertex(s, s.draft.vertices[0].id).session;
  assert.equal(s.draft.vertices.length, 0);
  assert.equal(s.selection.vertexId, null);
});

test('crossing draft from an edit stays editable with save blocked; undo available', () => {
  // Spec §6.4/§8.4: an invalid draft (however produced) is never silently
  // saved or rearranged — it stays editable with blocking validation + undo.
  const s = beginSquare();
  // Move (100,100) far left across the polygon: edge (100,0)->(-100,50)
  // crosses the closing edge (0,100)->(0,0).
  const r = commitMove(s, s.draft.vertices[2].id, { x: -100, y: 50 });
  assert.equal(r.rejected, undefined);
  const save = saveEdit(r.session, ctx());
  assert.equal(save.ok, false);
  if (!save.ok) assert.equal(save.reason, 'blocking-validation');
  const undone = undo(r.session).session;
  assert.equal(undone.draft.vertices.length, 4);
  assert.equal(saveEdit(undone, ctx()).ok, false); // clean again -> not saveable, but valid undo target
});

// ─── append / close ──────────────────────────────────────────────────────

test('appendVertex: open only, creates+selects+arms, undoable', () => {
  const s = beginEdit(outlineTarget, ctx(), [], false);
  const r = appendVertex(s, { x: 5, y: 5 });
  assert.equal(r.session.draft.vertices.length, 1);
  assert.deepEqual(r.session.selection, { vertexId: r.session.draft.vertices[0].id, moveArmed: true });
  const closed = beginSquare();
  assert.equal(appendVertex(closed, { x: 1, y: 1 }).rejected, 'append-on-closed-outline');
});

test('closeOutline needs >=3 distinct vertices and never duplicates the first point', () => {
  const two = beginEdit(outlineTarget, ctx(), [{ x: 0, y: 0 }, { x: 10, y: 0 }], false);
  assert.equal(closeOutline(two).rejected, 'outline-needs-minimum-vertices');
  const dup = beginEdit(outlineTarget, ctx(), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }], false);
  assert.equal(closeOutline(dup).rejected, 'duplicate-vertex');
  const s = beginEdit(outlineTarget, ctx(), SQUARE, false);
  const r = closeOutline(s);
  assert.equal(r.session.draft.closed, true);
  assert.equal(r.session.draft.vertices.length, 4); // no duplicated first point
  assert.equal(r.session.history.undo[0].kind, 'close');
});

// ─── history (spec §11.2) ────────────────────────────────────────────────

test('undo restores exact primitives and metadata; redo replays; redo clears on new edit', () => {
  const s = beginSquare();
  const id = s.draft.vertices[2].id;
  const moved = commitMove(s, id, { x: 130, y: 90 }).session;
  const undone = undo(moved).session;
  assert.equal(undone.draft.vertices[2].point.x, 100);
  assert.equal(undone.draft.vertices[2].point.y, 100);
  assert.equal(undone.draft.localGeometryRevision, 0);
  assert.equal(undone.history.undo.length, 0);
  assert.equal(undone.history.redo.length, 1);
  const redone = redo(undone).session;
  assert.equal(redone.draft.vertices[2].point.x, 130);
  // New edit after undo clears redo.
  const undone2 = undo(redone).session;
  const moved2 = commitMove(undone2, id, { x: 140, y: 95 }).session;
  assert.equal(moved2.history.redo.length, 0);
});

test('vertex ids are stable through moves, undo and redo', () => {
  const s = beginSquare();
  const idsBefore = s.draft.vertices.map((v) => v.id);
  const id = idsBefore[1];
  const moved = commitMove(s, id, { x: 99, y: 1 }).session;
  assert.deepEqual(moved.draft.vertices.map((v) => v.id), idsBefore);
  const undone = undo(moved).session;
  assert.deepEqual(undone.draft.vertices.map((v) => v.id), idsBefore);
  const redone = redo(undone).session;
  assert.deepEqual(redone.draft.vertices.map((v) => v.id), idsBefore);
});

test('selection and cancelled gestures never enter history', () => {
  const s = beginSquare();
  let t = selectVertex(s, s.draft.vertices[0].id, true).session;
  t = previewMove(t, s.draft.vertices[0].id, { x: 9, y: 9 }).session;
  t = cancelGesture(t).session;
  assert.equal(t.history.undo.length, 0);
});

test('history is bounded at 100 logical operations', () => {
  assert.equal(MAX_HISTORY_OPS, 100);
  let s = beginSquare();
  const id = s.draft.vertices[0].id;
  for (let i = 0; i < 130; i++) {
    s = commitMove(s, id, { x: i, y: i }).session;
  }
  assert.equal(s.history.undo.length, MAX_HISTORY_OPS);
  assert.equal(s.draft.vertices[0].point.x, 129);
  let undos = 0;
  while (s.history.undo.length > 0) { s = undo(s).session; undos++; }
  assert.equal(undos, MAX_HISTORY_OPS);
});

test('discardEdit restores the saved base regardless of undo position', () => {
  const s = beginSquare();
  const id = s.draft.vertices[0].id;
  const moved = commitMove(s, id, { x: 42, y: 42 }).session;
  const undone = undo(moved).session;
  const movedAgain = commitMove(undone, id, { x: 7, y: 7 }).session;
  const discarded = discardEdit(movedAgain).session;
  assert.equal(discarded.draft, discarded.base);
  assert.equal(discarded.draft.vertices[0].point.x, 0);
  assert.equal(discarded.history.undo.length, 0);
  assert.equal(discarded.history.redo.length, 0);
  assert.equal(discardEdit(discarded).session.draft, discarded.draft);
});

// ─── saveEdit boundary (§4.3 / §11.3) ────────────────────────────────────

test('saveEdit: clean draft returns clean; stale context rejected', () => {
  const s = beginSquare();
  assert.deepEqual(saveEdit(s, ctx()), { ok: false, reason: 'clean' });
  const moved = commitMove(s, s.draft.vertices[0].id, { x: 1, y: 1 }).session;
  const stale = saveEdit(moved, ctx({ pageId: 'OTHER', imageRevision: 'rev-1', contextEpoch: 7, sessionVersion: 4, quoteId: 'q1' }));
  assert.equal((stale as { ok: false; reason: string }).reason, 'stale-context');
  const staleEpoch = saveEdit(moved, ctx({ contextEpoch: 8 }));
  assert.equal((staleEpoch as { ok: false; reason: string }).reason, 'stale-context');
});

test('saveEdit: valid edit returns a plan routed to update-in-place with recomputed primitives', () => {
  const s = beginSquare();
  const moved = commitMove(s, s.draft.vertices[2].id, { x: 120, y: 100 }).session;
  const r = saveEdit(moved, ctx());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.plan.route, { kind: 'outline-geometry-update', geometryId: 'g1', quoteRoofAreaId: 'ra-1' });
  assert.equal(r.plan.recompute.sceneAreaPx2, 11000); // worked example F
  assert.ok(Math.abs(r.plan.recompute.scenePerimeterPx - (100 + Math.hypot(20, 100) + 120 + 100)) < 1e-9);
  // Plan area derives from the NEW points at constant scale (§8.5 / §17.4 F).
  assert.equal(calibratedPlanFromSave(r.plan, 0.01).planArea, 1.1);
});

test('saveEdit: out-of-raster warning does not block; self-intersection does', () => {
  const s = beginSquare();
  const moved = commitMove(s, s.draft.vertices[2].id, { x: 3000, y: 3000 }).session;
  const warned = saveEdit(moved, ctx(), { sceneWidth: 2000, sceneHeight: 2000 });
  assert.equal(warned.ok, true); // warning only
  // Bowtie: block.
  const bowtie = beginEdit(outlineTarget, ctx(), [
    { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 },
  ], true);
  const shifted = commitMove(bowtie, bowtie.draft.vertices[0].id, { x: 1, y: 1 }).session;
  const blocked = saveEdit(shifted, ctx());
  assert.equal(blocked.ok, false);
});

test('saveEdit routes calibration targets to the existing calibration persist path', () => {
  const target: EditTarget = { kind: 'calibration', referenceDraftId: 'rd-1' };
  const s = beginEdit(target, ctx(), [{ x: 0, y: 0 }, { x: 100, y: 0 }], true);
  const moved = commitMove(s, s.draft.vertices[1].id, { x: 120, y: 0 }).session;
  const r = saveEdit(moved, ctx());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.route.kind, 'page-calibration-persist');
});

test('saveEdit routes component-line targets through the existing atomic save', () => {
  const target: EditTarget = { kind: 'component-line', measurementId: 'm1', componentId: 'c1', quoteRoofAreaId: 'ra-2' };
  const s = beginEdit(target, ctx(), [{ x: 0, y: 0 }, { x: 50, y: 0 }], false);
  const moved = commitMove(s, s.draft.vertices[1].id, { x: 60, y: 0 }).session;
  const r = saveEdit(moved, ctx());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.route.kind, 'atomic-takeoff-save-v2');
});
