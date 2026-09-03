'use client';

// Admin > Products: add / edit / remove catalog products, set pricing,
// labour rate, waste and the measurement basis (area / lineal / count).
// Edits write to the live supplier config (saved via the admin shell).

import type { SupplierProduct } from '../types';
import type { SupplierConfig } from '../supplierConfig';
import { tradeUnitPrice } from '../supplierConfig';
import { SectionCard } from './AdminPanel';

const BASES: Array<SupplierProduct['basis']> = ['area', 'lineal', 'count'];
const BASIS_LABEL: Record<string, string> = { area: 'Area (m\u00B2)', lineal: 'Lineal (m)', count: 'Item (count)' };

let newIdCounter = 0;

export function AdminProducts({ cfg, setCfg }: { cfg: SupplierConfig; setCfg: (fn: (c: SupplierConfig) => SupplierConfig) => void }) {
  const inputCls = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

  function patchProduct(id: string, p: Partial<SupplierProduct>) {
    setCfg(c => ({ ...c, products: c.products.map(x => (x.id === id ? { ...x, ...p } : x)) }));
  }

  function addProduct() {
    newIdCounter += 1;
    const id = `new-${Date.now()}-${newIdCounter}`;
    setCfg(c => ({
      ...c,
      products: [...c.products, {
        id,
        name: 'New product',
        code: '',
        basis: 'area',
        groups: c.trade === 'roofing' ? ['roofAreas'] : ['areas'],
        component: 'covering',
        roofTypes: ['all'],
        unitPrice: 0,
        packSize: null,
        defaultWastePct: 5,
        defaultLabourRate: 0,
        priceEditable: true,
      }],
    }));
  }

  function removeProduct(id: string) {
    setCfg(c => ({ ...c, products: c.products.filter(x => x.id !== id) }));
  }

  return (
    <SectionCard title={`Products (${cfg.products.length})`} desc="Everything the supplier sells through the tool. Basis decides where the product can be used: area (m\u00B2), lineal (m) or item (count).">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Changes apply to the tool once saved (Save changes, top right).</p>
        <button onClick={addProduct} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition">
          + Add product
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-2 font-medium">Name</th>
              <th className="py-1.5 pr-2 font-medium">Code</th>
              <th className="py-1.5 pr-2 font-medium">Basis</th>
              <th className="py-1.5 pr-2 font-medium text-right">Price ({cfg.currency})</th>
              <th className="py-1.5 pr-2 font-medium text-right">Labour</th>
              <th className="py-1.5 pr-2 font-medium text-right">Waste %</th>
              <th className="py-1.5 pr-2 font-medium text-right">Trade</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {cfg.products.map(p => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 min-w-[180px]">
                  <input type="text" value={p.name} onChange={e => patchProduct(p.id, { name: e.target.value })} className={inputCls} aria-label={`Name ${p.name}`} />
                </td>
                <td className="py-1.5 pr-2 w-24">
                  <input type="text" value={p.code} onChange={e => patchProduct(p.id, { code: e.target.value })} className={inputCls} aria-label={`Code ${p.name}`} />
                </td>
                <td className="py-1.5 pr-2 w-32">
                  <select value={p.basis} onChange={e => patchProduct(p.id, { basis: e.target.value as SupplierProduct['basis'] })} className={inputCls} aria-label={`Basis ${p.name}`}>
                    {BASES.map(b => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2 w-24">
                  <input type="number" min="0" step="0.1" value={p.unitPrice} onChange={e => patchProduct(p.id, { unitPrice: parseFloat(e.target.value) || 0 })} className={`${inputCls} text-right`} aria-label={`Price ${p.name}`} />
                </td>
                <td className="py-1.5 pr-2 w-20">
                  <input type="number" min="0" step="0.5" value={p.defaultLabourRate} onChange={e => patchProduct(p.id, { defaultLabourRate: parseFloat(e.target.value) || 0 })} className={`${inputCls} text-right`} aria-label={`Labour ${p.name}`} />
                </td>
                <td className="py-1.5 pr-2 w-20">
                  <input type="number" min="0" max="50" step="0.5" value={p.defaultWastePct} onChange={e => patchProduct(p.id, { defaultWastePct: parseFloat(e.target.value) || 0 })} className={`${inputCls} text-right`} aria-label={`Waste ${p.name}`} />
                </td>
                <td className="py-1.5 pr-2 text-right text-slate-600 whitespace-nowrap">{cfg.currency}{tradeUnitPrice(p, cfg).toFixed(2)}</td>
                <td className="py-1.5 text-right">
                  <button onClick={() => removeProduct(p.id)} className="text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${p.name}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
