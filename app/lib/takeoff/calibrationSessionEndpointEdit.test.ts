// Mobile takeoff M4 (spec 2026-09-21 §7.2/§7.3/§7.4, acceptance IDs C01-C12
// pure-logic subset): human endpoint editing, manual A/B wizard acceptance,
// provenance, duplicate guards, reconfirmation exclusion, evidence currency
// and the C12 disagreement acknowledgement gate.
// Run: node --import tsx --test app/lib/takeoff/calibrationSessionEndpointEdit.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrationSessionReducer,
  makeCandidate,
  selectDraftEffectiveCalibration,
  validAcceptedReferences,
  evidenceIsCurrent,
  effectiveCandidateEndpoints,
  endpointOverrideFor,
  needsReconfirmationIds,
  type CalibrationSessionState,
  type SessionContext,
} from './calibrationSession';
import {
  finishBlockers,
  buildCalibrationCommit,
  pageScopedDependents,
  pageDependentRecompute,
  manualPairValid,
  calibrationDescriptorFromSource,
} from './precision/touchCalibration';
import { decodeCalibrationMetadata, encodeCalibrationMetadata } from './calibrationCodec';
import { effectiveScaleFromLegacyCalibrations, type LegacyCalibrationLike } from './calibration';
import type { CalibrationImageDescriptor } from './calibrationTypes';

const IMAGE: CalibrationImageDescriptor = {
  pageId: 'page-1',
  imageRevision: 'rev-1',
  frameKey: 'frame-1',
  sourceWidth: 4000,
  sourceHeight: 3000,
  sceneWidth: 2000,
  sceneHeight: 1500,
  sourceToScene: [0.5, 0, 0, 0.5, 0, 0],
  coordinateFrame: 'takeoff-scene-v1',
  geometryVersion: 1,
};

// Spans 1000 / 600 / 300 px with consistent 0.01 m/px ratios.
const C1 = makeCandidate({ id: 'c1', sceneP1: { x: 100, y: 100 }, sceneP2: { x: 1100, y: 100 }, suggestedDistance: 10, suggestedUnit: 'm' });
const C2 = makeCandidate({ id: 'c2', sceneP1: { x: 200, y: 400 }, sceneP2: { x: 800, y: 400 }, suggestedDistance: 6, suggestedUnit: 'm' });
const C3 = makeCandidate({ id: 'c3', sceneP1: { x: 300, y: 700 }, sceneP2: { x: 600, y: 700 }, suggestedDistance: 3, suggestedUnit: 'm' });

function boot(mode: 'new' | 'edit' = 'new', initialAccepted: AcceptedRefSeed[] = []): CalibrationSessionState {
  if (mode === 'edit') {
    return calibrationSessionReducer({} as CalibrationSessionState, {
      type: 'START_EDIT',
      quoteId: 'quote-1',
      image: IMAGE,
      baseCalibrationRevision: 1,
      initialAccepted: initialAccepted.map(makeAcceptedRef),
    });
  }
  return calibrationSessionReducer({} as CalibrationSessionState, {
    type: 'START_NEW',
    quoteId: 'quote-1',
    image: IMAGE,
    baseCalibrationRevision: 1,
  });
}

type AcceptedRefSeed = {
  id: string;
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  distance?: number;
  unit?: 'm' | 'ft';
  source?: 'manual' | 'ai_confirmed' | 'ai_adjusted';
  candidateId?: string | null;
};

function makeAcceptedRef(seed: AcceptedRefSeed) {
  const p1 = seed.p1 ?? { x: 0, y: 0 };
  const p2 = seed.p2 ?? { x: 1000, y: 0 };
  return {
    id: seed.id,
    source: seed.source ?? 'manual',
    candidateId: seed.candidateId ?? null,
    referenceId: null,
    candidateRevision: null,
    sceneP1: p1,
    sceneP2: p2,
    confirmedDistance: seed.distance ?? 10,
    confirmedUnit: seed.unit ?? 'm',
    originalLabelText: null,
    valueCorrected: false,
    endpointsEdited: seed.source === 'ai_adjusted',
  };
}

