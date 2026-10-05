// Pure calibration review-session state machine (spec sections 8.1-8.3).
// Every event in the section 8.2 table is implemented here. No React, Fabric,
// Supabase or provider imports; the desktop controller and future mobile adapter
// both drive this reducer.
//
// Invariants enforced (spec 8.1/8.3):
// - Committed state lives OUTSIDE this draft; the reducer never mutates it.
// - Max 3 accepted reference records shared across manual and AI origins.
// - Editing an already accepted reference marks it needs_reconfirmation and
//   excludes it from the draft scale until reaccepted.
// - SEARCH_SUCCEEDED is validated against the full context guard
//   {quoteId, pageId, imageRevision, sessionId, requestId, contextEpoch};
//   stale results are discarded unchanged.
// - A search round is consumed ONLY on a successful search; failures do not.
// - FINISH requires 1-3 currently-valid accepted references.
// - Acceptance value validation uses the strict parser in calibrationCandidates;
//   parseFloat is never used on measurement text.
import type {
  AcceptedReferenceDraft,
  CalibrationCandidate,
  CalibrationImageDescriptor,
  CalibrationReviewState,
  CandidateReview,
  DistanceUnit,
  EffectiveCalibration,
  Point,
  WorkingUnit,
} from './calibrationTypes';
import { computeEffectiveCalibration, MAX_ACCEPTED_REFERENCES } from './calibration';
import { parseDistanceSuggestion } from './calibrationCandidates';

/** Full context guard captured when a search starts and revalidated on completion (spec 8.3).
 *  The frame key identifies the CLIENT render frame (mapping identity); the
 *  authoritative image revision lives on the candidates themselves (P0-6). */
export interface SessionContext {
  quoteId: string;
  pageId: string;
  frameKey: string;
  sessionId: string | null;
  requestId: string;
  contextEpoch: number;
}

export type SearchStrategy = 'initial' | 'different_references' | 'refine_reference';

/** M4 (spec §7.4): local human endpoint override for an AI candidate. The raw
 *  server proposal is never mutated; acceptance reads these effective points
 *  and recomputes the pixel span from them (never the cached length). */
export interface EndpointOverride {
  sceneP1: Point;
  sceneP2: Point;
  /** Increments on each human edit batch; 1 after the first edit. */
  revision: number;
}

/** M4 (spec §7.2): the manual A/B wizard's in-progress endpoint pair. */
export interface ManualEndpointDraft {
  p1: Point | null;
  p2: Point | null;
}

/**
 * Reducer state: the shared review-draft contract plus internal request bookkeeping.
 * The extra fields are serialisable and owned entirely by this module.
 */
export interface CalibrationSessionState extends CalibrationReviewState {
  quoteId: string;
  /** 0-based round of the in-flight request; null when no request is outstanding. */
  pendingRound: 0 | 1 | null;
  /** Strategy armed by REQUEST_RESCAN and consumed by the next SEARCH_STARTED. */
  searchStrategy: SearchStrategy | null;
  /** P6: physical reference to re-localise (strategy refine_reference). */
  refineReferenceId: string | null;
  /** M4 (spec §7.4): human endpoint overrides keyed by candidateId. */
  endpointOverrides: Record<string, EndpointOverride>;
  /** M4 (spec §7.2): manual A/B wizard endpoint draft (null when idle). */
  manualDraft: ManualEndpointDraft | null;
  /** M4 (C12): explicit acknowledgement of the >10% scale disagreement
   *  warning. Reset to false whenever the accepted set or a contribution
   *  changes; presentations must require it before finishing. */
  disagreementAcknowledged: boolean;
}

