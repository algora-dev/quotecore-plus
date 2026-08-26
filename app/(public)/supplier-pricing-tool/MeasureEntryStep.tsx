// Step 2: Measurement entry (actual/site + plan modes). All populated groups move forward.
// Roof areas: total m2 OR length x width toggle. Lineal groups: length + quantity.
// Label optional, shown last.

'use client';

import { useState } from 'react';
import type { GroupKey, MeasureEntry, MeasurementSet } from './types';
import { GROUP_DEFS, entryPitched, makeId } from './types';
import { pitchFactor, GROUP_PITCH_RULES } from './pitch';
import { ComponentGuideBox } from './ComponentGuideBox';
import { ProductStep } from './ProductStep';
import type { Mode, SupplierProduct } from './types';

// measurement group key -> ComponentGuideBox component key
export const GUIDE_KEY: Record<string, string> = {
  roofAreas: 'roof_area',
  ridges: 'ridge',
  hips: 'hip',
  valleys: 'valley',
  barges: 'barge',
  spouting: 'spouting',
  downpipes: 'downpipe',
};

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function MeasureEntryStep({
  measureSet, setMeasureSet, onBack, onNext, fromTakeoff = false, flowSpeed = 'fast',
  catalog, mode = 'standard',
}: {
  measureSet: MeasurementSet;
  setMeasureSet: (s: MeasurementSet) => void;
  onBack: () => void;
  onNext: () => void;
  /** takeoff handoff: values come from a takeoff report, no conversion */
  fromTakeoff?: boolean;
  /** guide = one group per page with diagram; fast = all groups on one page */
  flowSpeed?: 'guide' | 'fast';
  /** catalog + mode: manual flow assigns products ON THE SAME page as entry */
  catalog?: SupplierProduct[];
  mode?: Mode;
}) {
  const [guideIdx, setGuideIdx] = useState(0);
  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const canNext = populated.length > 0;
  const isPlan = measureSet.entryPath === 'plan' && !fromTakeoff;
  const title = fromTakeoff
    ? 'Your takeoff measurements'
    : isPlan
      ? 'Enter your plan measurements'
      : 'Enter your site measurements';
  const sub = fromTakeoff
    ? 'Review the measurements picked up from your plan. Adjust anything, then continue to pricing.'
    : isPlan
      ? 'Enter measurements off the plan. Roof pitch is applied automatically to convert them to actual values.'
      : 'Fill in the groups you have. Anything left empty is skipped - only the groups you enter move on to pricing.';

  // Guide mode: one group per page (diagram + entry form), skip groups the
  // user has passed; final page's Next finishes the step.
  const guideGroups = flowSpeed === 'guide' && !fromTakeoff
    ? GROUP_DEFS.filter(g => g.key !== 'downpipes' || true)
    : null;
  const guideDef = guideGroups ? guideGroups[Math.min(guideIdx, guideGroups.length - 1)] : null;
  const guideLast = guideGroups ? guideIdx >= guideGroups.length - 1 : false;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>

      {flowSpeed === 'guide' && guideDef ? (
        <>
          <div className="mb-3">
            <ComponentGuideBox componentKey={GUIDE_KEY[guideDef.key] ?? 'roof_area'} entries={measureSet.groups[guideDef.key].entries.length} />
          </div>
          <GroupCard
            key={guideDef.key}
            def={guideDef}
            measureSet={measureSet}
            forceOpen
            onChange={(patch) => setMeasureSet({
              ...measureSet,
              groups: { ...measureSet.groups, [guideDef.key]: { ...measureSet.groups[guideDef.key], ...patch } },
            })}
          />
          {!fromTakeoff && catalog && measureSet.groups[guideDef.key].entries.length > 0 && (
            <div className="mt-4">
              <ProductStep
                def={guideDef}
                measureSet={measureSet}
                catalog={catalog}
                setMeasureSet={setMeasureSet}
                mode={mode}
                hideNav
                onBack={onBack}
                onNext={onNext}
                stepNum={guideIdx + 1}
                totalSteps={guideGroups ? guideGroups.length : 1}
              />
            </div>
          )}
        </>
      ) : (
        GROUP_DEFS.map(def => (
          <GroupCard
            key={def.key}
            def={def}
            measureSet={measureSet}
            onChange={(patch) => setMeasureSet({
              ...measureSet,
              groups: { ...measureSet.groups, [def.key]: { ...measureSet.groups[def.key], ...patch } },
            })}
          >
            {!fromTakeoff && catalog && measureSet.groups[def.key].entries.length > 0 && (
              <div className="border-t border-slate-100 p-4">
                <ProductStep
                  def={def}
                  measureSet={measureSet}
                  catalog={catalog}
                  setMeasureSet={setMeasureSet}
                  mode={mode}
                  hideNav
                  onBack={onBack}
                  onNext={onNext}
                  stepNum={GROUP_DEFS.indexOf(def) + 1}
                  totalSteps={GROUP_DEFS.length}
                />
              </div>
            )}
          </GroupCard>
        ))
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <div className="flex items-center gap-4">
          {flowSpeed === 'guide' && guideGroups ? (
            <>
              <span className="text-xs text-slate-500">{guideIdx + 1} of {guideGroups.length}</span>
              <button
                onClick={() => (guideLast ? onNext() : setGuideIdx(i => i + 1))}
                className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]"
              >
                {guideLast ? 'Next' : 'Next: ' + (guideGroups[guideIdx + 1]?.label ?? '')}
              </button>
            </>
          ) : (
            <>
              {populated.length > 0 && (
                <span className="text-xs text-slate-500">{populated.length} group{populated.length === 1 ? '' : 's'} ready</span>
              )}
              <button
                onClick={onNext}
                disabled={!canNext}
                className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupCard({ def, measureSet, onChange, forceOpen = false, children }: {
  def: typeof GROUP_DEFS[number];
  measureSet: MeasurementSet;
  onChange: (patch: Partial<MeasurementSet['groups'][GroupKey]>) => void;
  /** Guide mode: card is always expanded (single group per page) */
  forceOpen?: boolean;
  /** Fast mode: product assignment block - collapses WITH the group card */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  const group = measureSet.groups[def.key];
  const isPlan = measureSet.entryPath === 'plan';
  const rule = GROUP_PITCH_RULES[def.key] ?? 'none';
  const converts = isPlan && rule !== 'none';
  const total = group.entries.reduce((s, e) => s + e.value * (e.quantity || 1), 0);
  const pitchedTotal = group.entries.reduce((s, e) => s + entryPitched(measureSet, def.key, e.id), 0);

  return (
    <div className={`rounded-xl border transition ${expanded || group.entries.length > 0 ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)]'}`}>
      {!forceOpen && (
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
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {(expanded || forceOpen) && (
        <>
          <div className="border-t border-slate-100 p-4 space-y-3">
          {isPlan && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50/50 border border-slate-200 px-3 py-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Roof pitch
                <input
                  type="number" min="0" max="89" step="0.5"
                  value={group.pitchDegrees}
                  onChange={e => onChange({ pitchDegrees: parseFloat(e.target.value) || 0 })}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
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
                const showConversion = converts && Math.abs(pitched - e.value * (e.quantity || 1)) > 0.01;
                const raw = e.value * (e.quantity || 1);
                const areas = measureSet.groups.roofAreas.entries;
                const canAttach = def.basis === 'lineal' && areas.length > 0;
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:bg-blue-50/40 hover:border-blue-200 px-3 py-2 transition">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-slate-700 truncate">{e.label}</span>
                      {(e.quantity || 1) > 1 && <span className="text-[10px] text-slate-400">x{e.quantity}</span>}
                      {(e.pitchDegrees ?? 0) > 0 && <span className="text-[10px] text-slate-400">@ {e.pitchDegrees}°</span>}
                      {canAttach && (
                        <select
                          value={e.roofAreaId ?? ''}
                          onChange={ev => onChange({
                            entries: group.entries.map(x => x.id === e.id ? { ...x, roofAreaId: ev.target.value || null } : x),
                          })}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 focus:border-blue-500 focus:outline-none cursor-pointer"
                          aria-label={`Roof area for ${e.label}`}
                        >
                          <option value="">No roof area</option>
                          {areas.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.label}{(a.pitchDegrees ?? 0) > 0 ? ` (${a.pitchDegrees}°)` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {showConversion ? (
                        <span className="text-sm font-semibold text-slate-900">
                          <span className="font-normal text-slate-400">{raw.toFixed(1)} plan</span>
                          {' - '}
                          {pitched.toFixed(1)} {def.unit}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">{raw.toFixed(1)} {def.unit}</span>
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

          <AddEntryForm def={def} converts={converts} onAdd={(entry) => onChange({ entries: [...group.entries, { ...entry, label: entry.label || `${def.singular} ${group.entries.length + 1}` }] })} />
          </div>
          {children}
        </>
      )}
    </div>
  );
}

/** Entry form: area groups get total/length-x-width toggle; lineal groups get
 *  length + quantity (default 1); count groups get quantity only; label
 *  optional and last. */
function AddEntryForm({ def, converts, onAdd }: {
  def: typeof GROUP_DEFS[number];
  converts: boolean;
  onAdd: (e: MeasureEntry) => void;
}) {
  const isArea = def.basis === 'area';
  const isCount = def.basis === 'count';
  const [areaMode, setAreaMode] = useState<'dimensions' | 'total'>('dimensions');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [pitch, setPitch] = useState('');
  const [label, setLabel] = useState('');

  function add() {
    const quantity = Math.max(1, Math.round(parseFloat(qty) || 1));
    let value = 0;
    if (isCount) {
      value = 1; // each entry is one counted item; quantity carries the count
    } else if (isArea) {
      if (areaMode === 'dimensions') {
        const w = parseFloat(val1);
        const l = parseFloat(val2);
        if (!w || w <= 0 || !l || l <= 0) return;
        value = w * l;
      } else {
        const t = parseFloat(val1);
        if (!t || t <= 0) return;
        value = t;
      }
    } else {
      const v = parseFloat(val1);
      if (!Number.isFinite(v) || v <= 0) return;
      value = v;
    }
    const entry: MeasureEntry = {
      id: makeId('e'),
      label: label.trim() || `${def.singular} ${''}`,
      value,
      quantity,
    };
    // auto-number label based on count is handled by caller; keep entered label or default below
    if (!label.trim()) entry.label = ''; // caller replaces empty labels
    if (converts && pitch.trim() !== '') entry.pitchDegrees = parseFloat(pitch) || 0;
    onAdd(entry);
    setVal1(''); setVal2(''); setQty('1'); setPitch(''); setLabel('');
  }

  const canAdd = isCount
    ? Math.round(parseFloat(qty) || 1) > 0
    : isArea
      ? (areaMode === 'dimensions' ? (parseFloat(val1) > 0 && parseFloat(val2) > 0) : parseFloat(val1) > 0)
      : parseFloat(val1) > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
      {isArea && (
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
          <button onClick={() => setAreaMode('dimensions')} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'dimensions' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Length x Width</button>
          <button onClick={() => setAreaMode('total')} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'total' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Total Area</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {isCount ? (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">How many? (count)</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className={inputCls} />
          </div>
        ) : isArea && areaMode === 'dimensions' ? (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600">Length (m)</label>
              <input type="number" min="0" step="any" inputMode="decimal" value={val1} onChange={e => setVal1(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Width (m)</label>
              <input type="number" min="0" step="any" inputMode="decimal" value={val2} onChange={e => setVal2(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">{isArea ? `Total area (${def.unit})` : `Length (${def.unit})`}</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={val1} onChange={e => setVal1(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="0" className={inputCls} />
          </div>
        )}
        {!isArea && !isCount && (
          <div>
            <label className="text-xs font-medium text-slate-600">Quantity</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          </div>
        )}
        {converts ? (
          <div>
            <label className="text-xs font-medium text-slate-600">Pitch ° (opt.)</label>
            <input type="number" min="0" max="89" step="0.5" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="default" className={inputCls} />
          </div>
        ) : <div className="hidden md:block" />}
        <button
          onClick={add}
          disabled={!canAdd}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 cursor-pointer min-h-[38px] self-end"
        >
          Add
        </button>
      </div>

      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Optional label (e.g. Main roof, Front gable)"
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 focus:border-slate-900 focus:outline-none"
      />
    </div>
  );
}
