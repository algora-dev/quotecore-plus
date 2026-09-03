// Output view for parent-model trades v2: grouped by bucket, then
// component, then product lines (components can carry multiple layered
// products). Includes waste-adjusted quantities, material + labour totals,
// custom components and the grand total.

'use client';

import type { ParentJob, SupplierProduct } from './types';
import { componentTotal, CUSTOM_BASIS_UNIT } from './types';
import { priceParentOutput } from './parentPricing';
import { ParentOutputActions } from './ParentOutputActions';
import { fmt } from './pricing';
import { useSupplierConfig } from './supplierConfig';
import type { TradeConfig } from './tradeConfig';

export function ParentOutputView({
  trade, job, catalog, baselineCatalog, showTrade, tradeLabel, currency, basePath, onBack, onAddCustom, onRestart,
}: {
  trade: TradeConfig;
  job: ParentJob;
  catalog: SupplierProduct[];
  baselineCatalog: SupplierProduct[];
  showTrade: boolean;
  tradeLabel: string | null;
  currency: string;
  basePath: string;
  onBack: () => void;
  onAddCustom: () => void;
  onRestart: () => void;
}) {
  const totals = priceParentOutput(job, catalog);
  const grand = totals.material + totals.labour;
  const baselineById = new Map(baselineCatalog.map(p => [p.id, p]));
  const { config: supplierCfg } = useSupplierConfig();
  const demoSuffix = supplierCfg.demo ? ' (demo)' : '';

  return (
    <div className="space-y-4">
      {/* Print/download target: everything except the action tiles below */}
      <div className="spt-print-area space-y-4">
      {/* Totals banner */}
      <div className="spt-keep rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{trade.label} job estimate{demoSuffix}</h2>
          <span className="text-xs text-slate-400">
            {job.parents.length} bucket{job.parents.length === 1 ? '' : 's'} - {job.components.length} component{job.components.length === 1 ? '' : 's'}
            {tradeLabel ? ` - ${tradeLabel}` : ''}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Materials</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{currency}{fmt(totals.material)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Labour</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{currency}{fmt(totals.labour)}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3">
            <div className="text-xs text-slate-500">Total (excl. tax)</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{currency}{fmt(grand)}</div>
          </div>
        </div>
      </div>

      {/* Per-bucket sections */}
      {job.parents.map(bucket => {
        const components = job.components.filter(c => c.parentId === bucket.id);
        const bucketLines = totals.lines.filter(l => l.bucketId === bucket.id);
        if (components.length === 0 && bucketLines.length === 0) return null;
        return (
          <div key={bucket.id} className="spt-keep rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition">
            <div className="border-b border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{bucket.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">Purchase qty includes waste allowance.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {components.map(comp => {
                const entries = job.entries.filter(e => e.componentId === comp.id);
                const total = componentTotal(job, comp.id);
                const lines = totals.lines.filter(l => l.componentId === comp.id);
                return (
                  <div key={comp.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-800">{comp.name}</span>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {entries.map(e => `${e.label} (${(e.value * (e.quantity || 1)).toFixed(1)})`).join(' - ')}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} {lines[0]?.basisUnit ?? ''} measured</span>
                    </div>
                    {lines.length > 0 && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                              <th className="py-1.5 pr-2 font-medium">Product</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Calc qty</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Waste</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Purchase qty</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Unit price</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Material</th>
                              <th className="py-1.5 font-medium text-right">Labour</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map(l => {
                              const baseline = baselineById.get(l.productId);
                              const saving = baseline && baseline.unitPrice > l.unitPrice;
                              return (
                                <tr key={`${l.componentId}-${l.productId}`}>
                                  <td className="py-2 pr-2">
                                    <div className="font-medium text-slate-800">{l.name}</div>
                                    <div className="text-xs text-slate-400">{l.code}</div>
                                  </td>
                                  <td className="py-2 pr-2 text-right text-slate-600">{fmt(l.calcQty, 1)} {l.basisUnit}</td>
                                  <td className="py-2 pr-2 text-right text-slate-600">{l.wastePct}%</td>
                                  <td className="py-2 pr-2 text-right font-medium text-slate-800">{fmt(l.purchaseQty, 1)} {l.basisUnit}</td>
                                  <td className="py-2 pr-2 text-right text-slate-600">
                                    {currency}{fmt(l.unitPrice)}
                                    {saving && showTrade && <span className="ml-1 text-xs text-slate-400 line-through">{currency}{fmt(baseline!.unitPrice)}</span>}
                                  </td>
                                  <td className="py-2 pr-2 text-right font-medium text-slate-900">{currency}{fmt(l.lineTotal)}</td>
                                  <td className="py-2 text-right text-slate-600">{l.labourTotal > 0 ? `${currency}${fmt(l.labourTotal)}` : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Custom components */}
      {totals.customs.length > 0 && (
        <div className="spt-keep rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Custom components</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {totals.customs.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{fmt(c.quantity, 1)} {CUSTOM_BASIS_UNIT[c.basis]}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-slate-900">{currency}{fmt(c.quantity * c.unitPrice + c.quantity * c.labourRate)}</div>
                  <div className="text-xs text-slate-400">mat {currency}{fmt(c.quantity * c.unitPrice)} + labour {currency}{fmt(c.quantity * c.labourRate)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pb-8 spt-noprint">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
      </div>
      </div>

      {/* End-of-flow options - same set as the roofing tool */}
      <div className="pb-8">
        <ParentOutputActions job={job} catalog={catalog} onRestart={onRestart} />
      </div>
    </div>
  );
}
