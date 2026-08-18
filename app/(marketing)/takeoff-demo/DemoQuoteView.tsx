'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
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

/** Rates keyed by user-library component IDs (manual-measure components).
 *  Manual drawings use the library rows the user picked; AI scans use the
 *  system placeholder rows (resolved via SEMANTIC_RATES). */
const COMPONENT_RATES: Record<string, DemoRate> = {
  '881aa963-1209-4344-9cf7-b1da84ff3c55': SEMANTIC_RATES.ridges,   // Ridge (Soft Edge, Standard)
  '8d94451a-75ff-4b1f-bc45-057bcdd75c48': SEMANTIC_RATES.hips,      // Hip Flashing (Soft Edge Standard)
  '3536e596-2103-4af5-861f-48d38fb24614': SEMANTIC_RATES.valleys,   // Valley Flashing (Standard)
  '74c2e3dc-b95e-45d3-930a-2c5facba572a': SEMANTIC_RATES.barges,    // Barge Flashing (Standard)
  'cf898e6b-f6d0-4330-a7b9-e5bcf41b6acf': SEMANTIC_RATES.spouting,  // Spouting (Standard)
  '916eac91-f744-4a3f-888f-a7bed643c160': ROOF_AREA_RATE,           // Corrugate .40g (area)
  '44698955-f141-4eb3-8652-23d1d2efbbb1': { ...ROOF_AREA_RATE, label: 'Rubber Membrane Roofing' },
  '5c5a49a0-5dee-4d33-add3-7f357e2162e7': {
    label: 'Tek Screws (50mm)', unit: 'ea', materialRate: 1.5, labourRate: 0,
    pitchType: 'none', wasteType: 'none', wastePercent: 0, wasteFixed: 0,
  },
};

/** Name-based fallback so a manual component can never be silently dropped
 *  from the quote (IDs live in baseline.ts; this catches drift). */
