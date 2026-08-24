'use client';

import { useEffect, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { areaComponentTotals, entryFinalValue, entryRawValue, grandTotals, fmt } from './calc';

interface OutputViewProps {
  areas: ParentArea[];
  components: BuilderComponent[];
  measureMode: MeasureMode;
  unitSystem: UnitSystem;
  currency: string;
  onBackToBuilder: () => void;
  onRestart: () => void;
  onSaveToApp: () => void;
  saving: boolean;
  saveError: string | null;
}

/** Output phase - same structure as the Free Roof Takeoff output view:
 * a full report page (not a modal) with print styles, and primary actions
 * Save to QuoteCore+ / Convert to free quote generator / Print / PDF. */
export default function OutputView({ areas, components, measureMode, unitSystem, currency, onBackToBuilder, onRestart, onSaveToApp, saving, saveError }: OutputViewProps) {
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const compById = new Map(components.map(c => [c.id, c]));
  const len = unitSystem === 'metric' ? 'm' : 'ft';
  const areaU = unitSystem === 'metric' ? 'm\u00B2' : unitSystem === 'imperial' ? 'sq ft' : 'squares';
  const totals = grandTotals(areas, components, measureMode);
  const unitName = unitSystem === 'metric' ? 'Metric' : unitSystem === 'imperial' ? 'Imperial' : 'Roofing Squares';

  useEffect(() => {
    if (saving) setSaveMsg('Saving to your account...');
    else if (saveError) setSaveMsg(saveError);
    else setSaveMsg(null);
  }, [saving, saveError]);

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

  const entryCount = areas.reduce((s, a) => s + a.components.reduce((s2, ac) => s2 + ac.entries.length, 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-2 md:px-6 py-6 md:py-10 bg-white min-h-screen">
      <div id="fqb-print" className="print:visible">
        {/* Header - same structure as takeoff output */}
        <div className="flex items-center justify-between px-0 md:px-0 pb-4 border-b border-slate-100 print:border-slate-300">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Quote Builder Report</h1>
            <p className="mt-1 text-xs text-slate-400">
              Generated {new Date().toLocaleDateString('en-GB')} · {unitName} · {measureMode === 'actual' ? 'Actual measurements' : 'Plan measurements (pitch applied)'} · {entryCount} entries
            </p>
          </div>
          <button onClick={onRestart} className="print:hidden text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">
            Start over
          </button>
        </div>

        {/* Areas / components / entries */}
        <div className="mt-5 space-y-5 print:mt-2">
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
        </div>

        {totals.hasPricing && (
          <div className="mt-5 rounded-xl bg-slate-900 text-white p-4 print:break-inside-avoid">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">Estimated Total</span><span className="text-xl font-bold">{currency}{fmt(totals.total)}</span></div>
            <div className="mt-1 text-xs text-slate-400">Materials {currency}{fmt(totals.material)} · Labour {currency}{fmt(totals.labour)}</div>
          </div>
        )}
      </div>

      {/* Actions - same pattern as takeoff output: back to builder + primary CTA row */}
      <div className="mt-6 pt-4 border-t border-slate-100 print:hidden space-y-3">
        {saveMsg && <p className="text-xs text-slate-500 text-center">{saveMsg}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSaveToApp}
            disabled={saving}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
          >
            Save to QuoteCore+ (draft quote)
          </button>
          <a
            href={buildConvertToQuoteUrl()}
            className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#A03E15]"
          >
            Convert to quote
          </a>
          <button onClick={() => window.print()} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 transition">
            Print / Save as PDF
          </button>
        </div>
        <button onClick={onBackToBuilder} className="text-xs text-slate-400 hover:text-slate-600 transition">
          ← Back to builder
        </button>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          header, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
