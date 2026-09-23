'use client';
import type { ReactNode } from 'react';
import { PitchControl, RailAction, RailNotice, RailTask, ScanProgress } from './TouchRailControls';
import type { AiOutlineScanInfo } from './touchAiOutline';
import type { SavedOutlineRecord } from './touchOutlines';

/** M10: the choice made on the outline finish screen. 'components-*'
 * saves the outline then stays in the touch flow (components step). */
export type OutlineFinishChoice = 'finish' | 'components-ai' | 'components-manual';

export interface TouchOutlineRailProps {
  stage: 'choose' | 'draw' | 'edit' | 'ai-review' | 'finish' | 'saving' | 'scanning';
  ready: boolean; calibrated: boolean; error: string | null; validation: string | null;
  count: number; index: number; armed: boolean; closed: boolean; gestureBusy: boolean;
  canPrevious: boolean; canNext: boolean; canInsert: boolean; canDelete: boolean;
  canUndo: boolean; canRedo: boolean; planArea: string | null;
  savedArea: SavedOutlineRecord | null; areas: SavedOutlineRecord[];
  pitch: number; pitchConfirmed: boolean; onConfirmPitch: () => void;
  scanInfo: AiOutlineScanInfo | null; candidateCount: number; candidateIndex: number;
  viewControls: ReactNode;
  onManual: () => void; onScan: () => void; onCancelScan: () => void; onCalibrate?: () => void;
  onArea: (area: SavedOutlineRecord) => void; onCandidate: (index: number) => void;
  onPrevious: () => void; onNext: () => void; onInsert: () => void; onDelete: () => void;
  onRearm: () => void; onUndo: () => void; onRedo: () => void; onConfirmPoint: () => void;
  onClose: () => void; onDone: () => void; onEdit: () => void; onCancel: () => void;
  onSave: (choice: OutlineFinishChoice) => void; onPitchChange: (value: number) => void; onTypePitch: () => void;
}

