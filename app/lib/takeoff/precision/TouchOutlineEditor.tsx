'use client';
// Touch-only orchestration. Geometry commands, scale, authorisation and
// persistence remain owned by the existing shared domain and workstation.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Point } from '../calibrationTypes';
import type { CommandResult, EditContext, PrecisionEditSession, ScenePoint } from './precisionTypes';
import { appendVertex, cancelGesture, closeOutline, commitMove, deleteVertex, insertAfter, previewMove, redo, selectVertex, undo } from './precisionEditor';
import { HIT_RADIUS_PX } from './precisionGestureMachine';
import { canDeleteVertex, canInsertAfter, minimalRevealTranslation, neighbourIndex } from './pointNavigation';
import { beginManualOutlineDraft, beginSavedOutlineEdit, isPersistedOutlineGeometryId, outlineExitGuard, outlineReview, outlineSaveIntent, type OutlineSaveIntent, type SavedOutlineRecord } from './touchOutlines';
import { aiOutlineCandidatesFromScanData, beginImportedOutlineDraft, outlineScanCalibrationGate, resolveAiOutlineApplication, type AiOutlineCandidate, type AiOutlineScanInfo, type AiOutlineScanResult } from './touchAiOutline';
import { pinchCamera, scenePointToViewport, type Camera, type SceneDescriptor } from './sceneViewport';
import type { CalibrationCommitPayload } from './touchCalibration';
import { usePrecisionPointerInput } from './usePrecisionPointerInput';
import { usePrecisionCamera } from './usePrecisionCamera';
import { usePlanRaster } from './usePlanRaster';
import { pointIsOnPlan } from './touchCalibrationFlow';
import { DEFAULT_ROOF_NAME, DEFAULT_ROOF_PITCH, parseRailNumber } from './touchNumberEntry';
import { NumericRail } from './NumericRail';
import { OutlineCanvas } from './OutlineCanvas';
import { TouchOutlineRail, type OutlineFinishChoice } from './TouchOutlineRail';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';
import { RailAction, RailViewControls } from './TouchRailControls';
import { logTakeoffEvent } from './takeoffDiagnostics';

export type TouchCreateResult =
  | { ok: true; geometryId: string; quoteRoofAreaId: string }
  | { ok: false; message: string; retryable: boolean };
export interface TouchOutlineAdapter {
  getAreas(): SavedOutlineRecord[];
  getEditContext(): EditContext | null;
  getScale(): { scale: number; unit: 'feet' | 'meters' } | null;
  getScene(): SceneDescriptor;
  getImageUrl(): string | null;
  /** Notify presentations when the stable bridge's live state changes. */
  subscribe?(listener: () => void): () => void;
  /** Adopt an already persisted calibration, not a second persistence path. */
  applyConfirmedCalibration?(pageId: string, payload: CalibrationCommitPayload): boolean;
  updateOutline(intent: Extract<OutlineSaveIntent, { kind: 'update-in-place' }>): Promise<
    { ok: true } | { ok: false; error: string; staleVersion?: boolean }>;
  createOutline(name: string, pitch: number, points: ScenePoint[]): Promise<TouchCreateResult>;
  getAiOutlineScanInfo(): AiOutlineScanInfo | null;
  startOutlineOnlyScan(): Promise<AiOutlineScanResult>;
  cancelOutlineOnlyScan(): void;
}
export interface TouchOutlineEditorParts {
  overlay: ReactNode; rail: ReactNode; bottom: ReactNode; wideRail: boolean; busy: boolean;
  exitGuard: { dirty: boolean; onSave: () => void; onDiscard: () => void; saveLabel?: string };
  requestExternalExit: (label: string, proceed: () => void) => void;
}
interface EditorOptions { finishHref?: string; pitch?: number; onPitchChange?: (pitch: number) => void;
  /** M10: called instead of navigating away when the user chooses a
   * components path on the finish screen (outline is already saved). */
  onEnterComponents?: (mode: 'ai' | 'manual') => void }
