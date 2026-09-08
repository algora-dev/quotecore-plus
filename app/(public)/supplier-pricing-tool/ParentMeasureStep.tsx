// Step 2 (parent model v3): buckets -> pre-seeded measurement rows.
// Each bucket expands into a configured row list (Wall areas, flashings,
// penetrations... - see bucketRows on tradeConfig / the supplier def).
// Rows are filled in or left empty; empty rows are skipped. Behind the
// scenes each row maps to a component + entries, so the product step,
// pricing, output and the canvas/takeoff path all keep working.
// Custom/canvas-created components that don't match a row render as-is.

'use client';

import { useState } from 'react';
import type { ParentJob, ParentComponent, ParentEntry, ParentBasis, ParentArea } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';
import type { TradeConfig, BucketRow } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_OPTIONS: { value: ParentBasis; label: string; desc: string }[] = [
  { value: 'area', label: 'Area', desc: 'm\u00B2 - enter areas, or length x height' },
  { value: 'lineal', label: 'Single Length', desc: 'm - point-to-point lengths, trims, tape' },
  { value: 'point', label: 'Single Item', desc: 'ea - one-off counted items (vents, fittings)' },
];

function defaultEntryLabel(trade: TradeConfig, basis: ParentBasis, count: number) {
  if (basis === 'area') {
    const noun = trade.areaNoun.charAt(0).toUpperCase() + trade.areaNoun.slice(1);
    return `${noun} ${count}`;
  }
  return basis === 'lineal' ? `Length ${count}` : `Item ${count}`;
}

