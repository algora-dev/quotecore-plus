'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { rafterPitchFactor, hipValleyPitchFactor, pitchFactor } from '../lib/calculator';
import type { PitchType } from '@/app/lib/types';

export function RoofAreaCalculator() {
  const { system, areaUnit, lengthUnit } = useUnitSystem();
  const [width, setWidth] = useState<string>('10');
  const [length, setLength] = useState<string>('8');
  const [pitch, setPitch] = useState<string>('25');
  const [pitchType, setPitchType] = useState<PitchType>('rafter');

  const w = parseFloat(width) || 0;
  const l = parseFloat(length) || 0;
  const p = parseFloat(pitch) || 0;

  const planArea = w * l;
  const factor = pitchFactor(p, pitchType);
  const actualArea = planArea * factor;
  const rafterFactor = rafterPitchFactor(p);
  const hipFactor = hipValleyPitchFactor(p);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Roof Area Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate actual roof surface area from plan dimensions and pitch
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <div>
        <label className="text-sm font-medium text-slate-700">Pitch type</label>
        <div className="mt-2 flex gap-2">
          {([
            { value: 'rafter', label: 'Rafter' },
            { value: 'valley_hip', label: 'Hip/Valley' },
            { value: 'none', label: 'None (flat)' },
          ] as { value: PitchType; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPitchType(opt.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                pitchType === opt.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Plan area</p>
          <p className="text-lg font-semibold text-slate-900">{planArea.toFixed(2)} {areaUnit}</p>
        </div>
        <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
          <p className="text-xs text-slate-500">Pitch factor used</p>
          <p className="text-lg font-semibold text-slate-900">{factor.toFixed(4)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Rafter: {rafterFactor.toFixed(4)} · Hip: {hipFactor.toFixed(4)}
          </p>
        </div>
        <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
          <p className="text-xs text-slate-500">Actual roof area</p>
          <p className="text-2xl font-bold text-slate-900">{actualArea.toFixed(2)} {areaUnit}</p>
        </div>
      </div>
    </div>
  );
}
