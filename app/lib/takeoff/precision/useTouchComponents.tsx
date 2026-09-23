'use client';
// M10 F1/F2/F3/F4 + M11 (2026-09-23): touch components step lifecycle. The
// plan is the source of truth: ComponentsCanvas (plan raster + saved
// outline + every entry) stays mounted for the WHOLE step - scan,
// disclaimer, review, detail and drawing (remote-move gestures).
// Isolation and highlight are hook-local render state; the adapter holds
// data only. F4: ANY library component opens its own drawable page via
// getComponentTarget. M11: the draw interaction follows the component's
// measurement type (lineal = two points, area = polygon, count = single
// placement), AI placeholder groups can attach a real product
// (reassignComponentGroup), area components can reuse a saved roof area
// (addRoofAreaEntry), and a second post-scan modal teaches the attach step.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { rafterPitchFactor } from '@/app/lib/pricing/engine';
import type { TouchOutlineAdapter } from './TouchOutlineEditor';
import { TouchComponentsRail, type TouchAttachOption, type TouchComponentsPhase, type TouchRoofAreaOption } from './TouchComponentsRail';
import { ComponentsCanvas, type EntryDraftPoint } from './ComponentsCanvas';
import { usePrecisionCamera } from './usePrecisionCamera';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';
import { RailAction, RailViewControls } from './TouchRailControls';
import {
  COMPONENT_SCAN_DISCLAIMER,
  PLACEHOLDER_ATTACH_NOTICE,
  componentGroupSummary,
  componentIsSystemPlaceholder,
  drawModeForMeasurementType,
  polygonAreaCanvas,
  type TouchComponentEntry,
  type TouchComponentGroup,
  type TouchComponentScanStage,
  type TouchComponentTarget,
  type TouchDrawMode,
} from './touchComponents';
import { logTakeoffEvent } from './takeoffDiagnostics';

export interface TouchComponentsOptions {
  finishHref: string;
  mode: 'ai' | 'manual';
  components: { id: string; name: string; collection_id?: string | null; is_system?: boolean; measurement_type?: string | null }[];
  collections: { id: string; name: string }[];
}

/** Active drawing draft. Line = two confirm-locked endpoints; polygon =
 * tap-appended corners (the last one is remote-movable); point = one
 * remote-movable marker. */
type DrawState =
  | { mode: 'line'; slot: 0 | 1; p1: EntryDraftPoint | null; p2: EntryDraftPoint | null }
  | { mode: 'polygon'; pts: EntryDraftPoint[] }
  | { mode: 'point'; p: EntryDraftPoint | null }
  | null;

