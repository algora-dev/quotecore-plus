'use client';

import { useMemo, useState } from 'react';
import type { AreaComponent, BuilderComponent, BuilderEntry, MeasureMode, ParentArea, UnitSystem } from './types';
import { makeId, lenLabel, areaLabel } from './types';
import {
  areaComponentTotals, grandTotals, fmt,
} from './calc';

interface BuilderStepProps {
  components: BuilderComponent[];
  areas: ParentArea[];
  setAreas: (a: ParentArea[]) => void;
  measureMode: MeasureMode;
  unitSystem: UnitSystem;
  currency: string;
  onBack: () => void;
  onGenerate: () => void;
}

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-2 md:px-3 py-1.5 text-base md:text-sm focus:border-slate-900 focus:outline-none';

/** Measurement phase - Free Roofing Takeoff Builder UX: mode banner, master
 * pitch (plan mode), parent areas, component sections per area with the same
 * entry form (Width x Length / Total Area toggle, quantity, optional label,
 * plan prefix and pitch on entries). Components are locked to the session set. */
export default function BuilderStep({ components, areas, setAreas, measureMode, unitSystem, currency, onBack, onGenerate }: BuilderStepProps) {
  const [newAreaName, setNewAreaName] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [masterPitch, setMasterPitch] = useState('25');
  const compById = useMemo(() => new Map(components.map(c => [c.id, c])), [components]);
  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);
  const effectivePitch = parseFloat(masterPitch) || 0;
  const planPrefix = measureMode === 'plan' ? 'Plan ' : '';

  function addArea() {
    const name = newAreaName.trim() || `Area ${areas.length + 1}`;
    const area: ParentArea = { id: makeId('area'), name, pitchDegrees: effectivePitch, components: [] };
    setAreas([...areas, area]);
    setNewAreaName('');
    setExpandedKey(`${area.id}::add`);
  }

  function updateArea(id: string, patch: Partial<ParentArea>) {
    setAreas(areas.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  function removeArea(id: string) {
    setAreas(areas.filter(a => a.id !== id));
  }

  function addComponentToArea(areaId: string, componentId: string) {
    setAreas(areas.map(a => a.id === areaId
      ? { ...a, components: [...a.components, { id: makeId('ac'), componentId, entries: [] }] }
      : a));
    setExpandedKey(`${areaId}::c:${componentId}`);
  }

  function removeAreaComponent(areaId: string, acId: string) {
    setAreas(areas.map(a => a.id === areaId
      ? { ...a, components: a.components.filter(ac => ac.id !== acId) }
      : a));
  }

  function addEntry(areaId: string, acId: string, entry: BuilderEntry) {
    setAreas(areas.map(a => a.id === areaId
      ? { ...a, components: a.components.map(ac => ac.id === acId ? { ...ac, entries: [...ac.entries, entry] } : ac) }
      : a));
  }

  function removeEntry(areaId: string, acId: string, entryId: string) {
    setAreas(areas.map(a => a.id === areaId
      ? { ...a, components: a.components.map(ac => ac.id === acId ? { ...ac, entries: ac.entries.filter(e => e.id !== entryId) } : ac) }
      : a));
  }

  const totals = grandTotals(areas, components, measureMode);
  const entryCount = areas.reduce((s, a) => s + a.components.reduce((s2, ac) => s2 + ac.entries.length, 0), 0);
  const hasData = entryCount > 0;

  return (
    <div className="mx-auto max-w-5xl px-2 md:px-6 py-6 md:py-8 pb-24 md:pb-10 bg-white min-h-screen">
      {/* Mode banner + master pitch - same as Free Roofing Takeoff Builder */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-slate-700">
            {measureMode === 'actual' ? 'Actual Measurements Mode' : 'Plan + Pitch Calculation Mode'}
          </span>
          <p className="mt-0.5 text-xs text-slate-400">
            {components.length} components locked for this session - finish or refresh to start over.
          </p>
        </div>
        {measureMode === 'plan' && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Roof Pitch
            <input
              type="number" min="0" max="89" step="0.5"
              value={masterPitch}
              onChange={e => setMasterPitch(e.target.value)}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-orange-500 focus:outline-none"
            />
            °
          </label>
        )}
        <button onClick={onBack} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">
          Change mode
        </button>
      </div>

      {/* Areas */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Parent areas</h2>
        <p className="mt-1 text-sm text-slate-500">Group your work by area - roof planes, rooms, slabs, whatever suits the job. Add components and entries to each.</p>
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            value={newAreaName}
            onChange={e => setNewAreaName(e.target.value)}
            placeholder="e.g. North roof, Lounge, Driveway"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addArea(); } }}
            aria-label="New area name"
          />
          <button onClick={addArea} className="flex-shrink-0 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Add area</button>
        </div>
      </div>

      {areas.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
          <p className="text-sm text-slate-500">Add your first area above to start building.</p>
        </div>
      )}

      {areas.map(area => {
        const key = (sub: string) => `${area.id}::${sub}`;
        const unusedComponents = components.filter(c => !area.components.some(ac => ac.componentId === c.id));
        return (
          <div key={area.id} className="mt-4 rounded-xl border border-slate-200 bg-white">
            {/* Area header - collapsible like FRTB sections */}
            <div className="flex items-center justify-between px-2 md:px-4 py-3">
              <button
                onClick={() => setExpandedKey(expandedKey === key('head') ? null : key('head'))}
                className="flex items-center gap-2.5 cursor-pointer hover:text-[#BD4A1A] transition flex-1 min-w-0"
              >
                <span className="text-sm font-semibold text-slate-900 truncate">{area.name}</span>
                {area.components.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 flex-shrink-0">
                    {area.components.length} {area.components.length === 1 ? 'component' : 'components'}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-3 flex-shrink-0">
                {measureMode === 'plan' && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    Pitch
                    <input
                      type="number" min="0" max="89" step="0.5"
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs focus:border-orange-500 focus:outline-none"
                      value={area.pitchDegrees}
                      onChange={e => updateArea(area.id, { pitchDegrees: parseFloat(e.target.value) || 0 })}
                      aria-label={`Pitch for ${area.name}`}
                    />
                    °
                  </label>
                )}
                <button onClick={() => removeArea(area.id)} className="text-slate-300 hover:text-red-500 transition p-1" aria-label={`Remove ${area.name}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button onClick={() => setExpandedKey(expandedKey === key('head') ? null : key('head'))}>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedKey === key('head') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {(expandedKey === key('head') || area.components.length > 0) && (
              <div className="border-t border-slate-100 p-2 md:p-4 space-y-3">
                {/* Component sections within the area - same card pattern as FRTB */}
                {area.components.map(ac => {
                  const comp = compById.get(ac.componentId);
                  if (!comp) return null;
                  const t = areaComponentTotals(ac, comp, area, measureMode);
                  const cKey = key(`c:${comp.id}`);
                  const isExpanded = expandedKey === cKey;
                  const hasEntries = ac.entries.length > 0;
                  const displayUnit = comp.measurementType === 'quantity' ? 'pcs' : comp.measurementType === 'area' ? areaU : len;
                  return (
                    <div key={ac.id} className={`rounded-xl border bg-white transition ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between px-2 md:px-4 py-3">
                        <button onClick={() => setExpandedKey(isExpanded ? null : cKey)} className="flex items-center gap-2.5 cursor-pointer hover:text-[#BD4A1A] transition flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-900 truncate">{comp.name}</span>
                          {hasEntries && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 flex-shrink-0">{ac.entries.length} {ac.entries.length === 1 ? 'entry' : 'entries'}</span>}
                        </button>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {hasEntries && (
                            <div className="text-right">
                              <span className="text-sm font-semibold text-slate-900">{t.rawTotal.toFixed(2)} {displayUnit}</span>
                              {(t.materialCost + t.labourCost) > 0 && <span className="ml-2 text-xs text-[#BD4A1A] font-medium">{currency}{fmt(t.materialCost + t.labourCost)}</span>}
                            </div>
                          )}
                          <button onClick={() => removeAreaComponent(area.id, ac.id)} className="text-slate-300 hover:text-red-500 transition p-1" aria-label={`Remove ${comp.name}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <button onClick={() => setExpandedKey(isExpanded ? null : cKey)}>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-2 md:p-4 space-y-3">
                          <AddEntryForm
                            comp={comp}
                            area={area}
                            masterPitch={effectivePitch}
                            measureMode={measureMode}
                            len={len}
                            areaU={areaU}
                            onAdd={entry => addEntry(area.id, ac.id, entry)}
                          />
                          {hasEntries && (
                            <div className="space-y-1.5">
                              {ac.entries.map((e, idx) => {
                                const usePitch = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none';
                                const unit = comp.measurementType === 'quantity' ? 'pcs' : comp.measurementType === 'area' ? areaU : len;
                                const inputDesc = comp.measurementType === 'quantity'
                                  ? `Qty: ${e.quantity || 1}`
                                  : e.isTotal
                                    ? `Total: ${e.value}`
                                    : comp.measurementType === 'area'
                                      ? `${e.value} × ${e.value2 ?? 0}`
                                      : `${e.value}`;
                                const pitchedVal = usePitch ? e.pitchDegrees ?? area.pitchDegrees : null;
                                return (
                                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2 transition">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-700">{e.label || `Entry ${idx + 1}`}</span>
                                        {pitchedVal != null && pitchedVal > 0 && <span className="text-[10px] text-slate-400">@ {pitchedVal}°</span>}
                                        {(e.quantity || 1) > 1 && <span className="text-[10px] text-slate-400">x{e.quantity}</span>}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-[10px] text-slate-400">{inputDesc}</span>
                                        <span className="text-[10px] text-slate-500">{e.value.toFixed(2)} {unit}</span>
                                      </div>
                                    </div>
                                    <button onClick={() => removeEntry(area.id, ac.id, e.id)} className="text-slate-300 hover:text-red-500 transition p-1" aria-label="Remove entry">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!hasEntries && <p className="text-xs text-slate-400 text-center py-2">No {comp.name.toLowerCase()} entries yet. Add your first one above.</p>}
                          {t.entryCount > 0 && (
                            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                              <div className="text-xs text-slate-500">
                                Subtotal ({t.entryCount} {t.entryCount === 1 ? 'entry' : 'entries'})
                                {comp.wasteType === 'percent' && <span className="ml-1">+ {comp.wasteValue}% waste</span>}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-slate-900">{fmt(t.withWasteTotal)} {displayUnit}</span>
                                {(t.materialCost + t.labourCost) > 0 && <div className="text-xs text-[#BD4A1A] font-medium">{currency}{fmt(t.materialCost + t.labourCost)}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add component to area */}
                {unusedComponents.length > 0 && (
                  <AddComponentPicker components={unusedComponents} onPick={cid => addComponentToArea(area.id, cid)} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Totals + generate */}
      {areas.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
          {totals.hasPricing && (
            <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Estimated total</div>
                <div className="text-xs text-slate-400">{entryCount} entries · materials {currency}{fmt(totals.material)} + labour {currency}{fmt(totals.labour)}</div>
              </div>
              <span className="text-xl font-bold">{currency}{fmt(totals.total)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">Back</button>
            <button onClick={onGenerate} disabled={!hasData} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40">
              Generate results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddComponentPicker({ components, onPick }: { components: BuilderComponent[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#FF6B35] hover:bg-orange-50/40 text-sm text-gray-600 hover:text-gray-800 transition-all"
      >
        + Add component to this area {components.length > 0 ? `(${components.length} left)` : ''}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            {components.map(c => (
              <button key={c.id} onClick={() => { setOpen(false); onPick(c.id); }} className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-orange-50/40 transition">
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Entry form - same layout as the Free Roofing Takeoff Builder AddEntryForm:
 * Width x Length / Total Area toggle for area components, plan prefix, quantity,
 * optional label, per-entry pitch (plan mode, defaults to master pitch). */
function AddEntryForm({ comp, area, masterPitch, measureMode, len, areaU, onAdd }: {
  comp: BuilderComponent;
  area: ParentArea;
  masterPitch: number;
  measureMode: MeasureMode;
  len: string;
  areaU: string;
  onAdd: (e: BuilderEntry) => void;
}) {
  const [areaMode, setAreaMode] = useState<'dimensions' | 'total'>('dimensions');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [label, setLabel] = useState('');
  const [pitch, setPitch] = useState(String(area.pitchDegrees || masterPitch || 25));

  const isArea = comp.measurementType === 'area';
  const isFixed = comp.measurementType === 'quantity';
  const usePitch = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none';
  const planPrefix = measureMode === 'plan' ? 'Plan ' : '';

  function resetForm() { setVal1(''); setVal2(''); setQuantity('1'); setLabel(''); }

  function handleAdd() {
    const qty = parseInt(quantity) || 1;
    let entry: BuilderEntry | null = null;
    if (isFixed) {
      const v = parseFloat(val1);
      if (!Number.isFinite(v) || v <= 0) return;
      entry = { id: makeId('e'), label: label.trim(), value: v, quantity: Math.max(1, Math.round(v)), isTotal: false };
      entry.quantity = Math.max(1, Math.round(v));
    } else if (isArea && areaMode === 'dimensions') {
      const w = parseFloat(val1);
      const l = parseFloat(val2);
      if (!w || w <= 0 || !l || l <= 0) return;
      entry = { id: makeId('e'), label: label.trim(), value: w, value2: l, quantity: qty, isTotal: false };
    } else if (isArea) {
      const t = parseFloat(val1);
      if (!t || t <= 0) return;
      entry = { id: makeId('e'), label: label.trim(), value: t, quantity: qty, isTotal: true };
    } else {
      const l = parseFloat(val1);
      if (!l || l <= 0) return;
      entry = { id: makeId('e'), label: label.trim(), value: l, quantity: qty };
    }
    if (usePitch) entry.pitchDegrees = parseFloat(pitch) || 0;
    onAdd(entry);
    resetForm();
  }

  const canAdd = isFixed
    ? parseFloat(val1) > 0
    : isArea
      ? (areaMode === 'dimensions' ? (parseFloat(val1) > 0 && parseFloat(val2) > 0) : parseFloat(val1) > 0)
      : parseFloat(val1) > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 md:p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">Add New Entry</span>
      </div>

      {isArea && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
            <button onClick={() => setAreaMode('dimensions')} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'dimensions' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Width x Length</button>
            <button onClick={() => setAreaMode('total')} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'total' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Total Area</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {isFixed ? (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">Quantity (pcs)</label>
            <input type="number" value={val1} onChange={e => setVal1(e.target.value)} min="0" step="1" inputMode="decimal" placeholder="0" className={inputCls} />
          </div>
        ) : isArea && areaMode === 'dimensions' ? (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600">{planPrefix}Width ({len})</label>
              <input type="number" value={val1} onChange={e => setVal1(e.target.value)} min="0" step="any" inputMode="decimal" placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">{planPrefix}Length ({len})</label>
              <input type="number" value={val2} onChange={e => setVal2(e.target.value)} min="0" step="any" inputMode="decimal" placeholder="0" className={inputCls} />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">{planPrefix}{isArea ? `Area (${areaU})` : `Length (${len})`}</label>
            <input type="number" value={val1} onChange={e => setVal1(e.target.value)} min="0" step="any" inputMode="decimal" placeholder="0" className={inputCls} />
          </div>
        )}

        {!isFixed && (
          <div>
            <label className="text-xs font-medium text-slate-600">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" step="1" inputMode="decimal" className={inputCls} />
          </div>
        )}

        <button onClick={handleAdd} disabled={!canAdd}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition min-h-[44px] self-end ${canAdd ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <svg className="w-4 h-4 inline -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {' '}Add
        </button>
      </div>

      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Optional label (e.g. Front gable, Main roof)"
        className="w-full rounded-lg border border-slate-200 px-2 md:px-3 py-1.5 text-sm md:text-xs text-slate-600 focus:border-slate-900 focus:outline-none"
      />
    </div>
  );
}
