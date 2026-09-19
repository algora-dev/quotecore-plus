// P3 deterministic recalibration recompute + dependency provenance (spec sections 10.2, 10.3).
// Pure + node-safe: no React, no Fabric, no Supabase imports.
//
// Given a page's stored geometry-bearing records, the old effective scale and a
// new EffectiveCalibration, computes next values WITHOUT mutating input.
// Scale-dependent records with missing/zero pixel geometry are flagged as
// errors - never silently dropped. Records with no scale dependency (point
// counts) are skipped and listed.
import type { EffectiveCalibration } from './calibrationTypes';
import { METERS_PER_FOOT } from './calibrationCandidates';

export type RecomputeMeasurementType =
  | 'line'
  | 'area'
  | 'point'
  | 'multi_lineal'
  | 'multi_lineal_lxh'
  | 'volume_3d'
  | 'length_x_height_freestyle'
  | 'multi_lineal_lxh_freestyle';

/** Entry inputs that participate in recomputation (spec 10.3). height/depth
 *  are authoritative user-entered real-world values and are NEVER rescaled. */
export interface RecomputeEntryInputs {
  height_m?: number | null;
  depth_m?: number | null;
  value_basis?: 'plan' | 'pitched';
  plan_value?: number;
  pitch_applied?: boolean;
  source_geometry_id?: string;
}

export interface RecomputeMeasurementRecord {
  id: string;
  type: RecomputeMeasurementType;
  value: number;
  points?: ReadonlyArray<{ x: number; y: number }> | null;
  entryInputs?: RecomputeEntryInputs | null;
  quoteRoofAreaId?: string | null;
}

export interface RecomputeRoofAreaRecord {
  id: string;
  points: ReadonlyArray<{ x: number; y: number }>;
  area: number;
  pitch?: number;
  quoteRoofAreaId?: string | null;
}

export interface RecomputeInput {
  measurements: readonly RecomputeMeasurementRecord[];
  roofAreas: readonly RecomputeRoofAreaRecord[];
  /** Effective scale (real working units / scene px) the current values were
   *  materialised with. Null when the page had no prior calibration. */
  oldScale: number | null;
  newCalibration: EffectiveCalibration;
}

export type RecomputeErrorCode =
  | 'INVALID_RECORD'
  | 'MISSING_GEOMETRY'
  | 'AMBIGUOUS_SOURCE'
  | 'MISSING_SOURCE'
  | 'MISSING_OLD_SCALE';

export interface RecomputeError {
  recordId: string;
  code: RecomputeErrorCode;
  message: string;
}

export interface RecomputeMeasurementUpdate {
  id: string;
  type: RecomputeMeasurementType;
  value: number;
  /** Refreshed plan snapshot (page working unit squared) for attached entries. */
  planValue?: number;
}

export interface RecomputeRoofAreaUpdate {
  id: string;
  area: number;
}

export type SourceResolution =
  | 'source_geometry_id'
  | 'unique_area_match'
  | 'scale_ratio';

/** Durable-ish provenance link: a geometry-free derived entry -> its source polygon. */
export interface SourceProvenanceLink {
  measurementId: string;
  sourceGeometryId: string | null; // null only for scale_ratio fallback
  resolution: SourceResolution;
}

export interface RecomputeSkipped {
  id: string;
  type: RecomputeMeasurementType | 'roof_area';
  reason: string;
}

export interface RecomputeResult {
  ok: boolean; // true only when errors.length === 0 (no partial application)
  errors: RecomputeError[];
  measurementUpdates: RecomputeMeasurementUpdate[];
  roofAreaUpdates: RecomputeRoofAreaUpdate[];
  provenance: SourceProvenanceLink[];
  skipped: RecomputeSkipped[];
}

function polygonPixelArea(points: ReadonlyArray<{ x: number; y: number }>): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y;
    sum -= points[j].x * points[i].y;
  }
  return Math.abs(sum / 2);
}

function polylinePixelLength(points: ReadonlyArray<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** Pitch factor identical to app/lib/pricing/engine.ts rafterPitchFactor. */
function rafterPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  return 1 / Math.cos((degrees * Math.PI) / 180);
}

function isDerivedAreaEntry(m: RecomputeMeasurementRecord): boolean {
  const ei = m.entryInputs;
  return (
    m.type === 'area' &&
    (ei?.value_basis === 'plan' || ei?.value_basis === 'pitched') &&
    typeof ei?.plan_value === 'number'
  );
}

function hasGeometry(m: RecomputeMeasurementRecord): boolean {
  return Array.isArray(m.points) && m.points.length >= 2;
}

