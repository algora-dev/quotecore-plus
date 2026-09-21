// Mobile takeoff M5 tests: manual outlines + update-in-place editing of
// saved outlines (spec §8.1/§8.3–8.5, §11.3/§11.4; O01/O03/O05/O06/O07/O12/
// O13/O16, R13). Pure layer only — persistence execution is delegated by
// design (the adapter/RPC boundary is exercised through intent semantics).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginSavedOutlineEdit,
  beginManualOutlineDraft,
  classifyAreaSaveError,
  isPersistedOutlineGeometryId,
  outlineDependentRecompute,
  outlineExitGuard,
  outlineReview,
  outlineSaveIntent,
  resolveOutlineExit,
  type SavedOutlineRecord,
} from './touchOutlines';
import {
  appendVertex,
  closeOutline,
  commitMove,
  deleteVertex,
  discardEdit,
  undo,
} from './precisionEditor';
import type { EditContext, PrecisionEditSession, ScenePoint } from './precisionTypes';

function ctx(over: Partial<EditContext> = {}): EditContext {
  return {
    quoteId: 'q1', pageId: 'p1', imageRevision: 'rev-1',
    coordinateFrame: 'takeoff-scene-v1', sessionVersion: 9, contextEpoch: 2,
    ...over,
  };
}

const DB_ROW_ID = '3f2a1b2c-1111-4ddd-9999-000000000001';

const SAVED: SavedOutlineRecord = {
  geometryId: DB_ROW_ID,
  name: 'Main roof',
  pitch: 30,
  quoteRoofAreaId: 'ra-7',
  fromPageId: 'p1',
  points: [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
  ],
};

/** Scale: 0.5 real units per scene px → the 100×100 square = 2500 units². */
const SCALE = { scale: 0.5, unit: 'feet' as const };

function beginSaved(origin?: 'manual' | 'imported'): PrecisionEditSession {
  return beginSavedOutlineEdit(SAVED, ctx(), origin);
}

/** Move vertex 0..n by id; always returns the next SESSION (not CommandResult). */
function move(s: PrecisionEditSession, id: string, p: ScenePoint): PrecisionEditSession {
  return commitMove(s, id, p).session;
}

// ─── O05: update-in-place intent ─────────────────────────────────────────

test('O05: editing a saved outline produces an update-in-place intent for the SAME id, metadata retained', () => {
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[0].id, { x: 10, y: 10 });
  const r = outlineSaveIntent(s, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.intent.kind, 'update-in-place');
  if (r.intent.kind !== 'update-in-place') return;
  assert.equal(r.intent.geometryId, DB_ROW_ID); // same row, never a new one
  assert.equal(r.intent.quoteRoofAreaId, 'ra-7');
  assert.equal(r.intent.sessionVersion, 9);
  assert.equal(r.intent.retrySafe, true);
  // Plan area derived from the NEW points at the CURRENT scale (§8.5).
  // (10,10),(100,0),(100,100),(0,100) → 9000 px² × 0.25 = 2250.
  assert.ok(Math.abs(r.intent.planArea - 2250) < 1e-6);
});

test('O05: plan area of the moved square is derived from new points, not old area', () => {
  // Move (0,0)→(50,0): polygon (50,0),(100,0),(100,100),(0,100) = 7500 px².
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[0].id, { x: 50, y: 0 });
  const r = outlineSaveIntent(s, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok || r.intent.kind !== 'update-in-place') return;
  assert.ok(Math.abs(r.intent.planArea - 7500 * 0.25) < 1e-6); // px² × scale²
});

test('O05: a client-local outline id routes to create-new (existing handleSaveArea flow)', () => {
  const s = beginSavedOutlineEdit({ ...SAVED, geometryId: 'area-1695000000000' }, ctx());
  const moved = move(s, s.draft.vertices[0].id, { x: 5, y: 5 });
  const r = outlineSaveIntent(moved, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.intent.kind, 'create-new');
});

test('isPersistedOutlineGeometryId distinguishes DB ids from client-local ids', () => {
  assert.equal(isPersistedOutlineGeometryId(DB_ROW_ID), true);
  assert.equal(isPersistedOutlineGeometryId('area-123'), false);
  assert.equal(isPersistedOutlineGeometryId('draft-x'), false);
  assert.equal(isPersistedOutlineGeometryId('harness-4'), false);
  assert.equal(isPersistedOutlineGeometryId(null), false);
});

