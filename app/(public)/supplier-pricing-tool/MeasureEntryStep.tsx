// Step 2: Measurement entry (actual/site + plan modes). All populated groups move forward.

'use client';

import { useState } from 'react';
import type { GroupKey, MeasureEntry, MeasurementSet } from './types';
import { GROUP_DEFS, entryPitched, makeId } from './types';
import { pitchFactor, GROUP_PITCH_RULES } from './pitch';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none';

export function MeasureEntryStep({
  measureSet, setMeasureSet, onBack, onNext, fromTakeoff = false,
}: {
  measureSet: MeasurementSet;
  setMeasureSet: (s: MeasurementSet) => void;
  onBack: () => void;
  onNext: () => void;
  /** takeoff handoff: values come from a takeoff report, no conversion */
  fromTakeoff?: boolean;
}) {
  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const canNext = populated.length > 0;
  const isPlan = measureSet.entryPath === 'plan' && !fromTakeoff;
  const title = fromTakeoff
    ? 'Your takeoff measurements'
    : isPlan
      ? 'Enter your plan measurements'
      : 'Enter your site measurements';
  const sub = fromTakeoff
    ? 'Measure your plan in the takeoff tool, then enter the group totals from its report here. These flow straight into pricing.'
    : isPlan
      ? 'Enter measurements off the plan. Roof pitch is applied automatically to convert them to actual values.'
      : 'Fill in the groups you have. Anything left empty is skipped - only the groups you enter move on to pricing.';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>

      {fromTakeoff && (
        <a
          href="https://app.quote-core.com/free-roof-takeoff"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open the Roof Takeoff tool (measure your plan) - opens in a new tab
        </a>
      )}

      {GROUP_DEFS.map(def => (
        <GroupCard
          key={def.key}
          def={def}
          measureSet={measureSet}
          onChange={(patch) => setMeasureSet({
            ...measureSet,
            groups: { ...measureSet.groups, [def.key]: { ...measureSet.groups[def.key], ...patch } },
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

function GroupCard({ def, measureSet, onChange }: {
  def: typeof GROUP_DEFS[number];
  measureSet: MeasurementSet;
  onChange: (patch: Partial<MeasurementSet['groups'][GroupKey]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [pitch, setPitch] = useState('');
  const group = measureSet.groups[def.key];
  const isPlan = measureSet.entryPath === 'plan';
  const rule = GROUP_PITCH_RULES[def.key] ?? 'none';
  const converts = isPlan && rule !== 'none';
  const total = group.entries.reduce((s, e) => s + e.value, 0);
  const pitchedTotal = group.entries.reduce((s, e) => s + entryPitched(measureSet, def.key, e.id), 0);

  function add() {
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) return;
    const entry: MeasureEntry = { id: makeId('e'), label: label.trim() || `${def.singular} ${group.entries.length + 1}`, value: v };
    if (converts && pitch.trim() !== '') entry.pitchDegrees = parseFloat(pitch) || 0;
    onChange({ entries: [...group.entries, entry] });
    setLabel('');
    setValue('');
    setPitch('');
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
              {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} - {converts ? (
                <>{total.toFixed(1)} plan - <span className="font-medium text-slate-700">{pitchedTotal.toFixed(1)} {def.unit} pitched</span></>
              ) : (
                <>{total.toFixed(1)} {def.unit}</>
              )}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {isPlan && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50/50 border border-slate-200 px-3 py-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Roof pitch
                <input
                  type="number" min="0" max="89" step="0.5"
                  value={group.pitchDegrees}
                  onChange={e => onChange({ pitchDegrees: parseFloat(e.target.value) || 0 })}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-orange-500 focus:outline-none"
                  aria-label={`Pitch for ${def.label}`}
                />
                °
              </label>
              <span className="text-xs text-slate-400">
                {converts
                  ? `Applies ${rule === 'rafter' ? 'rafter' : 'hip/valley'} factor: plan ${def.label.toLowerCase()} x ${pitchFactor(rule, group.pitchDegrees).toFixed(3)}`
                  : 'No pitch conversion for this group (horizontal measurement)'}
              </span>
            </div>
          )}

          {group.entries.length > 0 && (
            <div className="space-y-1.5">
              {group.entries.map(e => {
                const pitched = entryPitched(measureSet, def.key, e.id);
                const showConversion = converts && Math.abs(pitched - e.value) > 0.01;
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2 transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-slate-700 truncate">{e.label}</span>
                      {(e.pitchDegrees ?? 0) > 0 && <span className="text-[10px] text-slate-400">@ {e.pitchDegrees}°</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {showConversion ? (
                        <span className="text-sm font-semibold text-slate-900">
                          <span className="font-normal text-slate-400">{e.value.toFixed(1)} plan</span>
                          {' - '}
                          {pitched.toFixed(1)} {def.unit}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">{e.value.toFixed(1)} {def.unit}</span>
                      )}
                      <button
                        onClick={() => onChange({ entries: group.entries.filter(x => x.id !== e.id) })}
                        className="text-slate-300 hover:text-red-500 transition p-1"
                        aria-label={`Remove ${e.label}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_auto] gap-2 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600">Label (optional)</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={`e.g. ${def.key === 'roofAreas' ? 'Main roof, Garage' : 'Front, Rear'}`} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">{isPlan ? 'Plan ' : ''}{def.basis === 'area' ? 'area' : 'length'} ({def.unit})</label>
              <input type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="0" className={inputCls} />
            </div>
            {converts ? (
              <div>
                <label className="text-xs font-medium text-slate-600">Pitch ° (opt.)</label>
                <input type="number" min="0" max="89" step="0.5" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="default" className={inputCls} />
              </div>
            ) : <div className="hidden md:block" />}
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
