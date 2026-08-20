'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { applyPitchAndWaste, hipValleyPitchFactor } from '@/app/lib/pricing/engine';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';
import type { TakeoffUnitSystem } from './tradeConfig';

/**
 * Free Roof Takeoff output view.
 *
 * Renders the finished takeoff as a clean MEASUREMENT report (not a quote):
 * every roof area with plan + pitch-adjusted area, and EVERY measurement
 * entry per component (not just totals). Quantities go through the REAL
 * pricing engine (applyPitchAndWaste) so pitch factors match the app.
 * Unit-aware: metric (m / m2), imperial (ft / ft2), roofing squares
 * (lineal ft + areas in squares).
 */

export interface TakeoffOutputExtras {
  planDataUrl: string;
  elapsedMs: number;
}

const FT2_PER_M2 = 10.7639104;
const SQM_PER_SQ = 9.290304; // 1 roofing square = 100 ft2

/** Format a raw (already-in-unit) number. */
const fmt = (n: number, dp = 2) => n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });

interface AreaRow {
  key: string;
  name: string;
  planArea: number;
  pitch: number;
  pitchedArea: number;
}

interface ComponentRow {
  key: string;
  name: string;
  count: number;
  total: number;
  measurementType?: string;
  entries: { value: number }[];
  semantic: string | null;
}

const HIP_SEMANTICS = ['hips', 'broken_hips'];
const VALLEY_SEMANTICS = ['valleys'];

function isHipOrValley(row: ComponentRow): boolean {
  if (row.semantic && (HIP_SEMANTICS.includes(row.semantic) || VALLEY_SEMANTICS.includes(row.semantic))) return true;
  const n = row.name.toLowerCase();
  return n.startsWith('hip') || n.startsWith('valley');
}

