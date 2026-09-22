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
  aiOutlineCandidatesFromScanData,
  beginImportedOutlineDraft,
  outlineScanCalibrationGate,
  resolveAiOutlineApplication,
  type AiOutlineCandidate,
  type AiOutlineScanInfo,
  type AiOutlineScanResult,
  type AiOutlineScanStart,
} from './touchAiOutline';
import {
  fitCamera,
  pinchCamera,
  scenePointToViewport,
  type Camera,
  type SceneDescriptor,
} from './sceneViewport';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';
import { logTakeoffEvent } from './takeoffDiagnostics';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';

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
  /** M7: signed plan image URL for the current page (the touch overlay
   *  renders its own raster at its own camera — alignment with the plan is
   *  by construction, independent of the desktop Fabric canvas below). */
  getImageUrl(): string | null;
  /** Update-in-place save: routes to actions.ts updateTakeoffAreaGeometry
   *  and applies the acknowledged result to the workstation's own state. */
  updateOutline(intent: Extract<OutlineSaveIntent, { kind: 'update-in-place' }>): Promise<
    { ok: true } | { ok: false; error: string; staleVersion?: boolean }
  >;
  /** Create-new save: the EXISTING handleSaveArea flow (name/pitch fields,
   *  area-row creation, owner stamping). */
  createOutline(name: string, pitch: number, points: ScenePoint[]): void;
  /** M6: touch AI outline scan availability, or null when unentitled —
   *  the manual journey never depends on it (R01/O17). */
  getAiOutlineScanInfo(): AiOutlineScanInfo | null;
  /** M6: run the OUTLINE-ONLY scan (authorised scan1 stage, same billing as
   *  desktop; scans 2/3 never auto-run, O10). */
  startOutlineOnlyScan(): Promise<AiOutlineScanResult>;
  /** M6: cancel the in-flight scan (aborts + invalidates via the epoch, O11). */
  cancelOutlineOnlyScan(): void;
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
  /** M7 (O16, M5 deviation-4 close): route workstation-internal page/area
   * switches through the SAME dirty-draft guard. When a touch outline
   * draft is dirty, `requestExternalExit` opens the Save/Discard/Stay sheet
   * and runs `proceed` only after the user resolves it (save success or
   * discard); when clean it runs `proceed` immediately. */
  requestExternalExit: (label: string, proceed: () => void) => void;
}

type SwitchTarget =
  | { kind: 'area'; area: SavedOutlineRecord }
  | { kind: 'new' }
  | { kind: 'external'; label: string; proceed: () => void };

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type ScanState = 'idle' | 'scanning' | 'error';

/** Snapshot taken when an AI outline scan starts (O11): page identity +
 *  context epoch from the M1 EditContext, plus enough draft state to detect
 *  manual edits made while the request was in flight. */
interface ScanStartSnapshot extends AiOutlineScanStart {
  revision: number;
  undoDepth: number;
}

const ZOOM_STEP = 1.25;

