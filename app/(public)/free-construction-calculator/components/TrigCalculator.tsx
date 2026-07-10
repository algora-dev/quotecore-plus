'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { solveRightTriangle, type TriangleSolution } from '../lib/calculator';

export function TrigCalculator() {
  const { lengthUnit } = useUnitSystem();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [angleA, setAngleA] = useState('');
  const [angleB, setAngleB] = useState('');

  const solution: TriangleSolution = solveRightTriangle({
    a: a ? parseFloat(a) : undefined,
    b: b ? parseFloat(b) : undefined,
    c: c ? parseFloat(c) : undefined,
    angleA: angleA ? parseFloat(angleA) : undefined,
    angleB: angleB ? parseFloat(angleB) : undefined,
  });

  function reset() {
    setA(''); setB(''); setC(''); setAngleA(''); setAngleB('');
  }

  const fields = [
    { label: `Side a (${lengthUnit})`, value: a, set: setA, placeholder: 'opposite' },
    { label: `Side b (${lengthUnit})`, value: b, set: setB, placeholder: 'adjacent' },
    { label: `Side c (${lengthUnit})`, value: c, set: setC, placeholder: 'hypotenuse' },
    { label: 'Angle A (°)', value: angleA, set: setAngleA, placeholder: 'opposite angle' },
    { label: 'Angle B (°)', value: angleB, set: setAngleB, placeholder: 'adjacent angle' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Right Triangle Solver</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter any 2 known values (sides and/or angles). Angle C is always 90°.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label}>
            <label className="text-sm font-medium text-slate-700">{field.label}</label>
            <input
              type="number"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
              min={0}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <button
        onClick={reset}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400"
      >
        Clear all
      </button>

      {solution.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">{solution.error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Result label={`Side a (${lengthUnit})`} value={solution.a} />
          <Result label={`Side b (${lengthUnit})`} value={solution.b} />
          <Result label={`Side c (${lengthUnit})`} value={solution.c} />
          <Result label="Angle A" value={solution.angleA} suffix="°" />
          <Result label="Angle B" value={solution.angleB} suffix="°" />
          <Result label="Angle C" value={90} suffix="°" />
        </div>
      )}
    </div>
  );
}

function Result({ label, value, suffix }: { label: string; value?: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">
        {value != null ? `${value}${suffix || ''}` : '—'}
      </p>
    </div>
  );
}
