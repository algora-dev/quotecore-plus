'use client';
// M10 P2: the touch components rail - scan progress, review with library +
// component dropdowns and the colour swatch grid, error recovery. Purely
// presentational: the hook (useTouchComponents) owns the lifecycle.
import { RailAction, RailNotice, RailTask, ScanProgress } from './TouchRailControls';
import type { TouchComponentGroup, TouchComponentScanStage } from './touchComponents';

export type TouchComponentsPhase = 'scanning' | 'disclaimer' | 'review' | 'error';

export interface TouchComponentsRailProps {
  phase: TouchComponentsPhase;
  scanStage: TouchComponentScanStage;
  error: string | null;
  groups: TouchComponentGroup[];
  isolated: string | null;
  manualMode: boolean;
  libraries: { id: string; name: string }[];
  components: { id: string; name: string }[];
  selectedLibraryId: string;
  selectedComponentId: string | null;
  onLibraryChange: (id: string) => void;
  onComponentChange: (id: string) => void;
  onIsolate: (key: string | null) => void;
  onRetry: () => void;
  onCancelScan: () => void;
  onSaveContinue: () => void;
}

export function TouchComponentsRail(p: TouchComponentsRailProps) {
  const footer = (() => {
    if (p.phase === 'scanning') return <RailAction onClick={p.onCancelScan}>Cancel scan</RailAction>;
    if (p.phase === 'disclaimer') return <RailAction primary disabled>Confirm the notice to continue</RailAction>;
    if (p.phase === 'error') return <div className="flex flex-col gap-1">
      <RailAction primary onClick={p.onRetry}>Retry scan</RailAction>
      <RailAction onClick={p.onSaveContinue}>Continue without components</RailAction>
    </div>;
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
            ? 'Add components manually. Drawing entries lands in the next step - finish to the quote builder for now.'
            : 'The scan found no components. You can continue to the quote builder, or retry after checking the plan image.'}</RailNotice>
            : <RailNotice>Tap a colour to show only that component on the plan. Tap again to show everything.</RailNotice>}
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
          {p.groups.length > 0 && <>
            <div className="grid grid-cols-2 gap-1">
              {p.groups.map(g => <button key={g.key} type="button" aria-pressed={p.isolated === g.key}
                onClick={() => p.onIsolate(p.isolated === g.key ? null : g.key)}
                className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-white transition-all duration-100 active:scale-[1.04] ${p.isolated === g.key
                  ? 'border-2 border-[#FF6B35] bg-white/20'
                  : 'border border-white/20 bg-white/10'}`}>
                <span aria-hidden className="h-6 w-6 shrink-0 rounded-lg border border-black/30" style={{ backgroundColor: g.colour }} />
                <span className="flex-1 text-left leading-tight">{g.displayName}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{g.count}</span>
              </button>)}
            </div>
            {p.isolated && <RailAction onClick={() => p.onIsolate(null)}>Show all components</RailAction>}
          </>}
        </>}
  </RailTask>;
}
