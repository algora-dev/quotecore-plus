'use client';
// M10 P2/P3: the touch components rail. Main view: scan progress, library +
// component dropdowns, colour swatch grid. Detail view (tap a swatch or pick
// a matching component): that group's entries - tap to highlight the line on
// the plan, hide/show, delete. + New entry drawing lands with P3b.
import type { ReactNode } from 'react';
import { RailAction, RailNotice, RailTask, ScanProgress } from './TouchRailControls';
import { AI_COMPONENT_REGISTRY, type SemanticKey } from '../aiComponentRegistry';
import type { TouchComponentEntry, TouchComponentGroup, TouchComponentScanStage } from './touchComponents';

export type TouchComponentsPhase = 'scanning' | 'disclaimer' | 'review' | 'error';

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
  detailEntries: TouchComponentEntry[];
  highlightedEntryId: string | null;
  unitLabel: string;
  /** P3b: active draft slot while drawing, or null when not drawing. */
  drawSlot: 0 | 1 | null;
  draftReady: boolean;
  viewControls: ReactNode;
  onStartNewEntry: () => void;
  onConfirmPoint: () => void;
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

export function TouchComponentsRail(p: TouchComponentsRailProps) {
  // ── Component detail view (one group's entries) ─────────────────────
  if (p.detailKey && p.phase === 'review') {
    const detailGroup = p.groups.find(g => g.key === p.detailKey);
    const registryDef = AI_COMPONENT_REGISTRY[p.detailKey as SemanticKey];
    const detailName = detailGroup?.displayName ?? registryDef?.displayName ?? p.detailEntries[0]?.displayName ?? 'Component';
    if (p.drawSlot != null) {
      return <RailTask label={`Draw ${detailName} entry`} footer={<div className="flex flex-col gap-1">
        <RailAction primary disabled={!p.draftReady} onClick={p.onConfirmPoint}>Confirm point</RailAction>
        <RailAction onClick={p.onCancelDraw}>Cancel new entry</RailAction>
      </div>}>
        <RailAction label="Back to all components" onClick={p.onBackFromDetail}>&#8249; All components</RailAction>
        <div className="flex items-center gap-2 px-1 py-1">
          <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-black/30" style={{ backgroundColor: detailGroup?.colour ?? '#ffffff' }} />
          <div className="text-base font-semibold text-white">{detailName}</div>
        </div>
        <RailNotice>{p.drawSlot === 0
          ? 'Tap the plan to set the START point. To fine-tune, press anywhere and drag - the point follows at a distance so your thumb never covers it. Confirm when happy.'
          : 'Now set the END point the same way, then Confirm point to save the entry.'}</RailNotice>
        {p.viewControls}
        <RailNotice>Drag empty space to pan. Pinch to zoom.</RailNotice>
      </RailTask>;
    }
    return <RailTask label={`${detailName} entries`} footer={
      <RailAction primary onClick={p.onBackFromDetail}>Done</RailAction>
    }>
      <RailAction label="Back to all components" onClick={p.onBackFromDetail}>&#8249; All components</RailAction>
      <div className="flex items-center gap-2 px-1 py-1">
        <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-black/30" style={{ backgroundColor: detailGroup?.colour ?? '#ffffff' }} />
        <div className="text-base font-semibold text-white">{detailName}</div>
      </div>
      <RailAction primary={p.detailEntries.length === 0} onClick={p.onStartNewEntry}>+ New entry</RailAction>
      {p.detailEntries.length === 0
        ? <RailNotice>No entries yet. Tap + New entry to draw one.</RailNotice>
        : <RailNotice>Tap an entry to highlight its line on the plan. Hide keeps it greyed on the plan but out of the quote.</RailNotice>}
      <div className="flex flex-col gap-1">
        {p.detailEntries.map((e, index) => <div key={e.id}
          className={`rounded-xl border px-2 py-1.5 ${p.highlightedEntryId === e.id
            ? 'border-[#FF6B35] bg-white/15' : 'border-white/15 bg-white/5'} ${e.hidden ? 'opacity-60' : ''}`}>
          <button type="button" aria-pressed={p.highlightedEntryId === e.id}
            className="flex min-h-12 w-full items-center justify-between px-1 text-left text-sm font-semibold text-white"
            onClick={() => p.onHighlight(p.highlightedEntryId === e.id ? null : e.id)}>
            <span>{e.hidden ? `${index + 1}. Hidden` : `Entry ${index + 1}`}</span>
            <span>{e.value.toFixed(1)} {p.unitLabel}</span>
          </button>
          <div className="grid grid-cols-2 gap-1">
            <RailAction label={e.hidden ? `Show entry ${index + 1}` : `Hide entry ${index + 1}`}
              onClick={() => p.onHideToggle(e.id, !e.hidden)}>{e.hidden ? 'Show' : 'Hide'}</RailAction>
            <RailAction label={`Delete entry ${index + 1}`}
              onClick={() => p.onDeleteEntry(e.id)}>Delete</RailAction>
          </div>
        </div>)}
      </div>
    </RailTask>;
  }

  // ── Main view ────────────────────────────────────────────────────────
  const footer = (() => {
    if (p.phase === 'scanning') return <RailAction onClick={p.onCancelScan}>Cancel scan</RailAction>;
    if (p.phase === 'disclaimer') return <RailAction primary disabled>Confirm the notice to continue</RailAction>;
    if (p.phase === 'error') return <div className="flex flex-col gap-1">
      <RailAction primary onClick={p.onRetry}>Retry scan</RailAction>
      <RailAction onClick={p.onSaveContinue}>Continue without components</RailAction>
    </div>;
    if (p.saving) return <RailAction primary disabled>Saving...</RailAction>;
    return <RailAction primary onClick={p.onSaveContinue}>Save &amp; continue</RailAction>;
  })();
  return <RailTask label="Components step" footer={footer}>
    {p.error && <RailNotice error>{p.error}</RailNotice>}
    {p.phase === 'scanning' ? <>
      <ScanProgress label={p.scanStage === 'lines' ? 'Detecting components' : 'Classifying components'} />
      <RailNotice>Your saved outline is kept. The scan runs on the outline you checked.</RailNotice>
    </> : p.phase === 'disclaimer' ? <RailNotice>The scan finished. Confirm the notice on the plan to review what was found.</RailNotice>
      : p.phase === 'error' ? <RailNotice>The component scan did not complete. Retry it, or continue to the quote builder.</RailNotice>
        : <>
          {p.groups.length === 0 ? <RailNotice>{p.manualMode
            ? 'Add components manually: pick a component below (Ridge, Hip, Valley...) to open its page and draw entries. Save & continue when done.'
            : 'The scan found no components. You can continue to the quote builder, or retry after checking the plan image.'}</RailNotice>
            : <RailNotice>Tap a colour to open that component and its entries.</RailNotice>}
          <div className="space-y-1">
            <div className="text-xs text-slate-300">Component library</div>
            <select value={p.selectedLibraryId} onChange={e => p.onLibraryChange(e.target.value)}
              aria-label="Component library"
              className="min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-2 text-sm font-semibold text-white">
              <option value="">All libraries</option>
              {p.libraries.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="text-xs text-slate-300">Component</div>
            <select value={p.selectedComponentId ?? ''} onChange={e => p.onComponentChange(e.target.value)}
              aria-label="Component"
              className="min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-2 text-sm font-semibold text-white">
              <option value="">Choose component</option>
              {p.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {p.groups.length > 0 && <div className="grid grid-cols-2 gap-1">
            {p.groups.map(g => <button key={g.key} type="button" aria-pressed={false}
              onClick={() => p.onOpenDetail(g.key)}
              className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-2 text-xs font-semibold text-white transition-all duration-100 active:scale-[1.04]">
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-lg border border-black/30" style={{ backgroundColor: g.colour }} />
              <span className="flex-1 text-left leading-tight">{g.displayName}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{g.count}</span>
            </button>)}
          </div>}
        </>}
  </RailTask>;
}
