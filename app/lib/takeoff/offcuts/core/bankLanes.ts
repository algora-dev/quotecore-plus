/** V2.13: physical coverage is decided BEFORE stock sourcing.
 * A shared cross-slope interval is one sheet column, even when several reviewed
 * polygons consume separate parts of its parent. No image sampling is used.
 */
import type { Demand, MaterialBank, Point, RoofFace, RoofInput, Solution, SolveRequest } from './types';
import { dot, EPS } from './math';
import { supplyView } from './supply';
import { bounds } from './regions';
import { frameFor, sceneToSurface, sheetCount } from './material';
import { planningBoundary } from './directions';

export interface CoverStationPlan {
  bankId: string;
  /** Member-axis registry aligns setout numbers without changing approved face axes. */
  basis?: 'member-axis-v1';
  faceIds: string[];
  coverMm: number;
  spanMm: number;
  minimumColumns: number;
  columns: number;
  crossStartMm: number;
  crossEndMm: number;
  /** Every value is a full cover apart; the last may exceed the actual end. */
  stationsMm: number[];
  phaseMm: number;
  origin: 'hip-end' | 'opposite-hip-end' | 'explicit-registration';
  offsetByFace: Record<string, number>;
}

export function coverRemainder(value: number, cover: number): number {
  const r = ((value % cover) + cover) % cover;
  return r < 1e-7 || cover-r < 1e-7 ? 0 : r;
}

/** End-anchored grids have exactly ceil(span/cover) columns. An explicit manual
 * registration may require one more and is never rounded down to hide it. */
export function coverStations(bank: MaterialBank, members: RoofFace[], request: SolveRequest,
  anchor: 'start' | 'end' = 'start', explicitPhaseMm?: number, memberAxes = false): CoverStationPlan {
  if(!members.length)throw new Error('A physical bank needs at least one reviewed face.');
  const u = frameFor(members[0],request.roof).u, w = request.profile.coverMm;
  const xs = members.flatMap(f => f.polygon.map(p => dot(p,memberAxes?frameFor(f,request.roof).u:u)*request.roof.mmPerSceneUnit));
  const lo = Math.min(...xs), hi = Math.max(...xs), span = hi-lo;
  const minimumColumns = sheetCount(span,w);
  const phase = explicitPhaseMm ?? (anchor==='end' ? minimumColumns*w-span : 0);
  const columns = sheetCount(span,w,Math.max(0,phase));
  const start = lo-phase;
  return {
    ...(memberAxes?{basis:'member-axis-v1' as const}:{}), bankId: bank.id, faceIds: members.map(f=>f.id), coverMm:w, spanMm:span,
    minimumColumns, columns, crossStartMm:start, crossEndMm:start+columns*w,
    stationsMm:Array.from({length:columns+1},(_,i)=>start+i*w), phaseMm:phase,
    origin:explicitPhaseMm!==undefined?'explicit-registration':anchor==='end'?'opposite-hip-end':'hip-end',
    offsetByFace:Object.fromEntries(members.map(f=>{
      const fx = Math.min(...f.polygon.map(p=>dot(p,memberAxes?frameFor(f,request.roof).u:u)*request.roof.mmPerSceneUnit));
      return [f.id,coverRemainder(fx-start,w)];
    })),
  };
}

/** Lower ridge spacers are reserved by interval intersection, including the
 * boundary-crossing sheets, NOT by counting only square interior pieces.
 * A ridge at the controlling height is part of the main bank, not a spacer. */
export function ridgeSpacerDemandIds(face:RoofFace, roof:RoofInput, demands:Demand[], controllingLengthMm?:number):Set<string> {
  const frame = frameFor(face,roof);
  const pts = face.polygon.map(p=>sceneToSurface(p,frame));
  const minY = Math.min(...pts.map(p=>p.y)), maxY = Math.max(...pts.map(p=>p.y));
  const controlling = controllingLengthMm ?? maxY-minY;
  const minimumStep = Math.max(50,controlling*.02);
  const intervals = planningBoundary(face).filter(e=>e.kind==='ridge').map(e=>{
    const a = sceneToSurface(e.a,frame),b = sceneToSurface(e.b,frame);
    return {lo:Math.min(a.x,b.x),hi:Math.max(a.x,b.x),length:maxY-(a.y+b.y)/2};
  }).filter(r=>controlling-r.length>minimumStep);
  return new Set(demands.filter(d=>intervals.some(r=>{
    // Effective cover footprint, not the width including optional physical laps.
    const xs=d.cover.flatMap(b=>[b.x0+d.origin.x,b.x1+d.origin.x]);
    return Math.min(Math.max(...xs),r.hi)-Math.max(Math.min(...xs),r.lo)>EPS;
  })).map(d=>d.id));
}

export interface BankLaneAudit {
  operationId:string; faceIds:string[]; invalidReason?:string; spanMm:number; effectiveCoverMm:number;
  minimumColumns:number; registeredColumns:number; newRoots:number;
  duplicateColumns:{column:number;rootDemandIds:string[]}[];
  columns:{index:number;rootDemandIds:string[];demandIds:string[]}[];
}
/** Diagnostic with an independently derived cross coordinate. A shared label
 * alone never proves a shared purchase. The validator can check physical roots. */
