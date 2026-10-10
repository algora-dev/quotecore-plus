import type { Issue, Solution, SolveRequest } from './types';
import { installationAnchors, validateInstallationSetout } from './installationAnchors';
import { isSelfFillCandidate } from './zones';
import { planningBoundary } from './directions';
import { area, bounds, subtract } from './regions';
import { materialAtDestination } from './inventory';
import { planSignature } from './diagnostics';

export const INSTALLATION_PLAN_MODEL='anchored-donor-alternative-v1' as const;
export interface InstallationPlan {
  model:typeof INSTALLATION_PLAN_MODEL;
  kind:'reversed-donors'|'barge-starts';
  referenceLayoutId:string;
  donorFaceIds:string[];
  receiverFaceIds:string[];
  /** This is a planned setout, not a certificate for arbitrary changes on site. */
  siteSetoutConfirmed:false;
  reuseEndTrimMm?:number;
}
export interface InstallationFaceGuide {
  faceId:string;name:string;start:string;setout:string;anchorId:string|null;
  freshCount:number;reuseCount:number;firstCoverMm:number|null;
  freshLengths:{lengthMm:number;count:number}[];
  sources:{faceId:string;count:number}[];
  transitionDemandIds:string[];
}
export function validateInstallationPlan(r:SolveRequest,s:Solution):Issue[]{
  const p=s.installationPlan;if(!p)return [];
  const errors=validateInstallationSetout(r,s.bankLayout??{} as never),ids=new Set(r.faces.map(f=>f.id));
  const bad=(message:string)=>errors.push({severity:'error',code:'INSTALLATION_PLAN',message});
  if(p.model!==INSTALLATION_PLAN_MODEL||!['reversed-donors','barge-starts'].includes(p.kind)||typeof p.referenceLayoutId!=='string'||!p.referenceLayoutId||p.siteSetoutConfirmed!==false||!s.bankLayout?.installationSetout){bad('Invalid installation-plan metadata.');return errors;}
  if(!Array.isArray(p.donorFaceIds)||!Array.isArray(p.receiverFaceIds)||p.donorFaceIds.some(id=>!ids.has(id))||p.receiverFaceIds.some(id=>!ids.has(id))||new Set(p.donorFaceIds).size!==p.donorFaceIds.length||new Set(p.receiverFaceIds).size!==p.receiverFaceIds.length){bad('Installation-plan faces do not match the reviewed roof.');return errors;}
  if(p.kind==='reversed-donors'){
    if(!p.donorFaceIds.length||!p.receiverFaceIds.length||p.donorFaceIds.some(id=>!s.bankLayout!.primaryFaceIds.includes(id)||!s.bankLayout!.installationSetout!.anchors.some(a=>a.faceId===id&&a.kind==='hip-ridge-junction')))bad('Reversed donor plans need actual anchored primary stock.');
    const roots=new Map(s.demands.map(d=>[d.id,d.faceId])),cuts=new Map(s.offcuts.map(o=>[o.id,o]));
    for(const donor of p.donorFaceIds)if(!s.placements.some(q=>{const o=cuts.get(q.offcutId??'');return q.kind==='reuse'&&p.receiverFaceIds.includes(roots.get(q.demandId)??'')&&o&&roots.get(o.rootDemandId??o.sourceDemandId)===donor;}))bad('A proposed donor supplies no actual material to the reversed receivers.');
    const trim=p.reuseEndTrimMm??0;if(!Number.isFinite(trim)||trim<0||trim>100)bad('Invalid installation trim allowance.');
    // A claimed trimming reserve must not be lent to another installed piece.
    // For this first release certify padding only when that root sheet has a
    // single reused destination. Multi-destination/recut families remain valid
    // in the ordinary junction-setout alternative, without a padding claim.
    const rootReuseCounts=new Map<string,number>();
    for(const q of s.placements.filter(q=>q.kind==='reuse')){const o=cuts.get(q.offcutId??'');if(o){const id=o.rootDemandId??o.sourceDemandId;rootReuseCounts.set(id,(rootReuseCounts.get(id)??0)+1);}}
    if(trim>0)for(const q of s.placements.filter(q=>q.kind==='reuse'&&p.receiverFaceIds.includes(roots.get(q.demandId)??''))){
      const d=s.demands.find(d=>d.id===q.demandId)!,o=cuts.get(q.offcutId??'');
      const need=d.required.map(c=>({...c,top0:c.top0-trim,top1:c.top1-trim,bottom0:c.bottom0+trim,bottom1:c.bottom1+trim}));
      if(!o||area(subtract(need,materialAtDestination(o,q)))>Math.max(.001,area(need)*1e-9))bad('The claimed receiver trimming margin is not present in the assigned source piece.');
      else if((rootReuseCounts.get(o.rootDemandId??o.sourceDemandId)??0)>1)bad('Trimming room is not independently reserved for a shared or recut parent sheet.');
    }
  }
  for(const a of s.bankLayout!.installationSetout!.anchors.filter(a=>a.kind==='barge-end')){
    const ds=s.demands.filter(d=>d.faceId===a.faceId).sort((a,b)=>a.laneIndex-b.laneIndex);
    const d=a.setout==='positive-u'?ds[0]:ds.at(-1);
    if(d&&s.placements.find(p=>p.demandId===d.id)?.kind!=='new')bad('A fresh barge-start proposal does not start with purchased material.');
  }
  return errors;
}
/** Quantities come from the actual purchase rectangles. A clipped drawing at a
 * barge is never billed as a fraction of a physical new sheet. */