export type CalibrationSessionEvent =
  | { type: 'START_NEW'; quoteId: string; image: CalibrationImageDescriptor; baseCalibrationRevision: number }
  | { type: 'START_REPLACE'; quoteId: string; image: CalibrationImageDescriptor; baseCalibrationRevision: number }
  | {
      type: 'START_EDIT';
      quoteId: string;
      image: CalibrationImageDescriptor;
      baseCalibrationRevision: number;
      initialAccepted: AcceptedReferenceDraft[];
    }
  | { type: 'SEARCH_STARTED'; context: SessionContext; round: 0 | 1; strategy: SearchStrategy }
  | {
      type: 'SEARCH_SUCCEEDED';
      context: SessionContext;
      round: 0 | 1;
      candidates: CalibrationCandidate[];
    }
  | { type: 'SEARCH_FAILED'; code: string; message: string; requestId?: string }
  | { type: 'SELECT_CANDIDATE'; candidateId: string }
  | { type: 'EDIT_DISTANCE'; candidateId: string; value: string }
  | { type: 'EDIT_UNIT'; candidateId: string; unit: DistanceUnit | null }
  | { type: 'ACCEPT_CURRENT' }
  | { type: 'ACCEPT_AND_FINISH' }
  | { type: 'SKIP_CURRENT'; reason: 'endpoints' | 'wrong_reference' | 'unsure' }
  | { type: 'REMOVE_ACCEPTED'; id: string }
  | { type: 'REQUEST_RESCAN'; strategy: 'different_references' | 'refine_reference'; refineReferenceId?: string }
  | { type: 'SWITCH_TO_MANUAL' }
  | { type: 'FINISH_ACCEPTED' }
  | { type: 'COMMIT_SUCCEEDED' }
  | { type: 'COMMIT_FAILED'; code: string; message: string }
  | { type: 'CANCEL' }
  | { type: 'PAGE_CHANGED' }
  | { type: 'IMAGE_CHANGED' }
  // ── M4 (spec §7.2/§7.4): manual wizard + human endpoint repair ──────────
  | { type: 'BEGIN_MANUAL_REFERENCE' }
  | { type: 'SET_MANUAL_ENDPOINT'; which: 'p1' | 'p2'; point: Point }
  | { type: 'CLEAR_MANUAL_ENDPOINTS' }
  | { type: 'ACCEPT_MANUAL'; distance: string; unit: DistanceUnit | null; finish: boolean }
  | { type: 'EDIT_ENDPOINT'; candidateId: string; sceneP1?: Point; sceneP2?: Point }
  | { type: 'RESET_ENDPOINTS'; candidateId: string }
  | { type: 'ACKNOWLEDGE_DISAGREEMENT' }
  | { type: 'DETACH_REFERENCE'; id: string };

let sessionSeq = 0;

/** Deterministic session id generator (pure enough for tests; not a security token). */
export function nextSessionId(): string {
  sessionSeq += 1;
  return `cal-session-${sessionSeq}`;
}

function nextEpoch(state: CalibrationSessionState): number {
  return Number.isFinite(state?.contextEpoch) ? state.contextEpoch + 1 : 1;
}

function freshState(
  mode: CalibrationSessionState['mode'],
  quoteId: string,
  image: CalibrationImageDescriptor,
  baseCalibrationRevision: number,
  epoch: number,
  accepted: AcceptedReferenceDraft[] = [],
): CalibrationSessionState {
  if (accepted.length > MAX_ACCEPTED_REFERENCES) {
    throw new Error(`freshState: at most ${MAX_ACCEPTED_REFERENCES} accepted references`);
  }
  return {
    phase: 'idle',
    mode,
    sessionId: nextSessionId(),
    requestId: null,
    contextEpoch: epoch,
    image,
    baseCalibrationRevision,
    searchRoundsCompleted: 0,
    candidates: [],
    reviews: {},
    accepted,
    endpointOverrides: {},
    manualDraft: null,
    disagreementAcknowledged: false,
    activeCandidateId: null,
    error: null,
    quoteId,
    pendingRound: null,
    searchStrategy: null,
    refineReferenceId: null,
  };
}

function reviewFor(state: CalibrationSessionState, candidateId: string): CandidateReview {
  return (
    state.reviews[candidateId] ?? {
      candidateId,
      decision: 'unreviewed',
      enteredDistance: '',
      enteredUnit: null,
      rejectedReason: null,
    }
  );
}

function contextMatches(state: CalibrationSessionState, ctx: SessionContext): boolean {
  return (
    ctx.quoteId === state.quoteId &&
    ctx.pageId === state.image.pageId &&
    ctx.frameKey === state.image.frameKey &&
    ctx.sessionId === state.sessionId &&
    ctx.contextEpoch === state.contextEpoch
  );
}

/** Next candidate with decision 'unreviewed', in candidate order. */
function nextUnreviewedId(state: CalibrationSessionState): string | null {
  for (const c of state.candidates) {
    const r = state.reviews[c.id];
    if (!r || r.decision === 'unreviewed') return c.id;
  }
  return null;
}

/** Accepted records that currently contribute: everything not marked needs_reconfirmation. */
export function validAcceptedReferences(state: CalibrationSessionState): AcceptedReferenceDraft[] {
  return state.accepted.filter((ref) => {
    if (ref.candidateId == null) return true;
    return state.reviews[ref.candidateId]?.decision !== 'needs_reconfirmation';
  });
}

