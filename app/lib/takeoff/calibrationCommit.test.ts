// Calibration hardening Phase B tests (audit 2026-09-20):
//  - P0-4 commit contract: COMMIT_SUCCEEDED only after ok:true; COMMIT_FAILED
//    preserves accepted refs + candidates so a retry needs no new AI search.
//  - P0-7 metadata cache rollback: failed recalibration then later save keeps
//    the OLD durable metadata entry.
//  - 6.2 draft-vs-committed manual recalibration: cancel is non-destructive.
//  - 6.4 provenance stamping onto entry inputs.
// Run: node --import tsx --test app/lib/takeoff/calibrationCommit.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrationSessionReducer,
  makeCandidate,
  type CalibrationSessionState,
  type SessionContext,
} from './calibrationSession';
import {
  applyDraftCalibration,
  cancelDraftRecalibration,
  commitFailed,
  commitSucceeded,
  restoreMetadataEntry,
  snapshotMetadataEntry,
  stampSourceProvenance,
  startDraftRecalibration,
  toCommitResult,
} from './calibrationCommit';
import { computeCalibrationRecompute } from './calibrationRecompute';
import type { CalibrationMetadataV1 } from './calibrationCodec';
import type { CalibrationImageDescriptor } from './calibrationTypes';

const IMAGE: CalibrationImageDescriptor = {
  pageId: 'page-1',
  imageRevision: 'rev-1',
  sourceWidth: 4000,
  sourceHeight: 3000,
  sceneWidth: 2000,
  sceneHeight: 1500,
  sourceToScene: [0.5, 0, 0, 0.5, 0, 0],
  coordinateFrame: 'takeoff-scene-v1',
  geometryVersion: 1,
};

const C1 = makeCandidate({ id: 'c1', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 1000, y: 0 }, suggestedDistance: 10, suggestedUnit: 'm' });

function ctx(state: CalibrationSessionState, requestId: string): SessionContext {
  return {
    quoteId: 'quote-1',
    pageId: state.image.pageId,
    imageRevision: state.image.imageRevision,
    sessionId: state.sessionId,
    requestId,
    contextEpoch: state.contextEpoch,
  };
}

/** Drive a session into 'committing' with one accepted reference. */
function sessionAtCommitting(): CalibrationSessionState {
  let s: CalibrationSessionState = calibrationSessionReducer(
    { phase: 'idle' } as unknown as CalibrationSessionState,
    { type: 'START_NEW', quoteId: 'quote-1', image: IMAGE, baseCalibrationRevision: 0 },
  );
  s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-1'), round: 0, strategy: 'initial' });
  s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, 'req-1'), round: 0, candidates: [C1] });
  s = calibrationSessionReducer(s, { type: 'ACCEPT_AND_FINISH' });
  assert.equal(s.phase, 'committing');
  return s;
}

describe('P0-4 commit contract (reducer)', () => {
  test('COMMIT_SUCCEEDED only after an ok:true result: committing -> completed', () => {
    const s = sessionAtCommitting();
    const done = calibrationSessionReducer(s, { type: 'COMMIT_SUCCEEDED' });
    assert.equal(done.phase, 'completed');
    assert.equal(done.error, null);
  });

  test('COMMIT_FAILED returns to reviewing with accepted references and candidates preserved', () => {
    const s = sessionAtCommitting();
    const failed = calibrationSessionReducer(s, {
      type: 'COMMIT_FAILED',
      code: 'COMMIT_FAILED',
      message: 'persistence error',
    });
    assert.equal(failed.phase, 'reviewing');
    assert.equal(failed.error?.code, 'COMMIT_FAILED');
    assert.equal(failed.accepted.length, 1);
    assert.equal(failed.accepted[0].candidateId, 'c1');
    assert.equal(failed.candidates.length, 1);
    assert.equal(failed.reviews['c1'].decision, 'accepted');
  });

  test('retry after failure re-enters committing with the SAME accepted set (no new AI search)', () => {
    const s = sessionAtCommitting();
    const failed = calibrationSessionReducer(s, { type: 'COMMIT_FAILED', code: 'COMMIT_FAILED', message: 'x' });
    const retried = calibrationSessionReducer(failed, { type: 'FINISH_ACCEPTED' });
    assert.equal(retried.phase, 'committing');
    assert.deepEqual(retried.accepted.map((r) => r.id), failed.accepted.map((r) => r.id));
    assert.equal(retried.searchRoundsCompleted, failed.searchRoundsCompleted);
    // A second failure and retry also keeps them (idempotent contract).
    const failed2 = calibrationSessionReducer(retried, { type: 'COMMIT_FAILED', code: 'COMMIT_FAILED', message: 'y' });
    const retried2 = calibrationSessionReducer(failed2, { type: 'FINISH_ACCEPTED' });
    assert.equal(retried2.phase, 'committing');
    assert.equal(retried2.accepted.length, 1);
  });

  test('commit result normalisation', () => {
    assert.deepEqual(toCommitResult(commitSucceeded()), { ok: true });
    const bad = toCommitResult(commitFailed('X', 'boom'));
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.code, 'X');
      assert.equal(bad.message, 'boom');
    }
    const thrown = toCommitResult(new Error('network down'));
    assert.equal(thrown.ok, false);
    if (!thrown.ok) assert.equal(thrown.code, 'COMMIT_ERROR');
    const malformed = toCommitResult(undefined);
    assert.equal(malformed.ok, false);
  });
});

