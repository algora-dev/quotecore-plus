'use client';
// React adapter around the pure calibrationSession reducer (Phase P6: LIVE
// search). The controller composes authenticated requests against
// /api/takeoff/calibration, enforces the replay-safe retry contract (spec 12.4:
// network recovery reuses the SAME requestId; terminal technical failure retry
// would use a NEW requestId linked via retryOf) and maps server candidates into
// the workstation scene frame before applying SEARCH_SUCCEEDED (the reducer's
// context guard then rejects anything stale).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  calibrationSessionReducer,
  selectActiveCandidate,
  selectDraftEffectiveCalibration,
  selectRescanRemaining,
  selectUnfinishedCount,
  validAcceptedReferences,
  type CalibrationSessionEvent,
  type CalibrationSessionState,
  type SearchStrategy,
} from '@/app/lib/takeoff/calibrationSession';
import {
  CalibrationApiError,
  mapCandidatesToClientFrame,
  type CalibrationSearchRequestBody,
  type CalibrationSearchResponse,
} from '@/app/lib/takeoff/calibrationApiClientCore';
import { calibrationSearch, newCalibrationRequestId } from './calibrationApiClient';
import { toCommitResult, type CalibrationCommitResult } from '@/app/lib/takeoff/calibrationCommit';
import type {
  AcceptedReferenceDraft,
  CalibrationImageDescriptor,
  WorkingUnit,
} from '@/app/lib/takeoff/calibrationTypes';

export type CalibrationSearchExecutor = typeof calibrationSearch;

/** How a controller session should start (P0-6/6.1 audit 2026-09-20).
 *  - new: fresh calibration on an uncalibrated page.
 *  - replace: recalibrate a calibrated page; the committed calibration stays
 *    active until the replacement commit succeeds (draft-until-commit, 6.2).
 *  - edit: reopen a calibrated page with its committed references preloaded
 *    as accepted drafts so the user can adjust/reconfirm them. */
export type CalibrationStartMode =
  | { kind: 'new' }
  | { kind: 'replace' }
  | { kind: 'edit'; initialAccepted: AcceptedReferenceDraft[] };

/** Pure mapping from a start mode to the reducer's start event. Exported for
 *  regression tests of the controller's session-start contract (6.1). */
export function initialCalibrationStartEvent(
  mode: CalibrationStartMode,
  quoteId: string,
  image: CalibrationImageDescriptor,
): CalibrationSessionEvent {
  switch (mode.kind) {
    case 'replace':
      return { type: 'START_REPLACE', quoteId, image, baseCalibrationRevision: 0 };
    case 'edit':
      return {
        type: 'START_EDIT',
        quoteId,
        image,
        baseCalibrationRevision: 0,
        initialAccepted: mode.initialAccepted,
      };
    default:
      return { type: 'START_NEW', quoteId, image, baseCalibrationRevision: 0 };
  }
}

export interface UseCalibrationControllerOptions {
  quoteId: string;
  image: CalibrationImageDescriptor;
  workingUnit: WorkingUnit;
  /** Injectable for tests; defaults to the real fetch wrapper. */
  searchExecutor?: CalibrationSearchExecutor;
  /** Session start mode (6.1): new, replace (draft-until-commit recalibration)
   *  or edit (committed references preloaded as drafts). Defaults to new. */
  startMode?: CalibrationStartMode;
  /** Called with the accepted set when the user finishes. MUST return an
   *  explicit commit result; the controller dispatches COMMIT_SUCCEEDED only
   *  on ok:true and keeps the review session (accepted references and
   *  candidates) alive on failure so the user can retry the save without
   *  another AI search (P0-4). */
  onFinish: (accepted: readonly AcceptedReferenceDraft[]) => Promise<CalibrationCommitResult> | CalibrationCommitResult;
  onCancel: () => void;
  /** M4 (mobile spec §7.1): when false the initial search is NOT armed on
   *  mount — the touch presentation requires a deliberate "Find with AI"
   *  press so credits are never auto-spent by entering touch view. Defaults
   *  true (desktop behaviour unchanged). */
  autoStart?: boolean;
}

export interface CalibrationSearchOutcome {
  status: 'candidates' | 'no_candidates' | 'unsuitable_image';
  notes: string[];
}

