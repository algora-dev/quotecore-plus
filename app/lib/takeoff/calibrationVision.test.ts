// P5 vision-service pure-part tests (spec 13-P5 tasks 4-6, section 14
// calibration-candidates/api rows). No network: provider calls are not exercised
// here; runCalibrationSearch requires a live OpenAI key and is validated in a
// controlled smoke test during P7 (noted in the phase log). Route-level
// integration mocking is not supported by the repo's node --import tsx --test
// setup (no jest module registry), so the route's pure pipeline pieces are
// tested directly through these exports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReferenceId,
  normaliseDetection,
  selectRefinementHypotheses,
  signRoundToken,
  validateRawDetection,
  verifyRoundToken,
  type NormaliseDetectionInput,
} from './calibrationVision';
import type {
  AnalysisImageDescriptor,
  CalibrationImageDescriptor,
  RawCalibrationDetection,
  RawCalibrationHypothesis,
} from './calibrationTypes';
import { buildAnalysisToSource, buildSourceToScene } from './calibrationCoordinates';

// 4000x3000 source -> 2000x1500 overview; scene caps at 2000 longest edge so
// source-to-scene scale is 0.5 (scene = 2000x1500).
const SOURCE_W = 4000;
const SOURCE_H = 3000;
const OVERVIEW_W = 2000;
const OVERVIEW_H = 1500;
const IMAGE_REVISION = 'sha256-abc123-on1';
const PAGE_ID = 'page-1';

const overviewDescriptor: AnalysisImageDescriptor = {
  inputImageId: 'overview-0',
  imageRevision: IMAGE_REVISION,
  width: OVERVIEW_W,
  height: OVERVIEW_H,
  analysisToSource: buildAnalysisToSource(0, 0, SOURCE_W, SOURCE_H, OVERVIEW_W, OVERVIEW_H),
  purpose: 'overview',
};

const scene = buildSourceToScene(SOURCE_W, SOURCE_H);
const image: CalibrationImageDescriptor = {
  pageId: PAGE_ID,
  imageRevision: IMAGE_REVISION,
  frameKey: 'server-frame-1',
  sourceWidth: SOURCE_W,
  sourceHeight: SOURCE_H,
  sceneWidth: scene.sceneWidth,
  sceneHeight: scene.sceneHeight,
  sourceToScene: scene.transform,
  coordinateFrame: 'takeoff-scene-v1',
  geometryVersion: 1,
};

let tokenSeq = 0;
function makeHypothesis(overrides: Partial<RawCalibrationHypothesis> = {}): RawCalibrationHypothesis {
  tokenSeq += 1;
  return {
    referenceToken: `tok-${tokenSeq}`,
    parentReferenceToken: null,
    sourceType: 'dimension_line',
    p1: { inputImageId: 'overview-0', x: 100, y: 100 },
    p2: { inputImageId: 'overview-0', x: 1600, y: 100 },
    labelText: '6.42 m',
    distanceValueText: '6.42 m',
    unitText: null,
    unitSource: 'label',
    unitEvidenceText: null,
    labelBox: null,
    unitEvidenceBox: null,
    explicitDistanceReference: true,
    straightSpan: true,
    bothEndpointsVisible: true,
    endpointAssociationClear: true,
    sameMeasurementView: true,
    endpointConfidence: 0.9,
    valueConfidence: 0.8,
    endpointEvidence: 'witness-line intersections on a long plan dimension',
    ...overrides,
  };
}

function makeDetection(hypotheses: RawCalibrationHypothesis[], suitability: RawCalibrationDetection['suitability'] = 'suitable'): RawCalibrationDetection {
  return { suitability, suitabilityReason: suitability === 'suitable' ? 'single roof plan view' : 'perspective photo', hypotheses, notes: [] };
}

function normalise(detection: RawCalibrationDetection, extra: Partial<NormaliseDetectionInput> = {}) {
  return normaliseDetection({ detection, image, analysisImages: [overviewDescriptor], searchRound: 0, ...extra });
}

// ── validateRawDetection ────────────────────────────────────────────────

test('validate: accepts a valid payload with nullable fields', () => {
  const result = validateRawDetection(makeDetection([makeHypothesis({ labelText: null, distanceValueText: null, unitText: null, valueConfidence: null })]), [overviewDescriptor]);
  assert.equal(result.ok, true);
});

