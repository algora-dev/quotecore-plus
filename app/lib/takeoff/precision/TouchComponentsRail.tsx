'use client';
// M10 P2/P3 + M11 (2026-09-23 owner pass): the touch components rail.
// Main view: library + component dropdowns, then the swatch helper text,
// then the colour swatch grid (dropdowns first per owner prescription).
// Detail view (tap a swatch or pick a component): that group's entries -
// tap to highlight, hide/show, delete; AI placeholder groups get "attach
// real component"; area components can reuse a saved roof area. The draw
// interaction follows the component's measurement type: lineal = two
// points, area = polygon, count/item = single placement.
import type { ReactNode } from 'react';
import { RailAction, RailNotice, RailTask, ScanProgress } from './TouchRailControls';
import { unitSuffixForKind, type TouchComponentEntry, type TouchComponentGroup, type TouchComponentScanStage, type TouchDrawMode } from './touchComponents';

export type TouchComponentsPhase = 'scanning' | 'disclaimer' | 'review' | 'error';

/** Non-system components offered by "attach real component". */
export interface TouchAttachOption { id: string; name: string; collectionId: string | null }

/** Saved outlines offered by "use an existing roof area" (area components). */
export interface TouchRoofAreaOption { geometryId: string; name: string; label: string }

const SELECT_CLASS = 'min-h-[72px] w-full rounded-xl border border-white/20 bg-white/10 px-2 text-base font-semibold text-white';

export interface TouchComponentsRailProps {
  phase: TouchComponentsPhase;
  scanStage: TouchComponentScanStage;
  error: string | null;
  groups: TouchComponentGroup[];
  manualMode: boolean;
  libraries: { id: string; name: string }[];
  components: { id: string; name: string }[];
  selectedLibraryId: string;
  selectedComponentId: string | null;
  /** Open component detail (P3) or null for the main view. */
  detailKey: string | null;
  detailName: string | null;
  detailColour: string | null;
  /** False only for the review-only 'uncertain' group (no + New drawing). */
  canDrawNew: boolean;
  /** M11: the open group is an AI system placeholder - show attach. */
  detailIsPlaceholder: boolean;
  attachOptions: TouchAttachOption[];
  onAttachComponent: (componentId: string) => void;
  /** M11: draw interaction for the open component. */
  drawMode: TouchDrawMode;
  roofAreas: TouchRoofAreaOption[];
  onAttachRoofArea: (geometryId: string) => void;
  detailEntries: TouchComponentEntry[];
  highlightedEntryId: string | null;
  unitSystem: 'meters' | 'feet';
  /** M11: any draw in progress (line slots, polygon or point). */
  drawActive: boolean;
  /** Line mode only: which endpoint is being placed. */
  drawSlot: 0 | 1 | null;
  /** Polygon mode: vertices placed so far. */
  polygonCount: number;
  draftReady: boolean;
  viewControls: ReactNode;
  onStartNewEntry: () => void;
  onConfirmPoint: () => void;
  onUndoPolygonPoint: () => void;
  onClosePolygon: () => void;
  onCancelDraw: () => void;
  saving: boolean;
  onLibraryChange: (id: string) => void;
  onComponentChange: (id: string) => void;
  onOpenDetail: (key: string) => void;
  onBackFromDetail: () => void;
  onHighlight: (id: string | null) => void;
  onHideToggle: (id: string, hidden: boolean) => void;
  onDeleteEntry: (id: string) => void;
  onRetry: () => void;
  onCancelScan: () => void;
  onSaveContinue: () => void;
}

function entryValueLabel(e: TouchComponentEntry, unitSystem: 'meters' | 'feet'): string {
  if (e.kind === 'point') return `${e.value.toFixed(0)} item${Math.abs(e.value - 1) > 0.001 ? 's' : ''}`;
  return `${e.value.toFixed(1)} ${unitSuffixForKind(e.kind, unitSystem)}${e.fromRoofAreaId ? ' (roof area)' : ''}`;
}