export function useTouchOutlineEditor(
  active: boolean,
  getAdapter: () => TouchOutlineAdapter | null,
  backHref?: string,
  /** M9: when the page is uncalibrated the outline rail leads with a Calibrate
   *  action; this callback returns the flow to the calibration phase. */
  onCalibrate?: () => void,
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
  const pendingSwitchRef = useRef<SwitchTarget | null>(pendingSwitch);

  // ── M6: AI outline scan → editable imported draft (§8.2, O04/O10/O11) ──
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanCandidates, setScanCandidates] = useState<AiOutlineCandidate[] | null>(null);
  const [scanCandidateIndex, setScanCandidateIndex] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ name: string; pitch: number } | null>(null);
  const scanStartRef = useRef<ScanStartSnapshot | null>(null);
  // M7 pre-scan dirty guard (§8.2): true while the replace/cancel dialog is
  // open because the current draft has unsaved edits.
  const [pendingScanReplace, setPendingScanReplace] = useState(false);

  const [camera, setCamera] = useState<Camera | null>(null);
  const cameraRef = useRef<Camera | null>(camera);
  useEffect(() => {
    sessionRef.current = session;
    cameraRef.current = camera;
    adapterRef.current = getAdapter();
    pendingSwitchRef.current = pendingSwitch;
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
  // M7: observe by element identity (checked after every render) — the
  // overlay surface can mount late and remount on tool switches, and a
  // dependency-driven effect would keep observing a detached element.
  const roAttachedRef = useRef<Element | null>(null);
  const roCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!active || !el || roAttachedRef.current === el) return;
    roCleanupRef.current?.();
    roAttachedRef.current = el;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    roCleanupRef.current = () => ro.disconnect();
  });
  useEffect(() => () => { roCleanupRef.current?.(); }, []);

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
      getCamera: () => cameraRef.current ?? (viewport.width > 0 ? fitCamera(scene, viewport) : { zoom: 1, tx: 0, ty: 0 }),
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
    setScanCandidates(null); // M6: leaving the imported draft closes the offer
    setOfferOpen(false);
    setCreateDefaults(null);
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
    setScanCandidates(null);
    setOfferOpen(false);
    setCreateDefaults(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setSession((s) => (s == null ? s : discardEdit(s).session)); // R13: restore the saved base
    setSelectionMode('idle');
    setSaveState('idle');
    setSaveError(null);
    setShowCreateForm(false);
    // M6: cancelling an imported draft also drops the AI offer (§8.2 —
    // cancelling never destroys saved geometry, only the unsaved import).
    setScanCandidates(null);
    setScanCandidateIndex(0);
    setOfferOpen(false);
    setCreateDefaults(null);
  }, []);

  /** M7 (O16): workstation-internal switches (page dropdown, area switcher,
   *  upload-another) route through the same guard as area/new switching. */
  const requestExternalExit = useCallback(
    (label: string, proceed: () => void) => {
      if (dirty) {
        setPendingSwitch({ kind: 'external', label, proceed });
        return;
      }
      proceed();
    },
    [dirty],
  );

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
    logTakeoffEvent('outline.save.requested');
    const adapter = adapterRef.current;
    const s = sessionRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !s || !context || !scale) {
      // M7/M9: never fail silently — the user must know WHY nothing happened
      // (missing scale in particular: calibrate this page first).
      setSaveState('failed');
      if (!adapter || !s || !context) {
        setSaveError('Could not save — the takeoff session is not ready. Reload the page and try again.');
        logTakeoffEvent('outline.save.rejected', { reason: 'session-not-ready' });
      } else {
        setSaveError('Set the scale first — calibrate this page before saving an outline.');
        logTakeoffEvent('outline.save.rejected', { reason: 'uncalibrated' });
      }
      return;
    }
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
      logTakeoffEvent('outline.save.blocked', { reason: result.reason });
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
        // M7: an external action (workstation page/area switch) that was
        // gated on this save proceeds only AFTER the acknowledged commit.
        const pending = pendingSwitchRef.current;
        if (pending?.kind === 'external') pending.proceed();
      } else {
        setSaveState('failed');
        setSaveError(r.staleVersion ? `${r.error} Your edits are kept.` : r.error); // O13
        logTakeoffEvent('outline.save.update.failed', { staleVersion: r.staleVersion ?? false, error: r.error });
      }
      return;
    }
    // create-new: hand to the EXISTING flow (name/pitch prompt, §8.1).
    setShowCreateForm(true);
    setSaveState('idle');
  }, [scale, scene]);

  const confirmCreate = useCallback(
    (name: string, pitch: number) => {
      logTakeoffEvent('outline.create.confirmed', { name, pitch });
      const adapter = adapterRef.current;
      const s = sessionRef.current;
      const context = adapter?.getEditContext();
      // M9 (owner live-test 2026-09-21): EVERY failure path must act or
      // visibly report — the old silent `return`s here were the dead
      // 'Use outline' button. The form stays open so the user sees the
      // reason and keeps their entered name/pitch.
      const fail = (message: string, reason: string) => {
        setSaveState('failed');
        setSaveError(message);
        logTakeoffEvent('outline.create.rejected', { reason });
      };
      if (!adapter || !s || !context) {
        fail('Could not save — the takeoff session is not ready. Reload the page and try again.', 'session-not-ready');
        return;
      }
      if (!scale) {
        fail('Set the scale first — calibrate this page before saving an outline.', 'uncalibrated');
        return;
      }
      if (!s.draft.closed) {
        fail('Close the outline first (tap Close outline), then confirm.', 'not-closed');
        return;
      }
      if (review && review.blocking.length > 0) {
        fail(review.blocking[0].message, 'blocking-validation'); // invalid outline never saves
        return;
      }
      adapter.createOutline(name, pitch, s.draft.vertices.map((v) => ({ ...v.point })));
      setShowCreateForm(false);
      setSession(null); // draft consumed by the create flow
      setSelectionMode('idle');
      setSaveState('saved');
      setScanCandidates(null);
      setScanCandidateIndex(0);
      setOfferOpen(false);
      setCreateDefaults(null);
      // M7: resolve a pending external exit the same way as the
      // update-in-place path — only after the create actually committed
      // through the existing flow.
      const pending = pendingSwitchRef.current;
      setPendingSwitch(null);
      if (pending?.kind === 'external') pending.proceed();
    },
    [scale, review],
  );

  // ── M6: AI outline scan lifecycle (§8.2, O04/O10/O11) ────────────────────

  const scanInfo = adapterRef.current?.getAiOutlineScanInfo() ?? null;

  /** Import one detected candidate INTO the M5 edit draft (origin
   *  'imported') and present the edit-or-continue offer (§8.2). The offer
   *  is re-presentable: after Continue, the saved area appears as a normal
   *  chip whose points stay editable via the same M5 re-entry path. */
  const importCandidate = useCallback(
    (candidate: AiOutlineCandidate, all: AiOutlineCandidate[], index: number, context: EditContext) => {
      setSession(beginImportedOutlineDraft(candidate, context));
      setSelectionMode('idle');
      setSaveState('idle');
      setSaveError(null);
      setShowCreateForm(false);
      setScanCandidates(all);
      setScanCandidateIndex(index);
      setOfferOpen(true);
      setCreateDefaults({ name: candidate.name, pitch: candidate.pitch });
    },
    [],
  );

  const runScan = useCallback(async () => {
    const adapter = adapterRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !context) return;
    const s = sessionRef.current;
    logTakeoffEvent('outline.scan.requested');
    setScanState('scanning');
    setScanError(null);
    setScanCandidates(null);
    setOfferOpen(false);
    // O11 snapshot: page identity + epoch + draft state at scan start.
    scanStartRef.current = {
      pageId: context.pageId,
      imageRevision: context.imageRevision,
      contextEpoch: context.contextEpoch,
      revision: s?.draft.localGeometryRevision ?? -1,
      undoDepth: s?.history.undo.length ?? 0,
    };
    const result = await adapter.startOutlineOnlyScan();
    const started = scanStartRef.current;
    scanStartRef.current = null;
    const current = adapter.getEditContext();
    if (!started || !current) {
      setScanState('idle');
      return; // scan was reset (unmount/cancel) — discard silently
    }
    if (!result.ok) {
      if (result.cancelled) {
        setScanState('idle'); // user cancelled — no error message (R13 spirit)
        return;
      }
      logTakeoffEvent('outline.scan.failed', { error: result.error });
      setScanState('error');
      setScanError(result.error); // AI failure never blocks manual work (R01/O17)
      return;
    }
    // O11: manual edits, page switch, image revision change or cancellation
    // during the request DISCARD the result with an explicit message —
    // never a silent apply over human work.
    const cur = sessionRef.current;
    const manualEdits =
      (cur?.draft.localGeometryRevision ?? -1) !== started.revision ||
      (cur?.history.undo.length ?? 0) !== started.undoDepth;
    const decision = resolveAiOutlineApplication(
      started,
      {
        pageId: current.pageId,
        imageRevision: current.imageRevision,
        contextEpoch: current.contextEpoch,
      },
      manualEdits,
    );
    if (decision.action === 'discard') {
      setScanState('error');
      setScanError(decision.message);
      return;
    }
    const candidates = aiOutlineCandidatesFromScanData(result.data);
    if (candidates.length === 0) {
      setScanState('error');
      setScanError('No usable roof outline was detected. Draw the outline manually.');
      return;
    }
    setScanState('idle');
    importCandidate(candidates[0], candidates, 0, current);
  }, [importCandidate]);

  /** M7 pre-scan dirty guard (§8.2): an explicit scan may replace the current
   *  draft, but never silently over unsaved edits — ask replace/cancel first. */
  const startScan = useCallback(async () => {
    const adapter = adapterRef.current;
    const context = adapter?.getEditContext();
    if (!adapter || !context || scanState === 'scanning') return;
    // M8 HARD GATE (owner prescription 2026-09-21): scanning before the page
    // has a completed calibration must be impossible — enforce at the action
    // itself, not only the button.
    if (!outlineScanCalibrationGate(adapter.getScale()).allowed) return;
    if (dirty) {
      setPendingScanReplace(true);
      return;
    }
    await runScan();
  }, [dirty, runScan, scanState]);

  /** M8 post-accept flow: Continue presents the SAME name/pitch prompt as
   *  the manual journey (desktop takeoff semantics) — the AI candidate's
   *  name/pitch prefill it, but the user confirms. The confirm then accepts
   *  as-is through the same M5 create-new terminal path
   *  (adapter.createOutline → handleSaveArea). No duplicate rows, no AI
   *  internal components committed. */
  const acceptImportedAsIs = useCallback(() => {
    setShowCreateForm(true);
  }, []);

  // ─── overlay (single gesture owner; desktop never mounts it) ─────────────

  const imageUrl = adapterRef.current?.getImageUrl() ?? null;

  const overlay = active ? (
    <div
      ref={surfaceRef}
      data-testid="outline-editor-surface"
      className="absolute inset-0 z-10 overflow-hidden bg-slate-950"
      style={{ touchAction: 'none' }}
    >
      {/* M7: the overlay renders its OWN plan raster at its own camera —
          alignment between image and markers is by construction and never
          depends on the desktop Fabric canvas underneath (which may be
          panned/zoomed independently or unavailable). */}
      {camera && imageUrl && (
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`,
            transformOrigin: '0 0',
            width: scene.width,
            height: scene.height,
          }}
        >
          <img src={imageUrl} alt="Plan page" draggable={false} className="h-full w-full select-none" />
        </div>
      )}
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

      {/* O16: dirty-draft switch guard — Save / Discard / Stay. Also hosts
          M7 external switches (workstation page/area switch, upload-another)
          and the M7 pre-scan replace guard shares this slot via
          pendingScanReplace below. */}
      {pendingSwitch && (
        <FloatingCanvasSheet label="Unsaved outline edits" dialog modal className="text-xs text-slate-100">
          <div className="mb-2 font-semibold text-xs text-slate-100">Unsaved outline edits</div>
          <div className="mb-2 text-slate-300">
            {pendingSwitch.kind === 'external'
              ? `Save them before continuing (“${pendingSwitch.label}”), or discard to restore the saved outline.`
              : 'Save them before switching, or discard to restore the saved outline.'}
          </div>
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
                else if (target.kind === 'new') startNewDraft();
                else target.proceed();
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
        </FloatingCanvasSheet>
      )}

      {/* M7 (§8.2 pre-scan guard): starting an AI outline scan while a touch
          outline draft has unsaved edits asks replace/cancel — the scan
          result replaces the CURRENT draft, so an unacknowledged replacement
          must be explicit, never automatic. */}
      {pendingScanReplace && (
        <FloatingCanvasSheet label="Replace unsaved outline edits" dialog modal className="text-xs text-slate-100">
          <div className="mb-1 font-semibold text-xs text-slate-100">Unsaved outline edits</div>
          <div className="mb-2 text-slate-300">
            Scanning replaces your current outline draft. Replace it and scan, or cancel to keep editing.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white"
              onClick={() => {
                setPendingScanReplace(false);
                cancelDraft();
                void runScan();
              }}
            >
              Replace and scan
            </button>
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
              onClick={() => setPendingScanReplace(false)}
            >
              Cancel
            </button>
          </div>
        </FloatingCanvasSheet>
      )}

      {/* M6 §8.2: AI outline offer — "AI found this outline. Edit points or
          Continue." Continue accepts as-is through the same M5 create path;
          Edit points keeps the already-imported draft open; Discard restores
          the pre-scan state. Multiple detected roofs are switchable chips. */}
      {offerOpen && scanCandidates && (
        <FloatingCanvasSheet label="AI outline found" dialog className="text-xs text-slate-100">
          <div className="mb-1 font-semibold text-xs text-slate-100">AI found this outline</div>
          <div className="mb-2 text-slate-300">Edit points or Continue.</div>
          {scanCandidates.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Detected outlines">
              {scanCandidates.map((c, i) => (
                <button
                  key={`${c.name}-${i}`}
                  type="button"
                  disabled={dirty}
                  title={dirty ? 'Save or cancel your edits before switching AI outlines.' : undefined}
                  onClick={() => {
                    const context = adapterRef.current?.getEditContext();
                    if (!context) return;
                    importCandidate(c, scanCandidates, i, context);
                  }}
                  className={`h-10 rounded-full px-3 text-[11px] font-medium disabled:opacity-40 ${
                    i === scanCandidateIndex ? 'bg-white text-slate-900' : 'border border-white/20 text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white"
              onClick={acceptImportedAsIs}
            >
              Continue
            </button>
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white"
              onClick={() => setOfferOpen(false)}
            >
              Edit points
            </button>
            <button
              type="button"
              className="h-12 min-w-12 flex-1 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
              onClick={cancelDraft}
            >
              Discard
            </button>
          </div>
        </FloatingCanvasSheet>
      )}

      {/* §8.1: name/pitch confirmation for a NEW outline (existing flow). */}
      {showCreateForm && (
        <CreateOutlineForm
          defaultName={createDefaults?.name ?? `Area ${new Date().getFullYear()}`}
          defaultPitch={createDefaults?.pitch ?? 0}
          onCancel={() => setShowCreateForm(false)}
          onConfirm={confirmCreate}
        />
      )}
    </div>
  ) : null;

  // ─── rail ────────────────────────────────────────────────────────────────

  const canPrev = neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, -1) != null || selectedIndex < 0;
  const canNext = neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, 1) != null || selectedIndex < 0;

  // M8 post-accept flow (§8.1): closing a NEW outline accepts it — prompt
  // for name + pitch immediately through the same desktop data path. Saved
  // outlines (update-in-place) keep their name/pitch and are not prompted.
  const closeOutlineAndPrompt = useCallback(() => {
    const s = sessionRef.current;
    if (s == null) return;
    const res = closeOutline(s);
    if (res.rejected != null) return;
    setSession(res.session);
    const geometryId = s.target.kind === 'outline' ? s.target.geometryId : '';
    if (!isPersistedOutlineGeometryId(geometryId)) {
      setShowCreateForm(true);
    }
  }, []);

  // ─── area selection + lifecycle + status (§3.5/§11.1) — M8: lives in the rail */

  const areas = adapterRef.current?.getAreas() ?? [];
  // M9: uncalibrated outline phase (owner live-test: dismissing calibration
  // still advanced the flow). The rail leads with a clear Calibrate action
  // and new outlines are blocked until a scale exists — the state can no
  // longer be incoherent.
  const uncalibrated = scale == null;
  const statusLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' ? 'Saved'
    : saveState === 'failed' ? 'Save failed'
    : 'Draft';

  const scanGate = outlineScanCalibrationGate(scale);

  // M9: the hint is a STATUS line, never an error sink that another state
  // can mask — save/scan errors render as dedicated role=alert banners below
  // (the old ordering let the uncalibrated scan-gate message hide the save
  // error, which is why Save looked like a no-op in the owner test).
  const hint =
    scanState === 'scanning' ? 'Scanning for a roof outline…'
    : review && review.blocking.length > 0 ? review.blocking[0].message
    : review?.planArea != null
      ? `Plan area ${review.planArea.toFixed(2)} ${scale?.unit === 'meters' ? 'm²' : 'ft²'}`
      : selectionMode === 'creating'
        ? 'Tap the plan to place points. Close when done.'
        : session
          ? 'Select a point, then drag or nudge.'
          : 'Pick an outline to edit, or start a new one.';

  const rail = active ? (
    <>
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
      />

      {/* M8: outline tab panel — area chips + lifecycle + status live in the
          rail (owner prescription: everything in the rail, per-tab controls). */}
      <OutlinePanel
        uncalibrated={uncalibrated}
        onCalibrate={onCalibrate}
        saveError={saveError}
        scanError={scanError}
        areas={areas}
        statusLabel={statusLabel}
        statusTone={
          saveState === 'saved'
            ? 'saved'
            : saveState === 'failed'
              ? 'failed'
              : saveState === 'saving'
                ? 'saving'
                : 'idle'
        }
        hint={hint}
        activeGeometryId={session?.target.kind === 'outline' ? session.target.geometryId : null}
        onSwitchArea={(a) => requestSwitch({ kind: 'area', area: a })}
        onNew={() => requestSwitch({ kind: 'new' })}
        scanInfo={scanInfo}
        scanGate={scanGate}
        scanState={scanState}
        onStartScan={() => {
          void startScan();
        }}
        onCancelScan={() => adapterRef.current?.cancelOutlineOnlyScan()}
        sessionActive={session != null}
        draftClosed={draft?.closed ?? false}
        canUndo={session != null && session.history.undo.length > 0}
        canRedo={session != null && session.history.redo.length > 0}
        onUndo={() => setSession((s) => (s == null ? s : undo(s).session))}
        onRedo={() => setSession((s) => (s == null ? s : redo(s).session))}
        onCloseOutline={closeOutlineAndPrompt}
        canSave={saveState !== 'saving' && (review?.blocking.length ?? 0) === 0 && dirty}
        onSave={() => {
          void doSave();
        }}
        onCancel={cancelDraft}
      />
    </>
  ) : null;

  // M8: the shell bottom strip no longer exists — the outline panel is part
  // of the rail (kept as null for API compatibility with older consumers).
  const bottom: ReactNode = null;

  return {
    overlay,
    rail,
    bottom,
    requestExternalExit,
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
  defaultPitch = 0,
  onCancel,
  onConfirm,
}: {
  defaultName: string;
  /** M6: prefill from the imported AI candidate (name/pitch kept as-is). */
  defaultPitch?: number;
  onCancel: () => void;
  onConfirm: (name: string, pitch: number) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [pitch, setPitch] = useState(String(defaultPitch));
  return (
    <FloatingCanvasSheet label="Name and pitch for the new outline" dialog className="max-w-md text-xs text-slate-100">
      <div className="mb-2 font-semibold text-xs text-slate-100">Use outline</div>
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
    </FloatingCanvasSheet>
  );
}

