// Step 2 (parent model v2): add buckets (name-only parents), then measured
// components under each bucket (area / lineal / point), then entries per
// component. Buckets never carry measurements - components do.

'use client';

import { useState } from 'react';
import type { ParentJob, ParentComponent, ParentEntry, ParentBasis, ParentArea } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';
import type { TradeConfig } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_OPTIONS: { value: ParentBasis; label: string; desc: string }[] = [
  { value: 'area', label: 'Wall Area', desc: 'm\u00B2 - draw or enter areas, or length x height' },
  { value: 'lineal', label: 'Wall Length', desc: 'm - point-to-point lengths, trims, tape' },
  { value: 'point', label: 'Wall Item', desc: 'ea - one-off counted items (vents, fittings)' },
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

  function renameBucket(id: string, name: string) {
    setJob({ ...job, parents: job.parents.map(p => p.id === id ? { ...p, name } : p) });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{trade.areaLabel} & measurements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add a bucket for each {trade.areaNoun} system (e.g. &quot;Cedar Cladding&quot;, &quot;Plasterboard&quot;), then add measured components under it - walls (m\u00B2), lengths (m) or items (ea). Products get applied to the components at the next step.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={bucketName}
            onChange={e => setBucketName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBucket(bucketName); }}
            placeholder={trade.key === 'cladding' ? 'e.g. Cedar Cladding, Render, Plasterboard' : 'e.g. Hybrid flooring, Tiles, Carpet'}
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
          onRename={n => renameBucket(p.id, n)}
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
  trade, bucket, job, setJob, onRename, onRemove,
}: {
  trade: TradeConfig;
  bucket: ParentArea;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const components = job.components.filter(c => c.parentId === bucket.id);
  const [compName, setCompName] = useState('');
  const [compBasis, setCompBasis] = useState<ParentBasis>('area');

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

  function renameComponent(id: string, name: string) {
    setJob({ ...job, components: job.components.map(c => c.id === id ? { ...c, name } : c) });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <input
          value={bucket.name}
          onChange={e => onRename(e.target.value)}
          aria-label="Bucket name"
          className="w-full sm:w-auto flex-1 min-w-40 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none"
        />
        <button onClick={onRemove} className="text-xs text-slate-400 hover:text-slate-600 transition" title="Remove this bucket and its components">
          Remove
        </button>
      </div>

      <div className="p-4 space-y-3">
        {components.map(c => (
          <ComponentCard key={c.id} trade={trade} comp={c} job={job} setJob={setJob}
            onRename={n => renameComponent(c.id, n)} onRemove={() => removeComponent(c.id)} />
        ))}

        {/* Add component */}
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Component name</label>
              <input value={compName} onChange={e => setCompName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addComponent(); }}
                placeholder={trade.key === 'cladding' ? 'e.g. Walls, Window trims, Vents' : 'e.g. Floors, Skirting, Transitions'}
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
    </div>
  );
}

function ComponentCard({
  trade, comp, job, setJob, onRename, onRemove,
}: {
  trade: TradeConfig;
  comp: ParentComponent;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const entries = job.entries.filter(e => e.componentId === comp.id);
  const total = componentTotal(job, comp.id);
  const unit = PARENT_BASIS_UNIT[comp.basis];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <input
          value={comp.name}
          onChange={e => onRename(e.target.value)}
          aria-label="Component name"
          className="flex-1 min-w-32 rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {BASIS_OPTIONS.find(o => o.value === comp.basis)?.label ?? comp.basis}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {unit}</span>
          <button onClick={onRemove} className="text-xs text-slate-400 hover:text-slate-600 transition">Remove</button>
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
                    className="text-xs text-slate-400 hover:text-slate-600 transition">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddEntryForm trade={trade} comp={comp} onAdd={e => setJob({ ...job, entries: [...job.entries, e] })} />
      </div>
    </div>
  );
}

function AddEntryForm({ trade, comp, onAdd }: {
  trade: TradeConfig;
  comp: ParentComponent;
  onAdd: (e: ParentEntry) => void;
}) {
  const [label, setLabel] = useState('');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [angle, setAngle] = useState('');
  /** area basis: Area OR Length x Height (cladding only); others single value */
  const [mode, setMode] = useState<'area' | 'lxh'>(trade.allowHeight ? 'lxh' : 'area');

  const useLxh = comp.basis === 'area' && trade.allowHeight && mode === 'lxh';
  const a = parseFloat(val1) || 0;
  const b = parseFloat(val2) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const ang = trade.allowAngle && comp.basis === 'area' ? (parseFloat(angle) || 0) : 0;
  const value = comp.basis === 'point' ? Math.max(1, Math.round(a)) : useLxh ? a * b : a;
  const canAdd = label.trim().length > 0 && value > 0;

  function add() {
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
    setLabel(''); setVal1(''); setVal2(''); setQty('1'); setAngle('');
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
        <button onClick={add} disabled={!canAdd}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
          Add entry
        </button>
      </div>
    </div>
  );
}
