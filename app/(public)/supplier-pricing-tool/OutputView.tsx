// Final output: materials breakdown by group (with per-entry Advanced lines),
// labour (if added in Advanced), totals. Trade pricing + actions in Phase 4/5.

'use client';

import type { GroupKey, MeasurementSet, SupplierProduct } from './types';
import { GROUP_DEFS, groupPitchedTotal, entryPitched, CUSTOM_BASIS_UNIT } from './types';
import { fmt, priceOutput } from './pricing';
import { useSupplierConfig } from './supplierConfig';
import { OutputActions } from './OutputActions';

export function OutputView({ measureSet, catalog, baselineCatalog, showTrade, tradeLabel, onBack, onRestart, onAddCustom }: {
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
  /** baseline-price catalog for the standard-vs-trade comparison */
  baselineCatalog?: SupplierProduct[];
  /** logged in (or trade public) - show trade totals */
  showTrade?: boolean;
  tradeLabel?: string | null;
  onBack: () => void;
  onRestart: () => void;
  /** 2026-08-30: jump back to the custom-components step to add one more
   *  without restarting the flow. Falls back to onBack when not provided. */
  onAddCustom?: () => void;
}) {
  const output = priceOutput(measureSet, catalog);
  // Same quantities priced at baseline for the trade-saving comparison.
  const baselineOutput = baselineCatalog ? priceOutput(measureSet, baselineCatalog) : null;
  const { config: supplierCfg } = useSupplierConfig();
  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
  const cur = supplierCfg.currency;
  const supplierName = supplierCfg.name;
  // Supplier branding: brand colour drives accents/borders, logo (or
  // brand-coloured monogram placeholder) sits in the output header.
  const brand = supplierCfg.brandColor || '#1E5AA8';
  const hasLabour = output.labour > 0;
  const showTradeTotals = !!showTrade && !!baselineOutput && baselineOutput.material > output.material;
  const measureNote = measureSet.entryPath === 'plan'
    ? 'Plan measurements with pitch applied - metric (m / m\u00B2)'
    : 'Actual/site measurements - metric (m / m\u00B2)';

  const byGroup = GROUP_DEFS
    .map(def => ({ def, lines: output.lines.filter(l => l.groupKey === def.key) }))
    .filter(g => g.lines.length > 0);

  // Linear entries attached to a roof area group under that area in the
  // output (per-area attachments drive both grouping and plan pitch maths).
  const areaNameById = new Map(measureSet.groups.roofAreas.entries.map(e => [e.id, e.label]));
  const attachLabel = (entryLabel: string | null, groupKey: GroupKey) => {
    if (!entryLabel) return null;
    const entry = measureSet.groups[groupKey]?.entries.find(e => e.label === entryLabel);
    const areaId = entry?.roofAreaId;
    return areaId ? (areaNameById.get(areaId) ?? null) : null;
  };

  // Roof area entries shown as their own labelled sub-rows with pitch,
  // so each area is clearly identified in the output.
  const areaEntries = measureSet.groups.roofAreas.entries.map(e => ({
    id: e.id,
    label: e.label,
    pitch: e.pitchDegrees ?? null,
    pitched: entryPitched(measureSet, 'roofAreas', e.id),
  }));

  const wasteLabel = (l: { wastePct: number; wasteFlat: number; wasteMode?: 'percent' | 'flat' }) => {
    if (l.wasteMode === 'flat') return l.wasteFlat > 0 ? `+${fmt(l.wasteFlat, 1)}` : '-';
    return l.wastePct > 0 ? `${fmt(l.wastePct, 1)}%` : '-';
  };

  return (
    <div className="space-y-4">
      <div className="spt-print-area bg-white rounded-xl border-2 p-6 md:p-10 space-y-6" style={{ borderColor: brand }}>
        <div className="flex items-start justify-between gap-4 border-b-2 pb-5" style={{ borderColor: brand }}>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-black">MATERIALS PRICING{supplierCfg.demo ? ' (DEMO)' : ''}</h1>
            <p className="mt-1 text-sm text-black">Generated {today} - {supplierName}</p>
            <p className="mt-1 text-xs text-black/60">{measureNote}{tradeLabel ? ` - ${tradeLabel}` : ''}</p>
          </div>
          {supplierCfg.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={supplierCfg.logoUrl} alt={supplierName} className="h-14 w-auto object-contain flex-shrink-0" />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white flex-shrink-0"
              style={{ backgroundColor: brand }}
            >
              {supplierName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {byGroup.map(({ def, lines }) => (
          <div key={def.key} className="spt-keep">
            <div className="flex items-center justify-between border-b-2 px-3 py-2" style={{ backgroundColor: `${brand}14`, borderColor: brand }}>
              <span className="text-black font-bold">{def.label}</span>
              <span className="text-black font-medium text-sm">{fmt(groupPitchedTotal(measureSet, def.key), 1)} {def.unit}</span>
            </div>
            {def.key === 'roofAreas' && areaEntries.length > 0 && (
              <div className="mt-2 space-y-1">
                {areaEntries.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-1.5">
                    <span className="text-xs font-semibold text-black">{a.label}</span>
                    <span className="text-xs text-black/60">
                      {a.pitch != null ? `${a.pitch}° pitch - ` : ''}{fmt(a.pitched, 1)} m²
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/20 text-left text-xs text-black/60">
                    <th className="py-1.5 pr-2 font-medium">Product</th>
                    <th className="py-1.5 pr-2 font-medium">Code</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Calc Qty</th>
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
                        {(() => {
                          const area = attachLabel(l.entryLabel, l.groupKey);
                          return area && <span className="ml-1.5 text-[10px] font-medium text-blue-700">[ {area} ]</span>;
                        })()}
                      </td>
                      <td className="py-2 pr-2 text-black/60 text-xs">{l.code}</td>
                      <td className="py-2 pr-2 text-right text-black">{fmt(l.calcQty, 1)} {l.basisUnit}</td>
                      <td className="py-2 pr-2 text-right text-black font-medium">
                        {fmt(l.purchaseQty, 1)} {l.basisUnit}
                        <span className="ml-1 text-xs font-normal text-black/50">({wasteLabel(l)})</span>
                      </td>
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

        {output.customs.length > 0 && (
          <div className="spt-keep">
            <div className="flex items-center justify-between border-b-2 px-3 py-2" style={{ backgroundColor: `${brand}14`, borderColor: brand }}>
              <span className="text-black font-bold">Custom Components</span>
              <span className="text-black font-medium text-sm">{output.customs.length} item{output.customs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/20 text-left text-xs text-black/60">
                    <th className="py-1.5 pr-2 font-medium">Component</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Qty</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Unit Price</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Line Total</th>
                    {hasLabour && <th className="py-1.5 font-medium text-right">Labour</th>}
                  </tr>
                </thead>
                <tbody>
                  {output.customs.map(c => (
                    <tr key={c.id} className="border-b border-black/10">
                      <td className="py-2 pr-2 text-black">{c.name}</td>
                      <td className="py-2 pr-2 text-right text-black">{fmt(c.quantity, c.basis === 'count' ? 0 : 1)} {CUSTOM_BASIS_UNIT[c.basis]}</td>
                      <td className="py-2 pr-2 text-right text-black/60">{cur}{fmt(c.unitPrice)}</td>
                      <td className="py-2 pr-2 text-right text-black font-semibold">{cur}{fmt(c.quantity * c.unitPrice)}</td>
                      {hasLabour && (
                        <td className="py-2 text-right text-black/60">{c.labourRate > 0 ? `${cur}${fmt(c.quantity * c.labourRate)}` : '-'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="spt-keep border-t-2 pt-4 space-y-1.5" style={{ borderColor: brand }}>
          {showTradeTotals && baselineOutput && (
            <div className="flex items-center justify-between">
              <span className="text-black font-medium">Standard materials price</span>
              <span className="text-black/60">{cur}{fmt(baselineOutput.material)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-black font-bold">{showTradeTotals ? 'Your trade price' : 'Materials total (baseline pricing)'}</span>
            <span className="text-lg font-bold text-black">{cur}{fmt(output.material)}</span>
          </div>
          {showTradeTotals && baselineOutput && (
            <div className="flex items-center justify-between">
              <span className="text-black font-medium">Your saving</span>
              <span className="text-black font-semibold">{cur}{fmt(Math.max(0, baselineOutput.material - output.material))}</span>
            </div>
          )}
          {hasLabour && (
            <div className="flex items-center justify-between">
              <span className="text-black font-medium">Labour total</span>
              <span className="text-black font-semibold">{cur}{fmt(output.labour)}</span>
            </div>
          )}
          {hasLabour && (
            <div className="flex items-center justify-between border-t border-black/20 pt-1.5" style={{ borderColor: `${brand}55` }}>
              <span className="text-black font-bold">Total</span>
              <span className="text-xl font-bold text-black">{cur}{fmt(output.material + output.labour)}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-black/50">
          Calc Qty includes pitch allowance (plan measurement x pitch factor). Purchase Qty = Calc Qty + waste.
        </p>
        <p className="text-xs text-black/50">
          {showTradeTotals
            ? `Trade pricing applied for ${supplierName} account holders.`
            : `Standard materials price. Trade pricing is revealed once you're signed in (if your account has trade pricing with ${supplierName}).`}
        </p>
      </div>

      <OutputActions measureSet={measureSet} catalog={catalog} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
          Back
        </button>
        <div className="flex items-center gap-2">
          {/* 2026-08-30: quick path back to the custom step - add another
              custom component without restarting the whole flow. */}
          <button
            onClick={onAddCustom ?? onBack}
            className="rounded-full border px-5 py-2.5 text-sm font-medium transition"
            style={{ borderColor: `${brand}55`, color: brand }}
          >
            + Add a custom component
          </button>
          <button onClick={onRestart} className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]">
            Start a new job
          </button>
        </div>
      </div>
    </div>
  );
}
