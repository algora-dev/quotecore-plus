// Mobile takeoff M4: pure calibration-flow helpers for the touch
// presentation (spec 2026-09-21 §7.2/§7.3/§7.4/§7.5 + C-series 14.4).
// No React, no DOM, no Supabase: everything here is unit-testable and shared
// with the reducer/controller layer. The touch workspace owns presentation.
//
// What this module guarantees:
// - Effective scale ALWAYS comes from the existing computeEffectiveCalibration
//   service (§7.5); no new formulae anywhere.
// - finishBlockers implements the C12 shared disagreement policy: >10%
//   range/mean warning requires an explicit acknowledgement before finish;
//   outliers are never silently removed.
// - buildCalibrationCommit produces exactly the same legacy +
//   calibrationMetadata payload the desktop workstation persists (R14: one
//   domain/save path), so touch and desktop write identical rows.
// - pageDependentRecompute scopes recalibration recomputation to THIS page's
//   entries only (C13) via the existing computeCalibrationRecompute.

import type { CalibrationImageDescriptor, Point, WorkingUnit } from '../calibrationTypes';
import type { AcceptedReferenceDraft } from '../calibrationTypes';
import type { CalibrationSessionState } from '../calibrationSession';
import { selectDraftEffectiveCalibration, validAcceptedReferences } from '../calibrationSession';
import { effectiveScaleFromLegacyCalibrations, type LegacyCalibrationLike } from '../calibration';
import { encodeCalibrationMetadata, type CalibrationMetadataV1 } from '../calibrationCodec';
import { convertToWorkingUnit } from '../calibrationCandidates';
import {
  computeCalibrationRecompute,
  type RecomputeMeasurementRecord,
  type RecomputeResult,
  type RecomputeRoofAreaRecord,
} from '../calibrationRecompute';

// ---------------------------------------------------------------------------
// C12: disagreement acknowledgement gate (shared policy, §7.5).
// ---------------------------------------------------------------------------

export interface FinishBlockers {
  /** The shared >10% range/mean warning text, or null when references agree. */
  disagreementWarning: string | null;
  /** True when finishing must be blocked until the user explicitly
   *  acknowledges the warning ("Use this average anyway"). Never removes or
   *  ignores an outlier silently. */
  acknowledgementRequired: boolean;
}

export function finishBlockers(
  state: CalibrationSessionState,
  workingUnit: WorkingUnit,
): FinishBlockers {
  const valid = validAcceptedReferences(state);
  if (valid.length === 0) {
    return { disagreementWarning: null, acknowledgementRequired: false };
  }
  const effective = selectDraftEffectiveCalibration(state, workingUnit);
  const warning = effective?.disagreementWarning ?? null;
  return {
    disagreementWarning: warning,
    acknowledgementRequired: warning != null && !state.disagreementAcknowledged,
  };
}

// ---------------------------------------------------------------------------
// Commit payload (identical mapping to the desktop workstation, R14).
// ---------------------------------------------------------------------------

export interface CalibrationCommitPayload {
  legacy: LegacyCalibrationLike[];
  metadata: CalibrationMetadataV1;
}

/** Builds the persistence payload for the calibration-only save path
 *  (actions.ts persistPageCalibration writes scale_calibration +
 *  calibration_metadata together). Mirrors the workstation mapping exactly. */
export function buildCalibrationCommit(
  accepted: readonly AcceptedReferenceDraft[],
  workingUnit: WorkingUnit,
  imageRevision: string,
  savedAt: string,
): CalibrationCommitPayload {
  const legacy: LegacyCalibrationLike[] = accepted.map((ref) => {
    const pixelDistance = Math.hypot(ref.sceneP2.x - ref.sceneP1.x, ref.sceneP2.y - ref.sceneP1.y);
    const dist = convertToWorkingUnit(ref.confirmedDistance, ref.confirmedUnit, workingUnit);
    return {
      id: ref.id,
      point1: { ...ref.sceneP1 },
      point2: { ...ref.sceneP2 },
      pixelDistance,
      actualDistance: dist,
      unit: (workingUnit === 'meters' ? 'meters' : 'feet') as 'feet' | 'meters',
      scale: dist / pixelDistance,
    };
  });
  const metadata = encodeCalibrationMetadata({ accepted, workingUnit, imageRevision, savedAt });
  return { legacy, metadata };
}

