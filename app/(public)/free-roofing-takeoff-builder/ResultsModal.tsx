'use client';

import type { ComponentKind, Entry, ComponentSection, RoofComponentDef } from './types';
import { COMPONENT_DEFS, COMPONENT_ORDER, computeMaterialCost, computeLabourCost } from './calc';

interface ResultsModalProps {
  sections: Record<ComponentKind, ComponentSection>;
  totals: Record<ComponentKind, { rawTotal: number; withWaste: number; count: number; materialCost: number; labourCost: number; totalCost: number }>;
  getComponentById: (id: string | null) => RoofComponentDef | null;
  grandTotal: number;
  onClose: () => void;
}

export function ResultsModal({ sections, totals, getComponentById, grandTotal, onClose }: ResultsModalProps) {
  const cur = '£';
  const hasPricing = grandTotal > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Roof Takeoff Report</h2>
            <p className="text-xs text-slate-400">Generated {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-slate-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {COMPONENT_ORDER.map(kind => {
            const def = COMPONENT_DEFS[kind];
            const section = sections[kind];
            const t = totals[kind];
            if (t.count === 0) return null;

            return (
              <div key={kind}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: def.colour }} />
                  <h3 className="text-sm font-semibold text-slate-900">{def.label}</h3>
                  <span className="text-xs text-slate-400">({t.count} {t.count === 1 ? 'entry' : 'entries'})</span>
                </div>

                {/* Entry details */}
                <div className="space-y-1 mb-2">
                  {section.entries.map((entry, idx) => {
                    const comp = getComponentById(entry.selectedComponentId);
                    const matCost = comp ? computeMaterialCost(entry.computedValue, comp) : { cost: 0, packs: 0 };
                    const labCost = comp ? computeLabourCost(entry.computedValue, comp) : 0;
                    const entryTotal = matCost.cost + labCost;
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500">
                            {entry.label || `Entry ${idx + 1}`}
                            {entry.inputMode === 'pitch_calculated' && def.pitchType !== 'none' && (
                              <span className="ml-2 text-slate-400">@ {entry.pitchDegrees}°</span>
                            )}
                          </span>
                          {comp && (
                            <span className="ml-2 text-slate-400 truncate">{comp.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-medium text-slate-700">
                            {entry.computedValue.toFixed(2)} {def.unit}
                          </span>
                          {entryTotal > 0 && (
                            <span className="text-[#FF6B35] font-medium">
                              {cur}{entryTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500">
                    Subtotal
                    {section.wastePercent > 0 && (
                      <span className="ml-2">+ {section.wastePercent}% waste</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      {t.withWaste.toFixed(2)} {def.unit}
                    </span>
                    {section.wastePercent > 0 && (
                      <span className="ml-2 text-xs text-slate-400">
                        (raw: {t.rawTotal.toFixed(2)})
                      </span>
                    )}
                    {t.totalCost > 0 && (
                      <div className="text-xs text-[#FF6B35] font-medium">
                        Material: {cur}{t.materialCost.toFixed(2)}
                        {t.labourCost > 0 && ` + Labour: ${cur}${t.labourCost.toFixed(2)}`}
                        {' = '}{cur}{t.totalCost.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Grand total */}
          {hasPricing && (
            <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Materials</span>
                <span className="text-lg font-bold">
                  {cur}{COMPONENT_ORDER.reduce((s, k) => s + totals[k].materialCost, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Labour</span>
                <span className="text-lg font-bold">
                  {cur}{COMPONENT_ORDER.reduce((s, k) => s + totals[k].labourCost, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-semibold">Grand Total</span>
                <span className="text-xl font-bold">{cur}{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Total roof area highlight (when no pricing) */}
          {!hasPricing && totals.roof_area.count > 0 && (
            <div className="rounded-xl bg-slate-900 text-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Roof Area (with waste)</span>
                <span className="text-xl font-bold">
                  {totals.roof_area.withWaste.toFixed(2)} m²
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
            >
              Close
            </button>
            <a
              href="/signup?ref=free-roofing-takeoff-builder"
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Save to QuoteCore+
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
