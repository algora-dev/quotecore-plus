'use client';

import { useState } from 'react';
import { useUnitSystem } from '../RoofingCalculator';
import { degreesToRatio, ratioToDegrees, COMMON_PITCHES, rafterPitchFactor, hipValleyPitchFactor, rafterLength } from '../../lib/calculator';

const RAD = Math.PI / 180;

interface Props {
  pitch: string;
  span: string;
  onPitchChange: (v: string) => void;
  onSpanChange: (v: string) => void;
}

export function PitchRafterPanel({ pitch, span, onPitchChange, onSpanChange }: Props) {
  const { lengthUnit } = useUnitSystem();
  const [expanded, setExpanded] = useState(false);

  const deg = parseFloat(pitch) || 0;
  const ratio = degreesToRatio(deg);
  const rafterFactor = rafterPitchFactor(deg);
  const hipFactor = hipValleyPitchFactor(deg);
  const spanNum = parseFloat(span) || 0;
  const rafterLen = rafterLength(spanNum, deg);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Roof Pitch &amp; Rafter</h2>
          <p className="mt-1 text-sm text-slate-500">Convert pitch and calculate rafter length</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Pitch input */}
        <div>
          <label className="text-sm font-medium text-slate-700">Pitch (degrees)</label>
          <input
            type="number"
            value={pitch}
            onChange={(e) => onPitchChange(e.target.value)}
            min={0}
            max={89}
            step={0.5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMMON_PITCHES.map((p) => (
              <button
                key={p}
                onClick={() => onPitchChange(String(p))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  deg === p
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {p}°
              </button>
            ))}
          </div>
        </div>

        {/* Span input */}
        <div>
          <label className="text-sm font-medium text-slate-700">Span ({lengthUnit})</label>
          <input
            type="number"
            value={span}
            onChange={(e) => onSpanChange(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">Total building width across the roof</p>
        </div>
      </div>

      {/* Results */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultCard label="Ratio" value={`${ratio.x}:${ratio.y.toFixed(3)}`} />
        <ResultCard label="Rafter factor" value={rafterFactor.toFixed(4)} />
        <ResultCard label="Hip/valley factor" value={hipFactor.toFixed(4)} />
        <ResultCard label={`Rafter length (${lengthUnit})`} value={rafterLen.toFixed(3)} primary />
      </div>

      {/* Expandable calculation */}
      <details className="mt-4 group" open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
          Show calculation
        </summary>
        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs text-slate-600 font-mono leading-relaxed">
            Ratio = 1 : 1 / tan({deg}°) = 1 : {ratio.y.toFixed(3)}
            <br />
            Rafter factor = 1 / cos({deg}°) = {rafterFactor.toFixed(4)}
            <br />
            Hip/valley factor = sqrt({rafterFactor.toFixed(4)}² + 1) = {hipFactor.toFixed(4)}
            <br />
            Rafter length = (span / 2) / cos({deg}°)
            <br />
            Rafter length = ({spanNum} / 2) / {Math.cos(deg * RAD).toFixed(4)} = <strong>{rafterLen.toFixed(3)} {lengthUnit}</strong>
          </p>
        </div>
      </details>

      {/* SVG diagram */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <PitchDiagram degrees={deg} span={spanNum} rafterLen={rafterLen} unit={lengthUnit} />
      </div>
    </div>
  );
}

function ResultCard({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${primary ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold text-slate-900 ${primary ? 'text-lg' : 'text-base'}`}>{value}</p>
    </div>
  );
}

function PitchDiagram({ degrees, span, rafterLen, unit }: { degrees: number; span: number; rafterLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;
  const baseWidth = 200;
  const halfBase = baseWidth / 2;
  const peakHeight = Math.tan(rad) * halfBase;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 240 160" className="w-full max-w-xs">
        {/* Ground line */}
        <line x1="20" y1="120" x2="220" y2="120" stroke="#cbd5e1" strokeWidth="2" />
        {/* Roof triangle */}
        <line x1="20" y1="120" x2="120" y2={120 - peakHeight} stroke="#FF6B35" strokeWidth="2.5" />
        <line x1="120" y1={120 - peakHeight} x2="220" y2="120" stroke="#FF6B35" strokeWidth="2.5" />
        {/* Span dimension */}
        <line x1="20" y1="132" x2="220" y2="132" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="120" y="145" textAnchor="middle" className="fill-slate-400" style={{ fontSize: '10px' }}>
          Span: {span} {unit}
        </text>
        {/* Rafter label */}
        <text x="55" y={120 - peakHeight / 2 - 5} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '9px' }}>
          Rafter: {rafterLen.toFixed(2)} {unit}
        </text>
        {/* Pitch angle arc */}
        <path
          d={`M 60 120 A 35 35 0 0 0 ${60 - 35 * Math.cos(rad)} ${120 - 35 * Math.sin(rad)}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <text x="48" y="112" className="fill-blue-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {deg.toFixed(0)}°
        </text>
      </svg>
      <p className="text-xs text-slate-400">Roof cross-section at {deg.toFixed(1)}° pitch</p>
    </div>
  );
}
