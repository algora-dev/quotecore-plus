'use client';
// M10 P2/P3: touch components step lifecycle - auto-starts the AI component
// scan (scan2+scan3 continuations on the corrected outline) for AI mode,
// gates the results behind the D2 disclaimer, owns the component detail view
// (isolation, entry highlight, hide, delete) and routes Save & continue.
// Manual mode skips the scan and lands directly in the review rail.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { TouchOutlineAdapter } from './TouchOutlineEditor';
import { TouchComponentsRail, type TouchComponentsPhase } from './TouchComponentsRail';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';
import { RailAction } from './TouchRailControls';
import {
  COMPONENT_SCAN_DISCLAIMER,
  componentGroupSummary,
  type TouchComponentEntry,
  type TouchComponentGroup,
  type TouchComponentScanStage,
} from './touchComponents';
import { resolveSemanticKey } from '../aiComponentRegistry';
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
  const startedRef = useRef(false);

  const refreshFromAdapter = useCallback(() => {
    const current = adapterRef.current();
    setEntries(current?.getComponentEntries?.() ?? []);
    setGroups(current?.getComponentGroups?.() ?? []);
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
  }, [active]);

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
    adapterRef.current()?.setIsolatedComponentGroup?.(key);
    adapterRef.current()?.highlightComponentEntry?.(null);
    setDetailKey(key);
    setHighlighted(null);
  }, []);
  const onBackFromDetail = useCallback(() => {
    adapterRef.current()?.setIsolatedComponentGroup?.(null);
    adapterRef.current()?.highlightComponentEntry?.(null);
    setDetailKey(null);
    setHighlighted(null);
  }, []);
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

  const onLibraryChange = useCallback((id: string) => {
    setLibraryId(id);
    setComponentId(null);
  }, []);

  // P3: picking a component opens its group's detail view when one exists.
  const onComponentChange = useCallback((id: string) => {
    setComponentId(id);
    const comp = options.components.find(c => c.id === id);
    if (!comp) return;
    const semantic = resolveSemanticKey(comp.name);
    if (!semantic) return;
    const has = (adapterRef.current()?.getComponentGroups?.() ?? []).some(g => g.key === semantic);
    if (has) onOpenDetail(semantic);
  }, [options.components, onOpenDetail]);

  const onAcceptDisclaimer = useCallback(() => setPhase('review'), []);
  const onDiscardResults = useCallback(() => {
    adapterRef.current()?.clearComponentOverlay?.();
    setGroups([]);
    setEntries([]);
    setDetailKey(null);
    setHighlighted(null);
    setPhase('review');
  }, []);
  const onRetry = useCallback(() => { void runScan(); }, [runScan]);
  const onCancelScan = useCallback(() => { adapterRef.current()?.cancelComponentScan?.(); }, []);
  const onSaveContinue = useCallback(() => {
    logTakeoffEvent('components.save.continue');
    router.push(options.finishHref);
  }, [router, options.finishHref]);

  const filteredComponents = libraryId
    ? options.components.filter(c => (c.collection_id ?? null) === libraryId)
    : options.components;
  const detailEntries = detailKey ? entries.filter(e => e.key === detailKey) : [];
  const unitLabel = adapter?.getScale()?.unit === 'meters' ? 'm' : 'ft';

  const rail = active ? <TouchComponentsRail
    phase={phase} scanStage={scanStage} error={error} groups={groups}
    manualMode={modeRef.current === 'manual'}
    libraries={options.collections}
    components={filteredComponents}
    selectedLibraryId={libraryId} selectedComponentId={componentId}
    detailKey={detailKey} detailEntries={detailEntries}
    highlightedEntryId={highlighted} unitLabel={unitLabel}
    onLibraryChange={onLibraryChange} onComponentChange={onComponentChange}
    onOpenDetail={onOpenDetail} onBackFromDetail={onBackFromDetail}
    onHighlight={onHighlight} onHideToggle={onHideToggle} onDeleteEntry={onDeleteEntry}
    onRetry={onRetry} onCancelScan={onCancelScan}
    onSaveContinue={onSaveContinue} /> : null;

  const overlay = active && phase === 'disclaimer' ? (
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

  return { rail, overlay, busy: phase === 'scanning', dirty: phase === 'scanning' };
}
