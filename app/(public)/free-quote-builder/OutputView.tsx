'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { areaComponentTotals, entryFinalValue, entryRawValue, fmt } from './calc';

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

/** Output phase - exact same report format as the Free Roof Takeoff tool
 * (TakeoffOutputView): clean measurement document with black border, logo
 * header, areas table, areas & components with every entry (plan -> pitched
 * -> incl waste), footer note, then the actions card. */
export default function OutputView({ areas, components, measureMode, unitSystem, currency, onBackToBuilder, onRestart, onSaveToApp, saving, saveError }: OutputViewProps) {
  const compById = new Map(components.map(c => [c.id, c]));
  const L = unitSystem === 'metric' ? 'm' : 'ft';
  const areaUnitLabel = unitSystem === 'metric' ? 'm\u00b2' : unitSystem === 'squares' ? 'sq' : 'ft\u00b2';
  const systemName = unitSystem === 'squares' ? 'Roofing squares (areas) / feet (lengths)' : unitSystem === 'imperial' ? 'Imperial (ft / ft\u00b2)' : 'Metric (m / m\u00b2)';
  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });

  const lenLabelFor = (comp: BuilderComponent) => (comp.measurementType === 'area' ? areaUnitLabel : L);

  function buildConvertToQuoteUrl(): string {
    const lines: { description: string; qty: number; unit: string; rate: number }[] = [];
    let total = 0;
    for (const area of areas) {
      for (const ac of area.components) {
        const comp = compById.get(ac.componentId);
        if (!comp || ac.entries.length === 0) continue;
        const t = areaComponentTotals(ac, comp, area, measureMode);
        total += t.materialCost + t.labourCost;
        const wasteNote = comp.wasteType === 'percent' && comp.wasteValue > 0 ? ` (+${comp.wasteValue}% waste)` : '';
        for (const e of ac.entries) {
          const finalV = entryFinalValue(e, comp, area, measureMode);
          const wq = comp.wasteType === 'percent' ? finalV * (1 + comp.wasteValue / 100) : finalV;
          const rate = t.withWasteTotal > 0 ? (t.materialCost + t.labourCost) / t.withWasteTotal : 0;
          lines.push({ description: `${area.name} - ${comp.name}${e.label ? ` (${e.label})` : ''}${wasteNote}`, qty: Math.round(wq * 100) / 100, unit: comp.measurementType === 'quantity' ? 'pcs' : lenLabelFor(comp), rate: Math.round(rate * 100) / 100 });
        }
      }
    }
    const params = new URLSearchParams();
    params.set('amount', total.toFixed(2));
    if (lines.length > 0) params.set('lines', encodeURIComponent(JSON.stringify(lines)));
    params.set('ref', 'free-quote-builder');
    return `/free-quote-generator?${params.toString()}`;
  }

  const hasMeasurements = areas.some(a => a.components.some(ac => ac.entries.length > 0));

  if (!hasMeasurements) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center max-w-md">
          <p className="text-sm text-slate-500">No entries yet - add some measurements first.</p>
          <button onClick={onBackToBuilder} className="mt-4 px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
            Back to the builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Report - clean measurement document, same format as the Free Roof
            Takeoff report. */}
        <div id="fqb-report" className="bg-white rounded-xl border border-black p-8 md:p-12 space-y-8">
          <div className="border-b-2 border-black pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MainQCP.png" alt="QuoteCore+" className="h-14 object-contain" />
            <h1 className="mt-4 text-xl font-bold text-black">QUOTE BUILDER REPORT</h1>
            <p className="mt-1 text-sm text-black">Generated {today} - QuoteCore+ free quote builder</p>
            <p className="mt-1 text-xs text-black/60">
              Measurement units: {systemName} &middot; {measureMode === 'actual' ? 'Actual measurements' : 'Plan measurements with pitch applied'}
            </p>
          </div>

          {/* Areas summary - every area with pitch */}
          {areas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Areas</h2>
              <div className="mt-3 space-y-2">
                {areas.map(a => {
                  const entryCount = a.components.reduce((s, ac) => s + ac.entries.length, 0);
                  return (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-black/10">
                      <span className="text-black">{a.name}{measureMode === 'plan' && a.pitchDegrees > 0 ? ` - pitch ${fmt(a.pitchDegrees, 0)}\u00b0` : ''}</span>
                      <span className="text-black font-medium whitespace-nowrap">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Areas & components: each area is a clear heading, its components
              sit underneath, every entry shown (plan -> pitched -> incl waste). */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Areas &amp; Components</h2>
            <div className="mt-3 space-y-6">
              {areas.map(a => {
                const groupsHere = a.components.filter(ac => ac.entries.length > 0 && compById.has(ac.componentId));
                if (groupsHere.length === 0) return null;
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between bg-black/5 border-b-2 border-black px-3 py-2">
                      <span className="text-black font-bold">{a.name} {measureMode === 'plan' && a.pitchDegrees > 0 ? <span className="font-medium">- pitch {fmt(a.pitchDegrees, 0)}&deg;</span> : null}</span>
                    </div>
                    <div className="pl-6 pt-2 space-y-3">
                      {groupsHere.map(ac => {
                        const comp = compById.get(ac.componentId)!;
                        const t = areaComponentTotals(ac, comp, a, measureMode);
                        const planTotal = ac.entries.reduce((s, e) => s + entryRawValue(e, comp), 0);
                        const anyPitched = ac.entries.some(e => measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none');
                        return (
                          <div key={ac.id}>
                            <div className="flex items-center justify-between pb-1">
                              <span className="text-black font-semibold">{comp.name}</span>
                              <span className="text-black font-semibold whitespace-nowrap text-sm">
                                {comp.measurementType === 'quantity'
                                  ? `${ac.entries.length} ea`
                                  : `${fmt(planTotal)} ${lenLabelFor(comp)}${measureMode === 'plan' ? ' plan' : ''}`}
                                {anyPitched && (
                                  <span className="ml-2 text-black/70 font-medium">&rarr; {fmt(t.finalTotal)} {lenLabelFor(comp)} pitched</span>
                                )}
                                {comp.wasteType === 'percent' && comp.wasteValue > 0 && (
                                  <span className="ml-2 text-black/70 font-medium">&middot; {fmt(t.withWasteTotal)} {lenLabelFor(comp)} incl waste</span>
                                )}
                                {(t.materialCost + t.labourCost) > 0 && <span className="ml-2">&middot; ${fmt(t.materialCost + t.labourCost)}</span>}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              {ac.entries.map((e, i) => {
                                const raw = entryRawValue(e, comp);
                                const finalV = entryFinalValue(e, comp, a, measureMode);
                                const pitched = measureMode === 'plan' && comp.pitchEnabled && comp.pitchType !== 'none' && raw > 0;
                                const afterWaste = comp.wasteType === 'percent' ? finalV * (1 + comp.wasteValue / 100) : null;
                                return (
                                  <div key={e.id} className="flex items-center justify-between py-1 pl-4 text-sm border-b border-black/5">
                                    <span className="text-black/70">{e.label || `Entry ${i + 1}`}</span>
                                    <span className="text-black/80 whitespace-nowrap">
                                      {comp.measurementType === 'quantity'
                                        ? `${e.quantity || 1} ea`
                                        : afterWaste != null
                                          ? `${fmt(raw)} ${lenLabelFor(comp)} plan \u2192 ${fmt(finalV)} ${lenLabelFor(comp)} pitched \u2192 ${fmt(afterWaste)} ${lenLabelFor(comp)} incl waste`
                                          : pitched
                                            ? `${fmt(raw)} ${lenLabelFor(comp)} plan \u2192 ${fmt(finalV)} ${lenLabelFor(comp)} pitched`
                                            : `${fmt(raw)} ${lenLabelFor(comp)}`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-black">
            <p className="text-sm text-black italic">
              Measurements entered with the QuoteCore+ free quote builder. Plan measurements are adjusted
              using each area&apos;s pitch factor (rafter for areas and barges, hip &amp; valley for hips and
              valleys). Send this into QuoteCore+ to price it with your own rates and turn it into a quote.
            </p>
          </div>
        </div>

        {/* Actions - same card as the Free Roof Takeoff output */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Your quote builder results are ready.</h2>
          <p className="mt-2 text-sm text-slate-500">
            Price it with your own rates, save it, and turn it into a customer quote - the exact
            measurements above carry straight into the QuoteCore+ quote builder.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSaveToApp}
              disabled={saving}
              className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save my results - they come with you'}
            </button>
            <a
              href={buildConvertToQuoteUrl()}
              className="px-6 py-3 text-sm font-semibold rounded-full bg-[#FF6B35] text-white transition hover:bg-[#A03E15]"
            >
              Continue in free quote generator
            </a>
            <button
              onClick={() => window.print()}
              className="px-5 py-3 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
            >
              Print / Save PDF
            </button>
            <button onClick={onRestart} className="px-5 py-3 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
              Start over
            </button>
          </div>
          {saveError && (
            <p className="mt-3 text-sm text-[#BD4A1A]">Could not save your results right now - please try again.</p>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-slate-600">Log in</Link>
            {' '}&middot;{' '}
            <button onClick={onBackToBuilder} className="underline hover:text-slate-600">Back to the builder</button>
          </p>
        </div>
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