function runSearch(state: CalibrationSessionState, requestId = 'req-1', candidates = [C1, C2, C3]): CalibrationSessionState {
  const c = (s: CalibrationSessionState): SessionContext => ({
    quoteId: 'quote-1',
    pageId: s.image.pageId,
    frameKey: s.image.frameKey,
    sessionId: s.sessionId,
    requestId,
    contextEpoch: s.contextEpoch,
  });
  const started = calibrationSessionReducer(state, {
    type: 'SEARCH_STARTED', context: c(state), round: 0, strategy: 'initial',
  });
  return calibrationSessionReducer(started, {
    type: 'SEARCH_SUCCEEDED', context: c(started), round: 0, candidates,
  });
}

function manualAccept(state: CalibrationSessionState, distance: string, unit: 'm' | 'ft', finish = false) {
  return calibrationSessionReducer(state, { type: 'ACCEPT_MANUAL', distance, unit, finish });
}

// ── Manual A/B wizard (§7.2, C01/C02/C07) ─────────────────────────────────

describe('M4 manual A/B wizard', () => {
  test('C01: A→B→distance→accept saves one manual reference; finish reaches committing', () => {
    let s = boot();
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    assert.equal(s.phase, 'manual');
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 100, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 1100, y: 100 } });
    s = manualAccept(s, '10', 'm', true);
    assert.equal(s.error, null, JSON.stringify(s.error));
    assert.equal(s.accepted.length, 1);
    assert.equal(s.accepted[0].source, 'manual');
    assert.equal(s.phase, 'committing');
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.equal(eff?.scale, 0.01);
  });

  test('C02: save & add another stores up to three; a fourth is blocked; wizard pair resets between', () => {
    let s = boot();
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    for (let i = 0; i < 3; i++) {
      s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 100 + i, y: 100 } });
      s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 1100 + i, y: 100 } });
      s = manualAccept(s, '10', 'm');
      assert.equal(s.accepted.length, i + 1);
      assert.equal(s.manualDraft?.p1, null, 'pair resets after each saved reference');
    }
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 500, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 900, y: 100 } });
    s = manualAccept(s, '4', 'm');
    assert.equal(s.accepted.length, 3, 'fourth reference never added');
    assert.equal(s.error?.code, 'accepted_cap_reached');
  });

  test('C02: mixed manual + AI share the 3-cap', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // c1 accepted
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 0, y: 500 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 500, y: 500 } });
    s = manualAccept(s, '5', 'm');
    assert.equal(s.accepted.length, 2);
    // One more AI + one more manual would exceed three: whichever comes last blocks.
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.accepted.length, 3);
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 0, y: 900 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 200, y: 900 } });
    s = manualAccept(s, '2', 'm');
    assert.equal(s.accepted.length, 3);
    assert.equal(s.error?.code, 'accepted_cap_reached');
  });

  test('C07: missing unit, bad distance text and coincident points are rejected with usable manual errors', () => {
    let s = boot();
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 10, y: 10 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 1010, y: 10 } });
    let r = manualAccept(s, '10', null as never);
    assert.equal(r.error?.code, 'unit_required');
    r = manualAccept(s, 'abc', 'm');
    assert.equal(r.error?.code, 'invalid_distance');
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 10, y: 10 } });
    r = manualAccept(s, '10', 'm');
    assert.equal(r.error?.code, 'invalid_endpoints');
    // Missing endpoints entirely.
    s = calibrationSessionReducer(s, { type: 'CLEAR_MANUAL_ENDPOINTS' });
    r = manualAccept(s, '10', 'm');
    assert.equal(r.error?.code, 'endpoints_required');
  });
});

// ── Human endpoint editing of AI candidates (§7.4, C05/C06/C08/C09/C10) ────