test('validate: rejects unknown inputImageId, non-finite coords, bad enum, over-limit hypotheses', () => {
  assert.equal(validateRawDetection(makeDetection([makeHypothesis({ p1: { inputImageId: 'nope', x: 1, y: 1 } })]), [overviewDescriptor]).ok, false);
  assert.equal(validateRawDetection(makeDetection([makeHypothesis({ p2: { inputImageId: 'overview-0', x: Number.NaN, y: 5 } })]), [overviewDescriptor]).ok, false);
  assert.equal(validateRawDetection(makeDetection([makeHypothesis({ sourceType: 'door_width' as RawCalibrationHypothesis['sourceType'] })]), [overviewDescriptor]).ok, false);
  assert.equal(validateRawDetection(makeDetection(Array.from({ length: 11 }, () => makeHypothesis())), [overviewDescriptor]).ok, false);
  assert.equal(validateRawDetection({ suitability: 'suitable' }, [overviewDescriptor]).ok, false);
});

// ── Eligibility rules (spec 6.1/6.6 step 3) ─────────────────────────────

test('eligibility: curved/multi-segment spans are excluded', () => {
  const result = normalise(makeDetection([makeHypothesis({ straightSpan: false })]));
  assert.equal(result.status, 'no_candidates');
  assert.equal(result.candidates.length, 0);
});

test('eligibility: no explicit distance reference is excluded', () => {
  const result = normalise(makeDetection([makeHypothesis({ explicitDistanceReference: false })]));
  assert.equal(result.status, 'no_candidates');
});

test('eligibility: different measurement view (mixed-scale inset) is excluded', () => {
  const result = normalise(makeDetection([makeHypothesis({ sameMeasurementView: false })]));
  assert.equal(result.status, 'no_candidates');
});

test('eligibility: unreadable text is still eligible (R05)', () => {
  const result = normalise(makeDetection([makeHypothesis({ labelText: null, distanceValueText: null, unitText: null, valueConfidence: null })]));
  assert.equal(result.status, 'candidates');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].valueState, 'needs_both');
  assert.equal(result.candidates[0].suggestedDistance, null);
  assert.ok(result.candidates[0].warnings.includes('value_needs_user_entry'));
});

// ── Normalisation math (spec 5.2 coordinate contract) ───────────────────

test('normalisation: overview coords map analysis -> source -> scene exactly', () => {
  const result = normalise(makeDetection([makeHypothesis({ p1: { inputImageId: 'overview-0', x: 1000, y: 750 }, p2: { inputImageId: 'overview-0', x: 1600, y: 750 } })]));
  const c = result.candidates[0];
  assert.equal(c.sourceP1.x, 2000);
  assert.equal(c.sourceP1.y, 1500);
  assert.equal(c.sceneP1.x, 1000);
  assert.equal(c.sceneP1.y, 750);
  // 600 analysis px -> 1200 source px -> 600 scene px (scale 0.5)
  assert.ok(Math.abs(c.scenePixelLength - 600) < 1e-9);
});

test('normalisation: crop descriptor coords map with crop offset (no half-pixel guesses)', () => {
  const crop: AnalysisImageDescriptor = {
    inputImageId: 'h0-endpoint-a',
    imageRevision: IMAGE_REVISION,
    width: 256,
    height: 256,
    analysisToSource: buildAnalysisToSource(100, 200, 256, 256, 256, 256),
    purpose: 'endpoint-a',
  };
  const result = normaliseDetection({
    detection: makeDetection([makeHypothesis({ p1: { inputImageId: 'h0-endpoint-a', x: 128, y: 128 }, p2: { inputImageId: 'overview-0', x: 1600, y: 100 } })]),
    image,
    analysisImages: [overviewDescriptor, crop],
    searchRound: 0,
  });
  const c = result.candidates[0];
  assert.equal(c.sourceP1.x, 228);
  assert.equal(c.sourceP1.y, 328);
});

test('normalisation: out-of-raster model points are rejected, never clamped', () => {
  const result = normalise(makeDetection([makeHypothesis({ p1: { inputImageId: 'overview-0', x: 2500, y: 100 } })]));
  assert.equal(result.status, 'no_candidates');
  assert.ok(result.notes.some((n) => n.includes('point_outside_raster')));
});

test('normalisation: zero endpoint separation is rejected', () => {
  const result = normalise(makeDetection([makeHypothesis({ p1: { inputImageId: 'overview-0', x: 500, y: 500 }, p2: { inputImageId: 'overview-0', x: 500, y: 500 } })]));
  assert.equal(result.status, 'no_candidates');
});

// ── Value states ────────────────────────────────────────────────────────

