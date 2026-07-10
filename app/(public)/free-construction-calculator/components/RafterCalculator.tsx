'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { rafterLength } from '../lib/calculator';

export function RafterCalculator() {
  const { system, lengthUnit } = useUnitSystem();
  const [span, setSpan] = useState<string>('10');
  const [pitch, setPitch] = useState<string>('25');

  const spanNum = parseFloat(span) || 0;
  const pitchNum = parseFloat(pitch) || 0;
  const result = rafterLength(spanNum, pitchNum);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Rafter Length Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate rafter length from the total roof span and pitch angle
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Roof span ({lengthUnit})</label>
          <input
            type="number"
            value={span}
            onChange={(e) => setSpan(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">Total span across the building</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Pitch (degrees)</label>
          <input
            type="number"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            min={0}
            max={89}
            step={0.5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">Roof pitch angle</p>
        </div>
      </div>

      <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
        <p className="text-xs text-slate-500">Rafter length (per side)</p>
        <p className="text-2xl font-bold text-slate-900">
          {result.toFixed(3)} {lengthUnit}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Formula: (span ÷ 2) ÷ cos({pitchNum}°) = ({spanNum} ÷ 2) ÷ {Math.cos(pitchNum * Math.PI / 180).toFixed(4)}
        </p>
      </div>
    </div>
  );
}
