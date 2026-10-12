/** Discovery across neighbouring prior supply operations. This is deliberately
 * separate from the successful paired-valley path and the three main modes. */
import type { Solution, SolveRequest } from './types';
import type { BankSearchVariant } from './banks';
import { buildSharedTopology } from './sharedTopology';
import { buildMaterialBanks } from './materialBanks';
import { bankAnchorFaces, isSelfFillCandidate } from './zones';
import { installationAnchors, type InstallationAnchor } from './installationAnchors';
import { planningBoundary } from './directions';
import { area } from './regions';
import { fingerprint } from './math';
import { materialRoutes, type ConnectedReversalScope } from './connectedDonorFamilies';

export interface ConnectedDonorVariant { bank:BankSearchVariant; scope:ConnectedReversalScope }
export interface ConnectedDiscoveryReport {
  model:'connected-donor-discovery-v1';candidateFaceIds:string[];
  groups:Array<{donorFaceIds:string[];receiverFaceIds:string[];retiredOperationIds:string[]}>;
  excluded:Array<{faceId:string;reason:string}>;variantsGenerated:number;topologyIssue?:string;
}
const near=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)<1e-5;
export function connectedDonorVariants(r:SolveRequest,previous:Solution,attempt=0):{variants:ConnectedDonorVariant[];report:ConnectedDiscoveryReport}{
  const report:ConnectedDiscoveryReport={model:'connected-donor-discovery-v1',candidateFaceIds:[],groups:[],excluded:[],variantsGenerated:0};
  const operations=previous.bankLayout?.primaryOperations??[];
  if(!operations.length)return{variants:[],report};
  const routes=materialRoutes(previous),banks=buildMaterialBanks(r),oldPrimary=new Set(operations.flatMap(op=>op.faceIds));
  const anchors=new Map<string,InstallationAnchor[]>();
  const net=(id:string)=>previous.demands.filter(d=>d.faceId===id).reduce((n,d)=>n+area(d.cover),0);
  for(const f of r.faces){
    if(oldPrimary.has(f.id)||!routes.some(row=>row.receiverFaceId===f.id&&oldPrimary.has(row.sourceFaceId)&&row.positions>=2))continue;
    const bank=banks.find(b=>b.faceIds.includes(f.id))!;
    let reason:string|undefined;
    const starts=installationAnchors(f,r.roof,r.profile,true).filter(a=>a.kind!=='barge-end');
    if(isSelfFillCandidate(f,r.roof))reason='independent-self-fill';
    else if(!bankAnchorFaces(r.faces.filter(face=>bank.faceIds.includes(face.id)),r.roof).some(face=>face.id===f.id))reason='contained-bank-member';
    else if(!starts.length)reason='no-supported-start-or-locked-grid';
    if(reason){report.excluded.push({faceId:f.id,reason});continue;}
    // Prefer the longer internal shoulder, then ordinary hip/ridge starts.
    // Apex starts are admitted without redefining an upper valley as a start.
    const score=(a:InstallationAnchor)=>{
      const hip=planningBoundary(f).find(e=>a.edgeIds.includes(e.id)&&['hip','broken_hip'].includes(e.kind));
      const internal=hip&&![hip.a,hip.b].some(p=>r.roof.outlines.some(o=>o.polygon.some(q=>near(p,q))));
      return(a.kind==='hip-ridge-junction'?1e9:0)+(internal?1e8:0)+(hip?Math.hypot(hip.a.x-hip.b.x,hip.a.y-hip.b.y):0);
    };
    anchors.set(f.id,starts.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id)).slice(0,3));
  }
  const candidates=[...anchors.keys()].sort((a,b)=>net(b)-net(a)||a.localeCompare(b)).slice(0,6);
  report.candidateFaceIds=candidates;
  const neighbours=new Map(r.faces.map(f=>[f.id,new Set<string>()]));
  try {
    // Use the review mesh so a shared edge still connects after one face gains
    // an extra collinear editing vertex. Never infer adjacency from names.
    for(const edge of buildSharedTopology(r.roof,r.faces).edges)if(edge.faceIds.length===2){
      const [a,b]=edge.faceIds;neighbours.get(a)!.add(b);neighbours.get(b)!.add(a);
    }
  } catch(e) {
    report.topologyIssue=e instanceof Error?e.message:'Unsupported shared roof topology.';
    return{variants:[],report}; // The separate existing paired route stays usable.
  }
  const groups:string[][]=[];
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)groups.push([candidates[i],candidates[j]].sort());
  groups.push(...candidates.map(id=>[id]));
  const groupVariants:ConnectedDonorVariant[][]=[];
  for(const donors of groups){
    const donorBanks=banks.filter(b=>donors.some(id=>b.faceIds.includes(id)));
    if(donorBanks.length!==donors.length)continue;
    const retired=operations.filter(op=>routes.some(row=>donors.includes(row.receiverFaceId)&&op.faceIds.includes(row.sourceFaceId)&&row.positions>=2));
    const retiredIds=new Set(retired.map(op=>op.id)),receiverIds=[...new Set(retired.flatMap(op=>op.faceIds))].sort();
    const territory=new Set([...donors,...receiverIds]),reached=new Set([donors[0]]),todo=[donors[0]];
    while(todo.length){const id=todo.pop()!;for(const next of neighbours.get(id)??[])if(territory.has(next)&&!reached.has(next)){reached.add(next);todo.push(next);}}
    if([...territory].some(id=>!reached.has(id)))continue;
    const kept=operations.filter(op=>!retiredIds.has(op.id)&&!op.faceIds.some(id=>donors.includes(id)));
    const primaryBankIds=[...new Set([...donorBanks.map(b=>b.id),...kept.map(op=>op.bankId)])];
    const newPrimary=new Set(banks.filter(b=>primaryBankIds.includes(b.id)).flatMap(b=>bankAnchorFaces(r.faces.filter(f=>b.faceIds.includes(f.id)),r.roof).map(f=>f.id)));
    if(receiverIds.some(id=>newPrimary.has(id)))continue;
    const scope:ConnectedReversalScope={donorFaceIds:donors,receiverFaceIds:receiverIds,retiredOperationIds:retired.map(op=>op.id).sort(),referenceRoutes:routes};
    report.groups.push({donorFaceIds:donors,receiverFaceIds:receiverIds,retiredOperationIds:scope.retiredOperationIds});
    let combinations:InstallationAnchor[][]=[[]];
    for(const id of donors)combinations=combinations.flatMap(xs=>anchors.get(id)!.map(a=>[...xs,a]));
    // Protect simple full-hip receivers first, then explore the larger shapes.
    // Every variant is a fresh stock transaction, not a patch to old cuts.
    const preferences=[...receiverIds].sort((a,b)=>{
      const A=r.faces.find(f=>f.id===a)!,B=r.faces.find(f=>f.id===b)!;
      return Number(planningBoundary(A).some(e=>e.kind==='ridge'))-Number(planningBoundary(B).some(e=>e.kind==='ridge'))||net(b)-net(a)||a.localeCompare(b);
    }).slice(0,3);
    const variants:ConnectedDonorVariant[]=[];
    for(const preferredReceiverFaceId of preferences)for(const startAnchors of combinations)for(const mode of [0,1]){
      const setout={model:'installation-setout-v1' as const,anchors:startAnchors,measuredFillerFaceIds:donors};
      const bank:BankSearchVariant={id:'connected-'+fingerprint([donors,startAnchors.map(a=>a.id),preferredReceiverFaceId,mode]),
        primaryBankIds,seedFaceId:donors[mode?donors.length-1:0],registrationVariant:mode?4:2,
        memberAxisContinuation:true,reserveValleyReceivers:true,combineDonorSets:true,deferReceiversUntilDonorsReady:true,
        preferredReceiverFaceId,alignDonorFamilies:true,installationSetout:setout,
        receiverSourceFaceIds:Object.fromEntries(receiverIds.map(id=>[id,donors]))};
      variants.push({bank,scope});
    }
    const offset=variants.length?(attempt*5)%variants.length:0;
    groupVariants.push([...variants.slice(offset),...variants.slice(0,offset)]);
  }
  // Pairs are explored before partial single-bank reversals. Six variants per
  // connected group initially prevent an unrelated small group monopolising it.
  const result:ConnectedDonorVariant[]=[];
  const groupOffset=groupVariants.length?attempt%groupVariants.length:0;
  const orderedGroups=[...groupVariants.slice(groupOffset),...groupVariants.slice(0,groupOffset)];
  for(let round=0;round<3;round++)for(const variants of orderedGroups)result.push(...variants.slice(round*6,round*6+6));
  const unique=new Set<string>();
  const variants=result.filter(v=>{if(unique.has(v.bank.id))return false;unique.add(v.bank.id);return true;}).slice(0,24);
  report.variantsGenerated=variants.length;return{variants,report};
}