describe('M4 human endpoint repair of AI proposals', () => {
  test('C05: repair candidate 2 and accept only it; saved endpoints are exactly the edited points, provenance ai_adjusted', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    // Human moves B 200px right: span 600 -> 800.
    s = calibrationSessionReducer(s, {
      type: 'EDIT_ENDPOINT', candidateId: 'c2',
      sceneP2: { x: 1000, y: 400 },
    });
    assert.ok(evidenceIsCurrent(s, 'c2') === false, 'stale AI evidence must not count as current (C09)');
    assert.equal(evidenceIsCurrent(s, 'c1'), true);
    const eff = effectiveCandidateEndpoints(s, C2);
    assert.deepEqual(eff.sceneP2, { x: 1000, y: 400 });
    assert.equal(eff.edited, true);
    // Raw proposal untouched.
    assert.deepEqual(s.candidates.find((c) => c.id === 'c2')!.sceneP2, { x: 800, y: 400 });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error, null, JSON.stringify(s.error));
    assert.equal(s.accepted.length, 1);
    const ref = s.accepted[0];
    assert.deepEqual(ref.sceneP2, { x: 1000, y: 400 }, 'acceptance reads effective edited endpoints');
    assert.equal(ref.source, 'ai_adjusted');
    assert.equal(ref.endpointsEdited, true);
    // 6 m over 800 px = 0.0075 m/px.
    const effCal = selectDraftEffectiveCalibration(s, 'meters');
    assert.equal(effCal?.scale, 0.0075);
    // C04: finish with this single repaired reference while others are unreviewed.
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.phase, 'committing');
  });

  test('C06: repair two, retain one untouched; only the accepted reconfirmed set contributes', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c1' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // untouched c1
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c2', sceneP2: { x: 800, y: 500 } });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c3' });
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c3', sceneP1: { x: 300, y: 800 } });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.accepted.length, 3);
    assert.equal(s.accepted.filter((r) => r.source === 'ai_adjusted').length, 2);
    assert.equal(s.accepted.filter((r) => r.source === 'ai_confirmed').length, 1);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.equal(eff?.validCalibrationCount, 3);
  });

  test('C08: editing an ACCEPTED pair excludes its old contribution until reconfirmed; re-acceptance uses new endpoints', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // c1 accepted, 10 m / 1000 px
    const before = selectDraftEffectiveCalibration(s, 'meters')!.scale;
    assert.equal(before, 0.01);
    s = calibrationSessionReducer(s, {
      type: 'EDIT_ENDPOINT', candidateId: 'c1',
      sceneP1: { x: 100, y: 100 }, sceneP2: { x: 900, y: 100 }, // 1000 -> 800 px
    });
    assert.deepEqual(needsReconfirmationIds(s), [s.accepted[0].id]);
    assert.equal(validAcceptedReferences(s).length, 0, 'excluded from the draft effective scale');
    assert.equal(selectDraftEffectiveCalibration(s, 'meters'), null);
    // Re-accept (reconfirm) with the same 10 m label now over 800 px.
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c1' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error, null, JSON.stringify(s.error));
    const after = selectDraftEffectiveCalibration(s, 'meters')!;
    assert.equal(after.scale, 10 / 800, 'effective scale uses the NEW endpoints (0.0125)');
    assert.deepEqual(s.accepted[0].sceneP2, { x: 900, y: 100 });
  });

  test('C09: DETACH_REFERENCE converts a repaired pair to a manual reference and kills the AI evidence link', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    const refId = s.accepted[0].id;
    s = calibrationSessionReducer(s, { type: 'DETACH_REFERENCE', id: refId });
    const ref = s.accepted.find((r) => r.id === refId)!;
    assert.equal(ref.source, 'manual');
    assert.equal(ref.candidateId, null);
    assert.equal(ref.referenceId, null);
    assert.equal(ref.originalLabelText, null);
    assert.equal(ref.endpointsEdited, true);
    assert.equal(s.reviews['c1']?.decision, 'skipped');
  });

  test('C10: switching candidates preserves each endpoint override draft; numbering stable', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c2', sceneP1: { x: 210, y: 410 } });
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c3' });
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    assert.deepEqual(endpointOverrideFor(s, 'c2')?.sceneP1, { x: 210, y: 410 });
    // A new search round keeps overrides for surviving candidates.
    s = runSearch(s, 'req-2');
    assert.ok(endpointOverrideFor(s, 'c2'), 'override survives the next search slice');
    assert.deepEqual(s.candidates[1].id, 'c2', 'candidate order stable');
  });

  test('RESET_ENDPOINTS clears the override; re-acceptance restores the original endpoints', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c1', sceneP2: { x: 900, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'RESET_ENDPOINTS', candidateId: 'c1' });
    assert.equal(endpointOverrideFor(s, 'c1'), null);
    assert.equal(evidenceIsCurrent(s, 'c1'), true);
    const eff = effectiveCandidateEndpoints(s, C1);
    assert.deepEqual(eff.sceneP2, { x: 1100, y: 100 });
    assert.equal(eff.edited, false);
  });

  test('R02/C05: endpoint edits never change search rounds or dispatch provider traffic (pure reducer)', () => {
    let s = runSearch(boot());
    const rounds = s.searchRoundsCompleted;
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c1', sceneP2: { x: 1200, y: 100 } });
    assert.equal(s.searchRoundsCompleted, rounds);
    assert.equal(s.phase, 'reviewing');
  });
});

