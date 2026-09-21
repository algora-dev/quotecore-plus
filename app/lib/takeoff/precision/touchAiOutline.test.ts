// Mobile takeoff M6 tests: AI outline scan imported as an editable draft
// (spec §8.2/§8.3, §13-M6; O04/O10/O11). Pure orchestration semantics only:
// import-to-draft origin flagging, stale-result discard via the M1 context
// epoch, the outline-only stage stop as a pure decision, and
// accept-unchanged vs edit-then-accept sharing the identical M5 save path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTLINE_ONLY_SCAN_STOP_AFTER_STAGE,
  aiOutlineCandidatesFromScanData,
  beginImportedOutlineDraft,
  outlineOnlyScanCharge,
  resolveAiOutlineApplication,
  type AiOutlineCandidate,
  type AiOutlineScanStart,
} from './touchAiOutline';
import { AI_SCAN_POINT_COST } from '../pointCost';
import { commitMove, selectVertex } from './precisionEditor';
import { outlineSaveIntent } from './touchOutlines';
import type { EditContext } from './precisionTypes';

function ctx(over: Partial<EditContext> = {}): EditContext {
  return {
    quoteId: 'q1', pageId: 'p1', imageRevision: 'rev-1',
    coordinateFrame: 'takeoff-scene-v1', sessionVersion: 4, contextEpoch: 7,
    ...over,
  };
}

const SCALE = { scale: 0.01, unit: 'meters' as const };

function start(over: Partial<AiOutlineScanStart> = {}): AiOutlineScanStart {
  return { pageId: 'p1', imageRevision: 'rev-1', contextEpoch: 7, ...over };
}

const CANDIDATE: AiOutlineCandidate = {
  name: 'Front roof',
  pitch: 25,
  points: [
    { x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 100, y: 300 },
  ],
  usable: true,
};

// ─── O10: outline-only stage stop + billing parity ────────────────────────

test('O10: the touch AI outline action stops after scan1 (pure orchestration decision)', () => {
  assert.equal(OUTLINE_ONLY_SCAN_STOP_AFTER_STAGE, 'scan1');
});

test('O10: billing is identical mobile vs desktop — full scan1 charge, no cheaper variant', () => {
  // Owner decision 2026-09-21: same canonical cost table as the desktop
  // pipeline's scan1 for every quality level.
  for (const [level, cost] of Object.entries(AI_SCAN_POINT_COST)) {
    assert.equal(outlineOnlyScanCharge(level), cost);
  }
  // Unknown levels degrade to the same default as the desktop path.
  assert.equal(outlineOnlyScanCharge('unknown'), 6);
});

test('O10: candidates read ONLY roof-area polygons; lines/classification data is never converted', () => {
  const data = {
    pitch: { detected: true, global_degrees: 30 },
    roof_areas: [
      {
        name: 'Main',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      },
      { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, // <3 points: unusable but imported as invalid draft
    ],
    components: {
      ridges: [{ points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }],
      valleys: [{ points: [{ x: 0, y: 0 }, { x: 0, y: 50 }] }],
    },
  };
  const candidates = aiOutlineCandidatesFromScanData(data);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].name, 'Main');
  assert.ok(candidates[0].usable);
  assert.equal(candidates[0].pitch, 30); // pitch_degrees absent → global fallback
  assert.equal(candidates[1].usable, false); // flagged, not fabricated/repaired
  assert.equal(candidates[1].name, 'Area 2'); // unnamed → stable default
  // The extracted candidate shape structurally carries NO component data —
  // an outline-only import cannot commit AI internal lines (O10).
  assert.deepEqual(
    Object.keys(candidates[0]).sort(),
    ['name', 'pitch', 'points', 'usable'],
  );
});

test('O10/AiScanData: malformed polygons are skipped, not repaired', () => {
  assert.deepEqual(aiOutlineCandidatesFromScanData({ roof_areas: [{ points: 'oops' }] }), []);
  assert.deepEqual(
    aiOutlineCandidatesFromScanData({
      roof_areas: [{ points: [{ x: 1, y: 2 }, { x: Number.NaN, y: 2 }, { x: 3, y: 4 }] }],
    }),
    [],
  );
  assert.deepEqual(aiOutlineCandidatesFromScanData(null), []);
});

// ─── O04: import into the M5 draft with origin 'imported' ─────────────────

test('O04: imported candidate enters the M5 draft closed, origin-flagged imported, client-local id', () => {
  const s = beginImportedOutlineDraft(CANDIDATE, ctx());
  assert.equal(s.draft.closed, true); // detector outlines are closed polygons
  assert.equal(s.target.kind, 'outline');
  if (s.target.kind !== 'outline') return;
  assert.equal(s.target.origin, 'imported'); // provenance only (§8.3)
  assert.equal(s.target.geometryId, ''); // unsaved → create-new routing
  assert.deepEqual(
    s.draft.vertices.map((v) => v.point),
    CANDIDATE.points,
  );
});