export function bankLaneAudit(solution:Solution):BankLaneAudit[] {
  const fresh=new Set(solution.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  return (solution.bankLayout?.primaryOperations??[]).filter(op=>op.coverStations).map(op=>{
    const grid=op.coverStations!;
    const memberDemands=solution.demands.filter(d=>op.faceIds.includes(d.faceId));
    const actualCross=memberDemands.flatMap(d=>d.cover.flatMap(b=>[b.x0,b.x1].map(x=>dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x+x)));
    const lo=Math.min(...actualCross),hi=Math.max(...actualCross);
    const numeric=[grid.columns,grid.minimumColumns,grid.coverMm,grid.spanMm,grid.crossStartMm,grid.crossEndMm,grid.phaseMm];
    const invalid= (grid.basis!==undefined&&grid.basis!=='member-axis-v1')||!numeric.every(Number.isFinite)||!Number.isInteger(grid.columns)||grid.columns<1||grid.columns>10000||
      !Number.isInteger(grid.minimumColumns)||grid.coverMm<=0||grid.phaseMm<0||grid.phaseMm>=grid.coverMm||
      Math.abs(grid.coverMm-solution.profile.coverMm)>1e-5||!Array.isArray(grid.stationsMm)||grid.stationsMm.length!==grid.columns+1||
      grid.stationsMm.some((x,i)=>!Number.isFinite(x)||Math.abs(x-grid.crossStartMm-i*grid.coverMm)>.001)||
      Math.abs(grid.spanMm-(hi-lo))>.001||Math.abs(grid.crossStartMm-(lo-grid.phaseMm))>.001||
      grid.minimumColumns!==Math.ceil((grid.spanMm-1e-7)/grid.coverMm)||
      grid.columns!==Math.ceil((grid.spanMm+grid.phaseMm-1e-7)/grid.coverMm)||
      Math.abs(grid.crossEndMm-grid.crossStartMm-grid.columns*grid.coverMm)>.001;
    const unregistered=grid.basis==='member-axis-v1'&&memberDemands.some(d=>{const x=dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x+solution.profile.leftLapMm,k=Math.round((x-grid.crossStartMm)/grid.coverMm);return k<0||k>=grid.columns||Math.abs(x-grid.crossStartMm-k*grid.coverMm)>.001;});
    if(invalid||unregistered)return{operationId:op.id,faceIds:op.faceIds,invalidReason:'Cover stations do not match the actual bank span and cover.',spanMm:grid.spanMm,effectiveCoverMm:grid.coverMm,minimumColumns:grid.minimumColumns,registeredColumns:grid.columns,newRoots:0,duplicateColumns:[],columns:[]};
    const columns=Array.from({length:grid.columns},(_,index)=>({index,rootDemandIds:[] as string[],demandIds:[] as string[]}));
    for(const d of memberDemands){
      const x=dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x+solution.profile.leftLapMm;
      const k=Math.round((x-grid.crossStartMm)/grid.coverMm);
      if(k<0||k>=columns.length)continue;
      columns[k].demandIds.push(d.id);
      if(fresh.has(d.id))columns[k].rootDemandIds.push(d.id);
    }
    return {operationId:op.id,faceIds:op.faceIds,spanMm:grid.spanMm,effectiveCoverMm:grid.coverMm,
      minimumColumns:grid.minimumColumns,registeredColumns:grid.columns,
      newRoots:columns.reduce((n,c)=>n+c.rootDemandIds.length,0),
      duplicateColumns:columns.filter(c=>c.rootDemandIds.length>1).map(c=>({column:c.index,rootDemandIds:c.rootDemandIds})),columns};
  });
}

/** Minimal normal-view setout markers. Only draw on an actual eave segment;
 * no artificial line across a valley notch and no full grid on the roof. */
export function eaveCoverPoints(face:RoofFace,roof:RoofInput,demands:Demand[],coverMm:number,leftLapMm:number):Point[] {
  if(!demands.length)return [];
  const f=frameFor(face,roof), out:Point[]=[];
  const xs=[...new Set(demands.flatMap(d=>[d.origin.x+leftLapMm,d.origin.x+leftLapMm+coverMm]).map(x=>+x.toFixed(5)))];
  for(const e of planningBoundary(face).filter(e=>e.kind==='spouting')){
    const a=sceneToSurface(e.a,f),b=sceneToSurface(e.b,f),dx=b.x-a.x;
    if(Math.abs(dx)<EPS)continue;
    for(const x of xs){const t=(x-a.x)/dx;if(t< -1e-7||t>1+1e-7)continue;
      const p={x:e.a.x+t*(e.b.x-e.a.x),y:e.a.y+t*(e.b.y-e.a.y)};
      if(!out.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-5))out.push(p);
    }
  }
  return out;
}

export interface PurchaseOperationRow {blockId:string;faceIds:string[];role:'bank'|'spacer';lengthMm:number;count:number;linealM:number;rootDemandIds:string[]}
/** The readable purchase schedule is grouped by physical source operation rather
 * than charging each member polygon again. Rows still enumerate actual new roots. */
export function purchaseOperations(s:Solution):PurchaseOperationRow[]{
  const view=supplyView(s),fresh=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  const rows=new Map<string,PurchaseOperationRow>();
  for(const d of s.demands)if(fresh.has(d.id)){
    const blockId=view.blockByRootDemand.get(d.id)??d.faceId;
    const faceIds=view.blocks.find(b=>b.id===blockId)?.faceIds??[d.faceId];
    const role=view.fillerDemandIds.has(d.id)?'spacer' as const:'bank' as const;
    const b=bounds(d.blank),lengthMm=b.maxY-b.minY,key=blockId+'/'+role+'/'+lengthMm.toFixed(4);
    const row=rows.get(key)??{blockId,faceIds,role,lengthMm,count:0,linealM:0,rootDemandIds:[]};
    row.count++;row.linealM+=lengthMm/1000;row.rootDemandIds.push(d.id);rows.set(key,row);
  }
  return [...rows.values()].sort((a,b)=>a.blockId.localeCompare(b.blockId)||b.lengthMm-a.lengthMm);
}