test('valueState: readable parse wins; unit-known/value-missing -> needs_distance; value-only -> needs_unit', () => {
  const readable = normalise(makeDetection([makeHypothesis()])).candidates[0];
  assert.equal(readable.valueState, 'readable');
  assert.deepEqual([readable.suggestedDistance, readable.suggestedUnit], [6.42, 'm']);

  const noValue = normalise(makeDetection([makeHypothesis({ distanceValueText: null, unitText: 'mm' })])).candidates[0];
  assert.equal(noValue.valueState, 'needs_distance');

  const noUnit = normalise(makeDetection([makeHypothesis({ distanceValueText: '6420', unitText: null })])).candidates[0];
  assert.equal(noUnit.valueState, 'needs_unit');
  assert.equal(noUnit.suggestedDistance, null);
});

// ── Ranking: span, not printed number (R04 / spec 6.6 step 6) ───────────

test('ranking: descending scene pixel span beats a bigger printed number', () => {
  const result = normalise(makeDetection([
    makeHypothesis({ referenceToken: 'short', p1: { inputImageId: 'overview-0', x: 100, y: 100 }, p2: { inputImageId: 'overview-0', x: 400, y: 100 }, distanceValueText: '9000', unitText: 'mm' }),
    makeHypothesis({ referenceToken: 'long', labelText: '3 m', p1: { inputImageId: 'overview-0', x: 100, y: 300 }, p2: { inputImageId: 'overview-0', x: 1600, y: 300 }, distanceValueText: '3 m', unitText: null }),
  ]));
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].sourceLabelText, '3 m');
  assert.ok(result.candidates[0].scenePixelLength > result.candidates[1].scenePixelLength);
});

test('ranking: no minimum-span hard cutoff - short bar eligible with warning only', () => {
  const result = normalise(makeDetection([makeHypothesis({ p1: { inputImageId: 'overview-0', x: 500, y: 500 }, p2: { inputImageId: 'overview-0', x: 512, y: 500 } })]));
  assert.equal(result.status, 'candidates');
  assert.equal(result.candidates.length, 1);
  assert.ok(result.candidates[0].warnings.includes('short_pixel_span'));
});

// ── Deduplication (spec 7.3) ────────────────────────────────────────────

test('dedup: reversed endpoints are recognised as the same physical reference', () => {
  const result = normalise(makeDetection([
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 100, y: 100 }, p2: { inputImageId: 'overview-0', x: 1600, y: 100 } }),
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 1600, y: 100 }, p2: { inputImageId: 'overview-0', x: 100, y: 100 } }),
  ]));
  assert.equal(result.candidates.length, 1);
});

test('dedup: small coordinate jitter merges; distinct parallel dimensions survive', () => {
  const result = normalise(makeDetection([
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 100, y: 100 }, p2: { inputImageId: 'overview-0', x: 1600, y: 100 } }),
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 103, y: 102 }, p2: { inputImageId: 'overview-0', x: 1598, y: 99 } }),
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 100, y: 400 }, p2: { inputImageId: 'overview-0', x: 1600, y: 400 } }),
  ]));
  assert.equal(result.candidates.length, 2);
  // Same printed text on both survivors - identical labels are not identity.
  assert.equal(result.candidates[0].referenceId !== result.candidates[1].referenceId, true);
});

// ── Honesty about counts (R03 / spec 6.3) ───────────────────────────────

test('honesty: only one usable hypothesis of five returns exactly one candidate', () => {
  const result = normalise(makeDetection([
    makeHypothesis({ straightSpan: false }),
    makeHypothesis({ explicitDistanceReference: false }),
    makeHypothesis({ sameMeasurementView: false }),
    makeHypothesis({ p1: { inputImageId: 'ghost', x: 1, y: 1 } }),
    makeHypothesis({ p1: { inputImageId: 'overview-0', x: 100, y: 800 }, p2: { inputImageId: 'overview-0', x: 1500, y: 800 } }),
  ]));
  assert.equal(result.status, 'candidates');
  assert.equal(result.candidates.length, 1);
});

test('honesty: empty hypotheses -> no_candidates, distinct from unsuitable', () => {
  assert.equal(normalise(makeDetection([])).status, 'no_candidates');
  assert.equal(normalise(makeDetection([makeHypothesis()], 'uncertain')).status, 'unsuitable_image');
  assert.equal(normalise(makeDetection([makeHypothesis()], 'unsuitable')).status, 'unsuitable_image');
});

// ── Physical reference identity (spec 7.3) ──────────────────────────────

test('referenceId: order-independent and jitter-stable, distinct for different geometry', () => {
  const a = computeReferenceId({ x: 100, y: 100 }, { x: 900, y: 100 });
  const reversed = computeReferenceId({ x: 900, y: 100 }, { x: 100, y: 100 });
  const jitter = computeReferenceId({ x: 103, y: 101 }, { x: 898, y: 99 });
  const other = computeReferenceId({ x: 100, y: 500 }, { x: 900, y: 500 });
  assert.equal(a, reversed);
  assert.equal(a, jitter);
  assert.notEqual(a, other);
});

