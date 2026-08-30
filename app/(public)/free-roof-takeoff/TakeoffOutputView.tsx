'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { buildConvertUrl } from '../shared/convertLines';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
import { getStoredPitchMode } from '@/app/components/PitchInput';
import { fromDegrees } from '@/app/lib/pitch-inputs';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';
import type { TakeoffUnitSystem, TakeoffComponentSpec } from './tradeConfig';

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
  entries: { value: number; adjusted: number | null; afterWaste: number | null; cost: number | null; areaId: string | null }[];
  semantic: string | null;
  /** Pitch/waste-adjusted total (user-built components only). */
  adjustedTotal: number | null;
  /** Material + labour cost at the spec rates (user-built only). */
  cost: number | null;
}

const HIP_SEMANTICS = ['hips', 'broken_hips'];
const VALLEY_SEMANTICS = ['valleys'];

/** Placeholder/system component pitch handling (matches main-app system defaults):
 *  ridge + spouting = none, barge = rafter, hip/valley = hip & valley. */
function placeholderPitchType(row: { semantic: string | null; name: string }): 'none' | 'rafter' | 'valley_hip' {
  const n = row.name.toLowerCase();
  if (row.semantic && (HIP_SEMANTICS.includes(row.semantic) || VALLEY_SEMANTICS.includes(row.semantic))) return 'valley_hip';
  if (n.startsWith('hip') || n.startsWith('valley')) return 'valley_hip';
  if (n.startsWith('barge')) return 'rafter';
  return 'none';
}

function isHipOrValley(row: ComponentRow): boolean {
  if (row.semantic && (HIP_SEMANTICS.includes(row.semantic) || VALLEY_SEMANTICS.includes(row.semantic))) return true;
  const n = row.name.toLowerCase();
  return n.startsWith('hip') || n.startsWith('valley');
}