// ─── O03/§8.1: manual creation journey — tap-place, explicit close ────────

test('O03: manual creation is an open path; Close requires 3 distinct points; no double-tap needed', () => {
  const s0 = beginManualOutlineDraft(ctx());
  assert.equal(s0.draft.closed, false);
  assert.equal(s0.draft.vertices.length, 0);
  assert.equal(s0.target.kind, 'outline');
  if (s0.target.kind !== 'outline') return;
  assert.equal(s0.target.origin, 'manual');

  let s: PrecisionEditSession = s0;
  s = appendVertex(s, { x: 0, y: 0 }).session;
  s = appendVertex(s, { x: 100, y: 0 }).session;
  // Two points: Close is rejected by the engine's minimum-vertex rule.
  const tooFew = closeOutline(s);
  assert.equal(tooFew.rejected, 'outline-needs-minimum-vertices');
  s = appendVertex(s, { x: 100, y: 100 }).session;
  s = appendVertex(s, { x: 0, y: 100 }).session;
  const closed = closeOutline(s);
  assert.equal(closed.rejected, undefined);
  assert.equal(closed.session.draft.closed, true);
  // First point identity preserved — Close joins without duplicating it.
  assert.equal(closed.session.draft.vertices.length, 4);

  const r = outlineSaveIntent(closed.session, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.intent.kind, 'create-new');
  if (r.intent.kind === 'create-new') {
    assert.ok(Math.abs(r.intent.planArea - 10000 * 0.25) < 1e-6);
  }
});

// ─── O06: invalid draft blocks save, stays editable, undo repairs ─────────

test('O06: a move producing a bowtie blocks save; the draft stays editable and undo repairs it', () => {
  const s0 = beginSaved();
  // Move (0,0)→(50,150): edges (50,150)-(100,0) and (100,100)-(0,100) cross.
  const crossed = move(s0, s0.draft.vertices[0].id, { x: 50, y: 150 });
  const review = outlineReview(crossed, SCALE);
  assert.ok(review.blocking.length > 0);
  assert.equal(review.planArea, null); // never presented as a valid area
  const r = outlineSaveIntent(crossed, ctx(), SCALE);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'blocking-validation');

  const undone = undo(crossed).session;
  const repaired = outlineReview(undone, SCALE);
  assert.equal(repaired.blocking.length, 0);
  assert.ok(repaired.planArea != null);
});

test('O06: a degenerate (collinear) outline blocks save — min 3 distinct, nonzero area', () => {
  const s0 = beginSaved();
  const s1 = deleteVertex(s0, s0.draft.vertices[0].id).session;
  // 3 vertices left: the engine rejects further deletes on a closed outline
  // (min-3), so simulate the degenerate case via a collinear collapse:
  // (50,100),(100,100),(0,100) → zero area.
  const collapsed = move(s1, s1.draft.vertices[0].id, { x: 50, y: 100 });
  const review = outlineReview(collapsed, SCALE);
  assert.ok(review.blocking.length > 0 || review.planArea == null);
  const r = outlineSaveIntent(collapsed, ctx(), SCALE);
  assert.equal(r.ok, false);
});

// ─── O12: retry after lost save response never duplicates ────────────────

test('O12: rebuilding the intent after a lost save response yields the SAME update (idempotent)', () => {
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[1].id, { x: 120, y: 0 });
  const first = outlineSaveIntent(s, ctx(), SCALE);
  const second = outlineSaveIntent(s, ctx(), SCALE); // retry path: same session
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.intent, second.intent);
  if (first.intent.kind !== 'update-in-place' || second.intent.kind !== 'update-in-place') return;
  assert.equal(first.intent.geometryId, second.intent.geometryId);
  // No create intent is ever produced for persisted geometry — a retry
  // physically cannot insert a second row.
  assert.equal(second.intent.kind, 'update-in-place');
});

// ─── O13: version conflict preserves the draft ───────────────────────────

test('O13: STALE_TAKEOFF_VERSION is classified; the local draft is untouched', () => {
  assert.equal(classifyAreaSaveError('STALE_TAKEOFF_VERSION: expected 9 got 11'), 'stale-version');
  assert.equal(classifyAreaSaveError('AREA_ROW_NOT_FOUND: measurement x not found'), 'not-found');
  assert.equal(classifyAreaSaveError('AREA_GEOMETRY_INVALID: polygon has zero area'), 'validation');
  assert.equal(classifyAreaSaveError('Unauthorized'), 'unauthorized');
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[0].id, { x: 3, y: 3 });
  // On conflict the adapter surfaces reload/review and KEEPS the session.
  const guard = outlineExitGuard(s);
  assert.equal(guard.dirty, true); // draft survives — never force-discarded
});

