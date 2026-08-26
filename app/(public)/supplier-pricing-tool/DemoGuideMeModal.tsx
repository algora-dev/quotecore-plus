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
    title: 'Scan complete',
    body: 'Visually check the components and area to make sure the scan found everything correctly. The roof is fixed at 25 degrees - everything is adjusted for pitch in the next step. This is a demo - nothing is saved.',
  },
  {
    title: 'The components panel',
    body: 'On the left is the components panel. Scroll down to see everything the scan added to the plan - you can edit everything from there.',
  },
  {
    title: 'Select Ridge and edit',
    body: 'Click Ridge in the panel. Hover a measurement to highlight its line on the plan. The eye hides it, the X deletes it.',
    bullets: [
      'To add more lengths to Ridge, use the Line tool in the toolbar above the plan - every component except Main Roof uses Line.',
    ],
  },
  {
    title: 'Add more components',
    body: 'Scroll further down to Add Components. In the demo you can re-add the scan components - in the main app you can add as many custom components as you like.',
  },
  {
    title: 'Finish and see your quote',
    body: 'When you are happy, click Finish and Save in the top right. Your measurements roll straight into a customer quote.',
  },
];

const MANUAL_STEPS: GuideStep[] = [
  {
    title: 'Your plan is ready',
    body: 'Calibration is already set and the roof pitch is fixed at 25 degrees, so everything is adjusted for pitch in the next step. This is a demo - nothing is saved.',
  },
  {
    title: 'Draw the roof area',
    body: 'First, draw the roof area. Click the Area tool in the toolbar above the plan and select Polygon. Click point to point around the roof - your final point must land on your first point to close the area.',
  },
  {
    title: 'Add the Ridge component',
    body: 'Scroll down to Add Components in the panel and click Ridge. The Line tool is selected for you. There are two ridges on this plan - measure point to point on each. They are labelled on the plan.',
  },
  {
    title: 'Edit your measurements',
    body: 'Hover a measurement to highlight its line on the plan. The eye hides it, the X deletes it. Add more lines any time with the Line tool.',
  },
  {
    title: 'Keep going',
    body: 'The same process works for every other component - Hip, Valley, Barge, Spouting all use the Line tool. Add each one from the list and measure it.',
  },
  {
    title: 'Finish and see your quote',
    body: 'When you are happy, click Finish and Save in the top right. Your measurements roll straight into a customer quote.',
  },
];

const UPLOAD_STEPS: GuideStep[] = [
  {
    title: 'Calibrate your plan',
    body: 'Click two points on a known dimension (a wall or ridge length printed on the plan). Enter its real length and confirm. At least one calibration is required. When you are happy, click Confirm Calibration (top left) to move on to drawing the roof area.',
  },
  {
    title: 'Draw the roof area',
    body: 'Click the Area tool and choose Polygon or Rectangle. From there, trace the outline of the entire roof area you want to calculate - it does not matter how many planes are inside it. With Polygon, click back on your first point (or hover over it and click) to close the shape - then name the area. Use + New Area for each additional roof area.',
  },
  {
    title: 'Add components and measure',
    body: 'Scroll down to Add Components in the panel and pick the first one you want to measure. The right tool is selected for you - Line for linear items, Area for roof outlines, Point for fixings.',
  },
  {
    title: 'Edit your measurements',
    body: 'Hover a measurement to highlight its line on the plan. The eye hides it, the X deletes it. Add more lines any time with the Line tool.',
  },
  {
    title: 'Keep going',
    body: 'The same process works for every other component - add each one from the list (your own components or the roofing placeholders) and measure it.',
  },
  {
    title: 'Finish and see your report',
    body: 'When you are happy, click Finish and Save in the top right. Your measurements roll into a takeoff report you can print or send into QuoteCore+.',
  },
];

interface Props {
  open: boolean;
  flow: 'scan' | 'manual' | 'upload';
  onClose: () => void;
}

/** DEMO limit modal - shown when the user tries a feature that is app-only
 *  (custom components, new area, recalibration). Explicit Close button only,
 *  no click-outside-to-close. */
export function DemoLimitModal({ open, title, body, onClose }: { open: boolean; title: string; body: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/signup?source=takeoff-demo"
              className="w-full inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]"
            >
              Sign up for free
            </a>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
            >
              Continue with the demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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

  const steps = flow === 'scan' ? SCAN_STEPS : flow === 'upload' ? UPLOAD_STEPS : MANUAL_STEPS;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const style: CSSProperties = pos
    ? { left: pos.x, top: pos.y, width: PANEL_W }
    : { right: 24, top: 96, width: PANEL_W };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white rounded-xl border border-blue-200 shadow-xl select-none"
      style={style}
      data-demo-guide
    >
      {/* Drag handle header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 cursor-grab active:cursor-grabbing bg-blue-50 rounded-t-xl"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">
            Guide me
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
                <span className="mt-1 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
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
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[#2563EB]' : 'bg-slate-200'}`}
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
            className="px-4 py-1.5 text-xs font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_10px_rgba(37,99,235,0.4)]"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
