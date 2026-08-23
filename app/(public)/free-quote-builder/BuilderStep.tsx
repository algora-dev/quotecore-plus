'use client';

import { useState } from 'react';
import type { AreaComponent, BuilderComponent, BuilderEntry, MeasureMode, ParentArea } from './types';
import { makeId } from './types';
import {
  areaComponentTotals, entryFinalValue, entryRawValue, grandTotals, fmt,
} from './calc';

interface BuilderStepProps {
  components: BuilderComponent[];
  areas: ParentArea[];
  setAreas: (a: ParentArea[]) => void;
  measureMode: MeasureMode;
  setMeasureMode: (m: MeasureMode) => void;
  unitSystem: 'metric' | 'imperial' | 'squares';
  currency: string;
  onBack: () => void;
  onGenerate: () => void;
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none';

export default function BuilderStep({ components, areas, setAreas, measureMode, setMeasureMode, unitSystem, currency, onBack, onGenerate }: BuilderStepProps) {
  const [newAreaName, setNewAreaName] = useState('');
  const compById = new Map(components.map(c => [c.id, c]));
  const len = unitSystem === 'metric' ? 'm' : 'ft';
  const areaU = unitSystem === 'metric' ? 'm\u00B2' : unitSystem === 'imperial' ? 'sq ft' : 'squares';

  function addArea() {
    const name = newAreaName.trim() || `Area ${areas.length + 1}`;
    setAreas([...areas, { id: makeId('area'), name, pitchDegrees: 25, components: [] }]);
    setNewAreaName('');
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

  return (
    <div className="space-y-6">
      {/* Mode gate */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-900">How are you entering measurements?</h2>
        <p className="mt-0.5 text-xs md:text-sm text-slate-400">Decide up-front - this controls whether pitch factors are applied.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={() => setMeasureMode('actual')}
            className={`rounded-xl border p-4 text-left transition ${measureMode === 'actual' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
            <div className="text-sm font-semibold">Actual measurements</div>
            <div className={`mt-1 text-xs ${measureMode === 'actual' ? 'text-slate-300' : 'text-slate-400'}`}>I already have true, final measurements. No pitch adjustment needed.</div>
          </button>
          <button onClick={() => setMeasureMode('plan')}
            className={`rounded-xl border p-4 text-left transition ${measureMode === 'plan' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
            <div className="text-sm font-semibold">Plan measurements</div>
            <div className={`mt-1 text-xs ${measureMode === 'plan' ? 'text-slate-300' : 'text-slate-400'}`}>Taken from a 2D plan - pitch factors get applied to get true lengths and areas.</div>
          </button>
        </div>
      </div>

      {/* Areas */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-900">Parent areas</h2>
        <p className="mt-0.5 text-xs md:text-sm text-slate-400">Group your work by area - roof planes, rooms, slabs, whatever suits the job.</p>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} value={newAreaName} onChange={e => setNewAreaName(e.target.value)} placeholder="e.g. North roof, Lounge, Driveway" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addArea(); } }} aria-label="New area name" />
          <button onClick={addArea} className="flex-shrink-0 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Add area</button>
        </div>
      </div>

      {areas.map(area => (
        <div key={area.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <input className="rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-orange-500 focus:outline-none" value={area.name} onChange={e => updateArea(area.id, { name: e.target.value })} aria-label="Area name" />
            {measureMode === 'plan' && (
              <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                Pitch
                <input type="number" min="0" max="89" step="0.5" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs focus:border-orange-500 focus:outline-none" value={area.pitchDegrees} onChange={e => updateArea(area.id, { pitchDegrees: parseFloat(e.target.value) || 0 })} aria-label={`Pitch for ${area.name}`} />
                °
              </label>
            )}
            <button onClick={() => removeArea(area.id)} className="p-1 text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${area.name}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* area components */}
          {area.components.map(ac => {
            const comp = compById.get(ac.componentId);
            if (!comp) return null;
            const t = areaComponentTotals(ac, comp, area, measureMode);
            return (
              <div key={ac.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-800">{comp.name}</div>
                  <button onClick={() => removeAreaComponent(area.id, ac.id)} className="p-1 text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${comp.name}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {ac.entries.map((e, i) => {
                  const raw = entryRawValue(e, comp);
                  const final = entryFinalValue(e, comp, area, measureMode);
                  const pitched = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none' && raw > 0;
                  const desc = comp.measurementType === 'quantity'
                    ? `Qty ${e.quantity || 1}`
                    : comp.measurementType === 'area'
                      ? e.isTotal ? `Total ${e.value}` : `${e.value} × ${e.value2 ?? 0}`
                      : `${e.value}`;
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-orange-50/40 hover:border-orange-200">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700">{e.label || `Entry ${i + 1}`}</span>
                          {(e.quantity || 1) > 1 && <span className="text-[10px] text-slate-400">x{e.quantity}</span>}
                          {pitched && e.pitchDegrees != null && <span className="text-[10px] text-slate-400">@ {e.pitchDegrees}°</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">{desc}</span>
                          {pitched && <><span className="text-[10px] text-slate-300">→</span><span className="text-[10px] text-slate-500">{fmt(final)}</span></>}
                        </div>
                      </div>
                      <button onClick={() => removeEntry(area.id, ac.id, e.id)} className="p-1 text-slate-300 hover:text-red-500 transition" aria-label="Remove entry">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                <AddEntryForm comp={comp} area={area} measureMode={measureMode} len={len} areaU={areaU} onAdd={entry => addEntry(area.id, ac.id, entry)} />
                {t.entryCount > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div className="text-xs text-slate-500">Subtotal ({t.entryCount} {t.entryCount === 1 ? 'entry' : 'entries'}){comp.wasteType === 'percent' && <span className="ml-1">+ {comp.wasteValue}% waste</span>}</div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900">{fmt(t.withWasteTotal)} {comp.measurementType === 'quantity' ? 'pcs' : comp.measurementType === 'area' ? areaU : len}</span>
                      {(t.materialCost + t.labourCost) > 0 && <div className="text-xs text-[#BD4A1A] font-medium">{currency}{fmt(t.materialCost + t.labourCost)}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* add component to area */}
          <AddComponentPicker components={components} onPick={cid => addComponentToArea(area.id, cid)} />
        </div>
      ))}

      {areas.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">Add your first area above to start building.</p>
        </div>
      )}

      {/* totals + generate */}
      {areas.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
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
            <button onClick={onBack} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">Back to components</button>
            <button onClick={onGenerate} disabled={entryCount === 0} className="rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#A03E15] disabled:opacity-40">
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
      <button onClick={() => setOpen(v => !v)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400">
        + Add component
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

function AddEntryForm({ comp, area, measureMode, len, areaU, onAdd }: {
  comp: BuilderComponent;
  area: ParentArea;
  measureMode: MeasureMode;
  len: string;
  areaU: string;
  onAdd: (e: BuilderEntry) => void;
}) {
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [qty, setQty] = useState('1');
  const [isTotal, setIsTotal] = useState(false);
  const [pitch, setPitch] = useState(String(area.pitchDegrees));
  const [label, setLabel] = useState('');
  const smallCls = 'w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-center focus:border-orange-500 focus:outline-none';

  function add() {
    const v = parseFloat(value);
    const q = parseInt(qty) || 1;
    const base: BuilderEntry = {
      id: makeId('e'),
      label: label.trim(),
      value: 0,
      quantity: 1,
    };
    if (comp.measurementType === 'quantity') {
      if (!Number.isFinite(v)) return;
      base.quantity = v >= 0 ? v : q;
    } else if (comp.measurementType === 'area') {
      if (!Number.isFinite(v)) return;
      base.value = v;
      base.isTotal = isTotal || value2 === '';
      if (!base.isTotal) base.value2 = parseFloat(value2) || 0;
    } else {
      if (!Number.isFinite(v)) return;
      base.value = v;
    }
    base.quantity = comp.measurementType === 'quantity' ? base.quantity : q;
    if (measureMode === 'plan' && comp.pitchEnabled) base.pitchDegrees = parseFloat(pitch) || 0;
    onAdd(base);
    setValue(''); setValue2(''); setQty('1'); setLabel('');
  }

  const usePitch = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2">
      <input className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none" value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" aria-label="Entry label" />
      {comp.measurementType === 'quantity' ? (
        <input type="number" min="0" step="1" className={smallCls} value={value} onChange={e => setValue(e.target.value)} placeholder="Qty" aria-label="Quantity" />
      ) : comp.measurementType === 'area' && !isTotal ? (
        <>
          <input type="number" min="0" step="0.01" className={smallCls} value={value} onChange={e => setValue(e.target.value)} placeholder="L" aria-label="Length" />
          <span className="text-xs text-slate-400">×</span>
          <input type="number" min="0" step="0.01" className={smallCls} value={value2} onChange={e => setValue2(e.target.value)} placeholder="W" aria-label="Width" />
        </>
      ) : (
        <input type="number" min="0" step="0.01" className={smallCls} value={value} onChange={e => setValue(e.target.value)} placeholder={comp.measurementType === 'area' ? `Total ${areaU}` : len} aria-label="Measurement" />
      )}
      {comp.measurementType === 'area' && (
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          <input type="checkbox" checked={isTotal} onChange={e => setIsTotal(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-0" />
          total
        </label>
      )}
      {comp.measurementType !== 'quantity' && (
        <input type="number" min="1" step="1" className={smallCls} value={qty} onChange={e => setQty(e.target.value)} placeholder="x" aria-label="Quantity" />
      )}
      {usePitch && (
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          @<input type="number" min="0" max="89" step="0.5" className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-center text-xs focus:border-orange-500 focus:outline-none" value={pitch} onChange={e => setPitch(e.target.value)} aria-label="Pitch degrees" />°
        </label>
      )}
      <button onClick={add} className="ml-auto rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800">Add entry</button>
    </div>
  );
}
