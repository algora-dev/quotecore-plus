'use client';
// Mobile takeoff M5: the LIVE outline editor for the touch presentation
// (spec §8.1/§8.3–8.5, §11.1, §11.4, §11.5; O01/O03/O05/O06/O16).
//
// This is the M3 harness's production successor for outlines: same gesture
// stack (single-owner Pointer Events surface, §5.6), same M1 command engine
// as the ONLY geometry mutator, same M3 four-button rail — but the session
// is a REAL outline draft:
//   - "New outline" = manual open-path creation (tap-to-place, explicit
//     Close — no double-tap / first-point precision, §8.1);
//   - tapping a SAVED area chip loads its points into the edit draft
//     (re-entry editing §8.5) — points are editable ONLY while that area's
//     draft is open, never while another component/tool is active;
//   - Save routes through the M1 saveEdit boundary (touchOutlines):
//     persisted geometry IDs → update-in-place RPC (patch_052, O05);
//     new outlines → the existing create flow with name/pitch fields (§8.1);
//   - Cancel restores the saved version; unrelated measurements are never
//     touched client-side (the server recomputes source-linked entries, O07);
//   - a dirty draft guards Back/new-page/new-area exits with Save/Discard/
//     Stay (O16) and beforeunload as best effort (§11.5).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Point } from '../calibrationTypes';
import type {
  CommandResult,
  EditContext,
  PrecisionEditSession,
  ScenePoint,
} from './precisionTypes';
import {
  appendVertex,
  cancelGesture,
  closeOutline,
  commitMove,
  deleteVertex,
  discardEdit,
  insertAfter,
  previewMove,
  redo,
  selectVertex,
  undo,
} from './precisionEditor';
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
  beginManualOutlineDraft,
  beginSavedOutlineEdit,
  isPersistedOutlineGeometryId,
  outlineExitGuard,
  outlineReview,
  outlineSaveIntent,
  type OutlineSaveIntent,
  type SavedOutlineRecord,
} from './touchOutlines';
import {
  fitCamera,
  pinchCamera,
  scenePointToViewport,
  type Camera,
  type SceneDescriptor,
} from './sceneViewport';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';

/** What the workstation exposes to the touch presentation (M5 bridge). The
 *  workstation owns ALL state; the editor only reads through the adapter and
 *  calls back. No parallel data path (R14). */
export interface TouchOutlineAdapter {
  /** Saved roof areas visible on the CURRENT page (page-scoped by the owner). */
  getAreas(): SavedOutlineRecord[];
  /** Edit context for the current page; null when the page is not ready. */
  getEditContext(): EditContext | null;
  /** Effective page scale (real units / scene px); null when uncalibrated. */
  getScale(): { scale: number; unit: 'feet' | 'meters' } | null;
  /** Scene descriptor (2000-cap long edge) of the current plan image. */
  getScene(): SceneDescriptor;
  /** Update-in-place save: routes to actions.ts updateTakeoffAreaGeometry
   *  and applies the acknowledged result to the workstation's own state. */
  updateOutline(intent: Extract<OutlineSaveIntent, { kind: 'update-in-place' }>): Promise<
    { ok: true } | { ok: false; error: string; staleVersion?: boolean }
  >;
  /** Create-new save: the EXISTING handleSaveArea flow (name/pitch fields,
   *  area-row creation, owner stamping). */
  createOutline(name: string, pitch: number, points: ScenePoint[]): void;
}

export interface TouchOutlineEditorParts {
  overlay: ReactNode;
  rail: ReactNode;
  bottom: ReactNode;
  /** O16: wired into the shell's Back control + beforeunload. */
  exitGuard: {
    dirty: boolean;
    onSave: () => void;
    onDiscard: () => void;
  };
}

type SwitchTarget = { kind: 'area'; area: SavedOutlineRecord } | { kind: 'new' };

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const ZOOM_STEP = 1.25;

