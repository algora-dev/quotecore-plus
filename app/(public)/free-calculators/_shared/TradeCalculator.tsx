'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import {
  type UnitSystem,
  lengthUnit,
  areaUnit,
  volumeUnit,
} from '../../lib/calculator';
import { CURRENCIES, type TradeConfig } from './types';
import { AreaTab } from './tabs/AreaTab';
import { MembersTab } from './tabs/MembersTab';
import { GradientTab } from './tabs/GradientTab';
import { VolumeTab } from './tabs/VolumeTab';
import { SmartComponentTab } from './tabs/SmartComponentTab';
import { AngleTab } from './tabs/AngleTab';
import { BattenTab } from './tabs/BattenTab';

// ─── Trade config context ────────────────────────────

const TradeConfigContext = createContext<TradeConfig | null>(null);

export function useTradeConfig(): TradeConfig {
  const ctx = useContext(TradeConfigContext);
  if (!ctx) throw new Error('useTradeConfig must be used within TradeCalculator');
  return ctx;
}

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
  if (!ctx) throw new Error('useUnitSystem must be used within TradeCalculator');
  return ctx;
}

// ─── Currency context ────────────────────────────────

interface CurrencyContextValue {
  code: string;
  symbol: string;
  setCode: (code: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within TradeCalculator');
  return ctx;
}

// ─── Shared cross-tab state ("use for pricing" flow) ─

interface SharedState {
  calculatedArea: string | null;
  calculatedVolume: string | null;
}

const SharedStateContext = createContext<{
  shared: SharedState;
  setShared: (s: Partial<SharedState>) => void;
} | null>(null);

export function useSharedState() {
  const ctx = useContext(SharedStateContext);
  if (!ctx) throw new Error('useSharedState must be used within TradeCalculator');
  return ctx;
}

// ─── Main Component ──────────────────────────────────

export function TradeCalculator({ config }: { config: TradeConfig }) {
  const [system, setSystem] = useState<UnitSystem>('metric');
  const [currencyCode, setCurrencyCode] = useState<string>(config.defaultCurrency ?? 'GBP');
  const [activeTab, setActiveTab] = useState<string>(config.tabs[0]?.id ?? '');
  const [shared, setSharedState] = useState<SharedState>({
    calculatedArea: null,
    calculatedVolume: null,
  });

  const setShared = (patch: Partial<SharedState>) =>
    setSharedState((s) => ({ ...s, ...patch }));

  const smartTabId = config.tabs.find((t) => t.kind === 'smart')?.id;

  // Auto-switch to Draft Smart Component tab when a value is shared
  useEffect(() => {
    if ((shared.calculatedArea || shared.calculatedVolume) && smartTabId) {
      setActiveTab(smartTabId);
    }
  }, [shared.calculatedArea, shared.calculatedVolume, smartTabId]);

  const unitValue: UnitContextValue = {
    system,
    toggle: () => setSystem((s) => (s === 'metric' ? 'imperial' : 'metric')),
    lengthUnit: lengthUnit(system),
    areaUnit: areaUnit(system),
    volumeUnit: volumeUnit(system),
  };

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const currencyValue: CurrencyContextValue = {
    code: currency.code,
    symbol: currency.symbol,
    setCode: setCurrencyCode,
  };

  function renderTab(kind: string) {
    switch (kind) {
      case 'area': return <AreaTab />;
      case 'members': return <MembersTab />;
      case 'gradient': return <GradientTab />;
      case 'volume': return <VolumeTab />;
      case 'smart': return <SmartComponentTab />;
      case 'angle': return <AngleTab />;
      case 'batten': return <BattenTab />;
      default: return null;
    }
  }

  const active = config.tabs.find((t) => t.id === activeTab) ?? config.tabs[0];

  return (
    <TradeConfigContext.Provider value={config}>
      <UnitContext.Provider value={unitValue}>
        <CurrencyContext.Provider value={currencyValue}>
        <SharedStateContext.Provider value={{ shared, setShared }}>
          <div className="space-y-5">
            {/* Top bar: tabs (left) + unit toggle (right) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1">
                {config.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active?.id === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Unit toggle + currency */}
              <div className="flex items-center gap-2">
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
                <select
                  value={currency.code}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  aria-label="Currency"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-orange-500 focus:outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tab content */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {active && renderTab(active.kind)}
            </div>
          </div>
        </SharedStateContext.Provider>
        </CurrencyContext.Provider>
      </UnitContext.Provider>
    </TradeConfigContext.Provider>
  );
}
