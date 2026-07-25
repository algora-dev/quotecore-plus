'use client';

import type { ComponentKind, Entry, ComponentSection, RoofComponentDef, CustomComponentDef } from './types';
import { COMPONENT_DEFS, BUILT_IN_ORDER, computeMaterialCost, computeLabourCost } from './calc';
import { ComponentSymbol, componentLabel } from './helpers';

interface ResultsModalProps {
  sections: Record<string, ComponentSection>;
  totals: Record<string, { rawTotal: number; withWaste: number; count: number; materialCost: number; labourCost: number; totalCost: number }>;
  getComponentById: (id: string | null) => RoofComponentDef | null;
  grandTotal: number;
  unitSystem: 'metric' | 'imperial' | 'squares';
  allKeys: string[];
  onClose: () => void;
}

export function ResultsModal({ sections, totals, getComponentById, grandTotal, unitSystem, allKeys, onClose }: ResultsModalProps) {
  const cur = '\u00A3';
  const hasPricing = grandTotal > 0;
  const lenUnit = unitSystem === 'metric' ? 'm' : 'ft';
  const areaUnit = unitSystem === 'metric' ? 'm\u00B2' : unitSystem === 'imperial' ? 'sq ft' : 'squares';
  const unitFor = (key: string) => {
    const section = sections[key];
    if (key === 'roof_area') return areaUnit;
    if (key.startsWith('custom-') && section?.customDef?.measurementType === 'area') return areaUnit;
    return lenUnit;
  };

  function buildConvertToQuoteUrl(): string {
    const lines: { description: string; qty: number; unit: string; rate: number }[] = [];
    for (const key of allKeys) {
      const section = sections[key];
      if (!section || section.entries.length === 0) continue;
      const unit = unitFor(key);
      const wasteMultiplier = 1 + section.wastePercent / 100;
      const label = componentLabel(key, section.customDef);

      for (const entry of section.entries) {
        const comp = getComponentById(entry.selectedComponentId);
        const withWaste = entry.computedValue * wasteMultiplier;
        const matCost = comp ? computeMaterialCost(withWaste, comp) : { cost: 0, packs: 0 };
        const labCost = comp ? computeLabourCost(withWaste, comp) : 0;
        const rate = comp ? (matCost.cost + labCost) / (withWaste || 1) : 0;
        const entryLabel = entry.label || `${label} ${section.entries.indexOf(entry) + 1}`;
        const desc = comp
          ? `${entryLabel} - ${comp.name}${section.wastePercent > 0 ? ` (+${section.wastePercent}% waste)` : ''}`
          : `${entryLabel}${section.wastePercent > 0 ? ` (+${section.wastePercent}% waste)` : ''}`;
        lines.push({ description: desc, qty: Math.round(withWaste * 100) / 100, unit, rate: Math.round(rate * 100) / 100 });
      }
    }
    const params = new URLSearchParams();
    params.set('amount', grandTotal.toFixed(2));
    if (lines.length > 0) params.set('lines', encodeURIComponent(JSON.stringify(lines)));
    params.set('ref', 'free-roofing-takeoff-builder');
    return `/free-quote-generator?${params.toString()}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4 print:block print:static print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full print:max-w-none print:overflow-visible" id="takeoff-print">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:border-slate-300">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Roof Takeoff Report</h2>
            <p className="text-xs text-slate-400">Generated {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-slate-50 print:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5 print:overflow-visible print:px-6 print:py-2">
          {allKeys.map(key => {
            const section = sections[key];
            if (!section) return null;
            const t = totals[key];
            if (!t || t.count === 0) return null;
            const label = componentLabel(key, section.customDef);
            const pitchType = key === 'roof_area' ? 'rafter' : key.startsWith('custom-') ? (section.customDef?.pitchType ?? 'none') : (COMPONENT_DEFS[key]?.pitchType ?? 'none');

            return (
              <div key={key} className="print:break-inside-avoid">
                <div className="flex items-center gap-2 mb-2">
                  <ComponentSymbol kind={key} customDef={section.customDef} className="w-3.5 h-3.5 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                  <span className="text-xs text-slate-400">({t.count} {t.count === 1 ? 'entry' : 'entries'})</span>
                </div>

                <div className="space-y-1 mb-2">
                  {section.entries.map((entry, idx) => {
                    const comp = getComponentById(entry.selectedComponentId);
                    const matCost = comp ? computeMaterialCost(entry.computedValue, comp) : { cost: 0, packs: 0 };
                    const labCost = comp ? computeLabourCost(entry.computedValue, comp) : 0;
                    const entryTotal = matCost.cost + labCost;
                    const isPitchCalc = entry.inputMode === 'pitch_calculated' && pitchType !== 'none';
                    const isArea = key === 'roof_area' || (key.startsWith('custom-') && section.customDef?.measurementType === 'area');
                    const originalValue = isPitchCalc
                      ? (entry.isTotalInput
                          ? (entry.actualValue ?? 0) * (entry.quantity ?? 1)
                          : isArea
                            ? (entry.planWidth ?? 0) * (entry.planLengthVal ?? 0) * (entry.quantity ?? 1)
                            : (entry.planLength ?? 0) * (entry.quantity ?? 1))
                      : null;
                    const withWasteVal = entry.computedValue * (1 + section.wastePercent / 100);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs print:bg-white print:border print:border-slate-100">
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500">{entry.label || `Entry ${idx + 1}`}</span>
                          {isPitchCalc && <span className="ml-2 text-slate-400">@ {entry.pitchDegrees}{'\u00b0'}</span>}
                          {comp && <span className="ml-2 text-slate-400 truncate">{comp.name}</span>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {isPitchCalc && originalValue !== null && originalValue > 0 && (
                            <span className="text-slate-400">{originalValue.toFixed(2)} {unitFor(key)}<span className="ml-1 text-slate-300">{'\u2192'}</span></span>
                          )}
                          <span className="font-medium text-slate-700">{entry.computedValue.toFixed(2)} {unitFor(key)}</span>
                          {section.wastePercent > 0 && <span className="text-slate-400 text-[10px]">+{section.wastePercent}% = {withWasteVal.toFixed(2)}</span>}
                          {entryTotal > 0 && <span className="text-[#FF6B35] font-medium">{cur}{entryTotal.toFixed(2)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 print:break-inside-avoid">
                  <div className="text-xs text-slate-500">Subtotal{section.wastePercent > 0 && <span className="ml-2">+ {section.wastePercent}% waste</span>}</div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900">{t.withWaste.toFixed(2)} {unitFor(key)}</span>
                    {section.wastePercent > 0 && <span className="ml-2 text-xs text-slate-400">(raw: {t.rawTotal.toFixed(2)})</span>}
                    {t.totalCost > 0 && <div className="text-xs text-[#FF6B35] font-medium">Material: {cur}{t.materialCost.toFixed(2)}{t.labourCost > 0 ? ` + Labour: ${cur}${t.labourCost.toFixed(2)}` : ''} = {cur}{t.totalCost.toFixed(2)}</div>}
                  </div>
                </div>
              </div>
            );
          })}

          {hasPricing && (
            <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2 print:break-inside-avoid">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Total Materials</span><span className="text-lg font-bold">{cur}{allKeys.reduce((s, k) => s + (totals[k]?.materialCost ?? 0), 0).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Total Labour</span><span className="text-lg font-bold">{cur}{allKeys.reduce((s, k) => s + (totals[k]?.labourCost ?? 0), 0).toFixed(2)}</span></div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10"><span className="text-sm font-semibold">Grand Total</span><span className="text-xl font-bold">{cur}{grandTotal.toFixed(2)}</span></div>
            </div>
          )}
          {!hasPricing && totals['roof_area']?.count > 0 && (
            <div className="rounded-xl bg-slate-900 text-white p-4 print:break-inside-avoid">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Total Roof Area (with waste)</span><span className="text-xl font-bold">{totals['roof_area'].withWaste.toFixed(2)} {areaUnit}</span></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print / PDF
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition">Close</button>
            <a href={buildConvertToQuoteUrl()} className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Convert to Quote
            </a>
            <a href="/signup?ref=free-roofing-takeoff-builder" className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800">
              Save to QuoteCore+
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          html, body { background: white !important; height: auto !important; }
          /* Hide everything when printing */
          body > * { visibility: hidden; }
          /* Reset the overlay container so it doesn't center/push content down */
          body > div { position: static !important; display: block !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; }
          /* Show only the modal and its children */
          #takeoff-print, #takeoff-print * { visibility: visible; }
          /* Position modal at top of page 1 */
          #takeoff-print {
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            display: block !important;
          }
          header, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