// ── Refinement selection & revision bumping ─────────────────────────────

test('selection: top three by span chosen for refinement; excluded physical references skipped', () => {
  const detection = makeDetection([
    makeHypothesis({ referenceToken: 't-small', p1: { inputImageId: 'overview-0', x: 100, y: 100 }, p2: { inputImageId: 'overview-0', x: 300, y: 100 } }),
    makeHypothesis({ referenceToken: 't-mid', p1: { inputImageId: 'overview-0', x: 100, y: 300 }, p2: { inputImageId: 'overview-0', x: 900, y: 300 } }),
    makeHypothesis({ referenceToken: 't-long', p1: { inputImageId: 'overview-0', x: 100, y: 600 }, p2: { inputImageId: 'overview-0', x: 1800, y: 600 } }),
    makeHypothesis({ referenceToken: 't-mid2', p1: { inputImageId: 'overview-0', x: 100, y: 900 }, p2: { inputImageId: 'overview-0', x: 700, y: 900 } }),
  ]);
  const top3 = selectRefinementHypotheses(detection, image, [overviewDescriptor], { max: 3 });
  assert.deepEqual(top3.selected.map((s) => s.hypothesis.referenceToken).sort(), ['t-long', 't-mid', 't-mid2']);

  const excluded = selectRefinementHypotheses(detection, image, [overviewDescriptor], {
    max: 3,
    excludeReferenceIds: [top3.selected.find((s) => s.hypothesis.referenceToken === 't-long')!.referenceId],
  });
  assert.ok(!excluded.selected.some((s) => s.hypothesis.referenceToken === 't-long'));
});

test('refinement: hypotheses refining an unsupplied parent are dropped', () => {
  const result = normaliseDetection({
    detection: makeDetection([
      makeHypothesis({ parentReferenceToken: 'parent-1' }),
      makeHypothesis({ parentReferenceToken: 'parent-other' }),
    ]),
    image,
    analysisImages: [overviewDescriptor],
    searchRound: 1,
    allowedParentTokens: new Set(['parent-1']),
    baseRevisionByToken: { 'parent-1': 1 },
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].revision, 2); // parent revision 1 -> refined 2
  assert.equal(result.candidates[0].searchRound, 1);
});

test('discovery candidates start at revision 1', () => {
  const result = normalise(makeDetection([makeHypothesis()]));
  assert.equal(result.candidates[0].revision, 1);
});

// ── Round tokens (stateless rescan budget) ──────────────────────────────

const SECRET = 'test-secret';

test('round token: sign/verify round-trip binds page and image revision', () => {
  const token = signRoundToken(PAGE_ID, IMAGE_REVISION, SECRET);
  assert.deepEqual(verifyRoundToken(token, PAGE_ID, IMAGE_REVISION, SECRET), { valid: true });
});

test('round token: rejects tampering, wrong page, wrong revision, expiry', () => {
  const token = signRoundToken(PAGE_ID, IMAGE_REVISION, SECRET);
  assert.equal(verifyRoundToken(`${token.slice(0, -3)}abc`, PAGE_ID, IMAGE_REVISION, SECRET).valid, false);
  assert.equal(verifyRoundToken(token, 'page-2', IMAGE_REVISION, SECRET).valid, false);
  assert.equal(verifyRoundToken(token, PAGE_ID, 'sha256-other-on1', SECRET).valid, false);
  assert.equal(verifyRoundToken(token, PAGE_ID, IMAGE_REVISION, 'wrong-secret').valid, false);

  const stale = signRoundToken(PAGE_ID, IMAGE_REVISION, SECRET, Date.now() - 25 * 60 * 60 * 1000);
  assert.equal(verifyRoundToken(stale, PAGE_ID, IMAGE_REVISION, SECRET).valid, false);
});

// ── Candidate contract ──────────────────────────────────────────────────

test('candidates: exactly the CalibrationCandidate serialisable shape', () => {
  const result = normalise(makeDetection([makeHypothesis()]));
  const c = result.candidates[0] as Record<string, unknown>;
  for (const flag of ['explicitDistanceReference', 'straightSpan', 'bothEndpointsVisible', 'endpointAssociationClear', 'sameMeasurementView']) {
    assert.equal(flag in c, false, `screening flag ${flag} must not leak into the client contract`);
  }
  assert.equal(typeof c.id, 'string');
  assert.equal(c.imageRevision, IMAGE_REVISION);
  assert.equal(c.searchRound, 0);
});
