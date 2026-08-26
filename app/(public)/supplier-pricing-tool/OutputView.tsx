// Final output: materials breakdown by group (with per-entry Advanced lines),
// labour (if added in Advanced), totals. Trade pricing + actions in Phase 4/5.

'use client';

import type { MeasurementSet, SupplierProduct } from './types';
import { GROUP_DEFS, groupPitchedTotal } from './types';
import { fmt, priceOutput } from './pricing';
import { SUPPLIER } from './supplier';
import { OutputActions } from './OutputActions';

export function OutputView({ measureSet, catalog, onBack, onRestart }: {
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
  onBack: () => void;
  onRestart: () => void;
}) {
  const output = priceOutput(measureSet, catalog);
  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
  const cur = SUPPLIER.currency;
  const hasLabour = output.labour > 0;
  const measureNote = measureSet.entryPath === 'plan'
    ? 'Plan measurements with pitch applied - metric (m / m\u00B2)'
    : 'Actual/site measurements - metric (m / m\u00B2)';

  const byGroup = GROUP_DEFS
    .map(def => ({ def, lines: output.lines.filter(l => l.groupKey === def.key) }))
    .filter(g => g.lines.length > 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-black p-6 md:p-10 space-y-6">
        <div className="border-b-2 border-black pb-5">
          <h1 className="text-xl font-bold text-black">MATERIALS PRICING</h1>
          <p className="mt-1 text-sm text-black">Generated {today} - {SUPPLIER.name}</p>
          <p className="mt-1 text-xs text-black/60">{measureNote}</p>
        </div>

        {byGroup.map(({ def, lines }) => (
          <div key={def.key}>
            <div className="flex items-center justify-between bg-black/5 border-b-2 border-black px-3 py-2">
              <span className="text-black font-bold">{def.label}</span>
              <span className="text-black font-medium text-sm">{fmt(groupPitchedTotal(measureSet, def.key), 1)} {def.unit}</span>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/20 text-left text-xs text-black/60">
                    <th className="py-1.5 pr-2 font-medium">Product</th>
                    <th className="py-1.5 pr-2 font-medium">Code</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Calc Qty</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Waste</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Purchase Qty</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Unit Price</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Line Total</th>
                    {hasLabour && <th className="py-1.5 font-medium text-right">Labour</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={`${l.productId}-${l.entryLabel ?? 'group'}`} className="border-b border-black/10">
                      <td className="py-2 pr-2 text-black">
                        {l.name}
                        {l.entryLabel && <span className="ml-1.5 text-xs text-black/50">({l.entryLabel})</span>}
                      </td>
                      <td className="py-2 pr-2 text-black/60 text-xs">{l.code}</td>
                      <td className="py-2 pr-2 text-right text-black">{fmt(l.calcQty, 1)} {l.basisUnit}</td>
                      <td className="py-2 pr-2 text-right text-black/60">{l.wastePct > 0 ? `${fmt(l.wastePct, 1)}%` : '-'}</td>
                      <td className="py-2 pr-2 text-right text-black font-medium">{fmt(l.purchaseQty, 1)} {l.basisUnit}</td>
                      <td className="py-2 pr-2 text-right text-black/60">{cur}{fmt(l.unitPrice)}</td>
                      <td className="py-2 pr-2 text-right text-black font-semibold">{cur}{fmt(l.lineTotal)}</td>
                      {hasLabour && (
                        <td className="py-2 text-right text-black/60">{l.labourTotal > 0 ? `${cur}${fmt(l.labourTotal)}` : '-'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="border-t-2 border-black pt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-black font-bold">Materials total (baseline pricing)</span>
            <span className="text-lg font-bold text-black">{cur}{fmt(output.material)}</span>
          </div>
          {hasLabour && (
            <div className="flex items-center justify-between">
              <span className="text-black font-medium">Labour total</span>
              <span className="text-black font-semibold">{cur}{fmt(output.labour)}</span>
            </div>
          )}
          {hasLabour && (
            <div className="flex items-center justify-between border-t border-black/20 pt-1.5">
              <span className="text-black font-bold">Total</span>
              <span className="text-xl font-bold text-black">{cur}{fmt(output.material + output.labour)}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-black/50">
          Standard materials price. Trade pricing is revealed once you&apos;re signed in (if your account has trade pricing with {SUPPLIER.name}).
        </p>
      </div>

      <OutputActions measureSet={measureSet} catalog={catalog} />

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <button onClick={onRestart} className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
          Start a new job
        </button>
      </div>
    </div>
  );
}
