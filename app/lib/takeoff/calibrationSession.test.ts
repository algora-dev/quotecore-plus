// calibration-state suite (spec 14.1): reducer behaviour for every user-decision
// pattern in section 1.2 plus the race/lifecycle protections in section 8.3.
// Run: node --import tsx --test app/lib/takeoff/calibrationSession.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrationSessionReducer,
  makeCandidate,
  selectDraftEffectiveCalibration,
  selectRescanRemaining,
  selectUnfinishedCount,
  selectCanMeasure,
  validAcceptedReferences,
  type CalibrationSessionState,
  type SessionContext,
} from './calibrationSession';
import type { AcceptedReferenceDraft, CalibrationImageDescriptor } from './calibrationTypes';
import { encodeCalibrationMetadata, decodeCalibrationMetadata } from './calibrationCodec';

const IMAGE: CalibrationImageDescriptor = {
  pageId: 'page-1',
  imageRevision: 'rev-1',
  frameKey: 'frame-1',
  frameKey: 'frame-1',
  sourceWidth: 4000,
  sourceHeight: 3000,
  sceneWidth: 2000,
  sceneHeight: 1500,
  sourceToScene: [0.5, 0, 0, 0.5, 0, 0],
  coordinateFrame: 'takeoff-scene-v1',
  geometryVersion: 1,
};

// Longest -> shortest: spans 1000, 600, 300 px. Suggestions chosen so ratios differ.
const C1 = makeCandidate({ id: 'c1', sceneP1: { x: 100, y: 100 }, sceneP2: { x: 1100, y: 100 }, suggestedDistance: 10, suggestedUnit: 'm' });
const C2 = makeCandidate({ id: 'c2', sceneP1: { x: 200, y: 400 }, sceneP2: { x: 800, y: 400 }, suggestedDistance: 6, suggestedUnit: 'm' });
const C3 = makeCandidate({ id: 'c3', sceneP1: { x: 300, y: 700 }, sceneP2: { x: 600, y: 700 }, suggestedDistance: 6.42, suggestedUnit: 'm' });

function ctx(state: CalibrationSessionState, requestId: string): SessionContext {
  return {
    quoteId: 'quote-1',
    pageId: state.image.pageId,
    frameKey: state.image.frameKey,
    sessionId: state.sessionId,
    requestId,
    contextEpoch: state.contextEpoch,
  };
}

function runSearch(state: CalibrationSessionState, requestId = 'req-1', candidates = [C1, C2, C3]): CalibrationSessionState {
  const s = calibrationSessionReducer(state, { type: 'SEARCH_STARTED', context: ctx(state, requestId), round: state.searchRoundsCompleted === 0 ? 0 : 1, strategy: 'initial' });
  return calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, requestId), round: s.pendingRound ?? 0, candidates });
}

function select(s: CalibrationSessionState, id: string): CalibrationSessionState {
  return calibrationSessionReducer(s, { type: 'SELECT_CANDIDATE', candidateId: id });
}

function accept(s: CalibrationSessionState): CalibrationSessionState {
  return calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
}

function skip(s: CalibrationSessionState, reason: 'endpoints' | 'wrong_reference' | 'unsure' = 'endpoints'): CalibrationSessionState {
  return calibrationSessionReducer(s, { type: 'SKIP_CURRENT', reason });
}

/** Seed state without relying on the placeholder constant. */
function boot(): CalibrationSessionState {
  return calibrationSessionReducer({} as CalibrationSessionState, {
    type: 'START_NEW',
    quoteId: 'quote-1',
    image: IMAGE,
    baseCalibrationRevision: 3,
  });
}

