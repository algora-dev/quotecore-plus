'use client';

import { useState } from 'react';
import { useUnitSystem, useSharedState, useTradeConfig } from '../TradeCalculator';
import { degreesToRatio, ratioToDegrees, rafterLength, rafterPitchFactor, hipValleyPitchFactor, hipValleyLength } from '../../../lib/calculator';
import { BirdsmouthDiagram } from '../AngleDiagram';

const RAD = Math.PI / 180;

type PitchMode = 'degrees' | 'ratio';
type SubTab = 'member' | 'hip-valley' | 'birdsmouth';

export function MembersTab() {
  const { lengthUnit, system } = useUnitSystem();
  const bmUnit = system === 'metric' ? 'mm' : 'in';
  const { shared: _unused, setShared } = useSharedState();
  const config = useTradeConfig();
  const cfg = config.members;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the members tab without a members config`);

  const slope = cfg.slopeWord;
  const memberWord = cfg.birdsmouthMemberWord ?? 'Rafter';

  const [subTab, setSubTab] = useState<SubTab>(cfg.showBirdsmouth ? 'birdsmouth' : 'member');
  const [mode, setMode] = useState<PitchMode>('degrees');
  const [pitchDeg, setPitchDeg] = useState(cfg.defaultSlope);
  const [ratioX, setRatioX] = useState('1');
  const [ratioY, setRatioY] = useState(() => {
    const r = degreesToRatio(parseFloat(cfg.defaultSlope) || 0);
    return r.y ? r.y.toFixed(3) : '0';
  });
  const [span, setSpan] = useState('10');
  const [planLength, setPlanLength] = useState('7');

  // Bird's mouth inputs (mm metric / in imperial)
  const [seatWidth, setSeatWidth] = useState('100');
  const [rafterDepth, setRafterDepth] = useState('200');
  const [bmResult, setBmResult] = useState<null | {
    deg: number;
    seatAngle: number;
    plumbAngle: number;
    heel: number;
    notchDepth: number;
    maxNotch: number;
    seat: number;
    pass: boolean;
    rafterDepth: number;
  }>(null);
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

  function calculateBirdsmouth() {
    const d = parseFloat(pitchDeg) || 0;
    const s = parseFloat(seatWidth) || 0;
    const depth = parseFloat(rafterDepth) || 0;
    const heel = s * Math.tan(d * RAD);
    const notchDepth = s * Math.sin(d * RAD);
    const maxNotch = depth / 3;
    setBmResult({
      deg: d,
      seatAngle: d,
      plumbAngle: 90 - d,
      heel,
      notchDepth,
      maxNotch,
      seat: s,
      pass: notchDepth <= maxNotch,
      rafterDepth: depth,
    });
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
    // Trigger conversion popup
    setShared({
      popupTrigger: {
        resultLabel: `${rl.toFixed(2)} ${lengthUnit} rafter length`,
        resultDetails: `${cfg?.showHipValley ? `Hip/valley: ${hl.toFixed(2)} ${lengthUnit} · ` : ''}Pitch: ${d}° · Factor: ${rf.toFixed(4)}`,
        stage: 'calc-to-quote',
      },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      {(cfg.showHipValley || cfg.showBirdsmouth) && (
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            onClick={() => setSubTab('member')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              subTab === 'member' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {cfg.memberLabel}
          </button>
          {cfg.showHipValley && (
            <button
              onClick={() => setSubTab('hip-valley')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                subTab === 'hip-valley' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Hip / Valley
            </button>
          )}
          {cfg.showBirdsmouth && (
            <button
              onClick={() => setSubTab('birdsmouth')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                subTab === 'birdsmouth' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Bird&apos;s Mouth
            </button>
          )}
        </div>
      )}

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
            <label className="text-sm font-medium text-slate-700">{slope} (degrees)</label>
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
              {cfg.commonSlopes.map((p) => (
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
            <label className="text-sm font-medium text-slate-700">{slope} ratio (rise : run)</label>
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

        {subTab === 'member' && (
          <div>
            <label className="text-sm font-medium text-slate-700">{cfg.spanLabel} ({lengthUnit})</label>
            <input
              type="number"
              value={span}
              onChange={(e) => setSpan(e.target.value)}
              min={0}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">{cfg.spanHint}</p>
          </div>
        )}
        {subTab === 'hip-valley' && (
          <div>
            <label className="text-sm font-medium text-slate-700">{cfg.hipPlanLabel ?? 'Plan length'} ({lengthUnit})</label>
            <input
              type="number"
              value={planLength}
              onChange={(e) => setPlanLength(e.target.value)}
              min={0}
              step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">{cfg.hipPlanHint ?? 'Plan-view diagonal from corner to ridge'}</p>
          </div>
        )}
        {subTab === 'birdsmouth' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Seat width ({bmUnit})</label>
              <input
                type="number"
                value={seatWidth}
                onChange={(e) => setSeatWidth(e.target.value)}
                min={0}
                step={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-400">Bearing width on the wall plate (plate width is a common choice)</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{memberWord} depth ({bmUnit})</label>
              <input
                type="number"
                value={rafterDepth}
                onChange={(e) => setRafterDepth(e.target.value)}
                min={0}
                step={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-400">Timber depth — used to check the ⅓ maximum notch rule</p>
            </div>
          </div>
        )}
      </div>

      {/* Helper text for birdsmouth angle */}
      {subTab === 'birdsmouth' && (
        <p className="text-xs text-slate-400 -mt-2">Angle measured from horizontal.</p>
      )}

      <button
        onClick={subTab === 'birdsmouth' ? calculateBirdsmouth : calculate}
        className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
      >
        Calculate
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {subTab === 'birdsmouth' && bmResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Seat cut angle (to rafter edge)</p>
              <p className="text-lg font-bold text-slate-900">{bmResult.seatAngle.toFixed(1)}°</p>
            </div>
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Plumb cut angle (to rafter edge)</p>
              <p className="text-lg font-bold text-slate-900">{bmResult.plumbAngle.toFixed(1)}°</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Heel height (vertical)</p>
              <p className="text-base font-semibold text-slate-900">{bmResult.heel.toFixed(1)} {bmUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Notch depth (into rafter)</p>
              <p className="text-base font-semibold text-slate-900">{bmResult.notchDepth.toFixed(1)} {bmUnit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Maximum notch allowed (⅓ of depth)</p>
              <p className="text-base font-semibold text-slate-900">{bmResult.maxNotch.toFixed(1)} {bmUnit}</p>
            </div>
            <div className={`rounded-xl border p-4 ${
              bmResult.pass
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <p className="text-xs text-slate-500">Notch check</p>
              <p className={`text-base font-bold ${
                bmResult.pass ? 'text-green-700' : 'text-red-700'
              }`}>
                {bmResult.pass ? '✓ PASS' : '✗ FAIL'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {bmResult.pass
                  ? `Notch ${bmResult.notchDepth.toFixed(1)}${bmUnit} ≤ max ${bmResult.maxNotch.toFixed(1)}${bmUnit}`
                  : `Notch ${bmResult.notchDepth.toFixed(1)}${bmUnit} > max ${bmResult.maxNotch.toFixed(1)}${bmUnit}`}
              </p>
            </div>
          </div>

          {!bmResult.pass && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                ⚠️ Notch depth exceeds ⅓ of the {memberWord.toLowerCase()} depth. Cutting deeper than one-third weakens the timber — reduce the seat width or use a deeper section.
              </p>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                Seat cut angle (A) = {slope.toLowerCase()} = {bmResult.deg}° from the {memberWord.toLowerCase()} edge
                <br />
                Plumb cut angle (B) = 90° − {bmResult.deg}° = {bmResult.plumbAngle.toFixed(1)}° from the {memberWord.toLowerCase()} edge
                <br />
                Heel height = seat × tan({bmResult.deg}°) = {bmResult.seat} × {Math.tan(bmResult.deg * RAD).toFixed(4)} = {bmResult.heel.toFixed(1)} {bmUnit}
                <br />
                Notch depth = seat × sin({bmResult.deg}°) = {bmResult.notchDepth.toFixed(1)} {bmUnit} (max ⅓ × depth = {bmResult.maxNotch.toFixed(1)} {bmUnit})
              </p>
            </div>
          </details>

          <div className="border-t border-slate-100 pt-4">
            <BirdsmouthDiagram
              pitchDegrees={bmResult.deg}
              seatAngle={bmResult.seatAngle}
              plumbAngle={bmResult.plumbAngle}
              seatWidth={bmResult.seat}
              heelHeight={bmResult.heel}
              notchDepth={bmResult.notchDepth}
              rafterDepth={bmResult.rafterDepth}
              memberWord={memberWord}
              unit={bmUnit}
              caption={`Bird's mouth at ${bmResult.deg.toFixed(1)}° — A = horizontal seat cut, B = vertical plumb cut`}
            />
          </div>

          <p className="text-xs text-slate-400">Seat and plumb cut angles are shown relative to the rafter edge.</p>
        </div>
      )}

      {result && subTab !== 'birdsmouth' && (
        <div className="space-y-4">
          {subTab === 'member' ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Ratio</p>
                  <p className="text-base font-semibold text-slate-900">{result.ratio.x}:{result.ratio.y.toFixed(3)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">{cfg.memberLabel} factor</p>
                  <p className="text-base font-semibold text-slate-900">{result.rafterFactor.toFixed(4)}</p>
                </div>
                {cfg.showHipValley && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-xs text-slate-500">Hip/valley factor</p>
                    <p className="text-base font-semibold text-slate-900">{result.hipFactor.toFixed(4)}</p>
                  </div>
                )}
                <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                  <p className="text-xs text-slate-500">{cfg.memberLabel} length ({lengthUnit})</p>
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
                    {cfg.memberLabel} factor = 1 / cos({result.deg}°) = {result.rafterFactor.toFixed(4)}
                    <br />
                    {cfg.memberLabel} length = {cfg.spanLabel.toLowerCase()} / cos({result.deg}°)
                    <br />
                    {cfg.memberLabel} length = {span} / {Math.cos(result.deg * RAD).toFixed(4)} = <strong>{result.rafterLen.toFixed(3)} {lengthUnit}</strong>
                  </p>
                </div>
              </details>

              <div className="border-t border-slate-100 pt-4">
                <MemberDiagram
                  degrees={result.deg}
                  span={parseFloat(span) || 0}
                  rafterLen={result.rafterLen}
                  unit={lengthUnit}
                  memberLabel={cfg.memberLabel}
                  spanLabel={cfg.spanLabel}
                  topLabel={cfg.diagramTopLabel ?? 'Top'}
                  baseLabel={cfg.diagramBaseLabel ?? 'Base'}
                  caption={cfg.diagramCaption.replace('{deg}', result.deg.toFixed(1))}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">{cfg.memberLabel} factor</p>
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

              {/* Hip/valley diagram removed 2026-07-10 — static explainer images to be added by Shaun */}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Member diagram (geometrically exact) ────────────

function MemberDiagram({ degrees, span, rafterLen, unit, memberLabel, spanLabel, topLabel, baseLabel, caption }: {
  degrees: number;
  span: number;
  rafterLen: number;
  unit: string;
  memberLabel: string;
  spanLabel: string;
  topLabel: string;
  baseLabel: string;
  caption: string;
}) {
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
        <text x={B.x - 6} y={B.y - 6} textAnchor="end" className="fill-slate-600" style={{ fontSize: '9px', fontWeight: 500 }}>{topLabel}</text>
        <circle cx={C.x} cy={C.y} r="3.5" fill="#94a3b8" />
        <text x={C.x + 6} y={C.y + 12} className="fill-slate-400" style={{ fontSize: '9px' }}>{baseLabel}</text>
        <line x1={A.x} y1={groundY + 18} x2={C.x} y2={groundY + 18} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
        <line x1={A.x} y1={groundY + 14} x2={A.x} y2={groundY + 22} stroke="#94a3b8" strokeWidth="1" />
        <line x1={C.x} y1={groundY + 14} x2={C.x} y2={groundY + 22} stroke="#94a3b8" strokeWidth="1" />
        <text x={(A.x + C.x) / 2} y={groundY + 32} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {spanLabel}: {span.toFixed(2)} {unit}
        </text>
        <line x1={A.x - 16} y1={A.y} x2={A.x - 16} y2={B.y} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
        <line x1={A.x - 12} y1={A.y} x2={A.x - 20} y2={A.y} stroke="#94a3b8" strokeWidth="1" />
        <line x1={A.x - 12} y1={B.y} x2={A.x - 20} y2={B.y} stroke="#94a3b8" strokeWidth="1" />
        <text x={A.x - 22} y={(A.y + B.y) / 2} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }} transform={`rotate(-90, ${A.x - 22}, ${(A.y + B.y) / 2})`}>
          Rise: {(span * Math.tan(rad)).toFixed(2)} {unit}
        </text>
        <text x={(B.x + C.x) / 2 + 4} y={(B.y + C.y) / 2 - 8} textAnchor="middle" className="fill-slate-700" style={{ fontSize: '11px', fontWeight: 600 }}>
          {memberLabel}: {rafterLen.toFixed(2)} {unit}
        </text>
      </svg>
      <p className="text-xs text-slate-400">{caption}</p>
    </div>
  );
}
