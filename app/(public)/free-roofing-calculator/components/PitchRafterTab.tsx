'use client';

import { useState } from 'react';
import { useUnitSystem } from '../RoofingCalculator';
import { degreesToRatio, ratioToDegrees, rafterLength, rafterPitchFactor, hipValleyPitchFactor, hipValleyLength } from '../../lib/calculator';
import { HipValleyHouseDiagram } from './HipValleyHouseDiagram';

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

      <button
        onClick={calculate}
        className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
      >
        Calculate
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

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
                  <p className="text-xs text-slate-500">Hip slope (deg)</p>
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
                <HipValleyHouseDiagram
                  pitchDegrees={result.deg}
                  hipSlopeDegrees={Math.atan(Math.tan(result.deg * RAD) * Math.cos(45 * RAD)) * 180 / Math.PI}
                  hipValleyLength={result.hipLen}
                  planLength={parseFloat(planLength) || 0}
                  unit={lengthUnit as 'm' | 'ft'}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Rafter diagram (geometrically exact) ────────────

function RafterDiagram({ degrees, span, rafterLen, unit }: { degrees: number; span: number; rafterLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;

  const maxW = 220;
  const maxH = 120;
  const aspectFromPitch = Math.tan(rad);
  let drawW = maxW;
  let drawH = drawW * aspectFromPitch;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH / aspectFromPitch;
  }

  const padLeft = 40;
  const groundY = 150;

  const A = { x: padLeft, y: groundY };
  const B = { x: padLeft, y: groundY - drawH };
  const C = { x: padLeft + drawW, y: groundY };

  const arcR = 28;
  const arcStartX = C.x - arcR;
  const arcStartY = C.y;
  const arcEndX = C.x - arcR * Math.cos(rad);
  const arcEndY = C.y - arcR * Math.sin(rad);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 300 185" className="w-full max-w-md">
        <line x1={A.x - 10} y1={groundY} x2={C.x + 20} y2={groundY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#94a3b8" strokeWidth="2.5" />
        <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke="#FF6B35" strokeWidth="3" />
        <path d={`M ${A.x + 8} ${A.y} L ${A.x + 8} ${A.y - 8} L ${A.x} ${A.y - 8}`} fill="none" stroke="#cbd5e1" strokeWidth="1" />
        <path d={`M ${arcStartX} ${arcStartY} A ${arcR} ${arcR} 0 0 1 ${arcEndX} ${arcEndY}`} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <text x={C.x - arcR - 8} y={C.y - arcR * 0.65} textAnchor="middle" className="fill-blue-500" style={{ fontSize: '11px', fontWeight: 600 }}>
          {deg.toFixed(1)}°
        </text>
        <circle cx={B.x} cy={B.y} r="3.5" fill="#3b82f6" />
        <text x={B.x - 6} y={B.y - 6} textAnchor="end" className="fill-slate-600" style={{ fontSize: '9px', fontWeight: 500 }}>Ridge</text>
        <circle cx={C.x} cy={C.y} r="3.5" fill="#94a3b8" />
        <text x={C.x + 6} y={C.y + 12} className="fill-slate-400" style={{ fontSize: '9px' }}>Eaves</text>
        <line x1={A.x} y1={groundY + 18} x2={C.x} y2={groundY + 18} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
        <line x1={A.x} y1={groundY + 14} x2={A.x} y2={groundY + 22} stroke="#94a3b8" strokeWidth="1" />
        <line x1={C.x} y1={groundY + 14} x2={C.x} y2={groundY + 22} stroke="#94a3b8" strokeWidth="1" />
        <text x={(A.x + C.x) / 2} y={groundY + 32} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          Span: {span.toFixed(2)} {unit}
        </text>
        <line x1={A.x - 16} y1={A.y} x2={A.x - 16} y2={B.y} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
        <line x1={A.x - 12} y1={A.y} x2={A.x - 20} y2={A.y} stroke="#94a3b8" strokeWidth="1" />
        <line x1={A.x - 12} y1={B.y} x2={A.x - 20} y2={B.y} stroke="#94a3b8" strokeWidth="1" />
        <text x={A.x - 22} y={(A.y + B.y) / 2} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }} transform={`rotate(-90, ${A.x - 22}, ${(A.y + B.y) / 2})`}>
          Rise: {(span * Math.tan(rad)).toFixed(2)} {unit}
        </text>
        <text x={(B.x + C.x) / 2 + 4} y={(B.y + C.y) / 2 - 8} textAnchor="middle" className="fill-slate-700" style={{ fontSize: '11px', fontWeight: 600 }}>
          Rafter: {rafterLen.toFixed(2)} {unit}
        </text>
      </svg>
      <p className="text-xs text-slate-400">Rafter at {deg.toFixed(1)}° pitch — span is wall to ridge (one rafter)</p>
    </div>
  );
}

// Old HipValleyDiagram and SlopeArrow removed — replaced by HipValleyHouseDiagram component
