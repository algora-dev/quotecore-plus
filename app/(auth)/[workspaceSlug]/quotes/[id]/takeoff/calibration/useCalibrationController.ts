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
import type {
  AcceptedReferenceDraft,
  CalibrationImageDescriptor,
  WorkingUnit,
} from '@/app/lib/takeoff/calibrationTypes';

export type CalibrationSearchExecutor = typeof calibrationSearch;

export interface UseCalibrationControllerOptions {
  quoteId: string;
  image: CalibrationImageDescriptor;
  workingUnit: WorkingUnit;
  /** Injectable for tests; defaults to the real fetch wrapper. */
  searchExecutor?: CalibrationSearchExecutor;
  /** Called with the accepted set when the user finishes (commit orchestration is P6). */
  onFinish: (accepted: readonly AcceptedReferenceDraft[]) => void;
  onCancel: () => void;
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
};

export function useCalibrationController(options: UseCalibrationControllerOptions): CalibrationController {
  const { quoteId, image, workingUnit, onFinish, onCancel } = options;
  const searchExecutor = options.searchExecutor ?? calibrationSearch;

  const [state, rawDispatch] = useReducer(calibrationSessionReducer, IDLE_UNINITIALISED);

  // Start the session lazily on first mount so the controller can be rendered
  // unconditionally by the panel (flag already gated by the parent).
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    rawDispatch({ type: 'START_NEW', quoteId, image, baseCalibrationRevision: 0 });
  }

  const abortRef = useRef<AbortController | null>(null);
  const [searchTick, setSearchTick] = useState(1); // 1 = auto-start the initial search on mount
  const [lastSearch, setLastSearch] = useState<CalibrationSearchOutcome | null>(null);
  const [lastFailure, setLastFailure] = useState<{ recoverable: boolean; code: string | null } | null>(null);

  // Round-1 authorisation minted by a successful round-0 search (server HMAC token).
  const roundTokenRef = useRef<string | undefined>(undefined);
  // Authoritative server image revision (consistency guard across responses).
  const serverRevisionRef = useRef<string | null>(null);
  // Physical references the user skipped/rejected (excluded from find-different rescans).
  const excludedRefIdsRef = useRef<readonly string[]>([]);
  // Replay-safe retry (spec 12.4): network recovery reuses the SAME requestId.
  const retryArmRef = useRef<{ strategy: SearchStrategy; requestId: string } | null>(null);

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
      imageRevision: st.image.imageRevision,
      sessionId: st.sessionId,
      requestId,
      contextEpoch: st.contextEpoch,
    };
    rawDispatch({ type: 'SEARCH_STARTED', context, round, strategy: armed });

    // Find-different rescans exclude every physical reference the user skipped
    // in this session (spec 7.2: do not turn every displayed candidate into a
    // rejection; only explicit skips are excluded).
    const excluded = armed === 'different_references' ? excludedRefIdsRef.current : [];
    const refineIds = armed === 'refine_reference' && st.refineReferenceId ? [st.refineReferenceId] : undefined;

    const body: CalibrationSearchRequestBody = {
      action: armed === 'refine_reference' ? 'refine' : 'search',
      quoteId: st.quoteId,
      pageId: st.image.pageId,
      round,
      strategy: armed,
      requestId,
      ...(round === 1 && roundTokenRef.current ? { roundToken: roundTokenRef.current } : {}),
      ...(excluded.length > 0 ? { excludeReferenceIds: excluded } : {}),
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
  }, [searchTick, searchExecutor]);

  // Track skipped physical references for later find-different exclusion.
  useEffect(() => {
    const skipped = state.candidates
      .filter((c) => state.reviews[c.id]?.decision === 'skipped')
      .map((c) => c.referenceId);
    if (skipped.length > 0) {
      const merged = new Set([...excludedRefIdsRef.current, ...skipped]);
      excludedRefIdsRef.current = [...merged];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reviews]);

  // Wire completion: when the reducer reaches 'committing', hand the accepted set
  // to the parent (atomic persistence orchestration stays with the workstation).
  useEffect(() => {
    if (state.phase === 'committing') {
      onFinish(validAcceptedReferences(state));
      rawDispatch({ type: 'COMMIT_SUCCEEDED' });
    }
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
      startSearch: () => setSearchTick((t) => t + 1),
      retrySearch,
    }),
    [state, dispatch, workingUnit, lastSearch, lastFailure, retrySearch],
  );
}
