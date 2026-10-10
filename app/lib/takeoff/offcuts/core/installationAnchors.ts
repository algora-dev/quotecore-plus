/** Optional geometric setout. Fixes cover boundaries, never roof vertices or
 * profile handedness. Setting out both ways is not permission to mirror laps. */
import type { BankLayout, Issue, Point, Profile, RoofFace, RoofInput, SolveRequest } from './types';
import { planningBoundary } from './directions';
import { frameFor, sceneToSurface } from './material';
import { fingerprint } from './math';
export const INSTALLATION_SETOUT_MODEL='installation-setout-v1' as const;
export interface InstallationAnchor {
  id:string;faceId:string;kind:'hip-ridge-junction'|'barge-end';point:Point;edgeIds:string[];phaseMm:number;
  setout:'both-sides'|'positive-u'|'negative-u';
}
export interface InstallationSetout {
  model:typeof INSTALLATION_SETOUT_MODEL;anchors:InstallationAnchor[];measuredFillerFaceIds:string[];
}
export const coverPhase=(n:number,w:number):number=>{const r=((n%w)+w)%w;return r<1e-6||w-r<1e-6?0:r;};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function anchorPhase(face:RoofFace,roof:RoofInput,p:Point,coverMm:number):number {
  const f=frameFor(face,roof),xs=face.polygon.map(v=>sceneToSurface(v,f).x);
  return coverPhase(Math.min(...xs)-sceneToSurface(p,f).x,coverMm);
}
export function installationAnchors(face:RoofFace,roof:RoofInput,profile:Profile):InstallationAnchor[] {
  if(!face.flow||face.pitchDeg===null)return [];
  const edges=planningBoundary(face),f=frameFor(face,roof),xs=face.polygon.map(p=>sceneToSurface(p,f).x),lo=Math.min(...xs),hi=Math.max(...xs);
  const out:InstallationAnchor[]=[];
  function add(kind:InstallationAnchor['kind'],p:Point,edgeIds:string[],setout:InstallationAnchor['setout']){
    const phaseMm=anchorPhase(face,roof,p,profile.coverMm),d=Math.abs(phaseMm-face.laneOffsetMm);
    if(face.laneOffsetLocked&&Math.min(d,profile.coverMm-d)>.01)return;
    if(kind==='hip-ridge-junction'&&edges.some(e=>e.kind==='valley'&&(dist(e.a,p)<1e-5||dist(e.b,p)<1e-5)))return;
    const row={faceId:face.id,kind,point:{...p},edgeIds:[...edgeIds].sort(),phaseMm,setout};
    const id='anchor:'+fingerprint(row);if(!out.some(a=>a.id===id))out.push({id,...row});
  }
  for(const hip of edges.filter(e=>e.kind==='hip'||e.kind==='broken_hip'))for(const ridge of edges.filter(e=>e.kind==='ridge'))for(const p of [hip.a,hip.b]){
    const x=sceneToSurface(p,f).x;
    if((dist(p,ridge.a)<1e-5||dist(p,ridge.b)<1e-5)&&x>lo+profile.coverMm*.1&&x<hi-profile.coverMm*.1)add('hip-ridge-junction',p,[hip.id,ridge.id],'both-sides');
  }
  for(const e of edges.filter(e=>e.kind==='barge')){
    const a=sceneToSurface(e.a,f),b=sceneToSurface(e.b,f),mid=(a.x+b.x)/2;
    if(Math.min(Math.abs(mid-lo),Math.abs(mid-hi))>profile.coverMm*.15)continue;
    const side=Math.abs(mid-lo)<=Math.abs(mid-hi)?'positive-u':'negative-u';
    add('barge-end',side==='positive-u'?(a.x<=b.x?e.a:e.b):(a.x>=b.x?e.a:e.b),[e.id],side);
  }
  return out.sort((a,b)=>a.kind.localeCompare(b.kind)||sceneToSurface(a.point,f).x-sceneToSurface(b.point,f).x);
}
export function validateInstallationSetout(r:Pick<SolveRequest,'roof'|'faces'|'profile'>,layout:BankLayout):Issue[] {
  const q=layout.installationSetout;if(!q)return [];
  const errors:Issue[]=[];const bad=(message:string,faceId?:string)=>errors.push({severity:'error',code:'INSTALLATION_SETOUT',message,faceId});
  if(q.model!==INSTALLATION_SETOUT_MODEL||!Array.isArray(q.anchors)||q.anchors.length>r.faces.length||!Array.isArray(q.measuredFillerFaceIds)){bad('Invalid installation setout.');return errors;}
  const ids=new Set<string>();
  for(const a of q.anchors){
    const f=r.faces.find(f=>f.id===a.faceId);if(!f||ids.has(a.faceId)){bad('An anchor must refer once to a reviewed face.');continue;}ids.add(a.faceId);
    const actual=installationAnchors(f,r.roof,r.profile).find(x=>x.id===a.id);
    if(!actual||fingerprint(a)!==fingerprint(actual)||Math.abs(layout.laneOffsetByFace[f.id]-a.phaseMm)>.01)bad('Anchor no longer matches its geometry or sheet registration.',f.id);
  }
  if(new Set(q.measuredFillerFaceIds).size!==q.measuredFillerFaceIds.length||q.measuredFillerFaceIds.some(id=>!layout.primaryFaceIds.includes(id)||!q.anchors.some(a=>a.faceId===id&&a.kind==='hip-ridge-junction')))bad('Measured straight shelves require an anchored primary donor.');
  return errors;
}
