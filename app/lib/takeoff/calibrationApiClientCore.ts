// Client-safe core of the calibration API client (Phase P6, spec 12.4 + 13-P6).
// Pure, dependency-free: request/response contracts, replay-safe retry metadata,
// HTTP failure classification and the server->client candidate frame mapping.
// The thin fetch wrapper lives next to the UI (takeoff/calibration/calibrationApiClient.ts);
// these pure parts are colocated with the calibration test suite.
import type {
  CalibrationCandidate,
  CalibrationEvidenceCrop,
  CalibrationImageDescriptor,
  Point,
} from './calibrationTypes';

// ── Request/response contracts (mirror of app/api/takeoff/calibration/route.ts) ──

export type CalibrationSearchAction = 'search' | 'refine';
export type CalibrationRoundStrategy = 'initial' | 'different_references' | 'refine_reference';

export interface CalibrationSearchRequestBody {
  action: CalibrationSearchAction;
  quoteId: string;
  pageId: string;
  round: 0 | 1;
  strategy: CalibrationRoundStrategy;
  /** Replay-safe identity: network recovery reuses the SAME requestId (spec 12.4). */
  requestId: string;
  /** Terminal technical-failure retry: NEW requestId linked to the failed one. */
  retryOf?: string;
  /** Round-1 authorisation minted by a successful round-0 search. */
  roundToken?: string;
  /** Rejected physical references to exclude from a different-references rescan. */
  excludeReferenceIds?: readonly string[];
  /** Physical references to re-localise at higher detail (refine strategy). */
  refineReferenceIds?: readonly string[];
}

/** Server candidate payload: CalibrationCandidate plus optional evidence crops. */
export type ServerCalibrationCandidate = CalibrationCandidate & {
  evidence: CalibrationCandidate['evidence'] & { crops?: readonly CalibrationEvidenceCrop[] };
};

export interface CalibrationSearchResponse {
  success: true;
  action: CalibrationSearchAction;
  status: 'candidates' | 'no_candidates' | 'unsuitable_image';
  round: 0 | 1;
  pageId: string;
  imageRevision: string;
  /** Server source raster dims (EXIF-normalised) for client frame mapping. */
  sourceWidth: number | null;
  sourceHeight: number | null;
  candidates: ServerCalibrationCandidate[];
  notes: string[];
  completedSearchRounds: number;
  rescanAvailable: boolean;
  roundToken?: string;
  pointsCharged: number;
  pointsRemaining: number;
  detectorVersion: string;
}

export interface CalibrationFailureResponse {
  success: false;
  code: string;
  error: string;
  pointsRemaining?: number;
}

// ── Failure classification (spec 4.6 / 12.4) ──────────────────────────────

export interface CalibrationFailureClassification {
  /** Recoverable: retry the SAME requestId (network recovery, no extra charge semantics). */
  recoverable: boolean;
  /** Terminal technical failure: a retry (if offered) uses a NEW requestId linked via retryOf. */
  terminalTechnical: boolean;
  /** Client/policy failure (quota, flag, ownership): no automatic retry; offer manual fallback. */
  terminalPolicy: boolean;
  message: string;
}

const NETWORK_MESSAGE =
  'Could not reach the calibration service. Your measurements and choices are preserved. Try again.';
const SERVER_MESSAGE =
  'The calibration search failed on the server. No points were charged for this attempt.';
const AUTH_MESSAGE = 'Your session expired. Sign in again, then retry the search.';
const RATE_MESSAGE = 'Too many requests. Wait a moment, then retry the search.';
const POLICY_MESSAGE = 'AI calibration is unavailable for this plan. Calibrate manually instead.';

/**
 * HTTP error mapping per the P6 scope: 4xx client errors are terminal except
 * 401/429; 5xx and network failures are recoverable. Codes are surfaced for
 * specific copy (rescan refusal 409 REQUEST_CONFLICT is handled by the caller).
 */