describe('session lifecycle', () => {
  test('START_NEW creates an empty draft without touching anything else', () => {
    const s = boot();
    assert.equal(s.phase, 'idle');
    assert.equal(s.mode, 'new');
    assert.equal(s.accepted.length, 0);
    assert.ok(s.sessionId);
  });

  test('SEARCH_STARTED locks duplicates; a second concurrent START is ignored', () => {
    let s = runSearchStarted(boot());
    const before = JSON.stringify(s);
    s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-2'), round: 0, strategy: 'initial' });
    assert.equal(JSON.stringify(s), before, 'duplicate search ignored');
    assert.equal(s.requestId, 'req-1');
  });

  test('SEARCH_FAILED keeps the draft and does not consume a round', () => {
    let s = runSearchStarted(boot());
    s = calibrationSessionReducer(s, { type: 'SEARCH_FAILED', code: 'MODEL_TIMEOUT', message: 'timeout', requestId: 'req-1' });
    assert.equal(s.phase, 'reviewing');
    assert.equal(s.searchRoundsCompleted, 0, 'failure consumes no round');
    assert.equal(s.error?.code, 'MODEL_TIMEOUT');
    assert.equal(s.requestId, null);
  });
});

function runSearchStarted(s: CalibrationSessionState): CalibrationSessionState {
  return calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-1'), round: s.searchRoundsCompleted === 0 ? 0 : 1, strategy: 'initial' });
}

describe('spec 1.2 acceptance examples', () => {
  test('row 1: accept first proposal and finish immediately - one-reference scale', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_AND_FINISH' });
    assert.equal(s.phase, 'committing');
    assert.equal(s.accepted.length, 1);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    assert.equal(eff.validCalibrationCount, 1);
    assert.ok(Math.abs(eff.scale - 10 / 1000) < 1e-12, '10 m over 1000 px = 0.01 m/px');
  });

  test('row 2: skip the two longest, accept the shortest - shortest alone sets scale', () => {
    let s = runSearch(boot());
    s = skip(s); // c1
    s = select(s, 'c2'); s = skip(s);
    s = select(s, 'c3'); s = accept(s);
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.accepted.length, 1);
    assert.equal(s.accepted[0].candidateId, 'c3');
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    assert.ok(Math.abs(eff.scale - 6.42 / 300) < 1e-12, 'shortest reference only, no longest override');
  });

  test('row 3: skip first, correct second distance, finish - endpoints unchanged', () => {
    let s = runSearch(boot());
    s = skip(s);
    s = select(s, 'c2');
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'c2', value: '6.1' });
    s = accept(s);
    const ref = s.accepted[0];
    assert.equal(ref.candidateId, 'c2');
    assert.equal(ref.confirmedDistance, 6.1);
    assert.equal(ref.valueCorrected, true);
    // endpoints untouched
    assert.deepEqual(ref.sceneP1, C2.sceneP1);
    assert.deepEqual(ref.sceneP2, C2.sceneP2);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    assert.ok(Math.abs(eff.scale - 6.1 / 600) < 1e-12);
  });

  test('row 4: accept first and third, skip second - mean of those two ratios', () => {
    let s = runSearch(boot());
    s = accept(s); // c1, focus moves to c2
    s = skip(s);   // c2
    s = select(s, 'c3'); s = accept(s);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    const expected = ((10 / 1000) + (6.42 / 300)) / 2;
    assert.ok(Math.abs(eff.scale - expected) < 1e-12, 'arithmetic mean of the two accepted ratios');
  });

  test('row 5: correct second value, accept second and third - old reading never used', () => {
    let s = runSearch(boot());
    s = skip(s);
    s = select(s, 'c2');
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'c2', value: '5.1' });
    s = accept(s);
    s = select(s, 'c3'); s = accept(s);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    const expected = ((5.1 / 600) + (6.42 / 300)) / 2;
    assert.ok(Math.abs(eff.scale - expected) < 1e-12);
  });

  test('row 6: accept all three - mean of all normalised ratios', () => {
    let s = runSearch(boot());
    s = accept(s); s = accept(s); s = accept(s);
    assert.equal(s.accepted.length, 3);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    const expected = ((10 / 1000) + (6 / 600) + (6.42 / 300)) / 3;
    assert.ok(Math.abs(eff.scale - expected) < 1e-12);
  });

  test('row 7: only one reference with unreadable text - manual distance required then accepted', () => {
    const unreadable = makeCandidate({
      id: 'c9',
      sceneP1: { x: 50, y: 50 },
      sceneP2: { x: 2050, y: 50 },
      suggestedDistance: null,
      suggestedUnit: null,
      valueState: 'needs_both',
    });
    let s = runSearch(boot(), 'req-1', [unreadable]);
    // accepting without entry fails
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error?.code, 'distance_required');
    assert.equal(s.accepted.length, 0);
    // user enters value + unit
    s = calibrationSessionReducer(s, { type: 'EDIT_UNIT', candidateId: 'c9', unit: 'ft' });
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'c9', value: '10' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_AND_FINISH' });
    assert.equal(s.phase, 'committing');
    assert.equal(s.accepted[0].confirmedUnit, 'ft');
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    assert.ok(Math.abs(eff.scale - (10 * 0.3048) / 2000) < 1e-12, 'unit-normalised to metres');
  });

  test('row 8: accept one, rescan finds nothing useful - accepted reference survives', () => {
    let s = runSearch(boot());
    s = accept(s); // c1
    s = calibrationSessionReducer(s, { type: 'REQUEST_RESCAN', strategy: 'different_references' });
    assert.equal(s.error, null);
    s = runSearch(s, 'req-2', []);
    assert.equal(s.candidates.length, 0, 'empty result is a normal result');
    assert.equal(s.accepted.length, 1, 'accepted reference retained');
    assert.equal(s.searchRoundsCompleted, 2, 'empty search consumed the rescan round');
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.phase, 'committing', 'user can still finish with the accepted reference');
  });

  test('row 9: none correct - no calibration created, rescan still offered once', () => {
    let s = runSearch(boot());
    s = skip(s); s = skip(s); s = skip(s);
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.phase, 'reviewing');
    assert.equal(s.error?.code, 'no_valid_references');
    assert.equal(selectRescanRemaining(s), 1, 'one rescan still available');
  });
});

