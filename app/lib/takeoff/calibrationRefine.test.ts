// Phase E (audit 2026-09-20) P1-8/P1-9 unit tests: refinement continuity
// validation and signed candidate refine tokens. Pure, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveContinuityTolerances,
  signCandidateRefineToken,
  validateRefinementContinuity,
  verifyCandidateRefineToken,
  type CandidateRefinePayload,
} from './calibrationRefine';

const SECRET = 'phase-e-test-secret';

// Parent dimension: long horizontal span, scene frame.
const PARENT = {
  sceneP1: { x: 100, y: 100 },
  sceneP2: { x: 1600, y: 100 },
};

// ── Continuity (P1-8) ───────────────────────────────────────────────────

test('continuity: accepts a legitimate endpoint improvement', () => {
  const refined = {
    sceneP1: { x: 108, y: 96 },
    sceneP2: { x: 1594, y: 104 },
  };
  assert.deepEqual(validateRefinementContinuity(PARENT, refined), { ok: true, failures: [] });
});

test('continuity: accepts larger corrections within derived tolerances', () => {
  // Endpoint correction on the scale of the 256px crop, still the same span.
  const refined = {
    sceneP1: { x: 180, y: 40 },
    sceneP2: { x: 1530, y: 160 },
  };
  const tol = deriveContinuityTolerances(1500);
  assert.equal(validateRefinementContinuity(PARENT, refined, tol).ok, true);
});

test('continuity: rejects a jump to a different parallel dimension', () => {
  const jump = {
    sceneP1: { x: 100, y: 900 },
    sceneP2: { x: 1600, y: 900 },
  };
  const result = validateRefinementContinuity(PARENT, jump);
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('midpoint_moved'));
  assert.ok(result.failures.includes('endpoint_off_parent_line'));
});

test('continuity: rejects a jump to a perpendicular dimension (direction change)', () => {
  const jump = {
    sceneP1: { x: 800, y: 100 },
    sceneP2: { x: 800, y: 1300 },
  };
  const result = validateRefinementContinuity(PARENT, jump);
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('direction_changed'));
});

test('continuity: rejects a wholesale span-length change', () => {
  const shrink = {
    sceneP1: { x: 780, y: 100 },
    sceneP2: { x: 820, y: 100 },
  };
  const result = validateRefinementContinuity(PARENT, shrink);
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('span_ratio_out_of_range'));
});

test('continuity: endpoints reversed are still continuous (undirected checks)', () => {
  const refined = {
    sceneP1: { x: 1594, y: 104 },
    sceneP2: { x: 108, y: 96 },
  };
  assert.equal(validateRefinementContinuity(PARENT, refined).ok, true);
});

test('tolerances: derived generously from span and crop size', () => {
  const tol = deriveContinuityTolerances(1500, 256);
  assert.ok(tol.maxMidpointShiftPx >= 128);
  assert.ok(tol.maxEndpointLineDistancePx >= 128);
  assert.equal(tol.spanRatioMin, 0.5);
  assert.equal(tol.spanRatioMax, 2.0);
  // Small spans still get a floor of crop-scale tolerance.
  const small = deriveContinuityTolerances(60, 256);
  assert.equal(small.maxMidpointShiftPx, 128);
});

// ── Signed candidate refine tokens (P1-9) ───────────────────────────────

const PAYLOAD: CandidateRefinePayload = {
  runId: '6f1c1e2e-0000-4000-8000-000000000001',
  idx: 1,
  pageId: 'page-1',
  imageRevision: 'sha256-abc123-on1',
  sourceP1: { x: 200, y: 300 },
  sourceP2: { x: 3800, y: 300 },
  labelCentre: { x: 2000, y: 240 },
  revision: 1,
};

test('candidate token: sign/verify round-trip preserves geometry and binding', () => {
  const token = signCandidateRefineToken(PAYLOAD, SECRET);
  const verdict = verifyCandidateRefineToken(token, 'page-1', 'sha256-abc123-on1', SECRET);
  assert.equal(verdict.valid, true);
  if (verdict.valid) {
    assert.equal(verdict.payload.runId, PAYLOAD.runId);
    assert.equal(verdict.payload.idx, 1);
    assert.equal(verdict.payload.revision, 1);
    assert.deepEqual(verdict.payload.sourceP1, PAYLOAD.sourceP1);
    assert.deepEqual(verdict.payload.sourceP2, PAYLOAD.sourceP2);
    assert.deepEqual(verdict.payload.labelCentre, PAYLOAD.labelCentre);
  }
});

test('candidate token: null label centre round-trips as null', () => {
  const token = signCandidateRefineToken({ ...PAYLOAD, labelCentre: null }, SECRET);
  const verdict = verifyCandidateRefineToken(token, 'page-1', 'sha256-abc123-on1', SECRET);
  assert.equal(verdict.valid, true);
  if (verdict.valid) assert.equal(verdict.payload.labelCentre, null);
});

test('candidate token: rejects tampering, wrong secret, wrong page/revision', () => {
  const token = signCandidateRefineToken(PAYLOAD, SECRET);
  assert.equal(verifyCandidateRefineToken(token, 'page-1', 'sha256-abc123-on1', 'other-secret').valid, false);
  assert.equal(verifyCandidateRefineToken(token, 'page-2', 'sha256-abc123-on1', SECRET).valid, false);
  assert.equal(verifyCandidateRefineToken(token, 'page-1', 'sha256-other-on1', SECRET).valid, false);
  const parts = token.split('.');
  const tampered = `${parts[0]}X.${parts[1]}`;
  assert.equal(verifyCandidateRefineToken(tampered, 'page-1', 'sha256-abc123-on1', SECRET).valid, false);
  assert.equal(verifyCandidateRefineToken('not-a-token', 'page-1', 'sha256-abc123-on1', SECRET).valid, false);
});

test('candidate token: sub-1000ths coordinate rounding keeps geometry faithful', () => {
  const token = signCandidateRefineToken({ ...PAYLOAD, sourceP1: { x: 200.004, y: 299.996 } }, SECRET);
  const verdict = verifyCandidateRefineToken(token, 'page-1', 'sha256-abc123-on1', SECRET);
  assert.equal(verdict.valid, true);
  if (verdict.valid) {
    assert.equal(verdict.payload.sourceP1.x, 200);
    assert.equal(verdict.payload.sourceP1.y, 300);
  }
});
