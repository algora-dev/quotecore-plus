'use client';
// Mobile takeoff M3: right-rail point controller UI (spec §3.3/§3.5/§6/§5.7).
// Presentational only — every action is a prop; the harness owns state and
// routes ALL geometry through the M1 command engine. 48×48 targets (§3.3),
// "Points" label separates geometric +/− from zoom (§3.5), states are never
// colour-only (§3.5/L07: text counter, armed cue text, ARIA labels).

import type { ReactNode } from 'react';
import type { GesturePhase } from './precisionGestureMachine';
import type { NudgeDirection, NudgeStepPx } from './pointNavigation';

/** M9 compact icon button for the view controls (owner prescription):
 *  square icon target, 48px tall, full label via aria-label + title. */
function RailIconButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 min-w-12 flex-1 items-center justify-center rounded-full text-lg font-semibold transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function RailButton({
  onClick,
  label,
  children,
  disabled,
  variant = 'default',
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'accent';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
        variant === 'accent'
          ? 'bg-[#FF6B35] text-white hover:bg-[#e55a28]'
          : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

export interface PointControllerRailProps {
  /** e.g. "Point 7 of 12" or "No point selected". */
  counterLabel: string;
  /** Armed-state cue text (not colour-only, §3.5/L07). */
  armedCue: string;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onInsert: () => void;
  canInsert: boolean;
  onDelete: () => void;
  canDelete: boolean;
  /** +/− and Adjust are disabled while a gesture is live (§6.4). */
  gesturePhase: GesturePhase;
  onAdjust: () => void;
  canAdjust: boolean;
  fineOpen: boolean;
  onToggleFine: () => void;
  onNudge: (direction: NudgeDirection) => void;
  nudgeStep: NudgeStepPx;
  onNudgeStepChange: (step: NudgeStepPx) => void;
  onDoneFine: () => void;
  onFitPlan: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function PointControllerRail(props: PointControllerRailProps) {
  const midGesture = props.gesturePhase !== 'idle' && props.gesturePhase !== 'cancelled';
  return (
    <div className="flex w-full flex-col gap-2" aria-label="Point controls">
      <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Points
      </div>
      <div
        className="rounded-full bg-white/10 px-2.5 py-1 text-center text-xs font-semibold text-white"
        aria-live="polite"
      >
        {props.counterLabel}
      </div>
      <div className="text-center text-[11px] text-slate-300" aria-live="polite">
        {props.armedCue}
      </div>

      {/* 2×2 perimeter grid (§6.1): ‹ › traverse STORED order; + inserts the
          successor midpoint; − deletes the selected point. */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Perimeter point controller">
        <RailButton onClick={props.onPrevious} label="Previous point" disabled={!props.canPrevious}>
          ‹
        </RailButton>
        <RailButton onClick={props.onNext} label="Next point" disabled={!props.canNext}>
          ›
        </RailButton>
        <RailButton
          onClick={props.onInsert}
          label="Insert point after selected point"
          disabled={!props.canInsert || midGesture}
        >
          +
        </RailButton>
        <RailButton
          onClick={props.onDelete}
          label="Delete selected point"
          disabled={!props.canDelete || midGesture}
          variant="accent"
        >
          −
        </RailButton>
      </div>

      <RailButton onClick={props.onAdjust} label="Adjust point (re-arm for dragging)" disabled={!props.canAdjust || midGesture}>
        Adjust point
      </RailButton>
      <RailButton onClick={props.onToggleFine} label="Fine adjustment controls" disabled={!props.canAdjust}>
        {props.fineOpen ? 'Hide fine adjust' : 'Fine adjust…'}
      </RailButton>

      {/* §5.7 fine adjustment: four nudge buttons + step choice + Done.
          Deliberately SEPARATE from the perimeter selector (position vs selection). */}
      {props.fineOpen && props.canAdjust && (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-2" role="group" aria-label="Fine adjustment">
          <div className="grid grid-cols-3 grid-rows-2 gap-1">
            <span />
            <RailButton onClick={() => props.onNudge('up')} label="Nudge point up">
              ↑
            </RailButton>
            <span />
            <RailButton onClick={() => props.onNudge('left')} label="Nudge point left">
              ←
            </RailButton>
            <RailButton onClick={() => props.onNudge('down')} label="Nudge point down">
              ↓
            </RailButton>
            <RailButton onClick={() => props.onNudge('right')} label="Nudge point right">
              →
            </RailButton>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300" role="radiogroup" aria-label="Nudge step">
            {([1, 5] as const).map((step) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={props.nudgeStep === step}
                onClick={() => props.onNudgeStepChange(step)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  props.nudgeStep === step ? 'bg-white text-slate-900' : 'border border-white/20 text-white'
                }`}
              >
                {step} px
              </button>
            ))}
          </div>
          <RailButton onClick={props.onDoneFine} label="Finish fine adjustment" variant="accent">
            Done
          </RailButton>
        </div>
      )}

      {/* View controls (M9 owner prescription): compact — Fit plan + zoom ±
          icon buttons in one row. 'Move plan' is REMOVED entirely: panning is
          already a one-finger drag gesture. */}
      <div className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        View
      </div>
      <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 p-1" role="group" aria-label="View controls">
        <RailIconButton onClick={props.onFitPlan} label="Fit plan to view">
          {/* Heroicons arrows-pointing-out outline. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </RailIconButton>
        <RailIconButton onClick={props.onZoomIn} label="Zoom in">
          +
        </RailIconButton>
        <RailIconButton onClick={props.onZoomOut} label="Zoom out">
          −
        </RailIconButton>
      </div>
    </div>
  );
}
