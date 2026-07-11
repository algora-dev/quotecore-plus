'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState, useTradeConfig } from '../TradeCalculator';

/**
 * Batten tab: calculate lineal metres of roofing battens from roof area
 * and batten gauge (spacing).
 *
 * Formula: lineal_metres = roof_area ÷ batten_gauge
 * Because: battens run horizontally across the roof, number of rows =
 * rafter_length ÷ gauge, and total = rows × roof_width = area ÷ gauge.
 *
 * The pitch is used to suggest appropriate gauge presets but does not
 * affect the maths (the area already accounts for pitch).
 */
export function BattenTab() {
  const { system, lengthUnit, areaUnit } = useUnitSystem();
  const { shared, setShared } = useSharedState();
  const config = useTradeConfig();
  const cfg = config.batten;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the batten tab without a batten config`);

  const isMetric = system === 'metric';

  // Convert default gauge from mm to inches if imperial
  const defaultGaugeDisplay = isMetric
    ? cfg.defaultGauge
    : (parseFloat(cfg.defaultGauge) / 25.4).toFixed(1);

  const [area, setArea] = useState(shared.calculatedArea ?? '');
  const [gauge, setGauge] = useState(defaultGaugeDisplay);
  const [waste, setWaste] = useState(cfg.defaultWastePercent);

  const [result, setResult] = useState<null | {
    area: number;
    gaugeM: number;
    gaugeDisplay: string;
    rawLineal: number;
    wastePct: number;
    totalLineal: number;
  }>(null);

  function calculate() {
    const a = parseFloat(area) || 0;
    const g = parseFloat(gauge) || 0;
    const w = parseFloat(waste) || 0;

    // Convert gauge to metres (metric: mm→m) or feet (imperial: in→ft)
    const gaugeM = isMetric ? g / 1000 : g / 12;
    const rawLineal = gaugeM > 0 ? a / gaugeM : 0;
    const totalLineal = rawLineal * (1 + w / 100);

    setResult({
      area: a,
      gaugeM,
      gaugeDisplay: String(g),
      rawLineal,
      wastePct: w,
      totalLineal,
    });
  }

  function useForPricing() {
    if (!result) return;
    // Store as linear metres for the smart component
    setShared({ calculatedArea: result.totalLineal.toFixed(2) });
  }

  // Preset buttons — convert mm to current unit
  const presets = cfg.gaugePresets.map((p) => ({
    label: p.label,
    value: isMetric ? String(p.mm) : (p.mm / 25.4).toFixed(1),
  }));

  const linealUnit = isMetric ? 'm' : 'ft';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      {/* Prefill note */}
      {shared.calculatedArea && (
        <div className="rounded-lg bg-orange-50/50 border border-orange-100 p-3">
          <p className="text-xs text-slate-600">
            <span className="font-medium text-[#FF6B35]">From previous tab:</span>{' '}
            {shared.calculatedArea} {areaUnit} roof area — already filled in below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Roof area */}
        <div>
          <label className="text-sm font-medium text-slate-700">Roof area ({areaUnit})</label>
          <input
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            min={0}
            step={0.1}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Batten gauge */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            Batten gauge ({isMetric ? 'mm' : 'in'})
          </label>
          <input
            type="number"
            value={gauge}
            onChange={(e) => setGauge(e.target.value)}
            min={0}
            step={isMetric ? 5 : 0.5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setGauge(p.value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  gauge === p.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {p.label} ({p.value}{isMetric ? 'mm' : 'in'})
              </button>
            ))}
          </div>
        </div>

        {/* Waste */}
        <div>
          <label className="text-sm font-medium text-slate-700">Waste (%)</label>
          <input
            type="number"
            value={waste}
            onChange={(e) => setWaste(e.target.value)}
            min={0}
            max={50}
            step={1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
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
              <p className="text-xs text-slate-500">Roof area</p>
              <p className="text-lg font-semibold text-slate-900">{result.area.toFixed(2)} {areaUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Batten gauge</p>
              <p className="text-lg font-semibold text-slate-900">{result.gaugeDisplay} {isMetric ? 'mm' : 'in'}</p>
            </div>
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Total battens (incl. waste)</p>
              <p className="text-2xl font-bold text-slate-900">{result.totalLineal.toFixed(1)} {linealUnit}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white border border-slate-100 p-3">
              <p className="text-xs text-slate-400">Raw lineal (no waste)</p>
              <p className="text-sm font-semibold text-slate-700">{result.rawLineal.toFixed(1)} {linealUnit}</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-100 p-3">
              <p className="text-xs text-slate-400">Waste added</p>
              <p className="text-sm font-semibold text-slate-700">{result.wastePct}% = +{(result.totalLineal - result.rawLineal).toFixed(1)} {linealUnit}</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-100 p-3">
              <p className="text-xs text-slate-400">Batten rows (approx)</p>
              <p className="text-sm font-semibold text-slate-700">
                {result.gaugeM > 0 ? Math.ceil(result.area / (result.gaugeM * Math.sqrt(result.area))) : '—'}
              </p>
            </div>
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                Total battens = roof_area ÷ batten_gauge × (1 + waste%)
                <br />
                = {result.area.toFixed(2)} {areaUnit} ÷ {result.gaugeDisplay}{isMetric ? 'mm' : 'in'}
                {' '}= {result.rawLineal.toFixed(1)} {linealUnit} (raw)
                <br />
                = {result.rawLineal.toFixed(1)} × (1 + {result.wastePct}%)
                {' '}= <strong>{result.totalLineal.toFixed(1)} {linealUnit}</strong>
                <br /><br />
                <span className="text-slate-400">
                  How it works: battens run horizontally across the roof.
                  Number of rows = rafter_length ÷ gauge. Each row = roof_width.
                  Total = rows × width = (rafter_length × roof_width) ÷ gauge = area ÷ gauge.
                </span>
              </p>
            </div>
          </details>

          {/* Use for pricing */}
          <div className="flex justify-end">
            <button
              onClick={useForPricing}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
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