export function ParentMeasureStep({
  trade, job, setJob, onBack, onNext, fromPlan = false, bucketExamples, bucketRows,
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
  /** supplier-specific row list (falls back to trade defaults) */
  bucketRows?: readonly BucketRow[];
}) {
  const [bucketName, setBucketName] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const examples = (bucketExamples && bucketExamples.length > 0 ? bucketExamples : trade.bucketExamples) ?? [];
  const exampleText = examples.length > 0 ? ` (e.g. ${examples.join(', ')})` : '';
  const rows: readonly BucketRow[] = bucketRows && bucketRows.length > 0 ? bucketRows : trade.bucketRows;

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
    : `A bucket is one product or covering type${exampleText}. Fill in the rows you have measurements for - anything left empty is skipped. Products get applied at the next step.`;

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
          rows={rows}
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
  trade, rows, bucket, job, setJob, onRemove, defaultOpen = false,
}: {
  trade: TradeConfig;
  rows: readonly BucketRow[];
  bucket: ParentArea;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemove: () => void;
  /** freshly added buckets open straight to the rows */
  defaultOpen?: boolean;
}) {
  const components = job.components.filter(c => c.parentId === bucket.id);
  const [open, setOpen] = useState(defaultOpen);
  const [customOpen, setCustomOpen] = useState(false);

  // Match each configured row to existing components (by name + basis, so
  // canvas-created rows with matching names merge in).
  const rowComps = rows.map(row => ({
    row,
    comps: components.filter(c => c.name === row.name && c.basis === row.basis),
  }));
  const rowCompIds = new Set(rowComps.flatMap(rc => rc.comps.map(c => c.id)));
  // Components not covered by a configured row (canvas-drawn, older data)
  const customComps = components.filter(c => !rowCompIds.has(c.id));

  // Per-basis totals for the collapsed summary line
  const totals = components.reduce<Record<string, number>>((acc, c) => {
    const t = componentTotal(job, c.id);
    acc[c.basis] = (acc[c.basis] ?? 0) + t;
    return acc;
  }, {});
  const summary = Object.entries(totals)
    .map(([basis, t]) => `${t.toFixed(1)} ${PARENT_BASIS_UNIT[basis as ParentBasis]}`)
    .join(' - ');

  /** Row add: get-or-create the row's component, then append the entry. */
  function addRowEntry(row: BucketRow, entry: Omit<ParentEntry, 'id' | 'componentId'>) {
    let comps = job.components.filter(c => c.parentId === bucket.id);
    let comp = comps.find(c => c.name === row.name && c.basis === row.basis);
    const nextComps = comp ? job.components : [...job.components, { id: makeId('comp'), parentId: bucket.id, name: row.name, basis: row.basis } satisfies ParentComponent];
    comp = comp ?? nextComps[nextComps.length - 1];
    const entries = job.entries.filter(e => e.componentId === comp!.id);
    const label = entry.label.trim() || defaultEntryLabel(trade, row.basis, entries.length + 1);
    setJob({ ...job, components: nextComps, entries: [...job.entries, { ...entry, label, id: makeId('pe'), componentId: comp!.id }] });
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
            {components.length} row{components.length === 1 ? '' : 's'} filled
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

          {rowComps.map(({ row, comps }) => (
            <RowCard
              key={row.name}
              trade={trade}
              row={row}
              comps={comps}
              job={job}
              setJob={setJob}
              onRemoveComponent={() => comps.forEach(c => removeComponent(c.id))}
              onAddEntry={(entry) => addRowEntry(row, entry)}
            />
          ))}

          {/* Canvas-created or otherwise non-row components */}
          {customComps.map(c => (
            <CustomComponentCard key={c.id} trade={trade} comp={c} job={job} setJob={setJob}
              onRemove={() => removeComponent(c.id)} />
          ))}

          {/* Escape hatch: a row the config doesn't cover */}
          <div>
            <button onClick={() => setCustomOpen(v => !v)} className="text-xs text-slate-400 hover:text-slate-600 transition font-medium">
              {customOpen ? 'Close' : '+ Add something not listed'}
            </button>
            {customOpen && (
              <AddComponentForm trade={trade}
                placeholderName={trade.key === 'cladding' ? 'e.g. Soffit liner, Custom trim' : 'e.g. Feature strip'}
                onAdd={(name, basis, entry) => {
                  const comp: ParentComponent = { id: makeId('comp'), parentId: bucket.id, name: name.trim() || `${bucket.name} ${components.length + 1}`, basis };
                  const label = entry.label.trim() || defaultEntryLabel(trade, basis, 1);
                  setJob({ ...job, components: [...job.components, comp], entries: [...job.entries, { ...entry, label, id: makeId('pe'), componentId: comp.id }] });
                }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One pre-seeded row: name + entries + quick inline add. Empty rows are
 *  dimmed; filling one activates it. */
function RowCard({
  trade, row, comps, job, setJob, onRemoveComponent, onAddEntry,
}: {
  trade: TradeConfig;
  row: BucketRow;
  comps: ParentComponent[];
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  onRemoveComponent: () => void;
  onAddEntry: (entry: Omit<ParentEntry, 'id' | 'componentId'>) => void;
}) {
  const unit = PARENT_BASIS_UNIT[row.basis];
  const entries = comps.flatMap(c => job.entries.filter(e => e.componentId === c.id));
  const total = comps.reduce((s, c) => s + componentTotal(job, c.id), 0);
  const filled = entries.length > 0;
  const [adding, setAdding] = useState(false);

  return (
    <div className={`rounded-xl border transition ${filled ? 'border-slate-200 bg-slate-50/50' : 'border-dashed border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className={`text-sm font-medium ${filled ? 'text-slate-800' : 'text-slate-400'}`}>{row.name}</span>
          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {filled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {unit}</span>}
          <button onClick={() => setAdding(v => !v)} className="text-xs text-blue-600 hover:text-blue-700 transition font-medium">
            {adding ? 'Close' : '+ Add'}
          </button>
          {filled && <button onClick={onRemoveComponent} className="text-xs text-slate-400 hover:text-red-500 transition">Clear</button>}
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
          <QuickEntryForm trade={trade} basis={row.basis} onDone={() => setAdding(false)} onAdd={onAddEntry} />
        )}
        {!filled && !adding && (
          <p className="py-1 text-xs text-slate-300">Leave empty if not needed</p>
        )}
      </div>
    </div>
  );
}

/** Compact entry form for one row: value (+ LxH toggle, qty, angle). No name
 *  field - defaults like "Wall 1" / "Length 1" are applied automatically. */
function QuickEntryForm({ trade, basis, onAdd, onDone }: {
  trade: TradeConfig;
  basis: ParentBasis;
  onAdd: (entry: Omit<ParentEntry, 'id' | 'componentId'>) => void;
  onDone: () => void;
}) {
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [qty, setQty] = useState('1');
  const [angle, setAngle] = useState('');
  const [mode, setMode] = useState<'area' | 'lxh'>(trade.allowHeight && basis === 'area' ? 'lxh' : 'area');

  const useLxh = basis === 'area' && trade.allowHeight && mode === 'lxh';
  const a = parseFloat(val1) || 0;
  const b = parseFloat(val2) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const ang = trade.allowAngle && basis === 'area' ? (parseFloat(angle) || 0) : 0;
  const value = basis === 'point' ? Math.max(1, Math.round(a)) : useLxh ? a * b : a;
  const canAdd = value > 0;

  function add(andContinue: boolean) {
    if (!canAdd) return;
    const entry: Omit<ParentEntry, 'id' | 'componentId'> = {
      label: '',
      value: Math.round(value * 1000) / 1000,
      quantity: basis === 'point' ? 1 : q,
      length: useLxh ? a : null,
      height: useLxh ? b : null,
      angleDegrees: ang > 0 ? ang : null,
    };
    onAdd(entry);
    if (andContinue) {
      setVal1(''); setVal2(''); setQty('1'); setAngle('');
    } else {
      onDone();
    }
  }

  const unit1 = basis === 'area' ? (useLxh ? 'Length (m)' : 'Area (m²)') : basis === 'lineal' ? 'Length (m)' : 'Count';

  return (
    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-3 space-y-2">
      {basis === 'area' && trade.allowHeight && (
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5 w-fit">
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
        <div>
          <label className="text-xs font-medium text-slate-600">{unit1}</label>
          <input type="number" min="0" step={basis === 'point' ? '1' : '0.01'} value={val1} onChange={e => setVal1(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(false); } }} className={inputCls} />
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
        ) : basis !== 'point' ? (
          <div>
            <label className="text-xs font-medium text-slate-600">Qty</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          </div>
        ) : null}
        {basis === 'area' && trade.allowAngle && (
          <div>
            <label className="text-xs font-medium text-slate-600">{trade.angleLabel} ° (opt.)</label>
            <input type="number" min="0" max="89" step="0.5" value={angle} onChange={e => setAngle(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {canAdd ? `${(value * (basis === 'point' ? 1 : q)).toFixed(1)} ${PARENT_BASIS_UNIT[basis]} total` : 'Enter the measurement to add'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => add(true)} disabled={!canAdd}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
            Add + another
          </button>
          <button onClick={() => add(false)} disabled={!canAdd}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fallback card for components that came from the canvas or older data and
 *  don't match a configured row. Same controls as a row. */
function CustomComponentCard({
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

  function addEntry(entry: Omit<ParentEntry, 'id' | 'componentId'>) {
    const label = entry.label.trim() || defaultEntryLabel(trade, comp.basis, entries.length + 1);
    setJob({ ...job, entries: [...job.entries, { ...entry, label, id: makeId('pe'), componentId: comp.id }] });
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
          <QuickEntryForm trade={trade} basis={comp.basis} onDone={() => setAdding(false)} onAdd={addEntry} />
        )}
      </div>
    </div>
  );
}

/** Escape hatch form: create a row the config doesn't list. Name optional,
 *  measurement required. */
function AddComponentForm({ trade, placeholderName, onAdd }: {
  trade: TradeConfig;
  placeholderName: string;
  onAdd: (name: string, basis: ParentBasis, entry: Omit<ParentEntry, 'id' | 'componentId'>) => void;
}) {
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<ParentBasis>('lineal');
  const [val1, setVal1] = useState('');
  const [qty, setQty] = useState('1');

  const a = parseFloat(val1) || 0;
  const q = Math.max(1, parseInt(qty) || 1);
  const value = basis === 'point' ? Math.max(1, Math.round(a)) : a;
  const canAdd = value > 0;

  function add(andContinue: boolean) {
    if (!canAdd) return;
    onAdd(name, basis, { label: '', value: Math.round(value * 1000) / 1000, quantity: basis === 'point' ? 1 : q, length: null, height: null, angleDegrees: null });
    if (andContinue) { setName(''); setVal1(''); setQty('1'); }
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600">{basis === 'area' ? 'Area (m²)' : basis === 'lineal' ? 'Length (m)' : 'Count'}</label>
          <input type="number" min="0" step={basis === 'point' ? '1' : '0.01'} value={val1} onChange={e => setVal1(e.target.value)} className={inputCls} />
        </div>
        {basis !== 'point' && (
          <div>
            <label className="text-xs font-medium text-slate-600">Qty</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {canAdd ? `${(value * (basis === 'point' ? 1 : q)).toFixed(1)} ${PARENT_BASIS_UNIT[basis]} total` : 'Enter the measurement to add'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => add(true)} disabled={!canAdd}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition disabled:opacity-40">
            Add + another
          </button>
          <button onClick={() => add(false)} disabled={!canAdd}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