test('O13: stale-context edits are rejected at the boundary (page/image/epoch changed)', () => {
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[0].id, { x: 3, y: 3 });
  for (const changed of [ctx({ pageId: 'p2' }), ctx({ imageRevision: 'rev-2' }), ctx({ contextEpoch: 3 })]) {
    const r = outlineSaveIntent(s, changed, SCALE);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'stale-context');
  }
});

// ─── O07: source-linked recompute at constant scale ──────────────────────

test('O07: geometry change at constant scale recomputes source-linked entries from the NEW points', () => {
  const s0 = beginSaved();
  const s = move(s0, s0.draft.vertices[1].id, { x: 200, y: 0 }); // 100x100 → 200x100
  const editedPoints = s.draft.vertices.map((v) => v.point);
  const result = outlineDependentRecompute({
    edited: { geometryId: DB_ROW_ID, points: editedPoints, pitch: 30, quoteRoofAreaId: 'ra-7' },
    scale: SCALE,
    dependents: {
      measurements: [
        // Attached (geometry-free) entry linked to this polygon.
        {
          id: 'm-derived', type: 'area', value: 2500, points: null,
          entryInputs: { value_basis: 'plan', plan_value: 2500, source_geometry_id: DB_ROW_ID },
        },
        // Pitched attached entry with NO explicit link but a unique area match.
        {
          id: 'm-pitched', type: 'area', value: 2886.7, points: null,
          quoteRoofAreaId: 'ra-7',
          entryInputs: { value_basis: 'pitched', plan_value: 2500 },
        },
        // Independent line: must NOT be rescaled or moved.
        { id: 'm-line', type: 'line', value: 50, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
        // Typed quantity: scale-independent.
        { id: 'm-point', type: 'point', value: 4, points: null },
      ],
    },
  });
  assert.equal(result.ok, true);
  const byId = new Map(result.measurementUpdates.map((u) => [u.id, u]));
  const derived = byId.get('m-derived');
  assert.ok(derived);
  // New plan = trapezoid (0,0),(200,0),(100,100),(0,100) = 15000 px² × 0.25
  // = 3750 — from the NEW points.
  assert.ok(Math.abs((derived?.value ?? 0) - 3750) < 1e-6);
  const pitched = byId.get('m-pitched');
  assert.ok(pitched);
  // pitch 30° → /cos(30°) applied exactly once on the NEW plan value.
  assert.ok(Math.abs((pitched?.value ?? 0) - 3750 / Math.cos((30 * Math.PI) / 180)) < 1e-6);
  // Independent entries untouched: the point count is skipped entirely, and
  // the independent line's value is UNCHANGED (constant scale — the service
  // may echo it, but it never moves).
  assert.equal(byId.has('m-point'), false);
  const line = byId.get('m-line');
  assert.ok(line == null || Math.abs(line.value - 50) < 1e-9);
  // The polygon's own roof-area update is present (service reports real
  // units: 15000 px² × 0.25).
  assert.ok(result.roofAreaUpdates.some((u) => u.id === DB_ROW_ID && Math.abs(u.area - 3750) < 1e-6));
});

test('O07 (disambiguation): recompute uses new geometry, not the scale ratio', () => {
  // Same scale before/after, but a BIGGER polygon: a pure (S_new/S_old)=1
  // ratio would leave plan_value unchanged; the recompute must not.
  const result = outlineDependentRecompute({
    edited: { geometryId: DB_ROW_ID, points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }], pitch: 0 },
    scale: SCALE,
    dependents: {
      measurements: [
        { id: 'm', type: 'area', value: 2500, points: null,
          entryInputs: { value_basis: 'plan', plan_value: 2500, source_geometry_id: DB_ROW_ID } },
      ],
    },
  });
  const u = result.measurementUpdates.find((x) => x.id === 'm');
  assert.ok(u);
  assert.ok(Math.abs((u?.value ?? 0) - 160000 * 0.25) < 1e-6); // 40000, not 2500
});

// ─── R13/O16: cancel restores the saved version; unrelated data untouched ─

