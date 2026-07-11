'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState, useTradeConfig } from '../TradeCalculator';
import { degreesToRatio, ratioToDegrees, rafterPitchFactor } from '../../../lib/calculator';

type InputMode = 'dims' | 'direct';
type PitchMode = 'degrees' | 'ratio';

/**
 * Batten tab: calculate lineal metres of roofing battens.
 *
 * User enters roof dimensions (or direct area) + pitch → actual roof area.
 * Then batten gauge/spacing → total lineal metres of battens.
 *
 * Formula: lineal_metres = actual_roof_area ÷ batten_gauge × (1 + waste%)
 * Because: battens run horizontally across the roof, number of rows =
 * rafter_length ÷ gauge, and total = rows × roof_width = area ÷ gauge.
 */
export function BattenTab() {
  const { system, lengthUnit, areaUnit } = useUnitSystem();
  const { shared, setShared } = useSharedState();
  const config = useTradeConfig();
  const cfg = config.batten;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the batten tab without a batten config`);

  const isMetric = system === 'metric';

  // ── Input state ──
  const [inputMode, setInputMode] = useState<InputMode>('dims');
  const [pitchMode, setPitchMode] = useState<PitchMode>('degrees');

  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [directArea, setDirectArea] = useState(shared.calculatedArea ?? '');

  const [pitchDeg, setPitchDeg] = useState('35');
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState(() => {
    const r = degreesToRatio(35);
    return r.y ? r.y.toFixed(3) : '0.7';
  });

  const defaultGaugeDisplay = isMetric
    ? cfg.defaultGauge
    : (parseFloat(cfg.defaultGauge) / 25.4).toFixed(1);

  const [gauge, setGauge] = useState(defaultGaugeDisplay);
  const [waste, setWaste] = useState(cfg.defaultWastePercent);

  const [result, setResult] = useState<null | {
    planArea: number;
    pitchFactor: number;
    actualArea: number;
    deg: number;
    gaugeM: number;
    gaugeDisplay: string;
    rawLineal: number;
    wastePct: number;
    totalLineal: number;
    approxRows: number;
  }>(null);

  function handleDegChange(v: string) {
    setPitchDeg(v);
    const d = parseFloat(v) || 0;
    const r = degreesToRatio(d);
    setRatioY(r.y.toFixed(3));
  }

  function handleRatioChange(y: string) {
    setRatioY(y);
    const x = parseFloat(ratioX) || 1;
    const yv = parseFloat(y) || 0;
    const d = ratioToDegrees(x, yv);
    setPitchDeg(d.toFixed(1));
  }

  function calculate() {
    const d = parseFloat(pitchDeg) || 0;
    const factor = rafterPitchFactor(d);

    // Calculate plan area from dims or direct
    let planArea = 0;
    if (inputMode === 'dims') {
      const w = parseFloat(width) || 0;
      const l = parseFloat(length) || 0;
      planArea = w * l;
    } else {
      planArea = parseFloat(directArea) || 0;
    }

    const actualArea = planArea * factor;
    const g = parseFloat(gauge) || 0;
    const w = parseFloat(waste) || 0;

    // Convert gauge to metres (metric: mm→m) or feet (imperial: in→ft)
    const gaugeM = isMetric ? g / 1000 : g / 12;
    const rawLineal = gaugeM > 0 ? actualArea / gaugeM : 0;
    const totalLineal = rawLineal * (1 + w / 100);

    // Approx rows = rafter length ÷ gauge
    // Rafter length ≈ √(plan_area) for a square-ish roof, or width / cos(pitch)
    // Simplify: rows ≈ actualArea / (gaugeM × √actualArea) = √actualArea / gaugeM
    const approxRows = gaugeM > 0 && actualArea > 0
      ? Math.ceil(Math.sqrt(actualArea) / gaugeM)
      : 0;

    setResult({
      planArea,
      pitchFactor: factor,
      actualArea,
      deg: d,
      gaugeM,
      gaugeDisplay: String(g),
      rawLineal,
      wastePct: w,
      totalLineal,
      approxRows,
    });
  }

  function useForPricing() {
    if (!result) return;
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
      {shared.calculatedArea && inputMode === 'direct' && !directArea && (
        <div className="rounded-lg bg-orange-50/50 border border-orange-100 p-3">
          <p className="text-xs text-slate-600">
            <span className="font-medium text-[#FF6B35]">From previous tab:</span>{' '}
            {shared.calculatedArea} {areaUnit} roof area — already filled in below.
          </p>
        </div>
      )}

      {/* Input mode toggle: W×L or direct area */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setInputMode('dims')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              inputMode === 'dims' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            W × L
          </button>
          <button
            onClick={() => setInputMode('direct')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              inputMode === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Area ({areaUnit})
          </button>
        </div>
      </div>

      {/* Roof dimensions / area */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {inputMode === 'dims' ? (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700">Roof width ({lengthUnit})</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min={0}
                step={0.1}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Roof length ({lengthUnit})</label>
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                min={0}
                step={0.1}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </>
        ) : (
          <div className="sm:col-span-1">
            <label className="text-sm font-medium text-slate-700">Plan roof area ({areaUnit})</label>
            <input
              type="number"
              value={directArea}
              onChange={(e) => setDirectArea(e.target.value)}
              min={0}
              step={0.1}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Enter the plan (footprint) area — pitch is applied below.</p>
          </div>
        )}

        {/* Pitch input */}
        <div className={inputMode === 'dims' ? '' : 'sm:col-span-2'}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setPitchMode('degrees')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  pitchMode === 'degrees' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Degrees
              </button>
              <button
                onClick={() => setPitchMode('ratio')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  pitchMode === 'ratio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Ratio
              </button>
            </div>
          </div>
          {pitchMode === 'degrees' ? (
            <div>
              <label className="text-sm font-medium text-slate-700">Roof pitch (degrees)</label>
              <input
                type="number"
                value={pitchDeg}
                onChange={(e) => handleDegChange(e.target.value)}
                min={0}
                max={89}
                step={0.5}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[15, 25, 30, 35, 40, 45].map((p) => (
                  <button
                    key={p}
                    onClick={() => handleDegChange(String(p))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      (parseFloat(pitchDeg) || 0) === p
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {p}°
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700">Roof pitch (rise : run)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  value={ratioX}
                  onChange={(e) => setRatioX(e.target.value)}
                  min={0}
                  step={1}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <span className="text-slate-400">:</span>
                <input
                  type="number"
                  value={ratioY}
                  onChange={(e) => handleRatioChange(e.target.value)}
                  min={0}
                  step={0.001}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">= {pitchDeg}°</p>
            </div>
          )}
        </div>
      </div>

      {/* Batten gauge + waste */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">
            Batten gauge/spacing ({isMetric ? 'mm' : 'in'})
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
          <p className="mt-2 text-xs text-slate-400">
            Examples only — always refer to the tile manufacturer's specification for exact batten gauge.
          </p>
        </div>

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
            {result.pitchFactor > 1 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Plan area</p>
                <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
                <p className="mt-1 text-xs text-slate-400">Pitch factor: {result.pitchFactor.toFixed(4)}</p>
              </div>
            )}
            <div className={`rounded-xl ${result.pitchFactor > 1 ? 'bg-slate-50 border-slate-100' : 'bg-slate-50 border-slate-100'} border p-4`}>
              <p className="text-xs text-slate-500">Actual roof area</p>
              <p className="text-lg font-semibold text-slate-900">{result.actualArea.toFixed(2)} {areaUnit}</p>
              {result.pitchFactor > 1 && (
                <p className="mt-1 text-xs text-slate-400">{result.planArea.toFixed(2)} × {result.pitchFactor.toFixed(4)}</p>
              )}
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
              <p className="text-xs text-slate-400">Batten rows (approx, mono pitch)</p>
              <p className="text-sm font-semibold text-slate-700">{result.approxRows || '—'}</p>
            </div>
          </div>

          {/* Warnings */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">
                  This calculation is based on a basic mono-pitch roof and does not account for extra battens needed for hips, valleys, or ridge lines.
                </p>
                <p className="text-xs text-amber-700">
                  These additional battens must be added manually based on your roof design.
                </p>
              </div>
            </div>
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                {result.pitchFactor > 1 ? (
                  <>
                    Plan area = {inputMode === 'dims' ? `${width} × ${length} = ` : ''}{result.planArea.toFixed(2)} {areaUnit}
                    <br />
                    Pitch factor = 1 / cos({result.deg}°) = {result.pitchFactor.toFixed(4)}
                    <br />
                    Actual roof area = {result.planArea.toFixed(2)} × {result.pitchFactor.toFixed(4)} = {result.actualArea.toFixed(2)} {areaUnit}
                    <br />
                    <br />
                  </>
                ) : null}
                Total battens = actual_area ÷ batten_gauge × (1 + waste%)
                <br />
                = {result.actualArea.toFixed(2)} {areaUnit} ÷ {result.gaugeDisplay}{isMetric ? 'mm' : 'in'}
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
