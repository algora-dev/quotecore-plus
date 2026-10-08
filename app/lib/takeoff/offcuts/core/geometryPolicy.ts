/** Review geometry only. Never use these distances for sheet/stock fitting. */
import type { Point, RoofEdge, RoofInput } from './types';
export const GEOMETRY_MODEL = 'shared-boundaries-v1' as const;
export interface GeometryChange {
  id: string;
  kind: 'outline-alignment' | 'duplicate-line' | 'shared-junction';
  sourceIds: string[];
  before: RoofEdge[];
  after: RoofEdge[];
  maxMoveMm: number;
  message: string;
}
export interface FlowEvidence {
  faceId: string;
  flow: Point | null;
  basis: 'topology-eave' | 'gable-ridge-end' | 'spouting-hint' | 'needs-review';
  message: string;
}
export interface GeometryCleanupReport {
  model: typeof GEOMETRY_MODEL;
  sourceFingerprint: string;
  enabled: boolean;
  calibrated: boolean;
  mergeDistanceMm: number;
  junctionDistanceMm: number;
  inputLines: number;
  outputLines: number;
  outlineUnchanged: true;
  changes: GeometryChange[];
  keptSeparateIds: string[];
  flowEvidence?: FlowEvidence[];
  features?: import('./geometryFeatures').GeometryFeature[];
  edited?: boolean;
}
export function geometryPolicy(roof: RoofInput) {
  const calibrated = roof.calibrationConfirmed && Number.isFinite(roof.mmPerSceneUnit) && roof.mmPerSceneUnit > 0;
  const distances = { tight: [25, 10], balanced: [75, 50], relaxed: [150, 75] } as const;
  const [mergeMm, junctionMm] = distances[roof.draftingTolerance ?? 'balanced'];
  const scale = calibrated ? roof.mmPerSceneUnit : 1;
  return { calibrated, scale, mergeMm: calibrated ? mergeMm : 0, junctionMm: calibrated ? junctionMm : 0,
    merge: calibrated ? mergeMm / scale : 1e-7, junction: calibrated ? junctionMm / scale : 1e-7,
    parallelCos: Math.cos(5 * Math.PI / 180) };
}
export function validateCleanupOptions(roof: RoofInput): void {
  if (roof.geometryCleanupMode !== undefined && !['auto', 'raw'].includes(roof.geometryCleanupMode)) throw new Error('Unknown geometry cleanup mode.');
  const ids = roof.geometryKeepSeparateEdgeIds;
  if (ids !== undefined && (!Array.isArray(ids) || ids.length > 1200 || ids.some(id => typeof id !== 'string' || !roof.edges.some(e => e.id === id))))
    throw new Error('Invalid kept-separate boundary references.');
}