describe('P0-7 metadata cache rollback', () => {
  // The rollback only moves opaque envelope objects; identity and imageRevision
  // are all the test needs (full codec round-trips are covered elsewhere).
  const metaV1 = { schemaVersion: 1, imageRevision: 'rev-old', workingUnit: 'meters', savedAt: '2026-01-01T00:00:00.000Z', references: [] } as unknown as CalibrationMetadataV1;
  const failedMeta = { schemaVersion: 1, imageRevision: 'rev-new', workingUnit: 'feet', savedAt: '2026-09-20T00:00:00.000Z', references: [] } as unknown as CalibrationMetadataV1;

  test('failed recalibration then later unrelated save proves OLD metadata remains', () => {
    const cache = new Map<string, CalibrationMetadataV1>([['page-1', metaV1]]);
    const snapshot = snapshotMetadataEntry(cache, 'page-1');

    // Stage the failed calibration's metadata (what the commit path does).
    cache.set('page-1', failedMeta);

    // Commit failed: restore.
    restoreMetadataEntry(cache, snapshot);
    assert.equal(cache.get('page-1'), metaV1);
    assert.equal(cache.get('page-1')?.imageRevision, 'rev-old');

    // A later ordinary save reads the cache and persists the OLD metadata.
    const persisted = cache.get('page-1');
    assert.notEqual(persisted, failedMeta);
  });

  test('restore deletes the entry when the page had none before', () => {
    const cache = new Map<string, CalibrationMetadataV1>();
    const snapshot = snapshotMetadataEntry(cache, 'page-9');
    cache.set('page-9', metaV1);
    restoreMetadataEntry(cache, snapshot);
    assert.equal(cache.has('page-9'), false);
  });

  test('restore re-installs a previous entry that a failed commit deleted', () => {
    const cache = new Map<string, CalibrationMetadataV1>([['page-1', metaV1]]);
    const snapshot = snapshotMetadataEntry(cache, 'page-1');
    cache.delete('page-1');
    restoreMetadataEntry(cache, snapshot);
    assert.equal(cache.get('page-1'), metaV1);
  });
});

describe('6.2 draft-vs-committed manual recalibration', () => {
  const committed = [
    { id: 'cal-1', scale: 0.1 },
    { id: 'cal-2', scale: 0.12 },
  ];
  const draft0 = startDraftRecalibration(committed);

  test('starting a draft never touches the committed set', () => {
    assert.deepEqual(draft0.committed, committed);
    assert.equal(draft0.replaced, false);
  });

  test('cancel before any draft save restores committed untouched', () => {
    assert.deepEqual(cancelDraftRecalibration(draft0), committed);
  });

  test('first draft save replaces the visible set, second appends', () => {
    const first = applyDraftCalibration(draft0, committed, { id: 'cal-d1', scale: 0.2 });
    assert.deepEqual(first.calibrations, [{ id: 'cal-d1', scale: 0.2 }]);
    assert.equal(first.draft.replaced, true);
    const second = applyDraftCalibration(first.draft, first.calibrations, { id: 'cal-d2', scale: 0.22 });
    assert.deepEqual(second.calibrations, [
      { id: 'cal-d1', scale: 0.2 },
      { id: 'cal-d2', scale: 0.22 },
    ]);
  });

  test('cancel after draft saves discards the draft, committed untouched', () => {
    const first = applyDraftCalibration(draft0, committed, { id: 'cal-d1', scale: 0.2 });
    assert.deepEqual(cancelDraftRecalibration(first.draft), committed);
  });

  test('confirm keeps the visible draft set (promotion is a no-op on values)', () => {
    const first = applyDraftCalibration(draft0, committed, { id: 'cal-d1', scale: 0.2 });
    // Promotion: component nulls the draft ref; calibrations in state ARE the committed set now.
    assert.deepEqual(first.calibrations, [{ id: 'cal-d1', scale: 0.2 }]);
  });
});

describe('6.4 provenance stamping', () => {
  test('computeCalibrationRecompute resolves a unique area match and stampSourceProvenance writes source_geometry_id', () => {
    const result = computeCalibrationRecompute({
      measurements: [
        {
          id: 'dep-1',
          type: 'area',
          value: 50,
          points: null,
          entryInputs: { value_basis: 'plan', plan_value: 50 },
          quoteRoofAreaId: 'area-a',
        },
      ],
      roofAreas: [
        {
          id: 'poly-1',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          area: 100,
          pitch: 0,
          quoteRoofAreaId: 'area-a',
        },
      ],
      oldScale: 1,
      newCalibration: { scale: 0.5, unit: 'meters' } as never,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provenance.length, 1);
    assert.equal(result.provenance[0].resolution, 'unique_area_match');
    assert.equal(result.provenance[0].sourceGeometryId, 'poly-1');

    const stamped = stampSourceProvenance(
      { id: 'dep-1', entryInputs: { value_basis: 'plan', plan_value: 25 } },
      result.provenance[0],
    );
    assert.equal(stamped.entryInputs?.source_geometry_id, 'poly-1');
    assert.equal((stamped.entryInputs as { plan_value?: number }).plan_value, 25);

    // Idempotent: stamping again does not duplicate or change anything.
    const again = stampSourceProvenance(stamped, result.provenance[0]);
    assert.deepEqual(again, stamped);
  });

  test('scale_ratio fallback (no source polygon) is NOT stamped', () => {
    const link = { measurementId: 'dep-2', sourceGeometryId: null, resolution: 'scale_ratio' as const };
    const m = { id: 'dep-2', entryInputs: { plan_value: 10 } };
    assert.deepEqual(stampSourceProvenance(m, link), m);
    assert.deepEqual(stampSourceProvenance(m, undefined), m);
  });

  test('stamps onto measurements with no entryInputs at all', () => {
    const link = { measurementId: 'dep-3', sourceGeometryId: 'poly-9', resolution: 'source_geometry_id' as const };
    const stamped = stampSourceProvenance({ id: 'dep-3' }, link);
    assert.equal(stamped.entryInputs?.source_geometry_id, 'poly-9');
  });
});
