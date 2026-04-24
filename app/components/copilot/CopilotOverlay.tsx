'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useCopilot } from './CopilotProvider';

export function CopilotOverlay() {
  const { isActive, currentStepData, state, totalSteps, nextStep, prevStep, skipGuide, currentGuide, toggle, nudgeMessage } = useCopilot();
  const currentStep = state.currentStep;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showDismissMsg, setShowDismissMsg] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });

  // Draggable tooltip state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);

  // Track window size for SVG
  useEffect(() => {
    function update() { setWindowSize({ w: window.innerWidth, h: window.innerHeight }); }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Reset drag offset when step changes
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [currentStep, state.activeGuide]);

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
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    const interval = setInterval(updateRect, 500);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [isActive, currentStepData]);

  // Enter key → Next (prevent form submission during copilot)
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
          e.preventDefault();
          e.stopPropagation();
        }
        nextStep();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, nextStep]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
    };
  }, [dragOffset]);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      if (!dragStartRef.current) return;
      setDragOffset({
        x: dragStartRef.current.offsetX + (e.clientX - dragStartRef.current.mouseX),
        y: dragStartRef.current.offsetY + (e.clientY - dragStartRef.current.mouseY),
      });
    }

    function handleMouseUp() {
      setIsDragging(false);
      dragStartRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  function handleClose() {
    toggle();
    setShowDismissMsg(true);
    setTimeout(() => setShowDismissMsg(false), 3000);
  }

  // Dismiss message
  if (showDismissMsg) {
    return (
      <div className="fixed bottom-6 right-6 z-[100] pointer-events-auto">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 px-5 py-3 max-w-xs">
          <p className="text-sm text-slate-700">You can switch Copilot back on anytime you want.</p>
        </div>
      </div>
    );
  }

  if (!isActive || !currentStepData) return null;

  const padding = 12;
  const radius = 12;
  const hasTarget = targetRect && targetRect.width > 0;

  // Tooltip position
  let baseTop = 0;
  let baseLeft = 0;
  const pos = currentStepData.position || 'bottom';
  const tooltipWidth = 320;

  if (hasTarget) {
    const centerX = targetRect.left + targetRect.width / 2;
    if (pos === 'bottom') {
      baseTop = targetRect.bottom + padding + 12;
      baseLeft = Math.max(16, Math.min(centerX - tooltipWidth / 2, windowSize.w - tooltipWidth - 16));
    } else if (pos === 'top') {
      baseTop = targetRect.top - padding - 200;
      baseLeft = Math.max(16, Math.min(centerX - tooltipWidth / 2, windowSize.w - tooltipWidth - 16));
    } else if (pos === 'right') {
      baseTop = Math.max(16, targetRect.top + targetRect.height / 2 - 60);
      baseLeft = Math.min(targetRect.right + padding + 12, windowSize.w - tooltipWidth - 16);
    } else if (pos === 'left') {
      baseTop = Math.max(16, targetRect.top + targetRect.height / 2 - 60);
      baseLeft = Math.max(16, targetRect.left - padding - tooltipWidth - 12);
    }
  } else {
    baseTop = windowSize.h / 2 - 100;
    baseLeft = windowSize.w / 2 - tooltipWidth / 2;
  }

  const tooltipStyle: React.CSSProperties = {
    top: baseTop + dragOffset.y,
    left: baseLeft + dragOffset.x,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* SVG dim overlay with rounded cutout — pointer-events: none so page is fully interactive */}
      {windowSize.w > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <mask id="copilot-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {hasTarget && (
                <rect
                  x={targetRect.left - padding}
                  y={targetRect.top - padding}
                  width={targetRect.width + padding * 2}
                  height={targetRect.height + padding * 2}
                  rx={radius}
                  ry={radius}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.45)"
            mask="url(#copilot-spotlight-mask)"
          />
        </svg>
      )}

      {/* Rounded spotlight ring */}
      {hasTarget && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: `${radius}px`,
            border: '2px solid #FB923C',
            boxShadow: '0 0 0 4px rgba(255, 107, 53, 0.15)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Draggable tooltip */}
      <div
        className="absolute w-80 pointer-events-auto select-none"
        style={tooltipStyle}
        onMouseDown={handleMouseDown}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-orange-600">{currentGuide?.name}</span>
              <span className="text-xs text-slate-400 ml-2">{currentStep + 1} / {totalSteps}</span>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-600"
              title="Close Copilot"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-1">
            <h3 className="text-sm font-semibold text-slate-900">{currentStepData.title}</h3>
          </div>

          <div className="px-5 pb-3">
            <p className="text-xs text-slate-600 leading-relaxed">{currentStepData.description}</p>
            {nudgeMessage && (
              <p className="text-xs text-orange-600 font-medium mt-2 animate-pulse">{nudgeMessage}</p>
            )}
          </div>

          <div className="px-5 pb-3">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="px-5 pb-4 flex items-center justify-between">
            <button onClick={skipGuide} className="text-xs text-slate-400 hover:text-slate-600 transition">
              Skip guide
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button onClick={prevStep} className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition">
                  Back
                </button>
              )}
              <button onClick={nextStep} className="px-3 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
                {currentStep >= totalSteps - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>

          <div className="px-5 pb-2 text-center">
            <p className="text-[10px] text-slate-300">Drag to move · Press Enter for next</p>
          </div>
        </div>
      </div>
    </div>
  );
}
