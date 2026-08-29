// Custom components step (final step before output). Lets the user create
// anything not covered by the standard groups: name, measurement basis
// (area / lineal / fixed quantity), quantity, material cost and labour cost.
// Session-only - nothing is persisted to any library. Loop UX: after each
// created component the user chooses "add another" or "generate output".

'use client';

import { useState } from 'react';
import type { CustomComponent, MeasurementBasis, MeasurementSet } from './types';
import { CUSTOM_BASIS_UNIT, makeId } from './types';
import { fmt } from './pricing';
import { useSupplierConfig } from './supplierConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const BASIS_OPTIONS: { value: MeasurementBasis; label: string; unit: string; desc: string }[] = [
  { value: 'area', label: 'Area', unit: 'm\\\\u00B2', desc: 'Measured in square metres' },
  { value: 'lineal', label: 'Lineal', unit: 'm', desc: 'Measured in metres of length' },
  { value: 'count', label: 'Fixed quantity', unit: 'ea', desc: 'A count of items' },
];

export function CustomComponentsStep({
  measureSet, setMeasureSet, onBack, onNext,
}: {
  measureSet: MeasurementSet;
  setMeasureSet: (s: MeasurementSet) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const customs = measureSet.customComponents;
  const { config: supplierCfg } = useSupplierConfig();
  const cur = supplierCfg.currency;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<MeasurementBasis>('area');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [labourRate, setLabourRate] = useState('');

  const unit = CUSTOM_BASIS_UNIT[basis];
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const labour = parseFloat(labourRate) || 0;
  const canAdd = name.trim().length > 0 && qty > 0;

  function addCustom() {
    if (!canAdd) return;
    const c: CustomComponent = {
      id: makeId('cc'),
      name: name.trim(),
      basis,
      quantity: qty,
      unitPrice: price,
      labourRate: labour,
    };
    setMeasureSet({ ...measureSet, customComponents: [...customs, c] });
    // reset the form but stay in "adding" mode so the user can chain another
    setName(''); setQuantity(''); setUnitPrice(''); setLabourRate('');
  }

  function removeCustom(id: string) {
    setMeasureSet({ ...measureSet, customComponents: customs.filter(c => c.id !== id) });
  }

  const customMaterial = customs.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const customLabour = customs.reduce((s, c) => s + c.quantity * c.labourRate, 0);

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Anything not covered?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add custom components for anything the standard groups don&apos;t cover - skylights, fascia,
          plywood, specialist flashings, anything. You define how it&apos;s measured, set your material
          and labour costs, and it&apos;s included in the final output. Totally optional.
        </p>
      </div>

      {/* Created custom components */}
      {customs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Your custom components</h3>
          {customs.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/40 hover:border-blue-200 px-3 py-2.5 transition flex-wrap"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                <div className="text-xs text-slate-400">
                  {fmt(c.quantity, c.basis === 'count' ? 0 : 1)} {CUSTOM_BASIS_UNIT[c.basis]} -
                  ${cur}${fmt(c.unitPrice)}/{CUSTOM_BASIS_UNIT[c.basis]}
                  {c.labourRate > 0 && <span> - labour ${cur}${fmt(c.labourRate)}/{CUSTOM_BASIS_UNIT[c.basis]}</span>}
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900 whitespace-nowrap flex-shrink-0">
                ${cur}${fmt(c.quantity * (c.unitPrice + c.labourRate))}
              </span>
              <button
                onClick={() => removeCustom(c.id)}
                className="text-slate-300 hover:text-red-500 transition p-1 flex-shrink-0"
                aria-label={`Remove ${c.name}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-400 pt-1">
            Custom components total: ${cur}${fmt(customMaterial + customLabour)}
            {customLabour > 0 && <span> (${cur}${fmt(customMaterial)} materials + ${cur}${fmt(customLabour)} labour)</span>}
          </p>
        </div>
      )}

      {/* Create form / add-another loop */}
      {adding ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">New custom component</h3>
          <div>
            <label className="text-xs font-medium text-slate-600">Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Skylight flashing, Fascia board, Plywood patch"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">How is it measured?</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {BASIS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setBasis(o.value)}
                  className={`text-left rounded-xl border p-2.5 transition cursor-pointer ${basis === o.value ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs font-semibold text-slate-900">{o.label} ({o.unit})</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Quantity ({unit})</label>
              <input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Material cost ($/{unit})</label>
              <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Labour cost ($/{unit})</label>
              <input type="number" min="0" step="0.01" value={labourRate} onChange={e => setLabourRate(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          {canAdd && (
            <p className="text-xs text-slate-500">
              Line total: <span className="font-semibold text-slate-900">${cur}${fmt(qty * (price + labour))}</span>
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => setAdding(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
              Cancel
            </button>
            <button
              onClick={addCustom}
              disabled={!canAdd}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Add custom component
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
          {customs.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Do you want to add custom components?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdding(true)}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
                >
                  + Add a custom component
                </button>
                <button
                  onClick={onNext}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition cursor-pointer"
                >
                  No thanks, generate the output
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Add another custom component, or generate your final output?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdding(true)}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
                >
                  + Add another
                </button>
                <button
                  onClick={onNext}
                  className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] cursor-pointer"
                >
                  Generate output
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
      </div>
    </div>
  );
}