/** Effective calibration over the currently-valid accepted references; null when none. */
export function selectDraftEffectiveCalibration(
  state: CalibrationSessionState,
  workingUnit: WorkingUnit,
): EffectiveCalibration | null {
  const refs = validAcceptedReferences(state);
  if (refs.length === 0) return null;
  try {
    return computeEffectiveCalibration(
      refs.map((r) => ({
        id: r.id,
        sceneP1: r.sceneP1,
        sceneP2: r.sceneP2,
        confirmedDistance: r.confirmedDistance,
        confirmedUnit: r.confirmedUnit,
      })),
      workingUnit,
    );
  } catch {
    return null;
  }
}

export function selectActiveCandidate(state: CalibrationSessionState): CalibrationCandidate | null {
  if (!state.activeCandidateId) return null;
  return state.candidates.find((c) => c.id === state.activeCandidateId) ?? null;
}

/** Candidates still awaiting a first decision. */
export function selectUnfinishedCount(state: CalibrationSessionState): number {
  return state.candidates.filter((c) => {
    const r = state.reviews[c.id];
    return !r || r.decision === 'unreviewed';
  }).length;
}

/**
 * Measurement tools may run only when a valid COMMITTED calibration exists and no
 * draft operation (search/commit) locks them. Never use the draft array as proof.
 */
export function selectCanMeasure(
  state: CalibrationSessionState,
  committedCalibrationValid: boolean,
): boolean {
  if (!committedCalibrationValid) return false;
  return state.phase !== 'searching' && state.phase !== 'committing';
}

export function selectRescanRemaining(state: CalibrationSessionState): 0 | 1 {
  return state.searchRoundsCompleted < 2 ? 1 : 0;
}

interface AcceptanceResult {
  ok: true;
  distance: number;
  unit: DistanceUnit;
  valueCorrected: boolean;
}

function validateAcceptance(
  candidate: CalibrationCandidate,
  review: CandidateReview,
): { ok: false; code: string; message: string } | AcceptanceResult {
  const entered = review.enteredDistance.trim();
  if (entered !== '') {
    const unit = review.enteredUnit ?? candidate.suggestedUnit;
    if (unit == null) {
      return { ok: false, code: 'unit_required', message: 'Choose the unit printed on the plan.' };
    }
    const parsed = parseDistanceSuggestion(entered, unit);
    if (parsed == null || !Number.isFinite(parsed.distance) || parsed.distance <= 0) {
      return {
        ok: false,
        code: 'invalid_distance',
        message: 'Enter the distance exactly as printed, e.g. 6.42 or 10 1/2.',
      };
    }
    return {
      ok: true,
      distance: parsed.distance,
      unit: parsed.unit,
      valueCorrected:
        candidate.suggestedDistance !== parsed.distance ||
        candidate.suggestedUnit !== parsed.unit,
    };
  }
  if (candidate.suggestedDistance == null || candidate.suggestedUnit == null) {
    return {
      ok: false,
      code: 'distance_required',
      message: 'AI could not read this distance. Enter the printed distance and unit.',
    };
  }
  return {
    ok: true,
    distance: candidate.suggestedDistance,
    unit: candidate.suggestedUnit,
    valueCorrected: false,
  };
}

/** Whether a candidate's authoritative server image revision is usable for
 *  this session's image. When the descriptor does not know the authoritative
 *  revision yet (null), the controller's cross-response consistency check
 *  guards it instead - candidates keep their server revision verbatim (P0-6). */
function candidateRevisionUsable(
  state: CalibrationSessionState,
  candidate: CalibrationCandidate,
): boolean {
  if (state.image.imageRevision == null) return true;
  return candidate.imageRevision === state.image.imageRevision;
}

// ── M4 (spec §7.4): effective endpoints + provenance + duplicate guard ─────

/** Human override for a candidate, if any (spec §7.4 override layer). */
export function endpointOverrideFor(
  state: CalibrationSessionState,
  candidateId: string,
): EndpointOverride | null {
  return state.endpointOverrides[candidateId] ?? null;
}

/** The endpoints acceptance must read: human override when present, else the
 *  raw server proposal. `edited` drives provenance (ai_adjusted). */
export function effectiveCandidateEndpoints(
  state: CalibrationSessionState,
  candidate: CalibrationCandidate,
): { sceneP1: Point; sceneP2: Point; edited: boolean } {
  const override = state.endpointOverrides[candidate.id];
  if (override) {
    return { sceneP1: override.sceneP1, sceneP2: override.sceneP2, edited: true };
  }
  return { sceneP1: candidate.sceneP1, sceneP2: candidate.sceneP2, edited: false };
}

