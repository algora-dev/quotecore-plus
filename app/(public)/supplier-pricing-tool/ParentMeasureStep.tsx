// Step 2 (parent model v2): buckets (name-only parents) -> measured
// components -> entries. Everything lands COLLAPSED (bucket summary only);
// expanding reveals components + entries with add/delete controls.
// v3 (2026-09-08): header copy is conditional on the entry path (manual vs
// plan takeoff), component creation merges the measurement into the same
// form (no zero-measurement components), and all names are optional with
// sensible defaults. Bucket examples come from the supplier def.

'use client';

import { useState } from 'react';
import type { ParentJob, ParentComponent, ParentEntry, ParentBasis, ParentArea } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';
import type { TradeConfig } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_OPTIONS: { value: ParentBasis; label: string; desc: string }[] = [
  { value: 'area', label: 'Area', desc: 'm\u00B2 - enter areas, or length x height' },
  { value: 'lineal', label: 'Single Length', desc: 'm - point-to-point lengths, trims, tape' },
  { value: 'point', label: 'Single Item', desc: 'ea - one-off counted items (vents, fittings)' },
];

export function ParentMeasureStep({
  trade, job, setJob, onBack, onNext, fromPlan = false, bucketExamples,
}: {
  trade: TradeConfig;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onBack: () => void;
  onNext: () => void;
  /** true when the user measured from plans (takeoff handoff) - review copy */
  fromPlan?: boolean;
  /** supplier-specific bucket name examples (falls back to trade defaults) */
  bucketExamples?: readonly string[];
}) {
  const [bucketName, setBucketName] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const examples = (bucketExamples && bucketExamples.length > 0 ? bucketExamples : trade.bucketExamples) ?? [];
  const exampleText = examples.length > 0 ? ` (e.g. ${examples.join(', ')})` : '';

  function addBucket(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = makeId('bucket');
    setJob({ ...job, parents: [...job.parents, { id, name: trimmed }] });
    setBucketName('');
    setLastAdded(id);
  }

  function removeBucket(id: string) {
    const compIds = job.components.filter(c => c.parentId === id).map(c => c.id);
    setJob({
      parents: job.parents.filter(p => p.id !== id),
      components: job.components.filter(c => c.parentId !== id),
      entries: job.entries.filter(e => !compIds.includes(e.componentId)),
      applied: job.applied.filter(a => !compIds.includes(a.componentId)),
      customComponents: job.customComponents,
    });
  }

  const title = fromPlan
    ? `${trade.areaLabel} & measurements`
    : `Add your buckets & ${trade.areaNoun} areas`;
  const sub = fromPlan
    ? `Here's what you measured from your plans. Review each bucket, adjust anything, or add more.`
    : `A bucket is one product or covering type${exampleText}. Add every ${trade.areaNoun} area you measured under its bucket - you'll apply products to them at the next step.`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={bucketName}
            onChange={e => setBucketName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBucket(bucketName); }}
            placeholder={`Add a bucket${exampleText}`}
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={() => addBucket(bucketName)}
            disabled={bucketName.trim().length === 0}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40 whitespace-nowrap"
          >
            Add bucket
          </button>
        </div>
      </div>

      {job.parents.map(p => (
        <BucketCard
          key={p.id}
          trade={trade}
          bucket={p}
          job={job}
          setJob={setJob}
          onRemove={() => removeBucket(p.id)}
          defaultOpen={p.id === lastAdded}
        />
      ))}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={job.components.length === 0 || job.entries.length === 0}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          Next: Products
        </button>
      </div>
    </div>
  );
}

