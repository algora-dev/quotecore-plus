'use client';
// Mobile takeoff M4: calibration sheet (spec §7.2/§7.3 + C-series). Compact
// known-distance/unit entry, accept 1-3 references, disagreement warning with
// explicit acknowledgement (C12), AI candidate review/repair actions and
// provenance labels. Presentational only — all actions are props; the state
// lives in the calibration session reducer (via the shared controller).

import type { ReactNode } from 'react';
import type { DistanceUnit } from '../calibrationTypes';
import type { CalibrationController } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/calibration/useCalibrationController';
import { FloatingCanvasSheet } from './FloatingCanvasSheet';

const UNITS: readonly DistanceUnit[] = ['m', 'cm', 'mm', 'ft', 'in', 'yd'];

function SheetButton({
  onClick,
  children,
  disabled,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  variant?: 'default' | 'accent' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-40 ${
        variant === 'accent'
          ? 'bg-[#FF6B35] text-white hover:bg-[#e55a28]'
          : variant === 'danger'
            ? 'border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20'
            : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  ai_confirmed: 'AI confirmed',
  ai_adjusted: 'AI adjusted',
};

export interface CalibrationSheetProps {
  controller: CalibrationController;
  workingUnit: 'meters' | 'feet';
  /** Manual wizard sheet inputs (owned by the workspace: typed values survive
   *  endpoint edits and candidate switching, §7.2). */
  distanceText: string;
  onDistanceTextChange: (value: string) => void;
  unit: DistanceUnit | null;
  onUnitChange: (unit: DistanceUnit) => void;
  /** Manual wizard: both endpoints placed and ready for the distance review. */
  manualPairReady: boolean;
  onAcceptManual: (finish: boolean) => void;
  onBeginManual: () => void;
  onFinishAccepted: () => void;
  onAcknowledgeDisagreement: () => void;
  onRemoveAccepted: (id: string) => void;
  onDetachReference: (id: string) => void;
  /** C12 gate computed by the pure finishBlockers selector. */
  disagreementWarning: string | null;
  acknowledgementRequired: boolean;
  /** AI entitlement: deliberate "Find with AI" only (§7.1 — never auto-spend). */
  aiEnabled: boolean;
  canSearch: boolean;
  onFindWithAi: () => void;
  onAdjustCandidatePoints: () => void;
  canAdjustCandidatePoints: boolean;
  /** True while the A/B draft is editing an AI candidate's endpoints. */
  repairMode: boolean;
  onDoneRepair: () => void;
  /** When the page already has measurements/areas, recalibration must run on
   *  the desktop commit path (C13 atomicity) — surfaced, never bypassed. */
  pageHasDependents: boolean;
  onExit: () => void;
}

export function CalibrationSheet(props: CalibrationSheetProps) {
  const { controller } = props;
  const state = controller.state;
  const accepted = state.accepted;
  const active = controller.activeCandidate;
  const validCount = controller.validAccepted.length;
  const capReached = accepted.length >= 3;
  const effective = controller.draftEffective;

  return (
    <FloatingCanvasSheet label="Calibration" className="max-h-[70%]">
      {/* Accepted references (1-3, mixed origins, R03). */}
      {accepted.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1" aria-live="polite">
          {accepted.map((ref, i) => (
            <span
              key={ref.id}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
                state.reviews[ref.candidateId ?? '']?.decision === 'needs_reconfirmation'
                  ? 'border border-amber-400/50 bg-amber-500/10 text-amber-200'
                  : 'bg-white/10 text-white'
              }`}
              title={`${SOURCE_LABEL[ref.source] ?? ref.source} · ${ref.confirmedDistance} ${ref.confirmedUnit}`}
            >
              {`${i + 1}. ${SOURCE_LABEL[ref.source] ?? ref.source} · ${ref.confirmedDistance} ${ref.confirmedUnit}`}
              {state.reviews[ref.candidateId ?? '']?.decision === 'needs_reconfirmation' && ' · check again'}
              <button
                type="button"
                aria-label={`Remove saved reference ${i + 1}`}
                onClick={() => props.onRemoveAccepted(ref.id)}
                className="ml-1 font-bold text-slate-300 hover:text-white"
              >
                ×
              </button>
              {ref.candidateId != null && (
                <button
                  type="button"
                  aria-label={`Use reference ${i + 1} as a different manual measurement`}
                  onClick={() => props.onDetachReference(ref.id)}
                  className="ml-0.5 underline decoration-dotted"
                >
                  as manual
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Disagreement warning + explicit acknowledgement (C12). */}
      {props.disagreementWarning != null && (
        <div className="mb-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200" role="alert">
          <span className="block">{props.disagreementWarning}</span>
          {props.acknowledgementRequired && (
            <SheetButton
              label="Use this average scale anyway"
              variant="accent"
              onClick={props.onAcknowledgeDisagreement}
            >
              Use this average anyway
            </SheetButton>
          )}
        </div>
      )}

      {state.error && (
        <div className="mb-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200" role="alert">
          {state.error.message}
        </div>
      )}

      {/* AI candidate review (§7.3): repair, accept, skip — accept what you
          want, ignore the rest. Stable 1/2/3 numbering (C10). */}
      {state.candidates.length > 0 && active && !props.repairMode && (
        <div className="mb-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {state.candidates.map((c, i) => (
              <button
                key={c.id}
                type="button"
                aria-label={`Show measurement ${i + 1}`}
                aria-pressed={c.id === active.id}
                onClick={() => controller.dispatch({ type: 'SELECT_CANDIDATE', candidateId: c.id })}
                className={`h-12 min-w-12 rounded-full px-3 text-xs font-semibold ${
                  c.id === active.id ? 'bg-white text-slate-900' : 'border border-white/20 text-white'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <span className="text-[11px] text-slate-300">
              {`Measurement ${state.candidates.findIndex((c) => c.id === active.id) + 1} of ${state.candidates.length}`}
              {state.endpointOverrides[active.id] ? ' · adjusted' : ''}
            </span>
          </div>
          <div className="mb-1 flex flex-wrap gap-1">
            <SheetButton
              label="Accept this measurement and finish"
              variant="accent"
              disabled={capReached || props.acknowledgementRequired || props.pageHasDependents}
              onClick={() => controller.dispatch({ type: 'ACCEPT_AND_FINISH' })}
            >
              Accept & finish
            </SheetButton>
            <SheetButton
              label="Accept this measurement and check another"
              disabled={capReached}
              onClick={() => controller.dispatch({ type: 'ACCEPT_CURRENT' })}
            >
              Accept & check another
            </SheetButton>
            <SheetButton
              label="Adjust this measurement's points"
              disabled={!props.canAdjustCandidatePoints}
              onClick={props.onAdjustCandidatePoints}
            >
              Adjust points
            </SheetButton>
            <SheetButton
              label="Skip this measurement"
              onClick={() => controller.dispatch({ type: 'SKIP_CURRENT', reason: 'endpoints' })}
            >
              Skip
            </SheetButton>
          </div>
        </div>
      )}

      {/* Manual wizard distance review (§7.2). */}
      {state.phase === 'manual' && props.manualPairReady && !props.repairMode && (
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-slate-300">
            Known distance
            <input
              type="text"
              inputMode="decimal"
              value={props.distanceText}
              onChange={(e) => props.onDistanceTextChange(e.target.value)}
              placeholder="e.g. 6.42"
              className="h-12 w-28 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-300">
            Unit
            <select
              value={props.unit ?? ''}
              onChange={(e) => props.onUnitChange(e.target.value as DistanceUnit)}
              className="h-12 rounded-lg border border-white/20 bg-white/10 px-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="" disabled>
                Unit
              </option>
              {UNITS.map((u) => (
                <option key={u} value={u} className="text-slate-900">
                  {u}
                </option>
              ))}
            </select>
          </label>
          <SheetButton
            label="Use this calibration and finish"
            variant="accent"
            disabled={props.acknowledgementRequired}
            onClick={() => props.onAcceptManual(true)}
          >
            Use this calibration
          </SheetButton>
          <SheetButton
            label="Save and add another reference"
            disabled={capReached || props.acknowledgementRequired}
            onClick={() => props.onAcceptManual(false)}
          >
            Save & add another
          </SheetButton>
        </div>
      )}

      {/* Repair-mode banner: endpoints in the A/B draft belong to a candidate. */}
      {props.repairMode && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 p-2 text-[11px] text-orange-100">
          <span className="min-w-0 flex-1">Adjust the start and end points, then re-check the distance.</span>
          <SheetButton label="Done adjusting points" variant="accent" onClick={props.onDoneRepair}>
            Done
          </SheetButton>
        </div>
      )}

      {/* Manual entry start / AI search / finish row. */}
      <div className="flex flex-wrap items-center gap-1">
        {state.phase !== 'manual' && !props.repairMode && (
          <SheetButton
            label="Set the scale manually with two points"
            onClick={props.onBeginManual}
            disabled={capReached}
          >
            Set scale manually
          </SheetButton>
        )}
        {props.aiEnabled && state.candidates.length === 0 && state.phase !== 'searching' && props.canSearch && (
          <SheetButton label="Find measurements with AI" onClick={props.onFindWithAi}>
            Find with AI
          </SheetButton>
        )}
        {state.phase === 'searching' && (
          <span className="text-[11px] text-slate-300" aria-live="polite">
            Searching…
          </span>
        )}
        {validCount >= 1 && state.phase !== 'committing' && (
          <SheetButton
            label={`Finish with ${validCount} reference${validCount === 1 ? '' : 's'}`}
            variant="accent"
            disabled={props.acknowledgementRequired || validCount > 3}
            onClick={props.onFinishAccepted}
          >
            {`Finish with ${validCount} reference${validCount === 1 ? '' : 's'}`}
          </SheetButton>
        )}
        {capReached && validCount < 3 && (
          <span className="text-[11px] text-amber-300">Maximum 3 references — remove one to add another.</span>
        )}
        <span className="flex-1" />
        {effective && (
          <span className="text-[11px] text-slate-400" title="Debug: effective scale">
            {`Scale set · ${state.accepted.length}/3 · ${effective.scale.toPrecision(4)} ${
              props.workingUnit === 'meters' ? 'm' : 'ft'
            }/px`}
          </span>
        )}
        <SheetButton label="Close calibration" onClick={props.onExit}>
          Done
        </SheetButton>
      </div>

      {props.pageHasDependents && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
          This page already has measurements. Saving a new scale here is disabled — switch the
          workspace view to Desktop to recalibrate so every measurement is updated together.
        </div>
      )}
    </FloatingCanvasSheet>
  );
}
