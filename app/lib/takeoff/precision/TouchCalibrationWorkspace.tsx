'use client';
// Mobile takeoff M4: the touch calibration workspace (spec 2026-09-21 §7).
// Owns the shared calibration session via the EXISTING useCalibrationController
// (same reducer, same search lifecycle, same commit contract as the desktop
// review panel — R14: one domain/save path, no second review controller
// mounted). The manual A/B wizard and AI endpoint repair reuse the M3 gesture
// stack (precisionEditor commands + usePrecisionPointerInput): tap places an
// endpoint, off-point drag adjusts it, two fingers pan/zoom the view.
//
// C16: view switching mid-edit never remounts this component's parent shell —
// the workstation below stays mounted; drafts live in the session reducer.
//
// Persistence (§7.6): finishing builds the SAME legacy + calibrationMetadata
// payload the desktop flow persists and writes it through the existing
// calibration-only save path (actions.ts persistPageCalibration). When the page
// already has measurements/roof areas, recalibration is blocked from touch
// (surface + pure gate) because the atomic desktop recompute/save orchestration
// is not wired here yet (M5) — never a silent partial write.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Point } from '../calibrationTypes';
import type { AcceptedReferenceDraft, DistanceUnit, WorkingUnit } from '../calibrationTypes';
import {
  calibrationSessionReducer,
  effectiveCandidateEndpoints,
  type CalibrationSessionEvent,
} from '../calibrationSession';
import { decodeCalibrationMetadata } from '../calibrationCodec';
import { commitFailed, commitSucceeded, type CalibrationCommitResult } from '../calibrationCommit';
import type { PrecisionEditSession } from './precisionTypes';
import {
  beginEdit as beginEditCmd,
  commitMove as commitMoveCmd,
  previewMove as previewMoveCmd,
  selectVertex as selectVertexCmd,
  appendVertex as appendVertexCmd,
  cancelGesture as cancelGestureCmd,
  undo as undoCmd,
} from './precisionEditor';
import { HIT_RADIUS_PX } from './precisionGestureMachine';
import {
  fitCamera,
  pinchCamera,
  sceneDimsFromSource,
  scenePointToViewport,
  type Camera,
  type SceneDescriptor,
} from './sceneViewport';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';
import { useCalibrationController, type CalibrationStartMode } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/calibration/useCalibrationController';
import { persistPageCalibration } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions';
import { EndpointControllerRail, type CalibrationWizardStep } from './EndpointControllerRail';
import { CalibrationSheet } from './CalibrationSheet';
import { logTakeoffEvent } from './takeoffDiagnostics';
import {
  buildCalibrationCommit,
  calibrationDescriptorFromSource,
  finishBlockers,
} from './touchCalibration';

export interface TouchCalibrationPageInfo {
  id: string;
  imageRevision: string | null;
  calibrationMetadata: unknown;
  scaleCalibration: unknown;
}

export interface UseTouchCalibrationOptions {
  /** True only in touch presentation (surface owns gestures). */
  active: boolean;
  quoteId: string;
  planUrl: string;
  page: TouchCalibrationPageInfo | null;
  /** AI calibration entitlement flag (server-provided). */
  aiEnabled: boolean;
  /** Measurements or roof areas already exist on this page (C13 gate). */
  pageHasDependents: boolean;
  onExit: () => void;
}

export interface TouchCalibrationParts {
  overlay: ReactNode;
  rail: ReactNode;
  bottom: ReactNode;
  /** Whether the shared controller reports a successfully saved calibration. */
  saved: boolean;
}

const ZOOM_STEP = 1.25;

function decodeExistingReferences(
  page: TouchCalibrationPageInfo | null,
): { refs: AcceptedReferenceDraft[]; workingUnit: WorkingUnit } {
  if (!page) return { refs: [], workingUnit: 'meters' };
  const decoded = decodeCalibrationMetadata(page.calibrationMetadata ?? page.scaleCalibration);
  if (decoded.kind === 'v1') {
    return { refs: decoded.metadata.references, workingUnit: decoded.metadata.workingUnit };
  }
  if (decoded.kind === 'legacy') {
    return { refs: decoded.references, workingUnit: decoded.workingUnit ?? 'meters' };
  }
  return { refs: [], workingUnit: 'meters' };
}

