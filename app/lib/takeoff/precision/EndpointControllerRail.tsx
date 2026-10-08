'use client';
// Mobile takeoff M4: calibration A/B endpoint rail (spec §3.3/§7.2).
// Replaces the M3 point grid while calibrating: Start/End endpoint selection,
// "Place end point" to accept the current point without a drag (U3: no
// separate Adjust button - selecting Start/End re-arms). Customer
// copy per §1.3 (Start, End, Point — no "vertex"/"m/px" jargon). 48×48
// targets, states not colour-only (labels + status text), presentational only.

import type { ReactNode } from 'react';
import type { GesturePhase } from './precisionGestureMachine';

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

export type CalibrationWizardStep = 'place-a' | 'adjust-a' | 'place-b' | 'adjust-b' | 'review';

export interface EndpointControllerRailProps {
  /** Which endpoint (A or B) the current placement/adjust step targets. */
  step: CalibrationWizardStep;
  /** 'a' | 'b' | null — currently selected+armed endpoint. */
  selected: 'a' | 'b' | null;
  /** True while an endpoint is armed for off-point dragging. */
  armed: boolean;
  /** Point-is-correct advances the wizard without a drag (§7.2). */
  onPointIsCorrect: () => void;
  canPointIsCorrect: boolean;
  onSelectA: () => void;
  onSelectB: () => void;
  canSelectB: boolean;
  gesturePhase: GesturePhase;
  onFitPlan: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export function EndpointControllerRail(props: EndpointControllerRailProps) {
  const midGesture = props.gesturePhase !== 'idle' && props.gesturePhase !== 'cancelled';
  // U3 (plan 5.1): state-driven copy - one clear next action per state.
  const stepCopy: Record<CalibrationWizardStep, string> = {
    'place-a': 'Tap the start of a known distance.',
    'adjust-a': 'Drag away from the point to adjust.',
    'place-b': 'Tap the other end.',
    'adjust-b': 'Drag anywhere to adjust the end point.',
    review: 'Check the distance, or tap Start/End to adjust.',
  };
  return (
    <div className="flex w-full flex-col gap-2" aria-label="Calibration point controls">
      <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Points
      </div>
      <div
        className="rounded-full bg-white/10 px-2.5 py-1 text-center text-xs font-semibold text-white"
        aria-live="polite"
      >
        {props.step === 'place-a' && 'Place the start point'}
        {props.step === 'adjust-a' && 'Start point set'}
        {props.step === 'place-b' && 'Place the end point'}
        {props.step === 'adjust-b' && 'End point set'}
        {props.step === 'review' && 'Known distance'}
      </div>
      <div className="text-center text-[11px] text-slate-300" aria-live="polite">
        {stepCopy[props.step]}
      </div>

      {/* A/B endpoint selection (§3.3: calibration replaces the vertex grid). */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Endpoint selection">
        <RailButton
          onClick={props.onSelectA}
          label="Select the start point"
          variant={props.selected === 'a' ? 'accent' : 'default'}
        >
          Start
        </RailButton>
        <RailButton
          onClick={props.onSelectB}
          label="Select the end point"
          disabled={!props.canSelectB}
          variant={props.selected === 'b' ? 'accent' : 'default'}
        >
          End
        </RailButton>
      </div>

      {props.canPointIsCorrect && (
        <RailButton
          onClick={props.onPointIsCorrect}
          label="Place end point"
          variant="accent"
          disabled={midGesture}
        >
          Place end point
        </RailButton>
      )}
      <RailButton onClick={props.onUndo} label="Undo last point change" disabled={!props.canUndo || midGesture}>
        Undo
      </RailButton>

      <div className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        View
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="View controls">
        <RailButton onClick={props.onFitPlan} label="Fit plan to view">
          Fit
        </RailButton>
        <RailButton onClick={props.onZoomIn} label="Zoom in">
          +
        </RailButton>
        <RailButton onClick={props.onZoomOut} label="Zoom out">
          −
        </RailButton>
      </div>
      <div
        className="rounded-full bg-white/10 px-2.5 py-1 text-center text-[11px] text-slate-300"
        aria-live="polite"
      >
        {props.armed ? 'Drag anywhere to move · release to set' : props.selected ? 'Point set' : ''}
      </div>
    </div>
  );
}