/** M8: the Outline tab's rail panel — saved-area chips, new/scan actions,
 *  compact undo/redo icons, close/save/cancel lifecycle and the small draft
 *  status. Vertical, internally scrollable (the shell scrolls the rail). */
function OutlinePanel(props: {
  areas: SavedOutlineRecord[];
  statusLabel: string;
  statusTone: 'idle' | 'saving' | 'saved' | 'failed';
  hint: string;
  /** M9: true when the page has no completed calibration — the rail leads
   *  with a Calibrate action and new outlines are blocked. */
  uncalibrated: boolean;
  onCalibrate?: () => void;
  /** M9: dedicated visible error banners (role=alert) — failures can never
   *  be silent, and the hint can never mask them. */
  saveError: string | null;
  scanError: string | null;
  activeGeometryId: string | null;
  onSwitchArea: (area: SavedOutlineRecord) => void;
  onNew: () => void;
  scanInfo: AiOutlineScanInfo | null;
  scanGate: { allowed: true } | { allowed: false; message: string };
  scanState: 'idle' | 'scanning' | 'error';
  onStartScan: () => void;
  onCancelScan: () => void;
  sessionActive: boolean;
  draftClosed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCloseOutline: () => void;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const scanDisabled =
    props.scanState === 'scanning' ||
    (props.scanInfo?.blocked ?? false) ||
    !props.scanGate.allowed;
  const scanTitle = !props.scanGate.allowed
    ? props.scanGate.message
    : props.scanInfo?.blocked
      ? 'Out of AI points — draw the outline manually.'
      : `Scan outline with AI — uses ${props.scanInfo?.cost} AI points.`;
  return (
    <div className="mt-2 flex w-full flex-col gap-2 border-t border-white/10 pt-2" aria-label="Outline areas and actions">
      {/* M9 uncalibrated-state coherence (owner live-test): the rail LEADS
          with a clear Calibrate action — full text, never truncated — and new
          outlines are blocked until a scale exists. */}
      {props.uncalibrated && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-2.5 py-2"
          aria-label="Calibration required"
        >
          <span className="text-[11px] leading-snug text-amber-200">
            This page has no scale yet. Calibrate it first — outlines need a scale to measure area.
          </span>
          <button
            type="button"
            aria-label="Calibrate this page"
            disabled={!props.onCalibrate}
            onClick={props.onCalibrate}
            className="h-12 min-w-12 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Calibrate this page
          </button>
        </div>
      )}
      {props.scanError && (
        <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-2.5 py-2 text-[11px] leading-snug text-red-200">
          {props.scanError}
        </div>
      )}
      {props.saveError && (
        <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-2.5 py-2 text-[11px] leading-snug text-red-200">
          {props.saveError}
        </div>
      )}
      <span
        className={`rounded-full px-2.5 py-1 text-center text-[11px] font-semibold ${
          props.statusTone === 'saved'
            ? 'bg-emerald-500/20 text-emerald-300'
            : props.statusTone === 'failed'
              ? 'bg-red-500/20 text-red-300'
              : props.statusTone === 'saving'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-white/10 text-slate-300'
        }`}
        aria-live="polite"
      >
        {props.statusLabel}
      </span>
      <span className="text-center text-[11px] leading-snug text-slate-300" aria-live="polite">
        {props.hint}
      </span>

      <div className="flex flex-col gap-1" role="group" aria-label="Saved outlines">
        {props.areas.map((a) => (
          <button
            key={a.geometryId ?? a.name}
            type="button"
            onClick={() => props.onSwitchArea(a)}
            className={`h-10 min-w-0 truncate rounded-full px-2.5 text-[11px] font-medium ${
              isPersistedOutlineGeometryId(a.geometryId) && a.geometryId === props.activeGeometryId
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
          disabled={props.uncalibrated}
          title={props.uncalibrated ? 'Calibrate this page before drawing outlines.' : undefined}
          onClick={props.onNew}
          className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40"
        >
          + New outline
        </button>
        {/* M6: AI outline scan — entitled only (O10). M8 HARD GATE: disabled
            until the page has a completed calibration (owner prescription). */}
        {props.scanInfo?.available && (
          <button
            type="button"
            aria-label="Scan outline with AI"
            disabled={scanDisabled}
            title={scanTitle}
            onClick={props.onStartScan}
            className="h-12 min-w-12 rounded-full border border-[#FF6B35]/60 px-3 text-xs font-semibold text-[#FF6B35] disabled:opacity-40"
          >
            {props.scanState === 'scanning' ? 'Scanning…' : `AI scan · ${props.scanInfo.cost} pts`}
          </button>
        )}
        {props.scanState === 'scanning' && (
          <button
            type="button"
            aria-label="Cancel AI scan"
            onClick={props.onCancelScan}
            className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
          >
            Cancel scan
          </button>
        )}
      </div>

      {props.sessionActive && (
        <div className="flex flex-col gap-2">
          {/* M8: compact undo/redo icons (owner prescription). */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="History">
            <button
              type="button"
              aria-label="Undo"
              disabled={!props.canUndo}
              onClick={props.onUndo}
              className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
            >
              ↶
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled={!props.canRedo}
              onClick={props.onRedo}
              className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
            >
              ↷
            </button>
          </div>
          {!props.draftClosed && (
            <button
              type="button"
              aria-label="Close outline"
              onClick={props.onCloseOutline}
              className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
            >
              Close outline
            </button>
          )}
          <button
            type="button"
            aria-label="Save outline changes"
            disabled={!props.canSave}
            onClick={props.onSave}
            className="h-12 min-w-12 rounded-full bg-[#FF6B35] px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            aria-label="Cancel outline edit and restore the saved outline"
            onClick={props.onCancel}
            className="h-12 min-w-12 rounded-full border border-white/20 px-3 text-xs font-semibold text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
