'use client';

import { useEffect, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { lenLabel, areaLabel } from './types';
import ComponentStep from './ComponentStep';
import BuilderStep from './BuilderStep';
import OutputView from './OutputView';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import { entryRawValue } from './calc';

// Unit conversions into metric - the app stores sqm/m internally regardless
// of the unit system the free tool (or the app account) was created in.
const FT_TO_M = 0.3048;
const FT2_TO_M2 = 0.09290304;
const SQ_TO_M2 = 9.290304;
const toM2 = (v: number, u: UnitSystem) => (u === 'imperial' ? v * FT2_TO_M2 : u === 'squares' ? v * SQ_TO_M2 : v);
const toM = (v: number, u: UnitSystem) => (u === 'metric' ? v : v * FT_TO_M);

/** Plan area of a parent area in m2: summed from its area-type component
 * entries (raw plan values - the import route applies pitch itself). */
function areaPlanSqmFor(areas: ParentArea[], components: BuilderComponent[], areaId: string, u: UnitSystem): number {
  const area = areas.find(a => a.id === areaId);
  if (!area) return 0;
  const byId = new Map(components.map(c => [c.id, c]));
  let total = 0;
  for (const ac of area.components) {
    const comp = byId.get(ac.componentId);
    if (!comp || comp.measurementType !== 'area') continue;
    for (const e of ac.entries) total += entryRawValue(e, comp);
  }
  return toM2(total, u);
}

/** Raw plan measurement for an entry in the app's internal unit (m / m2 / ea). */
function entryValueForApp(entryValue: number, mt: 'lineal' | 'area' | 'quantity', u: UnitSystem): number {
  if (mt === 'area') return toM2(entryValue, u);
  if (mt === 'lineal') return toM(entryValue, u);
  return entryValue;
}

const STORAGE_KEY = 'free-quote-builder-v2';

/** Free Quote Builder - manual version of the Free Roof Takeoff tool.
 * Same wizard shell (units -> components -> gate), then the Free Roofing
 * Takeoff Builder measurement UX (areas + component sections + entries). */
export default function FreeQuoteBuilder() {
  const [step, setStep] = useState(1);
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [areas, setAreas] = useState<ParentArea[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(null);
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // No sessionStorage restore: on refresh the user starts over. This is
  // deliberate friction - the way to keep your components is to sign up.
  useEffect(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const currency = '$';

  /** Save a takeoff draft and hand off to the app import flow.
   * componentsOnly=true: import just the component library rows (no quote);
   * otherwise import components + areas + entries as a draft quote. */
  async function saveToApp(componentsOnly: boolean) {
    if (components.length === 0) return;
    const u = unitSystem ?? 'metric';
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        tool: 'free-quote-builder',
        unitSystem: unitSystem ?? 'metric',
        componentSpecs: components.map(c => ({
          id: c.id,
          name: c.name,
          measurementType: c.measurementType,
          materialRate: c.materialRate,
          labourRate: c.labourRate,
          pricingStrategy: c.pricingStrategy,
          packPrice: c.packPrice,
          packSize: c.packSize,
          wasteType: c.wasteType,
          wasteValue: c.wasteValue,
          pitchEnabled: c.pitchEnabled,
          pitchType: c.pitchType,
        })),
        ...(componentsOnly ? {} : {
          // Area rows are pitch/naming containers ONLY - the quantities live
          // in the component entries (area components each cover the whole
          // area, so summing them would double-count). area stays 0.
          roofAreas: areas.map(a => ({
            id: a.id,
            name: a.name,
            area: 0,
            pitch: a.pitchDegrees,
          })),
          componentGroups: areas.flatMap(a => a.components
            .filter(ac => ac.entries.length > 0)
            .map(ac => {
              const comp = components.find(c => c.id === ac.componentId);
              const mt = comp?.measurementType ?? 'lineal';
              const vals = ac.entries.map(e => entryValueForApp(entryRawValue(e, comp!), mt, u));
              return {
                componentId: ac.componentId,
                name: comp?.name ?? 'Component',
                isSystem: false,
                semantic: null,
                count: ac.entries.length,
                total: vals.reduce((s, v) => s + v, 0),
                measurementType: mt,
                measurements: vals.map(v => ({ value: v, quoteRoofAreaId: a.id })),
              };
            })),
        }),
        savedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/free-tools/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftType: 'takeoff', payload }),
      });
      if (!res.ok) {
        setSaveError('Could not save right now. Please try again.');
        return;
      }
      const { id } = await res.json() as { id: string };
      const dest = componentsOnly ? '&dest=components' : '';
      // Same hand-off as the Free Roof Takeoff tool: draft id goes to the
      // signup flow and the app restores it after signup.
      window.location.href = `/signup?ref=measurement-to-quote-tool&draft=${id}${dest}`;
    } catch {
      setSaveError('Could not save right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const stepIndicator = (
    <div className="flex items-center gap-2">
      {([1, 2, 3, 4] as const).map(n => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              n === step ? 'bg-black text-white' : n < step ? 'bg-[#FF6B35] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {n < step ? '\u2713' : n}
          </div>
          {n < 4 && <div className={`w-8 h-0.5 ${n < step ? 'bg-[#FF6B35]' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  );

  // ── Phase 4: builder (Free Roofing Takeoff Builder measurement UX) ──
  if (step === 4 && unitSystem && measureMode) {
    return (
      <BuilderStep
        components={components}
        areas={areas}
        setAreas={setAreas}
        measureMode={measureMode}
        unitSystem={unitSystem}
        currency={currency}
        onBack={() => setStep(3)}
        onGenerate={() => { trackFreeToolEvent('result'); setStep(5); }}
      />
    );
  }

  // ── Phase 5: output (report phase, same actions as Free Roof Takeoff output) ──
  if (step === 5 && unitSystem && measureMode) {
    return (
      <OutputView
        areas={areas}
        components={components}
        measureMode={measureMode}
        unitSystem={unitSystem}
        currency={currency}
        onBackToBuilder={() => setStep(4)}
        onRestart={() => {
          setStep(1);
          setComponents([]);
          setAreas([]);
          setUnitSystem(null);
          setMeasureMode(null);
          try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }}
        onSaveToApp={() => saveToApp(false)}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  const stepTitle =
    step === 1 ? 'Choose your measurement unit'
    : step === 2 ? 'Build your components'
    : 'How do you want to enter your measurements?';

  // ── Wizard shell (identical to Free Roof Takeoff) ──
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Free measurement-to-quote tool</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">Turn your measurements into pricing</p>
        <p className="mt-1 text-sm font-medium text-[#BD4A1A]">Save the pricing logic once, reuse it every time you measure a new job. Free, no signup required.</p>
        <div className="mt-4 flex items-center justify-between">
          {stepIndicator}
          {step > 1 && (
            <button onClick={() => setStep(s => (s === 3 ? 2 : s === 2 ? 1 : 2) as 1 | 2)} className="text-sm text-slate-500 hover:text-slate-800">
              Back
            </button>
          )}
        </div>
        <h2 className="mt-5 text-base font-semibold text-slate-800">{stepTitle}</h2>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            {([
              { value: 'metric' as const, label: 'Metric', description: 'Metres and square metres (m, m\u00b2)' },
              { value: 'imperial' as const, label: 'Imperial', description: 'Feet and square feet (ft, sq ft)' },
              { value: 'squares' as const, label: 'Roofing Squares', description: 'Areas in roofing squares (1 square = 100 sq ft)' },
            ]).map(o => (
              <label
                key={o.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  unitSystem === o.value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="unit-system"
                  checked={unitSystem === o.value}
                  onChange={() => setUnitSystem(o.value)}
                  className="mt-0.5 w-4 h-4 accent-orange-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{o.description}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-slate-400">
              Your units apply to every component and measurement in this tool.
            </p>
            <button
              onClick={() => setStep(2)}
              disabled={!unitSystem}
              className="mt-4 w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && unitSystem && (
          <ComponentStep
            components={components}
            setComponents={setComponents}
            unitSystem={unitSystem}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            onSaveToApp={() => saveToApp(true)}
            saving={saving}
            saveError={saveError}
          />
        )}

        {step === 3 && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Unit: <span className="font-semibold text-slate-800">{unitSystem === 'metric' ? 'Metric' : unitSystem === 'imperial' ? 'Imperial' : 'Roofing Squares'}</span> &middot; Components:{' '}
              <span className="font-semibold text-slate-800">{components.length}</span> (locked for this session)
            </div>
            {([
              { value: 'actual' as const, title: 'I have actual measurements', desc: 'You already have final dimensions. Just type them in - no pitch calculation needed.' },
              { value: 'plan' as const, title: 'I\u2019m measuring from a plan', desc: 'You have a top-down plan. Enter plan dimensions and the roof pitch - we\u2019ll calculate the real sloped lengths and areas.' },
            ]).map(o => (
              <label
                key={o.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  measureMode === o.value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="measure-mode"
                  checked={measureMode === o.value}
                  onChange={() => setMeasureMode(o.value)}
                  className="mt-0.5 w-4 h-4 accent-orange-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{o.desc}</span>
                </span>
              </label>
            ))}
            <button
              onClick={() => { if (measureMode) setStep(4); }}
              disabled={!measureMode}
              className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
            >
              Continue to quote builder
            </button>
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Nothing is saved unless you choose to send the result into the app.
        </p>
      </div>
    </div>
  );
}
