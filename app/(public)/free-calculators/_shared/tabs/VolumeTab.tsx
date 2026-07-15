'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState, useTradeConfig } from '../TradeCalculator';

/**
 * Volume tab: L × W × depth with trade depth presets (concrete-first).
 * Outputs volume + waste allowance + estimated weight, and can push the
 * volume into the Draft Smart Component tab for pricing.
 */
export function VolumeTab() {
  const { lengthUnit, volumeUnit, system } = useUnitSystem();
  const { setShared } = useSharedState();
  const config = useTradeConfig();
  const cfg = config.volume;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the volume tab without a volume config`);

  const [length, setLength] = useState('4');
  const [width, setWidth] = useState('3');
  const [depthMm, setDepthMm] = useState(String(cfg.depthPresets[1]?.mm ?? cfg.depthPresets[0]?.mm ?? 100));
  const [wastePercent, setWastePercent] = useState(cfg.defaultWastePercent);

  const [result, setResult] = useState<null | {
    l: number;
    w: number;
    depthM: number;
    volume: number;
    volumeWithWaste: number;
    weightKg: number;
    waste: number;
  }>(null);

  const metric = system === 'metric';

  function calculate() {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    // depth entered in mm (metric) or inches (imperial)
    const depthRaw = parseFloat(depthMm) || 0;
    const depthM = metric ? depthRaw / 1000 : depthRaw / 12; // → m or ft
    const volume = l * w * depthM;
    const waste = parseFloat(wastePercent) || 0;
    const volumeWithWaste = volume * (1 + waste / 100);
    // weight only meaningful in metric (kg/m³)
    const weightKg = metric ? volumeWithWaste * cfg!.densityKgPerM3 : 0;
    setResult({ l, w, depthM, volume, volumeWithWaste, weightKg, waste });
  }

  function useForPricing() {
    if (result) {
      setShared({ calculatedVolume: result.volumeWithWaste.toFixed(2) });
    }
  }

  const depthUnit = metric ? 'mm' : 'in';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Length ({lengthUnit})</label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Width ({lengthUnit})</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Depth ({depthUnit})</label>
          <input
            type="number"
            value={depthMm}
            onChange={(e) => setDepthMm(e.target.value)}
            min={0}
            step={metric ? 5 : 0.5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          {metric && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cfg.depthPresets.map((p) => (
                <button
                  key={p.mm}
                  onClick={() => setDepthMm(String(p.mm))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    (parseFloat(depthMm) || 0) === p.mm
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Waste allowance (%)</label>
          <input
            type="number"
            value={wastePercent}
            onChange={(e) => setWastePercent(e.target.value)}
            min={0}
            step={1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">Covers spillage, uneven sub-base, and over-dig</p>
        </div>
      </div>

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
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Volume (no waste)</p>
              <p className="text-lg font-semibold text-slate-900">{result.volume.toFixed(2)} {volumeUnit}</p>
            </div>
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Volume to order (+{result.waste}%)</p>
              <p className="text-2xl font-bold text-slate-900">{result.volumeWithWaste.toFixed(2)} {volumeUnit}</p>
            </div>
            {metric && cfg.densityKgPerM3 > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Approx. weight ({cfg.densityLabel})</p>
                <p className="text-lg font-semibold text-slate-900">
                  {result.weightKg >= 1000 ? `${(result.weightKg / 1000).toFixed(2)} t` : `${result.weightKg.toFixed(0)} kg`}
                </p>
              </div>
            )}
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                Volume = length × width × depth = {result.l} × {result.w} × {result.depthM.toFixed(3)} = {result.volume.toFixed(3)} {volumeUnit}
                <br />
                With waste = {result.volume.toFixed(3)} × {(1 + result.waste / 100).toFixed(2)} = <strong>{result.volumeWithWaste.toFixed(2)} {volumeUnit}</strong>
                {metric && cfg.densityKgPerM3 > 0 && (
                  <>
                    <br />
                    Weight = {result.volumeWithWaste.toFixed(2)} × {cfg.densityKgPerM3} kg/m³ = {result.weightKg.toFixed(0)} kg
                  </>
                )}
              </p>
            </div>
          </details>

          {/* Use for pricing */}
          <div className="flex justify-end">
            <button
              onClick={useForPricing}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#FF6B35] hover:text-[#BD4A1A]"
            >
              {cfg.useForPricingLabel}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
