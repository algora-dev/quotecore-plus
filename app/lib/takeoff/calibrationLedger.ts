// Pure helpers for the calibration run ledger (patch_049, Phase D audit
// 2026-09-20). Server-only concerns live in the route; everything here is
// pure so the colocated unit tests cover admission decisions, refusal
// mapping and payload hashing without a database.
import { createHash } from 'node:crypto';

/** Canonical payload fields that define request identity for dedup. */
export interface CalibrationPayloadIdentity {
  quoteId: string;
  pageId: string;
  action: 'search' | 'refine';
  round: 0 | 1;
  strategy: 'initial' | 'different_references' | 'refine_reference';
  imageRevision: string;
  refineReferenceIds?: readonly string[];
  excludeReferenceIds?: readonly string[];
}

/** Deterministic hash of the request identity (sorted keys, stable arrays). */
export function computeCalibrationPayloadHash(identity: CalibrationPayloadIdentity): string {
  const canonical = {
    quoteId: identity.quoteId,
    pageId: identity.pageId,
    action: identity.action,
    round: identity.round,
    strategy: identity.strategy,
    imageRevision: identity.imageRevision,
    refineReferenceIds: [...(identity.refineReferenceIds ?? [])].sort(),
    excludeReferenceIds: [...(identity.excludeReferenceIds ?? [])].sort(),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** Shape of one cal_admit_run result row (PostgREST returns an array). */
export interface CalibrationAdmitRow {
  ok: boolean | null;
  status: string | null;
  run_id: string | null;
  error_code: string | null;
  response_payload: Record<string, unknown> | null;
  points_remaining: number | null;
}

export type CalibrationAdmitDecision =
  | { kind: 'accepted'; runId: string; pointsRemaining: number }
  | { kind: 'replay'; runId: string; responsePayload: Record<string, unknown> }
  | { kind: 'in_flight'; runId: string }
  | { kind: 'duplicate_failed'; runId: string; errorCode: string | null }
  | { kind: 'refused'; errorCode: string };

/**
 * Map one raw admit row to a typed decision. Any malformed row is a refusal
 * (fail closed) - the route never proceeds on an ambiguous admission.
 */
export function parseCalibrationAdmitRow(row: unknown): CalibrationAdmitDecision {
  const r = (row ?? {}) as Partial<CalibrationAdmitRow>;
  if (r.ok !== true) {
    return { kind: 'refused', errorCode: r.error_code ?? 'admit_failed' };
  }
  switch (r.status) {
    case 'accepted':
      return r.run_id
        ? { kind: 'accepted', runId: r.run_id, pointsRemaining: r.points_remaining ?? 0 }
        : { kind: 'refused', errorCode: 'admit_failed' };
    case 'replay':
      return r.response_payload != null
        ? { kind: 'replay', runId: r.run_id ?? '', responsePayload: r.response_payload }
        : { kind: 'refused', errorCode: 'replay_missing_payload' };
    case 'in_flight':
      return { kind: 'in_flight', runId: r.run_id ?? '' };
    case 'duplicate_failed':
      return { kind: 'duplicate_failed', runId: r.run_id ?? '', errorCode: r.error_code ?? null };
    default:
      return { kind: 'refused', errorCode: r.error_code ?? 'admit_failed' };
  }
}

export interface RefusalHttp { status: number; code: string }

/**
 * HTTP mapping for cal_admit_run refusal codes. Mirrors the route's
 * pre-patch_049 statuses so clients see no contract change.
 */
export function calibrationRefusalHttp(errorCode: string): RefusalHttp {
  switch (errorCode) {
    case 'unauthenticated': return { status: 401, code: 'UNAUTHORISED' };
    case 'bad_request': return { status: 400, code: 'BAD_REQUEST' };
    case 'no_company': return { status: 403, code: 'UNAUTHORISED' };
    case 'quote_not_found': return { status: 404, code: 'NOT_FOUND' };
    case 'page_not_found': return { status: 404, code: 'PAGE_NOT_FOUND' };
    case 'flag_off': return { status: 403, code: 'FORBIDDEN' };
    case 'request_id_conflict': return { status: 409, code: 'REQUEST_CONFLICT' };
    case 'invalid_round':
    case 'round_budget_consumed': return { status: 409, code: 'REQUEST_CONFLICT' };
    case 'insufficient_points': return { status: 402, code: 'INSUFFICIENT_POINTS' };
    default: return { status: 500, code: 'INTERNAL_ERROR' };
  }
}

/**
 * Remaining-points arithmetic after a refund. The ledger refund is atomic in
 * SQL (GREATEST(x - n, 0)); this is only for the response envelope, so it
 * must floor at zero exactly like the SQL.
 */
export function pointsRemainingAfterRefund(
  remainingAfterCharge: number,
  pointsCharged: number,
): number {
  return Math.max(0, remainingAfterCharge + Math.max(0, pointsCharged));
}

/** Validate the client-supplied request id (mirrors the SQL 8..128 bound). */
export function isValidClientRequestId(requestId: unknown): requestId is string {
  return typeof requestId === 'string'
    && requestId.trim().length >= 8
    && requestId.length <= 128;
}