export function TakeoffOutputView({
  payload,
  extras,
  unitSystem = 'metric',
  onRestart,
  onBackToCanvas,
}: {
  payload: DemoFinishPayload;
  extras: TakeoffOutputExtras;
  /** Chosen in the landing wizard. Falls back to the calibration unit. */
  unitSystem?: TakeoffUnitSystem;
  onRestart: () => void;
  onBackToCanvas: () => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  // Determine the display system: explicit choice first, else infer from calibration.
  const calibUnit = payload.calibrationUnit;
  const system: TakeoffUnitSystem =
    unitSystem ?? (calibUnit === 'feet' ? 'imperial' : 'metric');

  // Raw measurements arrive in the calibration length unit (m or ft).
  const lengthsInFeet = calibUnit === 'feet';
  const L = lengthsInFeet ? 'ft' : 'm';

  // Area conversions from raw (m2 or ft2) to the display unit.
  const toDisplayArea = (rawArea: number): number => {
    // rawArea is in lengthUnit^2 (m2 if meters, ft2 if feet)
    const m2 = lengthsInFeet ? rawArea / FT2_PER_M2 : rawArea;
    if (system === 'metric') return m2;
    const ft2 = m2 * FT2_PER_M2;
    return system === 'squares' ? ft2 / 100 : ft2;
  };
  const areaUnitLabel = system === 'metric' ? 'm\u00b2' : system === 'squares' ? 'sq' : 'ft\u00b2';
  const areaUnitSup = system === 'metric' ? 'm\u00b2' : system === 'squares' ? 'squares' : 'ft\u00b2';

  const areas: AreaRow[] = useMemo(
    () =>
      payload.roofAreas.map(ra => {
        const r = applyPitchAndWaste(ra.area, true, 'rafter', ra.pitch || 0, 'none', 0, 0);
        return { key: ra.id, name: ra.name, planArea: toDisplayArea(ra.area), pitch: ra.pitch, pitchedArea: toDisplayArea(r.afterWaste) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, system, calibUnit],
  );

  const components: ComponentRow[] = useMemo(
    () =>
      payload.componentGroups
        .filter(g => g.count > 0)
        .map(g => ({
          key: g.componentId,
          name: g.name,
          count: g.count,
          total: g.total,
          measurementType: g.measurementType,
          entries: g.measurements,
          semantic: g.semantic,
        })),
    [payload],
  );

  const totalPlanArea = areas.reduce((s, a) => s + a.planArea, 0);
  const totalPitchedArea = areas.reduce((s, a) => s + a.pitchedArea, 0);

  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasMeasurements = areas.length > 0 || components.length > 0;

  /** Persist the takeoff as a server-side draft (free_document_drafts,
   *  draft_type='takeoff') and send the user to signup/app with the draft
   *  id - the app restores it into the quote-builder stage after signup. */
  const handleSendToApp = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/free-tools/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftType: 'takeoff',
          payload: {
            tool: 'free-roof-takeoff',
            unit: payload.calibrationUnit,
            unitSystem: system,
            roofAreas: payload.roofAreas,
            componentGroups: payload.componentGroups.map(g => ({
              componentId: g.componentId,
              name: g.name,
              isSystem: g.isSystem,
              semantic: g.semantic,
              count: g.count,
              total: g.total,
              measurementType: g.measurementType,
              measurements: g.measurements,
            })),
            savedAt: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const json = await res.json();
      setSavedDraftId(json.id);
      setSaveState('saved');
      // Hand off to the app signup with the draft id in the URL chain.
      const appOrigin = window.location.hostname.endsWith('.quote-core.com')
        ? 'https://app.quote-core.com'
        : '';
      window.location.href = `${appOrigin}/signup?ref=free-roof-takeoff&draft=${json.id}`;
    } catch {
      setSaveState('error');
    }
  };

  if (!hasMeasurements) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center max-w-md">
          <p className="text-sm text-slate-500">No measurements on the canvas yet - measure something first.</p>
          <button onClick={onBackToCanvas} className="mt-4 px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
            Back to the canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Takeoff report - clean measurement document, same format the app
            hands to the quote builder. */}
        <div id="takeoff-report" className="bg-white rounded-xl border border-black p-8 md:p-12 space-y-8">
          <div className="border-b-2 border-black pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MainQCP.png" alt="QuoteCore+ Roofing" className="h-14 object-contain" />
            <h1 className="mt-4 text-xl font-bold text-black">ROOF TAKEOFF REPORT</h1>
            <p className="mt-1 text-sm text-black">Generated {today} - QuoteCore+ free digital takeoff</p>
            <p className="mt-1 text-xs text-black/60">
              Measurement units: {system === 'squares' ? 'Roofing squares (areas) / feet (lengths)' : system === 'imperial' ? 'Imperial (ft / ft\u00b2)' : 'Metric (m / m\u00b2)'}
            </p>
          </div>

          {/* Roof areas - every entry */}
          {areas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Roof Areas</h2>
              <div className="mt-3 space-y-2">
                {areas.map(a => (
                  <div key={a.key} className="flex items-center justify-between py-2 border-b border-black/10">
                    <span className="text-black">{a.name} - pitch {fmt(a.pitch, 0)}&deg;</span>
                    <span className="text-black font-medium whitespace-nowrap">
                      {fmt(a.planArea)} {areaUnitLabel} plan &middot; {fmt(a.pitchedArea)} {areaUnitLabel} pitched
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-semibold">
                  <span className="text-black">Total roof area</span>
                  <span className="text-black whitespace-nowrap">
                    {fmt(totalPlanArea)} {areaUnitLabel} plan &middot; {fmt(totalPitchedArea)} {areaUnitLabel} pitched
                  </span>
                </div>
                {system === 'squares' && (
                  <p className="text-xs text-black/60">1 square = 100 ft&sup2;</p>
                )}
              </div>
            </div>
          )}

          {/* Components - EVERY entry listed individually, then the group total */}
          {components.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Components</h2>
              <div className="mt-3 space-y-4">
                {components.map(c => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-black font-semibold">{c.name}</span>
                      <span className="text-black font-semibold whitespace-nowrap">
                        {c.measurementType === 'quantity' ? `${c.count} ea` : `${fmt(c.total)} ${c.measurementType === 'area' ? areaUnitLabel : L}`}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {c.entries.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-1 pl-4 text-sm border-b border-black/5">
                          <span className="text-black/70">
                            Entry {i + 1}{isHipOrValley(c) && c.measurementType !== 'area' && c.measurementType !== 'quantity' ? ' (plan length)' : ''}
                          </span>
                          <span className="text-black/80 whitespace-nowrap">
                            {c.measurementType === 'quantity' ? '1 ea' : `${fmt(m.value)} ${c.measurementType === 'area' ? areaUnitLabel : L}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-black">
            <p className="text-sm text-black italic">
              Measurements taken with the QuoteCore+ digital takeoff system. Pitched areas use the rafter
              pitch factor for each area. Hip and valley entries are shown as plan lengths - the system
              calculates the hip/valley pitch (and therefore true hip/valley lengths) from the roof pitch
              entered for each area. Send this takeoff into QuoteCore+ to price it with your own
              component rates and turn it into a quote.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Your takeoff is ready.</h2>
          <p className="mt-2 text-sm text-slate-500">
            Price it with your own rates, save it, and turn it into a customer quote - the exact
            measurements above carry straight into the QuoteCore+ quote builder.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleSendToApp}
              disabled={saveState === 'saving' || saveState === 'saved'}
              className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
            >
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved - redirecting...' : 'Send to QuoteCore+ and price it'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-3 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
            >
              Print / Save PDF
            </button>
            <button onClick={onRestart} className="px-5 py-3 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
              New takeoff
            </button>
          </div>
          {saveState === 'error' && (
            <p className="mt-3 text-sm text-[#BD4A1A]">Could not save your takeoff right now - please try again.</p>
          )}
          {savedDraftId && (
            <p className="mt-3 text-xs text-slate-400">Draft saved ({savedDraftId.slice(0, 8)}...). Complete sign up to open it.</p>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-slate-600">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