export function installationGuides(r:SolveRequest,s:Solution):InstallationFaceGuide[]{
  const ps=new Map(s.placements.map(p=>[p.demandId,p])),cuts=new Map(s.offcuts.map(o=>[o.id,o]));
  return r.faces.map(face=>{
    const ds=s.demands.filter(d=>d.faceId===face.id).sort((a,b)=>a.laneIndex-b.laneIndex);
    const routes=new Map<string,number>();let fresh=0,reused=0;
    for(const d of ds){const q=ps.get(d.id);if(q?.kind==='new')fresh++;else if(q?.kind==='reuse'){reused++;const o=cuts.get(q.offcutId??'');if(o)routes.set(o.sourceFaceId,(routes.get(o.sourceFaceId)??0)+1);}}
    const p={newCount:fresh,reuseCount:reused,selfFill:isSelfFillCandidate(face,r.roof),sources:[...routes].map(([faceId,count])=>({faceId,count}))};
    const anchor=s.bankLayout?.installationSetout?.anchors.find(a=>a.faceId===face.id);
    const barge=installationAnchors(face,r.roof,r.profile).find(a=>a.kind==='barge-end');
    const first=(anchor??barge)?.setout==='negative-u'?ds.at(-1):ds[0];
    const freshLengths=new Map<number,number>();for(const d of ds)if(ps.get(d.id)?.kind==='new'){const b=bounds(d.blank),l=+(b.maxY-b.minY).toFixed(6);freshLengths.set(l,(freshLengths.get(l)??0)+1);}
    const firstCover=first?bounds(first.cover):null;
    const start=anchor?.kind==='hip-ridge-junction'?'Set out at the marked hip/ridge junction':anchor?.kind==='barge-end'?'Fresh sheet at the barge':p.selfFill?'Set out from the hip or lower valley end':p.reuseCount?'Setout depends on the source cuts':'Confirm the starting edge on site';
    const setout=anchor?.setout==='both-sides'?'Set out both sides of this junction. Keep the indicated lap; confirm the laying sequence for the actual profile.':anchor?.kind==='barge-end'?'Work inward from the barge. Retain enough fresh stock before the reused cut run.':p.selfFill?'Do not begin at the upper valley termination. Establish and retrim to one straight valley line.':'Use the displayed cover stations. Changing the starting position can change which cuts fit.';
    return{faceId:face.id,name:face.name,start,setout,anchorId:anchor?.id??null,freshCount:p.newCount,reuseCount:p.reuseCount,firstCoverMm:firstCover?firstCover.maxX-firstCover.minX:null,
      freshLengths:[...freshLengths].map(([lengthMm,count])=>({lengthMm,count})),sources:p.sources,
      transitionDemandIds:ds.filter(d=>ps.get(d.id)?.kind==='new'&&!!d.cutEdges?.length&&(d.ridgeOverlapMm??0)>1e-6).map(d=>d.id)};
  });
}
/** Exposes source material BEFORE final trimming alongside the installed need.
 * No bounding-box-only claim of fit; the physical validator checks every band. */
export function sourceTrimDetails(s:Solution,demandId:string){
  const d=s.demands.find(d=>d.id===demandId),p=s.placements.find(p=>p.demandId===demandId);
  if(!d||!p)return null;const o=s.offcuts.find(o=>o.id===p.offcutId);
  const source=p.kind==='new'?d.blank:o?materialAtDestination(o,p):null;
  if(!source)return null;
  return{demandId,sourceDemandId:o?.sourceDemandId??demandId,required:d.required,availableBeforeTrim:source,widthMm:d.widthMm,rotation:p.rotation,lap:d.lap};
}
export function installationInstructions(r:SolveRequest,s:Solution):string{
  const names=new Map(r.faces.map(f=>[f.id,f.name]));
  return ['QuoteCore - installation setout guide',`Plan ${planSignature(s)} - draft, verify actual profile and site measurements.`,
    'Marks show effective-cover boundaries, not measured physical overhang.',
    s.installationPlan?.reuseEndTrimMm?`Reversed receivers have ${s.installationPlan.reuseEndTrimMm} mm checked length-end trimming room in each assigned source piece. This is not a guarantee for arbitrary site grid shifts.`:'No extra length-end trimming margin is certified beyond the physical plan.',
    'Never start at the upper termination of a valley. Keep one straight cut line. Allow trimming; do not stretch a short piece.',
    'A junction anchor establishes the sheet grid. It does not change the profile lap or guarantee that every profile can be laid in both directions.',
    ...installationGuides(r,s).map(g=>`${g.name}: ${g.start}. ${g.setout}\nNew stock: ${g.freshLengths.map(x=>`${x.count} x ${(x.lengthMm/1000).toFixed(3)} m`).join('; ')||'none'}. Reuse: ${g.sources.map(x=>`${x.count} from ${names.get(x.faceId)??x.faceId}`).join('; ')||'none'}.`),
    r.settings.receiverPhaseMode==='quote-safe'?'Valley sensitivity checks assume the quoted parent blanks and receiver grid stay fixed. They do not certify arbitrary changes to every face.':'Fixed-registration plan: source cuts and receiver registration must be maintained.',
    planningBoundary(r.faces[0]).length?'All geometry remains the user-approved roof.':''
  ].join('\n\n');
}
