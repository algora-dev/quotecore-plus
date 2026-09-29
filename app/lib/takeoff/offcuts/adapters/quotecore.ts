import type { EdgeKind, Issue, Point, RoofInput } from '../core/types';
import { cleanRing, distance, fingerprint } from '../core/math';
export interface QuoteCoreSnapshot {
  quoteId: string; pageId: string; areaScopeId: string | null;
  imageRevision: string; imageUrl?: string; width: number; height: number;
  calibrationConfirmed: boolean;
  calibrations: { id: string; point1: Point; point2: Point; unit: 'feet' | 'meters'; actualDistance?: number; pixelDistance?: number; scale?: number }[];
  roofAreas: { id: string; name: string; points: Point[]; pitch?: number; visible: boolean; fromPageId?: string | null; quoteRoofAreaId?: string | null }[];
  components: { id: string; name: string }[];
  componentMeasurements: { componentId: string; measurements: { id: string; type: string; points?: Point[]; visible: boolean; fromPageId?: string | null; quoteRoofAreaId?: string | null }[] }[];
  /** Use the existing component registry or an explicit per-project mapping.
   * Never classify user library items by display colour or substring matching. */
  semanticByComponentId?: Record<string, EdgeKind>;
  selectedOutlineIds?: string[];
}
export const SEMANTIC_NAMES: Record<string, EdgeKind> = {
  ridge: 'ridge', ridges: 'ridge', hip: 'hip', hips: 'hip', valley: 'valley', valleys: 'valley',
  brokenhip: 'broken_hip', brokenhips: 'broken_hip', barge: 'barge', barges: 'barge',
  spouting: 'spouting', uncertain: 'unknown',
};
export function calibrationMmPerSceneUnit(cals: QuoteCoreSnapshot['calibrations']): number {
  if (!cals.length) return 0;
  if (cals.length > 3) throw new Error('QuoteCore calibration supports at most three accepted references.');
  const scales = cals.map(c => {
    const sceneDistance = distance(c.point1, c.point2);
    const refPx = c.pixelDistance && c.pixelDistance > 0 ? c.pixelDistance : sceneDistance;
    const real = c.actualDistance && c.actualDistance > 0 ? c.actualDistance : (c.scale ?? 0) * refPx;
    if (!Number.isFinite(real) || real <= 0 || sceneDistance <= 0) throw new Error(`Invalid calibration reference ${c.id}.`);
    return real * (c.unit === 'feet' ? 304.8 : 1000) / sceneDistance;
  });
  return scales.reduce((a, b) => a + b, 0) / scales.length;
}
export function fromQuoteCore(s: QuoteCoreSnapshot): { roof: RoofInput; issues: Issue[] } {
  if (!s.quoteId || !s.pageId) throw new Error('Quote and persisted page IDs are required.');
  if (![s.width, s.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('Active scene dimensions are missing.');
  const issues: Issue[] = [];
  const belongs = (m: { fromPageId?: string | null; quoteRoofAreaId?: string | null }): boolean =>
    (!m.fromPageId || m.fromPageId === s.pageId) && (!s.areaScopeId || !m.quoteRoofAreaId || m.quoteRoofAreaId === s.areaScopeId);
  const outlines = s.roofAreas.filter(a => belongs(a) && a.visible && (!s.selectedOutlineIds || s.selectedOutlineIds.includes(a.id)))
    .map(a => ({ id: a.id, name: a.name, polygon: cleanRing(a.points), suggestedPitchDeg: Number.isFinite(a.pitch) ? a.pitch : undefined }));
  const names = new Map(s.components.map(c => [c.id, c.name])), edges: RoofInput['edges'] = [];
  for (const group of s.componentMeasurements) {
    const name = names.get(group.componentId) ?? group.componentId;
    const semantic = s.semanticByComponentId?.[group.componentId] ?? SEMANTIC_NAMES[name.toLowerCase().replace(/[\s_-]+/g, '')];
    const ms = group.measurements.filter(m => belongs(m) && m.visible && ['line', 'multi_lineal'].includes(m.type) && m.points && m.points.length >= 2);
    if (!semantic) {
      if (ms.length) issues.push({ severity: 'warning', code: 'UNMAPPED_COMPONENT', objectId: group.componentId, message: `Ignored unclassified line component “${name}”. Map it explicitly before relying on automatic face detection.` });
      continue;
    }
    for (const m of ms) for (let i = 0; i < m.points!.length - 1; i++) {
      const a = m.points![i], b = m.points![i + 1];
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) throw new Error(`Invalid line coordinates on ${m.id}.`);
      edges.push({ id: `${m.id}:${i}`, a: { ...a }, b: { ...b }, kind: semantic });
    }
  }
  const roof: RoofInput = { schemaVersion: 1, quoteId: s.quoteId, pageId: s.pageId, areaScopeId: s.areaScopeId,
    imageRevision: s.imageRevision, imageUrl: s.imageUrl, sceneWidth: s.width, sceneHeight: s.height,
    mmPerSceneUnit: calibrationMmPerSceneUnit(s.calibrations), calibrationConfirmed: s.calibrationConfirmed,
    outlines, edges, sourceRevision: '' };
  roof.sourceRevision = roofRevision(roof);
  return { roof, issues };
}
export function roofRevision(roof: RoofInput): string {
  const { imageUrl: _url, sourceRevision: _revision, ...content } = roof;
  return fingerprint(content);
}
