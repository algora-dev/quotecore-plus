'use client';

import { useState } from 'react';
import { useUnitSystem } from '../RoofingCalculator';
import { degreesToRatio, ratioToDegrees, rafterLength, rafterPitchFactor, hipValleyPitchFactor, hipValleyLength } from '../../lib/calculator';

const RAD = Math.PI / 180;
const COMMON_PITCHES = [10, 15, 20, 25, 30, 35, 40, 45];

type PitchMode = 'degrees' | 'ratio';
type SubTab = 'rafter' | 'hip-valley';

export function PitchRafterTab() {
  const { lengthUnit } = useUnitSystem();
  const [subTab, setSubTab] = useState<SubTab>('rafter');
  const [mode, setMode] = useState<PitchMode>('degrees');
  const [pitchDeg, setPitchDeg] = useState('25');
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState('2.144');
  const [span, setSpan] = useState('10');
  const [run, setRun] = useState('5');
  const [result, setResult] = useState<null | {
    rafterLen: number;
    ratio: { x: number; y: number };
    rafterFactor: number;
    hipFactor: number;
    hipLen: number;
    deg: number;
  }>(null);

  function handleDegChange(v: string) {
    setPitchDeg(v);
    const d = parseFloat(v) || 0;
    const r = degreesToRatio(d);
    setRatioY(r.y.toFixed(3));
  }

  function handleRatioChange(y: string) {
    setRatioY(y);
    const x = parseFloat(ratioX) || 1;
    const yv = parseFloat(y) || 0;
    const d = ratioToDegrees(x, yv);
    setPitchDeg(d.toFixed(1));
  }

  function calculate() {
    const d = parseFloat(pitchDeg) || 0;
    const s = parseFloat(span) || 0;
    const r = parseFloat(run) || 0;
    const ratio = degreesToRatio(d);
    const rf = rafterPitchFactor(d);
    const hf = hipValleyPitchFactor(d);
    const rl = rafterLength(s, d);
    const hl = hipValleyLength(s, r, d);
    setResult({ rafterLen: rl, ratio, rafterFactor: rf, hipFactor: hf, hipLen: hl, deg: d });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Rafter / Hip & Valley Pitch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate rafter and hip/valley lengths from pitch and span
        </p>
      </div>

      {/* Sub-tab toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setSubTab('rafter')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              subTab === 'rafter' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Rafter
          </button>
          <button
            onClick={() => setSubTab('hip-valley')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              subTab === 'hip-valley' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Hip / Valley
          </button>
        </div>
      </div>

      {/* Pitch/Ratio toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setMode('degrees')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'degrees' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Degrees
          </button>
          <button
            onClick={() => setMode('ratio')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'ratio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Ratio
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {mode === 'degrees' ? (
          <div>
            <label className="text-sm font-medium text-slate-700">Pitch (degrees)</label>
            <input
              type="number"
              value={pitchDeg}
              onChange={(e) => handleDegChange(e.target.value)}
              min={0}
              max={89}
              step={0.5}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_PITCHES.map((p) => (
                <button
                  key={p}
                  onClick={() => handleDegChange(String(p))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    (parseFloat(pitchDeg) || 0) === p
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}°
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-700">Pitch ratio (rise : run)</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={ratioX}
                onChange={(e) => setRatioX(e.target.value)}
                min={0}
                step={1}
                className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <span className="text-slate-400">:</span>
              <input
                type="number"
                value={ratioY}
                onChange={(e) => handleRatioChange(e.target.value)}
                min={0}
                step={0.001}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">= {pitchDeg}°</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-700">
            {subTab === 'rafter' ? `Span (${lengthUnit})` : `Span (${lengthUnit})`}
          </label>
          <input
            type="number"
            value={span}
            onChange={(e) => setSpan(e.target.value)}
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">Total building width</p>
        </div>

        {subTab === 'hip-valley' && (
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
            <p className="mt-2 text-xs text-slate-400">Distance from corner to ridge</p>
          </div>
        )}
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
          {subTab === 'rafter' ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Ratio</p>
                  <p className="text-base font-semibold text-slate-900">{result.ratio.x}:{result.ratio.y.toFixed(3)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Rafter factor</p>
                  <p className="text-base font-semibold text-slate-900">{result.rafterFactor.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Hip/valley factor</p>
                  <p className="text-base font-semibold text-slate-900">{result.hipFactor.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                  <p className="text-xs text-slate-500">Rafter length ({lengthUnit})</p>
                  <p className="text-lg font-bold text-slate-900">{result.rafterLen.toFixed(3)}</p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
                  Show calculation
                </summary>
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    Ratio = 1 : 1 / tan({result.deg}°) = 1 : {result.ratio.y.toFixed(3)}
                    <br />
                    Rafter factor = 1 / cos({result.deg}°) = {result.rafterFactor.toFixed(4)}
                    <br />
                    Rafter length = (span / 2) / cos({result.deg}°)
                    <br />
                    Rafter length = ({span} / 2) / {Math.cos(result.deg * RAD).toFixed(4)} = <strong>{result.rafterLen.toFixed(3)} {lengthUnit}</strong>
                  </p>
                </div>
              </details>

              {/* Single-side rafter diagram */}
              <div className="border-t border-slate-100 pt-4">
                <RafterDiagram degrees={result.deg} span={parseFloat(span) || 0} rafterLen={result.rafterLen} unit={lengthUnit} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Rafter factor</p>
                  <p className="text-base font-semibold text-slate-900">{result.rafterFactor.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Hip/valley factor</p>
                  <p className="text-base font-semibold text-slate-900">{result.hipFactor.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Rafter length ({lengthUnit})</p>
                  <p className="text-base font-semibold text-slate-900">{result.rafterLen.toFixed(3)}</p>
                </div>
                <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                  <p className="text-xs text-slate-500">Hip/valley length ({lengthUnit})</p>
                  <p className="text-lg font-bold text-slate-900">{result.hipLen.toFixed(3)}</p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
                  Show calculation
                </summary>
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    Rafter factor = 1 / cos({result.deg}°) = {result.rafterFactor.toFixed(4)}
                    <br />
                    Hip/valley factor = sqrt({result.rafterFactor.toFixed(4)}² + 1) = {result.hipFactor.toFixed(4)}
                    <br />
                    Diagonal = sqrt(({span} / 2)² + {run}²) = {Math.sqrt(Math.pow(parseFloat(span) || 0 / 2, 2) + Math.pow(parseFloat(run) || 0, 2)).toFixed(3)}
                    <br />
                    Hip angle = arctan(tan({result.deg}°) × cos(45°))
                    <br />
                    Hip/valley length = <strong>{result.hipLen.toFixed(3)} {lengthUnit}</strong>
                  </p>
                </div>
              </details>

              {/* Isometric hip/valley diagram */}
              <div className="border-t border-slate-100 pt-4">
                <HipValleyDiagram degrees={result.deg} span={parseFloat(span) || 0} run={parseFloat(run) || 0} hipLen={result.hipLen} unit={lengthUnit} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single-side rafter diagram ──────────────────────

function RafterDiagram({ degrees, span, rafterLen, unit }: { degrees: number; span: number; rafterLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;
  const halfSpan = span / 2;

  // Diagram dimensions — single side only
  const baseLen = 160;
  const height = Math.tan(rad) * baseLen;
  const maxH = 120;
  const scale = height > maxH ? maxH / height : 1;
  const w = baseLen * scale;
  const h = height * scale;

  const offsetX = 40;
  const offsetY = 130;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 260 170" className="w-full max-w-sm">
        {/* Wall (left vertical) */}
        <line x1={offsetX} y1={offsetY} x2={offsetX} y2={offsetY - h - 15} stroke="#94a3b8" strokeWidth="2" />
        {/* Ground */}
        <line x1={offsetX} y1={offsetY} x2={offsetX + w + 40} y2={offsetY} stroke="#cbd5e1" strokeWidth="2" />
        {/* Rafter (slope) */}
        <line x1={offsetX} y1={offsetY - h - 15} x2={offsetX + w} y2={offsetY} stroke="#FF6B35" strokeWidth="2.5" />
        {/* Ridge point label */}
        <circle cx={offsetX} cy={offsetY - h - 15} r="3" fill="#3b82f6" />
        {/* Span dimension (horizontal) */}
        <line x1={offsetX} y1={offsetY + 12} x2={offsetX + w} y2={offsetY + 12} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x={offsetX + w / 2} y={offsetY + 24} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '10px' }}>
          Half span: {halfSpan.toFixed(2)} {unit}
        </text>
        {/* Rafter label (along the slope) */}
        <text
          x={offsetX + w / 2 + 15}
          y={offsetY - h / 2 - 5}
          textAnchor="middle"
          className="fill-slate-600"
          style={{ fontSize: '10px', fontWeight: 500 }}
          transform={`rotate(${(-deg).toFixed(1)} ${offsetX + w / 2 + 15} ${offsetY - h / 2 - 5})`}
        >
          Rafter: {rafterLen.toFixed(2)} {unit}
        </text>
        {/* Pitch angle arc — positioned right of the wall corner */}
        <path
          d={`M ${offsetX + 30} ${offsetY} A 30 30 0 0 0 ${offsetX + 30 - 30 * Math.cos(rad)} ${offsetY - 30 * Math.sin(rad)}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <text x={offsetX + 38} y={offsetY - 12} className="fill-blue-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {deg.toFixed(1)}°
        </text>
      </svg>
      <p className="text-xs text-slate-400">Single-side roof slope at {deg.toFixed(1)}° pitch</p>
    </div>
  );
}

// ─── Isometric hip/valley diagram ────────────────────

function HipValleyDiagram({ degrees, span, run, hipLen, unit }: { degrees: number; span: number; run: number; hipLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;
  const halfSpan = span / 2;
  const height = Math.tan(rad) * halfSpan;

  // Isometric projection angles
  const isoAngleX = 30 * Math.PI / 180;
  const isoAngleY = 30 * Math.PI / 180;

  // Scale to fit
  const scale = 50 / Math.max(halfSpan, run, 1);
  const sw = halfSpan * scale;
  const sh = run * scale;
  const vh = height * scale;

  // Corners of the two roof planes in isometric view
  // Plane 1: left roof
  const p1 = { x: 130, y: 140 }; // bottom-left corner
  const p2 = { x: 130 + sw * Math.cos(isoAngleX), y: 140 - sw * Math.sin(isoAngleX) }; // bottom-right
  const ridge1 = { x: 130, y: 140 - vh }; // top of left wall
  const ridge2 = { x: 130 + sw * Math.cos(isoAngleX), y: 140 - vh - sw * Math.sin(isoAngleX) }; // ridge end

  // Plane 2: right roof (going back)
  const p3 = { x: 130 + run * Math.cos(isoAngleY), y: 140 - run * Math.sin(isoAngleY) }; // front corner
  const ridge3 = { x: p3.x, y: p3.y - vh }; // ridge top at front

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 280 180" className="w-full max-w-sm">
        {/* Ground plan lines (dashed) */}
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
        <line x1={p1.x} y1={p1.y} x2={p3.x} y2={p3.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
        <line x1={p2.x} y1={p2.y} x2={p3.x} y2={p3.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />

        {/* Roof plane 1 (left slope) — orange */}
        <line x1={p1.x} y1={p1.y} x2={ridge1.x} y2={ridge1.y} stroke="#FF6B35" strokeWidth="2" />
        <line x1={ridge1.x} y1={ridge1.y} x2={ridge2.x} y2={ridge2.y} stroke="#FF6B35" strokeWidth="2.5" />
        <line x1={p2.x} y1={p2.y} x2={ridge2.x} y2={ridge2.y} stroke="#FF6B35" strokeWidth="2" />

        {/* Roof plane 2 (right slope) — orange lighter */}
        <line x1={p2.x} y1={p2.y} x2={ridge2.x} y2={ridge2.y} stroke="#FF6B35" strokeWidth="2" />
        <line x1={ridge2.x} y1={ridge2.y} x2={ridge3.x} y2={ridge3.y} stroke="#FF6B35" strokeWidth="2.5" />
        <line x1={p3.x} y1={p3.y} x2={ridge3.x} y2={ridge3.y} stroke="#FF6B35" strokeWidth="2" />

        {/* Hip line (ridge2 to p2 — the valley/hip where two planes meet) */}
        <line x1={p2.x} y1={p2.y} x2={ridge2.x} y2={ridge2.y} stroke="#3b82f6" strokeWidth="3" />

        {/* Labels */}
        <text x={ridge2.x + 5} y={ridge2.y - 5} className="fill-slate-600" style={{ fontSize: '9px', fontWeight: 500 }}>
          Ridge
        </text>
        <text x={(p2.x + ridge2.x) / 2 + 8} y={(p2.y + ridge2.y) / 2} className="fill-blue-500" style={{ fontSize: '9px', fontWeight: 500 }}>
          Hip: {hipLen.toFixed(2)} {unit}
        </text>
        <text x={p1.x - 5} y={p1.y + 12} className="fill-slate-400" style={{ fontSize: '9px' }}>
          Corner
        </text>
      </svg>
      <p className="text-xs text-slate-400">Isometric view — two roof planes meeting at hip line</p>
    </div>
  );
}