function rateForComponent(g: DemoFinishPayload['componentGroups'][number]): DemoRate | null {
  const byId = COMPONENT_RATES[g.componentId];
  if (byId) return byId;
  if (g.semantic != null && g.semantic in SEMANTIC_RATES) return SEMANTIC_RATES[g.semantic];
  const name = g.name.toLowerCase();
  if (name.startsWith('ridge')) return SEMANTIC_RATES.ridges;
  if (name.startsWith('hip')) return SEMANTIC_RATES.hips;
  if (name.startsWith('valley')) return SEMANTIC_RATES.valleys;
  if (name.startsWith('barge')) return SEMANTIC_RATES.barges;
  if (name.startsWith('spouting')) return SEMANTIC_RATES.spouting;
  if (name.startsWith('corrugate')) return ROOF_AREA_RATE;
  return null;
}

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
  elapsedMs,
  onRestart,
}: {
  payload: DemoFinishPayload;
  /** Real time from clicking Scan/Manual to reaching this screen. */
  elapsedMs: number;
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

  // Component groups: rate by user-library component ID first (manual draws),
  // then by AI semantic key (system placeholder components).
  for (const g of payload.componentGroups) {
    if (g.count === 0) continue;
    const rate = rateForComponent(g);
    if (!rate) continue;
    const r = applyPitchAndWaste(g.total, true, rate.pitchType, pitch, rate.wasteType, rate.wastePercent, rate.wasteFixed);
    const unitRate = rate.materialRate + rate.labourRate;
    lines.push({
      key: g.componentId,
      label: `${rate.label} (${g.count} × ${fmt(g.total)} ${rate.unit} measured)`,
      quantity: r.afterWaste,
      unit: rate.unit,
      rate: unitRate,
      total: r.afterWaste * unitRate,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const [endModalOpen, setEndModalOpen] = useState(false);

  // End-of-demo modal: auto-open once per browser session on first reaching
  // the quote view. Dismissible, non-blocking.
  useEffect(() => {
    if (lines.length === 0) return;
    try {
      if (sessionStorage.getItem('qc_demo_end_modal_seen') === '1') return;
      sessionStorage.setItem('qc_demo_end_modal_seen', '1');
    } catch {
      // sessionStorage unavailable (private mode) - still show once per mount
    }
    const t = setTimeout(() => {
      setEndModalOpen(true);
      trackEvent('demo_end_modal_view');
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });

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
      <div className="mx-auto max-w-4xl">
        {/* Quote document - 1:1 mirror of the real customer-facing accept view
            (app/accept/[token]). Line data comes from the user's canvas. */}
        <div id="demo-quote-document" className="bg-white rounded-xl border border-black p-8 md:p-12 space-y-8">
          {/* Quote Header */}
          <div className="border-b-2 border-black pb-6 mb-6">
            {/* Logo (Top Right) */}
            <div className="flex justify-end mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/MainQCP.png" alt="QuoteCore+ Roofing" className="h-16 object-contain" />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h1 className="text-xl font-bold text-black mb-4">QUOTE #1015</h1>
                <div className="space-y-2">
                  <p className="text-base text-black"><span className="font-semibold">Client:</span> John Doe</p>
                  <p className="text-base text-black"><span className="font-semibold">Job:</span> Roof replacement</p>
                  <p className="text-base text-black"><span className="font-semibold">Site:</span> 42 Kowhai Lane, Auckland 1025</p>
                  <p className="text-base text-black"><span className="font-semibold">Date:</span> {today}</p>
                  <p className="text-base text-black">
                    <span className="font-semibold">Valid until:</span> {validUntil}
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      30 days remaining
                    </span>
                  </p>
                </div>
              </div>

              {/* Company Details */}
              <div className="text-right space-y-1 sm:text-right">
                <p className="font-semibold text-base text-black">QuoteCore+ Roofing</p>
                <p className="text-sm text-black">18 Rimu Street, Auckland 1010</p>
                <p className="text-sm text-black">09 555 0142</p>
                <p className="text-sm text-black">quotes@quotecore-roofing.co.nz</p>
              </div>
            </div>
          </div>

          {/* Line Items - same two-column format as the accept view. The
              description folds in the measured quantity so the numbers the
              user produced on the canvas are visible in the document. */}
          <div className="space-y-3">
            {lines.map(l => (
              <div key={l.key} className="flex items-start justify-between py-3 border-b border-black">
                <div className="flex-1">
                  <p className="text-black">{l.label} - {fmt(l.quantity)} {l.unit}</p>
                </div>
                <div className="ml-4">
                  <p className="text-black font-medium whitespace-nowrap">{money(l.total)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-3 pt-4 border-t-2 border-black">
            <div className="flex justify-between text-base">
              <span className="text-black">Subtotal</span>
              <span className="font-medium text-black">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-black">GST (15%)</span>
              <span className="font-medium text-black">{money(tax)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
              <span className="text-black">Total</span>
              <span className="text-black">{money(total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-black">
            <p className="text-sm text-black italic whitespace-pre-wrap">
              Prices are in NZD and include GST. This quote is valid for 30 days from the date above.
              Payment is due within 7 days of job completion. Sample quote generated by the QuoteCore+
              interactive demo - quantities come from your own measurements on the demo plan.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 text-center">          {(() => {
            const secs = Math.max(1, Math.round(elapsedMs / 1000));
            const timeLabel =
              secs < 60
                ? `${secs} second${secs !== 1 ? 's' : ''}`
                : `${Math.round(secs / 60)} minute${secs >= 120 ? 's' : ''}`;
            return (
              <>
                <h2 className="text-xl font-semibold text-slate-900">This quote took you {timeLabel}.</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Including the guided tour. Sign up for free and try it on your own plans - 14-day trial, no card needed.
                </p>
              </>
            );
          })()}
          <p className="mt-3 text-sm text-slate-500">
            Measure plans, scan with AI, price components and send branded quotes - from one workspace.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/free-trial?utm_source=takeoff-demo&utm_medium=demo&utm_campaign=trial"
              onClick={() => trackEvent('trial_click', { source: 'takeoff-demo', stage: 'quote-view' })}
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

      {/* End-of-demo modal: shown once per session */}
      {endModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40" role="dialog" aria-modal="true" aria-labelledby="demo-end-modal-heading">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEndModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h2 id="demo-end-modal-heading" className="text-xl font-semibold text-slate-900">
              That&apos;s the fast version 🎉
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You just used our real digital takeoff system — the canvas you measured on is exactly what&apos;s in the app.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              To keep the demo quick and easy, we pre-loaded the component library and skipped straight to the finished quote. In the full app, you can create as many components as you want with your own rules and pricing, and fully edit the quote before you send it.
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-900">You can do all of that right now, for free.</p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/free-trial?utm_source=takeoff-demo&utm_medium=demo&utm_campaign=demo-end-modal"
                onClick={() => trackEvent('trial_click', { source: 'takeoff-demo', stage: 'end-modal' })}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
              >
                Start free trial
              </Link>
              <Link
                href="/#how-it-works"
                onClick={() => trackEvent('demo_end_modal_cta', { target: 'how-it-works' })}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                See how the full workflow works
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
