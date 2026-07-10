'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState } from '../RoofingCalculator';
import { degreesToRatio, ratioToDegrees, rafterPitchFactor } from '../../lib/calculator';

const RAD = Math.PI / 180;
const COMMON_PITCHES = [10, 15, 20, 25, 30, 35, 40, 45];

type PitchMode = 'degrees' | 'ratio';
type MeasureMode = 'plan' | 'actual';
type InputMode = 'dims' | 'direct';

export function RoofAreaTab() {
  const { areaUnit, lengthUnit } = useUnitSystem();
  const { setShared } = useSharedState();

  const [measureMode, setMeasureMode] = useState<MeasureMode>('plan');
  const [inputMode, setInputMode] = useState<InputMode>('dims');
  const [pitchMode, setPitchMode] = useState<PitchMode>('degrees');

  const [pitchDeg, setPitchDeg] = useState('25');
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState('2.144');
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
    const d = parseFloat(pitchDeg) || 0;
    const factor = rafterPitchFactor(d);

    if (measureMode === 'plan') {
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
      // Actual mode — user enters the actual roof area directly
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

  const showPitch = measureMode === 'plan';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Roof Area Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate actual roof surface area from plan dimensions and pitch
        </p>
      </div>

      {/* Plan / Actual toggle */}
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
          {measureMode === 'plan' ? 'Enter plan-view dimensions, pitch applied' : 'Enter actual roof area directly'}
        </span>
      </div>

      {/* Pitch input (only in plan mode) */}
      {showPitch && (
        <div className="space-y-3">
          {/* Pitch/Ratio toggle */}
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
                <label className="text-sm font-medium text-slate-700">Pitch (degrees)</label>
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
                  {COMMON_PITCHES.map((p) => (
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
                <label className="text-sm font-medium text-slate-700">Pitch ratio (rise : run)</label>
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
            {measureMode === 'plan' ? `Area (${areaUnit})` : `Area (${areaUnit})`}
          </button>
        </div>
      </div>

      {/* Measurement inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {inputMode === 'dims' ? (
          measureMode === 'plan' && (
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
              {measureMode === 'plan' ? `Plan area (${areaUnit})` : `Actual roof area (${areaUnit})`}
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
      {measureMode === 'actual' && inputMode === 'dims' && (
        <p className="text-xs text-slate-400">In Actual mode, use the Area input to enter the measured roof surface area directly.</p>
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
            {result.mode === 'plan' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Plan area</p>
                <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
              </div>
            )}
            {result.mode === 'plan' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Pitch factor</p>
                <p className="text-lg font-semibold text-slate-900">{result.factor.toFixed(4)}</p>
                <p className="mt-1 text-xs text-slate-400">1 / cos({result.deg}°)</p>
              </div>
            )}
            {result.mode === 'actual' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Plan area (derived)</p>
                <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
              </div>
            )}
            {result.mode === 'actual' && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Pitch factor</p>
                <p className="text-lg font-semibold text-slate-900">{result.factor.toFixed(4)}</p>
              </div>
            )}
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Actual roof area</p>
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
                {result.mode === 'plan' ? (
                  inputMode === 'dims'
                    ? `Plan area = width × length = ${width} × ${length} = ${result.planArea.toFixed(2)} ${areaUnit}\nPitch factor = 1 / cos(${result.deg}°) = ${result.factor.toFixed(4)}\nActual roof area = ${result.planArea.toFixed(2)} × ${result.factor.toFixed(4)} = ${result.actualArea.toFixed(2)} ${areaUnit}`
                    : `Plan area = ${result.planArea.toFixed(2)} ${areaUnit}\nPitch factor = 1 / cos(${result.deg}°) = ${result.factor.toFixed(4)}\nActual roof area = ${result.planArea.toFixed(2)} × ${result.factor.toFixed(4)} = ${result.actualArea.toFixed(2)} ${areaUnit}`
                ) : (
                  `Actual roof area = ${result.actualArea.toFixed(2)} ${areaUnit} (entered directly)\nPitch factor = ${result.factor.toFixed(4)}\nPlan area = ${result.actualArea.toFixed(2)} / ${result.factor.toFixed(4)} = ${result.planArea.toFixed(2)} ${areaUnit}`
                ).split('\\n').map((line, i) => (
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
              Use this area for pricing
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
