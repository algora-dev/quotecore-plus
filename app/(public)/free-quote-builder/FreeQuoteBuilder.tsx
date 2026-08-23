'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BuilderComponent, MeasureMode, ParentArea, UnitSystem } from './types';
import ComponentStep from './ComponentStep';
import BuilderStep from './BuilderStep';
import ResultsModal from './ResultsModal';

const STORAGE_KEY = 'fqb-state-v1';

interface PersistedState {
  step: 1 | 2;
  components: BuilderComponent[];
  areas: ParentArea[];
  unitSystem: UnitSystem;
  measureMode: MeasureMode;
}

export default function FreeQuoteBuilder() {
  const [step, setStep] = useState<1 | 2>(1);
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
        if (s.step === 2) setStep(2);
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

  const currency = useMemo(() => (unitSystem === 'metric' ? '$' : '$'), [unitSystem]);

  /** Save the full builder state as a takeoff draft and send the user into the
   * app import flow (login/onboarding-safe, mirrors free roof takeoff tool). */
  async function saveToApp() {
    if (components.length === 0 && areas.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Build the takeoff-draft payload (same shape as the free roof takeoff
      // tool): componentSpecs + one area + componentGroups with measurements.
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
      window.location.href = `/api/app/import-takeoff-draft?draft=${id}`;
    } catch {
      setSaveError('Could not save right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

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
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
          1. Components
        </span>
        <span className="text-slate-300">→</span>
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${step === 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
          2. Build & price
        </span>
        <span className="text-slate-300">→</span>
        <span className={`rounded-full px-3 py-1.5 font-medium transition ${showResults ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
          3. Results
        </span>
      </div>

      {step === 1 && (
        <ComponentStep
          components={components}
          setComponents={setComponents}
          unitSystem={unitSystem}
          setUnitSystem={setUnitSystem}
          onContinue={() => setStep(2)}
          onSaveToApp={saveToApp}
        />
      )}

      {step === 2 && (
        <BuilderStep
          components={components}
          areas={areas}
          setAreas={setAreas}
          measureMode={measureMode}
          setMeasureMode={setMeasureMode}
          unitSystem={unitSystem}
          currency={currency}
          onBack={() => setStep(1)}
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
          onSaveToApp={saveToApp}
        />
      )}
    </div>
  );
}
