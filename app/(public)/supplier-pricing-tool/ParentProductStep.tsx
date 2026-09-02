// Step 3 (parent model): apply one product per parent area group.
// Standard = pick a product (defaults apply); Advanced = waste, labour,
// qty override and price override (when the supplier allows price edits).

'use client';

import { useState } from 'react';
import type { ParentJob, ParentApplied, SupplierProduct } from './types';
import { makeId, parentTotal } from './types';
import type { TradeConfig } from './tradeConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function ParentProductStep({
  trade, job, setJob, catalog, mode, currency, onBack, onNext,
}: {
  trade: TradeConfig;
  job: ParentJob;
  setJob: (j: ParentJob) => void;
  catalog: SupplierProduct[];
  mode: 'standard' | 'advanced';
  currency: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const areaProducts = catalog.filter(p => p.basis === 'area');
  const allAssigned = job.parents.length > 0
    && job.parents.every(p => job.applied.some(a => a.parentId === p.id && areaProducts.some(x => x.id === a.productId)));

  function getApplied(parentId: string): ParentApplied | undefined {
    return job.applied.find(a => a.parentId === parentId);
  }

  function assign(parentId: string, productId: string) {
    const p = areaProducts.find(x => x.id === productId);
    if (!p) return;
    setJob({
      ...job,
      applied: [
        ...job.applied.filter(a => a.parentId !== parentId),
        {
          id: getApplied(parentId)?.id ?? makeId('pa'),
          parentId,
          productId,
          wastePct: p.defaultWastePct,
          labourRate: p.defaultLabourRate,
          qtyOverride: null,
          priceOverride: null,
        },
      ],
    });
  }

  function patchApplied(parentId: string, patch: Partial<ParentApplied>) {
    setJob({
      ...job,
      applied: job.applied.map(a => a.parentId === parentId ? { ...a, ...patch } : a),
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Products</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick the product for each {trade.areaNoun} area group. The group&apos;s total m\u00B2 drives the quantity.
        </p>
      </div>

      {job.parents.map(parent => {
        const total = parentTotal(job, parent.id);
        const ap = getApplied(parent.id);
        const product = areaProducts.find(p => p.id === ap?.productId);
        const entries = job.entries.filter(e => e.parentId === parent.id);

        return (
          <div key={parent.id} className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <div>
                <span className="text-sm font-semibold text-slate-900">{parent.name}</span>
                <p className="text-xs text-slate-400">
                  {entries.length} area{entries.length === 1 ? '' : 's'}{entries.length > 0 ? ` - ${entries.map(e => e.label).slice(0, 3).join(', ')}${entries.length > 3 ? '...' : ''}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} m\u00B2</span>
            </div>

            <div className="grid gap-2 p-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Product</label>
                <select
                  value={ap?.productId ?? ''}
                  onChange={e => assign(parent.id, e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>Choose a product...</option>
                  {areaProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({currency}{p.unitPrice.toFixed(2)}/m\u00B2){p.suggested ? ' - recommended' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'advanced' && ap && product && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Waste %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={ap.wastePct}
                      onChange={e => patchApplied(parent.id, { wastePct: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Labour {currency}/m\u00B2</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={ap.labourRate}
                      onChange={e => patchApplied(parent.id, { labourRate: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Qty override (m\u00B2)</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={ap.qtyOverride ?? ''}
                      onChange={e => patchApplied(parent.id, { qtyOverride: e.target.value.trim() === '' ? null : parseFloat(e.target.value) })}
                      placeholder={`measured ${total.toFixed(1)}`}
                      className={inputCls}
                    />
                  </div>
                  {product.priceEditable && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">Price override {currency}/m\u00B2</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={ap.priceOverride ?? ''}
                        onChange={e => patchApplied(parent.id, { priceOverride: e.target.value.trim() === '' ? null : parseFloat(e.target.value) })}
                        placeholder={`list ${product.unitPrice.toFixed(2)}`}
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}

              {mode === 'standard' && ap && product && (
                <div className="self-end text-xs text-slate-500">
                  {ap.wastePct > 0 && `${ap.wastePct}% waste incl. `}
                  {ap.labourRate > 0 ? `${currency}${ap.labourRate.toFixed(2)}/m\u00B2 labour` : 'materials only'}
                </div>
              )}
            </div>
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
