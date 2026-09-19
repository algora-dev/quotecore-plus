// Versioned calibration persistence codec (P4, spec section 11).
// Pure module: no React, no Supabase, no Node-only APIs. Encodes the accepted
// calibration state into a versioned envelope stored in
// takeoff_pages.calibration_metadata, and decodes both the envelope (v1) and
// the legacy scale_calibration array shape with diagnostics - corrupt entries
// are quarantined and reported, never silently dropped (spec 11.2).
import {
  AGGREGATION_POLICY,
  computeEffectiveCalibration,
  type CalibrationReferenceInput,
} from './calibration';
import { convertToWorkingUnit } from './calibrationCandidates';
import type {
  AcceptedReferenceDraft,
  DistanceUnit,
  EffectiveCalibration,
  Point,
  WorkingUnit,
} from './calibrationTypes';

export const CALIBRATION_METADATA_SCHEMA_VERSION = 1 as const;

/** Serialisable accepted reference as stored in the envelope. */
export interface StoredReferenceV1 {
  id: string;
  source: 'manual' | 'ai_confirmed';
  candidateId: string | null;
  referenceId: string | null;
  candidateRevision: number | null;
  sceneP1: Point;
  sceneP2: Point;
  confirmedDistance: number;   // primitive confirmed input (authoritative)
  confirmedUnit: DistanceUnit;
  originalLabelText: string | null;
  valueCorrected: boolean;
  /** Recomputed cache only - decoders must recompute, never trust (spec 11.2). */
  pixelDistanceCache: number;
  scaleCache: number;
}

/** Versioned envelope for takeoff_pages.calibration_metadata. */
export interface CalibrationMetadataV1 {
  schemaVersion: typeof CALIBRATION_METADATA_SCHEMA_VERSION;
  workingUnit: WorkingUnit;
  aggregationPolicy: typeof AGGREGATION_POLICY;
  /** Server-established identity of the immutable source image (spec 5.3). */
  imageRevision: string;
  references: StoredReferenceV1[];
  /** Recomputed cache only - decoders recompute from primitives. */
  effective: EffectiveCalibration;
  savedAt: string | null;
}

export interface EncodeCalibrationMetadataInput {
  accepted: readonly AcceptedReferenceDraft[];
  workingUnit: WorkingUnit;
  imageRevision: string;
  savedAt?: string | null;
}

export type DecodeCalibrationResult =
  | {
      kind: 'v1';
      status: 'valid' | 'needs_review';
      metadata: CalibrationMetadataV1;
      /** Recomputed (never trusted) effective calibration. */
      effective: EffectiveCalibration;
      diagnostics: string[];
    }
  | {
      kind: 'legacy';
      status: 'valid' | 'needs_review' | 'invalid';
      references: AcceptedReferenceDraft[];
      workingUnit: WorkingUnit | null;
      effective: EffectiveCalibration | null;
      quarantined: number;
      diagnostics: string[];
    }
  | {
      kind: 'invalid';
      diagnostics: string[];
    };

const WORKING_UNITS: readonly WorkingUnit[] = ['meters', 'feet'];
const DISTANCE_UNITS: readonly DistanceUnit[] = ['m', 'cm', 'mm', 'ft', 'in', 'yd'];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPoint(v: unknown): v is Point {
  return (
    typeof v === 'object' && v !== null &&
    isFiniteNumber((v as { x?: unknown }).x) &&
    isFiniteNumber((v as { y?: unknown }).y)
  );
}

function distanceUnitFromLegacyUnit(unit: unknown): DistanceUnit | null {
  // Legacy manual calibrations stored unit as 'feet' | 'meters' only.
  if (unit === 'feet') return 'ft';
  if (unit === 'meters') return 'm';
  if (typeof unit === 'string' && (DISTANCE_UNITS as readonly string[]).includes(unit)) {
    return unit as DistanceUnit;
  }
  return null;
}

function workingUnitFromLegacyUnit(unit: unknown): WorkingUnit | null {
  if (unit === 'feet' || unit === 'meters') return unit;
  return null;
}

