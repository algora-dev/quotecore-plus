'use client';
// Touch presentation only. The existing calibration controller/reducer owns
// references, unit-normalised averaging, AI review, and the commit boundary.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Point, AcceptedReferenceDraft, DistanceUnit, WorkingUnit } from '../calibrationTypes';
import { calibrationSessionReducer, effectiveCandidateEndpoints, type CalibrationSessionEvent } from '../calibrationSession';
import { decodeCalibrationMetadata } from '../calibrationCodec';
import { commitFailed, commitSucceeded, type CalibrationCommitResult } from '../calibrationCommit';
import { beginEdit, commitMove, previewMove, selectVertex, appendVertex, cancelGesture, undo } from './precisionEditor';
import { HIT_RADIUS_PX } from './precisionGestureMachine';
import { pinchCamera, scenePointToViewport, type Camera } from './sceneViewport';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';
import { useCalibrationController } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/calibration/useCalibrationController';
import { persistPageCalibration } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions';
import { buildCalibrationCommit, calibrationDescriptorFromSource, finishBlockers, manualPairValid, type CalibrationCommitPayload } from './touchCalibration';
import { logTakeoffEvent } from './takeoffDiagnostics';
import { usePrecisionCamera } from './usePrecisionCamera';
import { usePlanRaster } from './usePlanRaster';
import { CalibrationCanvas, type CalibrationSpan } from './CalibrationCanvas';
import { NumericRail } from './NumericRail';
import { PitchControl, RailAction, RailNotice, RailTask, RailViewControls } from './TouchRailControls';
import { canEditCalibrationPoints, canPlaceCalibrationPoint, pointIsOnPlan, type TouchCalibrationStep } from './touchCalibrationFlow';

export interface TouchCalibrationPageInfo {
  id: string; imageRevision: string | null; calibrationMetadata: unknown; scaleCalibration: unknown;
}
export interface UseTouchCalibrationOptions {
  active: boolean; quoteId: string; planUrl: string; page: TouchCalibrationPageInfo | null;
  aiEnabled: boolean; pageHasDependents: boolean; onExit: () => void;
  defaultWorkingUnit: WorkingUnit;
  pitch: number; onPitchChange: (pitch: number) => void;
  onCommitted: (pageId: string, payload: CalibrationCommitPayload) => void;
}
export interface TouchCalibrationParts {
  overlay: ReactNode; rail: ReactNode; bottom: ReactNode; saved: boolean; wideRail: boolean; busy: boolean;
  exitGuard: { dirty: boolean; onSave: () => void; onDiscard: () => void; saveLabel?: string };
}
const UNITS: DistanceUnit[] = ['m', 'mm', 'cm', 'ft', 'in', 'yd'];