// ---------------------------------------------------------------------------
// C13/C14: page-scoped dependent recompute on recalibration.
// ---------------------------------------------------------------------------

export interface PageDependents {
  measurements: readonly (RecomputeMeasurementRecord & { fromPageId?: string | null })[];
  roofAreas: readonly (RecomputeRoofAreaRecord & { fromPageId?: string | null })[];
}

/** Same page filter the desktop workstation uses: entries belong to the page
 *  when their fromPageId is null (legacy/global) or matches. Other pages'
 *  entries NEVER enter the recompute (C13). */
export function pageScopedDependents(
  pageId: string | null,
  dependents: PageDependents,
): { measurements: RecomputeMeasurementRecord[]; roofAreas: RecomputeRoofAreaRecord[] } {
  const owns = (fromPageId: string | null | undefined) =>
    !fromPageId || !pageId || fromPageId === pageId;
  return {
    measurements: dependents.measurements.filter((m) => owns(m.fromPageId)).map(({ fromPageId: _f, ...m }) => m),
    roofAreas: dependents.roofAreas.filter((a) => owns(a.fromPageId)).map(({ fromPageId: _f, ...a }) => a),
  };
}

/** Deterministic dependent recompute for a recalibration (existing service).
 *  `oldScale` is derived from the page's legacy calibrations via the shared
 *  effectiveScaleFromLegacyCalibrations — never a client-guessed number. */
export function pageDependentRecompute(input: {
  pageId: string | null;
  dependents: PageDependents;
  previousLegacyCalibrations: readonly LegacyCalibrationLike[];
  newEffectiveScale: number;
  newCalibration: CalibrationMetadataV1['effective'];
}): RecomputeResult {
  const scoped = pageScopedDependents(input.pageId, input.dependents);
  const oldScale =
    input.previousLegacyCalibrations.length > 0
      ? effectiveScaleFromLegacyCalibrations(input.previousLegacyCalibrations)
      : null;
  return computeCalibrationRecompute({
    measurements: scoped.measurements,
    roofAreas: scoped.roofAreas,
    oldScale,
    newCalibration: input.newCalibration,
  });
}

// ---------------------------------------------------------------------------
// Manual A/B pair validation (§7.5 reject rules for the wizard pair).
// ---------------------------------------------------------------------------

export function manualPairValid(p1: Point | null, p2: Point | null): { ok: true } | { ok: false; message: string } {
  if (!p1 || !p2) return { ok: false, message: 'Place the start and end points first.' };
  const coords = [p1.x, p1.y, p2.x, p2.y];
  if (!coords.every(Number.isFinite)) return { ok: false, message: 'Points must be on the plan.' };
  if (Math.hypot(p2.x - p1.x, p2.y - p1.y) <= 0) {
    return { ok: false, message: 'The two points must be different.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Scene-frame descriptor for the touch calibration surface (§10.1).
// ---------------------------------------------------------------------------

/** Builds the CalibrationImageDescriptor for the touch calibration surface
 *  from the immutable source image. The scene frame is the SAME
 *  2000-long-edge normalisation the workstation uses (sceneDimsFromSource), so
 *  points placed in touch view are valid workstation scene coordinates (R14:
 *  one domain, not a mobile coordinate system). */
export function calibrationDescriptorFromSource(input: {
  pageId: string;
  imageRevision: string | null;
  frameKey: string;
  sourceWidth: number;
  sourceHeight: number;
}): CalibrationImageDescriptor {
  const longEdge = Math.max(input.sourceWidth, input.sourceHeight);
  const scale = Math.min(1, 2000 / longEdge);
  return {
    pageId: input.pageId,
    imageRevision: input.imageRevision,
    frameKey: input.frameKey,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    sceneWidth: input.sourceWidth * scale,
    sceneHeight: input.sourceHeight * scale,
    // Uniform source→scene scale; the workstation builds the same affine from
    // its scaled image placement.
    sourceToScene: [scale, 0, 0, scale, 0, 0],
    coordinateFrame: 'takeoff-scene-v1',
    geometryVersion: 1,
  };
}