export function useTouchCalibration(options: UseTouchCalibrationOptions): TouchCalibrationParts {
  const { active, quoteId, planUrl, page, aiEnabled, pageHasDependents, onExit } = options;

  // ── Scene frame: same 2000-long-edge normalisation as the workstation ────
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const img = new Image();
    img.onload = () => {
      if (!disposed && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSourceDims({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (!disposed) setImageError('The plan image could not be loaded for calibration.');
    };
    img.src = planUrl;
    return () => {
      disposed = true;
    };
  }, [active, planUrl]);

  const scene: SceneDescriptor | null = useMemo(() => {
    if (!sourceDims) return null;
    return sceneDimsFromSource(sourceDims.w, sourceDims.h, page?.imageRevision ?? null);
  }, [sourceDims, page?.imageRevision]);

  const descriptor = useMemo(
    () =>
      calibrationDescriptorFromSource({
        pageId: page?.id ?? 'unknown-page',
        imageRevision: page?.imageRevision ?? null,
        frameKey: `touch-${page?.id ?? 'page'}-${sourceDims ? `${sourceDims.w}x${sourceDims.h}` : 'loading'}`,
        sourceWidth: sourceDims?.w ?? 1,
        sourceHeight: sourceDims?.h ?? 1,
      }),
    [page?.id, page?.imageRevision, sourceDims],
  );

  const existing = useMemo(() => decodeExistingReferences(page), [page]);
  const workingUnit = existing.workingUnit;
  const startMode: CalibrationStartMode = useMemo(
    () =>
      existing.refs.length > 0
        ? { kind: 'edit', initialAccepted: existing.refs }
        : { kind: 'new' },
    [existing.refs],
  );

  const router = useRouter();
  // ── Persistence through the EXISTING calibration-only save path (§7.6) ────
  const commit = useCallback(
    async (accepted: readonly AcceptedReferenceDraft[]): Promise<CalibrationCommitResult> => {
      if (!page) return commitFailed('COMMIT_FAILED', 'No takeoff page exists for this plan yet.');
      if (pageHasDependents) {
        // C13 safety gate: dependent values must be recomputed atomically with
        // the new scale; that orchestration lives on the desktop path until M5.
        return commitFailed(
          'DEPENDENTS_PRESENT',
          'This page already has measurements. Switch the workspace view to Desktop and recalibrate there so every measurement is updated together.',
        );
      }
      const payload = buildCalibrationCommit(
        accepted,
        workingUnit,
        page.imageRevision ?? 'server-revision-unavailable',
        new Date().toISOString(),
      );
      const res = await persistPageCalibration(quoteId, page.id, payload.legacy, payload.metadata);
      if (!res.success) {
        logTakeoffEvent('calibration.commit.failed', { error: res.error });
        return commitFailed('COMMIT_FAILED', `The calibration could not be saved: ${res.error}`);
      }
      logTakeoffEvent('calibration.commit.succeeded', { pageId: page.id });
      // M7: the workstation (single data owner) must learn the new scale in
      // THIS session — otherwise outline saves silently no-op until reload.
      // A server refresh re-hydrates the page (including calibrationMetadata)
      // without remounting any client state.
      router.refresh();
      return commitSucceeded();
    },
    [page, pageHasDependents, quoteId, workingUnit, router]);

  const controller = useCalibrationController({
    quoteId,
    image: descriptor,
    workingUnit,
    startMode,
    // §7.1: never auto-spend credits by entering touch view — deliberate only.
    autoStart: false,
    onFinish: commit,
    onCancel: onExit,
  });
  const { dispatch } = controller;
  const state = controller.state;
  // A successfully acknowledged commit is simply the reducer's completed phase
  // (COMMIT_SUCCEEDED is dispatched only after persistPageCalibration ok).
  const saved = state.phase === 'completed';

  // ── A/B endpoint draft: M1 command engine, ≤2 vertices, open path ────────
  const [abSession, setAbSession] = useState<PrecisionEditSession>(() =>
    beginEditCmd(
      { kind: 'calibration', referenceDraftId: 'manual-ab' },
      {
        quoteId: 'calibration', pageId: page?.id ?? 'page', imageRevision: page?.imageRevision ?? 'rev',
        coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0,
      },
      [],
      false,
    ),
  );
  const abRef = useRef(abSession);
  useEffect(() => {
    abRef.current = abSession;
  });
  const [repairCandidateId, setRepairCandidateId] = useState<string | null>(null);

  const vertices = abSession.draft.vertices;
  const pointA = vertices[0]?.point ?? null;
  const pointB = vertices[1]?.point ?? null;
  const manualPairReady = pointA != null && pointB != null;

  // Sheet inputs (§7.2: typed values survive endpoint edits / switching).
  // M7.1: unit defaults from the workspace working unit (owner test — the
  // placeholder-only select made the sheet immediately invalid on open).
  const [distanceText, setDistanceText] = useState('');
  const [unit, setUnit] = useState<DistanceUnit | null>(workingUnit === 'feet' ? 'ft' : 'm');

  // ── Camera + gesture surface (M3 stack) ───────────────────────────────────
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const cameraRef = useRef<Camera | null>(camera);
  useEffect(() => {
    cameraRef.current = camera;
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!active) return;
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  const fitZoom = useMemo(
    () => (viewport.width > 0 && scene ? fitCamera(scene, viewport).zoom : 0.1),
    [viewport, scene],
  );
  const zoomBounds = useMemo(() => ({ min: fitZoom * 0.5, max: fitZoom * 16 }), [fitZoom]);

  useEffect(() => {
    if (!active || !scene) return;
    queueMicrotask(() => {
      setCamera((cam) => (cam == null && viewport.width > 0 ? fitCamera(scene, viewport) : cam));
    });
  }, [active, scene, viewport]);

  const vertexViewportPoints = useMemo(() => {
    if (!camera) return [];
    return vertices.map((v) =>
      scenePointToViewport(camera, abSession.preview && abSession.preview.vertexId === v.id ? abSession.preview.point : v.point),
    );
  }, [vertices, camera, abSession.preview]);

  const ids = useMemo(() => vertices.map((v) => v.id), [vertices]);

  const hitMarker = useCallback(
    (client: Point): string | null => {
      let bestId: string | null = null;
      let bestDist = Infinity;
      vertexViewportPoints.forEach((vp, i) => {
        const d = Math.hypot(vp.x - client.x, vp.y - client.y);
        if (d > HIT_RADIUS_PX) return;
        if (d < bestDist - 1e-9) {
          bestDist = d;
          bestId = ids[i];
        }
      });
      return bestId;
    },
    [vertexViewportPoints, ids],
  );

  const env = useMemo(
    () => ({
      hitMarker,
      armedVertexId: () => (abRef.current.selection.moveArmed ? abRef.current.selection.vertexId : null),
      // Placement only until both endpoints exist (§5.3 priority 3; repair mode
      // never appends — it edits the loaded pair).
      canAppend: () => !repairModeActiveRef.current && abRef.current.draft.vertices.length < 2,
      getCamera: () => cameraRef.current ?? (scene && viewport.width > 0 ? fitCamera(scene, viewport) : { zoom: 1, tx: 0, ty: 0 }),
      getScenePoint: (id: string) => abRef.current.draft.vertices.find((v) => v.id === id)?.point ?? null,
    }),
    [hitMarker, scene, viewport],
  );
  const repairModeActiveRef = useRef(false);
  useEffect(() => {
    repairModeActiveRef.current = repairCandidateId != null;
  });

  const handlers = useMemo(
    () => ({
      onTapSelect: (id: string) => setAbSession((s) => selectVertexCmd(s, id, true).session),
      onTapPlace: (p: { x: number; y: number }) => setAbSession((s) => appendVertexCmd(s, p).session),
      onPreviewMove: (_id: string, p: { x: number; y: number }) =>
        setAbSession((s) => {
          const sel = s.selection.vertexId;
          if (sel == null) return s;
          return previewMoveCmd(s, sel, p).session;
        }),
      onCommitMove: (id: string, p: { x: number; y: number }) =>
        setAbSession((s) => commitMoveCmd(s, id, p).session),
      onRollbackMove: () => setAbSession((s) => cancelGestureCmd(s).session),
      onOneFingerPan: (total: Point, startCamera: Camera) =>
        setCamera({ zoom: startCamera.zoom, tx: startCamera.tx + total.x, ty: startCamera.ty + total.y }),
      onViewGestureUpdate: (
        start: { a: Point; b: Point },
        current: { a: Point; b: Point },
        startCamera: Camera,
      ) => {
        const d0 = Math.hypot(start.b.x - start.a.x, start.b.y - start.a.y);
        if (!(d0 > 1e-6)) return;
        const mid = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
        const dist = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
        setCamera(
          pinchCamera(
            startCamera,
            { mid: mid(start.a, start.b), distance: d0 },
            { mid: mid(current.a, current.b), distance: dist(current.a, current.b) },
            zoomBounds,
          ),
        );
      },
      onViewGestureEnd: () => {},
      onGestureCancelled: () => {},
    }),
    [zoomBounds],
  );

  const gesturePhase = usePrecisionPointerInput(active && scene != null, surfaceRef, handlers, env);

  // ── Wizard actions ────────────────────────────────────────────────────────
  const selectedVertexId = abSession.selection.vertexId;
  const selected: 'a' | 'b' | null =
    selectedVertexId != null && ids[0] === selectedVertexId
      ? 'a'
      : selectedVertexId != null && ids[1] === selectedVertexId
        ? 'b'
        : null;

  const step: CalibrationWizardStep = repairCandidateId
    ? 'review'
    : vertices.length === 0
      ? 'place-a'
      : vertices.length === 1
        ? abSession.selection.moveArmed
          ? 'adjust-a'
          : 'place-b'
        : 'review';

  const selectEndpoint = useCallback(
    (which: 'a' | 'b') => {
      const idx = which === 'a' ? 0 : 1;
      const id = abRef.current.draft.vertices[idx]?.id;
      if (id) setAbSession((s) => selectVertexCmd(s, id, true).session);
    },
    [],
  );

  const pointIsCorrect = useCallback(() => {
    // §7.2: accept the current placement without a drag — disarm so the next
    // blank tap places the OTHER endpoint (§5.3 priority 2 vs 3).
    setAbSession((s) => (s.selection.vertexId ? selectVertexCmd(s, s.selection.vertexId, false).session : s));
  }, []);

  const onBeginManual = useCallback(() => {
    dispatch({ type: 'BEGIN_MANUAL_REFERENCE' });
    setAbSession(
      beginEditCmd(
        { kind: 'calibration', referenceDraftId: 'manual-ab' },
        {
          quoteId: 'calibration', pageId: page?.id ?? 'page', imageRevision: page?.imageRevision ?? 'rev',
          coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0,
        },
        [],
        false,
      ),
    );
  }, [dispatch, page?.id, page?.imageRevision]);

  // U3 (UX17): entering the calibration step on an uncalibrated page begins
  // manual placement IMMEDIATELY - no second "Set scale manually" button, no
  // desktop chooser underneath. Dispatched once per deliberate entry (the
  // phase flips to 'manual', so this never refires on re-renders, viewport
  // changes, saves or rehydration - it would clear the manual draft).
  const autoBeginArmedRef = useRef(true);
  useEffect(() => {
    if (!active || !scene) return;
    if (!autoBeginArmedRef.current) return;
    if (pageHasDependents) return;
    if (state.phase !== 'idle' && state.phase !== 'cancelled') return;
    if (state.accepted.length > 0) return;
    autoBeginArmedRef.current = false;
    // Deferred out of the synchronous effect body (react-hooks
    // set-state-in-effect): begin placement in its own microtask.
    queueMicrotask(() => onBeginManual());
    // Re-arm only on a deliberate exit from the calibration step (re-entry
    // is a new manual intent).
  }, [active, scene, state.phase, state.accepted.length, pageHasDependents, onBeginManual]);
  useEffect(() => {
    if (!active) autoBeginArmedRef.current = true;
  }, [active]);

  const onAcceptManual = useCallback(
    (finish: boolean) => {
      const s = abRef.current;
      const p1 = s.draft.vertices[0]?.point ?? null;
      const p2 = s.draft.vertices[1]?.point ?? null;
      if (!p1 || !p2) return;
      dispatch({ type: 'SET_MANUAL_ENDPOINT', which: 'p1', point: p1 });
      dispatch({ type: 'SET_MANUAL_ENDPOINT', which: 'p2', point: p2 });
      dispatch({ type: 'ACCEPT_MANUAL', distance: distanceText, unit, finish });
      if (!finish) {
        // U3 (plan 5.2): "Add another reference" accepts this pair into the
        // session and starts the NEXT Start placement - reset only the next
        // pair/input; accepted references and the unit survive.
        setAbSession(
          beginEditCmd(
            { kind: 'calibration', referenceDraftId: 'manual-ab' },
            {
              quoteId: 'calibration', pageId: page?.id ?? 'page', imageRevision: page?.imageRevision ?? 'rev',
              coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0,
            },
            [],
            false,
          ),
        );
        setDistanceText('');
      }
    },
    [dispatch, distanceText, unit, page?.id, page?.imageRevision],
  );

  const onAdjustCandidatePoints = useCallback(() => {
    const candidate = controller.activeCandidate;
    if (!candidate) return;
    const eff = effectiveCandidateEndpoints(state, candidate);
    setRepairCandidateId(candidate.id);
    setAbSession(
      beginEditCmd(
        { kind: 'calibration', referenceDraftId: `repair-${candidate.id}` },
        {
          quoteId: 'calibration', pageId: page?.id ?? 'page', imageRevision: page?.imageRevision ?? 'rev',
          coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0,
        },
        [eff.sceneP1, eff.sceneP2],
        false,
      ),
    );
    // Arm A immediately for off-point dragging.
    queueMicrotask(() => {
      setAbSession((s) => {
        const first = s.draft.vertices[0];
        return first ? selectVertexCmd(s, first.id, true).session : s;
      });
    });
  }, [controller.activeCandidate, state, page?.id, page?.imageRevision]);

  const onDoneRepair = useCallback(() => {
    const candidateId = repairCandidateId;
    if (!candidateId) return;
    const s = abRef.current;
    const p1 = s.draft.vertices[0]?.point;
    const p2 = s.draft.vertices[1]?.point;
    if (!p1 || !p2) return;
    // The repaired endpoints flow through the reducer (never marker-only).
    dispatch({ type: 'EDIT_ENDPOINT', candidateId, sceneP1: p1, sceneP2: p2 });
    setRepairCandidateId(null);
  }, [repairCandidateId, dispatch]);

  const blockers = useMemo(() => finishBlockers(state, workingUnit), [state, workingUnit]);

  const zoomAroundCentre = useCallback(
    (factor: number) => {
      setCamera((cam) => {
        if (!cam || viewport.width <= 0 || !scene) return cam;
        const centreScene = { x: (viewport.width / 2 - cam.tx) / cam.zoom, y: (viewport.height / 2 - cam.ty) / cam.zoom };
        const zoom = Math.min(Math.max(cam.zoom * factor, zoomBounds.min), zoomBounds.max);
        return { zoom, tx: viewport.width / 2 - zoom * centreScene.x, ty: viewport.height / 2 - zoom * centreScene.y };
      });
    },
    [viewport, zoomBounds, scene],
  );

  // ── Parts ────────────────────────────────────────────────────────────────
  const overlay =
    active && scene ? (
      <>
        <div
          ref={surfaceRef}
          data-testid="calibration-interaction-surface"
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {camera && (
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{
                transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`,
                transformOrigin: '0 0',
                width: scene.width,
                height: scene.height,
              }}
            >
              {/* Plan raster under the gesture surface (SVG markers above). */}
              <img
                src={planUrl}
                alt="Plan page"
                draggable={false}
                className="h-full w-full select-none"
              />
            </div>
          )}
          {camera && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {pointA && pointB && (
                <line
                  x1={vertexViewportPoints[0]?.x}
                  y1={vertexViewportPoints[0]?.y}
                  x2={vertexViewportPoints[1]?.x}
                  y2={vertexViewportPoints[1]?.y}
                  stroke="#FF6B35"
                  strokeWidth={3}
                />
              )}
              {vertexViewportPoints.map((p, i) => {
                const isSelected = ids[i] === selectedVertexId;
                const isArmed = isSelected && abSession.selection.moveArmed;
                return (
                  <g key={ids[i]}>
                    {isSelected && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={14}
                        fill="none"
                        stroke="#FF6B35"
                        strokeWidth={2.5}
                        strokeDasharray={isArmed ? '5 3' : 'none'}
                      />
                    )}
                    <line x1={p.x - 5} y1={p.y} x2={p.x + 5} y2={p.y} stroke="#FF6B35" strokeWidth={1.5} />
                    <line x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5} stroke="#FF6B35" strokeWidth={1.5} />
                    <text x={p.x + 16} y={p.y - 10} fontSize={12} fill="#FF6B35" fontWeight={700}>
                      {i === 0 ? 'Start' : 'End'}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        {/* Sheet sits OUTSIDE the gesture surface (T09) — controls own input. */}
        <CalibrationSheet
          controller={controller}
          workingUnit={workingUnit}
          distanceText={distanceText}
          onDistanceTextChange={setDistanceText}
          unit={unit}
          onUnitChange={setUnit}
          manualPairReady={manualPairReady && state.phase === 'manual'}
          onAcceptManual={onAcceptManual}
          onBeginManual={onBeginManual}
          onFinishAccepted={() => dispatch({ type: 'FINISH_ACCEPTED' })}
          onAcknowledgeDisagreement={() => dispatch({ type: 'ACKNOWLEDGE_DISAGREEMENT' })}
          onRemoveAccepted={(id) => dispatch({ type: 'REMOVE_ACCEPTED', id })}
          onDetachReference={(id) => dispatch({ type: 'DETACH_REFERENCE', id })}
          disagreementWarning={blockers.disagreementWarning}
          acknowledgementRequired={blockers.acknowledgementRequired}
          aiEnabled={aiEnabled}
          canSearch={state.phase === 'idle' || state.phase === 'reviewing'}
          onFindWithAi={() => controller.startSearch()}
          onAdjustCandidatePoints={onAdjustCandidatePoints}
          canAdjustCandidatePoints={controller.activeCandidate != null}
          repairMode={repairCandidateId != null}
          onDoneRepair={onDoneRepair}
          pageHasDependents={pageHasDependents}
          onExit={onExit}
        />
        {imageError && (
          <div className="absolute inset-x-2 top-2 z-20 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
            {imageError}
          </div>
        )}
      </>
    ) : null;

  const rail =
    active && scene ? (
      <EndpointControllerRail
        step={step}
        selected={selected}
        armed={abSession.selection.moveArmed}
        onPointIsCorrect={pointIsCorrect}
        canPointIsCorrect={vertices.length >= 1 && repairCandidateId == null}
        onSelectA={() => selectEndpoint('a')}
        onSelectB={() => selectEndpoint('b')}
        canSelectB={vertices.length >= 2}
        gesturePhase={gesturePhase}
        onFitPlan={() => scene && viewport.width > 0 && setCamera(fitCamera(scene, viewport))}
        onZoomIn={() => zoomAroundCentre(ZOOM_STEP)}
        onZoomOut={() => zoomAroundCentre(1 / ZOOM_STEP)}
        onUndo={() => setAbSession((s) => undoCmd(s).session)}
        canUndo={abSession.history.undo.length > 0}
      />
    ) : null;

  const bottom = active ? (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-slate-400">
      <span className="min-w-0 truncate" aria-live="polite">
        {state.phase === 'committing'
          ? 'Saving calibration…'
          : state.phase === 'completed'
            ? 'Scale saved.'
            : 'Set the scale: place two points on a known distance.'}
      </span>
    </div>
  ) : null;

  return { overlay, rail, bottom, saved };
}

// Re-export for consumers that dispatch events directly (tests / future M5).
export { calibrationSessionReducer };
export type { CalibrationSessionEvent };
