'use client';

import { useState } from 'react';
import { useUnitSystem, useTradeConfig } from '../TradeCalculator';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

type GradientMode = 'ratio' | 'percent' | 'degrees';

/**
 * Gradient / falls tab: convert between 1-in-X, percent, and degrees,
 * and work out the fall (or rise) over a given run plus the true slope length.
 * Used by landscaping ("Slope & Gradient") and concrete ("Falls & Gradients").
 */
export function GradientTab() {
  const { lengthUnit } = useUnitSystem();
  const config = useTradeConfig();
  const cfg = config.gradient;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the gradient tab without a gradient config`);

  const [mode, setMode] = useState<GradientMode>('ratio');
  const [ratioX, setRatioX] = useState('80');
  const [percent, setPercent] = useState('1.25');
  const [degrees, setDegrees] = useState('0.72');
  const [run, setRun] = useState('10');

  const [result, setResult] = useState<null | {
    deg: number;
    ratioX: number;
    percent: number;
    run: number;
    fall: number;
    slopeLength: number;
  }>(null);

  // Keep the three representations in sync from whichever one was edited
  function syncFromRatio(v: string) {
    setRatioX(v);
    const x = parseFloat(v) || 0;
    if (x > 0) {
      const d = Math.atan(1 / x) * DEG;
      setDegrees(d.toFixed(2));
      setPercent(((1 / x) * 100).toFixed(2));
    }
  }

  function syncFromPercent(v: string) {
    setPercent(v);
    const p = parseFloat(v) || 0;
    if (p > 0) {
      const d = Math.atan(p / 100) * DEG;
      setDegrees(d.toFixed(2));
      setRatioX((100 / p).toFixed(1));
    }
  }

  function syncFromDegrees(v: string) {
    setDegrees(v);
    const d = parseFloat(v) || 0;
    if (d > 0 && d < 90) {
      const t = Math.tan(d * RAD);
      setPercent((t * 100).toFixed(2));
      setRatioX((1 / t).toFixed(1));
    }
  }

  function calculate() {
    const d = parseFloat(degrees) || 0;
    const x = parseFloat(ratioX) || 0;
    const p = parseFloat(percent) || 0;
    const r = parseFloat(run) || 0;
    const t = Math.tan(d * RAD);
    const fall = r * t;
    const slopeLength = d < 90 ? r / Math.cos(d * RAD) : r;
    setResult({ deg: d, ratioX: x, percent: p, run: r, fall, slopeLength });
  }

  const fallWord = cfg.fallWord;
  const fallWordCap = fallWord.charAt(0).toUpperCase() + fallWord.slice(1);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      {/* Input mode toggle */}
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
        {([
          { value: 'ratio', label: '1 in X' },
          { value: 'percent', label: 'Percent' },
          { value: 'degrees', label: 'Degrees' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'ratio' && (
          <div>
            <label className="text-sm font-medium text-slate-700">Gradient (1 in X)</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-slate-500">1 in</span>
              <input
                type="number"
                value={ratioX}
                onChange={(e) => syncFromRatio(e.target.value)}
                min={0}
                step={1}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cfg.commonRatios.map((x) => (
                <button
                  key={x}
                  onClick={() => syncFromRatio(String(x))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    (parseFloat(ratioX) || 0) === x
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  1 in {x}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">= {percent}% = {degrees}°</p>
          </div>
        )}
        {mode === 'percent' && (
          <div>
            <label className="text-sm font-medium text-slate-700">Gradient (%)</label>
            <input
              type="number"
              value={percent}
              onChange={(e) => syncFromPercent(e.target.value)}
              min={0}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">= 1 in {ratioX} = {degrees}°</p>
          </div>
        )}
        {mode === 'degrees' && (
          <div>
            <label className="text-sm font-medium text-slate-700">Gradient (degrees)</label>
            <input
              type="number"
              value={degrees}
              onChange={(e) => syncFromDegrees(e.target.value)}
              min={0}
              max={89}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">= 1 in {ratioX} = {percent}%</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-700">{cfg.runLabel} ({lengthUnit})</label>
          <input
            type="number"
            value={run}
            onChange={(e) => setRun(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">{cfg.runHint}</p>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Gradient</p>
              <p className="text-base font-semibold text-slate-900">1 in {result.ratioX || '-'}</p>
              <p className="mt-1 text-xs text-slate-400">{result.percent}% · {result.deg}°</p>
            </div>
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">{fallWordCap} over {result.run} {lengthUnit}</p>
              <p className="text-lg font-bold text-slate-900">
                {result.fall < 1 ? `${(result.fall * 1000).toFixed(0)} mm` : `${result.fall.toFixed(3)} ${lengthUnit}`}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Slope length</p>
              <p className="text-base font-semibold text-slate-900">{result.slopeLength.toFixed(3)} {lengthUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">{fallWordCap} per {lengthUnit}</p>
              <p className="text-base font-semibold text-slate-900">
                {(result.fall / (result.run || 1) * 1000).toFixed(1)} mm
              </p>
            </div>
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                Gradient = 1 in {result.ratioX} = {result.percent}% = {result.deg}°
                <br />
                {fallWordCap} = run × tan({result.deg}°) = {result.run} × {Math.tan(result.deg * RAD).toFixed(5)} = <strong>{result.fall.toFixed(3)} {lengthUnit}</strong>
                <br />
                Slope length = run / cos({result.deg}°) = {result.slopeLength.toFixed(3)} {lengthUnit}
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