/** C09 (spec §7.4 rule 4): original AI evidence crops describe the ORIGINAL
 *  endpoints only. Once a human override exists they are "Original AI
 *  suggestion", never proof of the edited points. */
export function evidenceIsCurrent(
  state: CalibrationSessionState,
  candidateId: string,
): boolean {
  return state.endpointOverrides[candidateId] == null;
}

/** Accepted reference ids currently excluded pending reconfirmation (C08). */
export function needsReconfirmationIds(state: CalibrationSessionState): string[] {
  return state.accepted
    .filter((r) => r.candidateId != null && state.reviews[r.candidateId]?.decision === 'needs_reconfirmation')
    .map((r) => r.id);
}

const ENDPOINT_EPS = 1e-9;

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= ENDPOINT_EPS && Math.abs(a.y - b.y) <= ENDPOINT_EPS;
}

/** C11: an exact or point-reversed duplicate of an already-accepted pair
 *  cannot double-count. Distinct parallel/nested references stay allowed. */
function pairsDuplicate(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
): boolean {
  return (
    (samePoint(a1, b1) && samePoint(a2, b2)) ||
    (samePoint(a1, b2) && samePoint(a2, b1))
  );
}

function acceptedHasPair(
  state: CalibrationSessionState,
  p1: Point,
  p2: Point,
  exceptId: string | null,
): boolean {
  return state.accepted.some(
    (r) => r.id !== exceptId && pairsDuplicate(r.sceneP1, r.sceneP2, p1, p2),
  );
}

function applyAcceptance(
  state: CalibrationSessionState,
  finish: boolean,
): CalibrationSessionState {
  const candidate = selectActiveCandidate(state);
  if (!candidate) {
    return { ...state, error: { code: 'no_active_candidate', message: 'Select a measurement first.' } };
  }
  if (!candidateRevisionUsable(state, candidate)) {
    return { ...state, error: { code: 'image_mismatch', message: 'Candidate belongs to a different image.' } };
  }
  const review = reviewFor(state, candidate.id);
  const verdict = validateAcceptance(candidate, review);
  if (!verdict.ok) {
    return { ...state, error: { code: verdict.code, message: verdict.message } };
  }

  const existingIndex = state.accepted.findIndex(
    (r) => r.candidateId === candidate.id,
  );
  if (existingIndex < 0 && state.accepted.length >= MAX_ACCEPTED_REFERENCES) {
    return {
      ...state,
      error: {
        code: 'accepted_cap_reached',
        message: `At most ${MAX_ACCEPTED_REFERENCES} accepted measurements. Remove one first.`,
      },
    };
  }

  const effective = effectiveCandidateEndpoints(state, candidate);
  if (Math.hypot(effective.sceneP2.x - effective.sceneP1.x, effective.sceneP2.y - effective.sceneP1.y) <= 0) {
    return { ...state, error: { code: 'invalid_endpoints', message: 'The two points must be different. Adjust them and try again.' } };
  }
  if (acceptedHasPair(state, effective.sceneP1, effective.sceneP2, existingIndex >= 0 ? state.accepted[existingIndex].id : null)) {
    return {
      ...state,
      error: {
        code: 'duplicate_reference',
        message: 'This measurement has already been added. Use a different known distance.',
      },
    };
  }

  const record: AcceptedReferenceDraft = {
    id: existingIndex >= 0 ? state.accepted[existingIndex].id : `ref-${candidate.id}`,
    source: effective.edited ? 'ai_adjusted' : 'ai_confirmed',
    candidateId: candidate.id,
    referenceId: candidate.referenceId,
    candidateRevision: candidate.revision,
    sceneP1: effective.sceneP1,
    sceneP2: effective.sceneP2,
    confirmedDistance: verdict.distance,
    confirmedUnit: verdict.unit,
    originalLabelText: candidate.sourceLabelText,
    valueCorrected: verdict.valueCorrected,
    endpointsEdited: effective.edited,
  };

  const accepted =
    existingIndex >= 0
      ? state.accepted.map((r, i) => (i === existingIndex ? record : r))
      : [...state.accepted, record];
  const reviews: Record<string, CandidateReview> = {
    ...state.reviews,
    [candidate.id]: { ...review, decision: 'accepted', rejectedReason: null },
  };

  const nextBase: CalibrationSessionState = {
    ...state,
    accepted,
    reviews,
    error: null,
    disagreementAcknowledged: false,
  };

  if (!finish) {
    return { ...nextBase, activeCandidateId: nextUnreviewedId(nextBase) };
  }

  const valid = validAcceptedReferences(nextBase);
  if (valid.length < 1) {
    return { ...nextBase, error: { code: 'no_valid_references', message: 'No valid accepted measurements.' } };
  }
  return { ...nextBase, phase: 'committing' };
}

