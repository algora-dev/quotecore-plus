'use client';

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { QcToolHelp } from '@/app/components/ui/v2/QcDrawingWorkspace';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import {
  calculateRidgeAngle,
  calculateHipValleyMultiPitch,
  calculateChangeOfPitch,
  calculateUpstandOntoRoof,
  calculateRoofIntoUpstand,
  type AngleResult,
} from '@/app/lib/roofAngleCalculator';

interface AngleCalculatorWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (angle: number) => void;
  currentAngle: number;
}

type CalcType = 'hipValley' | 'rafterPitch';
type RafterSubType = 'ridge' | 'changeOfPitch' | 'upstandOntoRoof' | 'roofIntoUpstand';
type AngleSelection = 'finished' | 'bend';

const WIDGET_WIDTH = 384;
const WIDGET_DEFAULT_HEIGHT = 520;
const WIDGET_MIN_HEIGHT = 360;
const WIDGET_MAX_HEIGHT = 800;

// Tooltip content for each option
const TOOLTIPS: Record<string, { title: string; description: string; image: string }> = {
  hipValley: {
    title: 'Hip / Valley',
    description: 'Use when two roof planes meet around an internal or external corner (usually a 90° building corner).',
    image: '/angle-calculator/Valley.png',
  },
  rafterPitch: {
    title: 'Rafter Pitch',
    description: 'Used where roof planes run in the same direction. Includes Ridge, Change of Pitch, Upstand onto Roof, and Roof into Upstand.',
    image: '/angle-calculator/RidgeAndHip.png',
  },
  ridge: {
    title: 'Ridge',
    description: 'Use where two roof planes meet at the ridge or peak. Formula: 180° − Pitch 1 − Pitch 2',
    image: '/angle-calculator/RidgeAndHip.png',
  },
  changeOfPitch: {
    title: 'Change of Pitch',
    description: 'Use where one roof slope changes into another roof slope running in the same direction. Formula: 180° − Upper Pitch + Lower Pitch. If the upper pitch is steeper than the lower, the result is an internal angle (folds inward). If flatter, it returns an external angle (opens outward). Internal angles are measured on the tight/inside of the fold. External angles are measured on the open/outside of the fold.',
    image: '/angle-calculator/ChangeOfPitch.png',
  },
  upstandOntoRoof: {
    title: 'Upstand onto Roof',
    description: 'Use where flashing starts on a vertical upstand and turns down onto the roof. Formula: 90° + Roof Pitch. Examples of upstands include walls, parapets, skylights, chimneys and equipment curbs.',
    image: '/angle-calculator/UpstandOntoRoof.png',
  },
  roofIntoUpstand: {
    title: 'Roof into Upstand',
    description: 'Use where flashing starts on the roof and turns up into a vertical upstand. Formula: 90° − Roof Pitch. Examples of upstands include walls, parapets, skylights, chimneys and equipment curbs.',
    image: '/angle-calculator/RoofIntoUpstand.png',
  },
};

function HelpIcon({ tooltipKey }: { tooltipKey: string }) {
  const tip = TOOLTIPS[tooltipKey];
  return tip ? <QcToolHelp {...tip} /> : null;
}

