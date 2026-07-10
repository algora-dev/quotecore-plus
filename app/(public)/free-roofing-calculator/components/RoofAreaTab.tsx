'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState } from '../RoofingCalculator';
import { degreesToRatio, ratioToDegrees, rafterPitchFactor } from '../../lib/calculator';

const RAD = Math.PI / 180;
const COMMON_PITCHES = [10, 15, 20, 25, 30, 35, 40, 45];

type PitchMode = 'degrees' | 'ratio';

export function RoofAreaTab() {
  const { areaUnit, lengthUnit } = useUnitSystem();
  const { setShared } = useSharedState();

  const [mode, setMode] = useState<PitchMode>('degrees');
  const [pitchDeg, setPitchDeg] = useState('25');
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState('2.144');
  const [width, setWidth] = useState('10');
  const [length, setLength] = useState('8');
  const [result, setResult] = useState<null | {
    planArea: number;
    factor: number;
    actualArea: number;
    deg: number;
  }>(null);

  // Sync ratio when degrees change
  function handleDegChange(v: string) {
    setPitchDeg(v);
    const d = parseFloat(v) || 0;
    const r = degreesToRatio(d);
    setRatioY(r.y.toFixed(3));
  }

  // Sync degrees when ratio changes
  function handleRatioChange(y: string) {
    setRatioY(y);
    const x = parseFloat(ratioX) || 1;
    const yv = parseFloat(y) || 0;
    const d = ratioToDegrees(x, yv);
    setPitchDeg(d.toFixed(1));
  }

  function calculate() {
    const d = parseFloat(pitchDeg) || 0;
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const planArea = w * l;
    const factor = rafterPitchFactor(d);
    const actualArea = planArea * factor;
    setResult({ planArea, factor, actualArea, deg: d });
  }

  function useForPricing() {
    if (result) {
      setShared({ calculatedArea: result.actualArea.toFixed(2) });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Roof Area Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate actual roof surface area from plan dimensions and pitch
        </p>
      </div>

      {/* Pitch/Ratio toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setMode('degrees')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'degrees' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Degrees
          </button>
          <button
            onClick={() => setMode('ratio')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'ratio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Ratio
          </button>
        </div>
        <Tooltip
          text={mode === 'degrees'
            ? 'Pitch in degrees from horizontal. 0° = flat, 45° = steep.'
            : 'Pitch as a ratio (e.g. 1:2.144). First number is rise, second is run.'}
        />
      </div>

      {/* Pitch input */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {mode === 'degrees' ? (
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
            <p className="mt-2 text-xs text-slate-400">
              = {pitchDeg}°
            </p>
          </div>
        )}

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
              <p className="text-xs text-slate-500">Plan area</p>
              <p className="text-lg font-semibold text-slate-900">{result.planArea.toFixed(2)} {areaUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Pitch factor</p>
              <p className="text-lg font-semibold text-slate-900">{result.factor.toFixed(4)}</p>
              <p className="mt-1 text-xs text-slate-400">1 / cos({result.deg}°)</p>
            </div>
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
                Plan area = width × length = {width} × {length} = <strong>{result.planArea.toFixed(2)} {areaUnit}</strong>
                <br />
                Pitch factor = 1 / cos({result.deg}°) = {result.factor.toFixed(4)}
                <br />
                Actual roof area = {result.planArea.toFixed(2)} × {result.factor.toFixed(4)} = <strong>{result.actualArea.toFixed(2)} {areaUnit}</strong>
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

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Help"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>
      {show && (
        <div className="absolute z-[60] left-0 top-6 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
          <p className="text-xs text-slate-600 leading-relaxed">{text}</p>
        </div>
      )}
    </div>
  );
}