function applySearchSucceeded(
  state: CalibrationSessionState,
  ctx: SessionContext,
  round: 0 | 1,
  candidates: CalibrationCandidate[],
): CalibrationSessionState {
  // Full context guard: any mismatch means the result is stale - discard it,
  // leaving the draft completely untouched (spec 8.3).
  if (
    state.phase !== 'searching' ||
    state.requestId !== ctx.requestId ||
    !contextMatches(state, ctx) ||
    state.pendingRound !== round
  ) {
    return state;
  }
  // Only candidates for the session's authoritative image revision are usable.
  const usable = candidates.filter((c) => candidateRevisionUsable(state, c));
  // Display at most 3 minus slots already occupied by accepted references.
  const slots = Math.max(0, MAX_ACCEPTED_REFERENCES - state.accepted.length);
  const shown = usable.slice(0, slots);
  const reviews: Record<string, CandidateReview> = {};
  for (const c of shown) {
    reviews[c.id] = reviewFor(state, c.id);
    // Prior decisions for surviving candidate ids are preserved; new ids start unreviewed.
  }
  // C10: human endpoint overrides for surviving candidate ids are preserved
  // too — switching/searching must never discard a half-repaired pair.
  const endpointOverrides: Record<string, EndpointOverride> = {};
  for (const c of shown) {
    const o = state.endpointOverrides[c.id];
    if (o) endpointOverrides[c.id] = o;
  }
  return {
    ...state,
    phase: 'reviewing',
    candidates: shown,
    reviews,
    endpointOverrides,
    activeCandidateId: shown.length > 0 ? shown[0].id : null,
    requestId: null,
    pendingRound: null,
    searchRoundsCompleted: (round + 1) as 0 | 1 | 2,
    error: null,
  };
}

function applySearchFailed(
  state: CalibrationSessionState,
  code: string,
  message: string,
  requestId?: string,
): CalibrationSessionState {
  if (state.phase !== 'searching') return state;
  if (requestId != null && state.requestId != null && requestId !== state.requestId) return state;
  // A technical failure does NOT consume a search round (spec 7.1).
  return {
    ...state,
    phase: 'reviewing',
    requestId: null,
    pendingRound: null,
    error: { code, message },
  };
}

function applyFinish(state: CalibrationSessionState): CalibrationSessionState {
  const valid = validAcceptedReferences(state);
  if (valid.length < 1) {
    return {
      ...state,
      error: {
        code: 'no_valid_references',
        message: 'Accept at least one measurement before finishing.',
      },
    };
  }
  if (valid.length > MAX_ACCEPTED_REFERENCES) {
    return { ...state, error: { code: 'too_many_references', message: 'Too many accepted measurements.' } };
  }
  return { ...state, phase: 'committing', error: null };
}

function invalidate(state: CalibrationSessionState): CalibrationSessionState {
  // Cancel/page-switch/image-change: invalidate any outstanding request context,
  // drop previews/decisions and end the session. Prior COMMITTED state is owned
  // by the parent and is never touched here.
  return {
    ...state,
    phase: 'cancelled',
    contextEpoch: nextEpoch(state),
    requestId: null,
    pendingRound: null,
    candidates: [],
    reviews: {},
    accepted: [],
    endpointOverrides: {},
    manualDraft: null,
    disagreementAcknowledged: false,
    activeCandidateId: null,
    searchStrategy: null,
    refineReferenceId: null,
    error: null,
  };
}

/** M4 (spec §7.2): accept the manual A/B wizard pair as a manual reference.
 *  Distance/unit entry is the manual override path (C07) — it works for any
 *  unknown/absent AI value and shares the 3-cap and duplicate guard with AI
 *  acceptance. No AI call, no charge (R02/C05). */
