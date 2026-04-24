'use client';

import { useEffect, useState, useRef } from 'react';
import { useCopilot } from './CopilotProvider';

export function CopilotOverlay() {
  const { isActive, currentStepData, state, totalSteps, nextStep, prevStep, skipGuide, currentGuide } = useCopilot();
  const currentStep = state.currentStep;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Find and track the target element
  useEffect(() => {
    if (!isActive || !currentStepData) {
      setTargetRect(null);
      return;
    }

    function updateRect() {
      const el = document.querySelector(currentStepData!.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }

    updateRect();
    // Re-measure on scroll/resize
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    const interval = setInterval(updateRect, 500); // Poll for dynamic elements

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [isActive, currentStepData]);

  if (!isActive || !currentStepData) return null;

  const padding = 8;
  const hasTarget = targetRect && targetRect.width > 0;

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  const pos = currentStepData.position || 'bottom';

  if (hasTarget) {
    const centerX = targetRect.left + targetRect.width / 2;
    const tooltipWidth = 320;

    if (pos === 'bottom') {
      tooltipStyle = {
        top: targetRect.bottom + padding + 12,
        left: Math.max(16, Math.min(centerX - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
      };
    } else if (pos === 'top') {
      tooltipStyle = {
        bottom: window.innerHeight - targetRect.top + padding + 12,
        left: Math.max(16, Math.min(centerX - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
      };
    } else if (pos === 'right') {
      tooltipStyle = {
        top: targetRect.top + targetRect.height / 2 - 60,
        left: targetRect.right + padding + 12,
      };
    } else if (pos === 'left') {
      tooltipStyle = {
        top: targetRect.top + targetRect.height / 2 - 60,
        right: window.innerWidth - targetRect.left + padding + 12,
      };
    }
  } else {
    // No target found — center the tooltip
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay with spotlight hole */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="copilot-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#copilot-mask)"
          className="pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Spotlight ring */}
      {hasTarget && (
        <div
          className="absolute border-2 border-orange-400 rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 0 4px rgba(255, 107, 53, 0.2)',
          }}
        />
      )}

      {/* Make the target element clickable through the overlay */}
      {hasTarget && (
        <div
          className="absolute pointer-events-auto"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute w-80 pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-orange-600">{currentGuide?.name}</span>
              <span className="text-xs text-slate-400">{currentStep + 1} of {totalSteps}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{currentStepData.title}</h3>
          </div>

          {/* Body */}
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-600 leading-relaxed">{currentStepData.description}</p>
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-3">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 flex items-center justify-between">
            <button
              onClick={skipGuide}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Skip guide
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {currentStep >= totalSteps - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
