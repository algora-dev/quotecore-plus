// Product assignment step: one step per populated measurement group.
// Standard mode: products applied to the WHOLE group, multiple allowed.

'use client';

import { useMemo, useState } from 'react';
import type { GroupDef, MeasurementSet, SupplierProduct } from './types';
import { groupTotal } from './types';

const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none';

export function ProductStep({
  def,
  measureSet,
  catalog,
  setMeasureSet,
  onBack,
  onNext,
  stepNum,
  totalSteps,
}: {
  def: GroupDef;
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
  setMeasureSet: (s: MeasurementSet) => void;
  onBack: () => void;
  onNext: () => void;
  stepNum: number;
  totalSteps: number;
}) {
  const group = measureSet.groups[def.key];
  const [search, setSearch] = useState('');

  const valid = useMemo(
    () => catalog.filter(p => p.groups.includes(def.key)),
    [catalog, def.key],
  );
  const filtered = valid.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });
  const suggested = filtered.filter(p => p.suggested);
  const others = filtered.filter(p => !p.suggested);

  const total = groupTotal(measureSet, def.key);
  const applied = group.productIds.map(pid => catalog.find(p => p.id === pid)!).filter(Boolean);

  function toggle(pid: string) {
    const has = group.productIds.includes(pid);
    const product = catalog.find(p => p.id === pid);
    const next = {
      ...measureSet,
      groups: {
        ...measureSet.groups,
        [def.key]: {
          ...group,
          productIds: has ? group.productIds.filter(x => x !== pid) : [...group.productIds, pid],
        },
      },
      applied: has
        ? measureSet.applied
        : { ...measureSet.applied, [pid]: { wastePct: product?.defaultWastePct ?? 0 } },
    };
    setMeasureSet(next);
  }

  function setWaste(pid: string, wastePct: number) {
    setMeasureSet({
      ...measureSet,
      applied: { ...measureSet.applied, [pid]: { wastePct } },
    });
  }

  return (
    <div className="space-y-4">
      {/* Group summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{def.label}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} - measured total{' '}
              <span className="font-semibold text-slate-900">{total.toFixed(1)} {def.unit}</span>
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            {stepNum} of {totalSteps}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {group.entries.map(e => (
            <span key={e.id} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
              {e.label}: {e.value.toFixed(1)} {def.unit}
            </span>
          ))}
        </div>
      </div>

      {/* Applied products */}
      {applied.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Products applied to this group</h3>
          {applied.map(p => {
            const wastePct = measureSet.applied[p.id]?.wastePct ?? p.defaultWastePct;
            const purchaseQty = total * (1 + wastePct / 100);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2.5 transition">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.code} - ${p.unitPrice.toFixed(2)}/{def.unit}</div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                  Waste %
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={wastePct}
                    onChange={e => setWaste(p.id, parseFloat(e.target.value) || 0)}
                    className={`${inputCls} w-16 text-center`}
                    aria-label={`Waste percent for ${p.name}`}
                  />
                </label>
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap flex-shrink-0">
                  {purchaseQty.toFixed(1)} {def.unit}
                  <span className="ml-2 text-[#BD4A1A]">${(purchaseQty * p.unitPrice).toFixed(2)}</span>
                </span>
                <button onClick={() => toggle(p.id)} className="text-slate-300 hover:text-red-500 transition p-1 flex-shrink-0" aria-label={`Remove ${p.name}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalog picker */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Add products for {def.label.toLowerCase()}</h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or code..."
            className={`${inputCls} w-48`}
          />
        </div>

        {suggested.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Suggested</p>
            <div className="mt-1.5 space-y-1.5">
              {suggested.map(p => <ProductRow key={p.id} p={p} def={def} applied={group.productIds.includes(p.id)} onToggle={() => toggle(p.id)} />)}
            </div>
          </>
        )}
        {others.length > 0 && (
          <>
            <p className="mt-4 text-xs font-medium text-slate-400 uppercase tracking-wide">All products</p>
            <div className="mt-1.5 space-y-1.5">
              {others.map(p => <ProductRow key={p.id} p={p} def={def} applied={group.productIds.includes(p.id)} onToggle={() => toggle(p.id)} />)}
            </div>
          </>
        )}
        {filtered.length === 0 && (
          <p className="mt-3 text-sm text-slate-400 text-center py-4">No products match "{search}".</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={group.productIds.length === 0}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
        >
          {stepNum === totalSteps ? 'Generate output' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function ProductRow({ p, def, applied, onToggle }: { p: SupplierProduct; def: GroupDef; applied: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${applied ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
        <div className="text-xs text-slate-400">
          {p.code} - ${p.unitPrice.toFixed(2)}/{def.unit}
          {p.defaultWastePct > 0 && <span> - {p.defaultWastePct}% waste</span>}
        </div>
      </div>
      <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition ${applied ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-500'}`}>
        {applied ? 'Added' : 'Add'}
      </span>
    </button>
  );
}
