import { planningBoundary } from './directions';
import type { Demand, MaterialBank, RoofFace, RoofInput, SolveRequest } from './types';
import { dot, EPS } from './math';
import { frameFor, sceneToSurface, sheetCount } from './material';

export type Interval = [number, number];

/** Union, never sum overlapping projections. Plan steps do not buy metal twice. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [a, b] of intervals.filter(([a,b]) => b-a>EPS).sort((a,b)=>a[0]-b[0])) {
    const last = result[result.length - 1];
    if (last && a <= last[1]+EPS) last[1] = Math.max(last[1], b);
    else result.push([a,b]);
  }
  return result;
}
export function intervalOverlap(intervals: Interval[], a: number, b: number): number {
  return mergeIntervals(intervals).reduce((n,[l,r])=>n+Math.max(0,Math.min(r,b)-Math.max(l,a)),0);
}
export function edgeIntervals(face: RoofFace, roof: RoofInput, kind: 'ridge' | 'spouting'): Interval[] {
  const frame = frameFor(face,roof);
  return mergeIntervals(planningBoundary(face).filter(e=>e.kind===kind).map(e=>{
    const a=sceneToSurface(e.a,frame).x,b=sceneToSurface(e.b,frame).x;
    return [Math.min(a,b),Math.max(a,b)];
  }));
}
export interface FaceSpan {
  projectedSpanMm: number;
  eaveSpanMm: number;
  ridgeSpanMm: number;
  minimumPositions: number;
  registeredPositions: number;
}
export function faceSpan(face: RoofFace, request: SolveRequest, phase = face.laneOffsetMm): FaceSpan {
  const frame=frameFor(face,request.roof),xs=face.polygon.map(p=>sceneToSurface(p,frame).x);
  const projectedSpanMm=Math.max(...xs)-Math.min(...xs);
  const length=(intervals:Interval[])=>intervals.reduce((n,[a,b])=>n+b-a,0);
  return {projectedSpanMm,eaveSpanMm:length(edgeIntervals(face,request.roof,'spouting')),
    ridgeSpanMm:length(edgeIntervals(face,request.roof,'ridge')),
    minimumPositions:sheetCount(projectedSpanMm,request.profile.coverMm),
    registeredPositions:sheetCount(projectedSpanMm,request.profile.coverMm,phase)};
}
export interface BankProjection {
  bankId: string; spanMm: number; eaveSpanMm: number; anchorFaceIds: string[];
  /** Minimum cover cells of the PROJECTED elevation; NOT an order quantity. */
  minimumColumns: number;
  footprintIntervals: Interval[]; eaveIntervals: Interval[];
}
export function projectBank(bank: MaterialBank, request: SolveRequest): BankProjection {
  const u={x:bank.flow.y,y:-bank.flow.x},scale=request.roof.mmPerSceneUnit;
  const members=bankAnchorFaces(request.faces.filter(f=>bank.faceIds.includes(f.id)),request.roof);
  const footprintIntervals=mergeIntervals(members.map(f=>{
    const xs=f.polygon.map(p=>dot(p,u)*scale);return [Math.min(...xs),Math.max(...xs)];
  }));
  const eaveFaces=request.faces.filter(f=>bank.faceIds.includes(f.id)&&f.boundary.some(e=>e.kind==='hip')&&!isSelfFillCandidate(f,request.roof));
  // Receiving projections can complete the elevation's spouting span without
  // becoming additional new-stock anchors (C + E still spans the same width).
  const eaveIntervals=mergeIntervals((eaveFaces.length?eaveFaces:members).flatMap(f=>planningBoundary(f).filter(e=>e.kind==='spouting').map(e=>{
    const a=dot(e.a,u)*scale,b=dot(e.b,u)*scale;return [Math.min(a,b),Math.max(a,b)] as Interval;
  })));
  const spanMm=footprintIntervals.reduce((n,[a,b])=>n+b-a,0);
  return {bankId:bank.id,anchorFaceIds:members.map(f=>f.id),spanMm,eaveSpanMm:eaveIntervals.reduce((n,[a,b])=>n+b-a,0),
    minimumColumns:footprintIntervals.reduce((n,[a,b])=>n+sheetCount(b-a,request.profile.coverMm),0),
    footprintIntervals,eaveIntervals};
}

/** Small valley-only receiving faces and independent self-fill strips do not
 * extend a major cutting bank's registration origin. Their actual sheet demand
 * is still generated separately and must be supplied in full. This is a supply
 * anchor selection, never removal of approved roof geometry. */