export function TakeoffOutputView({
  payload,
  extras,
  unitSystem = 'metric',
  specs = [],
  onRestart,
  onBackToCanvas,
}: {
  payload: DemoFinishPayload;
  extras: TakeoffOutputExtras;
  /** Chosen in the landing wizard. Falls back to the calibration unit. */
  unitSystem?: TakeoffUnitSystem;
  /** User-built component specs (step 2 "build your own"). When present,
   *  quantities are pitch/waste-adjusted and costs shown per component. */
  specs?: TakeoffComponentSpec[];
  onRestart: () => void;
  onBackToCanvas: () => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  // Show pitch in the mode the user entered it (degrees / ratio / gradient).
  const pitchMode = getStoredPitchMode();
  const fmtPitch = (deg: number) => {
    if (pitchMode === 'degrees') return `${fmt(deg, 0)}\u00b0`;
    if (pitchMode === 'ratio') return `1:${fromDegrees('ratio', deg)}`;
    return `${fromDegrees('gradient', deg)}%`;
  };

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
        .map(g => {
          const spec = specs.find(s => s.id === g.componentId) ?? null;
          let adjustedTotal: number | null = null;
          let cost: number | null = null;
          // Per-measurement pitch adjustment (2026-08-21): each measurement is
          // stamped with the roof area it was drawn on, so pitch comes from THAT
          // area. Placeholder (no spec) components use the system pitch mapping:
          // ridge/spouting = none, barge = rafter, hip/valley = hip & valley.
          const fallbackPitchType = placeholderPitchType(g);
          const pitchTypeFor = (): 'none' | 'rafter' | 'valley_hip' => {
            if (spec) return spec.pitchEnabled ? (spec.pitchType as any) : 'none';
            return fallbackPitchType;
          };
          const areaPitchFor = (m: { quoteRoofAreaId?: string | null }) => {
            if (m.quoteRoofAreaId) {
              const area = payload.roofAreas.find(a => a.id === m.quoteRoofAreaId);
              if (area) return area.pitch || 0;
            }
            // Un-stamped (single-area sessions): first pitched area.
            return payload.roofAreas.find(a => (a.pitch || 0) > 0)?.pitch ?? 0;
          };
          const entries = g.measurements.map(m => {
            // Area-measured components (e.g. Roofing) get the RAFTER pitch of
            // the roof area they sit under, then waste on top - same as the
            // area itself (fixed 2026-08-23: was skipping pitch entirely).
            const pt = g.measurementType === 'quantity'
              ? 'none'
              : g.measurementType === 'area'
                ? 'rafter'
                : pitchTypeFor();
            const areaId = (m as any).quoteRoofAreaId ?? null;
            if (pt === 'none') return { value: m.value, adjusted: null, afterWaste: null, cost: null as number | null, areaId };
            const r = applyPitchAndWaste(m.value, true, pt as any, areaPitchFor(m as any), 'none', 0, 0);
            return { value: m.value, adjusted: r.afterPitch, afterWaste: null as number | null, cost: null as number | null, areaId };
          });
          const anyAdjusted = entries.some(e => e.adjusted != null);
          const pitchAdjustedTotal = anyAdjusted ? entries.reduce((s, e) => s + (e.adjusted ?? e.value), 0) : null;
          if (spec && g.measurementType !== 'quantity') {
            // Waste applies PER ENTRY on top of the pitch-adjusted length
            // (pitch was already applied per-entry above, from that entry's area).
            const adjusted = entries.reduce((sum, e, i) => {
              const r = applyPitchAndWaste(
                e.adjusted ?? e.value,
                false, // pitch already applied - only waste runs here
                'none',
                0,
                spec.wasteType,
                spec.wasteType === 'percent' ? spec.wasteValue : 0,
                spec.wasteType === 'fixed' || spec.wasteType === 'fixed_per_segment' ? spec.wasteValue : 0,
              );
              // Stamp waste + cost onto the entry itself so each roof-area
              // section sums ITS OWN entries (index-safe: same array object).
              e.afterWaste = r.afterWaste;
              e.cost = spec.pricingStrategy === 'per_unit'
                ? r.afterWaste * ((spec.materialRate || 0) + (spec.labourRate || 0))
                : null; // pack pricing stays group-level
              return sum + r.afterWaste;
            }, 0);
            adjustedTotal = adjusted;
            if (spec.pricingStrategy === 'per_unit') {
              cost = adjusted * (spec.materialRate + spec.labourRate);
            } else if (spec.packPrice && spec.packSize) {
              const packs = Math.ceil(adjusted / spec.packSize);
              cost = packs * spec.packPrice + adjusted * spec.labourRate;
            }
          } else if (spec && g.measurementType === 'quantity') {
            adjustedTotal = g.count;
            cost = g.count * (spec.materialRate + spec.labourRate);
            entries.forEach(e => { e.cost = (spec.materialRate || 0) + (spec.labourRate || 0); });
          }
          return {
            key: g.componentId,
            name: g.name,
            count: g.count,
            total: g.total,
            measurementType: g.measurementType,
            entries,
            semantic: g.semantic,
            adjustedTotal: adjustedTotal ?? pitchAdjustedTotal,
            cost,
          };
        }),
    [payload, specs],
  );

  const totalCost = components.reduce((s, c) => s + (c.cost ?? 0), 0);
  const hasAnyCost = components.some(c => c.cost != null);

  // 2026-08-30: "Convert to quote" routes to the FREE QUOTE GENERATOR with the
  // takeoff's component lines pre-filled (same cross-tool conversion pattern as
  // the other free document generators), NOT the app signup funnel.
  const convertToQuoteUrl = buildConvertUrl({
    targetPath: '/free-quote-generator',
    amount: totalCost,
    lines: components.map(c => {
      const qty = c.measurementType === 'quantity' ? c.count : (c.adjustedTotal ?? c.total);
      const unit = c.measurementType === 'quantity' ? 'pcs' : c.measurementType === 'area' ? areaUnitLabel : L;
      const rate = c.cost != null && qty > 0 ? c.cost / qty : 0;
      return { description: c.name, qty, unit, rate };
    }).filter(l => l.qty > 0),
    ref: 'free-roof-takeoff',
  });

  const totalPlanArea = areas.reduce((s, a) => s + a.planArea, 0);
  const totalPitchedArea = areas.reduce((s, a) => s + a.pitchedArea, 0);

  const today = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasMeasurements = areas.length > 0 || components.length > 0;

  // Shared renderer for one component group (used both under a roof-area
  // heading and in the no-areas layout). 2026-08-30: components with NO roof
  // areas must still show in the report - previously the whole components
  // section looped over areas only, so a no-area takeoff rendered nothing.
  const renderGroup = (c: ComponentRow) => {
    const u = c.measurementType === 'area' ? areaUnitLabel : L; // 2026-08-30: m2 for area components, not m
    const planTotal = c.entries.reduce((s, e) => s + e.value, 0);
    const anyAdj = c.entries.some(e => e.adjusted != null);
    const adjTotal = anyAdj ? c.entries.reduce((s, e) => s + (e.adjusted ?? e.value), 0) : null;
    const anyWaste = c.entries.some(e => e.afterWaste != null);
    const wasteTotal = anyWaste ? c.entries.reduce((s, e) => s + (e.afterWaste ?? e.adjusted ?? e.value), 0) : null;
    const groupCost = c.entries.some(e => e.cost != null)
      ? c.entries.reduce((s, e) => s + (e.cost ?? 0), 0)
      : null;
    return (
      <div key={c.key} className="avoid-break">
        <div className="flex items-center justify-between pb-1">
          <span className="text-black font-semibold">{c.name}</span>
          <span className="text-black font-semibold whitespace-nowrap text-sm">
            {c.measurementType === 'quantity'
              ? `${c.entries.length} ea`
              : `${fmt(planTotal)} ${u} plan`}
            {adjTotal != null && c.measurementType !== 'quantity' && (
              <span className="ml-2 text-black/70 font-medium">&rarr; {fmt(adjTotal)} {u} pitched</span>
            )}
            {wasteTotal != null && c.measurementType !== 'quantity' && (
              <span className="ml-2 text-black/70 font-medium">&middot; {fmt(wasteTotal)} {u} incl waste</span>
            )}
            {groupCost != null && <span className="ml-2">&middot; ${fmt(groupCost)}</span>}
          </span>
        </div>
        <div className="space-y-0.5">
          {c.entries.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-1 pl-4 text-sm border-b border-black/5">
              <span className="text-black/70">Entry {i + 1}</span>
              <span className="text-black/80 whitespace-nowrap">
                {c.measurementType === 'quantity'
                  ? '1 ea'
                  : m.afterWaste != null
                    ? `${fmt(m.value)} ${u} plan \u2192 ${fmt(m.adjusted ?? m.value)} ${u} pitched \u2192 ${fmt(m.afterWaste)} ${u} incl waste`
                    : m.adjusted != null
                      ? `${fmt(m.value)} ${u} plan \u2192 ${fmt(m.adjusted)} ${u} pitched`
                      : `${fmt(m.value)} ${u}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
            componentSpecs: specs,
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
      {/* Print/PDF: output document ONLY - hide the rest of the page (header,
          nav, marketing sections, action buttons). Groups never split across
          pages; a group that doesn't fit moves to the next page whole. */}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden; }
          #takeoff-report, #takeoff-report * { visibility: visible; }
          #takeoff-report {
            position: absolute; left: 0; top: 0; width: 100%;
            border: none !important; border-radius: 0 !important; box-shadow: none !important;
            padding: 0 !important;
          }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .print-hide { display: none !important; }
        }
      `}</style>
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

          {/* Roof areas summary removed (2026-08-30): each area is listed once
              with its components below - no separate duplicate area list. */}

          {/* Components grouped under their roof area (2026-08-21): each
              area is a clear heading, its components sit indented underneath,
              so the pitch context is self-evident. Un-stamped entries fall to
              the first area. */}
          {components.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">{areas.length > 0 ? 'Roof Areas & Components' : 'Components'}</h2>
              <div className="mt-3 space-y-6">
                {/* 2026-08-30: no roof areas - components stand alone (flat list,
                    same as the app's no-area flow). Previously this section only
                    looped over areas, so a no-area takeoff rendered nothing. */}
                {areas.length === 0 && (
                  <div className="space-y-3">
                    {components.map(renderGroup)}
                  </div>
                )}
                {areas.map(a => {
                  // Entries for this area: stamped with its id, or un-stamped (first area only).
                  // Costs/waste are stamped per entry, so filtering to this area's
                  // entries and summing them is always correct (index-safe).
                  const groupsHere = components
                    .map(c => ({ ...c, entries: c.entries.filter(e => e.areaId === a.key || (e.areaId === null && a.key === areas[0]?.key)) }))
                    .filter(c => c.entries.length > 0);
                  if (groupsHere.length === 0) return null;
                  return (
                    <div key={a.key} className="avoid-break">
                      <div className="flex items-center justify-between bg-black/5 border-b-2 border-black px-3 py-2">
                        <span className="text-black font-bold">{a.name} <span className="font-medium">- pitch {fmtPitch(a.pitch)}</span></span>
                        <span className="text-black font-medium whitespace-nowrap text-sm">
                          {fmt(a.planArea)} {areaUnitLabel} plan &middot; {fmt(a.pitchedArea)} {areaUnitLabel} pitched
                        </span>
                      </div>
                      <div className="pl-6 pt-2 space-y-3">
                        {groupsHere.map(renderGroup)}
                      </div>
                    </div>
                  );
                })}
                {/* Total component count line for orientation */}
              </div>
            </div>
          )}

          {/* Totals - always the last block of the report */}
          <div className="pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black border-b border-black pb-2">Totals</h2>
            <div className="mt-3 space-y-2">
              {areas.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-black/10">
                  <span className="text-black">Total plan area</span>
                  <span className="text-black font-medium">{fmt(totalPlanArea)} {areaUnitLabel} plan &middot; {fmt(totalPitchedArea)} {areaUnitLabel} pitched</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-black/10">
                <span className="text-black">Total components measured</span>
                <span className="text-black font-medium">{components.length}</span>
              </div>
              {hasAnyCost && (
                <div className="flex items-center justify-between py-1 mt-1">
                  <span className="text-black font-bold">Estimated total</span>
                  <span className="text-black font-bold text-lg">${fmt(totalCost)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-black">
            <p className="text-sm text-black italic">
              Measurements taken with the QuoteCore+ digital takeoff system. Roof areas use the rafter
              pitch factor for each area. Hips and valleys are adjusted using the hip &amp; valley pitch
              calculated from their roof area&apos;s pitch; barges use the rafter pitch factor. Ridge and
              spouting require no pitch adjustment. Send this takeoff into QuoteCore+ to price it with
              your own component rates and turn it into a quote.
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
            <Link
              href={convertToQuoteUrl}
              className="inline-flex items-center rounded-full bg-[#FF6B35] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Convert to quote - free quote generator
            </Link>
            <button
              onClick={handleSendToApp}
              disabled={saveState === 'saving' || saveState === 'saved'}
              className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
            >
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved - redirecting...' : 'Save my takeoff - it comes with you'}
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
