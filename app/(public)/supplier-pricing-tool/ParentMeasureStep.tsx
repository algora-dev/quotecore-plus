// Step 2 (parent model v2): buckets (name-only parents) -> measured
// components -> entries. Everything lands COLLAPSED (bucket summary only);
// expanding reveals components + entries with add/delete controls.

'use client';

import { useState } from 'react';
import type { ParentJob, ParentComponent, ParentEntry, ParentBasis, ParentArea } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';
import type { TradeConfig } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_OPTIONS: { value: ParentBasis; label: string; desc: string }[] = [
  { value: 'area', label: 'Area', desc: 'm\u00B2 - draw or enter areas, or length x height' },
  { value: 'lineal', label: 'Single Length', desc: 'm - point-to-point lengths, trims, tape' },
  { value: 'point', label: 'Single Item', desc: 'ea - one-off counted items (vents, fittings)' },
];

export function ParentMeasureStep({
  trade, job, setJob, onBack, onNext,
}: {
  trade: TradeConfig;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [bucketName, setBucketName] = useState('');

  function addBucket(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setJob({ ...job, parents: [...job.parents, { id: makeId('bucket'), name: trimmed }] });
    setBucketName('');
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{trade.areaLabel} & measurements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s what you measured. Expand a bucket to review or add more - click any entry&apos;s Remove to delete it.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={bucketName}
            onChange={e => setBucketName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBucket(bucketName); }}
            placeholder={trade.key === 'cladding' ? 'Add another bucket (e.g. Render)' : 'Add another bucket (e.g. Tiles)'}
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
  trade, bucket, job, setJob, onRemove,
}: {
  trade: TradeConfig;
  bucket: ParentArea;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemove: () => void;
}) {
  const components = job.components.filter(c => c.parentId === bucket.id);
  const [open, setOpen] = useState(false);
  const [compName, setCompName] = useState('');
  const [compBasis, setCompBasis] = useState<ParentBasis>('area');

  // Per-basis totals for the collapsed summary line
  const totals = components.reduce<Record<string, number>>((acc, c) => {
    const t = componentTotal(job, c.id);
    acc[c.basis] = (acc[c.basis] ?? 0) + t;
    return acc;
  }, {});
  const summary = Object.entries(totals)
    .map(([basis, t]) => `${t.toFixed(1)} ${PARENT_BASIS_UNIT[basis as ParentBasis]}`)
    .join(' - ');

  function addComponent() {
    const trimmed = compName.trim();
    if (!trimmed) return;
    const comp: ParentComponent = { id: makeId('comp'), parentId: bucket.id, name: trimmed, basis: compBasis };
    setJob({ ...job, components: [...job.components, comp] });
    setCompName('');
  }

  function removeComponent(id: string) {
    setJob({
      ...job,
      components: job.components.filter(c => c.id !== id),
      entries: job.entries.filter(e => e.componentId !== id),
      applied: job.applied.filter(a => a.componentId !== id),
    });
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
              onRemove={() => removeComponent(c.id)} />
          ))}

          {/* Add component */}
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">New component name</label>
                <input value={compName} onChange={e => setCompName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addComponent(); }}
                  placeholder={trade.key === 'cladding' ? 'e.g. Walls, Window trims, Vents' : 'e.g. Floors, Skirting'}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Measured by</label>
                <select value={compBasis} onChange={e => setCompBasis(e.target.value as ParentBasis)} className={inputCls}>
                  {BASIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <button onClick={addComponent} disabled={compName.trim().length === 0}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
                Add component
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentCard({
  trade, comp, job, setJob, onRemove,
}: {
  trade: TradeConfig;
  comp: ParentComponent;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemove: () => void;
}) {
  const entries = job.entries.filter(e => e.componentId === comp.id);
  const total = componentTotal(job, comp.id);
  const unit = PARENT_BASIS_UNIT[comp.basis];
  const [adding, setAdding] = useState(false);

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
          <AddEntryForm trade={trade} comp={comp} onDone={() => setAdding(false)}
            onAdd={e => setJob({ ...job, entries: [...job.entries, e] })} />
        )}
      </div>
    </div>
  );
}

function AddEntryForm({ trade, comp, onAdd, onDone }: {
  trade: TradeConfig;
  comp: ParentComponent;
  onAdd: (e: ParentEntry) => void;
  onDone: () => void;
}) {
  const [label, setLabel] = useState('');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [angle, setAngle] = useState('');
  const [mode, setMode] = useState<'area' | 'lxh'>(trade.allowHeight ? 'lxh' : 'area');

  const useLxh = comp.basis === 'area' && trade.allowHeight && mode === 'lxh';
  const a = parseFloat(val1) || 0;
  const b = parseFloat(val2) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const ang = trade.allowAngle && comp.basis === 'area' ? (parseFloat(angle) || 0) : 0;
  const value = comp.basis === 'point' ? Math.max(1, Math.round(a)) : useLxh ? a * b : a;
  const canAdd = label.trim().length > 0 && value > 0;

  function add(andContinue: boolean) {
    if (!canAdd) return;
    onAdd({
      id: makeId('pe'),
      componentId: comp.id,
      label: label.trim(),
      value: Math.round(value * 1000) / 1000,
      quantity: comp.basis === 'point' ? 1 : q,
      length: useLxh ? a : null,
      height: useLxh ? b : null,
      angleDegrees: ang > 0 ? ang : null,
    });
    if (andContinue) {
      setLabel(''); setVal1(''); setVal2(''); setQty('1'); setAngle('');
    } else {
      onDone();
    }
  }

  const unit1 = comp.basis === 'area' ? (useLxh ? 'Length (m)' : 'Area (m²)') : comp.basis === 'lineal' ? 'Length (m)' : 'Count';

  return (
    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-3">
      {comp.basis === 'area' && trade.allowHeight && (
        <div className="mb-2 flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5 w-fit">
          <button onClick={() => setMode('lxh')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'lxh' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
            Length x Height
          </button>
          <button onClick={() => setMode('area')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'area' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
            Area (m²)
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder={comp.basis === 'point' ? 'e.g. Vent' : 'e.g. North elevation'} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">{unit1}</label>
          <input type="number" min="0" step={comp.basis === 'point' ? '1' : '0.01'} value={val1} onChange={e => setVal1(e.target.value)} className={inputCls} />
        </div>
        {useLxh ? (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600">Height (m)</label>
              <input type="number" min="0" step="0.01" value={val2} onChange={e => setVal2(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Qty</label>
              <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </div>
          </>
        ) : comp.basis !== 'point' ? (
          <div>
            <label className="text-xs font-medium text-slate-600">Qty</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          </div>
        ) : null}
        {comp.basis === 'area' && trade.allowAngle && (
          <div>
            <label className="text-xs font-medium text-slate-600">Angle ° (opt.)</label>
            <input type="number" min="0" max="89" step="0.5" value={angle} onChange={e => setAngle(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {canAdd ? `${(value * (comp.basis === 'point' ? 1 : q)).toFixed(1)} ${PARENT_BASIS_UNIT[comp.basis]} total` : 'Enter a name and value'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => add(true)} disabled={!canAdd}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
            Add + another
          </button>
          <button onClick={() => add(false)} disabled={!canAdd}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
            Add entry
          </button>
        </div>
      </div>
    </div>
  );
}
