// Deterministic parsing, unit normalisation, dedup, eligibility and ranking tests
// (spec 6.5, 6.6, 7.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIT_TO_METERS,
  checkEligibility,
  convertDistance,
  convertToWorkingUnit,
  deduplicateByGeometry,
  hasValidGeometry,
  pairDistance,
  parseDistanceSuggestion,
  rankCandidates,
  type RankableCandidate,
} from './calibrationCandidates';

const close = (a: number, b: number, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('parse: 6420 with verified mm note', () => {
  assert.deepEqual(parseDistanceSuggestion('6420', 'mm'), { distance: 6420, unit: 'mm' });
  assert.deepEqual(parseDistanceSuggestion('6420', 'MM'), { distance: 6420, unit: 'mm' });
});

test('parse: 6.42 m and 12 ft', () => {
  assert.deepEqual(parseDistanceSuggestion('6.42 m', null), { distance: 6.42, unit: 'm' });
  assert.deepEqual(parseDistanceSuggestion('12', 'ft'), { distance: 12, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion('12 ft', null), { distance: 12, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion('30 feet', null), { distance: 30, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion('8.5 yd', null), { distance: 8.5, unit: 'yd' });
  assert.deepEqual(parseDistanceSuggestion('18', 'inches'), { distance: 18, unit: 'in' });
});

test('parse: feet-and-inches 10\'-6" and fractional 10\'-6 1/2"', () => {
  assert.deepEqual(parseDistanceSuggestion(String.raw`10'-6"`, null), { distance: 10.5, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion(String.raw`10'-6 1/2"`, null), { distance: 10.5 + 0.5 / 12, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion('10 ft 6 in', null), { distance: 10.5, unit: 'ft' });
  assert.deepEqual(parseDistanceSuggestion(String.raw`9'6"`, null), { distance: 9.5, unit: 'ft' });
});

test('parse: null for ambiguous/garbage; never a parseFloat prefix', () => {
  assert.equal(parseDistanceSuggestion('642', null), null); // no unit context
  assert.equal(parseDistanceSuggestion('642', 'unknown'), null);
  assert.equal(parseDistanceSuggestion('6420 mm total run', null), null); // trailing junk
  assert.equal(parseDistanceSuggestion('6,420', 'mm'), null); // ambiguous separator
  assert.equal(parseDistanceSuggestion(String.raw`10'-6`, null), null); // no inch terminator -> ambiguous
  assert.equal(parseDistanceSuggestion('1:100', null), null);
  assert.equal(parseDistanceSuggestion('', 'mm'), null);
  assert.equal(parseDistanceSuggestion(null, null), null);
  assert.equal(parseDistanceSuggestion('6.42 m', 'ft'), null); // conflicting units
  assert.equal(parseDistanceSuggestion('-5', 'm'), null);
  assert.equal(parseDistanceSuggestion('10 1/2', null), null); // fraction without unit
  assert.deepEqual(parseDistanceSuggestion('1/2', 'in'), { distance: 0.5, unit: 'in' });
});

test('unit normalisation factors and conversions', () => {
  assert.equal(UNIT_TO_METERS.m, 1);
  assert.equal(UNIT_TO_METERS.cm, 0.01);
  assert.equal(UNIT_TO_METERS.mm, 0.001);
  assert.equal(UNIT_TO_METERS.ft, 0.3048);
  assert.equal(UNIT_TO_METERS.in, 0.0254);
  assert.equal(UNIT_TO_METERS.yd, 0.9144);
  close(convertDistance(10, 'ft', 'm'), 3.048);
  close(convertDistance(6420, 'mm', 'm'), 6.42);
  close(convertToWorkingUnit(6.096, 'm', 'feet'), 20);
  close(convertToWorkingUnit(10, 'ft', 'meters'), 3.048);
});

test('pairDistance is symmetric under endpoint order (spec 7.3)', () => {
  const a = { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } };
  const b = { p1: { x: 2, y: 0 }, p2: { x: 102, y: 0 } };
  const bReversed = { p1: b.p2, p2: b.p1 };
  close(pairDistance(a, b), 2);
  close(pairDistance(a, bReversed), 2);
  close(pairDistance(b, a), pairDistance(a, b));
});

test('dedup ignores endpoint order and jitter, keeps first representative', () => {
  const items = [
    { sceneP1: { x: 100, y: 100 }, sceneP2: { x: 400, y: 100 } },
    { sceneP1: { x: 400.5, y: 101 }, sceneP2: { x: 101, y: 99 } }, // reversed + jitter
    { sceneP1: { x: 900, y: 900 }, sceneP2: { x: 1100, y: 900 } }, // distinct reference
  ];
  const { kept, duplicateIndices } = deduplicateByGeometry(items);
  assert.equal(kept.length, 2);
  assert.deepEqual(duplicateIndices, [1]);
  // far-apart pair is not merged at default tolerances
  const distinct = deduplicateByGeometry([
    items[0],
    { sceneP1: { x: 500, y: 100 }, sceneP2: { x: 800, y: 100 } },
  ]);
  assert.equal(distinct.kept.length, 2);
});

const base = {
  revision: 0,
  searchRound: 0,
  imageRevision: 'rev-1',
  valueState: 'readable',
  valueConfidence: null,
  warnings: [],
  explicitDistanceReference: true,
  straightSpan: true,
  bothEndpointsVisible: true,
  endpointAssociationClear: true,
  sameMeasurementView: true,
} as const;

function cand(
  id: string,
  x1: number, y1: number, x2: number, y2: number,
  extra: Partial<RankableCandidate> = {},
): RankableCandidate {
  const p1 = { x: x1, y: y1 };
  const p2 = { x: x2, y: y2 };
  return {
    id,
    referenceId: id,
    sourceType: 'dimension_line',
    sourceP1: p1,
    sourceP2: p2,
    sceneP1: p1,
    sceneP2: p2,
    scenePixelLength: Math.hypot(x2 - x1, y2 - y1),
    sourceLabelText: null,
    suggestedDistance: null,
    suggestedUnit: null,
    endpointConfidence: 0.8,
    evidence: { labelBox: null, unitEvidenceBox: null, endpointDescription: '', analysisImageIds: [] },
    ...base,
    ...extra,
  } as RankableCandidate;
}

test('eligibility excludes curved/multi-segment and non-explicit-distance references', () => {
  assert.equal(checkEligibility({
    sourceType: 'dimension_line',
    explicitDistanceReference: true,
    straightSpan: true,
    bothEndpointsVisible: true,
    endpointAssociationClear: true,
    sameMeasurementView: true,
  }).eligible, true);
  assert.equal(checkEligibility({
    sourceType: 'dimension_line',
    explicitDistanceReference: true,
    straightSpan: false, // curved/multi-segment path total
    bothEndpointsVisible: true,
    endpointAssociationClear: true,
    sameMeasurementView: true,
  }).eligible, false);
  assert.equal(checkEligibility({
    sourceType: 'roof_edge',
    explicitDistanceReference: false,
    straightSpan: true,
    bothEndpointsVisible: true,
    endpointAssociationClear: true,
    sameMeasurementView: true,
  } as never).eligible, false);
});

test('ranking: eligibility before ranking, descending pixel span, never printed number', () => {
  const ranked = rankCandidates([
    cand('big-9000mm', 0, 0, 900, 0, { suggestedDistance: 9, suggestedUnit: 'm' }),
    cand('small-30ft', 0, 100, 60, 100), // shorter span but bigger printed real-world number
    cand('curved', 0, 200, 800, 200, { straightSpan: false }),
    cand('no-dist', 0, 300, 700, 300, { explicitDistanceReference: false }),
    cand('nan-endpoint', 0, Number.NaN, 700, 400),
  ]);
  assert.deepEqual(ranked.map((c) => c.id), ['big-9000mm', 'small-30ft']);
  assert.ok(!ranked.some((c) => c.warnings.includes('short_pixel_span')));
});

test('no hard minimum span: short candidate survives with warning only', () => {
  const ranked = rankCandidates([cand('tiny', 0, 0, 20, 0)]);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].warnings.includes('short_pixel_span'));
  assert.equal(hasValidGeometry({ sceneP1: { x: 1, y: 1 }, sceneP2: { x: 1, y: 1 } }), false);
});

test('reversed endpoints do not change span or ranking order', () => {
  const a = rankCandidates([cand('A', 0, 0, 500, 0), cand('B', 0, 100, 300, 100)]);
  const b = rankCandidates([cand('B', 300, 100, 0, 100), cand('A', 500, 0, 0, 0)]);
  assert.deepEqual(a.map((c) => c.id), ['A', 'B']);
  assert.deepEqual(b.map((c) => c.id), ['A', 'B']);
  close(a[0].scenePixelLength, 500);
});

test('tie-break: equal span uses endpoint confidence, then readable value', () => {
  const ranked = rankCandidates([
    cand('low-conf', 0, 0, 400, 0, { endpointConfidence: 0.5 }),
    cand('hi-conf', 0, 100, 400, 100, { endpointConfidence: 0.9 }),
  ]);
  assert.deepEqual(ranked.map((c) => c.id), ['hi-conf', 'low-conf']);
});
