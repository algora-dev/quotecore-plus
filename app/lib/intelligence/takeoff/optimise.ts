import { ensure, integer } from '../contracts/validation';
import { digest } from '../policy/approval';
import { deriveFaces } from '../../takeoff/offcuts/core/graph';
import { directionApproved } from '../../takeoff/offcuts/core/directions';
import { frameFor, sceneToSurface, validateInputs } from '../../takeoff/offcuts/core/material';
import { signedArea } from '../../takeoff/offcuts/core/math';
import { optimise, type SearchHooks } from '../../takeoff/offcuts/core/solver';
import { quoteQuantityProposal, type QuoteQuantityBasis } from '../../takeoff/offcuts/core/quantities';
import type { Draft, RoofInput, SolveRequest, Solution } from '../../takeoff/offcuts/core/types';
import { assertPointInRaster } from '../../takeoff/calibrationCoordinates';

/** Trusted legacy DTOs only. JSON round trip strips optional undefined fields
 * in legacy projections; reject non-finite data BEFORE serialization. No URLs
 * or credentials may enter the snapshot. Not a parser for arbitrary AI output. */
export function legacyDigest(value:unknown):string{
 const json=JSON.stringify(value,(_k,v)=>{if(typeof v==='number')ensure(Number.isFinite(v),'nonfinite legacy number');return v;});
 ensure(typeof json==='string','legacy snapshot');return digest(JSON.parse(json));
}
export function checkRoofBounds(roof:RoofInput){
 ensure(roof.schemaVersion===1&&!roof.imageUrl,'private roof DTO');
 ensure(Number.isFinite(roof.sceneWidth)&&roof.sceneWidth>0&&roof.sceneWidth<=2000&&Number.isFinite(roof.sceneHeight)&&roof.sceneHeight>0&&roof.sceneHeight<=2000,'scene extent');
 ensure(roof.outlines.length>0&&roof.outlines.length<=32&&roof.edges.length<=400,'geometry bounds');
 ensure(roof.outlines.reduce((n,o)=>n+o.polygon.length,0)+roof.edges.length<=400,'segment bounds');
 for(const q of [...roof.outlines.flatMap(o=>o.polygon),...roof.edges.flatMap(e=>[e.a,e.b])])assertPointInRaster(q,roof.sceneWidth,roof.sceneHeight,'roof point');
}
/** Existing topology engine, no approval, no global multi-page merge. */
export function proposeRoofFaces(roof:RoofInput){
 checkRoofBounds(roof);const found=deriveFaces(structuredClone(roof));
 return {faces:found.faces.map(f=>({...f,confirmed:false,directionApproval:undefined,pitchDeg:null})),issues:found.issues,repairs:found.repairs,adjustments:found.adjustments,requiresGeometryReview:true as const,writeAuthorized:false as const};
}
export function checkRequest(r:SolveRequest){
 checkRoofBounds(r.roof);ensure(r.faces.length>0&&r.faces.length<=32&&r.faces.reduce((n,f)=>n+f.polygon.length+f.boundary.length,0)<=600,'face bounds');
 for(const f of r.faces)for(const q of [...f.polygon,...f.boundary.flatMap(e=>[e.a,e.b])])assertPointInRaster(q,r.roof.sceneWidth,r.roof.sceneHeight,'face point');
 ensure(r.roof.calibrationConfirmed===true&&r.profile.rulesConfirmed===true,'unconfirmed calibration or profile');
 ensure(r.faces.every(f=>f.confirmed===true&&directionApproved(f)&&f.pitchDeg!==null),'unconfirmed face, flow or pitch');
 integer(r.settings.maxTrials,'max trials',1,32);integer(r.settings.maxMilliseconds,'search budget',1,4000);integer(r.settings.maxSheets,'sheet cap',1,600);
 // Optional extra search budgets must be explicitly disabled or bounded.
 ensure(r.settings.globalBankSearch===false&&r.settings.provisionalReuse===false,'extra search requires separate runtime approval');
 const issues=validateInputs(r.roof,r.faces,r.profile,r.settings);ensure(!issues.some(i=>i.severity==='error'),'canonical geometry or profile validation');
 legacyDigest(r);
 return issues;
}
/** Independent per-plane surface coordinates for review; no shared vertical
 * datum or inferred ridge connection. Unknown pitch is not flat. */
