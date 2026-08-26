'use client';

// Phase 6 (demo-grade) supplier admin panel for the supplier pricing tool.
// Manages branding, powered-by mode, trade pricing policy and the demo
// catalog via localStorage overrides (see supplierConfig.ts). This is the
// demo stand-in for the production supplier self-service admin; the read
// API is identical so the swap later is backend-only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupplierProduct } from '../types';
import { GROUP_DEFS } from '../types';
import {
  defaultConfig, readStoredConfig, resetStoredConfig, tradeUnitPrice,
  useSupplierConfig, writeStoredConfig, type SupplierConfig,
} from '../supplierConfig';

const inputCls = 'mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export default function SupplierAdminPage() {
  const { config: live } = useSupplierConfig();
  const [cfg, setCfg] = useState<SupplierConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCfg(readStoredConfig() ?? defaultConfig());
    setLoaded(true);
  }, []);

  function patch(p: Partial<SupplierConfig>) {
    setCfg(c => ({ ...c, ...p }));
    setDirty(true);
    setSaved(false);
  }

  function patchProduct(id: string, p: Partial<SupplierProduct>) {
    setCfg(c => ({ ...c, products: c.products.map(x => (x.id === id ? { ...x, ...p } : x)) }));
    setDirty(true);
    setSaved(false);
  }

  function save() {
    writeStoredConfig(cfg);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function resetAll() {
    resetStoredConfig();
    setCfg(defaultConfig());
    setDirty(false);
  }

  if (!loaded) {
    return <main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading admin...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Supplier Admin (demo)</div>
            <div className="text-xs text-slate-400">{live.name} - configuration stored in this browser (localStorage)</div>
          </div>
          <Link href="/supplier-pricing-tool" className="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition">
            Back to tool
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4 pb-16">
        {/* Branding */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Branding</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Supplier name</label>
              <input type="text" value={cfg.name} onChange={e => patch({ name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Tagline</label>
              <input type="text" value={cfg.tagline} onChange={e => patch({ tagline: e.target.value })} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={cfg.poweredBy} onChange={e => patch({ poweredBy: e.target.checked })} className="h-4 w-4 accent-slate-900" />
            Powered by QuoteCore+ (off = white-label)
          </label>
        </section>

        {/* Trade pricing */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Trade pricing</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Blanket trade discount (%)</label>
              <input type="number" min="0" max="80" step="0.5" value={cfg.discountPct} onChange={e => patch({ discountPct: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={cfg.tradeRequiresLogin} onChange={e => patch({ tradeRequiresLogin: e.target.checked })} className="h-4 w-4 accent-slate-900" />
            Trade pricing requires login (unchecked = show trade prices to everyone)
          </label>
          <p className="text-xs text-slate-400">
            Trade price = baseline x (1 - discount). Logged-in users see trade prices throughout the flow and a
            standard-vs-trade comparison with their saving in the final output.
          </p>
        </section>

        {/* Catalog */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Catalog ({cfg.products.length} products)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Product</th>
                  <th className="py-1.5 pr-2 font-medium">Code</th>
                  <th className="py-1.5 pr-2 font-medium">Groups</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Baseline</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Trade</th>
                  <th className="py-1.5 pr-2 font-medium">Price editable</th>
                </tr>
              </thead>
              <tbody>
                {cfg.products.map(p => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-900">{p.name}</td>
                    <td className="py-1.5 pr-2 text-xs text-slate-400">{p.code}</td>
                    <td className="py-1.5 pr-2 text-xs text-slate-500">
                      {p.groups.map(g => GROUP_DEFS.find(d => d.key === g)?.label ?? g).join(', ')}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <input
                        type="number" min="0" step="0.1" value={p.unitPrice}
                        onChange={e => patchProduct(p.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                        aria-label={`Baseline price for ${p.name}`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">{cfg.currency}{tradeUnitPrice(p, cfg).toFixed(2)}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox" checked={p.priceEditable}
                        onChange={e => patchProduct(p.id, { priceEditable: e.target.checked })}
                        className="h-4 w-4 accent-slate-900"
                        aria-label={`Price editable for ${p.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <button onClick={resetAll} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Reset to defaults
          </button>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-600">Saved - the tool reflects these settings live.</span>}
            <button
              onClick={save}
              disabled={!dirty}
              className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              Save configuration
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
