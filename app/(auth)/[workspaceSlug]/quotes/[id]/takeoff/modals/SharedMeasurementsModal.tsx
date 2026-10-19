'use client';

import { useMemo, useState } from 'react';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import type { SharedMeasurementKind, SharedMeasurementOption } from '@/app/lib/takeoff/sharedMeasurements';

export interface SharedModalEntry {
  id: string;
  label: string;
  value: number;
}

export function SharedMeasurementsModal({
  componentName,
  kind,
  unitLabel,
  entries,
  existing,
  valueForOption,
  onShare,
  onRemove,
  onClose,
}: {
  componentName: string;
  kind: SharedMeasurementKind;
  unitLabel: string;
  entries: SharedModalEntry[];
  existing: SharedMeasurementOption[];
  valueForOption: (option: SharedMeasurementOption) => number;
  onShare: (mode: 'entry' | 'combined' | 'all', ids: string[]) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedValue = useMemo(() => entries.filter(e => selected.includes(e.id)).reduce((sum, e) => sum + e.value, 0), [entries, selected]);
  const allValue = useMemo(() => entries.reduce((sum, e) => sum + e.value, 0), [entries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Share ${componentName} measurements`}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-600 px-6 pb-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold">Share measurements</h2>
            <p className="mt-1 text-sm text-slate-200">{componentName} · {kind === 'area' ? 'Area' : 'Length'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-200 transition hover:bg-slate-800 hover:text-white" aria-label="Close">
            <QcIcon name="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-600 px-4 py-8 text-center text-sm text-slate-300">No shareable measurements yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {entries.map(entry => (
                  <label key={entry.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5 transition hover:border-slate-400">
                    <input type="checkbox" checked={selected.includes(entry.id)} onChange={() => setSelected(prev => prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id])} className="h-4 w-4 accent-[#FF6B35]" />
                    <span className="flex-1 text-sm text-white">{entry.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-white">{entry.value.toFixed(2)} {unitLabel}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-600 pt-4">
                <button type="button" disabled={!selected.length} onClick={() => { onShare('entry', selected); setSelected([]); }} className="rounded-full border border-slate-500 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40">Share individually</button>
                <button type="button" disabled={!selected.length} onClick={() => { onShare('combined', selected); setSelected([]); }} className="rounded-full border border-slate-500 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40">Combine selected ({selectedValue.toFixed(2)} {unitLabel})</button>
                <button type="button" onClick={() => onShare('all', [])} className="rounded-full bg-[#FF6B35] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#ff5722]">Combine all ({allValue.toFixed(2)} {unitLabel})</button>
              </div>
            </>
          )}

          <section className="border-t border-slate-600 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-200">Shared now</h3>
            {existing.length === 0 ? <p className="text-sm text-slate-300">Nothing shared yet.</p> : (
              <div className="space-y-2">
                {existing.map(option => (
                  <div key={option.id} className="flex items-center gap-3 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">
                    <span className="flex-1 text-sm text-white">{option.sourceComponentName} · {option.mode === 'all' ? 'total' : option.mode === 'combined' ? 'combined' : 'measurement'}</span>
                    <span className="text-sm font-semibold tabular-nums">{valueForOption(option).toFixed(2)} {unitLabel}</span>
                    <button type="button" onClick={() => onRemove(option.id)} className="rounded-full p-1.5 text-slate-200 transition hover:bg-red-500/20 hover:text-red-300" aria-label="Stop sharing"><QcIcon name="close" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-600 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200">Done</button>
        </div>
      </div>
    </div>
  );
}
