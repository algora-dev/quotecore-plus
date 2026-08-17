'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * DEMO Guide Me - lightweight multi-step tutorial modal for the takeoff demo.
 * - Draggable by its header so it never blocks the canvas.
 * - Click-through-able: no backdrop (user can interact with the app while it is open).
 * - Closeable at any step (X button or "Skip guide").
 * - Two flows: 'scan' (post-AI-scan, active components exist) and 'manual'
 *   (blank canvas, no active components until the user draws an area).
 */

export interface GuideStep {
  title: string;
  body: string;
  /** Optional short list of sub-points shown under the body. */
  bullets?: string[];
}

const SCAN_STEPS: GuideStep[] = [
  {
    title: 'AI scan complete',
    body: 'The AI has scanned your plan and drawn the roof area plus every component it could find: ridges, hips, valleys, barges and spouting.',
    bullets: [
      'Calibration is already set - no need to measure a known distance.',
      'Roof pitch is fixed at 25 degrees, so hips, valleys, barges and the roof area adjust automatically in the next step.',
      'This is a demo - nothing is saved.',
    ],
  },
  {
    title: 'Everything is editable',
    body: 'Check the scan got everything right. You can hide, delete, or add as many components as you want. Click Next to see how, or close this guide and just try it.',
  },
  {
    title: 'Step 1 - Click an active component',
    body: 'In the left sidebar, click any active component (try Ridge). The correct drawing tool for that component is selected automatically.',
    bullets: [
      'Area components (like Roof Area) use the Area tool.',
      'Line components (ridge, hip, valley, barge, spouting) use the Line tool.',
      'Point components use the Point tool.',
    ],
  },
  {
    title: 'Hide or delete a measurement',
    body: 'Expand the component in the sidebar. Each measurement row has an eye icon to hide it from the plan and an X to delete it.',
    bullets: [
      'Hidden measurements can be shown again later.',
      'Deleted measurements are removed from the quote totals.',
    ],
  },
  {
    title: 'Add a new component',
    body: 'Scroll to Add Components in the sidebar, then click any component to add it. It becomes active immediately with the right tool selected.',
    bullets: [
      'Draw as many measurements as you need for each component.',
    ],
  },
  {
    title: 'Drawing with the tools',
    body: 'Area tool: click point to point and close on your first point, or switch to Rectangle and drag a box. Line tool: click two points per line - add as many lines as you want. Point tool: every click on the plan counts one item.',
  },
  {
    title: 'Finish and see your quote',
    body: 'When you are happy with the takeoff, click Finish and Save in the top right. Your measurements roll straight into a customer quote.',
    bullets: [
      'Use Undo/Redo in the toolbar if you make a mistake.',
    ],
  },
];

const MANUAL_STEPS: GuideStep[] = [
  {
    title: 'Measure it yourself',
    body: 'This plan starts blank. Calibration is already set and the roof pitch is fixed at 25 degrees, so hips, valleys, barges and the roof area adjust automatically in the next step.',
  },
  {
    title: 'Step 1 - Draw the roof area',
    body: 'Click the Area tool in the toolbar. Click point to point around the roof and close on your first point to finish. Or switch to Rectangle and drag a box.',
  },
  {
    title: 'Add a component',
    body: 'In the left sidebar under Add Components, click any component (try Ridge). The right drawing tool is selected for you - line components use the Line tool, point components the Point tool.',
    bullets: [
      'Add as many measurements as you want for each component.',
      'Each click of the Point tool counts one item.',
    ],
  },
  {
    title: 'Finish and see your quote',
    body: 'When you are happy with the takeoff, click Finish and Save in the top right. Your measurements roll straight into a customer quote.',
    bullets: [
      'Use Undo/Redo in the toolbar if you make a mistake.',
    ],
  },
];

interface Props {
  open: boolean;
  flow: 'scan' | 'manual';
  onClose: () => void;
}

const PANEL_W = 340;

export function DemoGuideMeModal({ open, flow, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset to step 1 whenever the guide is (re)opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const x = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, dragRef.current.origX + dx));
      const y = Math.max(8, Math.min(window.innerHeight - 60, dragRef.current.origY + dy));
      setPos({ x, y });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (!open) return null;

  const steps = flow === 'scan' ? SCAN_STEPS : MANUAL_STEPS;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const style: CSSProperties = pos
    ? { left: pos.x, top: pos.y, width: PANEL_W }
    : { right: 24, top: 96, width: PANEL_W };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white rounded-xl border border-orange-200 shadow-xl select-none"
      style={style}
      data-demo-guide
    >
      {/* Drag handle header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 cursor-grab active:cursor-grabbing bg-orange-50 rounded-t-xl"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#BD4A1A]">
            Guide me - Step {step + 1} of {steps.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
          title="Close guide"
          aria-label="Close guide"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Step content */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{current.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{current.body}</p>
        {current.bullets && (
          <ul className="mt-2 space-y-1">
            {current.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                <span className="mt-1 w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Progress dots + nav */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[#FF6B35]' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.4)]"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
