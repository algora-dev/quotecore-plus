'use client';
// M10 F1/F2/F3/F4: touch components step lifecycle. The plan is the source
// of truth: ComponentsCanvas (plan raster + saved outline + every entry)
// stays mounted for the WHOLE step - scan, disclaimer, review, detail and
// the + New entry drawing (remote-move gestures). Isolation and highlight
// are hook-local render state; the adapter holds data only. F4: ANY
// library component opens its own drawable page via getComponentTarget.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { TouchOutlineAdapter } from './TouchOutlineEditor';
import { TouchComponentsRail, type TouchComponentsPhase } from './TouchComponentsRail';
import { ComponentsCanvas, type EntryDraftPoint } from './ComponentsCanvas';
import { usePrecisionCamera } from './usePrecisionCamera';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';
import { RailAction, RailViewControls } from './TouchRailControls';
import {
  COMPONENT_SCAN_DISCLAIMER,
  componentGroupSummary,
  type TouchComponentEntry,
  type TouchComponentGroup,
  type TouchComponentScanStage,
  type TouchComponentTarget,
} from './touchComponents';
import { logTakeoffEvent } from './takeoffDiagnostics';

export interface TouchComponentsOptions {
  finishHref: string;
  mode: 'ai' | 'manual';
  components: { id: string; name: string; collection_id?: string | null }[];
  collections: { id: string; name: string }[];
}

export interface TouchComponentsParts {
  rail: ReactNode;
  overlay: ReactNode;
  busy: boolean;
  dirty: boolean;
}

