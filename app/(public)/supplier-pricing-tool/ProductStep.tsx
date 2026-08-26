// Product assignment step: one step per populated measurement group.
// Standard: products applied to the WHOLE group. Advanced (persistent toggle):
// per-entry assignment + product editor (labour, waste, qty override,
// price override when the supplier allows it).

'use client';

import { useMemo, useState } from 'react';
import type { AppliedProduct, GroupDef, MeasurementSet, Mode, SupplierProduct } from './types';
import { GROUP_DEFS, groupTotal, makeId } from './types';

const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none';

export function ProductStep({
  def,
  measureSet,
  catalog,
  setMeasureSet,
  mode,
  onBack,
  onNext,
  stepNum,
  totalSteps,
}: {
  def: GroupDef;
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
  setMeasureSet: (s: MeasurementSet) => void;
  mode: Mode;
  onBack: () => void;
  onNext: () => void;
  stepNum: number;
  totalSteps: number;
}) {
  const group = measureSet.groups[def.key];
  const [search, setSearch] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null); // null = group, entryId = per-entry
  const [editing, setEditing] = useState<AppliedProduct | null>(null);

  const valid = useMemo(
    () => catalog.filter(p => p.groups.includes(def.key)),
    [catalog, def.key],
  );
  const filtered = valid.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  const total = groupTotal(measureSet, def.key);
  const groupApplied = measureSet.appliedProducts.filter(ap => ap.groupKey === def.key && ap.entryId == null);

  function applyProduct(pid: string, entryId: string | null) {
    const p = catalog.find(x => x.id === pid)!;
    const ap: AppliedProduct = {
      id: makeId('ap'),
      groupKey: def.key,
      productId: pid,
      entryId,
      wastePct: p.defaultWastePct,
      labourRate: p.defaultLabourRate,
      qtyOverride: null,
      priceOverride: null,
    };
    setMeasureSet({ ...measureSet, appliedProducts: [...measureSet.appliedProducts, ap] });
    setPickerFor(null);
    setSearch('');
  }

  function removeApplied(apId: string) {
    setMeasureSet({ ...measureSet, appliedProducts: measureSet.appliedProducts.filter(a => a.id !== apId) });
  }

  function updateApplied(apId: string, patch: Partial<AppliedProduct>) {
    setMeasureSet({
      ...measureSet,
      appliedProducts: measureSet.appliedProducts.map(a => a.id === apId ? { ...a, ...patch } : a),
    });
  }

  const hasAnyApplied = measureSet.appliedProducts.some(ap => ap.groupKey === def.key);

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

      {/* Standard: group-level applications */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Products for this group</h3>
          <button
            onClick={() => setPickerFor(pickerFor === '__group__' ? null : '__group__')}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
          >
            {pickerFor === '__group__' ? 'Close' : '+ Add product'}
          </button>
        </div>

        {groupApplied.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3">
            No products applied to this group yet. Add one or more.
          </p>
        )}

        {groupApplied.map(ap => {
          const p = catalog.find(x => x.id === ap.productId)!;
          if (!p) return null;
          return (
            <AppliedRow
              key={ap.id}
              ap={ap}
              p={p}
              def={def}
              measured={total}
              advanced={mode === 'advanced'}
              onEdit={() => setEditing(ap)}
              onRemove={() => removeApplied(ap.id)}
              onUpdate={patch => updateApplied(ap.id, patch)}
            />
          );
        })}

        {pickerFor === '__group__' && (
          <ProductPicker
            products={filtered}
            def={def}
            search={search}
            setSearch={setSearch}
            onPick={pid => applyProduct(pid, null)}
          />
        )}
      </div>

      {/* Advanced: per-entry assignment */}
      {mode === 'advanced' && group.entries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Per-entry assignment (Advanced)</h3>
          <p className="text-xs text-slate-500 -mt-1">
            Apply products to individual entries - e.g. a different ridge product on a specific ridge.
            Group-level products above still apply to the whole group.
          </p>
          {group.entries.map(entry => {
            const entryApplied = measureSet.appliedProducts.filter(
              ap => ap.groupKey === def.key && ap.entryId === entry.id,
            );
            return (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {entry.label} <span className="font-normal text-slate-400">- {entry.value.toFixed(1)} {def.unit}</span>
                  </span>
                  <button
                    onClick={() => setPickerFor(pickerFor === entry.id ? null : entry.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 transition cursor-pointer"
                  >
                    {pickerFor === entry.id ? 'Close' : '+ Product'}
                  </button>
                </div>
                {entryApplied.map(ap => {
                  const p = catalog.find(x => x.id === ap.productId)!;
                  if (!p) return null;
                  return (
                    <AppliedRow
                      key={ap.id}
                      ap={ap}
                      p={p}
                      def={def}
                      measured={entry.value}
                      advanced={mode === 'advanced'}
                      onEdit={() => setEditing(ap)}
                      onRemove={() => removeApplied(ap.id)}
                      onUpdate={patch => updateApplied(ap.id, patch)}
                    />
                  );
                })}
                {pickerFor === entry.id && (
                  <ProductPicker
                    products={filtered}
                    def={def}
                    search={search}
                    setSearch={setSearch}
                    onPick={pid => applyProduct(pid, entry.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!hasAnyApplied}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
        >
          {stepNum === totalSteps ? 'Generate output' : 'Next'}
        </button>
      </div>

      {editing && (
        <ProductEditorModal
          ap={editing}
          p={catalog.find(x => x.id === editing.productId)!}
          def={def}
          onClose={() => setEditing(null)}
          onSave={patch => { updateApplied(editing.id, patch); setEditing(null); }}
        />
      )}
    </div>
  );
}

/** One applied product row: name, qty, waste, live totals, edit/remove. */
function AppliedRow({ ap, p, def, measured, advanced, onEdit, onRemove, onUpdate }: {
  ap: AppliedProduct;
  p: SupplierProduct;
  def: GroupDef;
  measured: number;
  advanced: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<AppliedProduct>) => void;
}) {
  const calcQty = ap.qtyOverride != null ? ap.qtyOverride : measured;
  const purchaseQty = calcQty * (1 + (ap.wastePct || 0) / 100);
  const unitPrice = ap.priceOverride != null && p.priceEditable ? ap.priceOverride : p.unitPrice;
  const mat = purchaseQty * unitPrice;
  const lab = purchaseQty * (ap.labourRate || 0);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2.5 transition flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {p.name}
          {ap.qtyOverride != null && <span className="ml-2 text-xs font-normal text-[#BD4A1A]">qty overridden</span>}
        </div>
        <div className="text-xs text-slate-400">
          {p.code} - ${unitPrice.toFixed(2)}/{def.unit}
          {ap.labourRate > 0 && <span> - labour ${ap.labourRate.toFixed(2)}/{def.unit}</span>}
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
        Waste %
        <input
          type="number" min="0" max="100" step="0.5"
          value={ap.wastePct}
          onChange={e => onUpdate({ wastePct: parseFloat(e.target.value) || 0 })}
          className={`${inputCls} w-16 text-center`}
          aria-label={`Waste percent for ${p.name}`}
        />
      </label>
      <span className="text-sm font-semibold text-slate-900 whitespace-nowrap flex-shrink-0">
        {purchaseQty.toFixed(1)} {def.unit}
        <span className="ml-2 text-[#BD4A1A]">${(mat + lab).toFixed(2)}</span>
      </span>
      {advanced && (
        <button onClick={onEdit} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 transition flex-shrink-0 cursor-pointer">
          Edit
        </button>
      )}
      <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition p-1 flex-shrink-0" aria-label={`Remove ${p.name}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/** Inline catalog picker: suggested first, then all, with search. */
function ProductPicker({ products, def, search, setSearch, onPick }: {
  products: SupplierProduct[];
  def: GroupDef;
  search: string;
  setSearch: (s: string) => void;
  onPick: (pid: string) => void;
}) {
  const suggested = products.filter(p => p.suggested);
  const others = products.filter(p => !p.suggested);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name or code..."
        className={`${inputCls} w-full`}
      />
      {suggested.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Suggested</p>
          {suggested.map(p => <PickerRow key={p.id} p={p} def={def} onPick={onPick} />)}
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">All products</p>
          {others.map(p => <PickerRow key={p.id} p={p} def={def} onPick={onPick} />)}
        </>
      )}
      {products.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-2">No products match "{search}".</p>
      )}
    </div>
  );
}

function PickerRow({ p, def, onPick }: { p: SupplierProduct; def: GroupDef; onPick: (pid: string) => void }) {
  return (
    <button
      onClick={() => onPick(p.id)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition cursor-pointer hover:border-orange-200 hover:bg-orange-50/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
        <div className="text-xs text-slate-400">
          {p.code} - ${p.unitPrice.toFixed(2)}/{def.unit}
          {p.defaultWastePct > 0 && <span> - {p.defaultWastePct}% waste</span>}
        </div>
      </div>
      <span className="flex-shrink-0 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500">Add</span>
    </button>
  );
}

/** Advanced product editor: labour rate, waste, qty override, price override
 *  (only when the supplier allows price edits on this product). */
function ProductEditorModal({ ap, p, def, onClose, onSave }: {
  ap: AppliedProduct;
  p: SupplierProduct;
  def: GroupDef;
  onClose: () => void;
  onSave: (patch: Partial<AppliedProduct>) => void;
}) {
  const [wastePct, setWastePct] = useState(String(ap.wastePct));
  const [labourRate, setLabourRate] = useState(String(ap.labourRate));
  const [qtyOverride, setQtyOverride] = useState(ap.qtyOverride != null ? String(ap.qtyOverride) : '');
  const [priceOverride, setPriceOverride] = useState(ap.priceOverride != null ? String(ap.priceOverride) : '');

  const qty = qtyOverride.trim() !== '' ? parseFloat(qtyOverride) || 0 : null;
  const price = p.priceEditable && priceOverride.trim() !== '' ? parseFloat(priceOverride) || 0 : null;
  const waste = parseFloat(wastePct) || 0;
  const labour = parseFloat(labourRate) || 0;

  const purchaseQty = (qty ?? 0) * (1 + waste / 100);
  const unitPrice = price != null ? price : p.unitPrice;
  const mat = purchaseQty * unitPrice;
  const lab = purchaseQty * labour;

  function save() {
    onSave({
      wastePct: waste,
      labourRate: labour,
      qtyOverride: qty,
      priceOverride: price,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{p.code} - applies per {def.unit}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Waste %</label>
              <input type="number" min="0" max="100" step="0.5" value={wastePct} onChange={e => setWastePct(e.target.value)} className={`${inputCls} mt-0.5 w-full`} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Labour rate ($/{def.unit})</label>
              <input type="number" min="0" step="0.1" value={labourRate} onChange={e => setLabourRate(e.target.value)} className={`${inputCls} mt-0.5 w-full`} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Quantity override ({def.unit})</label>
              <input type="number" min="0" step="any" value={qtyOverride} onChange={e => setQtyOverride(e.target.value)} placeholder="measured" className={`${inputCls} mt-0.5 w-full`} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Price override ($/{def.unit})</label>
              <input
                type="number" min="0" step="0.01" value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
                placeholder={p.priceEditable ? String(p.unitPrice) : 'locked'}
                disabled={!p.priceEditable}
                className={`${inputCls} mt-0.5 w-full disabled:bg-slate-100 disabled:text-slate-400`}
              />
              {!p.priceEditable && <p className="mt-0.5 text-[10px] text-slate-400">Supplier has locked this price</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Purchase qty: {purchaseQty.toFixed(1)} {def.unit}</span>
            <span className="text-sm font-semibold text-slate-900">
              ${mat.toFixed(2)}{lab > 0 && <span className="text-xs font-normal text-slate-500"> + ${lab.toFixed(2)} labour</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Cancel
          </button>
          <button onClick={save} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