function BucketCard({
  trade, bucket, job, setJob, onRemove, defaultOpen = false,
}: {
  trade: TradeConfig;
  bucket: ParentArea;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemove: () => void;
  /** freshly added buckets open straight to the measurement form */
  defaultOpen?: boolean;
}) {
  const components = job.components.filter(c => c.parentId === bucket.id);
  const [open, setOpen] = useState(defaultOpen);

  // Per-basis totals for the collapsed summary line
  const totals = components.reduce<Record<string, number>>((acc, c) => {
    const t = componentTotal(job, c.id);
    acc[c.basis] = (acc[c.basis] ?? 0) + t;
    return acc;
  }, {});
  const summary = Object.entries(totals)
    .map(([basis, t]) => `${t.toFixed(1)} ${PARENT_BASIS_UNIT[basis as ParentBasis]}`)
    .join(' - ');

  /** Merged create: component + its first measured entry land together. */
  function addComponentWithEntry(name: string, basis: ParentBasis, entry: Omit<ParentEntry, 'id' | 'componentId'>) {
    const comp: ParentComponent = {
      id: makeId('comp'),
      parentId: bucket.id,
      name: name.trim() || `${bucket.name} ${components.length + 1}`,
      basis,
    };
    const first: ParentEntry = { ...entry, id: makeId('pe'), componentId: comp.id,
      label: entry.label.trim() || `${trade.areaNoun.charAt(0).toUpperCase() + trade.areaNoun.slice(1)} 1` };
    setJob({ ...job, components: [...job.components, comp], entries: [...job.entries, first] });
  }

  function removeComponent(id: string) {
    setJob({
      ...job,
      components: job.components.filter(c => c.id !== id),
      entries: job.entries.filter(e => e.componentId !== id),
      applied: job.applied.filter(a => a.componentId !== id),
    });
  }

  function addEntry(componentId: string, entry: ParentEntry) {
    setJob({ ...job, entries: [...job.entries, entry] });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-900">{bucket.name}</span>
          <span className="ml-2 text-xs text-slate-400">
            {components.length} component{components.length === 1 ? '' : 's'}
            {summary ? ` - ${summary}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div className="flex justify-end">
            <button onClick={onRemove} className="text-xs text-slate-400 hover:text-red-500 transition" title="Delete this bucket and everything under it">
              Delete bucket
            </button>
          </div>

          {components.map(c => (
            <ComponentCard key={c.id} trade={trade} comp={c} job={job} setJob={setJob}
              onRemove={() => removeComponent(c.id)} onAddEntry={addEntry} />
          ))}

          {/* Add component + measurement in one go */}
          <AddComponentForm trade={trade} placeholderName={trade.key === 'cladding' ? 'e.g. Walls, Window trims, Vents' : 'e.g. Floors, Skirting'} onAdd={addComponentWithEntry} />
        </div>
      )}
    </div>
  );
}

function ComponentCard({
  trade, comp, job, setJob, onRemove, onAddEntry,
}: {
  trade: TradeConfig;
  comp: ParentComponent;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemove: () => void;
  onAddEntry: (componentId: string, entry: ParentEntry) => void;
}) {
  const entries = job.entries.filter(e => e.componentId === comp.id);
  const total = componentTotal(job, comp.id);
  const unit = PARENT_BASIS_UNIT[comp.basis];
  const [adding, setAdding] = useState(false);

  function addEntry(entry: Omit<ParentEntry, 'id' | 'componentId'>) {
    const label = entry.label.trim() || defaultEntryLabel();
    onAddEntry(comp.id, { ...entry, id: makeId('pe'), componentId: comp.id, label });
  }

  function defaultEntryLabel() {
    const noun = trade.areaNoun.charAt(0).toUpperCase() + trade.areaNoun.slice(1);
    return `${noun} ${entries.length + 1}`;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-800">{comp.name}</span>
          <span className="ml-2 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {BASIS_OPTIONS.find(o => o.value === comp.basis)?.label ?? comp.basis}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {unit}</span>
          <button onClick={() => setAdding(v => !v)} className="text-xs text-blue-600 hover:text-blue-700 transition font-medium">
            {adding ? 'Close' : '+ Add more'}
          </button>
          <button onClick={onRemove} className="text-xs text-slate-400 hover:text-red-500 transition">Delete</button>
        </div>
      </div>
      <div className="px-3 py-2">
        {entries.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {entries.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{e.label}</span>
                  {e.quantity > 1 && <span className="ml-1 text-xs text-slate-400">x{e.quantity}</span>}
                  {(e.length != null && e.height != null) && (
                    <span className="ml-1 text-xs text-slate-400">{e.length.toFixed(1)}m x {e.height.toFixed(1)}m</span>
                  )}
                  {(e.angleDegrees ?? 0) > 0 && <span className="ml-1 text-xs text-slate-400">@ {e.angleDegrees}°</span>}
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-slate-700">{(e.value * (e.quantity || 1)).toFixed(1)} {unit}</span>
                  <button onClick={() => setJob({ ...job, entries: job.entries.filter(x => x.id !== e.id) })}
                    className="text-xs text-slate-400 hover:text-red-500 transition">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <AddEntryForm trade={trade} basis={comp.basis} onDone={() => setAdding(false)} onAdd={addEntry} defaultLabel={defaultEntryLabel()} />
        )}
      </div>
    </div>
  );
}

/** Shared measurement fields for one entry. basis drives which inputs show. */
function useEntryFields(basis: ParentBasis, trade: TradeConfig) {
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [angle, setAngle] = useState('');
  const [mode, setMode] = useState<'area' | 'lxh'>(trade.allowHeight ? 'lxh' : 'area');

  const useLxh = basis === 'area' && trade.allowHeight && mode === 'lxh';
  const a = parseFloat(val1) || 0;
  const b = parseFloat(val2) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const ang = trade.allowAngle && basis === 'area' ? (parseFloat(angle) || 0) : 0;
  const value = basis === 'point' ? Math.max(1, Math.round(a)) : useLxh ? a * b : a;
  const canAdd = value > 0;

  function buildEntry(label: string): Omit<ParentEntry, 'id' | 'componentId'> {
    return {
      label,
      value: Math.round(value * 1000) / 1000,
      quantity: basis === 'point' ? 1 : q,
      length: useLxh ? a : null,
      height: useLxh ? b : null,
      angleDegrees: ang > 0 ? ang : null,
    };
  }

  function reset() {
    setVal1(''); setVal2(''); setQty('1'); setAngle('');
  }

  return { val1, setVal1, val2, setVal2, qty, setQty, angle, setAngle, mode, setMode, useLxh, q, value, canAdd, buildEntry, reset };
}

/** Measurement inputs (no name) - shared by the create + add-more forms. */
function MeasurementFields({ basis, trade, f }: {
  basis: ParentBasis;
  trade: TradeConfig;
  f: ReturnType<typeof useEntryFields>;
}) {
  const unit1 = basis === 'area' ? (f.useLxh ? 'Length (m)' : 'Area (m²)') : basis === 'lineal' ? 'Length (m)' : 'Count';
  return (
    <>
      {basis === 'area' && trade.allowHeight && (
        <div className="mb-2 flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5 w-fit">
          <button onClick={() => f.setMode('lxh')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${f.mode === 'lxh' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
            Length x Height
          </button>
          <button onClick={() => f.setMode('area')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${f.mode === 'area' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
            Area (m²)
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600">{unit1}</label>
          <input type="number" min="0" step={basis === 'point' ? '1' : '0.01'} value={f.val1} onChange={e => f.setVal1(e.target.value)} className={inputCls} />
        </div>
        {f.useLxh ? (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600">Height (m)</label>
              <input type="number" min="0" step="0.01" value={f.val2} onChange={e => f.setVal2(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Qty</label>
              <input type="number" min="1" step="1" value={f.qty} onChange={e => f.setQty(e.target.value)} className={inputCls} />
            </div>
          </>
        ) : basis !== 'point' ? (
          <div>
            <label className="text-xs font-medium text-slate-600">Qty</label>
            <input type="number" min="1" step="1" value={f.qty} onChange={e => f.setQty(e.target.value)} className={inputCls} />
          </div>
        ) : null}
        {basis === 'area' && trade.allowAngle && (
          <div>
            <label className="text-xs font-medium text-slate-600">{trade.angleLabel} ° (opt.)</label>
            <input type="number" min="0" max="89" step="0.5" value={f.angle} onChange={e => f.setAngle(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        )}
      </div>
    </>
  );
}

/** Create a component AND its first measurement in one go. Name optional,
 *  measurement required - zero-measurement components can't exist. */
function AddComponentForm({ trade, placeholderName, onAdd }: {
  trade: TradeConfig;
  placeholderName: string;
  onAdd: (name: string, basis: ParentBasis, entry: Omit<ParentEntry, 'id' | 'componentId'>) => void;
}) {
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<ParentBasis>('area');
  const f = useEntryFields(basis, trade);

  function add(andContinue: boolean) {
    if (!f.canAdd) return;
    onAdd(name, basis, f.buildEntry(name.trim() ? '' : ''));
    if (andContinue) {
      setName('');
      f.reset();
    }
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Name (optional)</label>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(false); } }}
            placeholder={placeholderName} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Measured by</label>
          <select value={basis} onChange={e => setBasis(e.target.value as ParentBasis)} className={inputCls}>
            {BASIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>)}
          </select>
        </div>
      </div>
      <MeasurementFields basis={basis} trade={trade} f={f} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {f.canAdd ? `${(f.value * (basis === 'point' ? 1 : f.q)).toFixed(1)} ${PARENT_BASIS_UNIT[basis]} total` : 'Enter the measurement to add'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => add(true)} disabled={!f.canAdd}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
            Add + another
          </button>
          <button onClick={() => add(false)} disabled={!f.canAdd}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
            Add component
          </button>
        </div>
      </div>
    </div>
  );
}

/** Add another entry under an existing component. Name optional. */
function AddEntryForm({ trade, basis, defaultLabel, onAdd, onDone }: {
  trade: TradeConfig;
  basis: ParentBasis;
  defaultLabel: string;
  onAdd: (entry: Omit<ParentEntry, 'id' | 'componentId'>) => void;
  onDone: () => void;
}) {
  const [label, setLabel] = useState('');
  const f = useEntryFields(basis, trade);

  function add(andContinue: boolean) {
    if (!f.canAdd) return;
    onAdd(f.buildEntry(label.trim() || defaultLabel));
    if (andContinue) {
      setLabel('');
      f.reset();
    } else {
      onDone();
    }
  }

  return (
    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-slate-600">Name (optional)</label>
          <input value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(false); } }}
            placeholder={basis === 'point' ? 'e.g. Vent' : `e.g. ${defaultLabel}`} className={inputCls} />
        </div>
      </div>
      <MeasurementFields basis={basis} trade={trade} f={f} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {f.canAdd ? `${(f.value * (basis === 'point' ? 1 : f.q)).toFixed(1)} ${PARENT_BASIS_UNIT[basis]} total` : 'Enter a value'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => add(true)} disabled={!f.canAdd}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
            Add + another
          </button>
          <button onClick={() => add(false)} disabled={!f.canAdd}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
            Add entry
          </button>
        </div>
      </div>
    </div>
  );
}
