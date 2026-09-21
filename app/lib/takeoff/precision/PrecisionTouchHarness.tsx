'use client';
// Mobile takeoff M3: precision gesture harness — the DISPOSABLE geometry test
// bed the spec's M3 gate requires (§13 M3: "wire previous/next/insert/delete
// to a disposable geometry harness containing dense 4/40/200-point examples").
// Real quote/calibration/outline wiring is M4/M5; nothing here persists.
//
// The M1 command engine (precisionEditor) is the ONLY geometry mutator: taps,
// drags, arrows, +/− and nudges all dispatch commands; no direct state writes.
// The camera uses M2's sceneViewport (fit/pinch/pan). The interaction surface
// is the single gesture owner (§5.6) — a transparent overlay above the
// workstation canvas, mounted ONLY in touch presentation, so desktop and
// flag-off paths are untouched (L09/L10).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Point } from '../calibrationTypes';
import type { CommandResult, PrecisionEditSession, ScenePoint } from './precisionTypes';
import {
  appendVertex,
  beginEdit,
  cancelGesture,
  closeOutline,
  commitMove,
  deleteVertex,
  insertAfter,
  previewMove,
  redo,
  selectVertex,
  undo,
} from './precisionEditor';
import { validateOutline } from './precisionGeometry';
import { HIT_RADIUS_PX, type GesturePhase } from './precisionGestureMachine';
import {
  canDeleteVertex,
  canInsertAfter,
  indexOfVertexId,
  minimalRevealTranslation,
  neighbourIndex,
  nudgeSceneDelta,
  type NudgeDirection,
  type NudgeStepPx,
} from './pointNavigation';
import { PointControllerRail } from './PointControllerRail';
import {
  fitCamera,
  pinchCamera,
  scenePointToViewport,
  type Camera,
  type SceneDescriptor,
} from './sceneViewport';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';

/** Harness targets per the M3 gate: 4 / 40 / 200 points. */
type FixtureSize = 4 | 40 | 200;

/** Deterministic dense fixtures (no randomness: stable across reloads/tests). */
function buildFixturePoints(size: FixtureSize): ScenePoint[] {
  if (size === 4) {
    return [{ x: 300, y: 300 }, { x: 1700, y: 300 }, { x: 1700, y: 1400 }, { x: 300, y: 1400 }];
  }
  const pts: ScenePoint[] = [];
  for (let i = 0; i < size; i++) {
    const t = (i / size) * Math.PI * 2;
    // Concave star-ish polygon: alternating radius + deterministic jitter.
    const r = 500 + 260 * Math.sin(t * (size >= 40 ? 9 : 3)) + 40 * Math.sin(t * 31.7);
    pts.push({ x: 1000 + r * Math.cos(t), y: 850 + r * Math.sin(t) * 0.8 });
  }
  return pts;
}

const HARNESS_SCENE: SceneDescriptor = { width: 2000, height: 1700, imageRevision: 'harness' };

const ZOOM_STEP = 1.25;

function harnessSession(size: FixtureSize, closed: boolean) {
  return beginEdit(
    { kind: 'outline', geometryId: `harness-${size}`, quoteRoofAreaId: null },
    {
      quoteId: 'harness', pageId: 'harness', imageRevision: 'harness',
      coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0,
    },
    buildFixturePoints(size),
    closed,
  );
}

export interface PrecisionTouchHarnessParts {
  /** Mount inside the canvas slot (only in touch presentation). */
  overlay: ReactNode;
  /** Right-rail content (point controller + view controls). */
  rail: ReactNode;
  /** Bottom-strip content (hint / draft status / undo-redo / fixtures). */
  bottom: ReactNode;
}