export interface CalibrationController {
  state: CalibrationSessionState;
  dispatch: (event: CalibrationSessionEvent) => void;
  /** Draft summaries derived via selectors. */
  activeCandidate: ReturnType<typeof selectActiveCandidate>;
  draftEffective: ReturnType<typeof selectDraftEffectiveCalibration>;
  validAccepted: AcceptedReferenceDraft[];
  unfinishedCount: number;
  rescanRemaining: 0 | 1;
  /** Last completed search outcome (drives empty/unsuitable copy, spec 4.6). */
  lastSearch: CalibrationSearchOutcome | null;
  /** Retry classification of the most recent failure (drives the retry button). */
  lastFailure: { recoverable: boolean; code: string | null } | null;
  /** Authoritative server image revision from the most recent successful
   *  search response (never a client-fabricated value). Null before the first
   *  success (P0-6). */
  serverImageRevision: string | null;
  /** Starts the initial search or the armed rescan. */
  startSearch: () => void;
  /** Network recovery: re-issues the SAME requestId (spec 12.4). */
  retrySearch: () => void;
}

const IDLE_UNINITIALISED: CalibrationSessionState = {
  phase: 'idle',
  mode: 'new',
  sessionId: null,
  requestId: null,
  contextEpoch: 0,
  image: {} as CalibrationImageDescriptor,
  baseCalibrationRevision: 0,
  searchRoundsCompleted: 0,
  candidates: [],
  reviews: {},
  accepted: [],
  activeCandidateId: null,
  error: null,
  quoteId: '',
  pendingRound: null,
  searchStrategy: null,
  refineReferenceId: null,
  endpointOverrides: {},
  manualDraft: null,
  disagreementAcknowledged: false,
};

