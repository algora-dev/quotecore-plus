// Step 3 (parent model v2): apply products to COMPONENTS. Everything is
// MINIMISED by default (accordion buckets); expanding a bucket shows one
// compact row per component; the product dropdown list is a second click
// away and only one dropdown is open at a time. Products are optional -
// the user can continue with none (measurements carry through).

'use client';

import { useState } from 'react';
import type { ParentJob, ComponentApplied, SupplierProduct, ParentBasis } from './types';
import { makeId, componentTotal, PARENT_BASIS_UNIT } from './types';
import type { TradeConfig } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_PRODUCT_BASIS: Record<ParentBasis, 'area' | 'lineal' | 'count'> = {
  area: 'area',
  lineal: 'lineal',
  point: 'count',
};

const BASIS_LABEL: Record<ParentBasis, string> = { area: 'Area', lineal: 'Length', point: 'Item' };

export function ParentProductStep({
  job, setJob, catalog, mode, currency, trade, onBack, onNext,
}: {
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  catalog: SupplierProduct[];
  mode: 'standard' | 'advanced';
  currency: string;
  trade: TradeConfig;
  onBack: () => void;
  onNext: () => void;
}) {
  // Accordion: one open bucket at a time; one open product dropdown at a time.
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Products</h2>
        <p className="mt-1 text-sm text-slate-500">
          Expand a {trade.areaNoun} system, then use Add products on each component to stack products ({trade.key === 'flooring' ? 'flooring + underlay + levelling on the same m\u00B2' : 'cladding + battens + wrap on the same m\u00B2'}). Optional - continue with none and your measurements still carry through.
        </p>
      </div>

      {job.parents.map(bucket => {
        const components = job.components.filter(c => c.parentId === bucket.id);
        if (components.length === 0) return null;
        const productCount = job.applied.filter(a => components.some(c => c.id === a.componentId)).length;
        const open = openBucket === bucket.id;
        return (
          <div key={bucket.id} className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition">
            <button
              onClick={() => setOpenBucket(open ? null : bucket.id)}
              className="w-full flex items-center justify-between gap-2 p-4 text-left cursor-pointer"
            >
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-900">{bucket.name}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {components.length} component{components.length === 1 ? '' : 's'}
                  {productCount > 0 ? ` - ${productCount} product${productCount === 1 ? '' : 's'}` : ' - no products yet'}
                </span>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="border-t border-slate-100 p-3 space-y-2">
                {components.map(comp => (
                  <ComponentRow
                    key={comp.id}
                    comp={comp}
                    job={job}
                    setJob={setJob}
                    catalog={catalog}
                    mode={mode}
                    currency={currency}
                    pickerOpen={openPicker === comp.id}
                    onTogglePicker={() => setOpenPicker(openPicker === comp.id ? null : comp.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]"
        >
          Next: Custom components
        </button>
      </div>
    </div>
  );
}

function ComponentRow({
  comp, job, setJob, catalog, mode, currency, pickerOpen, onTogglePicker,
}: {
  comp: ParentJob['components'][number];
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  catalog: SupplierProduct[];
  mode: 'standard' | 'advanced';
  currency: string;
  pickerOpen: boolean;
  onTogglePicker: () => void;
}) {
  const products = catalog.filter(p => p.basis === BASIS_PRODUCT_BASIS[comp.basis]);
  const applied = job.applied.filter(a => a.componentId === comp.id);
  const total = componentTotal(job, comp.id);
  const unit = PARENT_BASIS_UNIT[comp.basis];

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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-800">{comp.name}</span>
          <span className="ml-2 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{BASIS_LABEL[comp.basis]}</span>
          <span className="ml-2 text-xs text-slate-400">{total.toFixed(1)} {unit} measured</span>
        </div>
        <button onClick={onTogglePicker}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${pickerOpen ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:border-slate-400'}`}>
          {pickerOpen ? 'Close list' : applied.length > 0 ? `+ Add more (${applied.length})` : '+ Add products'}
        </button>
      </div>

      {/* Applied products - compact rows, always removable */}
      {applied.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          {applied.map(ap => {
            const product = products.find(p => p.id === ap.productId);
            if (!product) return null;
            const advancedOpen = mode === 'advanced';
            return (
              <div key={ap.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800">{product.name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {currency}{product.unitPrice.toFixed(2)}/{unit}
                      {ap.wastePct > 0 && ` - ${ap.wastePct}% waste`}
                      {ap.labourRate > 0 ? ` - ${currency}${ap.labourRate.toFixed(2)}/${unit} labour` : ''}
                    </span>
                  </div>
                  <button onClick={() => removeApplied(ap.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-500 transition">
                    Remove
                  </button>
                </div>
                {advancedOpen && (
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

      {/* Product dropdown list - only on explicit click, one at a time */}
      {pickerOpen && (
        <div className="relative px-3 py-2">
          <button aria-label="Close product list" tabIndex={-1} onClick={onTogglePicker}
            className="fixed inset-0 z-10 cursor-default" />
          <div className="relative z-20 rounded-xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
            {products.map(p => {
              const already = applied.some(a => a.productId === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-blue-50/40 transition">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {p.name}
                      {p.suggested && <span className="ml-2 text-xs text-slate-400">recommended</span>}
                    </div>
                    <div className="text-xs text-slate-400">{currency}{p.unitPrice.toFixed(2)}/{unit}{p.code ? ` - ${p.code}` : ''}</div>
                  </div>
                  <button onClick={() => addApplied(p.id)} disabled={already}
                    className={`flex-shrink-0 rounded-full px-4 py-1 text-xs font-semibold transition ${already ? 'bg-blue-50 text-blue-700 cursor-default' : 'bg-black text-white hover:bg-slate-800'}`}>
                    {already ? 'Added' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
