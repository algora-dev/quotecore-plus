import type { EdgeKind, Issue, Point, RoofInput } from '../core/types';
import { cleanRing, distance, fingerprint } from '../core/math';

/** Catalogue identity is not roof meaning. 'ignore' must be an explicit decision,
 * never the consequence of an unfamiliar product name or UUID. */
export type BoundaryMeaning = EdgeKind | 'ignore';
export interface SnapshotScope { fromPageId?: string | null; quoteRoofAreaId?: string | null }
export interface SnapshotMeasurement extends SnapshotScope {
  id: string; type: string; points?: Point[]; visible?: boolean;
  aiOrigin?: boolean; source?: string; semanticType?: BoundaryMeaning;
  /** For host-specific measurement arithmetic; geometry role is explicit. */
  geometryKind?: 'polyline'|'polygon'|'point';
}
/** These measurement variants store an open scene path in the supplied host.
 * Their numeric value can be length × height; only their points matter here. */
export function isPlanLineMeasurement(m:Pick<SnapshotMeasurement,'type'|'geometryKind'>):boolean {
  if(m.geometryKind!==undefined)return m.geometryKind==='polyline';
  return ['line','multi_lineal','multi_lineal_lxh','length_x_height_freestyle','multi_lineal_lxh_freestyle'].includes(m.type);
}
export interface SnapshotComponent {
  id: string; name: string; semanticType?: BoundaryMeaning; is_system?: boolean;
}
export interface QuoteCoreSnapshot {
  quoteId: string; pageId: string; areaScopeId: string | null;
  imageRevision: string; imageUrl?: string; width: number; height: number;
  calibrationConfirmed: boolean;
  calibrations: { id: string; point1: Point; point2: Point; unit: 'feet' | 'meters'; actualDistance?: number; pixelDistance?: number; scale?: number }[];
  roofAreas: (SnapshotScope & { id: string; name: string; points: Point[]; pitch?: number; visible?: boolean })[];
  components: SnapshotComponent[];
  componentMeasurements: { componentId: string; measurements: SnapshotMeasurement[] }[];
  /** Explicit registry meaning. Exact generic names remain a legacy fallback.
   * Never infer a roof type from colour, a UUID or an arbitrary name substring. */
  semanticByComponentId?: Record<string, BoundaryMeaning>;
  selectedOutlineIds?: string[];
}
export const SEMANTIC_NAMES: Record<string, EdgeKind> = {
  ridge: 'ridge', ridges: 'ridge', hip: 'hip', hips: 'hip', valley: 'valley', valleys: 'valley',
  brokenhip: 'broken_hip', brokenhips: 'broken_hip', barge: 'barge', barges: 'barge',
  spouting: 'spouting', eave: 'spouting', eaves: 'spouting', uncertain: 'unknown', unknown: 'unknown',
};
export const BOUNDARY_MEANINGS: readonly BoundaryMeaning[] = ['ridge','hip','valley','broken_hip','barge','spouting','unknown','ignore'];
export function isBoundaryMeaning(value: unknown): value is BoundaryMeaning {
  return typeof value === 'string' && (BOUNDARY_MEANINGS as readonly string[]).includes(value);
}
export interface InputAuditLine {
  measurementId: string; componentId: string; componentName: string;
  measurementType: string; source: string; visible: boolean;
  pageId: string | null; areaScopeId: string | null;
  semanticType: BoundaryMeaning; semanticBasis: 'measurement'|'explicit-map'|'component'|'exact-name'|'unmapped';
  points: Point[]; included: boolean; reason: string; topologyEdgeIds: string[];
}
export interface InputAudit {
  schemaVersion: 1;
  scope: { quoteId: string; pageId: string; areaScopeId: string | null };
  outlines: { id: string; included: boolean; reason: string; pointCount: number }[];
  lines: InputAuditLine[];
  counts: { componentGroups: number; measurementRows: number; includedLines: number; includedEdges: number; excludedRows: number; unmappedLines: number; bySemantic: Record<EdgeKind, number> };
  unresolvedComponents: { componentId: string; name: string; lineCount: number }[];
}
export interface AdaptedTakeoff { roof: RoofInput; issues: Issue[]; audit: InputAudit }
function meaning(s: QuoteCoreSnapshot, component: SnapshotComponent | undefined, m: SnapshotMeasurement, componentId: string): Pick<InputAuditLine,'semanticType'|'semanticBasis'> {
  if (m.semanticType !== undefined) {
    if (!isBoundaryMeaning(m.semanticType)) throw new Error(`Unknown explicit roof type for measurement ${m.id}.`);
    return { semanticType: m.semanticType, semanticBasis: 'measurement' };
  }
  const mapped = s.semanticByComponentId && Object.hasOwn(s.semanticByComponentId,componentId) ? s.semanticByComponentId[componentId] : undefined;
  if (mapped !== undefined) {
    if (!isBoundaryMeaning(mapped)) throw new Error(`Unknown explicit roof type for component ${componentId}.`);
    return { semanticType: mapped, semanticBasis: 'explicit-map' };
  }
  if (component?.semanticType !== undefined) {
    if (!isBoundaryMeaning(component.semanticType)) throw new Error(`Unknown explicit roof type for component ${componentId}.`);
    return { semanticType: component.semanticType, semanticBasis: 'component' };
  }
  const key = component?.name.toLowerCase().replace(/[\s_-]+/g, '') ?? '';
  const kind = Object.hasOwn(SEMANTIC_NAMES, key) ? SEMANTIC_NAMES[key] : undefined;
  return kind ? { semanticType: kind, semanticBasis: 'exact-name' } : { semanticType: 'unknown', semanticBasis: 'unmapped' };
}
/** Unzoomed scene coordinates and the CURRENT calibration references only.
 * Measurement totals (which can already include pitch) are never used here. */