export function useTouchOutlineEditor(
  active: boolean,
  getAdapter: () => TouchOutlineAdapter | null,
  backHref?: string,
): TouchOutlineEditorParts {
  const router = useRouter();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<TouchOutlineAdapter | null>(null);
  const [session, setSession] = useState<PrecisionEditSession | null>(null);
  const sessionRef = useRef<PrecisionEditSession | null>(session);
  const [selectionMode, setSelectionMode] = useState<'idle' | 'creating'>('idle');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<SwitchTarget | null>(null);

  const [camera, setCamera] = useState<Camera | null>(null);
  const cameraRef = useRef<Camera | null>(camera);
  useEffect(() => {
    sessionRef.current = session;
    cameraRef.current = camera;
    adapterRef.current = getAdapter();
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fineOpen, setFineOpen] = useState(false);
  const [nudgeStep, setNudgeStep] = useState<NudgeStepPx>(1);

  const scene = useMemo<SceneDescriptor>(
    () => adapterRef.current?.getScene() ?? { width: 2000, height: 1700, imageRevision: null },
    // Scene follows the adapter's live value; recompute cheaply per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, viewport],
  );
  const scale = adapterRef.current?.getScale() ?? null;

  const dirty = outlineExitGuard(session).dirty;

  // O16: beforeunload best-effort guard (§11.5 — never the only mechanism).
  useEffect(() => {
    if (!active || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active, dirty]);

  // Viewport measurement + fit (M3 pattern).
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

  useEffect(() => {
    if (!active) return;
    const tryFit = () => {
      const scn = adapterRef.current?.getScene() ?? scene;
      setCamera((cam) => (cam == null && viewport.width > 0 ? fitCamera(scn, viewport) : cam));
    };
    queueMicrotask(tryFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, viewport]);

  const fitZoom = useMemo(
    () => (viewport.width > 0 ? fitCamera(scene, viewport).zoom : 0.1),
    [viewport, scene],
  );
  const zoomBounds = useMemo(() => ({ min: fitZoom * 0.5, max: fitZoom * 16 }), [fitZoom]);

  // ─── current-state readers for the input environment ─────────────────────

  const draft = session?.draft;
  const ids = useMemo(() => draft?.vertices.map((v) => v.id) ?? [], [draft]);
  const selectedIndex = indexOfVertexId(ids, session?.selection.vertexId ?? null);
  const selectedId = selectedIndex >= 0 ? session?.selection.vertexId ?? null : null;

  const vertexViewportPoints = useMemo(() => {
    if (!camera || !draft) return [];
    const d = draft;
    return d.vertices.map((v) => {
      const p = session?.preview && session.preview.vertexId === v.id ? session.preview.point : v.point;
      return scenePointToViewport(camera, p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.vertices, camera, session?.preview]);

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
      armedVertexId: () => {
        const s = sessionRef.current;
        return s?.selection.moveArmed ? s.selection.vertexId : null;
      },
      canAppend: () => sessionRef.current != null && !sessionRef.current.draft.closed,
      getCamera: () => cameraRef.current ?? fitCamera(scene, viewport),
      getScenePoint: (id: string) =>
        sessionRef.current?.draft.vertices.find((v) => v.id === id)?.point ?? null,
    }),
    [hitMarker, viewport, scene],
  );

  // ─── command dispatch: the ONLY path to geometry mutations ───────────────

  const applyCommand = useCallback((fn: (s: PrecisionEditSession) => CommandResult) => {
    setSession((s) => (s == null ? s : fn(s).session));
  }, []);

  const onSelect = useCallback((id: string) => {
    setSession((s) => (s == null ? s : selectVertex(s, id, true).session));
  }, []);

  const onPreviewMove = useCallback((_id: string, scenePoint: ScenePoint) => {
    setSession((s) => {
      const sel = s?.selection.vertexId;
      if (s == null || sel == null) return s;
      return previewMove(s, sel, scenePoint).session;
    });
  }, []);

  const onCommitMove = useCallback((id: string, scenePoint: ScenePoint) => {
    setSession((s) => (s == null ? s : commitMove(s, id, scenePoint).session));
  }, []);

  const onRollbackMove = useCallback(() => {
    setSession((s) => (s == null ? s : cancelGesture(s).session));
  }, []);

  const onOneFingerPan = useCallback((total: Point, startCamera: Camera) => {
    setCamera({ zoom: startCamera.zoom, tx: startCamera.tx + total.x, ty: startCamera.ty + total.y });
  }, []);

  const onViewGestureUpdate = useCallback(
    (start: { a: Point; b: Point }, current: { a: Point; b: Point }, startCamera: Camera) => {
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
    [zoomBounds],
  );

  const handlers = useMemo(
    () => ({
      onTapSelect: onSelect,
      onTapPlace: (scenePoint: ScenePoint) => {
        setSession((s) => (s == null ? s : appendVertex(s, scenePoint).session));
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

  // ─── controller actions ──────────────────────────────────────────────────

  const navigate = useCallback(
    (direction: -1 | 1) => {
      setSession((s) => {
        if (s == null) return s;
        const sids = s.draft.vertices.map((v) => v.id);
        const cur = indexOfVertexId(sids, s.selection.vertexId);
        const target = neighbourIndex(sids.length, s.draft.closed, cur, direction);
        if (target == null) return s;
        return selectVertex(s, sids[target], true).session;
      });
      setCamera((cam) => {
        if (!cam) return cam;
        const s = sessionRef.current;
        const sel = s?.selection.vertexId;
        if (s == null || sel == null) return cam;
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
      const sel = s?.selection.vertexId;
      if (!cam || s == null || sel == null) return;
      const v = s.draft.vertices.find((x) => x.id === sel);
      if (!v) return;
      const d = nudgeSceneDelta(cam, direction, nudgeStep);
      setSession((cur) => (cur == null ? cur : commitMove(cur, sel, { x: v.point.x + d.x, y: v.point.y + d.y }).session));
    },
    [nudgeStep],
  );

  // ─── review / validation (M1 rules; plan-area preview §8.3) ──────────────

  const review = useMemo(
    () =>
      session && scale
        ? outlineReview(session, scale, { sceneWidth: scene.width, sceneHeight: scene.height })
        : null,
    [session, scale, scene],
  );

  // ─── draft lifecycle: select / create / cancel / save ────────────────────

  const openAreaDraft = useCallback((area: SavedOutlineRecord) => {
    const adapter = adapterRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !context) return;
    setSession(beginSavedOutlineEdit(area, context));
    setSelectionMode('idle');
    setSaveState('idle');
    setSaveError(null);
    setShowCreateForm(false);
  }, []);

  const startNewDraft = useCallback(() => {
    const adapter = adapterRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !context) return;
    setSession(beginManualOutlineDraft(context));
    setSelectionMode('creating');
    setSaveState('idle');
    setSaveError(null);
    setShowCreateForm(false);
  }, []);

  const cancelDraft = useCallback(() => {
    setSession((s) => (s == null ? s : discardEdit(s).session)); // R13: restore the saved base
    setSelectionMode('idle');
    setSaveState('idle');
    setSaveError(null);
    setShowCreateForm(false);
  }, []);

  /** Switching selection with a dirty draft: Save/Discard/Stay (O16). */
  const requestSwitch = useCallback(
    (target: { kind: 'area'; area: SavedOutlineRecord } | { kind: 'new' }) => {
      if (dirty) {
        setPendingSwitch(target);
        return;
      }
      if (target.kind === 'area') openAreaDraft(target.area);
      else startNewDraft();
    },
    [dirty, openAreaDraft, startNewDraft],
  );

  const doSave = useCallback(async () => {
    const adapter = adapterRef.current;
    const s = sessionRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !s || !context || !scale) return;
    const result = outlineSaveIntent(s, context, scale, {
      sceneWidth: scene.width,
      sceneHeight: scene.height,
    });
    if (!result.ok) {
      setSaveState('failed');
      setSaveError(
        result.reason === 'stale-context'
          ? 'The page changed under this edit. Reopen the outline.'
          : result.reason === 'blocking-validation'
            ? (result.issues?.find((i) => i.severity === 'blocking')?.message ?? 'Fix the outline first.')
            : 'Nothing to save.',
      );
      return;
    }
    const intent = result.intent;
    setSaveState('saving');
    setSaveError(null);
    if (intent.kind === 'update-in-place') {
      const r = await adapter.updateOutline(intent); // patch_052 RPC (O05/O12/O13)
      if (r.ok) {
        // Acknowledged save: re-base on the server state (§11.1 layer 1).
        const area = adapter.getAreas().find((a) => a.geometryId === intent.geometryId) ?? null;
        const savedPoints = intent.points.map((p) => ({ ...p }));
        const freshContext = adapter.getEditContext() ?? context;
        setSession(
          area
            ? beginSavedOutlineEdit(
                { ...area, points: savedPoints },
                freshContext,
              )
            : beginSavedOutlineEdit(
                {
                  geometryId: intent.geometryId,
                  name: '',
                  pitch: 0,
                  quoteRoofAreaId: intent.quoteRoofAreaId,
                  fromPageId: context.pageId,
                  points: savedPoints,
                },
                freshContext,
              ),
        );
        setSaveState('saved');
        setPendingSwitch(null);
      } else {
        setSaveState('failed');
        setSaveError(r.staleVersion ? `${r.error} Your edits are kept.` : r.error); // O13
      }
      return;
    }
    // create-new: hand to the EXISTING flow (name/pitch prompt, §8.1).
    setShowCreateForm(true);
    setSaveState('idle');
  }, [scale, scene]);

  const confirmCreate = useCallback(
    (name: string, pitch: number) => {
      const adapter = adapterRef.current;
      const s = sessionRef.current;
      if (!adapter || !s || !scale) return;
      const context = adapter.getEditContext();
      if (!context) return;
      const result = outlineSaveIntent(s, context, scale, {
        sceneWidth: scene.width,
        sceneHeight: scene.height,
      });
      if (!result.ok || result.intent.kind !== 'create-new') return;
      adapter.createOutline(name, pitch, result.intent.points.map((p) => ({ ...p })));
      setShowCreateForm(false);
      setSession(null); // draft consumed by the create flow
      setSelectionMode('idle');
      setSaveState('saved');
    },
    [scale, scene],
  );

  // ─── overlay (single gesture owner; desktop never mounts it) ─────────────

  const overlay = active ? (
    <div
      ref={surfaceRef}
      data-testid="outline-editor-surface"
      className="absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
    >
      {camera && draft && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
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
            const isArmed = isSelected && session?.selection.moveArmed;
            const isInvalid = review?.blocking.some((issue) => issue.vertexIds?.includes(ids[i]));
            return (
              <g key={ids[i]}>
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeDasharray={isArmed ? '5 3' : 'none'} />
                )}
                {isSelected ? (
                  <>
                    <line x1={p.x - 5} y1={p.y} x2={p.x + 5} y2={p.y} stroke="#FF6B35" strokeWidth={1.5} />
                    <line x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5} stroke="#FF6B35" strokeWidth={1.5} />
                  </>
                ) : (
                  <circle cx={p.x} cy={p.y} r={3} fill="white" />
                )}
                {isInvalid && <text x={p.x + 16} y={p.y - 10} fontSize={11} fill="#fca5a5">!</text>}
              </g>
            );
          })}
        </svg>
      )}

      {/* O16: dirty-draft switch guard — Save / Discard / Stay. */}
      {pendingSwitch && (
        <div className="absolute inset-x-2 bottom-2 z-20 rounded-xl bg-slate-800/95 p-3 text-xs text-slate-100 shadow-lg">
          <div className="mb-2 font-semibold">Unsaved outline edits</div>
          <div className="mb-2 text-slate-300">Save them before switching, or discard to restore the saved outline.</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white"
              onClick={() => {
                void doSave();
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white"
              onClick={() => {
                const target = pendingSwitch;
                cancelDraft();
                setPendingSwitch(null);
                if (target.kind === 'area') openAreaDraft(target.area);
                else startNewDraft();
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
              onClick={() => setPendingSwitch(null)}
            >
              Stay
            </button>
          </div>
        </div>
      )}

      {/* §8.1: name/pitch confirmation for a NEW outline (existing flow). */}
      {showCreateForm && (
        <CreateOutlineForm
          defaultName={`Area ${new Date().getFullYear()}`}
          onCancel={() => setShowCreateForm(false)}
          onConfirm={confirmCreate}
        />
      )}
    </div>
  ) : null;

  // ─── rail ────────────────────────────────────────────────────────────────

  const canPrev = neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, -1) != null || selectedIndex < 0;
  const canNext = neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, 1) != null || selectedIndex < 0;

  const rail = active ? (
    <PointControllerRail
      counterLabel={
        selectedIndex >= 0 ? `Point ${selectedIndex + 1} of ${ids.length}` : `${ids.length} points`
      }
      armedCue={
        session == null
          ? 'Pick an outline below'
          : selectedId == null
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
      canInsert={canInsertAfter(ids.length, draft?.closed ?? false, selectedIndex)}
      onDelete={() => selectedId && applyCommand((s) => deleteVertex(s, selectedId))}
      canDelete={canDeleteVertex(ids.length, draft?.closed ?? false, selectedIndex)}
      gesturePhase={gesturePhase}
      onAdjust={() => selectedId && applyCommand((s) => selectVertex(s, selectedId, true))}
      canAdjust={selectedId != null}
      fineOpen={fineOpen}
      onToggleFine={() => setFineOpen((v) => !v)}
      onNudge={onNudge}
      nudgeStep={nudgeStep}
      onNudgeStepChange={setNudgeStep}
      onDoneFine={() => setFineOpen(false)}
      onFitPlan={() => viewport.width > 0 && setCamera(fitCamera(scene, viewport))}
      onZoomIn={() => zoomAroundCentre(ZOOM_STEP)}
      onZoomOut={() => zoomAroundCentre(1 / ZOOM_STEP)}
      onMovePlan={() => applyCommand((s) => selectVertex(s, s.selection.vertexId, false))}
    />
  ) : null;

  // ─── bottom strip: area selection + lifecycle + status (§3.5/§11.1) ──────

  const areas = adapterRef.current?.getAreas() ?? [];
  const statusLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' ? 'Saved'
    : saveState === 'failed' ? 'Save failed'
    : dirty ? 'Draft'
    : 'Draft';

  const hint =
    saveError ? saveError
    : review && review.blocking.length > 0 ? review.blocking[0].message
    : review?.planArea != null
      ? `Plan area ${review.planArea.toFixed(2)} ${scale?.unit === 'meters' ? 'm²' : 'ft²'}`
      : selectionMode === 'creating'
        ? 'Tap the plan to place points. Close when done.'
        : session
          ? 'Select a point, then drag or nudge.'
          : 'Pick an outline to edit, or start a new one.';

  const bottom = active ? (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-slate-400">
      <span className="min-w-0 max-w-[34%] truncate" aria-live="polite">{hint}</span>
      <span
        className={`rounded-full px-2.5 py-1 ${
          saveState === 'saved'
            ? 'bg-emerald-500/20 text-emerald-300'
            : saveState === 'failed'
              ? 'bg-red-500/20 text-red-300'
              : saveState === 'saving'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-white/10 text-slate-300'
        }`}
      >
        {statusLabel}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="group" aria-label="Saved outlines">
        {areas.map((a) => (
          <button
            key={a.geometryId ?? a.name}
            type="button"
            onClick={() => requestSwitch({ kind: 'area', area: a })}
            className={`h-8 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium ${
              isPersistedOutlineGeometryId(a.geometryId) && a.geometryId === (session?.target.kind === 'outline' ? session.target.geometryId : null)
                ? 'bg-white text-slate-900'
                : 'border border-white/20 text-white'
            }`}
          >
            {a.name}
          </button>
        ))}
        <button
          type="button"
          aria-label="New manual outline"
          onClick={() => requestSwitch({ kind: 'new' })}
          className="h-8 whitespace-nowrap rounded-full border border-white/20 px-2.5 text-[11px] font-medium text-white"
        >
          + New
        </button>
      </div>
      {session && (
        <>
          <button
            type="button"
            aria-label="Undo"
            onClick={() => setSession((s) => (s == null ? s : undo(s).session))}
            className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Redo"
            onClick={() => setSession((s) => (s == null ? s : redo(s).session))}
            className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
          >
            Redo
          </button>
          {!draft?.closed && (
            <button
              type="button"
              aria-label="Close outline"
              onClick={() => applyCommand((s) => closeOutline(s))}
              className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
            >
              Close
            </button>
          )}
          <button
            type="button"
            aria-label="Save outline changes"
            disabled={saveState === 'saving' || (review?.blocking.length ?? 0) > 0 || !dirty}
            onClick={() => {
              void doSave();
            }}
            className="h-12 min-w-12 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            aria-label="Cancel outline edit and restore the saved outline"
            onClick={cancelDraft}
            className="h-12 min-w-12 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  ) : null;

  return {
    overlay,
    rail,
    bottom,
    exitGuard: {
      dirty,
      onSave: () => {
        void doSave();
      },
      // O16: discard restores the saved base; an approved checkpoint save is
      // never rolled back (the server state is the re-base source).
      onDiscard: () => {
        setSession((s) => (s == null ? s : discardEdit(s).session));
        setSelectionMode('idle');
        setPendingSwitch(null);
        if (backHref) router.push(backHref);
      },
    },
  };
}

/** §8.1: required name/pitch confirmation before the create save. */
function CreateOutlineForm({
  defaultName,
  onCancel,
  onConfirm,
}: {
  defaultName: string;
  onCancel: () => void;
  onConfirm: (name: string, pitch: number) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [pitch, setPitch] = useState('0');
  return (
    <div
      role="dialog"
      aria-label="Name and pitch for the new outline"
      className="absolute inset-x-2 bottom-2 z-20 rounded-xl bg-slate-800/95 p-3 text-xs text-slate-100 shadow-lg"
    >
      <div className="mb-2 font-semibold">Use outline</div>
      <div className="mb-2 flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-slate-400">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-900 px-2 text-white focus:border-orange-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-slate-400">Pitch °</span>
          <input
            inputMode="decimal"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            className="h-10 w-24 rounded-lg border border-white/20 bg-slate-900 px-2 text-white focus:border-orange-500 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="h-12 min-w-12 flex-1 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white"
          onClick={() => {
            const p = Number.parseFloat(pitch);
            onConfirm(name.trim() || defaultName, Number.isFinite(p) && p >= 0 && p < 90 ? p : 0);
          }}
        >
          Use outline
        </button>
        <button
          type="button"
          className="h-12 min-w-12 flex-1 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
          onClick={onCancel}
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}
