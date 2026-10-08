/** V2.18: square-end stock envelope. No roof/face names, matching score or area
 * target enters this rule. The same physical sheet and ALL its generated cuts
 * must remain, including nominally unused pieces needed by phase certificates.
 * The cut factory is injected to keep this module independent of material.ts. */
import type { Demand, Offcut, Profile, Region } from './types';
import { area, bounds, rectangle, subtract } from './regions';

export const STOCK_END_MODEL = 'preserve-cut-ends-v1' as const;
export const STOCK_END_POLICY = Object.freeze({model: STOCK_END_MODEL, minShorteningMm: 10, maxMilliseconds: 5000});
export interface StockEndProof {
  model: typeof STOCK_END_MODEL;
  originalBlank: Region;
  upstreamAllowanceMm: number;
  downstreamAllowanceMm: number;
  upstreamRemovedMm: number;
  downstreamRemovedMm: number;
  /** IDs are derived from the original cutting geometry, not display colours. */
  preservedOffcutIds: string[];
  usefulUpstreamCutIds: string[];
  usefulDownstreamCutIds: string[];
}
export type CutFactory = (d: Demand, p: Profile) => Offcut[];
const tol = 1e-6;
/** Exact, key-order-independent equality for metadata, not a lossy checksum. */
function canonical(v:unknown):string {
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
  return JSON.stringify(v)??'undefined';
}
export const sameStockData=(a:unknown,b:unknown):boolean=>canonical(a)===canonical(b);
/** Identity + full polygons, not equal areas or matching bounding rectangles. */
export function samePhysicalCuts(a: Offcut[], b: Offcut[]): boolean {
  if(a.length!==b.length || new Set(a.map(o=>o.id)).size!==a.length || new Set(b.map(o=>o.id)).size!==b.length)return false;
  const bm=new Map(b.map(o=>[o.id,o]));
  return a.every(o=>{
    const other=bm.get(o.id);if(!other)return false;
    const {region:ar,...am}=o,{region:br,...meta}=other;
    if(!sameStockData(am,meta))return false;
    // Symmetric difference catches an altered triangle even if its area stays equal.
    return area(subtract(ar,br))+area(subtract(br,ar))<=.001;
  });
}
export function originalStockDemand(d: Demand): Demand {
  if(!d.stockEndProof)return d;
  const {stockEndProof,...rest}=d;
  return {...rest,blank:structuredClone(stockEndProof.originalBlank)};
}
/** Choose a shorter rectangle only at a SQUARE/stepped-square end. Genuine upper
 * and lower slopes are not normalised lane-by-lane. All angled offcut polygons
 * and their IDs must survive unchanged, so their coherent family cannot zigzag.
 * required already contains profile end allowance; bank allowances are additional.
 * Rounding extends the retained rectangle, never rounds demand down. */
export function proposeStockEnds(d: Demand, p: Profile, upstream: number, downstream: number, cuts: CutFactory): Demand | null {
  if(d.stockEndProof || !d.cutEdges || !d.required.length || d.blank.length!==1)return null;
  if(![upstream,downstream,p.lengthIncrementMm,d.widthMm].every(Number.isFinite)||upstream<0||downstream<0||p.lengthIncrementMm<=0)return null;
  const b=bounds(d.blank),r=bounds(d.required),oldLength=b.maxY-b.minY;
  if(Math.abs(b.minX)>tol||Math.abs(b.maxX-d.widthMm)>tol||oldLength<=0||area(subtract(d.required,d.blank))>.001)return null;
  if(area(subtract(rectangle(b.minX,b.minY,b.maxX,b.maxY),d.blank))>.001)return null;
  const oldCuts=cuts(d,p);
  const topSquare=d.required.every(v=>Math.abs(v.top1-v.top0)<=tol);
  const bottomSquare=d.required.every(v=>Math.abs(v.bottom1-v.bottom0)<=tol);
  // Retain all real cuts, not merely today's consumed descendants. In particular
  // an entire productive hip family still shares its original stock-end datum.
  const cutMin=Math.min(Infinity,...oldCuts.map(o=>bounds(o.region).minY));
  const cutMax=Math.max(-Infinity,...oldCuts.map(o=>bounds(o.region).maxY));
  const top=topSquare?Math.max(b.minY,Math.min(r.minY-upstream,cutMin)):b.minY;
  const bottom=bottomSquare?Math.min(b.maxY,Math.max(r.maxY+downstream,cutMax)):b.maxY;
  const ceilLength=(x:number)=>Math.ceil(x/p.lengthIncrementMm-1e-10)*p.lengthIncrementMm;
  // Try both safe ends together, then each end. The latter handles an inventory
  // component-ID change on one side without sacrificing a safe opposite-end trim.
  const options:[number,number][]=[];
  if(top-b.minY>=STOCK_END_POLICY.minShorteningMm&&b.maxY-bottom>=STOCK_END_POLICY.minShorteningMm)options.push([bottom-ceilLength(bottom-top),bottom]);
  if(top-b.minY>=STOCK_END_POLICY.minShorteningMm)options.push([b.maxY-ceilLength(b.maxY-top),b.maxY]);
  if(b.maxY-bottom>=STOCK_END_POLICY.minShorteningMm)options.push([b.minY,b.minY+ceilLength(bottom-b.minY)]);
  options.sort((a,z)=>(a[1]-a[0])-(z[1]-z[0]));
  for(const [minY,maxY]of options){
    if(minY<b.minY-tol||maxY>b.maxY+tol||oldLength-(maxY-minY)<STOCK_END_POLICY.minShorteningMm-tol)continue;
    const blank=rectangle(0,minY,d.widthMm,maxY),candidate={...d,blank};
    if(!blank.length||maxY-minY>p.maxLengthMm+tol||area(subtract(d.required,blank))>.001)continue;
    if(minY>b.minY+tol&&r.minY-minY<upstream-tol||maxY<b.maxY-tol&&maxY-r.maxY<downstream-tol)continue;
    if(!samePhysicalCuts(oldCuts,cuts(candidate,p)))continue;
    return {...candidate,stockEndProof:{model:STOCK_END_MODEL,originalBlank:structuredClone(d.blank),
      upstreamAllowanceMm:upstream,downstreamAllowanceMm:downstream,
      upstreamRemovedMm:Math.max(0,minY-b.minY),downstreamRemovedMm:Math.max(0,b.maxY-maxY),
      preservedOffcutIds:oldCuts.map(o=>o.id),
      usefulUpstreamCutIds:oldCuts.filter(o=>o.cutSetId?.includes(':upper:')).map(o=>o.id),
      usefulDownstreamCutIds:oldCuts.filter(o=>o.cutSetId?.includes(':lower:')).map(o=>o.id)}};
  }
  return null;
}
