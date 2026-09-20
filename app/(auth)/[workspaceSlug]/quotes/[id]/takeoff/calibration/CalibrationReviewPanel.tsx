'use client';
// Candidate review panel (spec 4.2-4.6): numbered selectors (select only, never
// accept), active review with overlay crosshairs, strict distance/unit entry,
// accept-and-finish vs accept-and-check-another vs finish-already-accepted,
// skip, one deliberate rescan, disagreement warning, estimate framing.
// P6: LIVE search via the authenticated calibration API client; real evidence
// crops rendered from the immutable source image.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Canvas } from 'fabric';
import type { RefObject } from 'react';
import type {
  AcceptedReferenceDraft,
  CalibrationImageDescriptor,
  DistanceUnit,
  WorkingUnit,
} from '@/app/lib/takeoff/calibrationTypes';
import { evidenceCropsForDisplay } from '@/app/lib/takeoff/calibrationApiClientCore';
import { useCalibrationController, type CalibrationStartMode } from './useCalibrationController';
import type { CalibrationCommitResult } from '@/app/lib/takeoff/calibrationCommit';
import { disposeCalibrationOverlay, renderCalibrationOverlay } from './calibrationOverlay';
import { CalibrationEvidenceZoom } from './CalibrationEvidenceZoom';

const UNIT_OPTIONS: readonly DistanceUnit[] = ['m', 'cm', 'mm', 'ft', 'in', 'yd'];

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed';
const btnAccent =
  'inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed';

/** A page without a server-stored image (still local/unsaved) cannot run AI search. */
function isLocalPage(pageId: string): boolean {
  return pageId.startsWith('local-');
}