export function TouchOutlineRail(p: TouchOutlineRailProps) {
  const editing = p.stage === 'draw' || p.stage === 'edit';
  const footer = (() => {
    if (p.stage === 'saving') return <RailAction primary disabled>Saving roof...</RailAction>;
    if (p.stage === 'scanning') return <RailAction onClick={p.onCancelScan}>Cancel scan</RailAction>;
    // M11 (owner 2026-09-23): the finish-stage actions live INSIDE the
    // scrollable rail (below the pitch they depend on) - no pinned footer
    // overlay hiding the pitch above the fold.
    if (p.stage === 'finish') return null;
    if (p.stage === 'edit' || p.stage === 'ai-review') return <RailAction primary disabled={!p.ready || !!p.validation || p.gestureBusy} onClick={p.onDone}>Done</RailAction>;
    if (p.stage === 'draw') return <div className="flex flex-col gap-1">
      {p.armed && <RailAction primary disabled={p.gestureBusy} onClick={p.onConfirmPoint}>Confirm point</RailAction>}
      <RailAction primary={!p.armed} disabled={p.count < 3 || p.gestureBusy} onClick={p.onClose}>Close outline</RailAction>
    </div>;
    return null;
  })();
  return <RailTask label="Roof outline controls" footer={footer}>
    {p.error && <RailNotice error>{p.error}</RailNotice>}
    {!p.calibrated ? <><RailNotice>Calibrate this plan before drawing or scanning.</RailNotice><RailAction primary onClick={p.onCalibrate}>Calibrate plan</RailAction></>
      : p.stage === 'choose' ? <>
        <RailNotice>How would you like to create the roof outline?</RailNotice>
        <RailAction primary disabled={!p.ready} onClick={p.onManual}>Manual Outline</RailAction>
        {p.scanInfo ? <>
          <RailAction disabled={!p.ready || p.scanInfo.blocked} onClick={p.onScan}>AI Scan Assist</RailAction>
          <RailNotice>{p.scanInfo.blocked ? 'No AI points available. Manual outlining is always available.' : `Uses ${p.scanInfo.cost} AI Assist points. You can edit the result.`}</RailNotice>
        </> : <RailNotice>AI Scan Assist is not enabled for this account. Draw manually to continue.</RailNotice>}
        {p.viewControls}
        <PitchControl pitch={p.pitch} onChange={p.onPitchChange} onType={p.onTypePitch} />
        {p.areas.length > 0 && <details><summary className="min-h-12 py-3 text-xs">Existing roof outlines</summary>
          <div className="flex flex-col gap-1">{p.areas.map((area, index) => <RailAction key={area.geometryId ?? `saved-area-${index}`} onClick={() => p.onArea(area)}>{area.name}</RailAction>)}</div>
        </details>}
      </> : p.stage === 'scanning' ? <>
            <ScanProgress label="Scanning the roof outline" />
            <RailNotice>Your calibration and draft are kept until the scan succeeds.</RailNotice>
          </>
        : p.stage === 'saving' ? <RailNotice>Saving the roof area. Please keep this page open. You will return to the quote builder after it is saved.</RailNotice>
          : p.stage === 'finish' ? <>
            <div className="text-base font-semibold">{p.savedArea?.name || 'Main Roof'}</div>
            <RailNotice>Add components before you finish, or save and go straight to the quote builder.</RailNotice>
            {p.planArea && <RailNotice>{p.planArea}</RailNotice>}
            {p.savedArea ? <RailNotice>Pitch {p.savedArea.pitch}°. The saved roof&rsquo;s name and pitch are retained.</RailNotice>
              : <>
                <PitchControl pitch={p.pitch} onChange={p.onPitchChange} onType={p.onTypePitch} />
                <RailAction primary={!p.pitchConfirmed} disabled={p.pitchConfirmed} onClick={p.onConfirmPitch}>
                  {p.pitchConfirmed ? 'Pitch confirmed ✓' : `Confirm pitch ${p.pitch}°`}
                </RailAction>
                {!p.pitchConfirmed && <RailNotice>Confirm the pitch above to unlock the next step.</RailNotice>}
              </>}
            {/* M11: the three next-step actions sit right below the pitch -
                one scroll: set pitch, confirm it, then choose the next step. */}
            {(() => {
              const aiReady = !!p.scanInfo && !p.scanInfo.blocked;
              const pitchGate = !!p.savedArea || p.pitchConfirmed;
              const disabled = !p.ready || !!p.validation || !pitchGate;
              return <div className="flex flex-col gap-1 pt-1">
                {aiReady && <RailAction primary disabled={disabled} onClick={() => p.onSave('components-ai')}>AI scan components</RailAction>}
                <RailAction primary={!aiReady} disabled={disabled} onClick={() => p.onSave('components-manual')}>Add components manually</RailAction>
                <RailAction disabled={disabled} onClick={() => p.onSave('finish')}>Save &amp; finish</RailAction>
              </div>;
            })()}
            <RailAction onClick={p.onEdit}>Edit outline</RailAction>
          </> : <>
            {p.stage === 'ai-review' && <>
              <RailNotice>Check the outline and its points. Tap Done to use it, or edit any point.</RailNotice>
              <RailAction onClick={p.onEdit}>Edit points</RailAction>
              {p.candidateCount > 1 && <div className="flex flex-col gap-1">{Array.from({ length: p.candidateCount }, (_, index) =>
                <RailAction key={index} primary={index === p.candidateIndex} onClick={() => p.onCandidate(index)}>Roof suggestion {index + 1}</RailAction>)}</div>}
            </>}
            {editing && <>
              <RailAction label="Rearm selected outline point" disabled={p.index < 0 || p.gestureBusy} primary={p.armed} onClick={p.onRearm}>
                {p.index >= 0 ? `Point ${p.index + 1} of ${p.count}` : `${p.count} points`}
              </RailAction>
              <div className="grid grid-cols-2 gap-1">
                <RailAction label="Previous vertex" disabled={!p.canPrevious || p.gestureBusy} onClick={p.onPrevious}>‹</RailAction>
                <RailAction label="Next vertex" disabled={!p.canNext || p.gestureBusy} onClick={p.onNext}>›</RailAction>
                <RailAction label="Insert vertex after selected" disabled={!p.canInsert || p.gestureBusy} onClick={p.onInsert}>+</RailAction>
                <RailAction label="Delete selected vertex" disabled={!p.canDelete || p.gestureBusy} onClick={p.onDelete}>−</RailAction>
              </div>
              <RailNotice>{p.armed ? 'Lift your finger, then press away from the point and drag. Release to set.'
                : p.closed ? 'Choose a point with the arrows to adjust it.' : 'Tap to add the next corner. Tap the counter to move the selected point again.'}</RailNotice>
              <div className="grid grid-cols-2 gap-1">
                <RailAction disabled={!p.canUndo || p.gestureBusy} onClick={p.onUndo}>Undo</RailAction>
                <RailAction disabled={!p.canRedo || p.gestureBusy} onClick={p.onRedo}>Redo</RailAction>
              </div>
            </>}
            {p.validation && <RailNotice error>{p.validation}</RailNotice>}
            {p.planArea && <RailNotice>{p.planArea}</RailNotice>}
            {p.viewControls}
            <RailAction disabled={p.gestureBusy} onClick={p.onCancel}>Cancel outline</RailAction>
          </>}
  </RailTask>;
}