/**
 * Deterministic recompute per spec 10.2:
 *  - line/multi_lineal/multi_lineal_lxh: length = px * S (page working unit)
 *  - area + roof areas: plan area = px^2 * S^2 (pitch preserved, applied once downstream)
 *  - volume_3d: value m^3 = pxArea * S_m^2 * entered depth_m (depth NOT rescaled)
 *  - freestyle L x H: value m^2 = pxLength * S_m * entered height_m (height NOT rescaled)
 *  - point: count, scale-independent (skipped)
 *  - attached entries (points:[] + plan_value): refresh from the source polygon's
 *    recomputed plan area; falls back to (S_new/S_old)^2 ratio when the source
 *    polygon is unavailable but the old scale is known; ambiguous matches block.
 */
export function computeCalibrationRecompute(input: RecomputeInput): RecomputeResult {
  const { measurements, roofAreas, oldScale, newCalibration } = input;

  if (!newCalibration || !Number.isFinite(newCalibration.scale) || newCalibration.scale <= 0) {
    throw new Error('computeCalibrationRecompute: invalid newCalibration');
  }
  if (oldScale !== null && (!Number.isFinite(oldScale) || oldScale <= 0)) {
    throw new Error('computeCalibrationRecompute: invalid oldScale');
  }

  const s = newCalibration.scale;
  const sMeters = newCalibration.unit === 'feet' ? s * METERS_PER_FOOT : s;

  const errors: RecomputeError[] = [];
  const measurementUpdates: RecomputeMeasurementUpdate[] = [];
  const roofAreaUpdates: RecomputeRoofAreaUpdate[] = [];
  const provenance: SourceProvenanceLink[] = [];
  const skipped: RecomputeSkipped[] = [];

  // --- Roof areas first: their recomputed plan areas feed derived entries. ---
  const newPlanAreaByRoofAreaId = new Map<string, number>();
  for (const ra of roofAreas) {
    if (!ra || typeof ra.id !== 'string' || !Array.isArray(ra.points) || ra.points.length < 3) {
      errors.push({
        recordId: ra?.id ?? 'unknown-roof-area',
        code: 'MISSING_GEOMETRY',
        message: 'roof area has no polygon points (need >= 3) - cannot rescale',
      });
      continue;
    }
    const pxArea = polygonPixelArea(ra.points);
    if (!Number.isFinite(pxArea) || pxArea <= 0) {
      errors.push({
        recordId: ra.id,
        code: 'MISSING_GEOMETRY',
        message: 'roof area polygon has zero pixel area - cannot rescale',
      });
      continue;
    }
    const newArea = pxArea * s * s;
    newPlanAreaByRoofAreaId.set(ra.id, newArea);
    roofAreaUpdates.push({ id: ra.id, area: newArea });
  }

  for (const m of measurements) {
    if (!m || typeof m.id !== 'string' || !Object.prototype.hasOwnProperty.call(m, 'value')) {
      errors.push({
        recordId: m?.id ?? 'unknown',
        code: 'INVALID_RECORD',
        message: 'malformed measurement record - rejected, not dropped',
      });
      continue;
    }

    // Scale-independent: point counts.
    if (m.type === 'point') {
      skipped.push({ id: m.id, type: m.type, reason: 'count is scale-independent' });
      continue;
    }

    // Geometry-free derived entry attached to a roof area (spec 10.3 provenance).
    if (isDerivedAreaEntry(m)) {
      const ei = m.entryInputs!;
      const sourceId = ei.source_geometry_id;
      let resolved: RecomputeRoofAreaRecord | undefined;
      let resolution: SourceResolution;

      if (typeof sourceId === 'string' && sourceId.length > 0) {
        resolved = roofAreas.find((ra) => ra.id === sourceId);
        if (!resolved) {
          errors.push({
            recordId: m.id,
            code: 'MISSING_SOURCE',
            message: `derived entry references source polygon "${sourceId}" which is not on this page - resolve or remove it before recalibrating`,
          });
          continue;
        }
        resolution = 'source_geometry_id';
      } else {
        const candidates = roofAreas.filter(
          (ra) => Boolean(m.quoteRoofAreaId) && ra.quoteRoofAreaId === m.quoteRoofAreaId,
        );
        if (candidates.length === 1) {
          resolved = candidates[0];
          resolution = 'unique_area_match';
        } else if (candidates.length > 1) {
          errors.push({
            recordId: m.id,
            code: 'AMBIGUOUS_SOURCE',
            message: 'derived entry matches multiple sibling polygons under the same roof area - resolve or remove it before recalibrating',
          });
          continue;
        } else {
          // 0 matches: no resolvable polygon on this page - ratio fallback below.
          resolution = 'scale_ratio';
        }
      }

      let newPlan: number;
      if (resolved) {
        const pxArea = polygonPixelArea(resolved.points);
        if (!Number.isFinite(pxArea) || pxArea <= 0) {
          errors.push({
            recordId: m.id,
            code: 'MISSING_GEOMETRY',
            message: 'source polygon has zero pixel area - cannot rescale derived entry',
          });
          continue;
        }
        newPlan = pxArea * s * s;
      } else if (oldScale !== null) {
        newPlan = ei.plan_value! * (s / oldScale) * (s / oldScale);
      } else {
        errors.push({
          recordId: m.id,
          code: 'MISSING_OLD_SCALE',
          message: 'derived entry has no resolvable source polygon and no prior calibration - resolve or remove it before recalibrating',
        });
        continue;
      }

      const pitch = resolved?.pitch ?? 0;
      const newValue =
        ei.value_basis === 'pitched' ? newPlan * rafterPitchFactor(pitch) : newPlan;

      provenance.push({
        measurementId: m.id,
        sourceGeometryId: resolved?.id ?? null,
        resolution,
      });
      measurementUpdates.push({ id: m.id, type: m.type, value: newValue, planValue: newPlan });
      continue;
    }

    // Geometry-bearing records.
    if (!hasGeometry(m)) {
      errors.push({
        recordId: m.id,
        code: 'MISSING_GEOMETRY',
        message: `scale-dependent measurement of type "${m.type}" has no pixel geometry - cannot rescale`,
      });
      continue;
    }

    const pts = m.points!;
    switch (m.type) {
      case 'line': {
        if (pts.length < 2) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'line needs 2 points' });
          continue;
        }
        const px = polylinePixelLength(pts.slice(0, 2));
        if (!(px > 0)) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'line has zero pixel length - cannot rescale' });
          continue;
        }
        measurementUpdates.push({ id: m.id, type: m.type, value: px * s });
        break;
      }
      case 'multi_lineal':
      case 'multi_lineal_lxh': {
        const px = polylinePixelLength(pts);
        if (!(px > 0)) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'polyline has zero pixel length - cannot rescale' });
          continue;
        }
        measurementUpdates.push({ id: m.id, type: m.type, value: px * s });
        break;
      }
      case 'length_x_height_freestyle':
      case 'multi_lineal_lxh_freestyle': {
        const height = m.entryInputs?.height_m;
        if (typeof height !== 'number' || !(height > 0)) {
          errors.push({
            recordId: m.id,
            code: 'INVALID_RECORD',
            message: 'freestyle entry is missing its entered height (height_m) - cannot recompute',
          });
          continue;
        }
        const px = polylinePixelLength(pts);
        if (!(px > 0)) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'freestyle line has zero pixel length - cannot rescale' });
          continue;
        }
        measurementUpdates.push({ id: m.id, type: m.type, value: px * sMeters * height });
        break;
      }
      case 'volume_3d': {
        if (pts.length < 3) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'volume_3d needs a polygon (>= 3 points)' });
          continue;
        }
        const depth = m.entryInputs?.depth_m;
        if (typeof depth !== 'number' || !(depth > 0)) {
          errors.push({
            recordId: m.id,
            code: 'INVALID_RECORD',
            message: 'volume_3d entry is missing its entered depth (depth_m) - cannot recompute',
          });
          continue;
        }
        const pxArea = polygonPixelArea(pts);
        if (!(pxArea > 0)) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'volume_3d polygon has zero pixel area - cannot rescale' });
          continue;
        }
        measurementUpdates.push({ id: m.id, type: m.type, value: pxArea * sMeters * sMeters * depth });
        break;
      }
      case 'area': {
        if (pts.length < 3) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'area needs a polygon (>= 3 points)' });
          continue;
        }
        const pxArea = polygonPixelArea(pts);
        if (!(pxArea > 0)) {
          errors.push({ recordId: m.id, code: 'MISSING_GEOMETRY', message: 'area polygon has zero pixel area - cannot rescale' });
          continue;
        }
        measurementUpdates.push({ id: m.id, type: m.type, value: pxArea * s * s });
        break;
      }
      default: {
        errors.push({
          recordId: m.id,
          code: 'INVALID_RECORD',
          message: `unknown measurement type "${String((m as RecomputeMeasurementRecord).type)}"`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    measurementUpdates,
    roofAreaUpdates,
    provenance,
    skipped,
  };
}