function applyAcceptManual(
  state: CalibrationSessionState,
  distance: string,
  unit: DistanceUnit | null,
  finish: boolean,
): CalibrationSessionState {
  if (state.phase !== 'manual') {
    return { ...state, error: { code: 'not_manual_phase', message: 'Start a manual measurement first.' } };
  }
  const draft = state.manualDraft;
  if (!draft || !draft.p1 || !draft.p2) {
    return { ...state, error: { code: 'endpoints_required', message: 'Place the start and end points first.' } };
  }
  const span = Math.hypot(draft.p2.x - draft.p1.x, draft.p2.y - draft.p1.y);
  if (!(span > 0)) {
    return { ...state, error: { code: 'invalid_endpoints', message: 'The two points must be different. Move one of them and try again.' } };
  }
  if (unit == null) {
    return { ...state, error: { code: 'unit_required', message: 'Choose the unit printed on the plan.' } };
  }
  const parsed = parseDistanceSuggestion(distance.trim(), unit);
  if (parsed == null || !Number.isFinite(parsed.distance) || parsed.distance <= 0) {
    return {
      ...state,
      error: { code: 'invalid_distance', message: 'Enter the distance exactly as printed, e.g. 6.42 or 10 1/2.' },
    };
  }
  if (state.accepted.length >= MAX_ACCEPTED_REFERENCES) {
    return {
      ...state,
      error: {
        code: 'accepted_cap_reached',
        message: `At most ${MAX_ACCEPTED_REFERENCES} accepted measurements. Remove one first.`,
      },
    };
  }
  if (acceptedHasPair(state, draft.p1, draft.p2, null)) {
    return {
      ...state,
      error: {
        code: 'duplicate_reference',
        message: 'This measurement has already been added. Use a different known distance.',
      },
    };
  }
  const record: AcceptedReferenceDraft = {
    id: `manual-${state.sessionId ?? 'session'}-${state.accepted.length + 1}`,
    source: 'manual',
    candidateId: null,
    referenceId: null,
    candidateRevision: null,
    sceneP1: draft.p1,
    sceneP2: draft.p2,
    confirmedDistance: parsed.distance,
    confirmedUnit: parsed.unit,
    originalLabelText: null,
    valueCorrected: false,
    endpointsEdited: false,
  };
  const accepted = [...state.accepted, record];
  const next: CalibrationSessionState = {
    ...state,
    accepted,
    manualDraft: { p1: null, p2: null }, // ready for the next pair (§7.2)
    error: null,
    disagreementAcknowledged: false,
  };
  if (!finish) return next;
  const valid = validAcceptedReferences(next);
  if (valid.length < 1) {
    return { ...next, error: { code: 'no_valid_references', message: 'No valid accepted measurements.' } };
  }
  return { ...next, phase: 'committing' };
}