export function classifyCalibrationHttpFailure(
  status: number | null,
  code?: string | null,
): CalibrationFailureClassification {
  if (status == null) {
    // Network-level failure (fetch threw before a response).
    return { recoverable: true, terminalTechnical: false, terminalPolicy: false, message: NETWORK_MESSAGE };
  }
  if (status === 401) {
    return { recoverable: true, terminalTechnical: false, terminalPolicy: false, message: AUTH_MESSAGE };
  }
  if (status === 429) {
    return { recoverable: true, terminalTechnical: false, terminalPolicy: false, message: RATE_MESSAGE };
  }
  if (status >= 500) {
    return { recoverable: true, terminalTechnical: true, terminalPolicy: false, message: SERVER_MESSAGE };
  }
  // Other 4xx: terminal client/policy failure (authz, quota, ownership, bad image).
  const message = code === 'INSUFFICIENT_POINTS'
    ? 'AI Assist points limit reached. Calibrate manually, or top up points to use AI calibration.'
    : code === 'REQUEST_CONFLICT'
      ? 'No more searches. Accept a measurement or calibrate manually.'
      : POLICY_MESSAGE;
  return { recoverable: false, terminalTechnical: false, terminalPolicy: true, message };
}

/** Typed error thrown by the fetch wrapper; classification drives the retry UX. */
export class CalibrationApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
    readonly classification: CalibrationFailureClassification,
  ) {
    super(classification.message);
    this.name = 'CalibrationApiError';
  }
}

// ── Response validation (structure only; semantics stay server-side) ──────

const MAX_CANDIDATES = 3;
const CROP_KINDS: readonly CalibrationEvidenceCrop['kind'][] = ['endpoint-a', 'endpoint-b', 'label'];

/**
 * Structural validation of a search response body. Returns a typed response or
 * null when the payload is malformed (treated as a terminal technical failure).
 */
export function parseCalibrationSearchResponse(raw: unknown): CalibrationSearchResponse | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.success !== true) return null;
  if (o.action !== 'search' && o.action !== 'refine') return null;
  if (o.status !== 'candidates' && o.status !== 'no_candidates' && o.status !== 'unsuitable_image') return null;
  if (o.round !== 0 && o.round !== 1) return null;
  if (typeof o.pageId !== 'string' || typeof o.imageRevision !== 'string') return null;
  if (!Array.isArray(o.candidates) || o.candidates.length > MAX_CANDIDATES) return null;
  if (!Array.isArray(o.notes)) return null;
  for (const c of o.candidates) {
    if (typeof c !== 'object' || c === null) return null;
    const co = c as Record<string, unknown>;
    if (typeof co.id !== 'string' || typeof co.referenceId !== 'string') return null;
    const p = [co.sourceP1, co.sourceP2, co.sceneP1, co.sceneP2];
    if (p.some((v) => typeof v !== 'object' || v === null ||
      !Number.isFinite((v as Record<string, unknown>).x) ||
      !Number.isFinite((v as Record<string, unknown>).y))) return null;
    const ev = co.evidence;
    if (typeof ev !== 'object' || ev === null || !Array.isArray((ev as Record<string, unknown>).analysisImageIds)) return null;
    const crops = (ev as Record<string, unknown>).crops;
    if (crops !== undefined) {
      if (!Array.isArray(crops)) return null;
      for (const crop of crops) {
        if (typeof crop !== 'object' || crop === null) return null;
        const cr = crop as Record<string, unknown>;
        if (!CROP_KINDS.includes(cr.kind as CalibrationEvidenceCrop['kind'])) return null;
        if (typeof cr.dataUri !== 'string' || !cr.dataUri.startsWith('data:image/')) return null;
      }
    }
  }
  const sourceWidth = typeof o.sourceWidth === 'number' && Number.isFinite(o.sourceWidth) ? o.sourceWidth : null;
  const sourceHeight = typeof o.sourceHeight === 'number' && Number.isFinite(o.sourceHeight) ? o.sourceHeight : null;
  return {
    success: true,
    action: o.action,
    status: o.status,
    round: o.round,
    pageId: o.pageId,
    imageRevision: o.imageRevision,
    sourceWidth: sourceWidth != null && sourceHeight != null ? sourceWidth : null,
    sourceHeight: sourceWidth != null && sourceHeight != null ? sourceHeight : null,
    candidates: o.candidates as ServerCalibrationCandidate[],
    notes: (o.notes as unknown[]).filter((n): n is string => typeof n === 'string'),
    completedSearchRounds: typeof o.completedSearchRounds === 'number' ? o.completedSearchRounds : 1,
    rescanAvailable: o.rescanAvailable === true,
    roundToken: typeof o.roundToken === 'string' ? o.roundToken : undefined,
    pointsCharged: typeof o.pointsCharged === 'number' ? o.pointsCharged : 1,
    pointsRemaining: typeof o.pointsRemaining === 'number' ? o.pointsRemaining : 0,
    detectorVersion: typeof o.detectorVersion === 'string' ? o.detectorVersion : '',
  };
}