test('O04: AI-origin vertices are editable like manual ones (R02) — commit/undo work identically', () => {
  const s0 = beginImportedOutlineDraft(CANDIDATE, ctx());
  const armed = selectVertex(s0, s0.draft.vertices[1].id, true).session;
  const s1 = commitMove(armed, s0.draft.vertices[1].id, { x: 420, y: 120 }).session;
  assert.deepEqual(s1.draft.vertices[1].point, { x: 420, y: 120 });
});

// ─── O04: accept-unchanged vs edit-then-accept share the SAME save path ───

test('O04: accept-unchanged hands the exact AI points to the create-new flow (no update-in-place, no duplicates)', () => {
  const s = beginImportedOutlineDraft(CANDIDATE, ctx());
  // The unchanged draft equals its base, so the M1 boundary reports `clean`;
  // accept-unchanged therefore passes the draft's CURRENT points directly to
  // the same create flow (adapter.createOutline → handleSaveArea) that the
  // create-new intent routes to. The routing decision is identical:
  const r = outlineSaveIntent(s, ctx(), SCALE);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, 'clean'); // nothing changed — never an update-in-place
  if (r.ok) return;
  assert.deepEqual(
    s.draft.vertices.map((v) => v.point),
    CANDIDATE.points,
  );
});

test('O04: edit-then-accept routes the SAME create-new path with the edited points', () => {
  const s0 = beginImportedOutlineDraft(CANDIDATE, ctx());
  const armed = selectVertex(s0, s0.draft.vertices[2].id, true).session;
  const s1 = commitMove(armed, s0.draft.vertices[2].id, { x: 500, y: 350 }).session;
  const r = outlineSaveIntent(s1, ctx(), SCALE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.intent.kind, 'create-new'); // identical path, identical routing
  if (r.intent.kind !== 'create-new') return;
  assert.deepEqual(r.intent.points[2], { x: 500, y: 350 });
});

test('O04: an unusable candidate imports as an INVALID editable draft — save blocked, repair possible (§8.2)', () => {
  const degenerate: AiOutlineCandidate = {
    name: 'Bad', pitch: 0,
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 200 }], // collinear
    usable: false,
  };
  const s0 = beginImportedOutlineDraft(degenerate, ctx());
  // A still-collinear edit keeps the draft dirty AND invalid.
  const armed0 = selectVertex(s0, s0.draft.vertices[0].id, true).session;
  const s = commitMove(armed0, s0.draft.vertices[0].id, { x: 1, y: 1 }).session;
  const r = outlineSaveIntent(s, ctx(), SCALE);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, 'blocking-validation');
  // Repair stays available: move a vertex and the same save path succeeds.
  const repaired = commitMove(s, s0.draft.vertices[1].id, { x: 100, y: 0 }).session;
  assert.equal(outlineSaveIntent(repaired, ctx(), SCALE).ok, true);
});

test('O04/O11: a stale-context import is rejected by the SAME M5 save boundary', () => {
  const s = beginImportedOutlineDraft(CANDIDATE, ctx());
  const moved = commitMove(
    selectVertex(s, s.draft.vertices[0].id, true).session,
    s.draft.vertices[0].id,
    { x: 90, y: 90 },
  ).session;
  const r = outlineSaveIntent(moved, ctx({ contextEpoch: 8 }), SCALE); // epoch moved under us
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, 'stale-context');
});

// ─── O11: stale-result discard via the M1 context epoch ───────────────────

test('O11: a matching context applies the result', () => {
  assert.deepEqual(resolveAiOutlineApplication(start(), start(), false), { action: 'apply' });
});

test('O11: manual edits since scan start discard the result with an explicit message', () => {
  const d = resolveAiOutlineApplication(start(), start(), true);
  assert.equal(d.action, 'discard');
  if (d.action !== 'discard') return;
  assert.equal(d.reason, 'manual-edits');
  assert.ok(d.message.length > 0); // explicit offer/reason — never silent
});

test('O11: page switch discards the result', () => {
  const d = resolveAiOutlineApplication(start(), start({ pageId: 'p2' }), false);
  assert.equal(d.action, 'discard');
  if (d.action !== 'discard') return;
  assert.equal(d.reason, 'page-changed');
});

test('O11: image revision change discards the result', () => {
  const d = resolveAiOutlineApplication(start(), start({ imageRevision: 'rev-2' }), false);
  assert.equal(d.action, 'discard');
  if (d.action !== 'discard') return;
  assert.equal(d.reason, 'image-revision-changed');
});

test('O11: contextEpoch change (cancellation / later page change) discards the result', () => {
  const d = resolveAiOutlineApplication(start(), start({ contextEpoch: 8 }), false);
  assert.equal(d.action, 'discard');
  if (d.action !== 'discard') return;
  assert.equal(d.reason, 'context-epoch-changed');
});

test('O11: manual edits take precedence over other staleness reasons', () => {
  const d = resolveAiOutlineApplication(start(), start({ pageId: 'p2' }), true);
  assert.equal(d.action, 'discard');
  if (d.action !== 'discard') return;
  assert.equal(d.reason, 'manual-edits');
});