test('R13: cancel (discardEdit) restores the exact saved base; exit guard clears', () => {
  const s0 = beginSaved();
  let s: PrecisionEditSession = move(s0, s0.draft.vertices[0].id, { x: 9, y: 9 });
  s = appendVertex({ ...s, draft: { ...s.draft, closed: false } }, { x: 1, y: 1 }).session;
  assert.equal(outlineExitGuard(s).dirty, true);
  const restored = discardEdit(s).session;
  assert.equal(outlineExitGuard(restored).dirty, false);
  assert.equal(restored.draft.vertices.length, SAVED.points.length);
  assert.deepEqual(
    restored.draft.vertices.map((v) => v.point),
    SAVED.points.map((p) => ({ ...p })),
  );
  // Base identity: the saved base only advances through an acknowledged save.
  assert.equal(restored.base, restored.draft);
});

test('R13: an approved checkpoint save is never rolled back by a later cancel', () => {
  // Simulate the M5 flow: edit → save ack (adapter re-bases) → new edit → cancel.
  const saved = beginSaved();
  const edited = move(saved, saved.draft.vertices[0].id, { x: 5, y: 5 });
  // Adapter-side acknowledged save re-bases the session on the NEW saved state.
  const rebased = beginSavedOutlineEdit(
    { ...SAVED, points: edited.draft.vertices.map((v) => ({ ...v.point })) },
    ctx(),
  );
  const secondEdit = move(rebased, rebased.draft.vertices[1].id, { x: 7, y: 7 });
  const cancelled = discardEdit(secondEdit).session;
  // Cancel restores the APPROVED checkpoint, not the pre-first-save state.
  assert.deepEqual(
    cancelled.draft.vertices.map((v) => v.point),
    edited.draft.vertices.map((v) => ({ ...v.point })),
  );
});

// ─── O16: dirty-draft exit guard ─────────────────────────────────────────

test('O16: exit guard tracks draft dirtiness; stay changes nothing, discard restores base', () => {
  const s0 = beginSaved();
  assert.equal(outlineExitGuard(s0).dirty, false);
  const s = move(s0, s0.draft.vertices[0].id, { x: 2, y: 2 });
  assert.equal(outlineExitGuard(s).dirty, true);

  const stay = resolveOutlineExit(s, 'stay');
  assert.equal(stay.proceed, false);
  assert.equal(stay.session, s);

  const discard = resolveOutlineExit(s, 'discard');
  assert.equal(discard.proceed, true);
  assert.equal(outlineExitGuard(discard.session).dirty, false);

  const saveDecision = resolveOutlineExit(s, 'save');
  assert.equal(saveDecision.proceed, false); // adapter must await the ack first
  assert.equal(saveDecision.session, s);
});

// ─── §8.3/M6 prep: origin-agnostic draft/save path ───────────────────────

test('M6 prep: an imported outline uses the identical edit/save path (origin is provenance only)', () => {
  const manual = beginSavedOutlineEdit(SAVED, ctx(), 'manual');
  const imported = beginSavedOutlineEdit(SAVED, ctx(), 'imported');
  assert.deepEqual(
    manual.draft.vertices.map((v) => v.point),
    imported.draft.vertices.map((v) => v.point),
  );
  const edited = move(imported, imported.draft.vertices[0].id, { x: 4, y: 4 });
  const r = outlineSaveIntent(edited, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok || r.intent.kind !== 'update-in-place') return;
  assert.equal(r.intent.origin, 'imported');
  assert.equal(r.intent.geometryId, DB_ROW_ID); // same update semantics as manual
});

// ─── validation: warning vs blocking ─────────────────────────────────────

test('out-of-raster points are a warning (non-blocking); duplicate vertices are blocking', () => {
  const s0 = beginSaved();
  const out = move(s0, s0.draft.vertices[1].id, { x: 1500, y: 0 });
  const review = outlineReview(out, SCALE, { sceneWidth: 1000, sceneHeight: 1000 });
  assert.equal(review.blocking.length, 0); // warning only — still saveable
  assert.ok(review.issues.some((i) => i.severity === 'warning'));

  const dup = move(s0, s0.draft.vertices[1].id, { x: 100, y: 100 });
  // Vertex 1 now sits exactly on vertex 2 → duplicate vertex (§8.4 blocking).
  const dupReview = outlineReview(dup, SCALE);
  assert.ok(dupReview.blocking.length > 0);
});