export function useTouchComponents(
  active: boolean,
  getAdapter: () => TouchOutlineAdapter | null,
  options: TouchComponentsOptions,
): TouchComponentsParts {
  const router = useRouter();
  const adapter = getAdapter();
  const adapterRef = useRef(getAdapter);
  adapterRef.current = getAdapter;
  const modeRef = useRef(options.mode);
  modeRef.current = options.mode;
  const activeRef = useRef(active);
  activeRef.current = active;
  const [phase, setPhase] = useState<TouchComponentsPhase>(options.mode === 'ai' ? 'scanning' : 'review');
  const [scanStage, setScanStage] = useState<TouchComponentScanStage>('lines');
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<TouchComponentGroup[]>([]);
  const [entries, setEntries] = useState<TouchComponentEntry[]>([]);
  // F4: the open component page - ANY library component, not just system types.
  const [detail, setDetail] = useState<TouchComponentTarget | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [libraryId, setLibraryId] = useState('');
  const [componentId, setComponentId] = useState<string | null>(null);
  const [drawSlot, setDrawSlot] = useState<0 | 1 | null>(null);
  const [draft, setDraft] = useState<{ p1: EntryDraftPoint | null; p2: EntryDraftPoint | null }>({ p1: null, p2: null });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const startedRef = useRef(false);

  const detailKey = detail?.componentId ?? null;
  const isolated = detailKey;
  const canDrawNew = !!detail && detail.componentId !== 'uncertain';

  const scene = adapter?.getScene() ?? null;
  const imageUrl = adapter?.getImageUrl() ?? null;
  // F1: one camera for the WHOLE step - the canvas never unmounts, so the
  // plan (source of truth) is visible during the scan, review, detail and
  // drawing alike.
  const view = usePrecisionCamera(active, scene, 'components');
  const { camera, setCamera, fit, zoomBy, zoomBounds, bindSurface } = view;
  // F1: the saved outline polygon - always rendered on the canvas.
  const outlinePoints = (() => {
    const saved = [...(adapter?.getAreas() ?? [])].filter(a => a.points.length >= 3).pop();
    return saved ? saved.points.map(p => ({ x: p.x, y: p.y })) : [];
  })();

  const refreshFromAdapter = useCallback(() => {
    const current = adapterRef.current();
    setEntries(current?.getComponentEntries?.() ?? []);
    setGroups(current?.getComponentGroups?.() ?? []);
  }, []);

  const cancelDraw = useCallback(() => {
    setDrawSlot(null);
    setDraft({ p1: null, p2: null });
  }, []);

  const runScan = useCallback(async () => {
    const current = adapterRef.current();
    if (!current?.startComponentScan) {
      setError('Component scanning is not available for this quote yet.');
      setPhase('error');
      return;
    }
    startedRef.current = true;
    setError(null);
    setPhase('scanning');
    setScanStage('lines');
    logTakeoffEvent('components.scan.requested');
    const result = await current.startComponentScan((stage) => { if (activeRef.current) setScanStage(stage); });
    if (!activeRef.current) return;
    if (!result.ok) {
      setError(result.cancelled ? 'The scan was cancelled.' : result.error);
      setPhase('error');
      logTakeoffEvent('components.scan.failed', { error: result.error });
      return;
    }
    refreshFromAdapter();
    setPhase('disclaimer');
    logTakeoffEvent('components.scan.succeeded');
  }, [refreshFromAdapter]);

  // AI mode: auto-start the component scan once when the step activates.
  useEffect(() => {
    if (!active) return;
    if (modeRef.current === 'manual') return;
    if (!startedRef.current && adapter?.startComponentScan) void runScan();
  }, [active, adapter, runScan]);

  // Leaving the step resets the lifecycle (a fresh entry re-scans).
  useEffect(() => {
    if (active) return;
    startedRef.current = false;
    setPhase(modeRef.current === 'ai' ? 'scanning' : 'review');
    setScanStage('lines');
    setError(null);
    setGroups([]);
    setEntries([]);
    setDetail(null);
    setHighlighted(null);
    cancelDraw();
  }, [active, cancelDraw]);

  // Detail view: isolation is a canvas RENDER state (the overlay hides other
  // groups); nothing touches the adapter.
  const onOpenDetail = useCallback((key: string) => {
    cancelDraw();
    setDetail(prev => {
      if (prev && prev.componentId === key) return prev;
      const current = adapterRef.current();
      // Swatch groups first; F4 fallback resolves ANY component id (this is
      // also how dropdown picks and swatch taps share one code path).
      const target = current?.getComponentTarget?.(key);
      if (target) return target;
      // Review-only 'uncertain' group: no component id, never persisted.
      return { componentId: key, key: null, displayName: 'Uncertain', colour: '#EC4899' };
    });
    setHighlighted(null);
  }, [cancelDraw]);
  const onBackFromDetail = useCallback(() => {
    cancelDraw();
    setDetail(null);
    setHighlighted(null);
  }, [cancelDraw]);
  const onHighlight = useCallback((id: string | null) => { setHighlighted(id); }, []);
  const onHideToggle = useCallback((id: string, hidden: boolean) => {
    adapterRef.current()?.setEntryHidden?.(id, hidden);
    refreshFromAdapter();
  }, [refreshFromAdapter]);
  const onDeleteEntry = useCallback((id: string) => {
    adapterRef.current()?.deleteComponentEntry?.(id);
    setHighlighted(prev => (prev === id ? null : prev));
    refreshFromAdapter();
  }, [refreshFromAdapter]);

  // F2: + New entry drawing - tap places, press-anywhere-and-drag moves the
  // point at an offset (remote move), Confirm locks. See ComponentsCanvas.
  const onStartNewEntry = useCallback(() => {
    setDraft({ p1: null, p2: null });
    setDrawSlot(0);
    logTakeoffEvent('components.entry.draw.started');
  }, []);
  const onTapPlace = useCallback((point: EntryDraftPoint) => {
    if (drawSlot === 0) setDraft(d => ({ ...d, p1: point }));
    else if (drawSlot === 1) setDraft(d => ({ ...d, p2: point }));
  }, [drawSlot]);
  const onDraftMove = useCallback((slot: 0 | 1, point: EntryDraftPoint) => {
    setDraft(d => (slot === 0 ? { ...d, p1: point } : { ...d, p2: point }));
  }, []);
  const onPanBy = useCallback((dx: number, dy: number) => {
    setCamera(cam => (cam ? { ...cam, tx: cam.tx + dx, ty: cam.ty + dy } : cam));
  }, [setCamera]);
  const onZoomAt = useCallback((factor: number, vx: number, vy: number) => {
    setCamera(cam => {
      if (!cam) return cam;
      const zoom = Math.min(zoomBounds.max, Math.max(zoomBounds.min, cam.zoom * factor));
      const sx = (vx - cam.tx) / cam.zoom;
      const sy = (vy - cam.ty) / cam.zoom;
      return { zoom, tx: vx - sx * zoom, ty: vy - sy * zoom };
    });
  }, [setCamera, zoomBounds]);
  const onConfirmPoint = useCallback(() => {
    if (!detail) return;
    if (drawSlot === 0) {
      if (!draft.p1) return;
      setDrawSlot(1);
      return;
    }
    if (drawSlot === 1 && draft.p1 && draft.p2) {
      const entry = adapterRef.current()?.addComponentEntry?.(detail, draft.p1, draft.p2);
      if (entry) {
        logTakeoffEvent('components.entry.draw.saved', { component: entry.displayName, value: entry.value });
        cancelDraw();
        refreshFromAdapter();
      }
    }
  }, [drawSlot, draft, detail, cancelDraw, refreshFromAdapter]);

  const onLibraryChange = useCallback((id: string) => {
    setLibraryId(id);
    setComponentId(null);
  }, []);

  // F4: picking ANY component opens its page (empty manual groups included).
  const onComponentChange = useCallback((id: string) => {
    setComponentId(id);
    const target = adapterRef.current()?.getComponentTarget?.(id);
    if (!target) return;
    cancelDraw();
    setDetail(target);
    setHighlighted(null);
  }, [cancelDraw]);

  const onAcceptDisclaimer = useCallback(() => setPhase('review'), []);
  const onDiscardResults = useCallback(() => {
    cancelDraw();
    adapterRef.current()?.clearComponentOverlay?.();
    setGroups([]);
    setEntries([]);
    setDetail(null);
    setHighlighted(null);
    setPhase('review');
  }, [cancelDraw]);
  const onRetry = useCallback(() => { void runScan(); }, [runScan]);
  const onCancelScan = useCallback(() => { adapterRef.current()?.cancelComponentScan?.(); }, []);
  // F3: persist runs the standard save path with the touch rows injected
  // straight into the payload; failures keep the user here with entries.
  const onSaveContinue = useCallback(async () => {
    if (savingRef.current) return;
    const current = adapterRef.current();
    savingRef.current = true;
    setSaving(true);
    setError(null);
    logTakeoffEvent('components.save.requested');
    try {
      const result = await current?.persistReviewedComponents?.();
      if (result && !result.ok) {
        setError(result.error);
        logTakeoffEvent('components.save.failed', { error: result.error });
        return;
      }
      logTakeoffEvent('components.save.succeeded');
      router.push(options.finishHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The save failed. Your entries are kept.';
      setError(message);
      logTakeoffEvent('components.save.failed', { error: message });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [router, options.finishHref]);

  const filteredComponents = libraryId
    ? options.components.filter(c => (c.collection_id ?? null) === libraryId)
    : options.components;
  const detailEntries = detailKey ? entries.filter(e => e.key === detailKey) : [];
  const unitLabel = adapter?.getScale()?.unit === 'meters' ? 'm' : 'ft';
  const draftReady = drawSlot === 0 ? !!draft.p1 : drawSlot === 1 ? !!draft.p2 : false;
  const drawViewControls = <RailViewControls onFit={fit} onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} disabled={!camera} />;

  const rail = active ? <TouchComponentsRail
    phase={phase} scanStage={scanStage} error={error} groups={groups}
    manualMode={modeRef.current === 'manual'}
    libraries={options.collections}
    components={filteredComponents}
    selectedLibraryId={libraryId} selectedComponentId={componentId}
    detailKey={detailKey} detailName={detail?.displayName ?? null} detailColour={detail?.colour ?? null}
    canDrawNew={canDrawNew}
    detailEntries={detailEntries}
    highlightedEntryId={highlighted} unitLabel={unitLabel}
    drawSlot={drawSlot} draftReady={draftReady} viewControls={drawViewControls} saving={saving}
    onLibraryChange={onLibraryChange} onComponentChange={onComponentChange}
    onOpenDetail={onOpenDetail} onBackFromDetail={onBackFromDetail}
    onHighlight={onHighlight} onHideToggle={onHideToggle} onDeleteEntry={onDeleteEntry}
    onStartNewEntry={onStartNewEntry} onConfirmPoint={onConfirmPoint} onCancelDraw={cancelDraw}
    onRetry={onRetry} onCancelScan={onCancelScan}
    onSaveContinue={onSaveContinue} /> : null;

  // F1: the canvas is mounted for the ENTIRE step - the plan (raster +
  // outline + entries) is the source of truth and never goes blank. The
  // disclaimer sheet rides on top of it.
  const overlay = !active ? null : (
    <ComponentsCanvas bindSurface={bindSurface} camera={camera} scene={scene} imageUrl={imageUrl}
      outlinePoints={outlinePoints} entries={entries} isolatedKey={isolated}
      highlightedId={highlighted} drawSlot={drawSlot} draft={draft}
      onTapPlace={onTapPlace} onDraftMove={onDraftMove} onPanBy={onPanBy} onZoomAt={onZoomAt} error={null}>
      {phase === 'disclaimer' && (
        <FloatingCanvasSheet label="AI component scan results" dialog modal>
          <div className="space-y-2 text-sm text-white">
            <div className="text-base font-semibold">Component scan complete</div>
            <p>{componentGroupSummary(groups)}.</p>
            <p>{COMPONENT_SCAN_DISCLAIMER}</p>
            <RailAction primary onClick={onAcceptDisclaimer}>I understand - review results</RailAction>
            <RailAction onClick={onDiscardResults}>Discard results</RailAction>
          </div>
        </FloatingCanvasSheet>
      )}
    </ComponentsCanvas>
  );

  return { rail, overlay, busy: phase === 'scanning' || saving, dirty: phase === 'scanning' || saving };
}
