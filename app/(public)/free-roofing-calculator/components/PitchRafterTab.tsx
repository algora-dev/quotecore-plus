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
  const [planLength, setPlanLength] = useState('7');
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
    const ratio = degreesToRatio(d);
    const rf = rafterPitchFactor(d);
    const hf = hipValleyPitchFactor(d);
    const s = parseFloat(span) || 0;
    const pl = parseFloat(planLength) || 0;
    const rl = rafterLength(s, d);
    const hl = hipValleyLength(pl, d);
    setResult({ rafterLen: rl, ratio, rafterFactor: rf, hipFactor: hf, hipLen: hl, deg: d });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Rafter / Hip & Valley</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate rafter and hip/valley lengths from pitch and span
        </p>
      </div>

      {/* Sub-tab toggle */}
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
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

      {/* Pitch/Ratio toggle */}
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
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

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {subTab === 'rafter' ? (
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
            <p className="mt-2 text-xs text-slate-400">Plan-view distance from wall to ridge (one rafter)</p>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-700">Plan length ({lengthUnit})</label>
            <input
              type="number"
              value={planLength}
              onChange={(e) => setPlanLength(e.target.value)}
              min={0}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">Plan-view diagonal from corner to ridge</p>
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
                    Rafter length = span / cos({result.deg}°)
                    <br />
                    Rafter length = {span} / {Math.cos(result.deg * RAD).toFixed(4)} = <strong>{result.rafterLen.toFixed(3)} {lengthUnit}</strong>
                  </p>
                </div>
              </details>

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
                  <p className="text-xs text-slate-500">Hip slope (°)</p>
                  <p className="text-base font-semibold text-slate-900">
                    {(Math.atan(Math.tan(result.deg * RAD) * Math.cos(45 * RAD)) * 180 / Math.PI).toFixed(1)}°
                  </p>
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
                    Hip angle = arctan(tan({result.deg}°) × cos(45°))
                    <br />
                    Hip length = plan_length / cos(hip_angle)
                    <br />
                    Hip length = {planLength} / {Math.cos(Math.atan(Math.tan(result.deg * RAD) * Math.cos(45 * RAD))).toFixed(4)} = <strong>{result.hipLen.toFixed(3)} {lengthUnit}</strong>
                  </p>
                </div>
              </details>

              <div className="border-t border-slate-100 pt-4">
                <HipValleyDiagram degrees={result.deg} planLength={parseFloat(planLength) || 0} hipLen={result.hipLen} unit={lengthUnit} />
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

  // Diagram dimensions — single rafter from wall (left) to ridge (right)
  const baseLen = 180;
  const height = Math.tan(rad) * baseLen;
  const maxH = 100;
  const scale = height > maxH ? maxH / height : 1;
  const w = baseLen * scale;
  const h = height * scale;

  const wallX = 40;
  const groundY = 130;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 280 170" className="w-full max-w-sm">
        {/* Wall (left vertical) */}
        <line x1={wallX} y1={groundY} x2={wallX} y2={groundY - h - 10} stroke="#94a3b8" strokeWidth="2" />
        {/* Ground */}
        <line x1={wallX} y1={groundY} x2={wallX + w + 30} y2={groundY} stroke="#cbd5e1" strokeWidth="2" />
        {/* Rafter (slope from top of wall to ground right) */}
        <line x1={wallX} y1={groundY - h - 10} x2={wallX + w} y2={groundY} stroke="#FF6B35" strokeWidth="2.5" />
        {/* Ridge point */}
        <circle cx={wallX} cy={groundY - h - 10} r="3" fill="#3b82f6" />
        {/* Span dimension (horizontal, full span) */}
        <line x1={wallX} y1={groundY + 12} x2={wallX + w} y2={groundY + 12} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x={wallX + w / 2} y={groundY + 24} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '10px' }}>
          Span: {span.toFixed(2)} {unit}
        </text>
        {/* Rafter label (along the slope, offset above) */}
        <text
          x={wallX + w / 2}
          y={groundY - h / 2 - 8}
          textAnchor="middle"
          className="fill-slate-600"
          style={{ fontSize: '10px', fontWeight: 500 }}
        >
          Rafter: {rafterLen.toFixed(2)} {unit}
        </text>
        {/* Pitch angle arc — at the base of the rafter, positioned right */}
        <path
          d={`M ${wallX + w - 30} ${groundY} A 30 30 0 0 0 ${wallX + w - 30 + 30 * Math.cos(rad)} ${groundY - 30 * Math.sin(rad)}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <text x={wallX + w - 15} y={groundY - 20} className="fill-blue-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {deg.toFixed(1)}°
        </text>
      </svg>
      <p className="text-xs text-slate-400">Rafter at {deg.toFixed(1)}° pitch — span is wall to ridge</p>
    </div>
  );
}

// ─── Hip/valley isometric diagram ────────────────────

function HipValleyDiagram({ degrees, planLength, hipLen, unit }: { degrees: number; planLength: number; hipLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;
  const height = Math.tan(rad) * planLength * 0.7; // visual approximation

  // Scale to fit
  const scale = 60 / Math.max(planLength, 1);
  const pl = planLength * scale;
  const vh = height * scale * 0.5;

  // Isometric corners — two roof planes meeting at a hip
  const isoX = 30 * Math.PI / 180;

  // Corner point (bottom)
  const corner = { x: 140, y: 145 };
  // Ridge end (top, back-right)
  const ridge = { x: corner.x + pl * Math.cos(isoX), y: corner.y - pl * Math.sin(isoX) - vh };
  // Left wall top
  const left = { x: corner.x - pl * 0.5 * Math.cos(isoX), y: corner.y - pl * 0.5 * Math.sin(isoX) - vh * 0.5 };
  // Right wall top
  const right = { x: corner.x + pl * 0.5 * Math.cos(isoX), y: corner.y - pl * 0.5 * Math.sin(isoX) - vh * 0.5 };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 280 180" className="w-full max-w-sm">
        {/* Ground plan lines (dashed) */}
        <line x1={corner.x} y1={corner.y} x2={ridge.x} y2={corner.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
        <text x={(corner.x + ridge.x) / 2} y={corner.y + 12} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '9px' }}>
          Plan: {planLength.toFixed(2)} {unit}
        </text>

        {/* Roof plane 1 (left slope) */}
        <line x1={corner.x} y1={corner.y} x2={ridge.x} y2={ridge.y} stroke="#3b82f6" strokeWidth="3" />
        {/* Roof plane 2 (right slope) — meeting at the hip line */}
        <line x1={corner.x} y1={corner.y} x2={ridge.x} y2={ridge.y} stroke="#3b82f6" strokeWidth="3" />

        {/* Hip line (the blue line from corner to ridge) */}
        <line x1={corner.x} y1={corner.y} x2={ridge.x} y2={ridge.y} stroke="#3b82f6" strokeWidth="3" />

        {/* Ridge point */}
        <circle cx={ridge.x} cy={ridge.y} r="3" fill="#3b82f6" />
        <text x={ridge.x + 5} y={ridge.y - 5} className="fill-slate-600" style={{ fontSize: '9px', fontWeight: 500 }}>
          Ridge
        </text>

        {/* Corner point */}
        <circle cx={corner.x} cy={corner.y} r="3" fill="#94a3b8" />
        <text x={corner.x - 5} y={corner.y + 14} textAnchor="end" className="fill-slate-400" style={{ fontSize: '9px' }}>
          Corner
        </text>

        {/* Hip length label */}
        <text
          x={(corner.x + ridge.x) / 2 + 15}
          y={(corner.y + ridge.y) / 2}
          className="fill-blue-500"
          style={{ fontSize: '9px', fontWeight: 500 }}
        >
          Hip: {hipLen.toFixed(2)} {unit}
        </text>

        {/* Pitch label */}
        <text x={corner.x + 20} y={corner.y - 10} className="fill-slate-500" style={{ fontSize: '9px' }}>
          {deg.toFixed(1)}°
        </text>
      </svg>
      <p className="text-xs text-slate-400">Hip line from corner to ridge — two roof planes meet</p>
    </div>
  );
}