export function AngleCalculatorWidget({
  isOpen,
  onClose,
  onApply,
  currentAngle: _currentAngle,
}: AngleCalculatorWidgetProps) {
  const fieldId = useId();
  const [validationError, setValidationError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [calcType, setCalcType] = useState<CalcType>('hipValley');
  const [rafterSubType, setRafterSubType] = useState<RafterSubType>('ridge');

  // Hip/Valley state
  const [pitch1, setPitch1] = useState<string>('25');
  const [pitch2, setPitch2] = useState<string>('25');
  const [sameAsPitch1, setSameAsPitch1] = useState<boolean>(true);
  const [cornerAngle, setCornerAngle] = useState<string>('90');

  // Rafter Pitch - Ridge
  const [ridgePitch1, setRidgePitch1] = useState<string>('25');
  const [ridgePitch2, setRidgePitch2] = useState<string>('25');
  const [ridgeSameAsPitch1, setRidgeSameAsPitch1] = useState<boolean>(true);

  // Rafter Pitch - Change of Pitch
  const [upperPitch, setUpperPitch] = useState<string>('25');
  const [lowerPitch, setLowerPitch] = useState<string>('10');

  // Rafter Pitch - Upstand / Roof into Upstand (single pitch)
  const [singlePitch, setSinglePitch] = useState<string>('25');

  const [result, setResult] = useState<AngleResult | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AngleSelection>('finished');

  // Dragging + resize state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [widgetHeight, setWidgetHeight] = useState(WIDGET_DEFAULT_HEIGHT);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startY: number; origH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !initialized) {
      const x = Math.max(16, window.innerWidth - WIDGET_WIDTH - 32);
      const y = 80;
      setPosition({ x, y });
      setInitialized(true);
    }
  }, [isOpen, initialized]);

  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      setWidgetHeight(WIDGET_DEFAULT_HEIGHT);
    }
  }, [isOpen]);

  // Keep the floating controls reachable after orientation/keyboard changes.
  // This adjusts the panel only, never the drawing or its viewport transform.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const available = Math.max(120, (viewport?.height ?? window.innerHeight) - 24);
      const top = (viewport?.offsetTop ?? 0) + 12;
      panelRef.current?.style.setProperty('--qc-tool-available-height', `${available}px`);
      panelRef.current?.style.setProperty('--qc-tool-viewport-top', `${top}px`);
      const width = panelRef.current?.offsetWidth ?? WIDGET_WIDTH;
      const height = Math.min(widgetHeight, available);
      setPosition(prev => ({
        x: Math.max(12, Math.min(prev.x, window.innerWidth - width - 12)),
        y: Math.max(top, Math.min(prev.y, top + available - height)),
      }));
    };
    fit();
    window.addEventListener('resize', fit);
    viewport?.addEventListener('resize', fit);
    viewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      viewport?.removeEventListener('resize', fit);
      viewport?.removeEventListener('scroll', fit);
    };
  }, [isOpen, widgetHeight]);

  // Sync pitch2 to pitch1 when sameAsPitch1 is checked (Hip/Valley)
  useEffect(() => {
    if (sameAsPitch1) setPitch2(pitch1);
  }, [pitch1, sameAsPitch1]);

  // Sync ridge pitch2 to pitch1 when ridgeSameAsPitch1 is checked
  useEffect(() => {
    if (ridgeSameAsPitch1) setRidgePitch2(ridgePitch1);
  }, [ridgePitch1, ridgeSameAsPitch1]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth ?? WIDGET_WIDTH) - 12;
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight ?? 60) - 12;
      setPosition({
        x: Math.max(12, Math.min(maxX, newX)),
        y: Math.max(12, Math.min(maxY, newY)),
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

  // Resize handler - drag from bottom-right corner to enlarge/shrink.
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startY: e.clientY, origH: widgetHeight };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dy = ev.clientY - resizeRef.current.startY;
      const newH = Math.max(WIDGET_MIN_HEIGHT, Math.min(WIDGET_MAX_HEIGHT, resizeRef.current.origH + dy));
      setWidgetHeight(newH);
    };

    const handleUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [widgetHeight]);

  useEffect(() => { if (validationError) errorRef.current?.focus({ preventScroll: false }); }, [validationError]);

  if (!isOpen) return null;

  const validatePitch = (val: string, label = 'roof pitch'): number | null => {
    const p = parseFloat(val);
    if (isNaN(p) || p < 0 || p > 89) {
      setValidationError(`Enter a ${label} between 0° and 89°.`);
      return null;
    }
    return p;
  };

  const validateCorner = (val: string): number | null => {
    const c = parseFloat(val);
    if (isNaN(c) || c < 1 || c > 180) {
      setValidationError('Enter a corner angle between 1° and 180°.');
      return null;
    }
    return c;
  };

  const handleCalculate = () => {
    setValidationError(null);
    let calculatedResult: AngleResult;

    if (calcType === 'hipValley') {
      const p1 = validatePitch(pitch1);
      if (p1 === null) return;
      const effectiveP2 = sameAsPitch1 ? p1 : parseFloat(pitch2);
      const corner = validateCorner(cornerAngle);
      if (corner === null) return;
      if (!sameAsPitch1) {
        const p2 = validatePitch(pitch2);
        if (p2 === null) return;
      }
      calculatedResult = calculateHipValleyMultiPitch(p1, effectiveP2, corner);
    } else {
      // Rafter Pitch sub-types
      switch (rafterSubType) {
        case 'ridge': {
          const p1 = validatePitch(ridgePitch1);
          if (p1 === null) return;
          const p2 = ridgeSameAsPitch1 ? p1 : parseFloat(ridgePitch2);
          if (!ridgeSameAsPitch1) {
            const p2v = validatePitch(ridgePitch2);
            if (p2v === null) return;
          }
          calculatedResult = calculateRidgeAngle(p1, p2);
          break;
        }
        case 'changeOfPitch': {
          const upper = validatePitch(upperPitch, 'upper roof pitch');
          if (upper === null) return;
          const lower = validatePitch(lowerPitch, 'lower roof pitch');
          if (lower === null) return;
          calculatedResult = calculateChangeOfPitch(upper, lower);
          break;
        }
        case 'upstandOntoRoof': {
          const p = validatePitch(singlePitch);
          if (p === null) return;
          calculatedResult = calculateUpstandOntoRoof(p);
          break;
        }
        case 'roofIntoUpstand': {
          const p = validatePitch(singlePitch);
          if (p === null) return;
          calculatedResult = calculateRoofIntoUpstand(p);
          break;
        }
      }
    }

    setResult(calculatedResult);

    // Auto-scroll to bottom so results are visible
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  };

  const handleApply = () => {
    if (!result) return;
    const angleToApply = selectedAngle === 'finished' ? result.finishedAngle : result.bendAngleFromFlat;
    onApply(angleToApply);
  };

  // Determine which inputs to show
  const showPitch2 = calcType === 'hipValley' ? !sameAsPitch1 : (rafterSubType === 'ridge' && !ridgeSameAsPitch1);
  const showCornerAngle = calcType === 'hipValley';

  return (
    <div
      ref={panelRef} data-qc-ui="v2" role="dialog" aria-label="Angle calculator"
      className="qc-angle-tool qc-angle-widget"
      onKeyDown={event => { if (event.key === 'Escape' && !(event.target as Element).closest('dialog')) { event.preventDefault(); event.stopPropagation(); onClose(); } }}
      style={{ left: `${position.x}px`, top: `${position.y}px`, height: `${widgetHeight}px` }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="qc-angle-header"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900">Angle Calculator</h2>
        </div>
        <QcButton
          onClick={onClose}
          
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </QcButton>
      </div>

      {/* Body - scrolls within fixed-height panel */}
      <div ref={bodyRef} className="qc-angle-body">
        {validationError && <p ref={errorRef} id={`${fieldId}-error`} tabIndex={-1} role="alert" className="qc-drawing-error">{validationError}</p>}
        {/* Main Calculator Type */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Calculator Type</label>
          <div className="space-y-1.5">
            <label className="flex items-center">
              <input
                type="radio"
                name={`${fieldId}-calcType`}
                value="hipValley"
                checked={calcType === 'hipValley'}
                onChange={(e) => { setCalcType(e.target.value as CalcType); setResult(null); setValidationError(null); }}
                className="mr-2"
              />
              <span className="text-xs">Hip / Valley</span>
              <HelpIcon tooltipKey="hipValley" />
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={`${fieldId}-calcType`}
                value="rafterPitch"
                checked={calcType === 'rafterPitch'}
                onChange={(e) => { setCalcType(e.target.value as CalcType); setResult(null); setValidationError(null); }}
                className="mr-2"
              />
              <span className="text-xs">Rafter Pitch</span>
              <HelpIcon tooltipKey="rafterPitch" />
            </label>
          </div>
        </div>

        {/* Rafter Pitch Sub-Options */}
        {calcType === 'rafterPitch' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">What are you calculating?</label>
            <div className="space-y-1.5">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${fieldId}-rafterSubType`}
                  value="ridge"
                  checked={rafterSubType === 'ridge'}
                  onChange={(e) => { setRafterSubType(e.target.value as RafterSubType); setResult(null); setValidationError(null); }}
                  className="mr-2"
                />
                <span className="text-xs">Ridge</span>
                <HelpIcon tooltipKey="ridge" />
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${fieldId}-rafterSubType`}
                  value="changeOfPitch"
                  checked={rafterSubType === 'changeOfPitch'}
                  onChange={(e) => { setRafterSubType(e.target.value as RafterSubType); setResult(null); setValidationError(null); }}
                  className="mr-2"
                />
                <span className="text-xs">Change of Pitch</span>
                <HelpIcon tooltipKey="changeOfPitch" />
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${fieldId}-rafterSubType`}
                  value="upstandOntoRoof"
                  checked={rafterSubType === 'upstandOntoRoof'}
                  onChange={(e) => { setRafterSubType(e.target.value as RafterSubType); setResult(null); setValidationError(null); }}
                  className="mr-2"
                />
                <span className="text-xs">Upstand onto Roof</span>
                <HelpIcon tooltipKey="upstandOntoRoof" />
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${fieldId}-rafterSubType`}
                  value="roofIntoUpstand"
                  checked={rafterSubType === 'roofIntoUpstand'}
                  onChange={(e) => { setRafterSubType(e.target.value as RafterSubType); setResult(null); setValidationError(null); }}
                  className="mr-2"
                />
                <span className="text-xs">Roof into Upstand</span>
                <HelpIcon tooltipKey="roofIntoUpstand" />
              </label>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-200 my-3" />

        {/* ─── Hip/Valley Inputs ─── */}
        {calcType === 'hipValley' && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch 1 (°)</label>
              <input
                type="number"
                aria-label="Roof pitch 1 in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={pitch1}
                onChange={(e) => { setPitch1(e.target.value); setResult(null); setValidationError(null); }}
                min="0" max="89" step="0.1"
                className="qc-input w-full"
              />
              <p className="text-xs text-slate-400 mt-1">Enter the pitch of the first roof plane.</p>
            </div>

            {showPitch2 && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch 2 (°)</label>
                <input
                  type="number"
                  aria-label="Roof pitch 2 in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={pitch2}
                  onChange={(e) => { setPitch2(e.target.value); setResult(null); setValidationError(null); }}
                  min="0" max="89" step="0.1"
                  className="qc-input w-full"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsPitch1}
                  onChange={(e) => {
                    setSameAsPitch1(e.target.checked);
                    if (e.target.checked) setPitch2(pitch1);
                    setResult(null); setValidationError(null);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">Same as Roof Pitch 1</span>
              </label>
              {!sameAsPitch1 && (
                <p className="text-xs text-slate-400 mt-1">Uncheck only if the second roof has a different pitch.</p>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Corner Angle (°)</label>
              <input
                type="number"
                aria-label="Corner angle in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={cornerAngle}
                onChange={(e) => { setCornerAngle(e.target.value); setResult(null); setValidationError(null); }}
                min="1" max="180" step="0.1"
                className="qc-input w-full"
              />
              <p className="text-xs text-slate-400 mt-1">Angle between the two roof lines. Usually 90°. Change only if the building corner is not square.</p>
            </div>
          </>
        )}

        {/* ─── Rafter Pitch: Ridge ─── */}
        {calcType === 'rafterPitch' && rafterSubType === 'ridge' && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch 1 (°)</label>
              <input
                type="number"
                aria-label="Ridge pitch 1 in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={ridgePitch1}
                onChange={(e) => { setRidgePitch1(e.target.value); setResult(null); setValidationError(null); }}
                min="0" max="89" step="0.1"
                className="qc-input w-full"
              />
            </div>

            {showPitch2 && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch 2 (°)</label>
                <input
                  type="number"
                  aria-label="Ridge pitch 2 in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={ridgePitch2}
                  onChange={(e) => { setRidgePitch2(e.target.value); setResult(null); setValidationError(null); }}
                  min="0" max="89" step="0.1"
                  className="qc-input w-full"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ridgeSameAsPitch1}
                  onChange={(e) => {
                    setRidgeSameAsPitch1(e.target.checked);
                    if (e.target.checked) setRidgePitch2(ridgePitch1);
                    setResult(null); setValidationError(null);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">Same as Roof Pitch 1</span>
              </label>
              {!ridgeSameAsPitch1 && (
                <p className="text-xs text-slate-400 mt-1">Uncheck only if the second roof has a different pitch.</p>
              )}
            </div>
          </>
        )}

        {/* ─── Rafter Pitch: Change of Pitch ─── */}
        {calcType === 'rafterPitch' && rafterSubType === 'changeOfPitch' && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Upper Roof Pitch (°)</label>
              <input
                type="number"
                aria-label="Upper pitch in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={upperPitch}
                onChange={(e) => { setUpperPitch(e.target.value); setResult(null); setValidationError(null); }}
                min="0" max="89" step="0.1"
                className="qc-input w-full"
              />
              <p className="text-xs text-slate-400 mt-1">Pitch of the roof section above the change line.</p>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Lower Roof Pitch (°)</label>
              <input
                type="number"
                aria-label="Lower pitch in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={lowerPitch}
                onChange={(e) => { setLowerPitch(e.target.value); setResult(null); setValidationError(null); }}
                min="0" max="89" step="0.1"
                className="qc-input w-full"
              />
              <p className="text-xs text-slate-400 mt-1">Pitch of the roof section below the change line.</p>
            </div>
          </>
        )}

        {/* ─── Rafter Pitch: Upstand onto Roof ─── */}
        {calcType === 'rafterPitch' && rafterSubType === 'upstandOntoRoof' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch (°)</label>
            <input
              type="number"
              aria-label="Roof pitch in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={singlePitch}
              onChange={(e) => { setSinglePitch(e.target.value); setResult(null); setValidationError(null); }}
              min="0" max="89" step="0.1"
              className="qc-input w-full"
            />
            <p className="text-xs text-slate-400 mt-1">Enter the pitch of the roof plane the flashing turns onto.</p>
          </div>
        )}

        {/* ─── Rafter Pitch: Roof into Upstand ─── */}
        {calcType === 'rafterPitch' && rafterSubType === 'roofIntoUpstand' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Roof Pitch (°)</label>
            <input
              type="number"
              aria-label="Roof pitch in degrees" aria-describedby={validationError ? `${fieldId}-error` : undefined}
                value={singlePitch}
              onChange={(e) => { setSinglePitch(e.target.value); setResult(null); setValidationError(null); }}
              min="0" max="89" step="0.1"
              className="qc-input w-full"
            />
            <p className="text-xs text-slate-400 mt-1">Enter the pitch of the roof plane running into the upstand.</p>
          </div>
        )}

        <QcButton
          variant="primary" onClick={handleCalculate}
          className="w-full"
        >
          Calculate
        </QcButton>

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
                    name={`${fieldId}-angleSelection`}
                    value="finished"
                    checked={selectedAngle === 'finished'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-2.5"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-slate-900">Finished Angle:</span>
                    <span className="ml-1.5 text-base font-bold text-[#FF6B35]">{result.finishedAngle}°</span>
                  </div>
                </label>

                <label className="flex items-center p-2.5 border rounded-xl cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 transition-colors">
                  <input
                    type="radio"
                    name={`${fieldId}-angleSelection`}
                    value="bend"
                    checked={selectedAngle === 'bend'}
                    onChange={(e) => setSelectedAngle(e.target.value as AngleSelection)}
                    className="mr-2.5"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-slate-900">Bend Angle from Flat:</span>
                    <span className="ml-1.5 text-base font-bold text-[#FF6B35]">{result.bendAngleFromFlat}°</span>
                  </div>
                </label>
              </div>

              {result.additionalInfo?.hipSlope !== undefined && (
                <div className="mt-2.5 p-2.5 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">Hip Slope: {result.additionalInfo.hipSlope}°</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="qc-angle-footer">
        <QcButton
          onClick={onClose}
          className="flex-1"
        >
          Close
        </QcButton>
        <QcButton
          variant="primary" onClick={handleApply}
          disabled={!result}
          className="flex-1"
        >
          Apply Angle
        </QcButton>
      </div>

      {/* Resize handle - bottom-right corner */}
      <div
        onMouseDown={handleResizeStart}
        className="qc-angle-resize" aria-hidden="true"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, rgb(203 213 225) 50%)',
          borderBottomRightRadius: '0.75rem',
        }}
        title="Drag to resize"
      />
    </div>
  );
}
