// Step 2 (parent model): add area groups (parents) and their measured
// areas. Each parent = one product / covering type; entries roll up under
// it. Supports length x height (cladding) and optional angle per entry.

'use client';

import { useState } from 'react';
import type { ParentJob, ParentEntry, ParentArea } from './types';
import { emptyParentJob, makeId, parentTotal } from './types';
import type { TradeConfig } from './tradeConfig';
import { StepCard } from './StepShell';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function ParentMeasureStep({
  trade, job, setJob, onBack, onNext,
}: {
  trade: TradeConfig;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [parentName, setParentName] = useState('');

  function addParent(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p: ParentArea = { id: makeId('parent'), name: trimmed };
    setJob({ ...job, parents: [...job.parents, p] });
    setParentName('');
  }

  function removeParent(id: string) {
    setJob({
      parents: job.parents.filter(p => p.id !== id),
      entries: job.entries.filter(e => e.parentId !== id),
      applied: job.applied.filter(a => a.parentId !== id),
      customComponents: job.customComponents,
    });
  }

  function renameParent(id: string, name: string) {
    setJob({ ...job, parents: job.parents.map(p => p.id === id ? { ...p, name } : p) });
  }

  const hasEntries = job.entries.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{trade.areaLabel} & measurements</h2>
        <p className="mt-1 text-sm text-slate-500">{trade.parentsIntro}</p>

        {/* Add parent */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={parentName}
            onChange={e => setParentName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addParent(parentName); }}
            placeholder={`Area group name (e.g. "Weatherboard zone", "Render zone")`}
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={() => addParent(parentName)}
            disabled={parentName.trim().length === 0}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40 whitespace-nowrap"
          >
            Add area group
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          One group per product type. Using a single covering for everything? One group with the total works too.
        </p>
      </div>

      {/* Parent cards */}
      {job.parents.map(p => (
        <ParentCard
          key={p.id}
          trade={trade}
          parent={p}
          job={job}
          setJob={setJob}
          onRename={n => renameParent(p.id, n)}
          onRemove={() => removeParent(p.id)}
        />
      ))}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={job.parents.length === 0 || !hasEntries}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          Next: Products
        </button>
      </div>
    </div>
  );
}

function ParentCard({
  trade, parent, job, setJob, onRename, onRemove,
}: {
  trade: TradeConfig;
  parent: ParentArea;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const entries = job.entries.filter(e => e.parentId === parent.id);
  const total = parentTotal(job, parent.id);

  function addEntry(e: ParentEntry) {
    setJob({ ...job, entries: [...job.entries, e] });
  }

  function removeEntry(id: string) {
    setJob({ ...job, entries: job.entries.filter(e => e.id !== id) });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <input
          value={parent.name}
          onChange={e => onRename(e.target.value)}
          aria-label="Area group name"
          className="w-full sm:w-auto flex-1 min-w-40 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {total.toFixed(1)} m\u00B2
          </span>
          <button onClick={onRemove} className="text-xs text-slate-400 hover:text-slate-600 transition" title="Remove this area group">
            Remove
          </button>
        </div>
      </div>
      <div className="p-4">
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
                  {(e.angleDegrees ?? 0) > 0 && <span className="ml-1 text-xs text-slate-400">@ {e.angleDegrees}\u00B0 {trade.angleLabel.toLowerCase()}</span>}
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-slate-700">{(e.value * (e.quantity || 1)).toFixed(1)} m\u00B2</span>
                  <button onClick={() => removeEntry(e.id)} className="text-xs text-slate-400 hover:text-slate-600 transition">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddEntryForm trade={trade} parentId={parent.id} onAdd={addEntry} />
      </div>
    </div>
  );
}

function AddEntryForm({ trade, parentId, onAdd }: {
  trade: TradeConfig;
  parentId: string;
  onAdd: (e: ParentEntry) => void;
}) {
  const [label, setLabel] = useState('');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [angle, setAngle] = useState('');
  /** cladding: area OR length x height toggle; flooring: area only */
  const [mode, setMode] = useState<'area' | 'lxh'>(trade.allowHeight ? 'lxh' : 'area');

  const a = parseFloat(val1) || 0;
  const b = parseFloat(val2) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const ang = trade.allowAngle ? (parseFloat(angle) || 0) : 0;
  const value = mode === 'lxh' ? a * b : a;
  const canAdd = label.trim().length > 0 && value > 0;

  function add() {
    if (!canAdd) return;
    onAdd({
      id: makeId('pe'),
      parentId,
      label: label.trim(),
      value: Math.round(value * 1000) / 1000,
      quantity: q,
      length: mode === 'lxh' ? a : null,
      height: mode === 'lxh' ? b : null,
      angleDegrees: ang > 0 ? ang : null,
    });
    setLabel(''); setVal1(''); setVal2(''); setQty('1'); setAngle('');
  }

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      {trade.allowHeight && (
        <div className="mb-2 flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
          <button
            onClick={() => setMode('lxh')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'lxh' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            Length x Height
          </button>
          <button
            onClick={() => setMode('area')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'area' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            Area (m\u00B2)
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={trade.key === 'cladding' ? 'e.g. North elevation' : 'e.g. Lounge'} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">{mode === 'lxh' ? 'Length (m)' : 'Area (m\u00B2)'}</label>
          <input type="number" min="0" step="0.01" value={val1} onChange={e => setVal1(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">{mode === 'lxh' ? 'Height (m)' : 'Qty'}</label>
          {mode === 'lxh' ? (
            <input type="number" min="0" step="0.01" value={val2} onChange={e => setVal2(e.target.value)} className={inputCls} />
          ) : (
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          )}
        </div>
        {mode === 'lxh' && (
          <div>
            <label className="text-xs font-medium text-slate-600">Qty</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          </div>
        )}
        {trade.allowAngle && (
          <div>
            <label className="text-xs font-medium text-slate-600">{trade.angleLabel} \u00B0 (opt.)</label>
            <input type="number" min="0" max="89" step="0.5" value={angle} onChange={e => setAngle(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {canAdd ? `${(value * q).toFixed(1)} m\u00B2 total` : 'Enter a name and value'}
        </span>
        <button
          onClick={add}
          disabled={!canAdd}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40"
        >
          Add {trade.areaNoun} area
        </button>
      </div>
    </div>
  );
}
