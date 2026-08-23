'use client';

import { useEffect, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import { lenLabel, areaLabel } from './types';
import ComponentStep from './ComponentStep';
import BuilderStep from './BuilderStep';
import ResultsModal from './ResultsModal';

const STORAGE_KEY = 'free-quote-builder-v1';

interface PersistedState {
  step: number;
  components: BuilderComponent[];
  areas: ParentArea[];
  unitSystem: UnitSystem;
  measureMode: MeasureMode;
}

export default function FreeQuoteBuilder() {
  const [step, setStep] = useState(1);
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [areas, setAreas] = useState<ParentArea[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(null);
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedState;
        if (Array.isArray(s.components)) setComponents(s.components);
        if (Array.isArray(s.areas)) setAreas(s.areas);
        if (s.unitSystem) setUnitSystem(s.unitSystem);
        if (s.measureMode) setMeasureMode(s.measureMode);
        if (s.step === 2 || s.step === 3 || s.step === 4) setStep(s.step);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const s: PersistedState = { step, components, areas, unitSystem: unitSystem ?? 'metric', measureMode: measureMode ?? 'actual' };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch { /* quota - ignore */ }
  }, [hydrated, step, components, areas, unitSystem, measureMode]);

  const currency = '$';

  /** Save a takeoff draft and hand off to the app import flow.
   * componentsOnly=true: import just the component library rows (no quote);
   * otherwise import components + areas + entries as a draft quote. */
  async function saveToApp(componentsOnly: boolean) {
    if (components.length === 0) return;
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

  const steps = ['Units', 'Components', 'Measurements', 'Build'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Free Quote Builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build smart components from your price list, add your measurements, and get instant pricing - no plan upload or measuring required.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {steps.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === i + 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {i + 1}. {label}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1: units only (mirrors free roof takeoff tool step 1) */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Step 1: Measurement units</h2>
            <p className="mt-0.5 text-xs md:text-sm text-slate-400">Pick your units - they apply to every component and measurement in this tool.</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {([['metric', 'Metric', 'm, m\u00B2'], ['imperial', 'Imperial', 'ft, sq ft'], ['squares', 'Squares', 'roofing squares']] as const).map(([u, label, sub]) => (
                <button key={u} onClick={() => setUnitSystem(u)}
                  className={`rounded-xl border p-4 text-left transition ${unitSystem === u ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className={`mt-1 text-xs ${unitSystem === u ? 'text-slate-300' : 'text-slate-400'}`}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              onClick={() => { if (unitSystem) setStep(2); }}
              disabled={!unitSystem}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${unitSystem ? 'bg-[#FF6B35] text-white hover:bg-[#A03E15]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              Continue to components
            </button>
          </div>
        </div>
      )}

      {/* Step 2: components + save-or-continue gate */}
      {step === 2 && unitSystem && (
        <ComponentStep
          components={components}
          setComponents={setComponents}
          unitSystem={unitSystem}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          onSaveToApp={() => saveToApp(true)}
        />
      )}

      {/* Step 3: measurement mode (only if they chose to continue) */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Step 3: How will you enter measurements?</h2>
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
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button onClick={() => setStep(2)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">Back</button>
            <button
              onClick={() => { if (measureMode) setStep(4); }}
              disabled={!measureMode}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${measureMode ? 'bg-[#FF6B35] text-white hover:bg-[#A03E15]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              Continue to builder
            </button>
          </div>
        </div>
      )}

      {/* Step 4: builder */}
      {step === 4 && unitSystem && measureMode && (
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

      {showResults && unitSystem && measureMode && (
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
    </div>
  );
}