describe('race and lifecycle protection (spec 8.3)', () => {
  test('stale-epoch SEARCH_SUCCEEDED is discarded', () => {
    let s = runSearchStarted(boot());
    const stale = { ...ctx(s, 'req-1'), contextEpoch: s.contextEpoch + 99 };
    s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: stale, round: 0, candidates: [C1] });
    assert.equal(s.phase, 'searching', 'stale result discarded, still searching');
    assert.equal(s.candidates.length, 0);
  });

  test('mismatched requestId / pageId / frameKey results are discarded', () => {
    let s = runSearchStarted(boot());
    for (const bad of [
      { ...ctx(s, 'req-other') },
      { ...ctx(s, 'req-1'), pageId: 'page-2' },
      { ...ctx(s, 'req-1'), frameKey: 'frame-9' },
    ]) {
      s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: bad, round: 0, candidates: [C1] });
    }
    assert.equal(s.phase, 'searching');
  });

  test('candidates from a different imageRevision are filtered out', () => {
    const wrongRev = makeCandidate({ id: 'cx', imageRevision: 'rev-other' });
    const s = runSearch(boot(), 'req-1', [wrongRev, C1]);
    assert.deepEqual(s.candidates.map((c) => c.id), ['c1']);
  });

  test('P0-6: candidates keep their server revision and pass when the descriptor revision is unknown', () => {
    // The client does not know the authoritative revision up front (null) -
    // candidates keep their server revision verbatim and remain usable; the
    // controller guards cross-response consistency separately.
    const unknownImage: CalibrationImageDescriptor = { ...IMAGE, imageRevision: null };
    const s0 = calibrationSessionReducer({} as CalibrationSessionState, {
      type: 'START_NEW', quoteId: 'quote-1', image: unknownImage, baseCalibrationRevision: 0,
    });
    const s = runSearch(s0, 'req-1', [C1]);
    assert.deepEqual(s.candidates.map((c) => c.id), ['c1']);
    assert.equal(s.candidates[0].imageRevision, 'rev-1', 'server revision preserved verbatim, never rewritten');
  });

  test('P0-6: a known descriptor revision still filters mismatched candidates', () => {
    const s = runSearch(boot(), 'req-1', [makeCandidate({ id: 'cx', imageRevision: 'sha256-zzz-on1' })]);
    assert.deepEqual(s.candidates.map((c) => c.id), [], 'mismatched authoritative revision filtered');
  });

  test('CANCEL invalidates outstanding request context', () => {
    let s = runSearchStarted(boot());
    const epoch = s.contextEpoch;
    s = calibrationSessionReducer(s, { type: 'CANCEL' });
    assert.equal(s.phase, 'cancelled');
    assert.equal(s.contextEpoch, epoch + 1);
    assert.equal(s.requestId, null);
    // a late result for the old epoch is now doubly stale and cannot apply
    const late = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, 'req-1'), round: 0, candidates: [C1] });
    assert.equal(late.phase, 'cancelled');
  });

  test('CANCEL/PAGE_CHANGED restores nothing on its own but keeps committed state outside the draft', () => {
    let s = runSearch(boot());
    s = accept(s);
    s = calibrationSessionReducer(s, { type: 'CANCEL' });
    assert.equal(s.accepted.length, 0, 'draft discarded; prior committed state is the parent concern');
  });
});

