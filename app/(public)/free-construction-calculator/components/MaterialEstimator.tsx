'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { estimateMaterial, MATERIAL_COVERAGES } from '../lib/calculator';

export function MaterialEstimator() {
  const { areaUnit } = useUnitSystem();
  const [area, setArea] = useState<string>('100');
  const [material, setMaterial] = useState<string>('Concrete tiles');
  const [waste, setWaste] = useState<string>('10');

  const areaNum = parseFloat(area) || 0;
  const wasteNum = parseFloat(waste) || 0;
  const coverage = MATERIAL_COVERAGES[material];

  const result = coverage
    ? estimateMaterial(areaNum, coverage.coverage, coverage.unit, wasteNum)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Material Estimator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estimate material quantities from roof area, material type, and waste factor
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Roof area ({areaUnit})</label>
          <input
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Material type</label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {Object.keys(MATERIAL_COVERAGES).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Waste (%)</label>
          <input
            type="number"
            value={waste}
            onChange={(e) => setWaste(e.target.value)}
            min={0}
            max={100}
            step={1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {result && (
        <>
          <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
            <p className="text-xs text-slate-500">Estimated quantity needed</p>
            <p className="text-2xl font-bold text-slate-900">
              {result.quantity} {result.unit}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Raw area</p>
              <p className="text-lg font-semibold text-slate-900">{result.rawArea.toFixed(2)} {areaUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">With waste ({result.wastePercent}%)</p>
              <p className="text-lg font-semibold text-slate-900">{result.areaWithWaste.toFixed(2)} {areaUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Coverage rate</p>
              <p className="text-lg font-semibold text-slate-900">
                {coverage.coverage} {areaUnit}/{result.unit}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