export function usePrecisionTouchHarness(active: boolean): PrecisionTouchHarnessParts {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [fixture, setFixture] = useState<FixtureSize>(4);
  const [openPath, setOpenPath] = useState(false);
  const [session, setSession] = useState(() => harnessSession(4, true));
  const sessionRef = useRef(session);

  const [camera, setCamera] = useState<Camera | null>(null);
  const cameraRef = useRef<Camera | null>(camera);
  // Ref sync in effects (react-hooks/refs): event-time readers see the latest
  // committed state; pointer events are always dispatched after effects run.
  useEffect(() => {
    sessionRef.current = session;
    cameraRef.current = camera;
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fineOpen, setFineOpen] = useState(false);
  const [nudgeStep, setNudgeStep] = useState<NudgeStepPx>(1);

  // Reset the disposable draft when the fixture/shape changes.
  const resetDraft = useCallback((size: FixtureSize, closed: boolean) => {
    setSession(harnessSession(size, closed));
    setFineOpen(false);
  }, []);

  // Viewport measurement + initial fit. A resize cancels the live gesture via
  // the input adapter's ResizeObserver (§5.3); the camera is preserved (§10.3).
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

  // Initial fit (one-shot external-system sync — mirrors the M2 viewMode
  // pattern of deferring out of the effect body for react-hooks lint).
  useEffect(() => {
    if (!active) return;
    const tryFit = () => {
      setCamera((cam) => (cam == null && viewport.width > 0 ? fitCamera(HARNESS_SCENE, viewport) : cam));
    };
    queueMicrotask(tryFit);
  }, [active, viewport]);

  const fitZoom = useMemo(
    () => (viewport.width > 0 ? fitCamera(HARNESS_SCENE, viewport).zoom : 0.1),
    [viewport],
  );
  const zoomBounds = useMemo(() => ({ min: fitZoom * 0.5, max: fitZoom * 16 }), [fitZoom]);

  // ─── current-state readers for the input environment (never stale) ──────

  const draft = session.draft;
  const ids = useMemo(() => draft.vertices.map((v) => v.id), [draft]);
  const selectedIndex = indexOfVertexId(ids, session.selection.vertexId);
  const selectedId = selectedIndex >= 0 ? session.selection.vertexId : null;

  const vertexViewportPoints = useMemo(() => {
    const cam = camera;
    if (!cam) return [];
    return draft.vertices.map((v) => {
      const p = session.preview && session.preview.vertexId === v.id ? session.preview.point : v.point;
      return scenePointToViewport(cam, p);
    });
  }, [draft.vertices, camera, session.preview]);

  const hitMarker = useCallback(
    (client: Point): string | null => {
      let bestId: string | null = null;
      let bestDist = Infinity;
      vertexViewportPoints.forEach((vp, i) => {
        const d = Math.hypot(vp.x - client.x, vp.y - client.y);
        if (d > HIT_RADIUS_PX) return;
        // Nearest wins; tie-break by perimeter order (first in order, §5.5).
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
      armedVertexId: () => {
        const s = sessionRef.current;
        return s.selection.moveArmed ? s.selection.vertexId : null;
      },
      canAppend: () => !sessionRef.current.draft.closed, // explicit placement only on open paths (§5.3/§8.1)
      getCamera: () => cameraRef.current ?? fitCamera(HARNESS_SCENE, viewport),
      getScenePoint: (id: string) =>
        sessionRef.current.draft.vertices.find((v) => v.id === id)?.point ?? null,
    }),
    [hitMarker, viewport],
  );

  // ─── command dispatch: the ONLY path to geometry mutations ──────────────

  const applyCommand = useCallback(
    (fn: (s: PrecisionEditSession) => CommandResult) => {
      setSession((s) => fn(s).session);
    },
    [],
  );

  const onSelect = useCallback((id: string) => {
    setSession((s) => selectVertex(s, id, true).session); // marker tap arms (§5.1)
  }, []);

  const onPreviewMove = useCallback((_id: string, scenePoint: ScenePoint) => {
    setSession((s) => {
      const sel = s.selection.vertexId;
      if (sel == null) return s;
      return previewMove(s, sel, scenePoint).session;
    });
  }, []);

  const onCommitMove = useCallback((id: string, scenePoint: ScenePoint) => {
    setSession((s) => commitMove(s, id, scenePoint).session); // commits + disarms (M1)
  }, []);

  const onRollbackMove = useCallback(() => {
    setSession((s) => cancelGesture(s).session); // restore + disarm, no history entry
  }, []);

  const onOneFingerPan = useCallback((total: Point, startCamera: Camera) => {
    setCamera({ zoom: startCamera.zoom, tx: startCamera.tx + total.x, ty: startCamera.ty + total.y });
  }, []);

  const onViewGestureUpdate = useCallback(
    (
      start: { a: Point; b: Point },
      current: { a: Point; b: Point },
      startCamera: Camera,
    ) => {
      const d0 = Math.hypot(start.b.x - start.a.x, start.b.y - start.a.y);
      if (!(d0 > 1e-6)) return; // near-zero guard (§5.4)
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
    [zoomBounds],
  );

  const handlers = useMemo(
    () => ({
      onTapSelect: onSelect,
      onTapPlace: (scenePoint: ScenePoint) => {
        setSession((s) => appendVertex(s, scenePoint).session); // open path only (env.canAppend)
      },
      onPreviewMove,
      onCommitMove,
      onRollbackMove,
      onOneFingerPan,
      onViewGestureUpdate,
      onViewGestureEnd: () => {},
      onGestureCancelled: () => {},
    }),
    [onSelect, onPreviewMove, onCommitMove, onRollbackMove, onOneFingerPan, onViewGestureUpdate],
  );

  const gesturePhase: GesturePhase = usePrecisionPointerInput(active, surfaceRef, handlers, env);

  // ─── controller actions (§6) ────────────────────────────────────────────

  const navigate = useCallback(
    (direction: -1 | 1) => {
      setSession((s) => {
        const sids = s.draft.vertices.map((v) => v.id);
        const cur = indexOfVertexId(sids, s.selection.vertexId);
        const target = neighbourIndex(sids.length, s.draft.closed, cur, direction);
        if (target == null) return s;
        return selectVertex(s, sids[target], true).session;
      });
      // §5.5 offscreen reveal AFTER the selection settles (post-gesture,
      // zoom unchanged, instant → reduced-motion safe).
      setCamera((cam) => {
        if (!cam) return cam;
        const s = sessionRef.current;
        const sel = s.selection.vertexId;
        if (sel == null) return cam;
        const idx = s.draft.vertices.findIndex((v) => v.id === sel);
        if (idx < 0) return cam;
        const vp = scenePointToViewport(cam, s.draft.vertices[idx].point);
        const shift = minimalRevealTranslation(vp, viewport);
        return shift ? { ...cam, tx: cam.tx + shift.x, ty: cam.ty + shift.y } : cam;
      });
    },
    [viewport],
  );

  const zoomAroundCentre = useCallback(
    (factor: number) => {
      setCamera((cam) => {
        if (!cam || viewport.width <= 0) return cam;
        const centreScene = {
          x: (viewport.width / 2 - cam.tx) / cam.zoom,
          y: (viewport.height / 2 - cam.ty) / cam.zoom,
        };
        const zoom = Math.min(Math.max(cam.zoom * factor, zoomBounds.min), zoomBounds.max);
        return { zoom, tx: viewport.width / 2 - zoom * centreScene.x, ty: viewport.height / 2 - zoom * centreScene.y };
      });
    },
    [viewport, zoomBounds],
  );

  const onNudge = useCallback(
    (direction: NudgeDirection) => {
      const cam = cameraRef.current;
      const s = sessionRef.current;
      const sel = s.selection.vertexId;
      if (!cam || sel == null) return;
      const v = s.draft.vertices.find((x) => x.id === sel);
      if (!v) return;
      const d = nudgeSceneDelta(cam, direction, nudgeStep);
      setSession((cur) => commitMove(cur, sel, { x: v.point.x + d.x, y: v.point.y + d.y }).session); // one tap = one command (§5.7)
    },
    [nudgeStep],
  );

  const blockingIssues = useMemo(
    () => validateOutline(draft, { sceneWidth: HARNESS_SCENE.width, sceneHeight: HARNESS_SCENE.height }).filter((i) => i.severity === 'blocking'),
    [draft],
  );

  // ─── overlay + rail + bottom ────────────────────────────────────────────

  const overlay = active ? (
    <div
      ref={surfaceRef}
      data-testid="precision-interaction-surface"
      className="absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
    >
      {camera && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {/* Edges: base + incident-edge highlight for the selection (§3.5). */}
          <polygon
            points={vertexViewportPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={draft.closed ? 'rgba(255,107,53,0.08)' : 'none'}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {selectedIndex >= 0 && vertexViewportPoints.length > 1 && (() => {
            const n = vertexViewportPoints.length;
            const prev = draft.closed ? (selectedIndex - 1 + n) % n : selectedIndex - 1;
            const next = draft.closed ? (selectedIndex + 1) % n : selectedIndex + 1;
            const pts: string[] = [];
            if (prev >= 0) pts.push(`${vertexViewportPoints[prev].x},${vertexViewportPoints[prev].y}`);
            pts.push(`${vertexViewportPoints[selectedIndex].x},${vertexViewportPoints[selectedIndex].y}`);
            if (next < n) pts.push(`${vertexViewportPoints[next].x},${vertexViewportPoints[next].y}`);
            return <polyline points={pts.join(' ')} fill="none" stroke="#FF6B35" strokeWidth={4} />;
          })()}
          {vertexViewportPoints.map((p, i) => {
            const isSelected = i === selectedIndex;
            const isArmed = isSelected && session.selection.moveArmed;
            const isInvalid = blockingIssues.some((issue) => issue.vertexIds?.includes(ids[i]));
            return (
              <g key={ids[i]}>
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeDasharray={isArmed ? '5 3' : 'none'} />
                )}
                {/* Precise centre mark (crosshair — state is not colour-only, §3.5/L07). */}
                {isSelected ? (
                  <>
                    <line x1={p.x - 5} y1={p.y} x2={p.x + 5} y2={p.y} stroke="#FF6B35" strokeWidth={1.5} />
                    <line x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5} stroke="#FF6B35" strokeWidth={1.5} />
                  </>
                ) : (
                  <circle cx={p.x} cy={p.y} r={3} fill="white" />
                )}
                {isInvalid && (
                  <text x={p.x + 16} y={p.y - 10} fontSize={11} fill="#fca5a5">!</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  ) : null;

  const canPrev = neighbourIndex(ids.length, draft.closed, selectedIndex, -1) != null || selectedIndex < 0;
  const canNext = neighbourIndex(ids.length, draft.closed, selectedIndex, 1) != null || selectedIndex < 0;

  const rail = active ? (
    <PointControllerRail
      counterLabel={
        selectedIndex >= 0 ? `Point ${selectedIndex + 1} of ${ids.length}` : `${ids.length} points`
      }
      armedCue={
        selectedId == null
          ? 'No point selected'
          : session.selection.moveArmed
            ? 'Drag anywhere to move · release to set'
            : 'Point set'
      }
      onPrevious={() => navigate(-1)}
      onNext={() => navigate(1)}
      canPrevious={canPrev && ids.length > 0}
      canNext={canNext && ids.length > 0}
      onInsert={() => selectedId && applyCommand((s) => insertAfter(s, selectedId))}
      canInsert={canInsertAfter(ids.length, draft.closed, selectedIndex)}
      onDelete={() => selectedId && applyCommand((s) => deleteVertex(s, selectedId))}
      canDelete={canDeleteVertex(ids.length, draft.closed, selectedIndex)}
      gesturePhase={gesturePhase}
      onAdjust={() => selectedId && applyCommand((s) => selectVertex(s, selectedId, true))}
      canAdjust={selectedId != null}
      fineOpen={fineOpen}
      onToggleFine={() => setFineOpen((v) => !v)}
      onNudge={onNudge}
      nudgeStep={nudgeStep}
      onNudgeStepChange={setNudgeStep}
      onDoneFine={() => setFineOpen(false)}
      onFitPlan={() => viewport.width > 0 && setCamera(fitCamera(HARNESS_SCENE, viewport))}
      onZoomIn={() => zoomAroundCentre(ZOOM_STEP)}
      onZoomOut={() => zoomAroundCentre(1 / ZOOM_STEP)}
      onMovePlan={() =>
        // §5.4: Move plan temporarily disarms — never discards selection/draft.
        applyCommand((s) => selectVertex(s, s.selection.vertexId, false))
      }
    />
  ) : null;

  const hint = blockingIssues.length > 0
    ? blockingIssues[0].message
    : selectedId == null
      ? 'Tap a point or use ‹ › to select.'
      : session.selection.moveArmed
        ? 'Drag anywhere to move it.'
        : 'Point set.';

  const bottom = active ? (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-slate-400">
      <span className="min-w-0 truncate" aria-live="polite">{hint}</span>
      <span className="flex-1" />
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-300">
        {openPath ? 'Open path' : 'Closed'}
      </span>
      <button type="button" aria-label="Undo" onClick={() => setSession((s) => undo(s).session)} className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20">
        Undo
      </button>
      <button type="button" aria-label="Redo" onClick={() => setSession((s) => redo(s).session)} className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20">
        Redo
      </button>
      <button
        type="button"
        aria-label="Close outline"
        disabled={draft.closed}
        onClick={() => applyCommand((s) => closeOutline(s))}
        className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40"
      >
        Close
      </button>
      {/* Disposable harness fixtures: 4 / 40 / 200 points (M3 gate). */}
      <div className="flex items-center gap-1" role="group" aria-label="Harness fixture size">
        {([4, 40, 200] as const).map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={fixture === size}
            onClick={() => {
              setFixture(size);
              resetDraft(size, openPath);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${fixture === size ? 'bg-white text-slate-900' : 'border border-white/20 text-white'}`}
          >
            {size}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={openPath}
          onClick={() => {
            const next = !openPath;
            setOpenPath(next);
            resetDraft(fixture, next);
          }}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${openPath ? 'bg-white text-slate-900' : 'border border-white/20 text-white'}`}
        >
          Open path
        </button>
        <button
          type="button"
          onClick={() => resetDraft(fixture, openPath)}
          className="rounded-full border border-white/20 px-2.5 py-1 text-xs font-medium text-white"
        >
          Reset
        </button>
      </div>
    </div>
  ) : null;

  return { overlay, rail, bottom };
}