interface PendingLeave { label: string; proceed: () => void }

export function useTouchOutlineEditor(active: boolean, getAdapter: () => TouchOutlineAdapter | null,
  backHref?: string, onCalibrate?: () => void, options: EditorOptions = {}): TouchOutlineEditorParts {
  const router = useRouter();
  const adapter = getAdapter();
  const [, refreshBridge] = useState(0);
  useEffect(() => adapter?.subscribe?.(() => refreshBridge((n) => n + 1)), [adapter]);
  const context = adapter?.getEditContext() ?? null;
  const imageUrl = adapter?.getImageUrl() ?? null;
  const raster = usePlanRaster(active, imageUrl ?? '', context?.imageRevision ?? null);
  const scene = raster.scene;
  const view = usePrecisionCamera(active, scene, `${context?.pageId ?? 'loading'}|${imageUrl ?? ''}`);
  const { camera, cameraRef, setCamera, viewport, surfaceRef, zoomBounds } = view;
  const scale = adapter?.getScale() ?? null;
  const [session, setSession] = useState<PrecisionEditSession | null>(null);
  const [savedArea, setSavedArea] = useState<SavedOutlineRecord | null>(null);
  const [stage, setStage] = useState<'editing' | 'ai-review' | 'finish'>('editing');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<AiOutlineCandidate[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [pitchEntry, setPitchEntry] = useState<string | null>(null);
  const [localPitch, setLocalPitch] = useState(DEFAULT_ROOF_PITCH);
  const pitch = options.pitch ?? localPitch;
  const onPitchChange = options.onPitchChange ?? setLocalPitch;
  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);
  const busyRef = useRef(false);
  const presentationMounted = useRef(active);
  useEffect(() => {
    presentationMounted.current = active;
    return () => { presentationMounted.current = false; };
  }, [active]);
  const scanSequence = useRef(0);
  const scanInFlight = useRef(false);
  const sessionRef = useRef(session);
  const currentRef = useRef({ active, adapter, context, stage, pitchEntry, scanning, pendingLeave });
  useLayoutEffect(() => {
    sessionRef.current = session;
    currentRef.current = { active, adapter, context, stage, pitchEntry, scanning, pendingLeave };
  });
  const persisted = session?.target.kind === 'outline' && isPersistedOutlineGeometryId(session.target.geometryId);
  // An unchanged AI import is still UNACCEPTED, not a clean saved record.
  const dirty = !!session && (outlineExitGuard(session).dirty || (!persisted && session.draft.vertices.length > 0));
  const contextMatches = useCallback((s: PrecisionEditSession, ctx: EditContext | null) => !!ctx &&
    s.context.quoteId === ctx.quoteId && s.context.pageId === ctx.pageId &&
    s.context.imageRevision === ctx.imageRevision && s.context.contextEpoch === ctx.contextEpoch, []);
  const stale = !!session && !contextMatches(session, context);
  const ready = !!adapter && !!context && !!scene && !!camera && outlineScanCalibrationGate(scale).allowed;
  const review = useMemo(() => session && scale && scene ? outlineReview(session, scale,
    { sceneWidth: scene.width, sceneHeight: scene.height }) : null, [session, scale, scene]);
  const draft = session?.draft;
  const ids = draft?.vertices.map((v) => v.id) ?? [];
  const selectedIndex = ids.indexOf(session?.selection.vertexId ?? '');
  const selectedId = selectedIndex < 0 ? null : ids[selectedIndex];
  const editingAllowed = () => {
    const live = currentRef.current;
    const s = sessionRef.current;
    return live.active && !busyRef.current && !live.scanning && !live.pendingLeave && live.stage === 'editing' &&
      live.pitchEntry == null && !!s && contextMatches(s, live.context);
  };
  const editingRef = useRef(editingAllowed);
  useLayoutEffect(() => { editingRef.current = editingAllowed; });
  const apply = useCallback((command: (s: PrecisionEditSession) => CommandResult) => {
    if (busyRef.current) return;
    const s = sessionRef.current;
    if (!s) return;
    const result = command(s);
    if (result.rejected) { setError(result.rejected); return; }
    sessionRef.current = result.session;
    setSession(result.session); setError(null);
  }, []);
  const env = useMemo(() => ({
    hitMarker: (client: Point) => {
      if (!editingRef.current() || !cameraRef.current) return null;
      let nearest: { id: string; distance: number } | null = null;
      for (const vertex of sessionRef.current?.draft.vertices ?? []) {
        const p = scenePointToViewport(cameraRef.current, vertex.point);
        const distance = Math.hypot(p.x - client.x, p.y - client.y);
        if (distance <= HIT_RADIUS_PX && (!nearest || distance < nearest.distance)) nearest = { id: vertex.id, distance };
      }
      return nearest?.id ?? null;
    },
    armedVertexId: () => editingRef.current() && sessionRef.current?.selection.moveArmed ? sessionRef.current.selection.vertexId : null,
    canAppend: () => editingRef.current() && !sessionRef.current?.draft.closed,
    getCamera: () => cameraRef.current ?? { zoom: 1, tx: 0, ty: 0 },
    getScenePoint: (id: string) => sessionRef.current?.draft.vertices.find((v) => v.id === id)?.point ?? null,
  }), [cameraRef]);
  const handlers = useMemo(() => ({
    onTapSelect: (id: string) => apply((s) => selectVertex(s, id, true)),
    onTapPlace: (point: ScenePoint) => {
      if (!scene || !pointIsOnPlan(point, scene)) { setError('Tap on the plan, not outside the image.'); return; }
      apply((s) => appendVertex(s, point));
    },
    onPreviewMove: (id: string, point: ScenePoint) => apply((s) => previewMove(s, id, point)),
    onCommitMove: (id: string, point: ScenePoint) => {
      if (!scene || !pointIsOnPlan(point, scene)) { apply(cancelGesture); setError('Keep the point on the plan. Its previous position is kept.'); return; }
      apply((s) => commitMove(s, id, point));
    },
    onRollbackMove: () => apply(cancelGesture),
    onOneFingerPan: (delta: Point, start: Camera) => setCamera({ ...start, tx: start.tx + delta.x, ty: start.ty + delta.y }),
    onViewGestureUpdate: (start: { a: Point; b: Point }, current: { a: Point; b: Point }, cam: Camera) => {
      const span = (p: typeof start) => ({ mid: { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 }, distance: Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) });
      if (span(start).distance > 1e-6) setCamera(pinchCamera(cam, span(start), span(current), zoomBounds));
    }, onViewGestureEnd: () => {}, onGestureCancelled: () => {},
  }), [apply, scene, setCamera, zoomBounds]);
  const gesture = usePrecisionPointerInput(active && !!scene && !saving, surfaceRef, handlers, env);
  const gestureBusy = gesture !== 'idle' && gesture !== 'cancelled';

  const navigate = (direction: -1 | 1) => {
    const s = sessionRef.current;
    if (!s || gestureBusy) return;
    const index = s.draft.vertices.findIndex((v) => v.id === s.selection.vertexId);
    const next = neighbourIndex(s.draft.vertices.length, s.draft.closed, index, direction);
    if (next == null) return;
    const target = s.draft.vertices[next];
    apply((current) => selectVertex(current, target.id, true));
    setCamera((cam) => {
      if (!cam) return cam;
      const shift = minimalRevealTranslation(scenePointToViewport(cam, target.point), viewport);
      return shift ? { ...cam, tx: cam.tx + shift.x, ty: cam.ty + shift.y } : cam;
    });
  };
  const clear = () => {
    setSession(null); sessionRef.current = null; setSavedArea(null); setStage('editing');
    setCandidates([]); setCandidateIndex(0); setError(null); setPitchEntry(null);
  };
  const requestLeave = (label: string, proceed: () => void) => {
    if (busyRef.current || scanning) { setError('Please wait for the current operation to finish.'); return; }
    if (dirty) setPendingLeave({ label, proceed }); else proceed();
  };
  const startManual = () => {
    const ctx = adapter?.getEditContext();
    if (!ready || !ctx) { setError('Wait for the calibrated plan to finish loading.'); return; }
    requestLeave('Start a new outline', () => {
      clear(); const next = beginManualOutlineDraft(ctx); setSession(next); sessionRef.current = next;
    });
  };
  const openArea = (area: SavedOutlineRecord) => requestLeave('Open another roof outline', () => {
    const ctx = adapter?.getEditContext();
    if (!ctx) return;
    clear();
    const next = beginSavedOutlineEdit(area, ctx);
    const first = next.draft.vertices[0]?.id;
    const selected = first ? selectVertex(next, first, true).session : next;
    setSession(selected); sessionRef.current = selected; setSavedArea(area);
  });
  const done = () => {
    if (!session || !ready || gestureBusy) return;
    if (!session.draft.closed) { setError('Close the outline before continuing.'); return; }
    if (review?.blocking.length) { setError(review.blocking[0].message); return; }
    if (stale) { setError('The plan changed. Reopen the outline before saving.'); return; }
    if (selectedId) apply((s) => selectVertex(s, selectedId, false));
    setError(null); setStage('finish');
  };
  const save = async (choice: OutlineFinishChoice = 'finish') => {
    if (busyRef.current) return;
    const live = currentRef.current;
    const currentAdapter = live.adapter;
    const ctx = currentAdapter?.getEditContext() ?? null;
    const s = sessionRef.current;
    const currentScale = currentAdapter?.getScale() ?? null;
    if (!currentAdapter || !s || !scene || !currentScale || !contextMatches(s, ctx)) {
      setError('The calibrated plan changed or is not ready. Reopen the outline before saving.'); return;
    }
    const checked = outlineReview(s, currentScale, { sceneWidth: scene.width, sceneHeight: scene.height });
    if (!s.draft.closed || checked.blocking.length) { setError(checked.blocking[0]?.message ?? 'Close the outline first.'); return; }
    if (!savedArea && !parseRailNumber(String(pitch), 'pitch').ok) { setError('Pitch must be from 0 to less than 90 degrees.'); return; }
    // Synchronous latch: even two taps before React commits make one request.
    busyRef.current = true; setSaving(true); setError(null);
    logTakeoffEvent('outline.save.requested');
    try {
      const isSaved = s.target.kind === 'outline' && isPersistedOutlineGeometryId(s.target.geometryId);
      if (isSaved && outlineExitGuard(s).dirty) {
        const intent = outlineSaveIntent(s, ctx!, currentScale, { sceneWidth: scene.width, sceneHeight: scene.height });
        if (!intent.ok || intent.intent.kind !== 'update-in-place') throw new Error('The outline could not be validated for update. Your edit is kept.');
        const result = await currentAdapter.updateOutline(intent.intent);
        if (!result.ok) throw new Error(result.error);
      } else if (!isSaved) {
        // New manual and unchanged AI imports share this validation/adapter.
        const result = await currentAdapter.createOutline(DEFAULT_ROOF_NAME, pitch, s.draft.vertices.map((v) => ({ ...v.point })));
        if (!result.ok) throw new Error(result.message);
      }
      logTakeoffEvent('outline.save.succeeded');
      // A completed background save must not pull a departed user back here.
      if (!presentationMounted.current) return;
      clear();
      const leave = currentRef.current.pendingLeave;
      setPendingLeave(null);
      // M10 fork: entering the components step keeps the user in the touch
      // flow (outline already saved); a stale pendingLeave is dropped.
      if (choice !== 'finish') options.onEnterComponents?.(choice === 'components-ai' ? 'ai' : 'manual');
      else if (leave) leave.proceed();
      else if (options.finishHref) router.push(options.finishHref);
      else if (backHref) router.push(backHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The roof could not be saved.';
      setError(`${message} Your outline is kept.`);
      logTakeoffEvent('outline.save.failed', { error: message });
    } finally { busyRef.current = false; setSaving(false); }
  };
  const importCandidate = (all: AiOutlineCandidate[], index: number, ctx: EditContext) => {
    const next = beginImportedOutlineDraft(all[index], ctx);
    setSession(next); sessionRef.current = next; setSavedArea(null);
    setCandidates(all); setCandidateIndex(index); setStage('ai-review'); setError(null);
    // Deliberately do not use the model's name or pitch: user's chosen pitch wins.
  };
  const runScan = async () => {
    const currentAdapter = adapter;
    const ctx = currentAdapter?.getEditContext();
    const info = currentAdapter?.getAiOutlineScanInfo();
    if (!currentAdapter || !ctx || !ready || !info || info.blocked || scanInFlight.current || busyRef.current) return;
    scanInFlight.current = true;
    const sequence = ++scanSequence.current;
    const before = sessionRef.current;
    setScanning(true); setError(null); logTakeoffEvent('outline.scan.requested');
    try {
      const result = await currentAdapter.startOutlineOnlyScan();
      if (sequence !== scanSequence.current || !currentRef.current.active) return;
      const now = currentAdapter.getEditContext();
      if (!now) throw new Error('The plan is no longer available.');
      const decision = resolveAiOutlineApplication(ctx, now, sessionRef.current !== before);
      if (decision.action === 'discard') throw new Error(decision.message);
      if (!result.ok) { if (!result.cancelled) throw new Error(result.error); return; }
      const found = aiOutlineCandidatesFromScanData(result.data).filter((c) => c.usable);
      if (!found.length) throw new Error('No usable roof outline was found. You can draw it manually.');
      importCandidate(found, 0, now);
    } catch (err) {
      if (sequence === scanSequence.current) setError(err instanceof Error ? err.message : 'The scan failed. Try manually.');
    } finally { if (sequence === scanSequence.current) { scanInFlight.current = false; setScanning(false); } }
  };
  const cancelScan = () => {
    scanSequence.current += 1; scanInFlight.current = false; adapter?.cancelOutlineOnlyScan(); setScanning(false);
  };
  useEffect(() => {
    if (!active) { queueMicrotask(() => setScanning(false)); return; }
    return () => { scanSequence.current += 1; scanInFlight.current = false; adapter?.cancelOutlineOnlyScan(); };
  }, [active, adapter]);
  useEffect(() => {
    if (!active || (!dirty && !saving)) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [active, dirty, saving]);
  const railStage = saving ? 'saving' : scanning ? 'scanning' : !session ? 'choose'
    : stage === 'finish' ? 'finish' : stage === 'ai-review' ? 'ai-review' : draft?.closed ? 'edit' : 'draw';
  const validation = stale ? 'The plan changed. Cancel this draft and reopen the outline.'
    : draft?.closed ? review?.blocking[0]?.message ?? null : null;
  const viewControls = <><RailViewControls onFit={view.fit} onZoomIn={() => view.zoomBy(1.25)} onZoomOut={() => view.zoomBy(0.8)} disabled={!camera || gestureBusy || saving} />
    {raster.error && <RailAction onClick={raster.retry}>Retry image</RailAction>}</>;
  const rail = pitchEntry != null ? <NumericRail kind="pitch" unit="°" value={pitchEntry} onChange={setPitchEntry}
    onBack={() => setPitchEntry(null)} onConfirm={(value) => { onPitchChange(value); setPitchEntry(null); }} />
    : <TouchOutlineRail stage={railStage} ready={ready && !stale} calibrated={!!scale}
      error={error ?? raster.error} validation={validation} count={ids.length} index={selectedIndex}
      armed={session?.selection.moveArmed ?? false} closed={draft?.closed ?? false} gestureBusy={gestureBusy}
      canPrevious={neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, -1) != null}
      canNext={neighbourIndex(ids.length, draft?.closed ?? false, selectedIndex, 1) != null}
      canInsert={canInsertAfter(ids.length, draft?.closed ?? false, selectedIndex)}
      canDelete={canDeleteVertex(ids.length, draft?.closed ?? false, selectedIndex)}
      canUndo={!!session?.history.undo.length} canRedo={!!session?.history.redo.length}
      planArea={review?.planArea == null ? null : `Plan area ${review.planArea.toFixed(2)} ${scale?.unit === 'meters' ? 'm²' : 'ft²'}`}
      savedArea={savedArea} areas={adapter?.getAreas() ?? []} pitch={pitch} scanInfo={adapter?.getAiOutlineScanInfo() ?? null}
      candidateCount={candidates.length} candidateIndex={candidateIndex} viewControls={viewControls}
      onManual={startManual} onArea={openArea} onCalibrate={onCalibrate}
      onScan={() => requestLeave('Replace the draft with an AI scan', () => { void runScan(); })} onCancelScan={cancelScan}
      onCandidate={(index) => { if (context) importCandidate(candidates, index, context); }}
      onPrevious={() => navigate(-1)} onNext={() => navigate(1)}
      onInsert={() => selectedId && apply((s) => insertAfter(s, selectedId))}
      onDelete={() => selectedId && apply((s) => deleteVertex(s, selectedId))}
      onRearm={() => selectedId && apply((s) => selectVertex(s, selectedId, true))}
      onUndo={() => apply(undo)} onRedo={() => apply(redo)}
      onConfirmPoint={() => selectedId && apply((s) => selectVertex(s, selectedId, false))}
      onClose={() => apply(closeOutline)} onDone={done}
      onEdit={() => { setStage('editing'); const id = selectedId ?? ids[0]; if (id) apply((s) => selectVertex(s, id, true)); }}
      onCancel={() => requestLeave('Discard this outline', clear)} onSave={(choice) => { void save(choice); }}
      onPitchChange={onPitchChange} onTypePitch={() => setPitchEntry(String(pitch))} />;
  const overlay = active ? <OutlineCanvas bindSurface={view.bindSurface} camera={camera} scene={scene}
    imageUrl={imageUrl} session={stale ? null : session} selectedIndex={selectedIndex} error={raster.error}>
    {pendingLeave && <FloatingCanvasSheet label="Unsaved outline" dialog modal>
      <div className="space-y-2 text-sm text-white">
        <p>Your outline has not been saved.</p>
        <RailAction primary disabled={saving} onClick={() => { setPendingLeave(null); setStage(draft?.closed ? 'finish' : 'editing'); }}>Return to outline</RailAction>
        <RailAction disabled={saving} onClick={() => {
          const next = pendingLeave.proceed; setPendingLeave(null); clear(); next();
        }}>Discard and continue</RailAction>
        <RailAction disabled={saving} onClick={() => setPendingLeave(null)}>Stay</RailAction>
      </div>
    </FloatingCanvasSheet>}
  </OutlineCanvas> : null;
  return { overlay, rail: active ? rail : null, bottom: null, wideRail: pitchEntry != null,
    busy: saving || scanning, requestExternalExit: requestLeave,
    exitGuard: { dirty, saveLabel: 'Return to outline', onSave: () => { setStage(draft?.closed ? 'finish' : 'editing'); },
      onDiscard: () => { if (busyRef.current) return; clear(); if (backHref) router.push(backHref); } } };
}