export function calibrationSessionReducer(
  state: CalibrationSessionState,
  event: CalibrationSessionEvent,
): CalibrationSessionState {
  switch (event.type) {
    case 'START_NEW':
      return freshState('new', event.quoteId, event.image, event.baseCalibrationRevision, nextEpoch(state));
    case 'START_REPLACE':
      return freshState('replace', event.quoteId, event.image, event.baseCalibrationRevision, nextEpoch(state));
    case 'START_EDIT':
      return freshState(
        'edit',
        event.quoteId,
        event.image,
        event.baseCalibrationRevision,
        nextEpoch(state),
        event.initialAccepted.slice(0, MAX_ACCEPTED_REFERENCES),
      );

    case 'SEARCH_STARTED': {
      if (state.phase !== 'idle' && state.phase !== 'reviewing' && state.phase !== 'manual') return state;
      if (!contextMatches(state, event.context)) return state;
      return {
        ...state,
        phase: 'searching',
        requestId: event.context.requestId,
        pendingRound: event.round,
        searchStrategy: event.strategy,
        error: null,
      };
    }

    case 'SEARCH_SUCCEEDED':
      return applySearchSucceeded(state, event.context, event.round, event.candidates);

    case 'SEARCH_FAILED':
      return applySearchFailed(state, event.code, event.message, event.requestId);

    case 'SELECT_CANDIDATE': {
      // Selection changes focus ONLY; it never accepts or rejects anything.
      if (!state.candidates.some((c) => c.id === event.candidateId)) return state;
      return { ...state, activeCandidateId: event.candidateId };
    }

    case 'EDIT_DISTANCE': {
      const review = reviewFor(state, event.candidateId);
      const decision =
        review.decision === 'accepted' ? 'needs_reconfirmation' : review.decision;
      return {
        ...state,
        disagreementAcknowledged: false,
        reviews: {
          ...state.reviews,
          [event.candidateId]: { ...review, enteredDistance: event.value, decision },
        },
      };
    }

    case 'EDIT_UNIT': {
      const review = reviewFor(state, event.candidateId);
      const decision =
        review.decision === 'accepted' ? 'needs_reconfirmation' : review.decision;
      return {
        ...state,
        disagreementAcknowledged: false,
        reviews: {
          ...state.reviews,
          [event.candidateId]: { ...review, enteredUnit: event.unit, decision },
        },
      };
    }

    case 'ACCEPT_CURRENT':
      return applyAcceptance(state, false);

    case 'ACCEPT_AND_FINISH':
      return applyAcceptance(state, true);

    case 'SKIP_CURRENT': {
      const candidate = selectActiveCandidate(state);
      if (!candidate) return state;
      const review = reviewFor(state, candidate.id);
      const reviews: Record<string, CandidateReview> = {
        ...state.reviews,
        [candidate.id]: { ...review, decision: 'skipped', rejectedReason: event.reason },
      };
      const next: CalibrationSessionState = { ...state, reviews, error: null };
      return { ...next, activeCandidateId: nextUnreviewedId(next) };
    }

    case 'REMOVE_ACCEPTED': {
      const target = state.accepted.find((r) => r.id === event.id);
      if (!target) return state;
      const reviews = { ...state.reviews };
      if (target.candidateId != null && reviews[target.candidateId]) {
        reviews[target.candidateId] = {
          ...reviews[target.candidateId],
          decision: 'unreviewed',
          rejectedReason: null,
        };
      }
      return { ...state, accepted: state.accepted.filter((r) => r.id !== event.id), reviews, disagreementAcknowledged: false };
    }

    case 'REQUEST_RESCAN': {
      const remaining = selectRescanRemaining(state);
      const capacity = state.accepted.length < MAX_ACCEPTED_REFERENCES;
      if (remaining === 0 || !capacity || state.phase !== 'reviewing' || state.requestId != null) {
        return {
          ...state,
          error: {
            code: 'rescan_unavailable',
            message: capacity
              ? 'No search remaining in this session.'
              : 'Remove an accepted measurement to free a slot first.',
          },
        };
      }
      return { ...state, searchStrategy: event.strategy, refineReferenceId: event.refineReferenceId ?? null, error: null };
    }

    case 'SWITCH_TO_MANUAL':
      // Keeps accepted draft references; manual entry uses the same commit mechanism.
      return { ...state, phase: 'manual', requestId: null, pendingRound: null };

    case 'FINISH_ACCEPTED':
      return applyFinish(state);

    case 'COMMIT_SUCCEEDED':
      return { ...state, phase: 'completed', error: null };

    case 'COMMIT_FAILED':
      return {
        ...state,
        phase: 'reviewing',
        error: { code: event.code, message: event.message },
      };

    case 'CANCEL':
    case 'PAGE_CHANGED':
    case 'IMAGE_CHANGED':
      return invalidate(state);

    // ── M4 (spec §7.2/§7.4): manual wizard + human endpoint repair ─────────

    case 'BEGIN_MANUAL_REFERENCE': {
      // Manual entry is always available (R01/C07) — including mid AI review
      // (mixed manual/AI accepted sets share the 3-cap).
      return {
        ...state,
        phase: 'manual',
        requestId: null,
        pendingRound: null,
        manualDraft: { p1: null, p2: null },
        error: null,
      };
    }

    case 'SET_MANUAL_ENDPOINT': {
      if (!Number.isFinite(event.point.x) || !Number.isFinite(event.point.y)) return state;
      const draft = state.manualDraft ?? { p1: null, p2: null };
      return {
        ...state,
        manualDraft:
          event.which === 'p1' ? { ...draft, p1: event.point } : { ...draft, p2: event.point },
      };
    }

    case 'CLEAR_MANUAL_ENDPOINTS':
      return { ...state, manualDraft: { p1: null, p2: null } };

    case 'ACCEPT_MANUAL':
      return applyAcceptManual(state, event.distance, event.unit, event.finish);

    case 'EDIT_ENDPOINT': {
      // The candidate may be in the live list or only referenced by an
      // already-accepted record (repair of an accepted pair, C08).
      const candidate = state.candidates.find((c) => c.id === event.candidateId) ?? null;
      const acceptedForCandidate = state.accepted.find((r) => r.candidateId === event.candidateId) ?? null;
      if (!candidate && !acceptedForCandidate) return state;
      const prev = state.endpointOverrides[event.candidateId] ?? null;
      const base1 = event.sceneP1 ?? prev?.sceneP1 ?? candidate?.sceneP1 ?? acceptedForCandidate?.sceneP1;
      const base2 = event.sceneP2 ?? prev?.sceneP2 ?? candidate?.sceneP2 ?? acceptedForCandidate?.sceneP2;
      if (!base1 || !base2) return state;
      if (!Number.isFinite(base1.x) || !Number.isFinite(base1.y) || !Number.isFinite(base2.x) || !Number.isFinite(base2.y)) {
        return state;
      }
      const override: EndpointOverride = {
        sceneP1: base1,
        sceneP2: base2,
        revision: (prev?.revision ?? 0) + 1,
      };
      const review = candidate ? reviewFor(state, candidate.id) : null;
      const reviews = review
        ? {
            ...state.reviews,
            [candidate!.id]: {
              ...review!,
              // C08: editing an accepted pair excludes its old contribution
              // until the pair is reconfirmed (re-accepted).
              decision: review!.decision === 'accepted' ? 'needs_reconfirmation' : review!.decision,
            },
          }
        : state.reviews;
      return {
        ...state,
        endpointOverrides: { ...state.endpointOverrides, [event.candidateId]: override },
        reviews,
        disagreementAcknowledged: false,
        error: null,
      };
    }

    case 'RESET_ENDPOINTS': {
      if (state.endpointOverrides[event.candidateId] == null) return state;
      const overrides = { ...state.endpointOverrides };
      delete overrides[event.candidateId];
      return { ...state, endpointOverrides: overrides, disagreementAcknowledged: false };
    }

    case 'ACKNOWLEDGE_DISAGREEMENT':
      // C12: explicit "use this average anyway". Presentations gate FINISH on
      // finishBlockers(); the reducer only records the acknowledgement.
      return { ...state, disagreementAcknowledged: true };

    case 'DETACH_REFERENCE': {
      // C09 rule 3 (spec §7.4): "use as a different/manual reference" — the
      // repaired span no longer belongs to the AI-detected physical
      // reference, so the detector link/label must not verify it.
      const target = state.accepted.find((r) => r.id === event.id);
      if (!target) return state;
      const detached: AcceptedReferenceDraft = {
        ...target,
        source: 'manual',
        candidateId: null,
        referenceId: null,
        candidateRevision: null,
        originalLabelText: null,
        endpointsEdited: true,
      };
      const reviews = { ...state.reviews };
      if (target.candidateId != null && reviews[target.candidateId]) {
        reviews[target.candidateId] = {
          ...reviews[target.candidateId],
          decision: 'skipped',
          rejectedReason: 'wrong_reference',
        };
      }
      return {
        ...state,
        accepted: state.accepted.map((r) => (r.id === event.id ? detached : r)),
        reviews,
        disagreementAcknowledged: false,
      };
    }

    default: {
      const never: never = event;
      return state || never;
    }
  }
}