export function bankAnchorFaces(members: RoofFace[], roof: RoofInput): RoofFace[] {
  const main=members.filter(f=>f.boundary.some(e=>e.kind==='hip')&&!isSelfFillCandidate(f,roof));
  if(!main.length)return members;
  // A small hip receiver wholly inside a larger same-direction projection is
  // a destination, not another purchasing anchor (the C valley -> E case).
  // A/J both extend the elevation envelope, so neither is removed. This changes
  // supply grouping only; EVERY approved face still has real physical demand.
  const span=(f:RoofFace)=>{const u=frameFor(f,roof).u,x=f.polygon.map(p=>dot(p,u)*roof.mmPerSceneUnit);return [Math.min(...x),Math.max(...x)];};
  const anchors=main.filter(f=>{const [a,b]=span(f);return !main.some(g=>{
    if(g===f)return false;const [c,d]=span(g);
    return d-c>(b-a)*1.02&&c<=a+.01&&d>=b-.01;
  });});
  return anchors.length?anchors:main;
}

/** A hip end and a parallel valley/broken hip enclose a shifted strip. The
 * direction tolerance detects a candidate only: exact material fitting below
 * still rejects short pieces. Eave length, not the full polygon width, seeds
 * the new donor run. Ordinary two-hip/two-valley main faces are NOT self-fill. */
export function isSelfFillCandidate(face: RoofFace, roof: RoofInput): boolean {
  if (!face.flow || face.pitchDeg===null) return false;
  if (edgeIntervals(face,roof,'spouting').length!==1) return false;
  // A barge-ended parallel hip/valley strip can self-fill without a ridge.
  // The exact donor-window/fit test below still decides whether it actually can.
  const frame=frameFor(face,roof);
  const edges=face.boundary.filter(e=>['hip','valley','broken_hip'].includes(e.kind));
  if(edges.length<2 || !edges.some(e=>e.kind==='hip') || !edges.some(e=>e.kind==='valley'||e.kind==='broken_hip'))return false;
  const angles=edges.map(e=>{
    const a=sceneToSurface(e.a,frame),b=sceneToSurface(e.b,frame);
    let dx=b.x-a.x,dy=(b.y-a.y)*frame.pitchCos;
    if(dx<0){dx=-dx;dy=-dy;}return Math.atan2(dy,dx);
  });
  return angles.every(a=>Math.abs(a)>Math.PI/18 && Math.abs(a)<Math.PI*.48) &&
    Math.max(...angles)-Math.min(...angles)<6*Math.PI/180;
}

/** Minimal eave-bearing donor lanes plus a real transition lane when the last
 * cover leaves less than the requested margin. Never buys a fraction or invents
 * an off-roof sheet. Every added lane belongs to the approved face. */
export function selfFillDonorWindows(demands: Demand[], face: RoofFace, request: SolveRequest): Set<string>[] {
  const eaves=edgeIntervals(face,request.roof,'spouting');
  if(eaves.length!==1)return [];
  const [a,b]=eaves[0], w=request.profile.coverMm;
  const rows=[...demands].sort((x,y)=>x.laneIndex-y.laneIndex);
  const eaveRows=rows.filter(d=>intervalOverlap(eaves,d.origin.x+request.profile.leftLapMm,d.origin.x+request.profile.leftLapMm+w)>EPS);
  if(!eaveRows.length)return [];
  const first=rows.indexOf(eaveRows[0]),last=rows.indexOf(eaveRows[eaveRows.length-1]);
  const valleySide = first>0 ? -1 : 1;
  const spare = valleySide<0 ? a-(rows[first].origin.x+request.profile.leftLapMm)
    : rows[last].origin.x+request.profile.leftLapMm+w-b;
  const margin=Math.min(w,request.settings.selfFillTransitionMm??100);
  const guard=spare+EPS<margin?1:0;
  const windows:Set<string>[]=[];
  // More than the minimum may be required by actual cut clearance, rounding,
  // imperfect angles or lap registration. Try the next two real valley lanes.
  for(let extra=guard;extra<=guard+2;extra++){
    const l=valleySide<0?Math.max(0,first-extra):first;
    const r=valleySide>0?Math.min(rows.length-1,last+extra):last;
    windows.push(new Set(rows.slice(l,r+1).map(d=>d.id)));
  }
  return windows;
}
