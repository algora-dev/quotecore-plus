// Server-side targeted-refinement helpers (calibration hardening Phase E,
// audit 2026-09-20, P1-7/P1-8/P1-9).
//
// P1-9: a targeted "improve these points" refine must NOT re-run discovery.
// Round-0 candidates carry a server-signed refine token binding the ORIGINAL
// server-validated source geometry to the calibration_runs ledger run id
// (HMAC with CALIBRATION_TOKEN_SECRET). The refine request echoes that token;
// the server verifies the signature + page/revision binding + ledger run
// existence, rebuilds endpoint/label crops from the ORIGINAL geometry and
// makes exactly ONE refinement call.
//
// P1-8: refined geometry is validated against its parent with deterministic
// continuity checks and GENEROUS tolerances derived from crop size and the
// parent's scene span. A refinement that jumps to a different dimension is
// dropped; a legitimate endpoint improvement is never rejected.
//
// Pure functions are exported for colocated unit tests; node:crypto is the
// only import beyond shared types.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Point } from './calibrationTypes';

// ── Continuity validation (P1-8) ─────────────────────────────────────────

export interface ContinuityTolerances {
  /** Max distance between parent and refined midpoints (scene px). */
  maxMidpointShiftPx: number;
  /** Refined span length must stay within [min, max] ratio of the parent span. */
  spanRatioMin: number;
  spanRatioMax: number;
  /** Max undirected line direction difference (degrees). */
  maxAngleDeg: number;
  /** Max distance from each refined endpoint to the parent's infinite line. */
  maxEndpointLineDistancePx: number;
}

/**
 * Generous tolerances derived from the parent's scene span and the endpoint
 * crop size: a legitimate refinement moves endpoints by at most a crop-scale
 * correction, while a jump to a DIFFERENT dimension moves the midpoint by a
 * large fraction of the scene or changes span/direction wholesale.
 */
export function deriveContinuityTolerances(
  parentSpanScenePx: number,
  endpointCropPx: number = 256,
): ContinuityTolerances {
  const span = Math.max(1, parentSpanScenePx);
  return {
    maxMidpointShiftPx: Math.max(span * 0.35, endpointCropPx * 0.5, 50),
    spanRatioMin: 0.5,
    spanRatioMax: 2.0,
    maxAngleDeg: 25,
    maxEndpointLineDistancePx: Math.max(span * 0.25, endpointCropPx * 0.5, 40),
  };
}

function segmentAngleDeg(p1: Point, p2: Point): number {
  // Undirected line direction folded into [0, 180).
  const raw = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  return ((raw % 180) + 180) % 180;
}

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

function distanceToLine(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  return Math.abs(dy * (point.x - a.x) - dx * (point.y - a.y)) / Math.sqrt(lenSq);
}

export interface ContinuitySegment {
  sceneP1: Point;
  sceneP2: Point;
}

export interface ContinuityResult {
  ok: boolean;
  /** Machine-readable failure names (empty when ok). */
  failures: string[];
}

/**
 * Deterministic parent-vs-refined continuity checks (P1-8): midpoint
 * proximity, span-length ratio, undirected direction difference, and
 * endpoint-to-parent-line distance. Pure.
 */
export function validateRefinementContinuity(
  parent: ContinuitySegment,
  refined: ContinuitySegment,
  tolerances: ContinuityTolerances = deriveContinuityTolerances(
    Math.hypot(parent.sceneP2.x - parent.sceneP1.x, parent.sceneP2.y - parent.sceneP1.y),
  ),
): ContinuityResult {
  const failures: string[] = [];
  const parentMid = {
    x: (parent.sceneP1.x + parent.sceneP2.x) / 2,
    y: (parent.sceneP1.y + parent.sceneP2.y) / 2,
  };
  const refinedMid = {
    x: (refined.sceneP1.x + refined.sceneP2.x) / 2,
    y: (refined.sceneP1.y + refined.sceneP2.y) / 2,
  };
  const parentSpan = Math.hypot(parent.sceneP2.x - parent.sceneP1.x, parent.sceneP2.y - parent.sceneP1.y);
  const refinedSpan = Math.hypot(refined.sceneP2.x - refined.sceneP1.x, refined.sceneP2.y - refined.sceneP1.y);

  if (!Number.isFinite(parentSpan) || !Number.isFinite(refinedSpan) || parentSpan <= 0 || refinedSpan <= 0) {
    return { ok: false, failures: ['invalid_geometry'] };
  }
  if (Math.hypot(refinedMid.x - parentMid.x, refinedMid.y - parentMid.y) > tolerances.maxMidpointShiftPx) {
    failures.push('midpoint_moved');
  }
  const ratio = refinedSpan / parentSpan;
  if (ratio < tolerances.spanRatioMin || ratio > tolerances.spanRatioMax) {
    failures.push('span_ratio_out_of_range');
  }
  if (angleDiffDeg(segmentAngleDeg(parent.sceneP1, parent.sceneP2), segmentAngleDeg(refined.sceneP1, refined.sceneP2)) > tolerances.maxAngleDeg) {
    failures.push('direction_changed');
  }
  const maxLineDist = Math.max(
    distanceToLine(refined.sceneP1, parent.sceneP1, parent.sceneP2),
    distanceToLine(refined.sceneP2, parent.sceneP1, parent.sceneP2),
  );
  if (maxLineDist > tolerances.maxEndpointLineDistancePx) {
    failures.push('endpoint_off_parent_line');
  }
  return { ok: failures.length === 0, failures };
}