// ── Duplicate guard (C11) ──────────────────────────────────────────────────

describe('M4 duplicate reference guard', () => {
  test('C11: an exact OR reversed duplicate of an accepted pair is rejected; distinct nested pairs allowed', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // c1: (100,100)-(1100,100)
    // c2 moved to exactly c1's span.
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c2', sceneP1: { x: 1100, y: 100 }, sceneP2: { x: 100, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.accepted.length, 1);
    assert.equal(s.error?.code, 'duplicate_reference', 'reversed duplicate blocked');
    // A distinct nested span on the same line is fine.
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c2', sceneP1: { x: 200, y: 100 }, sceneP2: { x: 1000, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error, null, JSON.stringify(s.error));
    assert.equal(s.accepted.length, 2, 'distinct nested reference accepted');
  });

  test('C11: manual pair duplicating an accepted AI pair is rejected too', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // c1
    s = calibrationSessionReducer(s, { type: 'BEGIN_MANUAL_REFERENCE' });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: { x: 100, y: 100 } });
    s = calibrationSessionReducer(s, { type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: { x: 1100, y: 100 } });
    s = manualAccept(s, '10', 'm');
    assert.equal(s.accepted.length, 1);
    assert.equal(s.error?.code, 'duplicate_reference');
  });
});

// ── C12 disagreement acknowledgement ───────────────────────────────────────

describe('M4 C12 disagreement acknowledgement gate', () => {
  test('warning present -> acknowledgement required; ACKNOWLEDGE_DISAGREEMENT clears it; new edit resets it', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' }); // 0.01
    // Second reference with a wildly different ratio: 20 m over 300 px ≈ 0.0667.
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c3' });
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'c3', value: '20' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error, null, JSON.stringify(s.error));
    let blockers = finishBlockers(s, 'meters');
    assert.ok(blockers.disagreementWarning != null);
    assert.equal(blockers.acknowledgementRequired, true, 'finish blocked without acknowledgement');
    // The reducer itself still finishes (desktop policy unchanged) - the touch
    // presentation gates on finishBlockers before dispatching FINISH.
    s = calibrationSessionReducer(s, { type: 'ACKNOWLEDGE_DISAGREEMENT' });
    blockers = finishBlockers(s, 'meters');
    assert.equal(blockers.acknowledgementRequired, false);
    // Any subsequent accepted-set change revokes the acknowledgement.
    s = calibrationSessionReducer(s, { type: 'REMOVE_ACCEPTED', id: s.accepted[0].id });
    blockers = finishBlockers(s, 'meters');
    assert.equal(blockers.acknowledgementRequired, false, 'no acknowledgement carried over after the set changed');
    assert.equal(validAcceptedReferences(s).length, 1, 'only one reference left: no disagreement possible');
  });

  test('no acknowledgement prompt when references agree', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    const blockers = finishBlockers(s, 'meters');
    assert.equal(blockers.disagreementWarning, null);
    assert.equal(blockers.acknowledgementRequired, false);
  });
});

// ── Codec provenance round-trip (§7.4 rule 5) ──────────────────────────────

describe('M4 provenance codec round-trip', () => {
  test('ai_adjusted + endpointsEdited survive encode/decode exactly', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c2' });
    s = calibrationSessionReducer(s, { type: 'EDIT_ENDPOINT', candidateId: 'c2', sceneP2: { x: 1000, y: 400 } });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error, null, JSON.stringify(s.error));
    const envelope = encodeCalibrationMetadata({ accepted: s.accepted, workingUnit: 'meters', imageRevision: 'rev-1', savedAt: 'now' });
    const decoded = decodeCalibrationMetadata(envelope);
    assert.equal(decoded.kind, 'v1');
    if (decoded.kind !== 'v1') return;
    const ref = decoded.metadata.references[0];
    assert.equal(ref.source, 'ai_adjusted');
    assert.equal(ref.endpointsEdited, true);
    assert.deepEqual(ref.sceneP2, { x: 1000, y: 400 });
  });

  test('pre-M4 envelopes (ai_confirmed, no endpointsEdited) still decode with endpointsEdited=false', () => {
    const envelope = encodeCalibrationMetadata({
      accepted: [makeAcceptedRef({ id: 'r1', source: 'ai_confirmed', candidateId: 'cx' })],
      workingUnit: 'meters',
      imageRevision: 'rev-1',
    });
    const raw = JSON.parse(JSON.stringify(envelope));
    delete raw.references[0].endpointsEdited;
    const decoded = decodeCalibrationMetadata(raw);
    assert.equal(decoded.kind, 'v1');
    if (decoded.kind !== 'v1') return;
    assert.equal(decoded.metadata.references[0].source, 'ai_confirmed');
    assert.equal(decoded.metadata.references[0].endpointsEdited, false);
  });
});

