'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import {
  type UnitSystem,
  lengthUnit,
  areaUnit,
  volumeUnit,
} from '../lib/calculator';
import { PitchRafterPanel } from './components/PitchRafterPanel';
import { RoofAreaPanel } from './components/RoofAreaPanel';
import { MaterialPanel } from './components/MaterialPanel';

// ─── Unit System Context ─────────────────────────────

interface UnitContextValue {
  system: UnitSystem;
  toggle: () => void;
  lengthUnit: string;
  areaUnit: string;
  volumeUnit: string;
}

const UnitContext = createContext<UnitContextValue | null>(null);

export function useUnitSystem() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnitSystem must be used within RoofingCalculator');
  return ctx;
}

// ─── Shared State (pitch inheritance between panels) ──

interface RoofingState {
  pitch: string;
  span: string;
  roofWidth: string;
  roofLength: string;
  pitchType: string;
  material: string;
  waste: string;
  pricePerUnit: string;
  areaOverride: string;
}

const DEFAULT_STATE: RoofingState = {
  pitch: '25',
  span: '10',
  roofWidth: '10',
  roofLength: '8',
  pitchType: 'rafter',
  material: 'Concrete tiles',
  waste: '10',
  pricePerUnit: '',
  areaOverride: '',
};

const STORAGE_KEY = 'qcp:roofing-calc';

// ─── Main Component ──────────────────────────────────

export function RoofingCalculator() {
  const [system, setSystem] = useState<UnitSystem>('metric');
  const [state, setState] = useState<RoofingState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Save to localStorage (debounced via effect)
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  const update = (key: keyof RoofingState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const unitValue: UnitContextValue = {
    system,
    toggle: () => setSystem((s) => (s === 'metric' ? 'imperial' : 'metric')),
    lengthUnit: lengthUnit(system),
    areaUnit: areaUnit(system),
    volumeUnit: volumeUnit(system),
  };

  return (
    <UnitContext.Provider value={unitValue}>
      <div className="space-y-5">
        {/* Unit toggle */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
            <button
              onClick={() => setSystem('metric')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                system === 'metric' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Metric
            </button>
            <button
              onClick={() => setSystem('imperial')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                system === 'imperial' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Imperial
            </button>
          </div>
        </div>

        {/* Panel 1: Pitch & Rafter */}
        <PitchRafterPanel
          pitch={state.pitch}
          span={state.span}
          onPitchChange={(v) => update('pitch', v)}
          onSpanChange={(v) => update('span', v)}
        />

        {/* Panel 2: Roof Area */}
        <RoofAreaPanel
          width={state.roofWidth}
          length={state.roofLength}
          pitch={state.pitch}
          pitchType={state.pitchType as 'rafter' | 'valley_hip' | 'none'}
          onWidthChange={(v) => update('roofWidth', v)}
          onLengthChange={(v) => update('roofLength', v)}
          onPitchTypeChange={(v) => update('pitchType', v)}
          onUseArea={(area: string) => update('areaOverride', area)}
        />

        {/* Panel 3: Material Estimator */}
        <MaterialPanel
          material={state.material}
          waste={state.waste}
          pricePerUnit={state.pricePerUnit}
          areaOverride={state.areaOverride}
          pitch={state.pitch}
          onMaterialChange={(v) => update('material', v)}
          onWasteChange={(v) => update('waste', v)}
          onPriceChange={(v) => update('pricePerUnit', v)}
        />
      </div>
    </UnitContext.Provider>
  );
}

// Re-export for convenience
export { areaUnit, volumeUnit };
export type { UnitSystem };