export function useCalibrationController(options: UseCalibrationControllerOptions): CalibrationController {
  const { quoteId, image, workingUnit, onFinish, onCancel } = options;
  const searchExecutor = options.searchExecutor ?? calibrationSearch;
  const startMode = options.startMode ?? { kind: 'new' } as CalibrationStartMode;

  const [state, rawDispatch] = useReducer(calibrationSessionReducer, IDLE_UNINITIALISED);
  const autoStart = options.autoStart ?? true;

  // Start the session lazily on first mount so the controller can be rendered
  // unconditionally by the panel (flag already gated by the parent). The start
  // event reflects the requested session mode (6.1: new/replace/edit).
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    rawDispatch(initialCalibrationStartEvent(startMode, quoteId, image));
  }

  const abortRef = useRef<AbortController | null>(null);
  const [searchTick, setSearchTick] = useState(1); // 1 = auto-start the initial search on mount
  const [lastSearch, setLastSearch] = useState<CalibrationSearchOutcome | null>(null);
  const [lastFailure, setLastFailure] = useState<{ recoverable: boolean; code: string | null } | null>(null);
  const [serverImageRevision, setServerImageRevision] = useState<string | null>(null);

  // Round-1 authorisation minted by a successful round-0 search (server HMAC token).
  const roundTokenRef = useRef<string | undefined>(undefined);
  // Authoritative server image revision (consistency guard across responses).
  const serverRevisionRef = useRef<string | null>(null);
  // Physical references the user skipped/rejected (excluded from find-different rescans).
  const excludedRefIdsRef = useRef<readonly string[]>([]);
  // Replay-safe retry (spec 12.4): network recovery reuses the SAME requestId.
  const retryArmRef = useRef<{ strategy: SearchStrategy; requestId: string } | null>(null);

  // P0-2 (calibration hardening audit 2026-09-20): track the session image's
  // pageId/revision. If the mounted panel is ever reused across a page or
  // image change, abort the in-flight fetch, reset round/exclusion/retry
  // bookkeeping and dispatch the matching reducer invalidation event so
  // candidates/reviews never cross images.
  const imagePageIdRef = useRef(image.pageId);
  const imageRevisionRef = useRef(image.imageRevision);
  const imageFrameKeyRef = useRef(image.frameKey);
  useEffect(() => {
    const pageChanged = imagePageIdRef.current !== image.pageId;
    const imageChanged =
      imageFrameKeyRef.current !== image.frameKey ||
      (image.imageRevision != null && imageRevisionRef.current !== image.imageRevision);
    if (!pageChanged && !imageChanged) return;
    imagePageIdRef.current = image.pageId;
    imageRevisionRef.current = image.imageRevision;
    imageFrameKeyRef.current = image.frameKey;
    abortRef.current?.abort();
    roundTokenRef.current = undefined;
    serverRevisionRef.current = null;
    excludedRefIdsRef.current = [];
    retryArmRef.current = null;
    setServerImageRevision(null);
    rawDispatch({ type: pageChanged ? 'PAGE_CHANGED' : 'IMAGE_CHANGED' });
  }, [image.pageId, image.imageRevision, image.frameKey]);

  // Dispose any in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const dispatch = useCallback((event: CalibrationSessionEvent) => {
    if (event.type === 'CANCEL' || event.type === 'PAGE_CHANGED' || event.type === 'IMAGE_CHANGED') {
      abortRef.current?.abort();
      onCancel();
    }
    if (event.type === 'REQUEST_RESCAN') {
      // A fresh deliberate search supersedes any armed failure-retry (spec 12.4:
      // only network recovery of the SAME attempt reuses its requestId).
      retryArmRef.current = null;
      rawDispatch(event);
      setSearchTick((t) => t + 1);
      return;
    }
    rawDispatch(event);
  }, [onCancel]);

  // LIVE search lifecycle. Captured context (requestId + reducer state at start)
  // is revalidated by the reducer's SEARCH_SUCCEEDED guard; stale completions
  // are dropped even if abort failed to stop the server request.
  useEffect(() => {
    const st = state;
    if (!autoStart && searchTick === 1) return; // deliberate search only (M4/§7.1)
    const retryArm = retryArmRef.current;
    retryArmRef.current = null;
    const armed: SearchStrategy | null =
      retryArm?.strategy ??
      st.searchStrategy ??
      (st.phase === 'idle' && st.searchRoundsCompleted === 0 ? 'initial' : null);
    if (armed == null) return;
    if (retryArm == null && st.phase !== 'reviewing' && st.phase !== 'idle') return;
    if (st.phase === 'searching') return;

    const round = (st.searchRoundsCompleted === 0 ? 0 : 1) as 0 | 1;
    const requestId = retryArm?.requestId ?? newCalibrationRequestId();
    const context = {
      quoteId: st.quoteId,
      pageId: st.image.pageId,
      frameKey: st.image.frameKey,
      sessionId: st.sessionId,
      requestId,
      contextEpoch: st.contextEpoch,
    };
    rawDispatch({ type: 'SEARCH_STARTED', context, round, strategy: armed });

    // Find-different rescans exclude EVERY previously displayed physical
    // reference (P1-10, Phase E audit 2026-09-20) - not just explicitly
    // skipped ones - plus accepted references (they stay preserved in the
    // accepted set and are never re-proposed). Server-side matching is
    // geometry-tolerant, so small coordinate jitter still matches.
    const excluded = armed === 'different_references' ? excludedRefIdsRef.current : [];
    // P1-9: targeted refine echoes the server-signed candidate token bound to
    // the original geometry; the quantised referenceId stays as a legacy
    // fallback only.
    const refineCandidate = armed === 'refine_reference' && st.refineReferenceId
      ? st.candidates.find((c) => c.referenceId === st.refineReferenceId)
      : null;
    const refineTokens = refineCandidate?.refineToken ? [refineCandidate.refineToken] : undefined;
    const refineIds = armed === 'refine_reference' && st.refineReferenceId && !refineTokens ? [st.refineReferenceId] : undefined;

    const body: CalibrationSearchRequestBody = {
      action: armed === 'refine_reference' ? 'refine' : 'search',
      quoteId: st.quoteId,
      pageId: st.image.pageId,
      round,
      strategy: armed,
      requestId,
      ...(round === 1 && roundTokenRef.current ? { roundToken: roundTokenRef.current } : {}),
      ...(excluded.length > 0 ? { excludeReferenceIds: excluded } : {}),
      ...(refineTokens ? { refineTokens } : {}),
      ...(refineIds ? { refineReferenceIds: refineIds } : {}),
    };

    const abort = new AbortController();
    abortRef.current = abort;
    let cancelled = false;
    searchExecutor(body, abort.signal)
      .then((response: CalibrationSearchResponse) => {
        if (cancelled || abort.signal.aborted) return;

        // Consistency: the server's immutable image revision must be stable
        // across this session's responses for the mapped candidates to be valid.
        if (serverRevisionRef.current == null) {
          serverRevisionRef.current = response.imageRevision;
        } else if (serverRevisionRef.current !== response.imageRevision) {
          rawDispatch({
            type: 'SEARCH_FAILED',
            code: 'IMAGE_REVISION_CHANGED',
            message: 'The plan image changed during the search. Cancel and reload the page, then try again.',
            requestId,
          });
          return;
        }

        // Round-0 success mints the single round-1 authorisation.
        if (response.roundToken) roundTokenRef.current = response.roundToken;
        // P0-6: surface the authoritative server revision to the commit path
        // (metadata envelope) - never a client-fabricated value.
        setServerImageRevision(response.imageRevision);

        let candidates = response.candidates;
        if (candidates.length > 0) {
          if (response.sourceWidth == null || response.sourceHeight == null) {
            rawDispatch({
              type: 'SEARCH_FAILED',
              code: 'INVALID_RESPONSE',
              message: 'The search result could not be mapped onto this plan. Try the search again or calibrate manually.',
              requestId,
            });
            return;
          }
          const mapped = mapCandidatesToClientFrame(
            candidates,
            { width: response.sourceWidth, height: response.sourceHeight },
            st.image,
          );
          if (!mapped.ok) {
            rawDispatch({
              type: 'SEARCH_FAILED',
              code: mapped.reason,
              message: 'The plan image on screen does not match the analysed source. Reload the page, then try again.',
              requestId,
            });
            return;
          }
          candidates = mapped.candidates;
        }

        setLastFailure(null);
        setLastSearch({ status: response.status, notes: response.notes });
        rawDispatch({ type: 'SEARCH_SUCCEEDED', context, round, candidates });
      })
      .catch((err: unknown) => {
        if (cancelled || abort.signal.aborted) return;
        const isApi = err instanceof CalibrationApiError;
        const message = isApi ? err.message : err instanceof Error ? err.message : 'search failed';
        const code = isApi && err.code ? err.code : 'SEARCH_ERROR';
        const recoverable = isApi ? err.classification.recoverable : false;
        if (recoverable) {
          // Arm a replay-safe retry with the SAME requestId (spec 12.4).
          retryArmRef.current = { strategy: armed, requestId };
        }
        setLastFailure({ recoverable, code });
        rawDispatch({ type: 'SEARCH_FAILED', code, message, requestId });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTick, searchExecutor, autoStart]);

  // P1-10 (Phase E audit 2026-09-20): accumulate EVERY displayed physical
  // reference (reviewed or not) plus accepted references into the exclusion
  // set for later find-different rescans. A displayed-but-unreviewed
  // reference must not come back as a "different" one, and accepted
  // references stay in the accepted set, never re-proposed.
  useEffect(() => {
    const displayed = state.candidates.map((c) => c.referenceId);
    const accepted = state.accepted
      .map((a) => a.referenceId)
      .filter((v): v is string => typeof v === 'string');
    if (displayed.length + accepted.length > 0) {
      excludedRefIdsRef.current = [...new Set([...excludedRefIdsRef.current, ...displayed, ...accepted])];
    }
  }, [state.candidates, state.accepted]);

  // P0-4 (calibration hardening audit 2026-09-20): await parent persistence
  // before reporting success. COMMIT_SUCCEEDED is dispatched ONLY when the
  // parent's onFinish resolves { ok: true }; any failure/throw dispatches
  // COMMIT_FAILED, which returns the reducer to 'reviewing' with the accepted
  // references and candidates preserved - retrying the save re-enters
  // 'committing' with the SAME accepted set, no new AI search. The review
  // session is never closed before persistence succeeds.
  const commitInFlightRef = useRef(false);
  useEffect(() => {
    if (state.phase !== 'committing' || commitInFlightRef.current) return;
    let cancelled = false;
    commitInFlightRef.current = true;
    Promise.resolve(onFinish(validAcceptedReferences(state)))
      .then((result) => {
        if (cancelled) return;
        commitInFlightRef.current = false;
        const normalised = toCommitResult(result);
        if (normalised.ok) {
          rawDispatch({ type: 'COMMIT_SUCCEEDED' });
        } else {
          rawDispatch({ type: 'COMMIT_FAILED', code: normalised.code, message: normalised.message });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        commitInFlightRef.current = false;
        const normalised = toCommitResult(err);
        if (!normalised.ok) {
          rawDispatch({ type: 'COMMIT_FAILED', code: normalised.code, message: normalised.message });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const retrySearch = useCallback(() => {
    if (retryArmRef.current == null) return;
    setSearchTick((t) => t + 1);
  }, []);

  return useMemo(
    () => ({
      state,
      dispatch,
      activeCandidate: selectActiveCandidate(state),
      draftEffective: selectDraftEffectiveCalibration(state, workingUnit),
      validAccepted: validAcceptedReferences(state),
      unfinishedCount: selectUnfinishedCount(state),
      rescanRemaining: selectRescanRemaining(state),
      lastSearch,
      lastFailure,
      serverImageRevision,
      startSearch: () => setSearchTick((t) => t + 1),
      retrySearch,
    }),
    [state, dispatch, workingUnit, lastSearch, lastFailure, serverImageRevision, retrySearch],
  );
}