function pixelDistanceOf(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** Encode the current accepted calibration into the v1 envelope (pure). */
export function encodeCalibrationMetadata(
  input: EncodeCalibrationMetadataInput,
): CalibrationMetadataV1 {
  if (input.accepted.length === 0) {
    throw new Error('encodeCalibrationMetadata: accepted must be non-empty');
  }
  const refs: CalibrationReferenceInput[] = input.accepted.map((ref) => ({
    id: ref.id,
    sceneP1: ref.sceneP1,
    sceneP2: ref.sceneP2,
    confirmedDistance: ref.confirmedDistance,
    confirmedUnit: ref.confirmedUnit,
  }));
  const effective = computeEffectiveCalibration(refs, input.workingUnit);
  const references: StoredReferenceV1[] = input.accepted.map((ref) => {
    const px = pixelDistanceOf(ref.sceneP1, ref.sceneP2);
    const dist = convertToWorkingUnit(ref.confirmedDistance, ref.confirmedUnit, input.workingUnit);
    return {
      id: ref.id,
      source: ref.source,
      candidateId: ref.candidateId,
      referenceId: ref.referenceId,
      candidateRevision: ref.candidateRevision,
      sceneP1: { x: ref.sceneP1.x, y: ref.sceneP1.y },
      sceneP2: { x: ref.sceneP2.x, y: ref.sceneP2.y },
      confirmedDistance: ref.confirmedDistance,
      confirmedUnit: ref.confirmedUnit,
      originalLabelText: ref.originalLabelText,
      valueCorrected: ref.valueCorrected,
      pixelDistanceCache: px,
      scaleCache: dist / px, // cache only - decoders recompute from primitives
    };
  });
  return {
    schemaVersion: CALIBRATION_METADATA_SCHEMA_VERSION,
    workingUnit: input.workingUnit,
    aggregationPolicy: AGGREGATION_POLICY,
    imageRevision: input.imageRevision,
    references,
    effective,
    savedAt: input.savedAt ?? null,
  };
}

function decodeV1(
  raw: { imageRevision?: unknown; workingUnit?: unknown; references?: unknown; savedAt?: unknown },
  diagnostics: string[],
): { metadata: CalibrationMetadataV1; status: 'valid' | 'needs_review' } {
  const workingUnit = raw.workingUnit;
  if (!(WORKING_UNITS as readonly string[]).includes(workingUnit as string)) {
    throw new Error(`v1 envelope has invalid workingUnit: ${String(workingUnit)}`);
  }
  if (typeof raw.imageRevision !== 'string' || raw.imageRevision.length === 0) {
    throw new Error('v1 envelope is missing imageRevision');
  }
  if (!Array.isArray(raw.references) || raw.references.length === 0) {
    throw new Error('v1 envelope has no references array');
  }
  if (raw.references.length > 3) {
    // Spec 11.2: never silently truncate more than three records.
    diagnostics.push(
      `v1 envelope carries ${raw.references.length} references (max 3); all are reported, none dropped`,
    );
  }

  const accepted: AcceptedReferenceDraft[] = [];
  raw.references.forEach((r: unknown, i: number) => {
    if (typeof r !== 'object' || r === null) {
      diagnostics.push(`reference[${i}]: quarantined - not an object`);
      return;
    }
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id.length === 0) {
      diagnostics.push(`reference[${i}]: quarantined - missing id`);
      return;
    }
    if (!isPoint(o.sceneP1) || !isPoint(o.sceneP2)) {
      diagnostics.push(`reference[${o.id}]: quarantined - invalid scene points`);
      return;
    }
    const px = pixelDistanceOf(o.sceneP1 as Point, o.sceneP2 as Point);
    if (px <= 0) {
      diagnostics.push(`reference[${o.id}]: quarantined - zero-length pixel span`);
      return;
    }
    if (!isFiniteNumber(o.confirmedDistance) || (o.confirmedDistance as number) <= 0) {
      diagnostics.push(`reference[${o.id}]: quarantined - invalid confirmedDistance`);
      return;
    }
    if (!(DISTANCE_UNITS as readonly string[]).includes(o.confirmedUnit as string)) {
      diagnostics.push(`reference[${o.id}]: quarantined - unknown unit ${String(o.confirmedUnit)}`);
      return;
    }
    // Cached-scale tampering check (spec: recompute, never trust the cache).
    // Diagnostic fires only when a usable cache DISAGREES with the value
    // recomputed from primitives - matching caches are silently accepted.
    if (isFiniteNumber(o.scaleCache) && (o.scaleCache as number) > 0) {
      const expected = convertToWorkingUnit(
        o.confirmedDistance as number,
        o.confirmedUnit as DistanceUnit,
        workingUnit as WorkingUnit,
      ) / px;
      if (Math.abs((o.scaleCache as number) - expected) / expected > 1e-9) {
        diagnostics.push(
          `reference[${o.id}]: cached scale ${(o.scaleCache as number)} != recomputed ${expected} - recomputed value used`,
        );
      }
    }
    accepted.push({
      id: o.id as string,
      source: o.source === 'ai_confirmed' ? 'ai_confirmed' : 'manual',
      candidateId: typeof o.candidateId === 'string' ? o.candidateId : null,
      referenceId: typeof o.referenceId === 'string' ? o.referenceId : null,
      candidateRevision: isFiniteNumber(o.candidateRevision) ? (o.candidateRevision as number) : null,
      sceneP1: { ...(o.sceneP1 as Point) },
      sceneP2: { ...(o.sceneP2 as Point) },
      confirmedDistance: o.confirmedDistance as number,
      confirmedUnit: o.confirmedUnit as DistanceUnit,
      originalLabelText: typeof o.originalLabelText === 'string' ? o.originalLabelText : null,
      valueCorrected: o.valueCorrected === true,
    });
  });

  if (accepted.length === 0) {
    throw new Error(`v1 envelope has no decodable references (${diagnostics.length} diagnostics)`);
  }

  // Effective aggregation over the first three decodable references (shared
  // 3-cap); oversized envelopes keep ALL references reported above.
  const effective = computeEffectiveCalibration(
    accepted.slice(0, 3).map((ref) => ({
      id: ref.id,
      sceneP1: ref.sceneP1,
      sceneP2: ref.sceneP2,
      confirmedDistance: ref.confirmedDistance,
      confirmedUnit: ref.confirmedUnit,
    })),
    workingUnit as WorkingUnit,
  );

  const metadata: CalibrationMetadataV1 = {
    schemaVersion: CALIBRATION_METADATA_SCHEMA_VERSION,
    workingUnit: workingUnit as WorkingUnit,
    aggregationPolicy: AGGREGATION_POLICY,
    imageRevision: raw.imageRevision as string,
    references: accepted.map((ref) => {
      const px = pixelDistanceOf(ref.sceneP1, ref.sceneP2);
      const dist = convertToWorkingUnit(ref.confirmedDistance, ref.confirmedUnit, workingUnit as WorkingUnit);
      return {
        ...ref,
        pixelDistanceCache: px,
        scaleCache: dist / px, // cache only
      } satisfies StoredReferenceV1;
    }),
    effective,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null,
  };

  return { metadata, status: diagnostics.length > 0 ? 'needs_review' : 'valid' };
}