export function TouchComponentsRail(p: TouchComponentsRailProps) {
  // ── Component detail view (one group's entries) ─────────────────────
  if (p.detailKey && p.phase === 'review') {
    const detailGroup = p.groups.find(g => g.key === p.detailKey);
    const detailName = p.detailName ?? detailGroup?.displayName ?? p.detailEntries[0]?.displayName ?? 'Component';
    const detailColour = p.detailColour ?? detailGroup?.colour ?? '#ffffff';
    const drawCopy: Record<TouchDrawMode, string> = {
      line: 'Tap the plan to set the START point. To fine-tune, press anywhere and drag - the point follows at a distance so your thumb never covers it. Confirm when happy, then do the same for the END point.',
      polygon: 'Tap the plan to add each corner of the area. After each tap, press anywhere and drag to fine-tune the last corner. Close the shape once you have 3 or more corners.',
      point: 'Tap the plan to place the item. To fine-tune, press anywhere and drag - the marker follows at a distance so your thumb never covers it.',
    };
    if (p.drawActive) {
      return <RailTask label={`Draw ${detailName} entry`}>
        <RailAction label="Back to all components" onClick={p.onBackFromDetail}>&#8249; All components</RailAction>
        <div className="flex items-center gap-2 px-1 py-1">
          <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-black/30" style={{ backgroundColor: detailColour }} />
          <div className="text-base font-semibold text-white">{detailName}</div>
        </div>
        <RailNotice>{drawCopy[p.drawMode]}</RailNotice>
        {p.viewControls}
        <RailNotice>Drag empty space to pan. Pinch to zoom.</RailNotice>
        <div className="flex flex-col gap-1 pt-1">
          {p.drawMode === 'polygon'
            ? <>
              <RailAction primary disabled={p.polygonCount < 3} onClick={p.onClosePolygon}>Close shape &amp; save</RailAction>
              <RailAction disabled={p.polygonCount === 0} onClick={p.onUndoPolygonPoint}>Undo last corner</RailAction>
            </>
            : <RailAction primary disabled={!p.draftReady} onClick={p.onConfirmPoint}>
              {p.drawMode === 'point' ? 'Confirm & save item' : p.drawSlot === 0 ? 'Confirm point' : 'Confirm point & save entry'}
            </RailAction>}
          <RailAction onClick={p.onCancelDraw}>Cancel new entry</RailAction>
        </div>
      </RailTask>;
    }
    // Group the attach options by library for one tappable select.
    const attachByLibrary = (() => {
      const groups: { id: string | null; name: string; options: TouchAttachOption[] }[] = [];
      for (const lib of p.libraries) {
        const options = p.attachOptions.filter(o => o.collectionId === lib.id);
        if (options.length) groups.push({ id: lib.id, name: lib.name, options });
      }
      const unfiled = p.attachOptions.filter(o => o.collectionId == null || !p.libraries.some(l => l.id === o.collectionId));
      if (unfiled.length) groups.push({ id: null, name: 'Uncategorised', options: unfiled });
      return groups;
    })();
    return <RailTask label={`${detailName} entries`}>
      <RailAction label="Back to all components" onClick={p.onBackFromDetail}>&#8249; All components</RailAction>
      <div className="flex items-center gap-2 px-1 py-1">
        <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-black/30" style={{ backgroundColor: detailColour }} />
        <div className="text-base font-semibold text-white">{detailName}</div>
      </div>
      {p.detailIsPlaceholder && p.attachOptions.length > 0 && <>
        <RailNotice>AI placeholder - attach a real component so the quote gets pricing.</RailNotice>
        <select value="" aria-label="Attach real component" className={SELECT_CLASS}
          onChange={e => { if (e.target.value) p.onAttachComponent(e.target.value); }}>
          <option value="">Attach real component...</option>
          {attachByLibrary.map(g => <optgroup key={g.id ?? 'uncategorised'} label={g.name}>
            {g.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </optgroup>)}
        </select>
      </>}
      {p.drawMode === 'polygon' && p.roofAreas.length > 0 && <>
        <RailNotice>Area component - reuse a saved roof area instead of drawing it again.</RailNotice>
        <select value="" aria-label="Use an existing roof area" className={SELECT_CLASS}
          onChange={e => { if (e.target.value) p.onAttachRoofArea(e.target.value); }}>
          <option value="">Use an existing roof area...</option>
          {p.roofAreas.map(ra => <option key={ra.geometryId} value={ra.geometryId}>{ra.name} - {ra.label}</option>)}
        </select>
      </>}
      {p.canDrawNew && <RailAction primary={p.detailEntries.length === 0} onClick={p.onStartNewEntry}>+ New entry</RailAction>}
      {p.detailEntries.length === 0
        ? <RailNotice>{p.canDrawNew
          ? 'No entries yet. Tap + New entry to add one.'
          : 'Uncertain detections - review only. Tap an entry to highlight it; delete anything wrong. These never reach the quote.'}</RailNotice>
        : <RailNotice>Tap an entry to highlight it on the plan. Hide keeps it greyed on the plan but out of the quote.</RailNotice>}
      <div className="flex flex-col gap-1">
        {p.detailEntries.map((e, index) => <div key={e.id}
          className={`rounded-xl border px-2 py-1.5 ${p.highlightedEntryId === e.id
            ? 'border-[#FF6B35] bg-white/15' : 'border-white/15 bg-white/5'} ${e.hidden ? 'opacity-60' : ''}`}>
          <button type="button" aria-pressed={p.highlightedEntryId === e.id}
            className="flex min-h-12 w-full items-center justify-between px-1 text-left text-sm font-semibold text-white"
            onClick={() => p.onHighlight(p.highlightedEntryId === e.id ? null : e.id)}>
            <span>{e.hidden ? `${index + 1}. Hidden` : `Entry ${index + 1}`}</span>
            <span>{entryValueLabel(e, p.unitSystem)}</span>
          </button>
          <div className="grid grid-cols-2 gap-1">
            <RailAction label={e.hidden ? `Show entry ${index + 1}` : `Hide entry ${index + 1}`}
              onClick={() => p.onHideToggle(e.id, !e.hidden)}>{e.hidden ? 'Show' : 'Hide'}</RailAction>
            <RailAction label={`Delete entry ${index + 1}`}
              onClick={() => p.onDeleteEntry(e.id)}>Delete</RailAction>
          </div>
        </div>)}
      </div>
      <RailAction primary onClick={p.onBackFromDetail}>Done</RailAction>
    </RailTask>;
  }

  // M11 r3: ONE PANEL - the main-view actions render at the END of the
  // scrollable content, nothing pinned.
  const stageActions = (() => {
    if (p.phase === 'scanning') return <RailAction onClick={p.onCancelScan}>Cancel scan</RailAction>;
    if (p.phase === 'disclaimer') return <RailAction primary disabled>Confirm the notice to continue</RailAction>;
    if (p.phase === 'error') return <div className="flex flex-col gap-1">
      <RailAction primary onClick={p.onRetry}>Retry scan</RailAction>
      <RailAction onClick={p.onSaveContinue}>Continue without components</RailAction>
    </div>;
    if (p.saving) return <RailAction primary disabled>Saving...</RailAction>;
    return <RailAction primary onClick={p.onSaveContinue}>Save &amp; continue</RailAction>;
  })();
  return <RailTask label="Components step">
    {p.error && <RailNotice error>{p.error}</RailNotice>}
    {p.phase === 'scanning' ? <>
      <ScanProgress label={p.scanStage === 'lines' ? 'Detecting components' : 'Classifying components'} />
      <RailNotice>Your saved outline is kept. The scan runs on the outline you checked.</RailNotice>
    </> : p.phase === 'disclaimer' ? <RailNotice>The scan finished. Confirm the notice on the plan to review what was found.</RailNotice>
      : p.phase === 'error' ? <RailNotice>The component scan did not complete. Retry it, or continue to the quote builder.</RailNotice>
        : <>
          {p.groups.length === 0 && <RailNotice>{p.manualMode
            ? 'Add components manually: pick a component below to open its page and draw entries. Save & continue when done.'
            : 'The scan found no components. You can continue to the quote builder, or retry after checking the plan image.'}</RailNotice>}
          <div className="space-y-1">
            <div className="text-xs text-slate-300">Component library</div>
            <select value={p.selectedLibraryId} onChange={e => p.onLibraryChange(e.target.value)}
              aria-label="Component library" className={SELECT_CLASS}>
              <option value="">All libraries</option>
              {p.libraries.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="text-xs text-slate-300">Component</div>
            <select value={p.selectedComponentId ?? ''} onChange={e => p.onComponentChange(e.target.value)}
              aria-label="Component" className={SELECT_CLASS}>
              <option value="">Choose component</option>
              {p.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {p.groups.length > 0 && <RailNotice>Tap a colour to open that component and its entries.</RailNotice>}
          {p.groups.length > 0 && <div className="grid grid-cols-2 gap-1">
            {p.groups.map(g => <button key={g.key} type="button" aria-pressed={false}
              aria-label={g.named === false ? g.displayName : undefined}
              onClick={() => p.onOpenDetail(g.key)}
              className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-2 text-xs font-semibold text-white transition-all duration-100 active:scale-[1.04]">
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-lg border border-black/30" style={{ backgroundColor: g.colour }} />
              {/* M11 r3 (owner 2026-09-23): attached/custom components show the
                  swatch only on the grid - long customer names wreck the
                  layout. The full name lives on the detail page. */}
              <span className="flex-1 text-left leading-tight">{g.named === false ? '' : g.displayName}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{g.count}</span>
            </button>)}
          </div>}
        </>}
    {stageActions && <div className="flex flex-col gap-1 pt-1">{stageActions}</div>}
  </RailTask>;
}