describe('P0-2 page/image change invalidation (audit 2026-09-20)', () => {
  test('PAGE_CHANGED clears candidates, reviews and accepted draft state', () => {
    let s = runSearch(boot());
    s = accept(s);
    assert.ok(s.candidates.length > 0);
    assert.ok(s.accepted.length > 0);
    const epochBefore = s.contextEpoch;
    s = calibrationSessionReducer(s, { type: 'PAGE_CHANGED' });
    assert.equal(s.phase, 'cancelled');
    assert.equal(s.contextEpoch, epochBefore + 1);
    assert.deepEqual(s.candidates, []);
    assert.deepEqual(s.reviews, {});
    assert.deepEqual(s.accepted, []);
    assert.equal(s.activeCandidateId, null);
    assert.equal(s.requestId, null);
    assert.equal(s.pendingRound, null);
    assert.equal(s.searchStrategy, null);
    assert.equal(s.refineReferenceId, null);
    assert.equal(s.error, null);
  });

  test('IMAGE_CHANGED clears an in-progress review exactly like PAGE_CHANGED', () => {
    let s = runSearch(boot());
    s = select(s, 'c2');
    s = skip(s);
    const epochBefore = s.contextEpoch;
    s = calibrationSessionReducer(s, { type: 'IMAGE_CHANGED' });
    assert.equal(s.phase, 'cancelled');
    assert.equal(s.contextEpoch, epochBefore + 1);
    assert.deepEqual(s.candidates, []);
    assert.deepEqual(s.reviews, {});
    assert.deepEqual(s.accepted, []);
  });

  test('a stale SEARCH_SUCCEEDED after PAGE_CHANGED is discarded (context epoch bumped)', () => {
    let s = runSearchStarted(boot());
    const staleCtx = ctx(s, 'req-1');
    s = calibrationSessionReducer(s, { type: 'PAGE_CHANGED' });
    s = calibrationSessionReducer(s, {
      type: 'SEARCH_SUCCEEDED',
      context: staleCtx,
      round: 0,
      candidates: [C1, C2, C3],
    });
    assert.equal(s.phase, 'cancelled', 'stale result dropped');
    assert.deepEqual(s.candidates, []);
    assert.equal(s.searchRoundsCompleted, 0, 'no round consumed by the stale result');
  });
});

