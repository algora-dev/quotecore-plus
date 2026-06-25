'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  calculateRidgeAngle,
  calculateHipValleyMultiPitch,
  type AngleResult,
} from '@/app/lib/roofAngleCalculator';

interface AngleCalculatorWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (angle: number) => void;
  currentAngle: number;
}

type FlashingType = 'ridge' | 'hipValley';
type AngleSelection = 'interior' | 'exterior';

const WIDGET_WIDTH = 384; // max-w-md = 28rem = 448px, but we use w-96 = 24rem = 384px for compactness

export function AngleCalculatorWidget({
  isOpen,
  onClose,
  onApply,
  currentAngle: _currentAngle,
}: AngleCalculatorWidgetProps) {
  const [flashingType, setFlashingType] = useState<FlashingType>('ridge');
  const [pitch1, setPitch1] = useState<string>('25');
  const [pitch2, setPitch2] = useState<string>('25');
  const [sameAsPitch1, setSameAsPitch1] = useState<boolean>(true);
  const [cornerAngle, setCornerAngle] = useState<string>('90');
  const [result, setResult] = useState<AngleResult | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AngleSelection>('interior');

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Centre the widget on first open
  useEffect(() => {
    if (isOpen && !initialized) {
      const x = Math.max(16, window.innerWidth - WIDGET_WIDTH - 32);
      const y = 80;
      setPosition({ x, y });
      setInitialized(true);
    }
  }, [isOpen, initialized]);

  // Reset init state when closed so it re-centres next open
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen]);

  // Keep pitch2 in sync with pitch1 when sameAsPitch1 is checked
  useEffect(() => {
    if (sameAsPitch1) {
      setPitch2(pitch1);
    }
  }, [pitch1, sameAsPitch1]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag from the header bar
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newX = dragRef.current.origX + dx;
      const newY = dragRef.current.origY + dy;
      // Constrain to viewport
      const maxX = window.innerWidth - WIDGET_WIDTH;
      const maxY = window.innerHeight - 60; // keep at least header visible
      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };

    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [position.x, position.y]);

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
      // Hip/Valley — always use multi-pitch formula (it handles equal pitches
      // and 90° corners correctly via its internal simplified branch)
      const effectiveP2 = sameAsPitch1 ? p1 : p2;
      const corner = parseFloat(cornerAngle);

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

    setResult(calculatedResult);
  };

  const handleApply = () => {
    if (!result) return;
    const angleToApply = selectedAngle === 'interior' ? result.interior : result.exterior;
    onApply(angleToApply);
  };

  // Ridge always shows Pitch 2. Hip/Valley shows Pitch 2 only when checkbox is unchecked.
  const showPitch2 = flashingType === 'ridge' || !sameAsPitch1;
  // Corner Angle always visible for Hip/Valley (was previously hidden for single-pitch)
  const showCornerAngle = flashingType === 'hipValley';

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 select-none"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200 cursor-move bg-slate-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900">Angle Calculator</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-slate-200 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4 max-h-[calc(100vh-180px)] overflow-y-auto">
        {/* Flashing Type */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Flashing Type</label>
          <div className="space-y-1.5">
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
              <span className="text-xs">Ridge/Apron/Change of Pitch</span>
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
              <span className="text-xs">Hip/Valley</span>
            </label>
          </div>
        </div>

        {/* Pitch Configuration (Hip/Valley only) — removed, replaced by same-as-pitch1 checkbox below */}

        <div className="h-px bg-slate-200 my-3" />

        {/* Pitch Inputs */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
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
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {showPitch2 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
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
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        )}

        {/* Same-as-pitch1 checkbox (Hip/Valley only) */}
        {flashingType === 'hipValley' && (
          <div className="mb-3">
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
              <span className="text-xs text-slate-700">Same as Roof Pitch 1</span>
            </label>
            {!sameAsPitch1 && (
              <p className="text-xs text-slate-400 mt-1">Uncheck only if the second roof has a different pitch.</p>
            )}
          </div>
        )}

        {/* Sync pitch2 to pitch1 when checkbox is checked */}

        {showCornerAngle && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
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
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Angle between the two roof lines. Usually 90°. Change only if the building corner is not square.</p>
          </div>
        )}

        <button
          onClick={handleCalculate}
          className="w-full px-4 py-2 bg-[#FF6B35] text-white font-medium rounded-full hover:bg-[#ff5722] transition-colors mb-3 text-sm"
        >
          Calculate
        </button>

        {/* Results */}
        {result && (
          <>
            <div className="h-px bg-slate-200 my-3" />

            <div className="mb-3">
              <h3 className="text-xs font-semibold text-slate-900 mb-2">Results</h3>

              <div className="space-y-1.5">
                <label className="flex items-center p-2.5 border rounded-xl cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 transition-colors">
                  <input
                    type="radio"
                    name="angleSelection"
                    value="interior"
                    checked={selectedAngle === 'interior'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-2.5"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-slate-900">Interior Angle:</span>
                    <span className="ml-1.5 text-base font-bold text-[#FF6B35]">{result.interior}°</span>
                  </div>
                </label>

                <label className="flex items-center p-2.5 border rounded-xl cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 transition-colors">
                  <input
                    type="radio"
                    name="angleSelection"
                    value="exterior"
                    checked={selectedAngle === 'exterior'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-2.5"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-slate-900">Exterior Angle:</span>
                    <span className="ml-1.5 text-base font-bold text-[#FF6B35]">{result.exterior}°</span>
                  </div>
                </label>
              </div>

              {/* Additional Info */}
              {result.additionalInfo && (
                <div className="mt-2.5 p-2.5 bg-blue-50 rounded-lg">
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
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 font-medium rounded-full hover:bg-slate-50 transition-colors text-xs"
        >
          Close
        </button>
        <button
          onClick={handleApply}
          disabled={!result}
          className="flex-1 px-3 py-2 bg-black text-white font-medium rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Copy Angle
        </button>
      </div>
    </div>
  );
}
