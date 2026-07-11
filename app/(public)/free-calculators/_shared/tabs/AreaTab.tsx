'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState, useTradeConfig } from '../TradeCalculator';
import { degreesToRatio, ratioToDegrees, rafterPitchFactor } from '../../../lib/calculator';

type PitchMode = 'degrees' | 'ratio';
type MeasureMode = 'plan' | 'actual';
type InputMode = 'dims' | 'direct';

export function AreaTab() {
  const { areaUnit, lengthUnit } = useUnitSystem();
  const { setShared } = useSharedState();
  const config = useTradeConfig();
  const cfg = config.area;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the area tab without an area config`);

  const slope = cfg.slopeWord;

  const [measureMode, setMeasureMode] = useState<MeasureMode>('plan');
  const [inputMode, setInputMode] = useState<InputMode>('dims');
  const [pitchMode, setPitchMode] = useState<PitchMode>('degrees');

  const [pitchDeg, setPitchDeg] = useState(cfg.defaultSlope);
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState(() => {
    const r = degreesToRatio(parseFloat(cfg.defaultSlope) || 0);
    return r.y ? r.y.toFixed(3) : '0';
  });
  const [width, setWidth] = useState('10');
  const [length, setLength] = useState('8');
  const [directArea, setDirectArea] = useState('');

  const [result, setResult] = useState<null | {
    planArea: number;
    factor: number;
    actualArea: number;
    deg: number;
    mode: MeasureMode;
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
    const d = cfg!.useSlopeFactor ? parseFloat(pitchDeg) || 0 : 0;
    const factor = cfg!.useSlopeFactor ? rafterPitchFactor(d) : 1;

    if (measureMode === 'plan' || !cfg!.useSlopeFactor) {
      let planArea = 0;
      if (inputMode === 'dims') {
        const w = parseFloat(width) || 0;
        const l = parseFloat(length) || 0;
        planArea = w * l;
      } else {
        planArea = parseFloat(directArea) || 0;
      }
      const actualArea = planArea * factor;
      setResult({ planArea, factor, actualArea, deg: d, mode: 'plan' });
    } else {
      // Actual mode — user enters the actual surface area directly
      const actualArea = parseFloat(directArea) || 0;
      const planArea = factor > 0 ? actualArea / factor : actualArea;
      setResult({ planArea, factor, actualArea, deg: d, mode: 'actual' });
    }
  }

  function useForPricing() {
    if (result) {
      setShared({ calculatedArea: result.actualArea.toFixed(2) });
    }
  }

  const showModeToggle = cfg.useSlopeFactor;
  const showPitch = cfg.useSlopeFactor && measureMode === 'plan';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      {/* Plan / Actual toggle */}
      {showModeToggle && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setMeasureMode('plan')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                measureMode === 'plan' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => setMeasureMode('actual')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                measureMode === 'actual' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Actual
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {measureMode === 'plan' ? cfg.planHint : cfg.actualHint}
          </span>
        </div>
      )}

      {/* Slope input (only in plan mode, when factor applies) */}
      {showPitch && (
        <div className="space-y-3">
          {/* Degrees/Ratio toggle */}
          <div className="flex items-center gap-3">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {pitchMode === 'degrees' ? (
              <div>
                <label className="text-sm font-medium text-slate-700">{slope} (degrees)</label>
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
                  {cfg.commonSlopes.map((p) => (
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
                <label className="text-sm font-medium text-slate-700">{slope} ratio (rise : run)</label>
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
      )}

      {/* Dimension / Direct area toggle */}
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

      {/* Measurement inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {inputMode === 'dims' ? (
          (measureMode === 'plan' || !cfg.useSlopeFactor) && (
            <>
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
            </>
          )
        ) : (
          <div className="sm:col-span-1">
            <label className="text-sm font-medium text-slate-700">
              {measureMode === 'plan' || !cfg.useSlopeFactor
                ? `${cfg.planLabel} (${areaUnit})`
                : `${cfg.actualLabel} (${areaUnit})`}
            </label>
            <input
              type="number"
              value={directArea}
              onChange={(e) => setDirectArea(e.target.value)}
              min={0}
              step={0.1}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* In actual mode with dims, show a note */}
      {cfg.useSlopeFactor && measureMode === 'actual' && inputMode === 'dims' && (
        <p className="text-xs text-slate-400">{cfg.actualDimsNote}</p>
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
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cfg.useSlopeFactor && result.mode === 'plan' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{cfg.planLabel}</p>
                <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
              </div>
            )}
            {cfg.useSlopeFactor && result.mode === 'plan' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{slope} factor</p>
                <p className="text-lg font-semibold text-slate-900">{result.factor.toFixed(4)}</p>
                <p className="mt-1 text-xs text-slate-400">1 / cos({result.deg}°)</p>
              </div>
            )}
            {cfg.useSlopeFactor && result.mode === 'actual' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{cfg.planLabel} (derived)</p>
                <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
              </div>
            )}
            {cfg.useSlopeFactor && result.mode === 'actual' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{slope} factor</p>
                <p className="text-lg font-semibold text-slate-900">{result.factor.toFixed(4)}</p>
              </div>
            )}
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">{cfg.actualLabel}</p>
              <p className="text-2xl font-bold text-slate-900">{result.actualArea.toFixed(2)} {areaUnit}</p>
            </div>
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                {(!cfg.useSlopeFactor
                  ? (inputMode === 'dims'
                      ? `${cfg.planLabel} = width × length = ${width} × ${length} = ${result.actualArea.toFixed(2)} ${areaUnit}`
                      : `${cfg.planLabel} = ${result.actualArea.toFixed(2)} ${areaUnit} (entered directly)`)
                  : result.mode === 'plan' ? (
                  inputMode === 'dims'
                    ? `${cfg.planLabel} = width × length = ${width} × ${length} = ${result.planArea.toFixed(2)} ${areaUnit}\n${slope} factor = 1 / cos(${result.deg}°) = ${result.factor.toFixed(4)}\n${cfg.actualLabel} = ${result.planArea.toFixed(2)} × ${result.factor.toFixed(4)} = ${result.actualArea.toFixed(2)} ${areaUnit}`
                    : `${cfg.planLabel} = ${result.planArea.toFixed(2)} ${areaUnit}\n${slope} factor = 1 / cos(${result.deg}°) = ${result.factor.toFixed(4)}\n${cfg.actualLabel} = ${result.planArea.toFixed(2)} × ${result.factor.toFixed(4)} = ${result.actualArea.toFixed(2)} ${areaUnit}`
                ) : (
                  `${cfg.actualLabel} = ${result.actualArea.toFixed(2)} ${areaUnit} (entered directly)\n${slope} factor = ${result.factor.toFixed(4)}\n${cfg.planLabel} = ${result.actualArea.toFixed(2)} / ${result.factor.toFixed(4)} = ${result.planArea.toFixed(2)} ${areaUnit}`
                )).split('\n').map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
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