describe('editing and reconfirmation (spec 4.4 / 8.2)', () => {
  test('editing an accepted reference excludes it until reaccepted', () => {
    let s = runSearch(boot());
    s = accept(s); // c1 accepted
    assert.equal(validAcceptedReferences(s).length, 1);
    s = select(s, 'c1');
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'c1', value: '10.2' });
    assert.equal(s.reviews['c1'].decision, 'needs_reconfirmation');
    assert.equal(validAcceptedReferences(s).length, 0, 'excluded from draft scale');
    assert.equal(selectDraftEffectiveCalibration(s, 'meters'), null);
    // finish blocked while nothing valid
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.error?.code, 'no_valid_references');
    // reaccept updates the SAME record once, not a duplicate
    s = calibrationSessionReducer(s, { type: 'ACCEPT_AND_FINISH' });
    assert.equal(s.accepted.length, 1);
    assert.equal(s.accepted[0].confirmedDistance, 10.2);
    assert.equal(s.phase, 'committing');
  });

  test('REMOVE_ACCEPTED removes only that reference and reopens its review', () => {
    let s = runSearch(boot());
    s = accept(s); // c1
    s = calibrationSessionReducer(s, { type: 'REMOVE_ACCEPTED', id: 'ref-c1' });
    assert.equal(s.accepted.length, 0);
    assert.equal(s.reviews['c1'].decision, 'unreviewed');
  });

  test('SELECT_CANDIDATE only changes focus, never decisions', () => {
    let s = runSearch(boot());
    s = select(s, 'c3');
    assert.equal(s.activeCandidateId, 'c3');
    assert.equal(s.reviews['c1']?.decision ?? 'unreviewed', 'unreviewed', 'candidate 1 not accepted/rejected by focus change');
    assert.equal(selectUnfinishedCount(s), 3);
  });
});

describe('shared 3-reference cap (spec 1.1/8.1)', () => {
  test('accepting a 4th is blocked, including mixed manual + AI', () => {
    const manual1: AcceptedReferenceDraft = {
      id: 'ref-manual-1',
      source: 'manual',
      candidateId: null,
      referenceId: null,
      candidateRevision: null,
      sceneP1: { x: 0, y: 0 },
      sceneP2: { x: 500, y: 0 },
      confirmedDistance: 5,
      confirmedUnit: 'm',
      originalLabelText: null,
      valueCorrected: false,
    };
    const manual2: AcceptedReferenceDraft = { ...manual1, id: 'ref-manual-2', sceneP2: { x: 250, y: 0 }, confirmedDistance: 2.5 };
    let s = calibrationSessionReducer(boot(), {
      type: 'START_EDIT',
      quoteId: 'quote-1',
      image: IMAGE,
      baseCalibrationRevision: 3,
      initialAccepted: [manual1, manual2],
    });
    assert.equal(s.accepted.length, 2);
    assert.equal(selectRescanRemaining(s), 1);
    s = runSearch(s, 'req-1', [C1]);
    // 3 - 2 accepted = 1 slot shown
    assert.equal(s.candidates.length, 1);
    s = accept(s); // c1 -> 3 total
    assert.equal(s.accepted.length, 3);
    assert.equal(validAcceptedReferences(s).length, 3);
    // mixing works: mean over manual + AI, unit-normalised
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    const expected = ((5 / 500) + (2.5 / 250) + (10 / 1000)) / 3;
    assert.ok(Math.abs(eff.scale - expected) < 1e-12);
    // a rescan with 3 accepted is unavailable (no slot)
    s = calibrationSessionReducer(s, { type: 'REQUEST_RESCAN', strategy: 'different_references' });
    assert.equal(s.error?.code, 'rescan_unavailable');
  });

  test('strict parsing: parseFloat-style prefixes are rejected', () => {
    const junk = makeCandidate({ id: 'cj', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 400, y: 0 }, suggestedDistance: null, suggestedUnit: null, valueState: 'needs_both' });
    let s = runSearch(boot(), 'req-1', [junk]);
    s = calibrationSessionReducer(s, { type: 'EDIT_UNIT', candidateId: 'cj', unit: 'm' });
    s = calibrationSessionReducer(s, { type: 'EDIT_DISTANCE', candidateId: 'cj', value: '6.42 m wide' });
    s = calibrationSessionReducer(s, { type: 'ACCEPT_CURRENT' });
    assert.equal(s.error?.code, 'invalid_distance');
    assert.equal(s.accepted.length, 0);
  });
});

