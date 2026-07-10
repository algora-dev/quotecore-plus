'use client';

import { useState, useRef, useEffect } from 'react';
import { useUnitSystem, useSharedState } from '../RoofingCalculator';
import type { MeasurementType, WasteType, PitchType } from '@/app/lib/types';

// ─── Types matching the app's component model ────────

interface ComponentSpec {
  name: string;
  measurementType: MeasurementType;
  wasteType: WasteType;
  wasteValue: string;
  pricePerUnit: string;
  pitchEnabled: boolean;
  pitchType: PitchType;
  pitchDegrees: string;
}

// ─── Measurement type options (roofing-focused) ──────

const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'area', label: 'Area (m² / ft²)' },
  { value: 'lineal', label: 'Linear: Single (m / ft)' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'fixed', label: 'Fixed' },
];

const WASTE_TYPES: { value: WasteType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'percent', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed (total)' },
];

// ─── Component ───────────────────────────────────────

export function DraftSmartComponentTab() {
  const { areaUnit, lengthUnit, volumeUnit } = useUnitSystem();
  const { shared } = useSharedState();

  const [spec, setSpec] = useState<ComponentSpec>({
    name: 'Concrete tiles',
    measurementType: 'area',
    wasteType: 'percent',
    wasteValue: '10',
    pricePerUnit: '2.50',
    pitchEnabled: true,
    pitchType: 'rafter',
    pitchDegrees: '25',
  });

  // Measurement input state
  const [areaInput, setAreaInput] = useState('');
  const [linearInput, setLinearInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [dimA, setDimA] = useState('');
  const [dimB, setDimB] = useState('');
  const [entryMode, setEntryMode] = useState<'direct' | 'dims'>('direct');

  const [result, setResult] = useState<null | {
    rawValue: number;
    wasteAmount: number;
    totalValue: number;
    cost: number;
    unit: string;
  }>(null);

  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showSyncHint, setShowSyncHint] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pre-fill area from shared state (from Roof Area tab)
  useEffect(() => {
    if (shared.calculatedArea) {
      setAreaInput(shared.calculatedArea);
      setSpec((s) => ({ ...s, measurementType: 'area' }));
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [shared.calculatedArea]);

  const update = (key: keyof ComponentSpec, value: string | boolean) => {
    setSpec((s) => ({ ...s, [key]: value }));
  };

  function calculate() {
    const mt = spec.measurementType;
    let rawValue = 0;
    let unit = '';

    if (mt === 'area') {
      if (entryMode === 'dims') {
        const a = parseFloat(dimA) || 0;
        const b = parseFloat(dimB) || 0;
        rawValue = a * b;
        unit = areaUnit;
      } else {
        rawValue = parseFloat(areaInput) || 0;
        unit = areaUnit;
      }
    } else if (mt === 'lineal') {
      rawValue = parseFloat(linearInput) || 0;
      unit = lengthUnit;
    } else if (mt === 'quantity' || mt === 'fixed') {
      rawValue = parseFloat(quantityInput) || 0;
      unit = 'units';
    }

    // Apply waste
    let wasteAmount = 0;
    if (spec.wasteType === 'percent') {
      const pct = parseFloat(spec.wasteValue) || 0;
      wasteAmount = rawValue * (pct / 100);
    } else if (spec.wasteType === 'fixed') {
      wasteAmount = parseFloat(spec.wasteValue) || 0;
    }

    const totalValue = rawValue + wasteAmount;
    const price = parseFloat(spec.pricePerUnit) || 0;
    const cost = totalValue * price;

    setResult({ rawValue, wasteAmount, totalValue, cost, unit });
  }

  // Show sync hint after calculation
  useEffect(() => {
    if (result && result.totalValue > 0) {
      const dismissed = sessionStorage.getItem('qcp:sync-hint-dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowSyncHint(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [result?.totalValue]);

  const mt = spec.measurementType;
  const isAreaType = mt === 'area';
  const hasDimToggle = isAreaType;

  return (
    <div ref={panelRef} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Draft Smart Component</h2>
        <p className="mt-1 text-sm text-slate-500">
          Build a component with pricing and waste rules, then calculate cost from measurements
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Component spec (mirrors create component form) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Component spec</h3>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-700">Component name</label>
            <input
              type="text"
              value={spec.name}
              onChange={(e) => update('name', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Measurement type */}
          <div>
            <label className="text-sm font-medium text-slate-700">Measurement type</label>
            <select
              value={spec.measurementType}
              onChange={(e) => update('measurementType', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {MEASUREMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Waste type */}
          <div>
            <label className="text-sm font-medium text-slate-700">Waste</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={spec.wasteType}
                onChange={(e) => update('wasteType', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              >
                {WASTE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {spec.wasteType !== 'none' && (
                <input
                  type="number"
                  value={spec.wasteValue}
                  onChange={(e) => update('wasteValue', e.target.value)}
                  min={0}
                  step={0.1}
                  placeholder={spec.wasteType === 'percent' ? '%' : 'amount'}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="text-sm font-medium text-slate-700">Price per unit</label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">$</span>
              <input
                type="number"
                value={spec.pricePerUnit}
                onChange={(e) => update('pricePerUnit', e.target.value)}
                min={0}
                step={0.01}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pitch */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spec.pitchEnabled}
                onChange={(e) => update('pitchEnabled', e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-slate-700">Apply pitch calculation</span>
            </label>
            {spec.pitchEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={spec.pitchType}
                  onChange={(e) => update('pitchType', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                >
                  <option value="rafter">Rafter Pitch</option>
                  <option value="valley_hip">Valley/Hip Pitch</option>
                </select>
                <input
                  type="number"
                  value={spec.pitchDegrees}
                  onChange={(e) => update('pitchDegrees', e.target.value)}
                  min={0}
                  max={89}
                  step={0.5}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Save as Smart Component CTA */}
          <button
            onClick={() => setShowSavePopup(true)}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            Save as Smart Component
          </button>
        </div>

        {/* Right: Measurement input (mirrors quote builder entry) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Measurement</h3>

          {/* Entry mode toggle for area types */}
          {hasDimToggle && (
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
              <button
                onClick={() => setEntryMode('direct')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  entryMode === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Direct
              </button>
              <button
                onClick={() => setEntryMode('dims')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  entryMode === 'dims' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                W × L
              </button>
            </div>
          )}

          {/* Dynamic inputs based on measurement type */}
          {mt === 'area' && (
            entryMode === 'dims' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Width ({lengthUnit})</label>
                  <input
                    type="number"
                    value={dimA}
                    onChange={(e) => setDimA(e.target.value)}
                    min={0}
                    step={0.1}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Length ({lengthUnit})</label>
                  <input
                    type="number"
                    value={dimB}
                    onChange={(e) => setDimB(e.target.value)}
                    min={0}
                    step={0.1}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-700">Area ({areaUnit})</label>
                <input
                  type="number"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  min={0}
                  step={0.1}
                  placeholder="Enter area or use from roof area tab"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                {shared.calculatedArea && areaInput === shared.calculatedArea && (
                  <p className="mt-1 text-xs text-slate-400">Pre-filled from roof area calculation</p>
                )}
              </div>
            )
          )}

          {mt === 'lineal' && (
            <div>
              <label className="text-sm font-medium text-slate-700">Length ({lengthUnit})</label>
              <input
                type="number"
                value={linearInput}
                onChange={(e) => setLinearInput(e.target.value)}
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          )}

          {(mt === 'quantity' || mt === 'fixed') && (
            <div>
              <label className="text-sm font-medium text-slate-700">Quantity</label>
              <input
                type="number"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                min={0}
                step={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          )}

          {/* Calculate button */}
          <button
            onClick={calculate}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Calculate
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Results */}
          {result && result.totalValue > 0 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                <p className="text-xs text-slate-500">Estimated cost</p>
                <p className="text-2xl font-bold text-slate-900">${result.cost.toFixed(2)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {result.totalValue.toFixed(2)} {result.unit} × ${spec.pricePerUnit || '0'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Raw measurement</p>
                  <p className="text-base font-semibold text-slate-900">{result.rawValue.toFixed(2)} {result.unit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">
                    Waste {spec.wasteType === 'percent' ? `(${spec.wasteValue}%)` : ''}
                  </p>
                  <p className="text-base font-semibold text-slate-900">+{result.wasteAmount.toFixed(2)} {result.unit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total quantity</p>
                  <p className="text-base font-semibold text-slate-900">{result.totalValue.toFixed(2)} {result.unit}</p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
                  Show calculation
                </summary>
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    Raw = {result.rawValue.toFixed(2)} {result.unit}
                    <br />
                    {spec.wasteType === 'percent'
                      ? `Waste = ${result.rawValue.toFixed(2)} × ${spec.wasteValue}% = ${result.wasteAmount.toFixed(2)} ${result.unit}`
                      : spec.wasteType === 'fixed'
                        ? `Waste = ${spec.wasteValue} ${result.unit} (fixed)`
                        : 'Waste = none'
                    }
                    <br />
                    Total = {result.rawValue.toFixed(2)} + {result.wasteAmount.toFixed(2)} = <strong>{result.totalValue.toFixed(2)} {result.unit}</strong>
                    <br />
                    Cost = {result.totalValue.toFixed(2)} × ${spec.pricePerUnit || '0'} = <strong>${result.cost.toFixed(2)}</strong>
                  </p>
                </div>
              </details>
            </div>
          )}

          {result && result.totalValue === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
              <p className="text-sm text-slate-500">Enter a measurement value greater than zero.</p>
            </div>
          )}
        </div>
      </div>

      {/* Save popup */}
      {showSavePopup && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Save as Smart Component</h3>
            <p className="mt-2 text-sm text-slate-500">
              Create a free QuoteCore+ account to save and reuse this component across quotes. Smart Components
              store materials, waste, pricing, and pitch — ready to drop into any quote.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowSavePopup(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Maybe later
              </button>
              <a
                href="/signup?ref=free-roofing-calculator"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800"
              >
                Create free account
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Sync hint */}
      {showSyncHint && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Your calculations are saved on this device. Create an account to sync across devices.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/signup?ref=free-roofing-calculator"
              className="text-xs font-semibold text-[#FF6B35] hover:text-[#ff5722]"
            >
              Sync now
            </a>
            <button
              onClick={() => {
                setShowSyncHint(false);
                sessionStorage.setItem('qcp:sync-hint-dismissed', '1');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
