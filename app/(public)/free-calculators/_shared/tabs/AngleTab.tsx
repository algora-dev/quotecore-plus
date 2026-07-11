'use client';

import { useState } from 'react';
import { useTradeConfig } from '../TradeCalculator';
import {
  calculateRidgeAngle,
  calculateHipValleyMultiPitch,
  calculateChangeOfPitch,
  calculateUpstandOntoRoof,
  calculateRoofIntoUpstand,
  type AngleResult,
} from '@/app/lib/roofAngleCalculator';

type CalcType = 'hipValley' | 'rafterPitch';
type RafterSubType = 'ridge' | 'changeOfPitch' | 'upstandOntoRoof' | 'roofIntoUpstand';

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  hipValley: {
    title: 'Hip / Valley',
    description: 'Use when two roof planes meet around an internal or external corner (usually a 90° building corner).',
  },
  rafterPitch: {
    title: 'Rafter Pitch',
    description: 'Used where roof planes run in the same direction. Includes Ridge, Change of Pitch, Upstand onto Roof, and Roof into Upstand.',
  },
  ridge: {
    title: 'Ridge',
    description: 'Use where two roof planes meet at the ridge or peak. Formula: 180° − Pitch 1 − Pitch 2',
  },
  changeOfPitch: {
    title: 'Change of Pitch',
    description: 'Use where one roof slope changes into another running in the same direction. Formula: 180° − Upper Pitch + Lower Pitch.',
  },
  upstandOntoRoof: {
    title: 'Upstand onto Roof',
    description: 'Use where flashing starts on a vertical upstand and turns down onto the roof. Formula: 90° + Roof Pitch.',
  },
  roofIntoUpstand: {
    title: 'Roof into Upstand',
    description: 'Use where flashing starts on the roof and turns up into a vertical upstand. Formula: 90° − Roof Pitch.',
  },
};