// ── Commit payload + page-scoped recompute (C13/C14, R14) ──────────────────

describe('M4 commit payload and recompute scope', () => {
  test('buildCalibrationCommit matches the desktop legacy mapping: effectiveScaleFromLegacyCalibrations equals the metadata scale', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    s = calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: 'c3' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    const payload = buildCalibrationCommit(s.accepted, 'meters', 'rev-1', '2026-09-21T00:00:00Z');
    assert.equal(payload.legacy.length, 2);
    const legacyScale = effectiveScaleFromLegacyCalibrations(payload.legacy as LegacyCalibrationLike[]);
    assert.ok(Math.abs(legacyScale - payload.metadata.effective.scale) < 1e-12);
  });

  test('C13: pageScopedDependents filters to this page only; null fromPageId counts as page-owned', () => {
    const scoped = pageScopedDependents('page-A', {
      measurements: [
        { id: 'mA', type: 'line', value: 1, fromPageId: 'page-A' },
        { id: 'mB', type: 'line', value: 2, fromPageId: 'page-B' },
        { id: 'mC', type: 'line', value: 3, fromPageId: null },
      ],
      roofAreas: [
        { id: 'aA', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], area: 50, fromPageId: 'page-A' },
        { id: 'aB', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], area: 50, fromPageId: 'page-B' },
      ],
    });
    assert.deepEqual(scoped.measurements.map((m) => m.id), ['mA', 'mC']);
    assert.deepEqual(scoped.roofAreas.map((a) => a.id), ['aA']);
  });

  test('C13: pageDependentRecompute rescales only this page’s entries and derives oldScale from the legacy set', () => {
    const legacyBefore: LegacyCalibrationLike[] = [
      { id: 'r1', point1: { x: 0, y: 0 }, point2: { x: 1000, y: 0 }, unit: 'meters', actualDistance: 10 },
    ];
    const newPayload = buildCalibrationCommit(
      [makeAcceptedRef({ id: 'r2', p1: { x: 0, y: 0 }, p2: { x: 1000, y: 0 }, distance: 12.5 })],
      'meters', 'rev-1', 'now',
    );
    const result = pageDependentRecompute({
      pageId: 'page-A',
      dependents: {
        measurements: [
          { id: 'mA', type: 'line', value: 10, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], fromPageId: 'page-A' },
          { id: 'mB', type: 'line', value: 10, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], fromPageId: 'page-B' },
        ],
        roofAreas: [],
      },
      previousLegacyCalibrations: legacyBefore,
      newEffectiveScale: newPayload.metadata.effective.scale,
      newCalibration: newPayload.metadata.effective,
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const updated = result.measurementUpdates.find((u) => u.id === 'mA');
    assert.ok(updated);
    assert.ok(Math.abs(updated.value - 12.5) < 1e-9, `10 m rescaled to 12.5 m at the new scale, got ${updated.value}`);
    assert.equal(result.measurementUpdates.some((u) => u.id === 'mB'), false, 'other page untouched');
  });

  test('manualPairValid / descriptor builder invariants', () => {
    assert.equal(manualPairValid({ x: 0, y: 0 }, { x: 0, y: 0 }).ok, false);
    assert.equal(manualPairValid(null, { x: 1, y: 1 }).ok, false);
    assert.equal(manualPairValid({ x: 0, y: 0 }, { x: 3, y: 4 }).ok, true);
    const d = calibrationDescriptorFromSource({
      pageId: 'p1', imageRevision: 'r1', frameKey: 'f1', sourceWidth: 4000, sourceHeight: 3000,
    });
    assert.equal(d.sceneWidth, 2000);
    assert.equal(d.sceneHeight, 1500);
    assert.deepEqual(d.sourceToScene, [0.5, 0, 0, 0.5, 0, 0]);
  });
});
