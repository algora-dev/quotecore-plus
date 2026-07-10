'use client';

import { useState, useRef, useEffect } from 'react';
import { useUnitSystem } from '../RoofingCalculator';
import { estimateMaterial, ROOFING_MATERIALS } from '../../lib/calculator';

interface Props {
  material: string;
  waste: string;
  pricePerUnit: string;
  areaOverride: string;
  pitch: string;
  onMaterialChange: (v: string) => void;
  onWasteChange: (v: string) => void;
  onPriceChange: (v: string) => void;
}

export function MaterialPanel({
  material, waste, pricePerUnit, areaOverride, pitch,
  onMaterialChange, onWasteChange, onPriceChange,
}: Props) {
  const { areaUnit } = useUnitSystem();
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showSyncHint, setShowSyncHint] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Scroll into view when area is pre-filled from Panel 2
  useEffect(() => {
    if (areaOverride && !hasScrolled) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHasScrolled(true);
    }
  }, [areaOverride, hasScrolled]);

  const area = parseFloat(areaOverride) || 0;
  const wasteNum = parseFloat(waste) || 0;
  const priceNum = parseFloat(pricePerUnit) || 0;
  const coverage = ROOFING_MATERIALS[material];

  const result = coverage
    ? estimateMaterial(area, coverage.coverage, coverage.unit, wasteNum, priceNum > 0 ? priceNum : undefined)
    : null;

  // Show sync hint after first calculation
  useEffect(() => {
    if (result && result.quantity > 0) {
      const dismissed = sessionStorage.getItem('qcp:sync-hint-dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowSyncHint(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [result?.quantity]);

  return (
    <div ref={panelRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Material Estimator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Build a Smart Component with your material specs, then calculate quantities
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Component spec builder */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Component spec
          </h3>

          <div>
            <label className="text-sm font-medium text-slate-700">Material type</label>
            <select
              value={material}
              onChange={(e) => onMaterialChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {Object.keys(ROOFING_MATERIALS).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Waste (%)</label>
            <input
              type="number"
              value={waste}
              onChange={(e) => onWasteChange(e.target.value)}
              min={0}
              max={100}
              step={1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Price per {coverage?.unit || 'unit'} (optional)</label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">$</span>
              <input
                type="number"
                value={pricePerUnit}
                onChange={(e) => onPriceChange(e.target.value)}
                min={0}
                step={0.01}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Pitch (inherited)</p>
            <p className="text-sm font-semibold text-slate-900">{pitch}°</p>
          </div>

          {/* Save as Smart Component CTA */}
          <button
            onClick={() => setShowSavePopup(true)}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            Save as Smart Component
          </button>
        </div>

        {/* Right: Measurement + results */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Measurement
          </h3>

          <div>
            <label className="text-sm font-medium text-slate-700">Roof area ({areaUnit})</label>
            <input
              type="number"
              value={areaOverride}
              onChange={(e) => onPriceChange(e.target.value)}
              min={0}
              step={0.1}
              placeholder="Enter area or use from above"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            {areaOverride && (
              <p className="mt-1 text-xs text-slate-400">Pre-filled from roof area calculation</p>
            )}
          </div>

          {result && area > 0 && (
            <>
              <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                <p className="text-xs text-slate-500">Estimated quantity needed</p>
                <p className="text-2xl font-bold text-slate-900">
                  {result.quantity} {result.unit}
                </p>
                {result.costEstimate != null && (
                  <p className="mt-2 text-sm text-slate-600">
                    Estimated cost: <span className="font-semibold">${result.costEstimate.toFixed(2)}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Raw area</p>
                  <p className="text-base font-semibold text-slate-900">{result.rawArea.toFixed(2)} {areaUnit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">With waste ({result.wastePercent}%)</p>
                  <p className="text-base font-semibold text-slate-900">{result.areaWithWaste.toFixed(2)} {areaUnit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Coverage rate</p>
                  <p className="text-base font-semibold text-slate-900">
                    {coverage.coverage} {areaUnit}/{result.unit}
                  </p>
                </div>
              </div>

              {/* Expandable calculation */}
              <details className="mt-2 group">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
                  Show calculation
                </summary>
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    Area with waste = {result.rawArea.toFixed(2)} × (1 + {result.wastePercent}%) = {result.areaWithWaste.toFixed(2)} {areaUnit}
                    <br />
                    Quantity = {result.areaWithWaste.toFixed(2)} / {coverage.coverage} = <strong>{result.quantity} {result.unit}</strong>
                    {result.costEstimate != null && (
                      <>
                        <br />
                        Cost = {result.quantity} × ${priceNum.toFixed(2)} = <strong>${result.costEstimate.toFixed(2)}</strong>
                      </>
                    )}
                  </p>
                </div>
              </details>
            </>
          )}

          {area === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
              <p className="text-sm text-slate-500">
                Enter a roof area above or calculate it in the roof area panel.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save as Smart Component popup */}
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

      {/* Sync hint (subtle, dismissable) */}
      {showSyncHint && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-center justify-between gap-3">
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
