'use client';

import { useState, useEffect } from 'react';
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
type AngleSelection = 'interior' | 'exterior';

export function AngleCalculatorModal({
  isOpen,
  onClose,
  onApply,
  currentAngle: _currentAngle,
}: AngleCalculatorModalProps) {
  const [flashingType, setFlashingType] = useState<FlashingType>('ridge');
  const [pitch1, setPitch1] = useState<string>('25');
  const [pitch2, setPitch2] = useState<string>('25');
  const [sameAsPitch1, setSameAsPitch1] = useState<boolean>(true);
  const [cornerAngle, setCornerAngle] = useState<string>('90');
  const [result, setResult] = useState<AngleResult | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AngleSelection>('interior');

  // Keep pitch2 in sync with pitch1 when sameAsPitch1 is checked
  useEffect(() => {
    if (sameAsPitch1) {
      setPitch2(pitch1);
    }
  }, [pitch1, sameAsPitch1]);

  if (!isOpen) return null;

  const handleCalculate = () => {
    const p1 = parseFloat(pitch1);
    const p2 = parseFloat(pitch2);

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
      // Hip/Valley — auto-route based on inputs
      const effectiveP2 = sameAsPitch1 ? p1 : p2;
      const corner = parseFloat(cornerAngle);

      if (sameAsPitch1 && corner === 90) {
        // Standard case: both pitches equal, square corner
        calculatedResult = calculateHipValleySinglePitch(p1);
      } else {
        // Advanced case: different pitches or non-square corner
        if (isNaN(effectiveP2) || effectiveP2 < 0 || effectiveP2 > 90) {
          alert('Please enter a valid second pitch between 0 and 90 degrees');
          return;
        }
        if (isNaN(corner) || corner <= 0 || corner >= 180) {
          alert('Please enter a valid corner angle between 0 and 180 degrees');
          return;
        }
        calculatedResult = calculateHipValleyMultiPitch(p1, effectiveP2, corner);
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

  // Ridge always shows Pitch 2. Hip/Valley shows Pitch 2 only when checkbox is unchecked.
  const showPitch2 = flashingType === 'ridge' || !sameAsPitch1;
  // Corner Angle always visible for Hip/Valley
  const showCornerAngle = flashingType === 'hipValley';

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

        {/* Pitch Configuration (Hip/Valley only) — removed, replaced by same-as-pitch1 checkbox below */}

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

        {/* Same-as-pitch1 checkbox (Hip/Valley only) */}
        {flashingType === 'hipValley' && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPitch1}
                onChange={(e) => {
                  setSameAsPitch1(e.target.checked);
                  if (e.target.checked) {
                    setPitch2(pitch1);
                  }
                  setResult(null);
                }}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Same as Roof Pitch 1</span>
            </label>
            {!sameAsPitch1 && (
              <p className="text-xs text-slate-400 mt-1">Uncheck only if the second roof has a different pitch.</p>
            )}
          </div>
        )}

        {showCornerAngle && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Corner Angle (degrees)
            </label>
            <input
              type="number"
              value={cornerAngle}
              onChange={(e) => {
                setCornerAngle(e.target.value);
                setResult(null);
              }}
              min="0"
              max="180"
              step="0.1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-400 mt-1">Angle between the two roof lines. Usually 90°. Change only if the building corner is not square.</p>
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
            Copy Angle
          </button>
        </div>
      </div>
    </div>
  );
}
