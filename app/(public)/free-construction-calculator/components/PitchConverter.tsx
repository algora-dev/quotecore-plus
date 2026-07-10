'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { degreesToRatio, ratioToDegrees, COMMON_PITCHES, rafterPitchFactor } from '../lib/calculator';

export function PitchConverter() {
  const { system } = useUnitSystem();
  const [degrees, setDegrees] = useState<string>('25');
  const [ratioX, setRatioX] = useState<string>('1');
  const [ratioY, setRatioY] = useState<string>('');

  const deg = parseFloat(degrees) || 0;
  const ratio = degreesToRatio(deg);
  const factor = rafterPitchFactor(deg);

  // Calculate ratio -> degrees
  const rx = parseFloat(ratioX) || 0;
  const ry = parseFloat(ratioY) || 0;
  const fromRatioDeg = ratioToDegrees(rx, ry);

  function applyDegrees(d: number) {
    setDegrees(String(d));
    const r = degreesToRatio(d);
    setRatioX(String(r.x));
    setRatioY(r.y.toFixed(3));
  }

  function applyRatio() {
    const d = fromRatioDeg;
    setDegrees(d.toFixed(2));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pitch Degree ↔ Ratio Converter</h2>
        <p className="mt-1 text-sm text-slate-500">Convert between pitch degrees and ratios (e.g. 25° = 1:2.144)</p>
      </div>

      {/* Degrees to Ratio */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700">Pitch in degrees</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={degrees}
            onChange={(e) => applyDegrees(parseFloat(e.target.value) || 0)}
            min={0}
            max={89}
            step={0.5}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <span className="text-sm text-slate-500">degrees</span>
        </div>

        {/* Quick select */}
        <div className="flex flex-wrap gap-2">
          {COMMON_PITCHES.map((p) => (
            <button
              key={p}
              onClick={() => applyDegrees(p)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
            >
              {p}°
            </button>
          ))}
        </div>

        {/* Result */}
        <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Ratio</p>
              <p className="text-lg font-semibold text-slate-900">
                {ratio.x}:{ratio.y.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rafter Pitch Factor</p>
              <p className="text-lg font-semibold text-slate-900">{factor.toFixed(4)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ratio to Degrees */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <label className="text-sm font-medium text-slate-700">Or enter a ratio to convert to degrees</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={ratioX}
            onChange={(e) => setRatioX(e.target.value)}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <span className="text-sm text-slate-400">:</span>
          <input
            type="number"
            value={ratioY}
            onChange={(e) => setRatioY(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={applyRatio}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Convert
          </button>
        </div>
        {fromRatioDeg > 0 && (
          <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
            <p className="text-xs text-slate-500">Pitch</p>
            <p className="text-lg font-semibold text-slate-900">{fromRatioDeg.toFixed(2)}°</p>
          </div>
        )}
      </div>

      {/* Visual diagram */}
      <div className="border-t border-slate-100 pt-4">
        <PitchDiagram degrees={deg} />
      </div>
    </div>
  );
}

function PitchDiagram({ degrees }: { degrees: number }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;
  const base = 200;
  const height = Math.tan(rad) * (base / 2);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 240 140" className="w-full max-w-xs">
        {/* Ground line */}
        <line x1="20" y1="120" x2="220" y2="120" stroke="#cbd5e1" strokeWidth="2" />
        {/* Roof triangle */}
        <line x1="20" y1="120" x2="120" y2={120 - height} stroke="#FF6B35" strokeWidth="2.5" />
        <line x1="120" y1={120 - height} x2="220" y2="120" stroke="#FF6B35" strokeWidth="2.5" />
        {/* Span */}
        <line x1="20" y1="130" x2="220" y2="130" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="120" y="142" textAnchor="middle" className="fill-slate-400 text-[10px]">Span</text>
        {/* Angle */}
        <path
          d={`M 60 120 A 40 40 0 0 0 ${60 - 40 * Math.cos(rad)} ${120 - 40 * Math.sin(rad)}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <text x="50" y="110" className="fill-blue-500 text-[10px] font-medium">{deg.toFixed(0)}°</text>
      </svg>
      <p className="text-xs text-slate-400">Roof cross-section at {deg.toFixed(1)}° pitch</p>
    </div>
  );
}