export function reviewedPlaneSurfaces(r:SolveRequest){
 checkRequest(r);
 return r.faces.map(f=>{
  const frame=frameFor(f,r.roof),vertices=f.polygon.map(p=>sceneToSurface(p,frame));
  const planAreaM2=Math.abs(signedArea(f.polygon))*r.roof.mmPerSceneUnit**2/1e6;
  const angle=f.pitchDeg!*Math.PI/180;
  // Face-local axes: x cross-slope, y downslope horizontal, z up.
  const localVerticesMm=vertices.map(v=>({x:v.x,y:v.y*Math.cos(angle),z:-v.y*Math.sin(angle)}));
  return {faceId:f.id,pitchDeg:f.pitchDeg!,surfaceVerticesMm:vertices,localVerticesMm,planAreaM2,surfaceAreaM2:Math.abs(signedArea(vertices))/1e6,globalElevation:null};
 });
}
export type OptimisationResult={requestDigest:string;solution:Solution};
/** Run only in a separately bounded worker, NOT in a DB transaction or API
 * request. Cancellation is cooperative; host must enforce wall-clock/memory
 * limits, fresh permission before work and after completion. */
export function runOptimisation(request:SolveRequest,hooks:Pick<SearchHooks,'shouldCancel'>={}):OptimisationResult{
 checkRequest(request);const requestDigest=legacyDigest(request);
 ensure(!hooks.shouldCancel?.(),'cancelled');const solution=optimise(structuredClone(request),hooks);
 ensure(!hooks.shouldCancel?.(),'cancelled');
 // Revalidate through existing draft and physical ledger before returning.
 projectOptimisation(request,{requestDigest,solution},'lineal-metres');
 return {requestDigest,solution};
}
export function projectOptimisation(request:SolveRequest,result:OptimisationResult,basis:QuoteQuantityBasis){
 checkRequest(request);ensure(result.requestDigest===legacyDigest(request),'stale solver inputs');
 ensure(result.solution.engineVersion==='2.30'&&result.solution.status==='prototype-review'&&result.solution.orderReady===false,'unsupported or invalid solver result');
 const draft:Draft={schemaVersion:1,...request,solution:result.solution};
 const proposal=quoteQuantityProposal(draft,basis); // validateDraft + rootSheetLedger + quantitySummary
 ensure(Number.isFinite(proposal.quantity)&&proposal.quantity>0,'invalid purchase quantity');
 return {proposal,planes:reviewedPlaneSurfaces(request),boundedSearch:true as const,provenOptimal:false as const,requiresMaterialLineReview:true as const,writeAuthorized:false as const};
}
/** Advisory physical comparison only. Both profiles must come from authorized,
 * explicitly reviewed alternatives; rulesConfirmed is NOT proof of functional
 * equivalence, manufacturer approval, or approved price. The host must verify
 * those independently before displaying or using an alternative. */
export function compareProfileSupply(a:SolveRequest,ar:OptimisationResult,b:SolveRequest,br:OptimisationResult){
 ensure(legacyDigest([a.roof,a.faces,a.settings])===legacyDigest([b.roof,b.faces,b.settings]),'comparison requires identical reviewed geometry and settings');
 ensure(a.profile.id!==b.profile.id,'distinct profile alternatives required');
 const summaries=[{r:a,result:ar},{r:b,result:br}].map(({r,result})=>{
  const {proposal}=projectOptimisation(r,result,'cover-square-metres');
  return {profileId:r.profile.id,netRoofAreaM2:proposal.netApprovedRoofAreaM2,purchasedLinealM:proposal.purchasedLinealM,suppliedCoverAreaM2:proposal.suppliedCoverAreaM2,suppliedProfileAreaM2:proposal.suppliedProfileAreaM2,newSheets:proposal.newSheets,warnings:proposal.warnings};
 });
 return {summaries,requiresProductEquivalenceAndRateReview:true as const,commercialRanking:null,writeAuthorized:false as const};
}
