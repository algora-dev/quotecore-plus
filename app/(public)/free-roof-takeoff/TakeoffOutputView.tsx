'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';

/**
 * Free Roof Takeoff output view.
 *
 * Renders the finished takeoff as a clean MEASUREMENT report (not a quote):
 * roof areas with plan + pitch-adjusted m2, and line lengths per component.
 * Quantities go through the REAL pricing engine (applyPitchAndWaste) so the
 * pitch factors match the app exactly. The user can then send the takeoff
 * into the app as a draft (quote-builder stage) or print/save the report.
 */

export interface TakeoffOutputExtras {
  planDataUrl: string;
  elapsedMs: number;
}

const fmt = (n: number, dp = 2) => n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });

interface AreaRow {
  key: string;
  name: string;
  planM2: number;
  pitch: number;
  pitchM2: number;
}

interface ComponentRow {
  key: string;
  name: string;
  count: number;
  total: number;
  unit: 'm';
}

export function TakeoffOutputView({
  payload,
  extras,
  onRestart,
  onBackToCanvas,
}: {
  payload: DemoFinishPayload;
  extras: TakeoffOutputExtras;
  onRestart: () => void;
  onBackToCanvas: () => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  const areas: AreaRow[] = useMemo(
    () =>
      payload.roofAreas.map(ra => {
        const r = applyPitchAndWaste(ra.area, true, 'rafter', ra.pitch || 0, 'none', 0, 0);
        return { key: ra.id, name: ra.name, planM2: ra.area, pitch: ra.pitch, pitchM2: r.afterWaste };
      }),
    [payload],
  );

  const components: ComponentRow[] = useMemo(
    () =>
      payload.componentGroups
        .filter(g => g.count > 0)
        .map(g => ({ key: g.componentId, name: g.name, count: g.count, total: g.total, unit: 'm' as const })),
    [payload],
  );

  const totalPlanM2 = areas.reduce((s, a) => s + a.planM2, 0);
  const totalPitchM2 = areas.reduce((s, a) => s + a.pitchM2, 0);

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
          </div>

          {/* Roof areas */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Roof Areas</h2>
            <div className="mt-3 space-y-2">
              {areas.map(a => (
                <div key={a.key} className="flex items-center justify-between py-2 border-b border-black/10">
                  <span className="text-black">{a.name} - pitch {fmt(a.pitch, 0)}&deg;</span>
                  <span className="text-black font-medium whitespace-nowrap">
                    {fmt(a.planM2)} m&sup2; plan &middot; {fmt(a.pitchM2)} m&sup2; pitched
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 font-semibold">
                <span className="text-black">Total roof area</span>
                <span className="text-black whitespace-nowrap">
                  {fmt(totalPlanM2)} m&sup2; plan &middot; {fmt(totalPitchM2)} m&sup2; pitched
                </span>
              </div>
            </div>
          </div>

          {/* Components */}
          {components.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Components</h2>
              <div className="mt-3 space-y-2">
                {components.map(c => (
                  <div key={c.key} className="flex items-center justify-between py-2 border-b border-black/10">
                    <span className="text-black">{c.name} ({c.count} {c.count === 1 ? 'length' : 'lengths'})</span>
                    <span className="text-black font-medium whitespace-nowrap">{fmt(c.total)} m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-black">
            <p className="text-sm text-black italic">
              Measurements taken with the QuoteCore+ digital takeoff system. Pitched areas use the rafter
              pitch factor for each area. Send this takeoff into QuoteCore+ to price it with your own
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
