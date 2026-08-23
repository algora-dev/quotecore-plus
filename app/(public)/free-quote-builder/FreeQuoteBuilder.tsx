'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { makeId } from './types';
import ComponentStep from './ComponentStep';
import BuilderStep from './BuilderStep';
import ResultsModal from './ResultsModal';
import { lenLabel, areaLabel } from './types';

const STORAGE_KEY = 'free-quote-builder-state-v1';

interface PersistedState {
  step: 1 | 2 | 3;
  components: BuilderComponent[];
  areas: ParentArea[];
  unitSystem: UnitSystem;
  measureMode: MeasureMode;
}

export default function FreeQuoteBuilder() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [areas, setAreas] = useState<ParentArea[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [measureMode, setMeasureMode] = useState<MeasureMode>('actual');
  const [showResults, setShowResults] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedState;
        if (Array.isArray(s.components)) setComponents(s.components);
        if (Array.isArray(s.areas)) setAreas(s.areas);
        if (s.unitSystem) setUnitSystem(s.unitSystem);
        if (s.measureMode) setMeasureMode(s.measureMode);
        if (s.step === 2 || s.step === 3) setStep(s.step);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      const s: PersistedState = { step, components, areas, unitSystem, measureMode };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch { /* quota - ignore */ }
  }, [hydrated, step, components, areas, unitSystem, measureMode]);

  const currency = '$';

  /** Save a takeoff draft and hand off to the app import flow.
   * componentsOnly=true: import just the component library rows (no quote);
   * otherwise import components + areas + entries as a draft quote. */
  async function saveToApp(componentsOnly = false) {
    if (components.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        tool: 'free-quote-builder',
        unitSystem,
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
          roofAreas: areas.map(a => ({ id: a.id, name: a.name, area: 0, pitch: a.pitchDegrees })),
          componentGroups: areas.flatMap(a => a.components
            .filter(ac => ac.entries.length > 0)
            .map(ac => ({
              componentId: ac.componentId,
              name: components.find(c => c.id === ac.componentId)?.name ?? 'Component',
              isSystem: false,
              semantic: null,
              count: ac.entries.length,
              total: ac.entries.reduce((s, e) => s + (e.value || 0) * (e.quantity || 1), 0),
              measurementType: components.find(c => c.id === ac.componentId)?.measurementType,
              measurements: ac.entries.map(e => ({ value: (e.value || 0) * (e.quantity || 1), quoteRoofAreaId: a.id })),
            }))),
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
      window.location.href = `/api/app/import-takeoff-draft?draft=${id}${dest}`;
    } catch {
      setSaveError('Could not save right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Free Quote Builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build smart components from your price list, add your measurements, and get instant pricing - no plan upload or measuring required.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>1. Units & measurements</span>
        <span className="text-slate-300">→</span>
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>2. Components</span>
        <span className="text-slate-300">→</span>
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>3. Build & price</span>
      </div>

      {/* Step 1: units + measurement mode (mirrors free roof takeoff tool) */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Step 1: Measurement units</h2>
            <p className="mt-0.5 text-xs md:text-sm text-slate-400">Pick once - it applies to every component and measurement in this tool.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['metric', 'imperial', 'squares'] as const).map(u => (
                <button key={u} onClick={() => setUnitSystem(u)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${unitSystem === u ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                  {u === 'metric' ? `Metric (${lenLabel('metric')}, ${areaLabel('metric')})` : u === 'imperial' ? `Imperial (${lenLabel('imperial')}, ${areaLabel('imperial')})` : 'Squares'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Step 2: How will you enter measurements?</h2>
            <p className="mt-0.5 text-xs md:text-sm text-slate-400">Decide up-front - this controls whether pitch factors are applied to plan lengths and areas.</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => setMeasureMode('actual')}
                className={`rounded-xl border p-4 text-left transition ${measureMode === 'actual' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                <div className="text-sm font-semibold">Actual measurements</div>
                <div className={`mt-1 text-xs ${measureMode === 'actual' ? 'text-slate-300' : 'text-slate-400'}`}>I already have true, final measurements. No pitch adjustment needed.</div>
              </button>
              <button onClick={() => setMeasureMode('plan')}
                className={`rounded-xl border p-4 text-left transition ${measureMode === 'plan' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                <div className="text-sm font-semibold">Plan measurements</div>
                <div className={`mt-1 text-xs ${measureMode === 'plan' ? 'text-slate-300' : 'text-slate-400'}`}>Taken from a 2D plan - pitch factors get applied to get true lengths and areas.</div>
              </button>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button onClick={() => setStep(2)} className="rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#A03E15]">
              Continue to components
            </button>
          </div>
        </div>
      )}

      {/* Step 2: components */}
      {step === 2 && (
        <ComponentStep
          components={components}
          setComponents={setComponents}
          measureMode={measureMode}
          unitSystem={unitSystem}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          onSaveToApp={() => saveToApp(true)}
        />
      )}

      {/* Step 3: builder */}
      {step === 3 && (
        <BuilderStep
          components={components}
          areas={areas}
          setAreas={setAreas}
          measureMode={measureMode}
          unitSystem={unitSystem}
          currency={currency}
          onBack={() => setStep(2)}
          onGenerate={() => setShowResults(true)}
        />
      )}

      {(saving || saveError) && (
        <div className="text-center">
          {saving && <p className="text-xs text-slate-500">Saving to your account...</p>}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
      )}

      {showResults && (
        <ResultsModal
          areas={areas}
          components={components}
          measureMode={measureMode}
          unitSystem={unitSystem}
          currency={currency}
          onClose={() => setShowResults(false)}
          onSaveToApp={() => saveToApp(false)}
        />
      )}

      {/* keep len/areaU referenced for labels used above */}
      <span className="sr-only">{len} {areaU} {makeId('noop')}</span>
    </div>
  );
}
