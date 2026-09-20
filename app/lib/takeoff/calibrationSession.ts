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
  | { type: 'IMAGE_CHANGED' };

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

  const record: AcceptedReferenceDraft = {
    id: existingIndex >= 0 ? state.accepted[existingIndex].id : `ref-${candidate.id}`,
    source: 'ai_confirmed',
    candidateId: candidate.id,
    referenceId: candidate.referenceId,
    candidateRevision: candidate.revision,
    sceneP1: candidate.sceneP1,
    sceneP2: candidate.sceneP2,
    confirmedDistance: verdict.distance,
    confirmedUnit: verdict.unit,
    originalLabelText: candidate.sourceLabelText,
    valueCorrected: verdict.valueCorrected,
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
  return {
    ...state,
    phase: 'reviewing',
    candidates: shown,
    reviews,
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
    activeCandidateId: null,
    searchStrategy: null,
    refineReferenceId: null,
    error: null,
  };
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
      return { ...state, accepted: state.accepted.filter((r) => r.id !== event.id), reviews };
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