export function useTouchCalibration(options: UseTouchCalibrationOptions): TouchCalibrationParts {
  const { active, quoteId, planUrl, page, aiEnabled, pageHasDependents, onExit, pitch, onPitchChange } = options;
  // Keyboardless fix (2026-09-22): the shared controller treats a CHANGED
  // imageRevision as IMAGE_CHANGED and invalidates the session (wiping accepted
  // references). On touch, the only mid-session revision change is the server
  // ACK of THIS session's own commit, so freeze the revision at mount for the
  // descriptor and raster; the ACK is adopted downstream, never re-fed here.
  const sessionRevisionRef = useRef<string | null>(page?.imageRevision ?? null);
  const image = usePlanRaster(active, planUrl, sessionRevisionRef.current);
  const { scene } = image;
  const view = usePrecisionCamera(active, scene, `${page?.id ?? 'loading'}|${planUrl}`);
  const { surfaceRef, camera, cameraRef, setCamera, zoomBounds } = view;
  const [step, setStep] = useState<TouchCalibrationStep>('find');
  const [numberMode, setNumberMode] = useState<'pitch' | null>(null);
  const [pitchText, setPitchText] = useState('');
  const [unitPicker, setUnitPicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState('');
  const existing = useMemo(() => {
    const decoded = decodeCalibrationMetadata(page?.calibrationMetadata ?? page?.scaleCalibration);
    return decoded.kind === 'v1' ? { refs: decoded.metadata.references, workingUnit: decoded.metadata.workingUnit }
      : decoded.kind === 'legacy' ? { refs: decoded.references, workingUnit: decoded.workingUnit ?? options.defaultWorkingUnit }
      : { refs: [], workingUnit: options.defaultWorkingUnit };
  }, [page?.calibrationMetadata, page?.scaleCalibration, options.defaultWorkingUnit]);
  const workingUnit = existing.workingUnit;
  const [unit, setUnit] = useState<DistanceUnit>(workingUnit === 'feet' ? 'ft' : 'm');
  const descriptor = useMemo(() => calibrationDescriptorFromSource({
    pageId: page?.id ?? 'unknown-page', imageRevision: sessionRevisionRef.current,
    frameKey: `${page?.id ?? 'loading'}|${planUrl}|${image.sourceWidth}x${image.sourceHeight}`,
    sourceWidth: image.sourceWidth || 1, sourceHeight: image.sourceHeight || 1,
  }), [page?.id, planUrl, image.sourceWidth, image.sourceHeight]);
  const createPair = useCallback((points: readonly Point[] = []) => beginEdit(
    { kind: 'calibration', referenceDraftId: 'touch-reference' },
    { quoteId, pageId: page?.id ?? 'unknown-page', imageRevision: page?.imageRevision ?? null,
      coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0 }, points, false),
  [quoteId, page?.id, page?.imageRevision]);
  const [pair, setPair] = useState(() => createPair());
  const pairRef = useRef(pair);
  const stepRef = useRef(step);
  const editing = canEditCalibrationPoints(step) && !numberMode && !unitPicker;
  const editingRef = useRef(editing);
  useLayoutEffect(() => { pairRef.current = pair; stepRef.current = step; editingRef.current = editing; });
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const pendingCommit = useRef<Promise<CalibrationCommitResult> | null>(null);
  // Destructured so the compiler can preserve memoization: the callback only
  // needs onCommitted, not the whole options object (recreated each render).
  const { onCommitted } = options;
  const commit = useCallback((accepted: readonly AcceptedReferenceDraft[]): Promise<CalibrationCommitResult> => {
    // Concurrent callers share the actual result, never a fabricated success.
    if (pendingCommit.current) return pendingCommit.current;
    const task = (async () => {
      if (!page) return commitFailed('NO_PAGE', 'The plan is still preparing. Please wait.');
      if (pageHasDependents) return commitFailed('DEPENDENTS_PRESENT', 'This page already has measurements. Recalibrate in Desktop view so they are updated together.');
      try {
        const payload = buildCalibrationCommit(accepted, workingUnit, page.imageRevision ?? '', new Date().toISOString());
        const result = await persistPageCalibration(quoteId, page.id, payload.legacy, payload.metadata);
        if (!result.success) return commitFailed('COMMIT_FAILED', result.error);
        if (result.imageRevision) payload.metadata.imageRevision = result.imageRevision;
        logTakeoffEvent('calibration.commit.succeeded', { pageId: page.id });
        // Adopt the ACKNOWLEDGED scale into the existing workstation before
        // advancing. No refresh race and no second persistence/scale engine.
        onCommitted(page.id, payload);
        return commitSucceeded();
      } catch (error) {
        return commitFailed('COMMIT_FAILED', error instanceof Error ? error.message : 'The calibration could not be saved. Try again.');
      }
    })();
    pendingCommit.current = task;
    void task.finally(() => { pendingCommit.current = null; });
    return task;
  }, [page, pageHasDependents, quoteId, workingUnit, onCommitted]);
  const controller = useCalibrationController({ quoteId, image: descriptor, workingUnit,
    startMode: { kind: 'new' }, autoStart: false, onFinish: commit, onCancel: () => setStep('find') });
  const { state, dispatch } = controller;
  const busy = state.phase === 'committing';
  const saved = state.phase === 'completed';
  const blockers = finishBlockers(state, workingUnit);
  const ready = !!scene && !!page && !!camera && !pageHasDependents;

  // A real image/page replacement invalidates the view draft. A previously
  // unknown page id filling in on first load is not a new image.
  const identity = useRef({ pageId: page?.id ?? null, url: planUrl });
  useEffect(() => {
    const old = identity.current;
    identity.current = { pageId: page?.id ?? null, url: planUrl };
    if (old.url !== planUrl || (old.pageId && page?.id && old.pageId !== page.id)) {
      queueMicrotask(() => {
        setPair(createPair()); setStep('find'); setDistanceText(''); setCandidateId(null); setNumberMode(null); setUnitPicker(false); setLocalError(null);
      });
    }
  }, [page?.id, planUrl, createPair]);
  const selectedIndex = pair.draft.vertices.findIndex((v) => v.id === pair.selection.vertexId);
  const visiblePoints = pair.draft.vertices.map((v) => pair.preview?.vertexId === v.id ? pair.preview.point : v.point);
  const hitMarker = useCallback((point: Point): string | null => {
    if (!editingRef.current || !cameraRef.current || canPlaceCalibrationPoint(stepRef.current, pairRef.current.draft.vertices.length)) return null;
    let best: { id: string; distance: number } | null = null;
    for (const vertex of pairRef.current.draft.vertices) {
      const screen = scenePointToViewport(cameraRef.current, vertex.point);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance <= HIT_RADIUS_PX && (!best || distance < best.distance)) best = { id: vertex.id, distance };
    }
    return best?.id ?? null;
  }, [cameraRef]);
  const env = useMemo(() => ({ hitMarker,
    armedVertexId: () => editingRef.current && pairRef.current.selection.moveArmed ? pairRef.current.selection.vertexId : null,
    canAppend: () => editingRef.current && canPlaceCalibrationPoint(stepRef.current, pairRef.current.draft.vertices.length),
    getCamera: () => cameraRef.current ?? { zoom: 1, tx: 0, ty: 0 },
    getScenePoint: (id: string) => pairRef.current.draft.vertices.find((v) => v.id === id)?.point ?? null,
  }), [hitMarker, cameraRef]);
  const selectPoint = useCallback((index: number) => {
    const id = pairRef.current.draft.vertices[index]?.id;
    if (!id) return;
    setPair((s) => selectVertex(s, id, true).session);
    setStep(index === 0 ? 'start' : 'end'); setLocalError(null);
  }, []);
  const handlers = useMemo(() => ({
    onTapSelect: (id: string) => selectPoint(pairRef.current.draft.vertices.findIndex((v) => v.id === id)),
    onTapPlace: (point: Point) => {
      if (!scene || !pointIsOnPlan(point, scene)) { setLocalError('Tap on the plan, not outside the image.'); return; }
      setLocalError(null); setPair((s) => appendVertex(s, point).session);
    },
    onPreviewMove: (id: string, point: Point) => setPair((s) => previewMove(s, id, point).session),
    onCommitMove: (id: string, point: Point) => {
      if (!scene || !pointIsOnPlan(point, scene)) { setPair((s) => cancelGesture(s).session); setLocalError('Keep the point on the plan. Its previous position is kept.'); return; }
      setLocalError(null); setPair((s) => commitMove(s, id, point).session);
    },
    onRollbackMove: () => setPair((s) => cancelGesture(s).session),
    onOneFingerPan: (total: Point, start: Camera) => setCamera({ ...start, tx: start.tx + total.x, ty: start.ty + total.y }),
    onViewGestureUpdate: (start: { a: Point; b: Point }, current: { a: Point; b: Point }, cam: Camera) => {
      const span = (p: typeof start) => ({ mid: { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 }, distance: Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) });
      if (span(start).distance > 1e-6) setCamera(pinchCamera(cam, span(start), span(current), zoomBounds));
    }, onViewGestureEnd: () => {}, onGestureCancelled: () => {},
  }), [scene, selectPoint, setCamera, zoomBounds]);
  const gesture = usePrecisionPointerInput(active && !!scene && !busy, surfaceRef, handlers, env);
  const midGesture = gesture !== 'idle' && gesture !== 'cancelled';

  const beginReference = () => {
    if (!ready || state.accepted.length >= 3) return;
    // Ready starts a real, fully sized session. The initial placeholder image
    // used by the shared hook is never accepted as calibration geometry.
    if (state.phase === 'idle' || state.phase === 'cancelled' || state.phase === 'completed') {
      dispatch({ type: 'START_NEW', quoteId, image: descriptor, baseCalibrationRevision: 0 });
    }
    dispatch({ type: 'BEGIN_MANUAL_REFERENCE' });
    setPair(createPair()); setStep('start'); setCandidateId(null); setDistanceText(''); setLocalError(null);
  };
  const confirmPoint = () => {
    const index = step === 'start' ? 0 : 1;
    const vertex = pair.draft.vertices[index];
    if (!vertex || midGesture) return;
    setPair((s) => selectVertex(s, vertex.id, false).session);
    if (step === 'start') {
      setStep('end');
      if (pair.draft.vertices[1]) setPair((s) => selectVertex(s, s.draft.vertices[1].id, true).session);
    } else {
      const check = manualPairValid(pair.draft.vertices[0]?.point ?? null, vertex.point);
      if (!check.ok) { setLocalError(check.message); return; }
      setStep('distance');
    }
    setLocalError(null);
  };
  const acceptDistance = () => {
    const [a, b] = pair.draft.vertices;
    if (!a || !b) return;
    if (candidateId) {
      dispatch({ type: 'SELECT_CANDIDATE', candidateId });
      dispatch({ type: 'EDIT_ENDPOINT', candidateId, sceneP1: a.point, sceneP2: b.point });
      dispatch({ type: 'EDIT_DISTANCE', candidateId, value: distanceText });
      dispatch({ type: 'EDIT_UNIT', candidateId, unit });
      dispatch({ type: 'ACCEPT_CURRENT' });
    } else {
      dispatch({ type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: a.point });
      dispatch({ type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: b.point });
      dispatch({ type: 'ACCEPT_MANUAL', distance: distanceText, unit, finish: false });
    }
    setStep('references'); setLocalError(null);
  };
  const finish = () => {
    if (busy || blockers.acknowledgementRequired || !controller.validAccepted.length || pageHasDependents) return;
    dispatch({ type: 'FINISH_ACCEPTED' });
  };
  const pitchControls = <PitchControl pitch={pitch} onChange={onPitchChange}
    onType={() => { setPitchText(String(pitch)); setNumberMode('pitch'); }} disabled={busy} />;
  const views = <RailViewControls onFit={view.fit} onZoomIn={() => view.zoomBy(1.25)} onZoomOut={() => view.zoomBy(0.8)} disabled={!camera || midGesture} />;
  const error = localError ?? state.error?.message ?? image.error;
  let rail: ReactNode;
  if (numberMode === 'pitch') {
    rail = <NumericRail kind="pitch" value={pitchText} onChange={setPitchText} unit="°" onBack={() => setNumberMode(null)}
      onConfirm={(value) => { onPitchChange(value); setNumberMode(null); }} />;
  } else if (unitPicker) {
    rail = <RailTask label="Calibration units" footer={<RailAction onClick={() => setUnitPicker(false)}>Back</RailAction>}>
      <RailNotice>Use the unit printed on the plan. This does not change the quote&rsquo;s working units.</RailNotice>
      <div className="grid grid-cols-2 gap-2">{UNITS.map((value) => <RailAction key={value} label={`Use ${value} for calibration`}
        primary={unit === value} onClick={() => { setUnit(value); setUnitPicker(false); }}>{value}</RailAction>)}</div>
    </RailTask>;
  } else if (step === 'distance') {
    rail = <NumericRail kind="distance" value={distanceText} onChange={setDistanceText} unit={unit} onChangeUnit={() => setUnitPicker(true)}
      onBack={() => selectPoint(1)} onConfirm={acceptDistance} busy={busy} />;
  } else if (step === 'find') {
    rail = <RailTask label="Find a measurement" footer={<RailAction primary label="Ready to place calibration points" disabled={!ready}
      onClick={beginReference}>Ready</RailAction>}>
      <RailNotice>Find your scale or a known measurement. Move the plan and pinch to zoom, then tap Ready.</RailNotice>
      {views}
      {pitchControls}
      {image.error && <><RailNotice error>{image.error}</RailNotice><RailAction onClick={image.retry}>Retry image</RailAction></>}
      {!page && <RailNotice>Preparing this plan...</RailNotice>}
      {pageHasDependents && <RailNotice error>This page already has measurements. Recalibrate in Desktop view so every measurement is updated together.</RailNotice>}
      {aiEnabled && <RailAction disabled={!ready} onClick={() => {
        dispatch({ type: 'START_NEW', quoteId, image: descriptor, baseCalibrationRevision: 0 });
        setStep('ai'); controller.startSearch();
      }}>Find measurements with AI</RailAction>}
    </RailTask>;
  } else if (step === 'start' || step === 'end') {
    const index = step === 'start' ? 0 : 1;
    const placed = pair.draft.vertices[index] != null;
    rail = <RailTask label="Calibration point controls" footer={<RailAction primary onClick={confirmPoint} disabled={!placed || midGesture}
      label={step === 'start' ? 'Confirm first point' : 'Confirm second point'}>{step === 'start' ? 'Confirm first point' : 'Confirm second point'}</RailAction>}>
      <RailNotice>{placed ? 'Lift your finger. Press away from the point and drag to adjust. Release to set, then confirm.'
        : `Tap the ${step === 'start' ? 'first' : 'second'} end of the measurement.`}</RailNotice>
      <div className="grid grid-cols-2 gap-1">
        <RailAction label="Select the start point" disabled={!pair.draft.vertices[0] || midGesture} primary={selectedIndex === 0} onClick={() => selectPoint(0)}>Start</RailAction>
        <RailAction label="Select the end point" disabled={!pair.draft.vertices[1] || midGesture} primary={selectedIndex === 1} onClick={() => selectPoint(1)}>End</RailAction>
      </div>
      {placed && !pair.selection.moveArmed && <RailNotice>Point set. Tap {step === 'start' ? 'Start' : 'End'} to adjust again.</RailNotice>}
      {error && <RailNotice error>{error}</RailNotice>}
      {views}
      <div className="grid grid-cols-2 gap-1">
        <RailAction disabled={!pair.history.undo.length || midGesture} onClick={() => {
          const next = undo(pair).session; setPair(next);
          setStep(next.draft.vertices.length < 2 ? 'start' : 'end');
        }}>Undo</RailAction>
        <RailAction disabled={midGesture} onClick={() => { setStep('find'); setPair(createPair()); }}>Find again</RailAction>
      </div>
    </RailTask>;
  } else if (step === 'ai') {
    rail = <RailTask label="AI calibration review" footer={<RailAction onClick={() => setStep('find')}>Use manual instead</RailAction>}>
      <RailNotice>{state.phase === 'searching' ? 'Finding measurements...' : 'Choose a suggestion. You can move both points and correct its value.'}</RailNotice>
      {error && <RailNotice error>{error}</RailNotice>}
      {state.candidates.map((candidate, index) => <RailAction key={candidate.id} onClick={() => {
        const endpoints = effectiveCandidateEndpoints(state, candidate);
        const next = createPair([endpoints.sceneP1, endpoints.sceneP2]);
        setPair(selectVertex(next, next.draft.vertices[0].id, true).session); setCandidateId(candidate.id);
        setDistanceText(state.reviews[candidate.id]?.enteredDistance ?? String(candidate.suggestedDistance ?? ''));
        setUnit(state.reviews[candidate.id]?.enteredUnit ?? candidate.suggestedUnit ?? unit); setStep('start');
      }}>Measurement {index + 1}</RailAction>)}
      {!!state.accepted.length && <RailAction onClick={() => setStep('references')}>Review accepted references</RailAction>}
    </RailTask>;
  } else {
    rail = <RailTask label="Confirm calibration" footer={<RailAction primary onClick={finish}
      disabled={busy || !controller.validAccepted.length || blockers.acknowledgementRequired || pageHasDependents || !!localError}
      label="Confirm calibration and continue">{busy ? 'Saving calibration...' : 'Confirm calibration'}</RailAction>}>
      <RailNotice>{state.accepted.length ? `${state.accepted.length} of 3 references ready. One is enough.` : 'This reference could not be added. Check its points and distance.'}</RailNotice>
      {error && <RailNotice error>{error}</RailNotice>}
      {state.accepted.map((ref, index) => <div key={ref.id} className="flex items-center gap-1 text-xs">
        <span className="min-w-0 flex-1">{index + 1}. {ref.confirmedDistance} {ref.confirmedUnit}</span>
        <div className="w-12 shrink-0"><RailAction label={`Remove reference ${index + 1}`} disabled={busy} onClick={() => dispatch({ type: 'REMOVE_ACCEPTED', id: ref.id })}>×</RailAction></div>
      </div>)}
      {blockers.disagreementWarning && <RailNotice error>{blockers.disagreementWarning}</RailNotice>}
      {blockers.acknowledgementRequired && <RailAction disabled={busy} onClick={() => dispatch({ type: 'ACKNOWLEDGE_DISAGREEMENT' })}>Use this average anyway</RailAction>}
      {state.accepted.length < 3 && <RailAction disabled={busy} label="Calibrate another length" onClick={() => { setStep('find'); setPair(createPair()); setDistanceText(''); }}>Calibrate another length</RailAction>}
      {error && <RailAction disabled={busy} onClick={() => selectPoint(1)}>Check this reference</RailAction>}
      {pitchControls}
      {aiEnabled && state.candidates.length > 0 && state.accepted.length < 3 && <RailAction disabled={busy} onClick={() => setStep('ai')}>Other AI measurements</RailAction>}
    </RailTask>;
  }
  const spans: CalibrationSpan[] = [
    ...state.accepted.map((ref, index) => ({ id: ref.id, points: [ref.sceneP1, ref.sceneP2], muted: true, label: String(index + 1) })),
    ...(step === 'ai' ? state.candidates.map((c, index) => ({ id: c.id, points: [c.sceneP1, c.sceneP2], muted: true, label: String(index + 1) })) : []),
    ...(visiblePoints.length && step !== 'references' ? [{ id: 'active', points: visiblePoints }] : []),
  ];
  const dirty = !saved && (pair.draft.vertices.length > 0 || state.accepted.length > 0);
  useEffect(() => {
    if (!active || (!dirty && !busy)) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [active, dirty, busy]);
  return { overlay: active ? <CalibrationCanvas bindSurface={view.bindSurface} camera={camera} scene={scene} planUrl={planUrl}
    spans={spans} selected={selectedIndex} armed={editing && pair.selection.moveArmed} loading={!scene} error={image.error} /> : null,
    rail: active ? rail : null, bottom: null, saved, busy, wideRail: step === 'distance' || !!numberMode,
    exitGuard: { dirty, saveLabel: 'Return to calibration', onSave: () => {}, onDiscard: onExit } };
}
export { calibrationSessionReducer };
export type { CalibrationSessionEvent };
