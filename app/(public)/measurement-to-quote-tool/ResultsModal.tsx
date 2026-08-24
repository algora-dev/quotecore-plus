'use client';

import { useEffect, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { areaComponentTotals, entryFinalValue, entryRawValue, grandTotals, fmt } from './calc';

interface ResultsModalProps {
  areas: ParentArea[];
  components: BuilderComponent[];
  measureMode: MeasureMode;
  unitSystem: UnitSystem;
  currency: string;
  onClose: () => void;
  onSaveToApp: () => void;
}

export default function ResultsModal({ areas, components, measureMode, unitSystem, currency, onClose, onSaveToApp }: ResultsModalProps) {
  const [showActions, setShowActions] = useState(false);
  const compById = new Map(components.map(c => [c.id, c]));
  const len = unitSystem === 'metric' ? 'm' : 'ft';
  const areaU = unitSystem === 'metric' ? 'm\u00B2' : unitSystem === 'imperial' ? 'sq ft' : 'squares';
  const totals = grandTotals(areas, components, measureMode);

  useEffect(() => {
    function handleBeforePrint() { /* modal is print-root; browser handles rest */ }
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, []);

  function unitFor(comp: BuilderComponent): string {
    if (comp.measurementType === 'quantity') return 'pcs';
    return comp.measurementType === 'area' ? areaU : len;
  }

  function buildConvertToQuoteUrl(): string {
    const lines: { description: string; qty: number; unit: string; rate: number }[] = [];
    for (const area of areas) {
      for (const ac of area.components) {
        const comp = compById.get(ac.componentId);
        if (!comp || ac.entries.length === 0) continue;
        const t = areaComponentTotals(ac, comp, area, measureMode);
        const wasteNote = comp.wasteType === 'percent' && comp.wasteValue > 0 ? ` (+${comp.wasteValue}% waste)` : '';
        for (const e of ac.entries) {
          const raw = entryRawValue(e, comp);
          const finalV = entryFinalValue(e, comp, area, measureMode);
          const wq = comp.wasteType === 'percent' ? finalV * (1 + comp.wasteValue / 100) : finalV;
          const rate = t.withWasteTotal > 0 ? (t.materialCost + t.labourCost) / t.withWasteTotal : 0;
          const desc = `${area.name} - ${comp.name}${e.label ? ` (${e.label})` : ''}${wasteNote}`;
          lines.push({ description: desc, qty: Math.round(wq * 100) / 100, unit: unitFor(comp), rate: Math.round(rate * 100) / 100 });
        }
      }
    }
    const params = new URLSearchParams();
    params.set('amount', totals.total.toFixed(2));
    if (lines.length > 0) params.set('lines', encodeURIComponent(JSON.stringify(lines)));
    params.set('ref', 'free-quote-builder');
    return `/free-quote-generator?${params.toString()}`;
  }

  return (
    <div id="print-root" className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-2 md:p-4 print:block print:static print:p-0 print:bg-white">
      <div role="dialog" aria-modal="true" aria-labelledby="fqb-results-title" className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full print:max-w-none print:overflow-visible" id="fqb-print">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 print:border-slate-300">
          <div>
            <h2 id="fqb-results-title" className="text-base md:text-lg font-semibold text-slate-900">Quote Builder Results</h2>
            <p className="text-xs text-slate-400">Generated {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <button onClick={onClose} aria-label="Close results" className="p-2 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-slate-50 print:hidden min-h-[44px] min-w-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-5 print:overflow-visible print:px-6 print:py-2">
          {areas.map(area => {
            const visible = area.components.filter(ac => ac.entries.length > 0 && compById.has(ac.componentId));
            if (visible.length === 0) return null;
            return (
              <div key={area.id} className="print:break-inside-avoid">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">{area.name}</h3>
                  {measureMode === 'plan' && area.pitchDegrees > 0 && <span className="text-xs text-slate-400">@ {area.pitchDegrees}° pitch</span>}
                </div>
                <div className="space-y-3">
                  {visible.map(ac => {
                    const comp = compById.get(ac.componentId)!;
                    const t = areaComponentTotals(ac, comp, area, measureMode);
                    return (
                      <div key={ac.id} className="rounded-xl border border-slate-100 p-3 print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-slate-800">{comp.name}</h4>
                          {t.packs > 0 && <span className="text-[10px] text-slate-400">{t.packs} packs</span>}
                        </div>
                        <div className="space-y-1 mb-2">
                          {ac.entries.map((e, idx) => {
                            const raw = entryRawValue(e, comp);
                            const finalV = entryFinalValue(e, comp, area, measureMode);
                            const pitched = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none' && raw > 0;
                            return (
                              <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs print:bg-white print:border print:border-slate-100">
                                <div className="min-w-0 flex-1">
                                  <span className="text-slate-500">{e.label || `Entry ${idx + 1}`}</span>
                                  {pitched && <span className="ml-2 text-slate-400">@ {e.pitchDegrees ?? area.pitchDegrees}°</span>}
                                  {(e.quantity || 1) > 1 && <span className="ml-2 text-slate-400">x{e.quantity}</span>}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {pitched && <span className="text-slate-400">{fmt(raw)} {unitFor(comp)}<span className="ml-1 text-slate-300">→</span></span>}
                                  <span className="font-medium text-slate-700">{fmt(finalV)} {unitFor(comp)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                          <div className="text-xs text-slate-500">
                            Subtotal{comp.wasteType === 'percent' && comp.wasteValue > 0 && <span className="ml-1">+ {comp.wasteValue}% waste</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-slate-900">{fmt(t.withWasteTotal)} {unitFor(comp)}</span>
                            {(t.materialCost + t.labourCost) > 0 && (
                              <div className="text-xs text-[#BD4A1A] font-medium">{currency}{fmt(t.materialCost + t.labourCost)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {totals.hasPricing && (
            <div className="rounded-xl bg-slate-900 text-white p-4 print:break-inside-avoid">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Estimated Total</span><span className="text-xl font-bold">{currency}{fmt(totals.total)}</span></div>
              <div className="mt-1 text-xs text-slate-400">Materials {currency}{fmt(totals.material)} · Labour {currency}{fmt(totals.labour)}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-slate-100 print:hidden">
          <div className="relative">
            <button onClick={() => setShowActions(v => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 min-h-[44px]">
              Actions
              <svg className={`w-4 h-4 transition-transform ${showActions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                  <button onClick={() => { setShowActions(false); onSaveToApp(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-orange-50/40 transition text-left border-b border-slate-100">
                    <svg className="w-4 h-4 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Save to QuoteCore+ (draft quote)
                  </button>
                  <button onClick={() => { setShowActions(false); const w = window.open(buildConvertToQuoteUrl(), '_blank', 'noopener,noreferrer'); if (w) onClose(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-orange-50/40 transition text-left border-b border-slate-100">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Continue in free quote generator
                  </button>
                  <button onClick={() => { setShowActions(false); window.print(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-orange-50/40 transition text-left border-b border-slate-100">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print / Save as PDF
                  </button>
                  <button onClick={() => { setShowActions(false); const w = window.open('/signup?ref=free-quote-builder', '_blank', 'noopener,noreferrer'); if (w) onClose(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-orange-50/40 transition text-left">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg>
                    Open QuoteCore+
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          #fqb-print { display: block !important; }
          header, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
