// Step 2: Measurement entry (actual/site mode). All populated groups move forward.

'use client';

import { useState } from 'react';
import type { GroupKey, MeasurementSet } from './types';
import { GROUP_DEFS, groupTotal, makeId } from './types';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none';

export function MeasureEntryStep({
  measureSet, setMeasureSet, onBack, onNext,
}: {
  measureSet: MeasurementSet;
  setMeasureSet: (s: MeasurementSet) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const canNext = populated.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Enter your site measurements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the groups you have. Anything left empty is skipped - only the groups you enter move on to pricing.
        </p>
      </div>

      {GROUP_DEFS.map(def => (
        <GroupCard
          key={def.key}
          def={def}
          group={measureSet.groups[def.key]}
          onChange={(entries) => setMeasureSet({
            ...measureSet,
            groups: { ...measureSet.groups, [def.key]: { ...measureSet.groups[def.key], entries } },
          })}
        />
      ))}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <div className="flex items-center gap-4">
          {populated.length > 0 && (
            <span className="text-xs text-slate-500">{populated.length} group{populated.length === 1 ? '' : 's'} ready</span>
          )}
          <button
            onClick={onNext}
            disabled={!canNext}
            className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupCard({ def, group, onChange }: {
  def: typeof GROUP_DEFS[number];
  group: MeasurementSet['groups'][GroupKey];
  onChange: (entries: MeasurementSet['groups'][GroupKey]['entries']) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const total = group.entries.reduce((s, e) => s + e.value, 0);

  function add() {
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) return;
    onChange([...group.entries, { id: makeId('e'), label: label.trim() || `${def.singular} ${group.entries.length + 1}`, value: v }]);
    setLabel('');
    setValue('');
  }

  return (
    <div className={`rounded-xl border transition ${open || group.entries.length > 0 ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-slate-900">
          {def.label}
          {group.entries.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-normal text-slate-500">
              {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} - {total.toFixed(1)} {def.unit}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {group.entries.length > 0 && (
            <div className="space-y-1.5">
              {group.entries.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-slate-700 truncate">{e.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-900">{e.value.toFixed(1)} {def.unit}</span>
                    <button
                      onClick={() => onChange(group.entries.filter(x => x.id !== e.id))}
                      className="text-slate-300 hover:text-red-500 transition p-1"
                      aria-label={`Remove ${e.label}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600">Label (optional)</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={`e.g. ${def.key === 'roofAreas' ? 'Main roof, Garage' : 'Front, Rear'}`} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">{def.basis === 'area' ? 'Area' : 'Length'} ({def.unit})</label>
              <input type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="0" className={inputCls} />
            </div>
            <button
              onClick={add}
              disabled={!(parseFloat(value) > 0)}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