export function calibrationMmPerSceneUnit(cals: QuoteCoreSnapshot['calibrations']): number {
  if (!cals.length) return 0;
  if (cals.length > 3) throw new Error('QuoteCore calibration supports at most three accepted references.');
  const scales = cals.map(c => {
    if (!['feet','meters'].includes(c.unit)) throw new Error(`Unknown calibration unit for ${c.id}.`);
    const sceneDistance = distance(c.point1, c.point2);
    const refPx = c.pixelDistance && c.pixelDistance > 0 ? c.pixelDistance : sceneDistance;
    const real = c.actualDistance && c.actualDistance > 0 ? c.actualDistance : (c.scale ?? 0) * refPx;
    if (!Number.isFinite(real) || real <= 0 || !Number.isFinite(sceneDistance) || sceneDistance <= 0) throw new Error(`Invalid calibration reference ${c.id}.`);
    return real * (c.unit === 'feet' ? 304.8 : 1000) / sceneDistance;
  });
  return scales.reduce((a, b) => a + b, 0) / scales.length;
}
export function fromQuoteCore(s: QuoteCoreSnapshot): AdaptedTakeoff {
  if (!s.quoteId || !s.pageId) throw new Error('Quote and page IDs are required. Measurements do not need to have been saved.');
  if (![s.width, s.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('Active scene dimensions are missing.');
  const issues: Issue[] = [], bySemantic: Record<EdgeKind, number> = {ridge:0,hip:0,valley:0,broken_hip:0,barge:0,spouting:0,unknown:0};
  const excludeScope = (m: SnapshotScope): string | undefined => {
    if (m.fromPageId && m.fromPageId !== s.pageId) return 'different-page';
    if (s.areaScopeId && m.quoteRoofAreaId && m.quoteRoofAreaId !== s.areaScopeId) return 'different-estimating-area';
    return undefined; // Unstamped legacy/new rows belong to the current live scope.
  };
  const audit: InputAudit = {schemaVersion:1,scope:{quoteId:s.quoteId,pageId:s.pageId,areaScopeId:s.areaScopeId},outlines:[],lines:[],
    counts:{componentGroups:s.componentMeasurements.length,measurementRows:0,includedLines:0,includedEdges:0,excludedRows:0,unmappedLines:0,bySemantic},unresolvedComponents:[]};
  const outlines: RoofInput['outlines'] = [], outlineIds = new Set<string>();
  for (const a of s.roofAreas) {
    const reason = excludeScope(a) ?? (a.visible === false ? 'hidden' : s.selectedOutlineIds && !s.selectedOutlineIds.includes(a.id) ? 'not-selected' : 'included');
    audit.outlines.push({id:a.id,included:reason==='included',reason,pointCount:a.points?.length??0});
    if (reason !== 'included') continue;
    if (!a.id || outlineIds.has(a.id)) throw new Error('Duplicate or missing live outline ID. Finish the current edit and try again.');
    outlineIds.add(a.id);
    if (!Array.isArray(a.points) || a.points.some(p => !p || ![p.x,p.y].every(Number.isFinite))) throw new Error(`Invalid outline coordinates on ${a.id}.`);
    outlines.push({id:a.id,name:a.name,polygon:cleanRing(a.points.map(p=>({...p}))),suggestedPitchDeg:Number.isFinite(a.pitch)?a.pitch:undefined});
  }
  const components = new Map(s.components.map(c=>[c.id,c])), edges: RoofInput['edges'] = [], ids = new Set<string>();
  const unresolved = new Map<string,{componentId:string;name:string;lineCount:number}>();
  for (const group of s.componentMeasurements) {
    const c = components.get(group.componentId), name = c?.name ?? group.componentId;
    for (const m of group.measurements) {
      const resolved = meaning(s,c,m,group.componentId);
      const row: InputAuditLine = {measurementId:m.id,componentId:group.componentId,componentName:name,measurementType:m.type,
        source:m.source??(m.aiOrigin===true?'ai':m.aiOrigin===false?'manual':'unspecified'),visible:m.visible!==false,
        pageId:m.fromPageId??null,areaScopeId:m.quoteRoofAreaId??null,...resolved,points:(m.points??[]).map(p=>({...p})),included:false,reason:'',topologyEdgeIds:[]};
      audit.lines.push(row);audit.counts.measurementRows++;
      row.reason = excludeScope(m) ?? (m.visible===false?'hidden':!isPlanLineMeasurement(m)?'not-plan-line':resolved.semanticType==='ignore'?'explicitly-not-roof-boundary':!m.points||m.points.length<2?'incomplete-points':'included');
      if(row.reason!=='included') {
        audit.counts.excludedRows++;
        if(row.reason==='incomplete-points')issues.push({severity:'error',code:'INCOMPLETE_LIVE_LINE',objectId:m.id,message:`Finish or remove the incomplete line in “${name}”, then reopen Find offcuts.`});
        continue;
      }
      if(!m.id||ids.has(m.id))throw new Error(`Duplicate or missing measurement ID ${m.id}. Finish the current edit and try again.`);
      ids.add(m.id);
      const kind=resolved.semanticType as EdgeKind;
      for(let i=0;i<m.points!.length-1;i++) {
        const a=m.points![i],b=m.points![i+1];
        if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))throw new Error(`Invalid line coordinates on ${m.id}.`);
        // Degenerate points must not become phantom topology edges.
        if(distance(a,b)<=1e-9)continue;
        const id=`${m.id}:${i}`;edges.push({id,a:{...a},b:{...b},kind});row.topologyEdgeIds.push(id);bySemantic[kind]++;
      }
      row.included=row.topologyEdgeIds.length>0;
      if(!row.included){row.reason='zero-length';audit.counts.excludedRows++;continue;}
      audit.counts.includedLines++;audit.counts.includedEdges+=row.topologyEdgeIds.length;
      if(resolved.semanticBasis==='unmapped') {
        audit.counts.unmappedLines++;
        const u=unresolved.get(group.componentId)??{componentId:group.componentId,name,lineCount:0};u.lineCount++;unresolved.set(group.componentId,u);
      }
    }
  }
  audit.unresolvedComponents=[...unresolved.values()];
  for(const u of audit.unresolvedComponents)issues.push({severity:'warning',code:'UNMAPPED_COMPONENT',objectId:u.componentId,
    message:`${u.name}: ${u.lineCount} line(s) retained as roof boundaries. Choose their roof type to identify cuts correctly, or mark them as not a roof boundary.`});
  const roof: RoofInput = { schemaVersion: 1, quoteId: s.quoteId, pageId: s.pageId, areaScopeId: s.areaScopeId,
    imageRevision: s.imageRevision, imageUrl: s.imageUrl, sceneWidth: s.width, sceneHeight: s.height,
    mmPerSceneUnit: calibrationMmPerSceneUnit(s.calibrations), calibrationConfirmed: s.calibrationConfirmed,
    outlines, edges, sourceRevision: '' };
  roof.sourceRevision = roofRevision(roof);
  return { roof, issues, audit };
}
export function roofRevision(roof: RoofInput): string {
  const { imageUrl: _url, sourceRevision: _revision, ...content } = roof;
  return fingerprint(content);
}