/**
 * Decode persisted calibration data. Accepts the v1 envelope OR the legacy
 * scale_calibration array. Never throws: corrupt input yields kind 'invalid'
 * with diagnostics, corrupt legacy entries are quarantined + reported.
 */
export function decodeCalibrationMetadata(raw: unknown): DecodeCalibrationResult {
  const diagnostics: string[] = [];

  if (Array.isArray(raw)) {
    // Legacy array shape (pre-P4 rows).
    const references: AcceptedReferenceDraft[] = [];
    let workingUnit: WorkingUnit | null = null;
    let quarantined = 0;
    raw.forEach((entry: unknown, i: number) => {
      if (typeof entry !== 'object' || entry === null) {
        diagnostics.push(`legacy[${i}]: quarantined - not an object`);
        quarantined++;
        return;
      }
      const o = entry as Record<string, unknown>;
      if (!isPoint(o.point1) || !isPoint(o.point2)) {
        diagnostics.push(`legacy[${i}]: quarantined - invalid points`);
        quarantined++;
        return;
      }
      const px = pixelDistanceOf(o.point1 as Point, o.point2 as Point);
      if (px <= 0) {
        diagnostics.push(`legacy[${i}]: quarantined - zero-length pixel span`);
        quarantined++;
        return;
      }
      if (!isFiniteNumber(o.actualDistance) || (o.actualDistance as number) <= 0) {
        diagnostics.push(`legacy[${i}]: quarantined - invalid actualDistance`);
        quarantined++;
        return;
      }
      const unit = distanceUnitFromLegacyUnit(o.unit);
      if (unit === null) {
        diagnostics.push(`legacy[${i}]: quarantined - unknown unit ${String(o.unit)}`);
        quarantined++;
        return;
      }
      const wu = workingUnitFromLegacyUnit(o.unit);
      if (workingUnit === null && wu !== null) workingUnit = wu;
      if (wu !== null && workingUnit !== null && wu !== workingUnit) {
        diagnostics.push(
          `legacy[${i}]: unit ${String(o.unit)} differs from first reference's unit - mixed-unit legacy set, values preserved as-is`,
        );
      }
      // Legacy stored actualDistance already in working units and pixelDistance
      // as a cache. Recompute the cache from the stored points (spec 11.2).
      if (isFiniteNumber(o.pixelDistance) &&
          Math.abs((o.pixelDistance as number) - px) > 1e-6) {
        diagnostics.push(
          `legacy[${i}]: stored pixelDistance ${String(o.pixelDistance)} differs from recomputed ${px.toFixed(6)} - recomputed value used`,
        );
      }
      references.push({
        id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `legacy-${i}`,
        source: 'manual',
        candidateId: null,
        referenceId: null,
        candidateRevision: null,
        sceneP1: { ...(o.point1 as Point) },
        sceneP2: { ...(o.point2 as Point) },
        // Legacy actualDistance is in working units (feet/meters): express it
        // in the matching DistanceUnit primitive for the shared maths.
        confirmedDistance: o.actualDistance as number,
        confirmedUnit: unit,
        originalLabelText: null,
        valueCorrected: false,
      });
    });

    if (references.length === 0) {
      return {
        kind: 'invalid',
        diagnostics: [
          ...diagnostics,
          `legacy calibration array had ${quarantined} entr${quarantined === 1 ? 'y' : 'ies'} and none survived decoding`,
        ],
      };
    }

    const effective = computeEffectiveCalibration(
      references.map((ref) => ({
        id: ref.id,
        sceneP1: ref.sceneP1,
        sceneP2: ref.sceneP2,
        confirmedDistance: ref.confirmedDistance,
        confirmedUnit: ref.confirmedUnit,
      })),
      workingUnit ?? 'feet',
    );

    const status: 'valid' | 'needs_review' | 'invalid' =
      quarantined > 0 ? 'needs_review' : (diagnostics.length > 0 ? 'needs_review' : 'valid');
    return {
      kind: 'legacy',
      status,
      references,
      workingUnit,
      effective,
      quarantined,
      diagnostics,
    };
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (o.schemaVersion === CALIBRATION_METADATA_SCHEMA_VERSION) {
      try {
        const { metadata, status } = decodeV1(o, diagnostics);
        // Effective aggregation over the first three decodable references
        // (shared 3-cap); oversized envelopes keep ALL references reported.
        const effective = computeEffectiveCalibration(
          metadata.references.slice(0, 3).map((ref) => ({
            id: ref.id,
            sceneP1: ref.sceneP1,
            sceneP2: ref.sceneP2,
            confirmedDistance: ref.confirmedDistance,
            confirmedUnit: ref.confirmedUnit,
          })),
          metadata.workingUnit,
        );
        // Cross-check the stored cache against the recomputation.
        if (isFiniteNumber((o.effective as { scale?: unknown } | undefined)?.scale)) {
          const stored = (o.effective as { scale: number }).scale;
          if (Math.abs(stored - effective.scale) / effective.scale > 1e-9) {
            diagnostics.push(
              `v1 effective.scale cache ${stored} != recomputed ${effective.scale} - recomputed value used`,
            );
          }
        }
        return {
          kind: 'v1',
          status: diagnostics.length > 0 ? 'needs_review' : status,
          metadata,
          effective,
          diagnostics,
        };
      } catch (err) {
        return {
          kind: 'invalid',
          diagnostics: [
            `v1 envelope failed validation: ${err instanceof Error ? err.message : String(err)}`,
            ...diagnostics,
          ],
        };
      }
    }
    return {
      kind: 'invalid',
      diagnostics: [`unrecognised calibration object (schemaVersion=${String(o.schemaVersion)})`],
    };
  }

  return { kind: 'invalid', diagnostics: [`unsupported calibration payload type: ${typeof raw}`] };
}
