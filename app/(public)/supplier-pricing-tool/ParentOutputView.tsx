// Output view for parent-model trades: per-parent product lines with
// measured areas, waste-adjusted quantities, material + labour totals,
// custom components and the grand total.

'use client';

import type { ParentJob, SupplierProduct } from './types';
import { parentTotal, CUSTOM_BASIS_UNIT } from './types';
import { priceParentOutput } from './parentPricing';
import { fmt } from './pricing';
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
  const entryCount = job.entries.length;

  return (
    <div className="space-y-4">
      {/* Totals banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{trade.label} job estimate</h2>
          <span className="text-xs text-slate-400">
            {job.parents.length} area group{job.parents.length === 1 ? '' : 's'} - {entryCount} measured area{entryCount === 1 ? '' : 's'}
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

      {/* Per-parent lines */}
      <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition">
        <div className="border-b border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Products by area group</h3>
          <p className="mt-0.5 text-xs text-slate-500">Purchase qty includes waste allowance.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {job.parents.map(parent => {
            const entries = job.entries.filter(e => e.parentId === parent.id);
            const total = parentTotal(job, parent.id);
            const line = totals.lines.find(l => l.parentId === parent.id);
            if (!line) return null;
            const baseline = baselineById.get(line.productId);
            const saving = baseline && baseline.unitPrice > line.unitPrice;

            return (
              <div key={parent.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-900">{parent.name}</span>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {entries.map(e => `${e.label} (${(e.value * (e.quantity || 1)).toFixed(1)} m\u00B2)`).join(' - ')}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{total.toFixed(1)} m\u00B2 measured</span>
                </div>
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
                      <tr className="border-b-0">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-800">{line.name}</div>
                          <div className="text-xs text-slate-400">{line.code}</div>
                        </td>
                        <td className="py-2 pr-2 text-right text-slate-600">{fmt(line.calcQty, 1)} m\u00B2</td>
                        <td className="py-2 pr-2 text-right text-slate-600">{line.wastePct}%</td>
                        <td className="py-2 pr-2 text-right font-medium text-slate-800">{fmt(line.purchaseQty, 1)} m\u00B2</td>
                        <td className="py-2 pr-2 text-right text-slate-600">
                          {currency}{fmt(line.unitPrice)}
                          {saving && showTrade && <span className="ml-1 text-xs text-slate-400 line-through">{currency}{fmt(baseline!.unitPrice)}</span>}
                        </td>
                        <td className="py-2 pr-2 text-right font-medium text-slate-900">{currency}{fmt(line.lineTotal)}</td>
                        <td className="py-2 text-right text-slate-600">{line.labourTotal > 0 ? `${currency}${fmt(line.labourTotal)}` : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom components */}
      {totals.customs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
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

      <div className="flex flex-wrap items-center justify-between gap-2 pb-8">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onAddCustom} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Add custom component
          </button>
          <button onClick={onRestart} className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]">
            Start a new job
          </button>
        </div>
      </div>
    </div>
  );
}
