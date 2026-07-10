'use client';

import { useState, createContext, useContext, type ReactNode } from 'react';
import {
  type UnitSystem,
  lengthUnit,
  areaUnit,
  volumeUnit,
} from './lib/calculator';
import { PitchConverter } from './components/PitchConverter';
import { RafterCalculator } from './components/RafterCalculator';
import { RoofAreaCalculator } from './components/RoofAreaCalculator';
import { HipValleyCalculator } from './components/HipValleyCalculator';
import { AreaCalculator } from './components/AreaCalculator';
import { VolumeCalculator } from './components/VolumeCalculator';
import { TrigCalculator } from './components/TrigCalculator';
import { MaterialEstimator } from './components/MaterialEstimator';

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
  if (!ctx) throw new Error('useUnitSystem must be used within ConstructionCalculator');
  return ctx;
}

// ─── Calculator Tabs ─────────────────────────────────

const TABS = [
  { id: 'pitch', label: 'Pitch', icon: '📐' },
  { id: 'rafter', label: 'Rafter', icon: '📏' },
  { id: 'roof-area', label: 'Roof Area', icon: '🏠' },
  { id: 'hip-valley', label: 'Hip/Valley', icon: '🔻' },
  { id: 'area', label: 'Area', icon: '⬜' },
  { id: 'volume', label: 'Volume', icon: '🧊' },
  { id: 'trig', label: 'Triangle', icon: '📏' },
  { id: 'material', label: 'Material', icon: '📦' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ConstructionCalculator() {
  const [activeTab, setActiveTab] = useState<TabId>('pitch');
  const [system, setSystem] = useState<UnitSystem>('metric');

  const unitValue: UnitContextValue = {
    system,
    toggle: () => setSystem((s) => (s === 'metric' ? 'imperial' : 'metric')),
    lengthUnit: lengthUnit(system),
    areaUnit: areaUnit(system),
    volumeUnit: volumeUnit(system),
  };

  return (
    <UnitContext.Provider value={unitValue}>
      <div className="space-y-6">
        {/* Unit toggle + tab bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Unit toggle */}
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

        {/* Active calculator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeTab === 'pitch' && <PitchConverter />}
          {activeTab === 'rafter' && <RafterCalculator />}
          {activeTab === 'roof-area' && <RoofAreaCalculator />}
          {activeTab === 'hip-valley' && <HipValleyCalculator />}
          {activeTab === 'area' && <AreaCalculator />}
          {activeTab === 'volume' && <VolumeCalculator />}
          {activeTab === 'trig' && <TrigCalculator />}
          {activeTab === 'material' && <MaterialEstimator />}
        </div>

        {/* Sticky CTA */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
          <p className="text-sm font-medium text-slate-700">
            Turn these calculations into a professional quote →
          </p>
          <a
            href="/free-quote-generator"
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Free Quote Generator
          </a>
        </div>
      </div>
    </UnitContext.Provider>
  );
}
