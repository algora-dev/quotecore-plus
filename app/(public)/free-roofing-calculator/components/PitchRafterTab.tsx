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
                <HipValleyDiagram degrees={result.deg} planLength={parseFloat(planLength) || 0} hipLen={result.hipLen} unit={lengthUnit} />
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

// ─── Hip/Valley 3D perspective diagram ──────────────
// Two roof planes meeting at a hip/valley line:
// - Two filled roof faces visible in 3D perspective
// - They meet at the eaves (bottom) and at the peak (top)
// - Hip/valley line runs from eaves to peak (orange, bold)
// - Steeper pitch = taller peak, lower pitch = flatter
// - Green arrows show water flow direction down each plane

function HipValleyDiagram({ degrees, planLength, hipLen, unit }: { degrees: number; planLength: number; hipLen: number; unit: string }) {
  const deg = Math.max(0, Math.min(89, degrees));
  const rad = (deg * Math.PI) / 180;

  // Scale to fit viewBox
  const scale = 42 / Math.max(planLength, 1);
  const pl = planLength * scale;

  // Rise (peak height) — directly proportional to pitch
  // steeper pitch = taller peak, lower pitch = flatter
  const rawRise = pl * Math.tan(rad);
  const maxRise = 115;
  const rise = Math.min(rawRise, maxRise);

  // Depth offset for 3D perspective
  const depth = pl * 0.45;

  // Layout
  const cx = 150;
  const cy = 185;

  // Key points in screen coordinates:
  // Corner (eaves meeting point, front-center, bottom)
  const corner = { x: cx, y: cy };
  // Left eaves — extends left and slightly forward
  const eavesL = { x: cx - pl * 0.866, y: cy + pl * 0.22 };
  // Right eaves — extends right and slightly forward
  const eavesR = { x: cx + pl * 0.866, y: cy + pl * 0.22 };
  // Peak — above and behind corner (3D perspective: up + slightly right)
  const peak = { x: cx + depth * 0.35, y: cy - rise - depth * 0.35 };

  const hipAngleDeg = Math.atan(Math.tan(rad) * Math.cos(45 * RAD)) * 180 / Math.PI;

  const hipMid = {
    x: (corner.x + peak.x) / 2,
    y: (corner.y + peak.y) / 2,
  };

  // Direction arrows: water flows from peak down each plane toward eaves
  const leftArrowStart = {
    x: peak.x + (eavesL.x - peak.x) * 0.3,
    y: peak.y + (eavesL.y - peak.y) * 0.3,
  };
  const leftArrowEnd = {
    x: peak.x + (eavesL.x - peak.x) * 0.7,
    y: peak.y + (eavesL.y - peak.y) * 0.7,
  };
  const rightArrowStart = {
    x: peak.x + (eavesR.x - peak.x) * 0.3,
    y: peak.y + (eavesR.y - peak.y) * 0.3,
  };
  const rightArrowEnd = {
    x: peak.x + (eavesR.x - peak.x) * 0.7,
    y: peak.y + (eavesR.y - peak.y) * 0.7,
  };

  const leftPlanePts = `${corner.x},${corner.y} ${eavesL.x},${eavesL.y} ${peak.x},${peak.y}`;
  const rightPlanePts = `${corner.x},${corner.y} ${eavesR.x},${eavesR.y} ${peak.x},${peak.y}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 300 230" className="w-full max-w-md">
        {/* Eaves line (ground level) */}
        <line x1={eavesL.x} y1={eavesL.y} x2={eavesR.x} y2={eavesR.y} stroke="#94a3b8" strokeWidth="1.5" />

        {/* Right roof plane (far side, darker) */}
        <polygon points={rightPlanePts} fill="rgba(59, 130, 246, 0.18)" stroke="#3b82f6" strokeWidth="1.5" />

        {/* Left roof plane (near side, lighter) */}
        <polygon points={leftPlanePts} fill="rgba(59, 130, 246, 0.08)" stroke="#3b82f6" strokeWidth="1.5" />

        {/* Hip/Valley line (orange, bold — corner to peak) */}
        <line x1={corner.x} y1={corner.y} x2={peak.x} y2={peak.y} stroke="#FF6B35" strokeWidth="3.5" />

        {/* Roof edges (peak to each eaves end) */}
        <line x1={peak.x} y1={peak.y} x2={eavesL.x} y2={eavesL.y} stroke="#3b82f6" strokeWidth="2" />
        <line x1={peak.x} y1={peak.y} x2={eavesR.x} y2={eavesR.y} stroke="#3b82f6" strokeWidth="2" />

        {/* Direction arrows (green — water flow down each plane) */}
        <SlopeArrow start={leftArrowStart} end={leftArrowEnd} color="#10b981" />
        <SlopeArrow start={rightArrowStart} end={rightArrowEnd} color="#10b981" />

        {/* Peak point */}
        <circle cx={peak.x} cy={peak.y} r="4" fill="#3b82f6" />
        <text x={peak.x + 7} y={peak.y - 5} className="fill-slate-700" style={{ fontSize: '10px', fontWeight: 600 }}>
          Peak
        </text>

        {/* Corner (eaves) point */}
        <circle cx={corner.x} cy={corner.y} r="3.5" fill="#94a3b8" />
        <text x={corner.x + 7} y={corner.y + 14} className="fill-slate-400" style={{ fontSize: '9px' }}>
          Eaves
        </text>

        {/* Hip/Valley length label */}
        <text x={hipMid.x + 14} y={hipMid.y} className="fill-[#FF6B35]" style={{ fontSize: '10px', fontWeight: 600 }}>
          Hip: {hipLen.toFixed(2)} {unit}
        </text>

        {/* Pitch label */}
        <text x={corner.x - 8} y={corner.y - 28} textAnchor="end" className="fill-slate-600" style={{ fontSize: '10px', fontWeight: 500 }}>
          Pitch: {deg.toFixed(1)}°
        </text>

        {/* Hip slope angle */}
        <text x={corner.x - 8} y={corner.y - 16} textAnchor="end" className="fill-slate-400" style={{ fontSize: '9px' }}>
          Hip slope: {hipAngleDeg.toFixed(1)}°
        </text>

        {/* Plan length */}
        <text x={(corner.x + eavesR.x) / 2} y={eavesR.y + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '9px' }}>
          Plan: {planLength.toFixed(2)} {unit}
        </text>

        {/* Legend */}
        <g transform="translate(8, 8)">
          <line x1="0" y1="4" x2="14" y2="4" stroke="#FF6B35" strokeWidth="2.5" />
          <text x="18" y="7" className="fill-slate-500" style={{ fontSize: '8px' }}>Hip/Valley</text>
          <line x1="0" y1="16" x2="14" y2="16" stroke="#3b82f6" strokeWidth="2" />
          <text x="18" y="19" className="fill-slate-500" style={{ fontSize: '8px' }}>Roof edge</text>
          <line x1="0" y1="28" x2="14" y2="28" stroke="#10b981" strokeWidth="1.5" />
          <text x="18" y="31" className="fill-slate-500" style={{ fontSize: '8px' }}>Slope direction</text>
        </g>
      </svg>
      <p className="text-xs text-slate-400">
        Two roof planes meeting at hip line — {deg.toFixed(1)}° pitch, {hipAngleDeg.toFixed(1)}° hip slope
      </p>
    </div>
  );
}

// ─── Slope arrow helper ──────────────────────────────

function SlopeArrow({ start, end, color }: { start: { x: number; y: number }; end: { x: number; y: number }; color: string }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ang = Math.atan2(dy, dx);
  const s = 5;
  return (
    <g>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth="1.5" />
      <polygon
        points={`${end.x},${end.y} ${end.x + s * Math.cos(ang + 2.6)},${end.y + s * Math.sin(ang + 2.6)} ${end.x + s * Math.cos(ang - 2.6)},${end.y + s * Math.sin(ang - 2.6)}`}
        fill={color}
      />
    </g>
  );
}