describe('rescan round accounting (spec 7.1)', () => {
  test('success consumes the round; failure does not; only one rescan exists', () => {
    let s = boot();
    assert.equal(selectRescanRemaining(s), 1);
    s = runSearch(s, 'req-1'); // initial success
    assert.equal(s.searchRoundsCompleted, 1);
    assert.equal(selectRescanRemaining(s), 1, 'rescan still available');
    // failed rescan attempt does not consume
    s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-2'), round: 1, strategy: 'different_references' });
    s = calibrationSessionReducer(s, { type: 'SEARCH_FAILED', code: 'MODEL_TIMEOUT', message: 't' });
    assert.equal(s.searchRoundsCompleted, 1);
    // successful rescan consumes it
    s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-3'), round: 1, strategy: 'different_references' });
    s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, 'req-3'), round: 1, candidates: [C2] });
    assert.equal(s.searchRoundsCompleted, 2);
    assert.equal(selectRescanRemaining(s), 0);
    s = calibrationSessionReducer(s, { type: 'REQUEST_RESCAN', strategy: 'different_references' });
    assert.equal(s.error?.code, 'rescan_unavailable');
  });
});

describe('canMeasure selector (spec 8.1)', () => {
  test('draft array never unlocks tools; searching/committing lock them', () => {
    let s = runSearch(boot());
    s = accept(s);
    assert.equal(selectCanMeasure(s, false), false, 'no committed calibration');
    assert.equal(selectCanMeasure(s, true), true);
    s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-9'), round: 1, strategy: 'different_references' });
    assert.equal(selectCanMeasure(s, true), false, 'locked while searching');
    s = calibrationSessionReducer(s, { type: 'SEARCH_FAILED', code: 'X', message: 'x' });
    assert.equal(selectCanMeasure(s, true), true);
  });
});

describe('commit lifecycle (spec 8.2)', () => {
  test('COMMIT_FAILED keeps the draft and prior committed state; retry works', () => {
    let s = runSearch(boot());
    s = calibrationSessionReducer(s, { type: 'ACCEPT_AND_FINISH' });
    assert.equal(s.phase, 'committing');
    s = calibrationSessionReducer(s, { type: 'COMMIT_FAILED', code: 'SAVE_CONFLICT', message: 'stale version' });
    assert.equal(s.phase, 'reviewing');
    assert.equal(s.accepted.length, 1, 'draft survives');
    assert.equal(s.error?.code, 'SAVE_CONFLICT');
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    s = calibrationSessionReducer(s, { type: 'COMMIT_SUCCEEDED' });
    assert.equal(s.phase, 'completed');
    assert.equal(s.accepted.length, 1, 'accepted set available for persistence');
  });

  test('SWITCH_TO_MANUAL keeps accepted draft references', () => {
    let s = runSearch(boot());
    s = accept(s);
    s = calibrationSessionReducer(s, { type: 'SWITCH_TO_MANUAL' });
    assert.equal(s.phase, 'manual');
    assert.equal(s.accepted.length, 1);
    s = calibrationSessionReducer(s, { type: 'FINISH_ACCEPTED' });
    assert.equal(s.phase, 'committing');
  });
});

describe('disagreement warning propagation', () => {
  test('draft selector surfaces the >10% disagreement warning from computeEffectiveCalibration', () => {
    // c1 = 0.01 m/px, c3 = 0.0214 m/px -> large disagreement
    let s = runSearch(boot());
    s = accept(s);
    s = select(s, 'c3'); s = accept(s);
    const eff = selectDraftEffectiveCalibration(s, 'meters');
    assert.ok(eff);
    assert.ok(eff.scaleRangePct > 10);
    assert.ok(eff.disagreementWarning);
  });
});

