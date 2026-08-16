'use client';

import Link from 'next/link';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
import type { DemoFinishPayload } from './DemoWorkstation';

/**
 * Demo customer quote view.
 *
 * Renders the finished takeoff as the customer-facing quote document the
 * product produces. Quantities are computed through the REAL pricing engine
 * (applyPitchAndWaste) using the captured sample rates - pitch factors per
 * component type, fixed/percent waste - so the numbers behave exactly like
 * the product's. Clearly marked as a sample quote.
 */

type PitchType = 'rafter' | 'valley_hip' | 'none';
type WasteType = 'percent' | 'fixed' | 'none';

interface DemoRate {
  label: string;
  unit: string;
  materialRate: number;
  labourRate: number;
  pitchType: PitchType;
  wasteType: WasteType;
  wastePercent: number;
  wasteFixed: number;
}

/** Sample rates captured from the RS Roofing test library (2026-08-16).
 *  Placeholders map to their real-product replacement components. */
const SEMANTIC_RATES: Record<string, DemoRate> = {
  ridges: { label: 'Ridge (Soft Edge, Standard)', unit: 'm', materialRate: 17.98, labourRate: 12.0, pitchType: 'none', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.3 },
  hips: { label: 'Hip Flashing (Soft Edge Standard)', unit: 'm', materialRate: 19.5, labourRate: 14.0, pitchType: 'valley_hip', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.3 },
  broken_hips: { label: 'Hip Flashing (Soft Edge Standard)', unit: 'm', materialRate: 19.5, labourRate: 14.0, pitchType: 'valley_hip', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.3 },
  valleys: { label: 'Valley Flashing (Standard)', unit: 'm', materialRate: 11.0, labourRate: 5.0, pitchType: 'valley_hip', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.4 },
  barges: { label: 'Barge Flashing (Standard)', unit: 'm', materialRate: 18.5, labourRate: 11.0, pitchType: 'rafter', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.25 },
  spouting: { label: 'Spouting (Standard)', unit: 'm', materialRate: 18.0, labourRate: 11.0, pitchType: 'none', wasteType: 'fixed', wastePercent: 0, wasteFixed: 0.15 },
};

const ROOF_AREA_RATE: DemoRate = {
  label: 'Corrugate .40g roofing', unit: 'm²', materialRate: 24.0, labourRate: 8.0,
  pitchType: 'rafter', wasteType: 'percent', wastePercent: 3, wasteFixed: 0,
};

interface QuoteLine {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

const fmt = (n: number, dp = 2) => n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (n: number) => `$${fmt(n)}`;

export function DemoQuoteView({
  payload,
  onRestart,
}: {
  payload: DemoFinishPayload;
  onRestart: () => void;
}) {
  // Roof pitch: use the first roof area's pitch (demo plan is 25 degrees).
  const pitch = payload.roofAreas[0]?.pitch ?? 25;

  const lines: QuoteLine[] = [];

  // Roof areas: plan m² -> pitch-adjusted m² -> waste, priced per m².
  for (const ra of payload.roofAreas) {
    const r = applyPitchAndWaste(ra.area, true, ROOF_AREA_RATE.pitchType, ra.pitch || pitch, ROOF_AREA_RATE.wasteType, ROOF_AREA_RATE.wastePercent, ROOF_AREA_RATE.wasteFixed);
    const rate = ROOF_AREA_RATE.materialRate + ROOF_AREA_RATE.labourRate;
    lines.push({
      key: `area-${ra.id}`,
      label: `${ra.name} - ${ROOF_AREA_RATE.label} (pitch ${ra.pitch || pitch}°)`,
      quantity: r.afterWaste,
      unit: ROOF_AREA_RATE.unit,
      rate,
      total: r.afterWaste * rate,
    });
  }

  // Component groups keyed by semantic replacement rates.
  for (const g of payload.componentGroups) {
    if (g.count === 0 || g.semantic == null || !(g.semantic in SEMANTIC_RATES)) continue;
    const rate = SEMANTIC_RATES[g.semantic];
    const r = applyPitchAndWaste(g.total, true, rate.pitchType, pitch, rate.wasteType, rate.wastePercent, rate.wasteFixed);
    const unitRate = rate.materialRate + rate.labourRate;
    lines.push({
      key: g.componentId,
      label: `${rate.label} (${g.count} × ${fmt(g.total)} m measured)`,
      quantity: r.afterWaste,
      unit: rate.unit,
      rate: unitRate,
      total: r.afterWaste * unitRate,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const today = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });

  if (lines.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center max-w-md">
          <p className="text-sm text-slate-500">No measurements on the canvas yet - measure something first.</p>
          <button onClick={onRestart} className="mt-4 px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
            Back to demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Quote document */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">QuoteCore<span className="text-[#BD4A1A]">+</span></span>
              </div>
              <p className="mt-1 text-sm text-slate-500">RS Roofing (demo company)</p>
              <p className="text-xs text-slate-400 mt-1">Prepared for John Smith</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sample quote</p>
              <p className="text-lg font-semibold text-slate-900">#{1015}</p>
              <p className="text-xs text-slate-400 mt-1">{today}</p>
            </div>
          </div>

          {/* Summary strip */}
          <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Roof area</p>
              <p className="text-sm font-semibold text-slate-900">
                {fmt(payload.roofAreas.reduce((s, ra) => s + ra.area, 0))} m² plan · {fmt(payload.roofAreas.reduce((s, ra) => s + ra.area, 0) / Math.cos((pitch * Math.PI) / 180))} m² at {pitch}°
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Components measured</p>
              <p className="text-sm font-semibold text-slate-900">{payload.componentGroups.reduce((s, g) => s + g.count, 0)} lines</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total (incl. GST)</p>
              <p className="text-sm font-semibold text-slate-900">{money(total)}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="pb-3 font-medium">Item</th>
                  <th className="pb-3 font-medium text-right">Qty</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="py-3 pr-4 text-slate-700">{l.label}</td>
                    <td className="py-3 text-right text-slate-700 whitespace-nowrap">{fmt(l.quantity)} {l.unit}</td>
                    <td className="py-3 text-right text-slate-500 whitespace-nowrap">{money(l.rate)} / {l.unit}</td>
                    <td className="py-3 text-right font-medium text-slate-900 whitespace-nowrap">{money(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-6 ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>GST (15%)</span><span>{money(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span><span>{money(total)}</span>
              </div>
            </div>

            <p className="mt-8 text-xs text-slate-400 leading-relaxed">
              Sample quote generated from your demo measurements. Quantities are pitch-adjusted
              using QuoteCore+ takeoff calculations with sample material and labour rates.
              This is a demonstration document, not a binding quote.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900">This quote took 60 seconds.</h2>
          <p className="mt-2 text-sm text-slate-500">
            Measure plans, scan with AI, price components and send branded quotes - from one workspace.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup?source=takeoff-demo"
              className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Create your free account
            </Link>
            <button onClick={onRestart} className="px-5 py-3 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
              Restart demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
