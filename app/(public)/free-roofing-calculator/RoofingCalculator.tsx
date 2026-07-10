'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import {
  type UnitSystem,
  lengthUnit,
  areaUnit,
  volumeUnit,
} from '../lib/calculator';
import { RoofAreaTab } from './components/RoofAreaTab';
import { PitchRafterTab } from './components/PitchRafterTab';
import { DraftSmartComponentTab } from './components/DraftSmartComponentTab';
import { AngleFinderTab } from './components/AngleFinderTab';

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

// ─── Shared pitch state (for "use area" flow) ────────

interface SharedState {
  calculatedArea: string | null;
}

const SharedStateContext = createContext<{
  shared: SharedState;
  setShared: (s: SharedState) => void;
} | null>(null);

export function useSharedState() {
  const ctx = useContext(SharedStateContext);
  if (!ctx) throw new Error('useSharedState must be used within RoofingCalculator');
  return ctx;
}

// ─── Tabs ────────────────────────────────────────────

type TabId = 'roof-area' | 'pitch-rafter' | 'smart-component' | 'angle-finder';

const TABS: { id: TabId; label: string }[] = [
  { id: 'roof-area', label: 'Roof Area' },
  { id: 'pitch-rafter', label: 'Rafter / Hip & Valley' },
  { id: 'smart-component', label: 'Draft Smart Component' },
  { id: 'angle-finder', label: 'Angle Finder' },
];

// ─── Main Component ──────────────────────────────────

export function RoofingCalculator() {
  const [system, setSystem] = useState<UnitSystem>('metric');
  const [activeTab, setActiveTab] = useState<TabId>('roof-area');
  const [shared, setShared] = useState<SharedState>({ calculatedArea: null });

  const unitValue: UnitContextValue = {
    system,
    toggle: () => setSystem((s) => (s === 'metric' ? 'imperial' : 'metric')),
    lengthUnit: lengthUnit(system),
    areaUnit: areaUnit(system),
    volumeUnit: volumeUnit(system),
  };

  return (
    <UnitContext.Provider value={unitValue}>
      <SharedStateContext.Provider value={{ shared, setShared }}>
        <div className="space-y-5">
          {/* Top bar: tabs (left) + unit toggle (right) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
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

          {/* Tab content */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {activeTab === 'roof-area' && <RoofAreaTab />}
            {activeTab === 'pitch-rafter' && <PitchRafterTab />}
            {activeTab === 'smart-component' && <DraftSmartComponentTab />}
            {activeTab === 'angle-finder' && <AngleFinderTab />}
          </div>
        </div>
      </SharedStateContext.Provider>
    </UnitContext.Provider>
  );
}
