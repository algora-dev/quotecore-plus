'use client';

import { useState } from 'react';
import { useUnitSystem } from '../RoofingCalculator';
import { rafterPitchFactor, hipValleyPitchFactor, pitchFactor } from '../../lib/calculator';
import type { PitchType } from '@/app/lib/types';

interface Props {
  width: string;
  length: string;
  pitch: string;
  pitchType: string;
  onWidthChange: (v: string) => void;
  onLengthChange: (v: string) => void;
  onPitchTypeChange: (v: string) => void;
  onUseArea: (area: string) => void;
}

export function RoofAreaPanel({
  width, length, pitch, pitchType, onWidthChange, onLengthChange, onPitchTypeChange, onUseArea,
}: Props) {
  const { areaUnit, lengthUnit } = useUnitSystem();

  const w = parseFloat(width) || 0;
  const l = parseFloat(length) || 0;
  const p = parseFloat(pitch) || 0;
  const pt = pitchType as PitchType;

  const planArea = w * l;
  const factor = pitchFactor(p, pt);
  const actualArea = planArea * factor;
  const rafterFactor = rafterPitchFactor(p);
  const hipFactor = hipValleyPitchFactor(p);

  const pitchTypes: { value: PitchType; label: string }[] = [
    { value: 'rafter', label: 'Rafter' },
    { value: 'valley_hip', label: 'Hip/Valley' },
    { value: 'none', label: 'Flat' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Roof Area</h2>
        <p className="mt-1 text-sm text-slate-500">Calculate actual roof surface area from plan dimensions</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Width ({lengthUnit})</label>
          <input
            type="number"
            value={width}
            onChange={(e) => onWidthChange(e.target.value)}
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
            onChange={(e) => onLengthChange(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Pitch (inherited)</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {p}°
            <span className="text-xs text-slate-400">from panel above</span>
          </div>
        </div>
      </div>

      {/* Pitch type selector */}
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700">Pitch type</label>
        <div className="mt-2 flex gap-2">
          {pitchTypes.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPitchTypeChange(opt.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                pt === opt.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Plan area</p>
          <p className="text-lg font-semibold text-slate-900">{planArea.toFixed(2)} {areaUnit}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Pitch factor used</p>
          <p className="text-lg font-semibold text-slate-900">{factor.toFixed(4)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Rafter: {rafterFactor.toFixed(4)} / Hip: {hipFactor.toFixed(4)}
          </p>
        </div>
        <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
          <p className="text-xs text-slate-500">Actual roof area</p>
          <p className="text-2xl font-bold text-slate-900">{actualArea.toFixed(2)} {areaUnit}</p>
        </div>
      </div>

      {/* Expandable calculation */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
          Show calculation
        </summary>
        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs text-slate-600 font-mono leading-relaxed">
            Plan area = width × length = {w} × {l} = <strong>{planArea.toFixed(2)} {areaUnit}</strong>
            <br />
            {pt === 'none' ? (
              <>Flat roof — no pitch factor applied</>
            ) : pt === 'rafter' ? (
              <>Rafter factor = 1 / cos({p}°) = {rafterFactor.toFixed(4)}</>
            ) : (
              <>Hip/valley factor = sqrt((1/cos({p}°))² + 1) = {hipFactor.toFixed(4)}</>
            )}
            <br />
            Actual roof area = {planArea.toFixed(2)} × {factor.toFixed(4)} = <strong>{actualArea.toFixed(2)} {areaUnit}</strong>
          </p>
        </div>
      </details>

      {/* Use area for materials */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onUseArea(actualArea.toFixed(2))}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Use this area for materials
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