// ── Signed candidate refine tokens (P1-9) ────────────────────────────────

export const CANDIDATE_TOKEN_VERSION = 'candv1';
/** Domain separation: the HMAC is computed over a prefixed body so a
 *  candidate token can never be confused with a round token or vice versa. */
const CANDIDATE_TOKEN_DOMAIN = 'candidate-refine';

/** Secret source mirrors the round-token scheme: dedicated secret in
 *  production, OPENAI_API_KEY as an explicitly dev-only fallback. */
function candidateTokenSecret(): string {
  const dedicated = process.env.CALIBRATION_TOKEN_SECRET;
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CALIBRATION_TOKEN_SECRET is required in production');
  }
  const devFallback = process.env.OPENAI_API_KEY;
  if (!devFallback) throw new Error('Missing candidate token signing secret');
  return devFallback;
}

export interface CandidateRefinePayload {
  /** Ledger run (calibration_runs.id) that produced the round-0 candidates. */
  runId: string;
  /** Candidate index within that run's response. */
  idx: number;
  pageId: string;
  /** Server image revision the geometry belongs to. */
  imageRevision: string;
  /** ORIGINAL server-validated source geometry (source raster pixels). */
  sourceP1: Point;
  sourceP2: Point;
  /** Source-raster centre of the label evidence when known (P1-12). */
  labelCentre: Point | null;
  /** Candidate revision at mint time (refined result bumps to revision + 1). */
  revision: number;
}

function canonicalPoint(p: Point): [number, number] {
  return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
}

function hmac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${CANDIDATE_TOKEN_DOMAIN}|${body}`).digest('base64url');
}

export function signCandidateRefineToken(
  payload: CandidateRefinePayload,
  secret: string = candidateTokenSecret(),
): string {
  const canonical = JSON.stringify({
    v: CANDIDATE_TOKEN_VERSION,
    runId: payload.runId,
    idx: payload.idx,
    pageId: payload.pageId,
    rev: payload.imageRevision,
    p1: canonicalPoint(payload.sourceP1),
    p2: canonicalPoint(payload.sourceP2),
    lab: payload.labelCentre ? canonicalPoint(payload.labelCentre) : null,
    cr: payload.revision,
  });
  const body = Buffer.from(canonical, 'utf8').toString('base64url');
  return `${body}.${hmac(body, secret)}`;
}

export type VerifyCandidateTokenResult =
  | { valid: true; payload: CandidateRefinePayload }
  | { valid: false; reason: string };

export function verifyCandidateRefineToken(
  token: string,
  pageId: string,
  imageRevision: string,
  secret: string = candidateTokenSecret(),
): VerifyCandidateTokenResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [body, sig] = parts;
  const expected = hmac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: 'bad_signature' };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }
  if (parsed.v !== CANDIDATE_TOKEN_VERSION) return { valid: false, reason: 'unsupported_version' };
  const pt = (v: unknown, label: string): Point | null => {
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
      throw new Error(label);
    }
    return { x: v[0], y: v[1] };
  };
  try {
    const p1 = pt(parsed.p1, 'p1');
    const p2 = pt(parsed.p2, 'p2');
    const labRaw = parsed.lab;
    const lab = labRaw == null ? null : pt(labRaw, 'lab');
    if (
      typeof parsed.runId !== 'string' || parsed.runId.length === 0 ||
      typeof parsed.idx !== 'number' || !Number.isInteger(parsed.idx) || parsed.idx < 0 || parsed.idx > 2 ||
      typeof parsed.pageId !== 'string' ||
      typeof parsed.rev !== 'string' ||
      typeof parsed.cr !== 'number' || !Number.isInteger(parsed.cr) || parsed.cr < 1
    ) {
      return { valid: false, reason: 'malformed_payload' };
    }
    if (parsed.pageId !== pageId) return { valid: false, reason: 'page_mismatch' };
    if (parsed.rev !== imageRevision) return { valid: false, reason: 'image_revision_mismatch' };
    return {
      valid: true,
      payload: {
        runId: parsed.runId,
        idx: parsed.idx,
        pageId: parsed.pageId,
        imageRevision: parsed.rev,
        sourceP1: p1 as Point,
        sourceP2: p2 as Point,
        labelCentre: lab,
        revision: parsed.cr,
      },
    };
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }
}
