// Step 3 (parent model v2): apply products to COMPONENTS. A component can
// take multiple layered products (cedar timber + battens + building wrap on
// the same measured m2). Catalog is filtered by the component's basis.
// Standard = one product with defaults; Advanced = add layers + edit waste,
// labour, qty and price overrides.

'use client';

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
          Pick the product for each measured component. Advanced mode lets you stack multiple products on one component (e.g. cladding + battens + building wrap on the same m\u00B2).
        </p>
      </div>

      {job.parents.map(bucket => {
        const components = job.components.filter(c => c.parentId === bucket.id);
        if (components.length === 0) return null;
        return (
          <div key={bucket.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{bucket.name}</span>
              <span className="text-xs text-slate-400">bucket</span>
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

  function addApplied(productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
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
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {unit}</span>
      </div>

      <div className="space-y-3 p-4">
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
                    {applied.length > 1 && mode === 'advanced' && (
                      <button onClick={() => removeApplied(ap.id)} className="ml-3 text-slate-400 hover:text-slate-600 transition">Remove layer</button>
                    )}
                  </div>
                </div>
                {mode === 'standard' && (
                  <span className="text-xs text-slate-500">
                    {ap.wastePct > 0 && `${ap.wastePct}% waste incl. `}
                    {ap.labourRate > 0 ? `${currency}${ap.labourRate.toFixed(2)}/${unit} labour` : 'materials only'}
                  </span>
                )}
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

        {/* Product picker / add layer */}
        <div className="grid gap-2 sm:grid-cols-2 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600">
              {applied.length === 0 ? 'Product' : applied.length === 1 && mode === 'advanced' ? 'Add another product (layer)' : 'Product'}
            </label>
            <select
              value=""
              onChange={e => { if (e.target.value) addApplied(e.target.value); }}
              className={inputCls}
            >
              <option value="">{applied.length === 0 ? 'Choose a product...' : mode === 'advanced' ? 'Add a product layer (optional)...' : 'Change product...'}</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({currency}{p.unitPrice.toFixed(2)}/{unit}){p.suggested ? ' - recommended' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
