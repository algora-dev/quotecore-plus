import type { RoofEdge, RoofInput } from './types';
import { fingerprint } from './math';
import { consolidateRuns } from './geometryLines';
import { sharedJunctions } from './geometryJunctions';
import { GEOMETRY_MODEL, geometryPolicy, validateCleanupOptions, type GeometryCleanupReport } from './geometryPolicy';

/** Pure preprocessing: cleaned edges + reversible evidence, never quote/source writes.
 * Does not delete polygons by area or assume that a narrow real face is impossible. */
export function cleanBoundaryGraph(roof: RoofInput, perimeter: RoofEdge[]): { edges: RoofEdge[]; report: GeometryCleanupReport } {
  validateCleanupOptions(roof);
  const p = geometryPolicy(roof);
  const report: GeometryCleanupReport = { model: GEOMETRY_MODEL, enabled: roof.geometryCleanupMode !== 'raw',
    sourceFingerprint: fingerprint([roof.outlines, roof.edges]), calibrated: p.calibrated,
    mergeDistanceMm: p.mergeMm, junctionDistanceMm: p.junctionMm, inputLines: roof.edges.length, outputLines: roof.edges.length,
    outlineUnchanged: true, changes: [], keptSeparateIds: [...(roof.geometryKeepSeparateEdgeIds ?? [])] };
  if (!report.enabled) return { edges: structuredClone(roof.edges), report };
  const runs = consolidateRuns(roof, perimeter);
  const joined = sharedJunctions(roof, runs.edges, perimeter);
  report.changes = [...runs.changes, ...joined.changes]; report.outputLines = joined.edges.length;
  return { edges: joined.edges, report };
}
