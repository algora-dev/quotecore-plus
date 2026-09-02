// Step 3 (parent model v2): apply products to COMPONENTS. Roofing-style
// quick-add - click products in the picker to stack them onto the component
// (click, click, click), every applied product has a Remove. Advanced mode
// adds waste / labour / qty / price override editing per applied product.
// Catalog is filtered by the component's basis.

'use client';

import { useState } from 'react';
import type { ParentJob, ComponentApplied, SupplierProduct, ParentBasis } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_PRODUCT_BASIS: Record<ParentBasis, 'area' | 'lineal' | 'count'> = {
  area: 'area',
  lineal: 'lineal',
  point: 'count',
};

export function ParentProductStep({
  job, setJob, catalog, mode, currency, onBack, onNext,
}: {
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  catalog: SupplierProduct[];
  mode: 'standard' | 'advanced';
  currency: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const allAssigned = job.components.length > 0
    && job.components.every(c => job.applied.some(a => a.componentId === c.id));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Products</h2>
        <p className="mt-1 text-sm text-slate-500">
          Click products to add them to each component - stack as many as needed (cladding + battens + wrap on the same m\u00B2). Remove any you don&apos;t want.
        </p>
      </div>

      {job.parents.map(bucket => {
        const components = job.components.filter(c => c.parentId === bucket.id);
        if (components.length === 0) return null;
        return (
          <div key={bucket.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{bucket.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">bucket</span>
            </div>
            {components.map(comp => (
              <ComponentProductCard
                key={comp.id}
                comp={comp}
                job={job}
                setJob={setJob}
                catalog={catalog}
                mode={mode}
                currency={currency}
              />
            ))}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!allAssigned}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          Next: Custom components
        </button>
      </div>
    </div>
  );
}

function ComponentProductCard({
  comp, job, setJob, catalog, mode, currency,
}: {
  comp: ParentJob['components'][number];
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  catalog: SupplierProduct[];
  mode: 'standard' | 'advanced';
  currency: string;
}) {
  const products = catalog.filter(p => p.basis === BASIS_PRODUCT_BASIS[comp.basis]);
  const applied = job.applied.filter(a => a.componentId === comp.id);
  const total = componentTotal(job, comp.id);
  const unit = PARENT_BASIS_UNIT[comp.basis];
  const entries = job.entries.filter(e => e.componentId === comp.id);
  const [pickerOpen, setPickerOpen] = useState(applied.length === 0);

  function addApplied(productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    if (applied.some(a => a.productId === productId)) return; // no duplicates
    const ap: ComponentApplied = {
      id: makeId('ap'),
      componentId: comp.id,
      productId,
      wastePct: p.defaultWastePct,
      labourRate: p.defaultLabourRate,
      qtyOverride: null,
      priceOverride: null,
    };
    setJob({ ...job, applied: [...job.applied, ap] });
  }

  function patchApplied(id: string, patch: Partial<ComponentApplied>) {
    setJob({ ...job, applied: job.applied.map(a => a.id === id ? { ...a, ...patch } : a) });
  }

  function removeApplied(id: string) {
    setJob({ ...job, applied: job.applied.filter(a => a.id !== id) });
  }

  const unassigned = applied.length === 0;

  return (
    <div className={`rounded-xl border bg-white transition ${unassigned ? 'border-amber-200' : 'border-slate-200 hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <div>
          <span className="text-sm font-semibold text-slate-900">{comp.name}</span>
          <p className="text-xs text-slate-400">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} - {total.toFixed(1)} {unit} measured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {unit}</span>
          <button onClick={() => setPickerOpen(v => !v)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 transition">
            {pickerOpen ? 'Close products' : '+ Add products'}
          </button>
        </div>
      </div>

      {/* Applied products - always removable */}
      {applied.length > 0 && (
        <div className="space-y-2 p-4 pb-0">
          {applied.map(ap => {
            const product = products.find(p => p.id === ap.productId);
            if (!product) return null;
            return (
              <div key={ap.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800">{product.name}</span>
                    <div className="text-xs text-slate-400">
                      {currency}{product.unitPrice.toFixed(2)}/{unit}
                      {ap.wastePct > 0 && ` - ${ap.wastePct}% waste`}
                      {ap.labourRate > 0 ? ` - ${currency}${ap.labourRate.toFixed(2)}/${unit} labour` : ''}
                    </div>
                  </div>
                  <button onClick={() => removeApplied(ap.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-500 transition">
                    Remove
                  </button>
                </div>

                {mode === 'advanced' && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Waste %</label>
                      <input type="number" min="0" max="100" step="0.5" value={ap.wastePct}
                        onChange={e => patchApplied(ap.id, { wastePct: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Labour {currency}/{unit}</label>
                      <input type="number" min="0" step="0.5" value={ap.labourRate}
                        onChange={e => patchApplied(ap.id, { labourRate: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Qty override ({unit})</label>
                      <input type="number" min="0" step="0.1" value={ap.qtyOverride ?? ''}
                        onChange={e => patchApplied(ap.id, { qtyOverride: e.target.value.trim() === '' ? null : parseFloat(e.target.value) })}
                        placeholder={`measured ${total.toFixed(1)}`} className={inputCls} />
                    </div>
                    {product.priceEditable && (
                      <div>
                        <label className="text-xs font-medium text-slate-600">Price override {currency}/{unit}</label>
                        <input type="number" min="0" step="0.01" value={ap.priceOverride ?? ''}
                          onChange={e => patchApplied(ap.id, { priceOverride: e.target.value.trim() === '' ? null : parseFloat(e.target.value) })}
                          placeholder={`list ${product.unitPrice.toFixed(2)}`} className={inputCls} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick-add picker: click to stack products (roofing-style) */}
      {pickerOpen && (
        <div className="p-4">
          {unassigned && <p className="mb-2 text-xs font-medium text-amber-600">Pick at least one product for this component</p>}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {products.map(p => {
              const already = applied.some(a => a.productId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addApplied(p.id)}
                  disabled={already}
                  className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition cursor-pointer ${
                    already
                      ? 'border-blue-200 bg-blue-50/40 text-blue-700 cursor-default'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{currency}{p.unitPrice.toFixed(2)}/{unit}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    {already ? <span className="text-blue-600 font-medium">Added</span> : p.suggested ? <span className="text-slate-500">recommended</span> : null}
                    {p.code && <span>{p.code}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
