'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { volumeFromAreaDepth, volumeFromDimensions, materialWeight, MATERIAL_DENSITIES } from '../lib/calculator';

export function VolumeCalculator() {
  const { system, volumeUnit, areaUnit, lengthUnit } = useUnitSystem();
  const [mode, setMode] = useState<'dimensions' | 'area'>('dimensions');
  const [width, setWidth] = useState<string>('5');
  const [length, setLength] = useState<string>('10');
  const [depth, setDepth] = useState<string>('0.15');
  const [area, setArea] = useState<string>('50');
  const [showWeight, setShowWeight] = useState(false);
  const [material, setMaterial] = useState<string>('Concrete');

  const w = parseFloat(width) || 0;
  const l = parseFloat(length) || 0;
  const d = parseFloat(depth) || 0;
  const a = parseFloat(area) || 0;

  const volume = mode === 'dimensions' ? volumeFromDimensions(w, l, d) : volumeFromAreaDepth(a, d);
  const density = MATERIAL_DENSITIES[material] || 0;
  const weight = materialWeight(volume, density);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Volume Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate volume for concrete pours, fill material, or excavation
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {([
          { value: 'dimensions', label: 'Width × Length × Depth' },
          { value: 'area', label: 'Area × Depth' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              mode === opt.value
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {mode === 'dimensions' && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700">Width ({lengthUnit})</label>
              <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} min={0} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Length ({lengthUnit})</label>
              <input type="number" value={length} onChange={(e) => setLength(e.target.value)} min={0} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
          </>
        )}
        {mode === 'area' && (
          <div>
            <label className="text-sm font-medium text-slate-700">Area ({areaUnit})</label>
            <input type="number" value={area} onChange={(e) => setArea(e.target.value)} min={0} step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-slate-700">Depth ({lengthUnit})</label>
          <input type="number" value={depth} onChange={(e) => setDepth(e.target.value)} min={0} step={0.01}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
        </div>
      </div>

      <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
        <p className="text-xs text-slate-500">Volume</p>
        <p className="text-2xl font-bold text-slate-900">{volume.toFixed(3)} {volumeUnit}</p>
      </div>

      {/* Weight estimate */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Material weight estimate</label>
          <button
            onClick={() => setShowWeight(!showWeight)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300"
          >
            {showWeight ? 'Hide' : 'Show'}
          </button>
        </div>
        {showWeight && (
          <div className="mt-3 space-y-3">
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {Object.keys(MATERIAL_DENSITIES).map((m) => (
                <option key={m} value={m}>{m} ({MATERIAL_DENSITIES[m]} kg/m³)</option>
              ))}
            </select>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Estimated weight</p>
              <p className="text-lg font-semibold text-slate-900">
                {(weight / 1000).toFixed(2)} tonnes
              </p>
              <p className="mt-1 text-xs text-slate-400">{weight.toFixed(0)} kg (density: {density} kg/m³)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
