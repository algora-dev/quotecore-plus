'use client';
// M10 P2/P3/P3b: touch components step lifecycle - auto-starts the AI
// component scan (scan2+scan3 continuations on the corrected outline) for AI
// mode, gates the results behind the D2 disclaimer, owns the component detail
// view (isolation, entry highlight, hide, delete) and the + New entry
// tap/drag/confirm drawing flow. Manual mode skips the scan and lands
// directly in the review rail.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { TouchOutlineAdapter } from './TouchOutlineEditor';
import { TouchComponentsRail, type TouchComponentsPhase } from './TouchComponentsRail';
import { EntryDrawCanvas, type EntryDraftPoint } from './EntryDrawCanvas';
import { usePrecisionCamera } from './usePrecisionCamera';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';
import { RailAction, RailViewControls } from './TouchRailControls';
import {
  COMPONENT_SCAN_DISCLAIMER,
  componentGroupSummary,
  type TouchComponentEntry,
  type TouchComponentGroup,
  type TouchComponentScanStage,
} from './touchComponents';
import { resolveSemanticKey, type SemanticKey } from '../aiComponentRegistry';
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
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [libraryId, setLibraryId] = useState('');
  const [componentId, setComponentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // P3b: + New entry drawing state.
  const [drawSlot, setDrawSlot] = useState<0 | 1 | null>(null);
  const [draft, setDraft] = useState<{ p1: EntryDraftPoint | null; p2: EntryDraftPoint | null }>({ p1: null, p2: null });
  const startedRef = useRef(false);

  const scene = adapter?.getScene() ?? null;
  const imageUrl = adapter?.getImageUrl() ?? null;
  const view = usePrecisionCamera(active && drawSlot != null, scene, 'components-entry-draw');
  const { camera, setCamera, fit, zoomBy, zoomBounds, bindSurface } = view;

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
    setDetailKey(null);
    setHighlighted(null);
    cancelDraw();
  }, [active, cancelDraw]);

  // Clear canvas isolation + entry highlight when the step deactivates.
  useEffect(() => {
    if (!active) return;
    return () => {
      const current = adapterRef.current();
      current?.setIsolatedComponentGroup?.(null);
      current?.highlightComponentEntry?.(null);
    };
  }, [active]);

  // Detail view: the group is isolated on the canvas while it is open.
  const onOpenDetail = useCallback((key: string) => {
    cancelDraw();
    adapterRef.current()?.setIsolatedComponentGroup?.(key);
    adapterRef.current()?.highlightComponentEntry?.(null);
    setDetailKey(key);
    setHighlighted(null);
  }, [cancelDraw]);
  const onBackFromDetail = useCallback(() => {
    cancelDraw();
    adapterRef.current()?.setIsolatedComponentGroup?.(null);
    adapterRef.current()?.highlightComponentEntry?.(null);
    setDetailKey(null);
    setHighlighted(null);
  }, [cancelDraw]);
  const onHighlight = useCallback((id: string | null) => {
    adapterRef.current()?.highlightComponentEntry?.(id);
    setHighlighted(id);
  }, []);
  const onHideToggle = useCallback((id: string, hidden: boolean) => {
    adapterRef.current()?.setEntryHidden?.(id, hidden);
    refreshFromAdapter();
  }, [refreshFromAdapter]);
  const onDeleteEntry = useCallback((id: string) => {
    adapterRef.current()?.deleteComponentEntry?.(id);
    setHighlighted(prev => (prev === id ? null : prev));
    refreshFromAdapter();
  }, [refreshFromAdapter]);

  // P3b: + New entry drawing (tap place, drag refine, confirm per point).
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
    if (drawSlot === 0) {
      if (!draft.p1) return;
      setDrawSlot(1);
      return;
    }
    if (drawSlot === 1 && draft.p1 && draft.p2 && detailKey) {
      const entry = adapterRef.current()?.addComponentEntry?.(detailKey as SemanticKey, draft.p1, draft.p2);
      if (entry) {
        logTakeoffEvent('components.entry.draw.saved', { key: entry.key, value: entry.value });
        cancelDraw();
        refreshFromAdapter();
      }
    }
  }, [drawSlot, draft, detailKey, cancelDraw, refreshFromAdapter]);

  const onLibraryChange = useCallback((id: string) => {
    setLibraryId(id);
    setComponentId(null);
  }, []);

  // P3: picking a component opens its group's detail view - ANY of the six
  // system types opens (empty manual groups included), others only when a
  // matching group was already detected.
  const onComponentChange = useCallback((id: string) => {
    setComponentId(id);
    const comp = options.components.find(c => c.id === id);
    if (!comp) return;
    const semantic = resolveSemanticKey(comp.name);
    if (semantic) onOpenDetail(semantic);
  }, [options.components, onOpenDetail]);

  const onAcceptDisclaimer = useCallback(() => setPhase('review'), []);
  const onDiscardResults = useCallback(() => {
    cancelDraw();
    adapterRef.current()?.clearComponentOverlay?.();
    setGroups([]);
    setEntries([]);
    setDetailKey(null);
    setHighlighted(null);
    setPhase('review');
  }, [cancelDraw]);
  const onRetry = useCallback(() => { void runScan(); }, [runScan]);
  const onCancelScan = useCallback(() => { adapterRef.current()?.cancelComponentScan?.(); }, []);
  // P4: persist the reviewed entries through the standard save path, then
  // navigate to the quote builder. Failures keep the user here with their
  // entries intact.
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
    detailKey={detailKey} detailEntries={detailEntries}
    highlightedEntryId={highlighted} unitLabel={unitLabel}
    drawSlot={drawSlot} draftReady={draftReady} viewControls={drawViewControls} saving={saving}
    onLibraryChange={onLibraryChange} onComponentChange={onComponentChange}
    onOpenDetail={onOpenDetail} onBackFromDetail={onBackFromDetail}
    onHighlight={onHighlight} onHideToggle={onHideToggle} onDeleteEntry={onDeleteEntry}
    onStartNewEntry={onStartNewEntry} onConfirmPoint={onConfirmPoint} onCancelDraw={cancelDraw}
    onRetry={onRetry} onCancelScan={onCancelScan}
    onSaveContinue={onSaveContinue} /> : null;

  const overlay = !active ? null
    : drawSlot != null && phase === 'review' ? (
      <EntryDrawCanvas bindSurface={bindSurface} camera={camera} scene={scene} imageUrl={imageUrl}
        groupColour={detailEntries[0]?.colour ?? '#FF6B35'}
        contextLines={detailEntries.map(e => e.points)}
        draft={draft} activeSlot={drawSlot}
        onTapPlace={onTapPlace} onDraftMove={onDraftMove} onPanBy={onPanBy} onZoomAt={onZoomAt} error={null} />
    ) : phase === 'disclaimer' ? (
      <FloatingCanvasSheet label="AI component scan results" dialog modal>
        <div className="space-y-2 text-sm text-white">
          <div className="text-base font-semibold">Component scan complete</div>
          <p>{componentGroupSummary(groups)}.</p>
          <p>{COMPONENT_SCAN_DISCLAIMER}</p>
          <RailAction primary onClick={onAcceptDisclaimer}>I understand - review results</RailAction>
          <RailAction onClick={onDiscardResults}>Discard results</RailAction>
        </div>
      </FloatingCanvasSheet>
    ) : null;

  return { rail, overlay, busy: phase === 'scanning' || saving, dirty: phase === 'scanning' || saving };
}