/** Convenience for building a candidate in tests/mocks. */
export function makeCandidate(overrides: Partial<CalibrationCandidate> & { id: string }): CalibrationCandidate {
  const p1 = overrides.sceneP1 ?? { x: 0, y: 0 };
  const p2 = overrides.sceneP2 ?? { x: 100, y: 0 };
  return {
    id: overrides.id,
    referenceId: overrides.referenceId ?? `phys-${overrides.id}`,
    revision: overrides.revision ?? 1,
    searchRound: overrides.searchRound ?? 0,
    imageRevision: overrides.imageRevision ?? 'rev-1',
    sourceType: overrides.sourceType ?? 'dimension_line',
    sourceP1: overrides.sourceP1 ?? p1,
    sourceP2: overrides.sourceP2 ?? p2,
    sceneP1: p1,
    sceneP2: p2,
    scenePixelLength:
      overrides.scenePixelLength ?? Math.hypot(p2.x - p1.x, p2.y - p1.y),
    sourceLabelText: overrides.sourceLabelText ?? null,
    suggestedDistance: overrides.suggestedDistance ?? null,
    suggestedUnit: overrides.suggestedUnit ?? null,
    valueState: overrides.valueState ?? 'readable',
    endpointConfidence: overrides.endpointConfidence ?? 0.9,
    valueConfidence: overrides.valueConfidence ?? 0.9,
    evidence: overrides.evidence ?? {
      labelBox: null,
      unitEvidenceBox: null,
      endpointDescription: 'mock',
      analysisImageIds: [],
    },
    warnings: overrides.warnings ?? [],
  };
}