// -- P7 E2E-matrix reducer tests (spec 14.2 scenarios 13/14/parallel/reload) --
// Best-effort matrix at the reducer level: lost-response recovery, page-switch
// mid-search, simultaneous tabs and saved-reload hydration via the codec.

describe('P7 e2e matrix (reducer level)', () => {
  test('lost response recovery: SEARCH_FAILED then replay with the SAME requestId still completes the round exactly once', () => {
    // Scenario 14.2-13: network drops after a charged search. The controller
    // arms a retry that reuses requestId 'req-1' (spec 12.4). Reducer contract:
    // failure frees the searching lock WITHOUT consuming a round, and a
    // replayed SEARCH_STARTED/SEARCH_SUCCEEDED pair with the same id is accepted.
    let s = runSearchStarted(boot());
    s = calibrationSessionReducer(s, { type: 'SEARCH_FAILED', code: 'NETWORK_ERROR', message: 'lost response', requestId: 'req-1' });
    assert.equal(s.phase, 'reviewing');
    assert.equal(s.searchRoundsCompleted, 0, 'failed attempt consumes no round');

    // Same-requestId retry (replay).
    s = calibrationSessionReducer(s, { type: 'SEARCH_STARTED', context: ctx(s, 'req-1'), round: 0, strategy: 'initial' });
    assert.equal(s.requestId, 'req-1');
    s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, 'req-1'), round: 0, candidates: [C1] });
    assert.equal(s.phase, 'reviewing');
    assert.equal(s.searchRoundsCompleted, 1, 'round completed exactly once across the lost + replayed attempt');
    assert.equal(s.candidates.length, 1);

    // A third SEARCH_SUCCEEDED with the same (now consumed) request is a stale
    // duplicate and must be discarded.
    const before = JSON.stringify(s);
    s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: ctx(s, 'req-1'), round: 0, candidates: [C2, C3] });
    assert.equal(JSON.stringify(s), before, 'duplicate terminal result replay is a no-op');
  });

  test('page switch mid-search: stale SEARCH_SUCCEEDED from the old page is discarded (context epoch discard)', () => {
    // Scenario 14.2-14: switch page before the response returns.
    let s = runSearchStarted(boot());
    const oldCtx = ctx(s, 'req-1');
    s = calibrationSessionReducer(s, { type: 'PAGE_CHANGED' });
    assert.equal(s.phase, 'cancelled');
    assert.equal(s.contextEpoch, 2, 'epoch advanced');

    const before = JSON.stringify(s);
    s = calibrationSessionReducer(s, { type: 'SEARCH_SUCCEEDED', context: oldCtx, round: 0, candidates: [C1] });
    assert.equal(JSON.stringify(s), before, 'stale result fully discarded - no markers on the wrong image');

    // The old page's candidates never leak into a fresh session on the new page.
    const fresh = calibrationSessionReducer(s, {
      type: 'START_NEW',
      quoteId: 'quote-1',
      image: { ...IMAGE, pageId: 'page-2', imageRevision: 'rev-2' },
      baseCalibrationRevision: 3,
    });
    assert.equal(fresh.candidates.length, 0);
    assert.equal(fresh.contextEpoch, 3);
  });

  test('simultaneous tabs: two independent sessions on the same page run independent rounds', () => {
    const a = boot();
    const b = boot();
    assert.notEqual(a.sessionId, b.sessionId, 'each tab gets its own session id');

    const aCtx = { ...ctx(a, 'req-a') };
    const bCtx = { ...ctx(b, 'req-b') };

    // Tab A round 0 completes; tab B is still searching.
    let sa = calibrationSessionReducer(a, { type: 'SEARCH_STARTED', context: aCtx, round: 0, strategy: 'initial' });
    let sb = calibrationSessionReducer(b, { type: 'SEARCH_STARTED', context: bCtx, round: 0, strategy: 'initial' });
    sa = calibrationSessionReducer(sa, { type: 'SEARCH_SUCCEEDED', context: ctx(sa, 'req-a'), round: 0, candidates: [C1] });
    assert.equal(sa.searchRoundsCompleted, 1);
    assert.equal(sb.searchRoundsCompleted, 0, 'tab B unaffected by tab A completion');

    // Cross-tab leakage: A's success context does not satisfy B's guard.
    const beforeB = JSON.stringify(sb);
    sb = calibrationSessionReducer(sb, { type: 'SEARCH_SUCCEEDED', context: ctx(sa, 'req-a'), round: 0, candidates: [C2] });
    assert.equal(JSON.stringify(sb), beforeB, 'session guard rejects foreign session/result');

    // B completes its own round independently.
    sb = calibrationSessionReducer(sb, { type: 'SEARCH_SUCCEEDED', context: ctx(sb, 'req-b'), round: 0, candidates: [C2, C3] });
    assert.equal(sb.searchRoundsCompleted, 1);
    assert.equal(sb.candidates.length, 2);
    assert.equal(sa.candidates.length, 1, 'tab A candidates untouched');
  });

  test('saved reload: codec round-trip then START_EDIT hydrates accepted references and finish still works', async () => {
    // Simulate save: accept two references, encode -> JSON -> decode (the
    // persistence path), then reload into a fresh session via START_EDIT.
    let s = runSearch(boot());
    s = accept(s);          // c1: 10 m / 1000 px
    s = select(s, 'c3');
    s = accept(s);          // c3: 6.42 m / 300 px

    const encoded = encodeCalibrationMetadata({
      accepted: s.accepted,
      workingUnit: 'meters',
      imageRevision: s.image.imageRevision,
      savedAt: '2026-09-19T12:00:00Z',
    });
    const wire = JSON.parse(JSON.stringify(encoded));
    const decoded = decodeCalibrationMetadata(wire);
    assert.equal(decoded.kind, 'v1');
    assert.equal(decoded.status, 'valid', `diagnostics: ${decoded.kind === 'v1' ? decoded.diagnostics.join('; ') : ''}`);
    if (decoded.kind !== 'v1') throw new Error('unreachable');

    const reloaded = calibrationSessionReducer({} as CalibrationSessionState, {
      type: 'START_EDIT',
      quoteId: 'quote-1',
      image: IMAGE,
      baseCalibrationRevision: 4,
      initialAccepted: decoded.metadata.references.map((r) => ({
        id: r.id,
        source: r.source,
        candidateId: r.candidateId,
        referenceId: r.referenceId,
        candidateRevision: r.candidateRevision,
        sceneP1: r.sceneP1,
        sceneP2: r.sceneP2,
        confirmedDistance: r.confirmedDistance,
        confirmedUnit: r.confirmedUnit,
        originalLabelText: r.originalLabelText,
        valueCorrected: r.valueCorrected,
      })),
    });
    assert.equal(reloaded.accepted.length, 2, 'both saved references hydrate');
    assert.equal(reloaded.mode, 'edit');

    // Recalibrate: add one more accepted reference from a fresh search, then finish.
    const s2 = runSearch(reloaded, 'req-reload', [C2]);
    assert.equal(s2.candidates.length, 1, 'slots limit caps shown candidates at 3 - 2 accepted');
    const s3 = accept(s2);
    assert.equal(s3.accepted.length, 3);
    const s4 = calibrationSessionReducer(s3, { type: 'FINISH_ACCEPTED' });
    assert.equal(s4.phase, 'committing', 'hydrated + extended session finishes');
    const eff = selectDraftEffectiveCalibration(s4, 'meters');
    assert.ok(eff);
    assert.equal(eff.validCalibrationCount, 3, 'hydrated references still contribute to the mean');
  });
});
