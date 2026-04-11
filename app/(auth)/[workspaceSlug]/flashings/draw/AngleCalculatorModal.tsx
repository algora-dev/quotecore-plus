'use client';

import { useState } from 'react';
import {
  calculateRidgeAngle,
  calculateHipValleySinglePitch,
  calculateHipValleyMultiPitch,
  type AngleResult,
} from '@/app/lib/roofAngleCalculator';

interface AngleCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (angle: number) => void;
  currentAngle: number;
}

type FlashingType = 'ridge' | 'hipValley';
type PitchConfig = 'single' | 'multi';
type AngleSelection = 'interior' | 'exterior';

export function AngleCalculatorModal({
  isOpen,
  onClose,
  onApply,
  currentAngle,
}: AngleCalculatorModalProps) {
  const [flashingType, setFlashingType] = useState<FlashingType>('ridge');
  const [pitchConfig, setPitchConfig] = useState<PitchConfig>('single');
  const [pitch1, setPitch1] = useState<string>('25');
  const [pitch2, setPitch2] = useState<string>('45');
  const [planAngle, setPlanAngle] = useState<string>('90');
  const [result, setResult] = useState<AngleResult | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AngleSelection>('interior');

  if (!isOpen) return null;

  const handleCalculate = () => {
    const p1 = parseFloat(pitch1);
    const p2 = parseFloat(pitch2);
    const plan = parseFloat(planAngle);

    if (isNaN(p1) || p1 < 0 || p1 > 90) {
      alert('Please enter a valid pitch between 0 and 90 degrees');
      return;
    }

    let calculatedResult: AngleResult;

    if (flashingType === 'ridge') {
      if (isNaN(p2) || p2 < 0 || p2 > 90) {
        alert('Please enter a valid second pitch between 0 and 90 degrees');
        return;
      }
      calculatedResult = calculateRidgeAngle(p1, p2);
    } else {
      // Hip/Valley
      if (pitchConfig === 'single') {
        calculatedResult = calculateHipValleySinglePitch(p1);
      } else {
        if (isNaN(p2) || p2 < 0 || p2 > 90) {
          alert('Please enter a valid second pitch between 0 and 90 degrees');
          return;
        }
        if (isNaN(plan) || plan <= 0 || plan >= 180) {
          alert('Please enter a valid plan angle between 0 and 180 degrees');
          return;
        }
        calculatedResult = calculateHipValleyMultiPitch(p1, p2, plan);
      }
    }

    setResult(calculatedResult);
  };

  const handleApply = () => {
    if (!result) return;
    const angleToApply = selectedAngle === 'interior' ? result.interior : result.exterior;
    onApply(angleToApply);
    onClose();
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const showPitch2 = flashingType === 'ridge' || (flashingType === 'hipValley' && pitchConfig === 'multi');
  const showPlanAngle = flashingType === 'hipValley' && pitchConfig === 'multi';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Auto-Calculate Roof Angle</h2>

        {/* Flashing Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Flashing Type</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="flashingType"
                value="ridge"
                checked={flashingType === 'ridge'}
                onChange={(e) => {
                  setFlashingType(e.target.value as FlashingType);
                  setResult(null);
                }}
                className="mr-2"
              />
              <span className="text-sm">Ridge/Apron/Change of Pitch</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="flashingType"
                value="hipValley"
                checked={flashingType === 'hipValley'}
                onChange={(e) => {
                  setFlashingType(e.target.value as FlashingType);
                  setResult(null);
                }}
                className="mr-2"
              />
              <span className="text-sm">Hip/Valley</span>
            </label>
          </div>
        </div>

        {/* Pitch Configuration (Hip/Valley only) */}
        {flashingType === 'hipValley' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Pitch Configuration</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="pitchConfig"
                  value="single"
                  checked={pitchConfig === 'single'}
                  onChange={(e) => {
                    setPitchConfig(e.target.value as PitchConfig);
                    setResult(null);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Single Pitch (both sides same)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="pitchConfig"
                  value="multi"
                  checked={pitchConfig === 'multi'}
                  onChange={(e) => {
                    setPitchConfig(e.target.value as PitchConfig);
                    setResult(null);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Multi Pitch (different pitches)</span>
              </label>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-300 my-4" />

        {/* Pitch Inputs */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Roof Pitch 1 (degrees)
          </label>
          <input
            type="number"
            value={pitch1}
            onChange={(e) => {
              setPitch1(e.target.value);
              setResult(null);
            }}
            min="0"
            max="90"
            step="0.1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        {showPitch2 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Roof Pitch 2 (degrees)
            </label>
            <input
              type="number"
              value={pitch2}
              onChange={(e) => {
                setPitch2(e.target.value);
                setResult(null);
              }}
              min="0"
              max="90"
              step="0.1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        )}

        {showPlanAngle && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plan Angle (degrees) - Default 90° for square corners
            </label>
            <input
              type="number"
              value={planAngle}
              onChange={(e) => {
                setPlanAngle(e.target.value);
                setResult(null);
              }}
              min="0"
              max="180"
              step="0.1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        )}

        <button
          onClick={handleCalculate}
          className="w-full px-4 py-2 bg-[#FF6B35] text-white font-medium rounded-lg hover:bg-[#ff5722] transition-colors mb-4"
        >
          Calculate
        </button>

        {/* Results */}
        {result && (
          <>
            <div className="h-px bg-slate-300 my-4" />
            
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Results</h3>
              
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="angleSelection"
                    value="interior"
                    checked={selectedAngle === 'interior'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">Interior Angle:</span>
                    <span className="ml-2 text-lg font-bold text-[#FF6B35]">{result.interior}°</span>
                  </div>
                </label>
                
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="angleSelection"
                    value="exterior"
                    checked={selectedAngle === 'exterior'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">Exterior Angle:</span>
                    <span className="ml-2 text-lg font-bold text-[#FF6B35]">{result.exterior}°</span>
                  </div>
                </label>
              </div>

              {/* Additional Info */}
              {result.additionalInfo && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-900 mb-1">Additional Information:</p>
                  {result.additionalInfo.hipSlope !== undefined && (
                    <p className="text-xs text-blue-800">Hip Slope: {result.additionalInfo.hipSlope}°</p>
                  )}
                  {result.additionalInfo.foldFromFlat !== undefined && (
                    <p className="text-xs text-blue-800">Fold from Flat: {result.additionalInfo.foldFromFlat}°</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!result}
            className="flex-1 px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Selected
          </button>
        </div>
      </div>
    </div>
  );
}
