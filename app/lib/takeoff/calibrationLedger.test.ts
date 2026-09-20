// Pure unit tests for the calibration run ledger helpers (patch_049, Phase D
// audit 2026-09-20): payload identity hashing, admit-row decision mapping,
// refusal HTTP mapping, refund arithmetic, request-id validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrationRefusalHttp,
  computeCalibrationPayloadHash,
  isValidClientRequestId,
  parseCalibrationAdmitRow,
  pointsRemainingAfterRefund,
} from './calibrationLedger';

const BASE = {
  quoteId: 'q-1',
  pageId: 'p-1',
  action: 'search' as const,
  round: 0 as const,
  strategy: 'initial' as const,
  imageRevision: 'sha256-abc-on1',
};

test('computeCalibrationPayloadHash: stable across key order and array order', () => {
  const a = computeCalibrationPayloadHash(BASE);
  const b = computeCalibrationPayloadHash({ ...BASE, refineReferenceIds: ['r2', 'r1'] });
  const c = computeCalibrationPayloadHash({ ...BASE, refineReferenceIds: ['r1', 'r2'] });
  assert.equal(b, c);
  assert.equal(a, computeCalibrationPayloadHash({ imageRevision: BASE.imageRevision, pageId: 'p-1', action: 'search', round: 0, strategy: 'initial', quoteId: 'q-1' }));
});

test('computeCalibrationPayloadHash: differs when identity differs', () => {
  const a = computeCalibrationPayloadHash(BASE);
  assert.notEqual(a, computeCalibrationPayloadHash({ ...BASE, round: 1, strategy: 'different_references' }));
  assert.notEqual(a, computeCalibrationPayloadHash({ ...BASE, action: 'refine', round: 1, strategy: 'refine_reference' }));
  assert.notEqual(a, computeCalibrationPayloadHash({ ...BASE, imageRevision: 'sha256-xyz-on1' }));
  assert.notEqual(a, computeCalibrationPayloadHash({ ...BASE, excludeReferenceIds: ['ref-1'] }));
});

test('parseCalibrationAdmitRow: accepted', () => {
  const d = parseCalibrationAdmitRow({ ok: true, status: 'accepted', run_id: 'u1', error_code: null, response_payload: null, points_remaining: 41 });
  assert.deepEqual(d, { kind: 'accepted', runId: 'u1', pointsRemaining: 41 });
});

test('parseCalibrationAdmitRow: replay returns stored payload', () => {
  const payload = { success: true, candidates: [] };
  const d = parseCalibrationAdmitRow({ ok: true, status: 'replay', run_id: 'u1', error_code: null, response_payload: payload, points_remaining: null });
  assert.equal(d.kind, 'replay');
  if (d.kind === 'replay') assert.equal(d.responsePayload, payload);
});

test('parseCalibrationAdmitRow: in_flight and duplicate_failed', () => {
  assert.deepEqual(
    parseCalibrationAdmitRow({ ok: true, status: 'in_flight', run_id: 'u1', error_code: null, response_payload: null, points_remaining: null }),
    { kind: 'in_flight', runId: 'u1' },
  );
  assert.deepEqual(
    parseCalibrationAdmitRow({ ok: true, status: 'duplicate_failed', run_id: 'u2', error_code: 'PROVIDER_ERROR', response_payload: null, points_remaining: null }),
    { kind: 'duplicate_failed', runId: 'u2', errorCode: 'PROVIDER_ERROR' },
  );
});

test('parseCalibrationAdmitRow: refusals and malformed rows fail closed', () => {
  assert.deepEqual(
    parseCalibrationAdmitRow({ ok: false, status: 'refused', run_id: null, error_code: 'request_id_conflict', response_payload: null, points_remaining: null }),
    { kind: 'refused', errorCode: 'request_id_conflict' },
  );
  assert.deepEqual(parseCalibrationAdmitRow(null), { kind: 'refused', errorCode: 'admit_failed' });
  assert.deepEqual(parseCalibrationAdmitRow({ ok: true, status: 'weird' }), { kind: 'refused', errorCode: 'admit_failed' });
  // accepted without run id must never proceed
  assert.equal(parseCalibrationAdmitRow({ ok: true, status: 'accepted', run_id: null }).kind, 'refused');
  // replay without payload must never 200 an empty body
  assert.equal(parseCalibrationAdmitRow({ ok: true, status: 'replay', run_id: 'u1', response_payload: null }).kind, 'refused');
});

test('calibrationRefusalHttp: maps every documented error code', () => {
  const cases: Array<[string, number, string]> = [
    ['unauthenticated', 401, 'UNAUTHORISED'],
    ['bad_request', 400, 'BAD_REQUEST'],
    ['no_company', 403, 'UNAUTHORISED'],
    ['quote_not_found', 404, 'NOT_FOUND'],
    ['page_not_found', 404, 'PAGE_NOT_FOUND'],
    ['flag_off', 403, 'FORBIDDEN'],
    ['request_id_conflict', 409, 'REQUEST_CONFLICT'],
    ['invalid_round', 409, 'REQUEST_CONFLICT'],
    ['round_budget_consumed', 409, 'REQUEST_CONFLICT'],
    ['insufficient_points', 402, 'INSUFFICIENT_POINTS'],
    ['anything_else', 500, 'INTERNAL_ERROR'],
  ];
  for (const [code, status, http] of cases) {
    assert.deepEqual(calibrationRefusalHttp(code), { status, code: http }, `code=${code}`);
  }
});

test('pointsRemainingAfterRefund: floors at zero like the SQL GREATEST', () => {
  assert.equal(pointsRemainingAfterRefund(41, 1), 42);
  assert.equal(pointsRemainingAfterRefund(0, 1), 1);
  // Degenerate: charged more than tracked - still never negative.
  assert.equal(pointsRemainingAfterRefund(0, 5), 5);
  assert.equal(pointsRemainingAfterRefund(3, -2), 3);
});

test('isValidClientRequestId: mirrors the SQL 8..128 bound', () => {
  assert.equal(isValidClientRequestId('a'.repeat(8)), true);
  assert.equal(isValidClientRequestId('  '.repeat(8)), false); // trims to nothing
  assert.equal(isValidClientRequestId('a'.repeat(129)), false);
  assert.equal(isValidClientRequestId(undefined), false);
  assert.equal(isValidClientRequestId(42), false);
});
