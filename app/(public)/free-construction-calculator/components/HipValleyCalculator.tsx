'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { hipValleyLength } from '../lib/calculator';

export function HipValleyCalculator() {
  const { lengthUnit } = useUnitSystem();
  const [span, setSpan] = useState<string>('10');
  const [run, setRun] = useState<string>('5');
  const [pitch, setPitch] = useState<string>('25');

  const s = parseFloat(span) || 0;
  const r = parseFloat(run) || 0;
  const p = parseFloat(pitch) || 0;
  const result = hipValleyLength(s, r, p);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Hip/Valley Length Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate hip or valley rafter length using the compound angle formula
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Span ({lengthUnit})</label>
          <input
            type="number"
            value={span}
            onChange={(e) => setSpan(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Run ({lengthUnit})</label>
          <input
            type="number"
            value={run}
            onChange={(e) => setRun(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
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
        </div>
      </div>

      <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
        <p className="text-xs text-slate-500">Hip/Valley length</p>
        <p className="text-2xl font-bold text-slate-900">{result.toFixed(3)} {lengthUnit}</p>
        <p className="mt-2 text-xs text-slate-400">
          Diagonal = √((span/2)² + run²) = √({(s/2).toFixed(2)}² + {r.toFixed(2)}²) = {Math.sqrt((s/2)**2 + r**2).toFixed(3)} {lengthUnit}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Adjusted for {p}° pitch using compound angle formula
        </p>
      </div>
    </div>
  );
}