// ── Server -> client scene frame mapping ──────────────────────────────────

export type MapCandidatesResult =
  | { ok: true; candidates: CalibrationCandidate[] }
  | { ok: false; reason: string };

/**
 * Map server candidates into the workstation's own scene frame. The server
 * computes source/scene coordinates against the EXIF-normalised source raster;
 * the workstation background is the same raster under a UNIFORM scale (its
 * canvas dims, identity source-to-scene). Mapping is therefore a single uniform
 * scale from server-source pixels to client-scene pixels, guarded by an aspect
 * check: an anisotropic mismatch fails honestly rather than stretching points.
 *
 * referenceId/imageRevision identity: both are preserved VERBATIM from the
 * server payload (P0-6). The candidate's imageRevision is the authoritative
 * server content-digest revision - client frame mapping never rewrites it.
 * Only the scene coordinates and scenePixelLength are recomputed into the
 * client render frame; the reducer's frame guard keys on the client frameKey.
 */
export function mapCandidatesToClientFrame(
  candidates: readonly ServerCalibrationCandidate[],
  serverSource: { width: number; height: number },
  clientImage: CalibrationImageDescriptor,
): MapCandidatesResult {
  if (serverSource.width <= 0 || serverSource.height <= 0) {
    return { ok: false, reason: 'invalid_server_source_dims' };
  }
  const scaleX = clientImage.sceneWidth / serverSource.width;
  const scaleY = clientImage.sceneHeight / serverSource.height;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
    return { ok: false, reason: 'invalid_client_scene_dims' };
  }
  // Aspect-consistency guard (1% relative tolerance for canvas rounding).
  if (Math.abs(scaleX - scaleY) / scaleX > 0.01) {
    return { ok: false, reason: 'anisotropic_frame_mismatch' };
  }
  const k = (scaleX + scaleY) / 2;
  const map = (p: Point): Point => ({ x: p.x * k, y: p.y * k });
  const mapped: CalibrationCandidate[] = candidates.map((c) => {
    const sceneP1 = map(c.sourceP1);
    const sceneP2 = map(c.sourceP2);
    return {
      ...c,
      sceneP1,
      sceneP2,
      scenePixelLength: Math.hypot(sceneP2.x - sceneP1.x, sceneP2.y - sceneP1.y),
      // P0-6: keep the authoritative server imageRevision verbatim - the
      // client render frame is a mapping concern, not an identity concern.
    };
  });
  return { ok: true, candidates: mapped };
}

/** Human-facing evidence crops for the zoom component, ordered endpoint-a, endpoint-b, label. */
export function evidenceCropsForDisplay(
  candidate: CalibrationCandidate | null,
): Array<{ url: string; label: string }> {
  const crops = candidate?.evidence.crops;
  if (!crops || crops.length === 0) return [];
  const labels: Record<CalibrationEvidenceCrop['kind'], string> = {
    'endpoint-a': 'Start point',
    'endpoint-b': 'End point',
    label: 'Label',
  };
  return crops.map((crop) => ({ url: crop.dataUri, label: labels[crop.kind] ?? 'Evidence' }));
}