export interface TouchComponentsParts {
  rail: ReactNode;
  overlay: ReactNode;
  busy: boolean;
  dirty: boolean;
  /** M11: unsaved component entries exist (scan results, draws or attached
   * roof areas) - used by the shell's Exit-to-quote guard so leaving the
   * step can never silently vaporise a draft again. */
  hasEntries: boolean;
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
  const componentsRef = useRef(options.components);
  componentsRef.current = options.components;
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
  const [draw, setDraw] = useState<DrawState>(null);
  const [attachNoticeOpen, setAttachNoticeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const startedRef = useRef(false);

  const detailKey = detail?.componentId ?? null;
  const isolated = detailKey;
  const canDrawNew = !!detail && detail.componentId !== 'uncertain';
  const drawMode: TouchDrawMode = detail ? drawModeForMeasurementType(detail.measurementType) : 'line';
  const detailIsPlaceholder = componentIsSystemPlaceholder(detail?.componentId ?? null, options.components);

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
  const scale = adapter?.getScale() ?? null;
  const unitSystem: 'meters' | 'feet' = scale?.unit === 'feet' ? 'feet' : 'meters';

  const refreshFromAdapter = useCallback(() => {
    const current = adapterRef.current();
    setEntries(current?.getComponentEntries?.() ?? []);
    // M11 r3: scan defaults + uncertain keep their names on the grid;
    // attached/custom components show the swatch only (the detail page
    // always carries the full component name).
    setGroups((current?.getComponentGroups?.() ?? []).map(g => ({
      ...g,
      named: g.key === 'uncertain' || componentIsSystemPlaceholder(g.componentId, componentsRef.current),
    })));
  }, []);

  const cancelDraw = useCallback(() => {
    setDraw(null);
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
    setAttachNoticeOpen(false);
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

  // M11: attach a real product to the open AI placeholder group - the
  // adapter re-keys every entry to the chosen component (desktop parity).
  const onAttachComponent = useCallback((toComponentId: string) => {
    const current = adapterRef.current();
    const from = detail?.componentId;
    if (!current?.reassignComponentGroup || !from || from === toComponentId) return;
    current.reassignComponentGroup(from, toComponentId);
    const target = current.getComponentTarget?.(toComponentId) ?? null;
    if (target) setDetail(target);
    setComponentId(toComponentId);
    setHighlighted(null);
    refreshFromAdapter();
    logTakeoffEvent('components.placeholder.attached', { from, to: toComponentId });
  }, [detail, refreshFromAdapter]);

  // M11: area component + saved outline - attach the roof area instead of
  // redrawing it (pitched value; the save path recomputes from live pitch).
  const onAttachRoofArea = useCallback((geometryId: string) => {
    const current = adapterRef.current();
    const area = current?.getAreas?.().find(a => a.geometryId === geometryId);
    if (!current?.addRoofAreaEntry || !area || !detail) return;
    const entry = current.addRoofAreaEntry(detail, area);
    if (entry) {
      refreshFromAdapter();
      logTakeoffEvent('components.entry.roofarea.attached', { component: detail.displayName });
    }
  }, [detail, refreshFromAdapter]);

  // Drawing - the interaction follows the component's measurement type.
  const onStartNewEntry = useCallback(() => {
    if (!detail) return;
    const mode = drawModeForMeasurementType(detail.measurementType);
    setDraw(mode === 'line' ? { mode, slot: 0, p1: null, p2: null }
      : mode === 'polygon' ? { mode, pts: [] }
        : { mode, p: null });
    logTakeoffEvent('components.entry.draw.started', { component: detail.displayName, mode });
  }, [detail]);

  const saveEntry = useCallback((target: TouchComponentTarget, points: EntryDraftPoint[]) => {
    const entry = adapterRef.current()?.addComponentEntry?.(target, points);
    if (entry) {
      logTakeoffEvent('components.entry.draw.saved', { component: entry.displayName, mode: entry.kind, value: entry.value });
      cancelDraw();
      refreshFromAdapter();
    }
    return entry;
  }, [cancelDraw, refreshFromAdapter]);

  const onTapPlace = useCallback((point: EntryDraftPoint) => {
    setDraw(d => {
      if (!d) return d;
      if (d.mode === 'line') return d.slot === 0 ? { ...d, p1: point } : { ...d, p2: point };
      if (d.mode === 'polygon') return { ...d, pts: [...d.pts, point] };
      return { ...d, p: point };
    });
  }, []);
  // slot semantics per mode: line 0/1 -> p1/p2; polygon -> last corner;
  // point -> the marker.
  const onDraftMove = useCallback((slot: 0 | 1, point: EntryDraftPoint) => {
    setDraw(d => {
      if (!d) return d;
      if (d.mode === 'line') return slot === 0 ? { ...d, p1: point } : { ...d, p2: point };
      if (d.mode === 'polygon') {
        if (!d.pts.length) return d;
        return { ...d, pts: [...d.pts.slice(0, -1), point] };
      }
      return { ...d, p: point };
    });
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
    if (!detail || !draw) return;
    if (draw.mode === 'line') {
      if (draw.slot === 0) {
        if (!draw.p1) return;
        setDraw({ ...draw, slot: 1 });
        return;
      }
      if (draw.p1 && draw.p2) saveEntry(detail, [draw.p1, draw.p2]);
      return;
    }
    if (draw.mode === 'point' && draw.p) saveEntry(detail, [draw.p]);
  }, [draw, detail, saveEntry]);
  const onUndoPolygonPoint = useCallback(() => {
    setDraw(d => (d?.mode === 'polygon' ? { ...d, pts: d.pts.slice(0, -1) } : d));
  }, []);
  const onClosePolygon = useCallback(() => {
    if (!detail || !draw || draw.mode !== 'polygon' || draw.pts.length < 3) return;
    saveEntry(detail, draw.pts);
  }, [draw, detail, saveEntry]);

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

  const onAcceptDisclaimer = useCallback(() => {
    setPhase('review');
    // M11: teach the attach step when the scan produced placeholders.
    const hasPlaceholder = groups.some(g => componentIsSystemPlaceholder(g.componentId, componentsRef.current));
    if (modeRef.current === 'ai' && hasPlaceholder) setAttachNoticeOpen(true);
  }, [groups]);
  const onDiscardResults = useCallback(() => {
    cancelDraw();
    adapterRef.current()?.clearComponentOverlay?.();
    setGroups([]);
    setEntries([]);
    setDetail(null);
    setHighlighted(null);
    setAttachNoticeOpen(false);
    setPhase('review');
  }, [cancelDraw]);
  const onRetry = useCallback(() => { void runScan(); }, [runScan]);
  const onCancelScan = useCallback(() => { adapterRef.current()?.cancelComponentScan?.(); }, []);
  // F3: persist runs the standard save path with the touch rows injected
  // straight into the payload; failures keep the user here with entries.
  const onSaveContinue = useCallback(async () => {
    if (savingRef.current) return;
    const current = adapterRef.current();
    // M11 instrumentation: the entry count travels with every save event so
    // diagnostics can prove whether a save ran with rows or against an empty
    // draft (the 2026-09-23 vanishing-components investigation).
    const rows = current?.getComponentEntries?.().filter(e => e.componentId).length ?? 0;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    logTakeoffEvent('components.save.requested', { rows });
    try {
      const result = await current?.persistReviewedComponents?.();
      if (result && !result.ok) {
        setError(result.error);
        logTakeoffEvent('components.save.failed', { error: result.error, rows });
        return;
      }
      logTakeoffEvent('components.save.succeeded', { rows });
      router.push(options.finishHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The save failed. Your entries are kept.';
      setError(message);
      logTakeoffEvent('components.save.failed', { error: message, rows });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [router, options.finishHref]);

  const filteredComponents = libraryId
    ? options.components.filter(c => (c.collection_id ?? null) === libraryId)
    : options.components;
  const attachOptions: TouchAttachOption[] = options.components
    .filter(c => !c.is_system)
    .map(c => ({ id: c.id, name: c.name, collectionId: c.collection_id ?? null }));
  // Saved outlines (persisted ones only) offered for area reuse, with the
  // pitched value the entry will carry (recomputed live at save time).
  const roofAreas: TouchRoofAreaOption[] = (() => {
    const areas = adapter?.getAreas() ?? [];
    return areas
      .filter(a => a.points.length >= 3 && !!a.geometryId && !!a.quoteRoofAreaId)
      .map(a => {
        const plan = scale ? polygonAreaCanvas(a.points.map(p => ({ x: p.x, y: p.y }))) * scale.scale * scale.scale : 0;
        const pitched = plan * (a.pitch ? rafterPitchFactor(a.pitch) : 1);
        const unit2 = unitSystem === 'meters' ? 'm²' : 'ft²';
        return {
          geometryId: a.geometryId as string,
          name: a.name,
          label: `${pitched.toFixed(1)} ${unit2}${a.pitch ? ` (pitch ${Math.round(a.pitch)}°)` : ''}`,
        };
      });
  })();
  const detailEntries = detailKey ? entries.filter(e => e.key === detailKey) : [];
  const draftReady = (() => {
    if (!draw) return false;
    if (draw.mode === 'line') return draw.slot === 0 ? !!draw.p1 : !!draw.p2;
    if (draw.mode === 'point') return !!draw.p;
    return false;
  })();
  const drawViewControls = <RailViewControls onFit={fit} onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} disabled={!camera} />;

  const rail = active ? <TouchComponentsRail
    phase={phase} scanStage={scanStage} error={error} groups={groups}
    manualMode={modeRef.current === 'manual'}
    libraries={options.collections}
    components={filteredComponents}
    selectedLibraryId={libraryId} selectedComponentId={componentId}
    detailKey={detailKey} detailName={detail?.displayName ?? null} detailColour={detail?.colour ?? null}
    canDrawNew={canDrawNew}
    detailIsPlaceholder={detailIsPlaceholder}
    attachOptions={attachOptions}
    onAttachComponent={onAttachComponent}
    drawMode={drawMode}
    roofAreas={roofAreas}
    onAttachRoofArea={onAttachRoofArea}
    detailEntries={detailEntries}
    highlightedEntryId={highlighted} unitSystem={unitSystem}
    drawActive={draw != null} drawSlot={draw?.mode === 'line' ? draw.slot : null}
    polygonCount={draw?.mode === 'polygon' ? draw.pts.length : 0}
    draftReady={draftReady} viewControls={drawViewControls} saving={saving}
    onLibraryChange={onLibraryChange} onComponentChange={onComponentChange}
    onOpenDetail={onOpenDetail} onBackFromDetail={onBackFromDetail}
    onHighlight={onHighlight} onHideToggle={onHideToggle} onDeleteEntry={onDeleteEntry}
    onStartNewEntry={onStartNewEntry} onConfirmPoint={onConfirmPoint}
    onUndoPolygonPoint={onUndoPolygonPoint} onClosePolygon={onClosePolygon} onCancelDraw={cancelDraw}
    onRetry={onRetry} onCancelScan={onCancelScan}
    onSaveContinue={onSaveContinue} /> : null;

  // F1: the canvas is mounted for the ENTIRE step - the plan (raster +
  // outline + entries) is the source of truth and never goes blank. The
  // disclaimer sheet rides on top of it.
  const canvasDraft = draw?.mode === 'line'
    ? { p1: draw.p1, p2: draw.p2 }
    : draw?.mode === 'point'
      ? { p1: draw.p, p2: null }
      : { p1: null, p2: null };
  const overlay = !active ? null : (
    <ComponentsCanvas bindSurface={bindSurface} camera={camera} scene={scene} imageUrl={imageUrl}
      outlinePoints={outlinePoints} entries={entries} isolatedKey={isolated}
      highlightedId={highlighted} drawMode={draw?.mode ?? null}
      drawSlot={draw?.mode === 'line' ? draw.slot : draw?.mode === 'point' ? 0 : null}
      draft={canvasDraft} polygonDraft={draw?.mode === 'polygon' ? draw.pts : []}
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
      {attachNoticeOpen && (
        <FloatingCanvasSheet label="Attach your products" dialog modal>
          <div className="space-y-2 text-sm text-white">
            <div className="text-base font-semibold">Scan-assist default components</div>
            <p>{PLACEHOLDER_ATTACH_NOTICE}</p>
            <RailAction primary onClick={() => setAttachNoticeOpen(false)}>Got it</RailAction>
          </div>
        </FloatingCanvasSheet>
      )}
    </ComponentsCanvas>
  );

  return { rail, overlay, busy: phase === 'scanning' || saving, dirty: phase === 'scanning' || saving, hasEntries: entries.length > 0 };
}