export function CalibrationReviewPanel({
  quoteId,
  image,
  workingUnit,
  fabricRef,
  startMode,
  onComplete,
  onCancel,
  onSwitchToManual,
}: {
  quoteId: string;
  image: CalibrationImageDescriptor;
  workingUnit: WorkingUnit;
  fabricRef: RefObject<Canvas | null>;
  /** Session start mode (6.1): new (uncalibrated page), replace (draft-until-commit
   *  recalibration) or edit (committed references preloaded as drafts). */
  startMode?: CalibrationStartMode;
  /** Commit context handed back with the accepted set. imageRevision is the
   *  authoritative server revision from the search response (P0-6) - the
   *  metadata envelope must carry it, never a client-fabricated value. */
  onComplete: (
    accepted: readonly AcceptedReferenceDraft[],
    workingUnit: WorkingUnit,
    context: { serverImageRevision: string | null },
  ) => Promise<CalibrationCommitResult> | CalibrationCommitResult;
  onCancel: () => void;
  onSwitchToManual: () => void;
}) {
  // P0-6/P0-4: the controller captures onFinish once at mount; delegate to the
  // latest handleFinish through a ref so commits always use current state.
  const onFinishLatestRef = useRef<
    (accepted: readonly AcceptedReferenceDraft[]) => Promise<CalibrationCommitResult>
  >(async () => {
    throw new Error('CalibrationReviewPanel: onFinish invoked before mount completed');
  });

  const controller = useCalibrationController({
    quoteId,
    image,
    workingUnit,
    startMode,
    onFinish: (accepted) => onFinishLatestRef.current(accepted),
    onCancel: useCallback(() => {
      disposeCalibrationOverlay(fabricRef.current);
      onCancel();
    }, [fabricRef, onCancel]),
  });

  const { state, dispatch, activeCandidate, draftEffective, validAccepted, rescanRemaining, lastSearch, lastFailure, retrySearch, serverImageRevision } = controller;
  // Latest authoritative server revision reachable by the memoised handleFinish
  // (P0-6).
  const serverRevisionRef = useRef(serverImageRevision);
  serverRevisionRef.current = serverImageRevision;

  const handleFinish = useCallback(
    async (accepted: readonly AcceptedReferenceDraft[]): Promise<CalibrationCommitResult> => {
      const result = await onComplete(accepted, workingUnit, {
        serverImageRevision: serverRevisionRef.current,
      });
      // P0-4: only tear the canvas overlay down once persistence has actually
      // succeeded. On failure the reducer returns to 'reviewing' and the
      // overlay re-renders for the retry.
      if (result && result.ok) {
        disposeCalibrationOverlay(fabricRef.current);
      }
      return result;
    },
    [fabricRef, onComplete, workingUnit],
  );
  onFinishLatestRef.current = handleFinish;

  const activeReview = activeCandidate ? state.reviews[activeCandidate.id] : undefined;
  const workingLabel = workingUnit === 'meters' ? 'm' : 'ft';

  // Render the whole candidate set + selection state whenever review state changes.
  const overlayKey = JSON.stringify({
    c: state.candidates.map((c) => c.id),
    a: state.activeCandidateId,
    r: Object.entries(state.reviews).map(([k, v]) => [k, v.decision]),
    acc: state.accepted.map((a) => a.candidateId),
  });
  useEffect(() => {
    if (state.phase !== 'searching') {
      renderCalibrationOverlay(fabricRef.current, {
        candidates: state.candidates,
        activeCandidateId: state.activeCandidateId,
        reviews: state.reviews,
        acceptedCandidateIds: new Set(
          state.accepted
            .filter((a) => a.candidateId != null)
            .map((a) => a.candidateId as string),
        ),
      });
    }
    if (state.phase === 'completed' || state.phase === 'cancelled') {
      disposeCalibrationOverlay(fabricRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey, state.phase]);

  const candidateBadges = useMemo(
    () =>
      state.candidates.map((c, i) => {
        const decision = state.reviews[c.id]?.decision ?? 'unreviewed';
        const label =
          decision === 'accepted' ? 'accepted' : decision === 'skipped' ? 'skipped' : 'review';
        const active = state.activeCandidateId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => dispatch({ type: 'SELECT_CANDIDATE', candidateId: c.id })}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
              active
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {i + 1} · {label}
          </button>
        );
      }),
    [state.candidates, state.reviews, state.activeCandidateId, dispatch],
  );

  // Unavailable without a server page image: honest guidance + manual fallback (spec 4.6).
  if (isLocalPage(image.pageId)) {
    return (
      <div className="fixed top-24 right-4 bottom-24 w-80 z-30 bg-white rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">AI calibration</h3>
        </div>
        <div className="flex-1 px-4 py-4">
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6">
            <p className="text-sm text-slate-500">
              This page has no stored source image yet, so AI search is unavailable.
              Save the quote page first, or calibrate manually below.
            </p>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button type="button" className={btnGhost} onClick={onSwitchToManual}>
            Calibrate manually
          </button>
        </div>
      </div>
    );
  }

  const needsDistance = activeCandidate != null && activeCandidate.suggestedDistance == null;
  const enteredDistance = activeReview?.enteredDistance ?? '';
  const enteredUnit = activeReview?.enteredUnit ?? activeCandidate?.suggestedUnit ?? null;
  const activeDecision = activeCandidate ? state.reviews[activeCandidate.id]?.decision ?? 'unreviewed' : null;
  const canRefineActive = activeCandidate != null && activeDecision === 'skipped' && rescanRemaining > 0 && state.accepted.length < 3;
  const crops = evidenceCropsForDisplay(activeCandidate);

  // Spec 4.6 copy: distinguish an empty-but-valid search from an unsuitable image.
  const emptyCopy =
    lastSearch?.status === 'unsuitable_image'
      ? lastSearch.notes[0] ||
        'This image does not appear to support a single measurement scale (for example a perspective photo or a mixed-scale sheet). Use a top-down scan or a crop of the correct view, or calibrate manually.'
      : 'No usable measurement endpoints found. Try one more search, calibrate manually, or use a clearer image with an explicit distance.';

  return (
    <div className="fixed top-24 right-4 bottom-24 w-80 z-30 bg-white rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
          AI calibration
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Check the markers against the plan before accepting. Each search uses 1 AI Assist point.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {state.phase === 'searching' && (
          <p className="text-sm text-slate-600">Finding clear measurement endpoints...</p>
        )}

        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
            <p className="text-sm text-red-700">{state.error.message}</p>
            {lastFailure?.recoverable && state.phase === 'reviewing' && (
              <button type="button" className={btnGhost} onClick={retrySearch}>
                Retry search
              </button>
            )}
            {(state.error.code === 'REQUEST_CONFLICT' || lastFailure && !lastFailure.recoverable) && (
              <button type="button" className={btnGhost} onClick={onSwitchToManual}>
                Calibrate manually
              </button>
            )}
          </div>
        )}

        {state.phase !== 'searching' && state.candidates.length === 0 && !state.error && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 space-y-3">
            <p className="text-sm text-slate-500">{emptyCopy}</p>
            <div className="flex flex-col gap-2">
              {rescanRemaining > 0 && state.accepted.length < 3 && (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => dispatch({ type: 'REQUEST_RESCAN', strategy: 'different_references' })}
                >
                  Search again - {rescanRemaining} remaining
                </button>
              )}
              <button type="button" className={btnGhost} onClick={onSwitchToManual}>
                Calibrate manually
              </button>
            </div>
          </div>
        )}

        {state.candidates.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">{candidateBadges}</div>

            {activeCandidate && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">
                  Are these markers on the two ends of this measurement?
                </p>
                {needsDistance ? (
                  <p className="text-sm text-slate-500">
                    I found the measurement endpoints, but could not read the distance.
                    Enter the distance shown between these points and choose its unit.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    AI read: <span className="font-semibold text-slate-700">
                      {activeCandidate.suggestedDistance} {activeCandidate.suggestedUnit}
                    </span>
                    . Check the printed distance, or correct it below.
                  </p>
                )}

                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    value={enteredDistance}
                    onChange={(e) =>
                      dispatch({
                        type: 'EDIT_DISTANCE',
                        candidateId: activeCandidate.id,
                        value: e.target.value,
                      })
                    }
                    placeholder={needsDistance ? 'e.g. 6.42' : String(activeCandidate.suggestedDistance)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none"
                  />
                  <select
                    value={enteredUnit ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'EDIT_UNIT',
                        candidateId: activeCandidate.id,
                        unit: (e.target.value || null) as DistanceUnit | null,
                      })
                    }
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">unit</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <CalibrationEvidenceZoom crops={crops} />

                <div className="space-y-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => dispatch({ type: 'ACCEPT_AND_FINISH' })}
                  >
                    Accept &amp; start measuring
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => dispatch({ type: 'ACCEPT_CURRENT' })}
                    disabled={state.accepted.length >= 3}
                  >
                    Accept &amp; check another
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => dispatch({ type: 'SKIP_CURRENT', reason: 'endpoints' })}
                  >
                    Skip - points are wrong
                  </button>
                </div>
              </div>
            )}

            {validAccepted.length > 0 && draftEffective && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
                <p className="text-sm text-slate-700">
                  Estimated scale:{' '}
                  <span className="font-semibold">
                    {draftEffective.scale.toFixed(4)} {workingLabel}/px
                  </span>{' '}
                  from {draftEffective.validCalibrationCount} accepted measurement
                  {draftEffective.validCalibrationCount > 1 ? 's' : ''}. This is an
                  estimate - check it against the plan before pricing.
                </p>
                {draftEffective.disagreementWarning && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {draftEffective.disagreementWarning}
                  </p>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    className={btnAccent}
                    onClick={() => dispatch({ type: 'FINISH_ACCEPTED' })}
                  >
                    Use {validAccepted.length} accepted measurement
                    {validAccepted.length > 1 ? 's' : ''}
                  </button>
                  {state.accepted.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <span className="text-xs text-slate-600">
                        {ref.confirmedDistance} {ref.confirmedUnit}
                        {ref.source === 'manual' ? ' · manual' : ''}
                        {state.reviews[ref.candidateId ?? '']?.decision === 'needs_reconfirmation'
                          ? ' · needs reconfirmation'
                          : ''}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-slate-500 underline hover:text-slate-800"
                        onClick={() => dispatch({ type: 'REMOVE_ACCEPTED', id: ref.id })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-3">
              {state.accepted.length < 3 && (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={rescanRemaining === 0}
                  onClick={() =>
                    dispatch({ type: 'REQUEST_RESCAN', strategy: 'different_references' })
                  }
                >
                  Search again - {rescanRemaining} remaining
                </button>
              )}
              {canRefineActive && activeCandidate && (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() =>
                    dispatch({
                      type: 'REQUEST_RESCAN',
                      strategy: 'refine_reference',
                      refineReferenceId: activeCandidate.referenceId,
                    })
                  }
                >
                  Improve these points
                </button>
              )}
              <button type="button" className={btnGhost} onClick={onSwitchToManual}>
                Use manual calibration
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          className={btnGhost}
          onClick={() => dispatch({ type: 'CANCEL' })}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