export function AngleTab() {
  const config = useTradeConfig();
  const cfg = config.angle;
  if (!cfg) throw new Error(`Trade "${config.slug}" uses the angle tab without an angle config`);

  const [calcType, setCalcType] = useState<CalcType>('hipValley');
  const [rafterSubType, setRafterSubType] = useState<RafterSubType>('ridge');

  // Hip/Valley state
  const [pitch1, setPitch1] = useState('25');
  const [pitch2, setPitch2] = useState('25');
  const [sameAsPitch1, setSameAsPitch1] = useState(true);
  const [cornerAngle, setCornerAngle] = useState('90');

  // Rafter Pitch — Ridge
  const [ridgePitch1, setRidgePitch1] = useState('25');
  const [ridgePitch2, setRidgePitch2] = useState('25');
  const [ridgeSameAsPitch1, setRidgeSameAsPitch1] = useState(true);

  // Change of Pitch
  const [upperPitch, setUpperPitch] = useState('25');
  const [lowerPitch, setLowerPitch] = useState('10');

  // Upstand / Roof into Upstand
  const [singlePitch, setSinglePitch] = useState('25');

  const [result, setResult] = useState<AngleResult | null>(null);

  function calculate() {
    let r: AngleResult;

    if (calcType === 'hipValley') {
      const p1 = parseFloat(pitch1) || 0;
      const p2 = sameAsPitch1 ? p1 : (parseFloat(pitch2) || 0);
      const corner = parseFloat(cornerAngle) || 90;
      r = calculateHipValleyMultiPitch(p1, p2, corner);
    } else {
      switch (rafterSubType) {
        case 'ridge': {
          const p1 = parseFloat(ridgePitch1) || 0;
          const p2 = ridgeSameAsPitch1 ? p1 : (parseFloat(ridgePitch2) || 0);
          r = calculateRidgeAngle(p1, p2);
          break;
        }
        case 'changeOfPitch': {
          r = calculateChangeOfPitch(parseFloat(upperPitch) || 0, parseFloat(lowerPitch) || 0);
          break;
        }
        case 'upstandOntoRoof': {
          r = calculateUpstandOntoRoof(parseFloat(singlePitch) || 0);
          break;
        }
        case 'roofIntoUpstand': {
          r = calculateRoofIntoUpstand(parseFloat(singlePitch) || 0);
          break;
        }
      }
    }

    setResult(r!);
  }

  const showPitch2 = calcType === 'hipValley' ? !sameAsPitch1 : (rafterSubType === 'ridge' && !ridgeSameAsPitch1);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{cfg.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
      </div>

      {/* Calculator type */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">What are you calculating?</label>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            onClick={() => { setCalcType('hipValley'); setResult(null); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              calcType === 'hipValley' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Hip / Valley
          </button>
          <button
            onClick={() => { setCalcType('rafterPitch'); setResult(null); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              calcType === 'rafterPitch' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Rafter Pitch
          </button>
        </div>
        <p className="text-xs text-slate-400">{TOOLTIPS[calcType].description}</p>
      </div>

      {/* Rafter sub-type */}
      {calcType === 'rafterPitch' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Specific calculation</label>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
            {([
              { value: 'ridge', label: 'Ridge' },
              { value: 'changeOfPitch', label: 'Change of Pitch' },
              { value: 'upstandOntoRoof', label: 'Upstand onto Roof' },
              { value: 'roofIntoUpstand', label: 'Roof into Upstand' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setRafterSubType(opt.value); setResult(null); }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  rafterSubType === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">{TOOLTIPS[rafterSubType].description}</p>
        </div>
      )}

      {/* Dynamic inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {calcType === 'hipValley' && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700">Roof Pitch 1 (°)</label>
              <input
                type="number"
                value={pitch1}
                onChange={(e) => { setPitch1(e.target.value); setResult(null); }}
                min={0} max={89} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            {!sameAsPitch1 && (
              <div>
                <label className="text-sm font-medium text-slate-700">Roof Pitch 2 (°)</label>
                <input
                  type="number"
                  value={pitch2}
                  onChange={(e) => { setPitch2(e.target.value); setResult(null); }}
                  min={0} max={89} step={0.1}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={sameAsPitch1}
                onChange={(e) => { setSameAsPitch1(e.target.checked); setResult(null); }}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-600">Pitch 2 is the same as Pitch 1</span>
            </label>
            <div>
              <label className="text-sm font-medium text-slate-700">Corner angle (°)</label>
              <input
                type="number"
                value={cornerAngle}
                onChange={(e) => { setCornerAngle(e.target.value); setResult(null); }}
                min={1} max={180} step={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Usually 90° for square building corners</p>
            </div>
          </>
        )}

        {calcType === 'rafterPitch' && rafterSubType === 'ridge' && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700">Roof Pitch 1 (°)</label>
              <input
                type="number"
                value={ridgePitch1}
                onChange={(e) => { setRidgePitch1(e.target.value); setResult(null); }}
                min={0} max={89} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            {!ridgeSameAsPitch1 && (
              <div>
                <label className="text-sm font-medium text-slate-700">Roof Pitch 2 (°)</label>
                <input
                  type="number"
                  value={ridgePitch2}
                  onChange={(e) => { setRidgePitch2(e.target.value); setResult(null); }}
                  min={0} max={89} step={0.1}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={ridgeSameAsPitch1}
                onChange={(e) => { setRidgeSameAsPitch1(e.target.checked); setResult(null); }}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-600">Pitch 2 is the same as Pitch 1</span>
            </label>
          </>
        )}

        {calcType === 'rafterPitch' && rafterSubType === 'changeOfPitch' && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700">Upper pitch (°)</label>
              <input
                type="number"
                value={upperPitch}
                onChange={(e) => { setUpperPitch(e.target.value); setResult(null); }}
                min={0} max={89} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Lower pitch (°)</label>
              <input
                type="number"
                value={lowerPitch}
                onChange={(e) => { setLowerPitch(e.target.value); setResult(null); }}
                min={0} max={89} step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {calcType === 'rafterPitch' && (rafterSubType === 'upstandOntoRoof' || rafterSubType === 'roofIntoUpstand') && (
          <div>
            <label className="text-sm font-medium text-slate-700">Roof pitch (°)</label>
            <input
              type="number"
              value={singlePitch}
              onChange={(e) => { setSinglePitch(e.target.value); setResult(null); }}
              min={0} max={89} step={0.1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
              <p className="text-xs text-slate-500">Finished angle</p>
              <p className="text-2xl font-bold text-slate-900">{result.finishedAngle}°</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Bend from flat</p>
              <p className="text-lg font-semibold text-slate-900">{result.bendAngleFromFlat}°</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Angle type</p>
              <span className={`inline-block mt-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                result.angleType === 'internal' ? 'bg-orange-100 text-orange-700' :
                result.angleType === 'external' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {result.angleType}
              </span>
            </div>
          </div>

          {/* Expandable calculation */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
              Show calculation
            </summary>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                {calcType === 'hipValley' && (
                  <>
                    Hip slope = arctan(tan({pitch1}°) × sqrt(2)) = {result.additionalInfo?.hipSlope?.toFixed(1)}°
                    <br />
                    Finished angle = 180° − 2 × {result.additionalInfo?.hipSlope?.toFixed(1)}° = <strong>{result.finishedAngle}°</strong>
                  </>
                )}
                {calcType === 'rafterPitch' && rafterSubType === 'ridge' && (
                  <>
                    Formula: 180° − Pitch 1 − Pitch 2
                    <br />
                    = 180° − {ridgePitch1}° − {ridgeSameAsPitch1 ? ridgePitch1 : ridgePitch2}° = <strong>{result.finishedAngle}°</strong>
                  </>
                )}
                {calcType === 'rafterPitch' && rafterSubType === 'changeOfPitch' && (
                  <>
                    Formula: 180° − Upper Pitch + Lower Pitch
                    <br />
                    = 180° − {upperPitch}° + {lowerPitch}° = <strong>{result.finishedAngle}°</strong>
                    <br />
                    {parseFloat(upperPitch) > parseFloat(lowerPitch) ? 'Upper > Lower → internal (folds inward)' :
                     parseFloat(upperPitch) < parseFloat(lowerPitch) ? 'Upper < Lower → external (opens outward)' :
                     'Same pitch → straight (180°)'}
                  </>
                )}
                {calcType === 'rafterPitch' && rafterSubType === 'upstandOntoRoof' && (
                  <>
                    Formula: 90° + Roof Pitch
                    <br />
                    = 90° + {singlePitch}° = <strong>{result.finishedAngle}°</strong>
                  </>
                )}
                {calcType === 'rafterPitch' && rafterSubType === 'roofIntoUpstand' && (
                  <>
                    Formula: 90° − Roof Pitch
                    <br />
                    = 90° − {singlePitch}° = <strong>{result.finishedAngle}°</strong>
                  </>
                )}
                <br />
                Bend from flat = |180° − {result.finishedAngle}°| = {result.bendAngleFromFlat}°
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
