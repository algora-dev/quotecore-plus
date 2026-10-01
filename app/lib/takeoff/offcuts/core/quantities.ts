import { validateDraft } from './editing';
import type { Draft, Solution } from './types';
import { area } from './regions';
import { fingerprint } from './math';
import { materialSections, purchasedLengthMm, type MaterialSection } from './sections';

export interface PurchaseRow {
  rootDemandId: string; faceId: string; sectionId: string | null; supplyBlockId: string | null;
  lengthM: number; effectiveCoverM: number; profileWidthM: number; role: 'bank' | 'filler';
}
export interface QuantitySummary {
  newSheetCount: number; reusedPositions: number;
  /** Sum ordered blank lengths of purchased physical ROOT sheets only. */
  purchasedLinealM: number;
  /** Sum(length × effective cover). For cover-based pricing; not net roof area. */
  suppliedCoverAreaM2: number;
  /** Sum(length × configured cover + side allowances); not developed coil area. */
  suppliedProfileAreaM2: number;
  netRoofAreaM2: number;
  reservedOnRoofAreaM2: number;
  cuttingRemainderAreaM2: number;
  coverUpliftPercent: number | null;
  profileUpliftPercent: number | null;
  purchaseRows: PurchaseRow[];
  sections: MaterialSection[];
  sparesIncluded: false;
  method: 'unique-purchased-roots';
}
export function quantitySummary(s: Solution, sections=materialSections(s)): QuantitySummary {
  const demands=new Map(s.demands.map(d=>[d.id,d]));
  const owners=new Map(sections.flatMap(section=>section.purchasedDemandIds.map(id=>[id,section] as const)));
  const seen=new Set<string>(), purchaseRows:PurchaseRow[]=[];
  for (const p of s.placements) if(p.kind==='new') {
    if(seen.has(p.demandId))throw new Error('Duplicate purchased root in quantity calculation.');seen.add(p.demandId);
    const d=demands.get(p.demandId);if(!d)throw new Error('Purchased sheet has no physical dimensions.');
    const lengthM=purchasedLengthMm(d)/1000;
    if(!Number.isFinite(lengthM)||lengthM<=0)throw new Error('Purchased sheet has an invalid length.');
    const section=owners.get(d.id);
    purchaseRows.push({rootDemandId:d.id,faceId:d.faceId,sectionId:section?.id??null,supplyBlockId:section?.supplyBlockId??null,
      lengthM,effectiveCoverM:s.profile.coverMm/1000,profileWidthM:d.widthMm/1000,role:section?.role==='new-filler'?'filler':'bank'});
  }
  const sum=(f:(r:PurchaseRow)=>number)=>purchaseRows.reduce((n,r)=>n+f(r),0);
  const net=s.demands.reduce((n,d)=>n+area(d.cover)/1e6,0),reserved=s.demands.reduce((n,d)=>n+area(d.required)/1e6,0);
  const cover=sum(r=>r.lengthM*r.effectiveCoverM),physical=sum(r=>r.lengthM*r.profileWidthM);
  return {newSheetCount:purchaseRows.length,reusedPositions:s.placements.filter(p=>p.kind==='reuse').length,
    purchasedLinealM:sum(r=>r.lengthM),suppliedCoverAreaM2:cover,suppliedProfileAreaM2:physical,
    netRoofAreaM2:net,reservedOnRoofAreaM2:reserved,cuttingRemainderAreaM2:physical-reserved,
    coverUpliftPercent:net>0?(cover/net-1)*100:null,profileUpliftPercent:net>0?(physical/net-1)*100:null,
    purchaseRows,sections,sparesIncluded:false,method:'unique-purchased-roots'};
}
export type QuoteQuantityBasis = 'lineal-metres' | 'cover-square-metres' | 'profile-square-metres';
export interface QuoteQuantityProposal {
  schemaVersion: 1; kind:'quotecore-offcut-quantity-proposal'; engineVersion: string;
  quoteId:string; pageId:string; areaScopeId:string|null; sourceRevision:string; facesRevision:string; layoutId:string;
  basis:QuoteQuantityBasis; unit:'lm'|'m2'; quantity:number;
  netApprovedRoofAreaM2:number; purchasedLinealM:number; suppliedCoverAreaM2:number; suppliedProfileAreaM2:number;
  newSheets:number; effectiveCoverMm:number; profileWidthMm:number;
  calibrationMmPerSceneUnit:number; pitchByFace:Record<string,number|null>;
  quantityFingerprint:string;
  assumptions:string[]; warnings:string[];
  /** Host must confirm a specific MATERIAL quote line; never replace takeoff geometry. */
  action:'propose-material-quantity'; orderReady:false; sparesIncluded:false;
}
/** Explicit proposal for a host adapter, not a database update. The host must
 * validate quote/tenant ownership, revision, rate basis, previous waste factors
 * and the user's target material line. Do not apply to labour or roof geometry. */
export function quoteQuantityProposal(draft: Draft, basis:QuoteQuantityBasis):QuoteQuantityProposal {
  if(!['lineal-metres','cover-square-metres','profile-square-metres'].includes(basis))throw new Error('Select an explicit quantity/rate basis.');
  const s=draft.solution;if(!s||s.status==='invalid'||s.issues.some(i=>i.severity==='error'))throw new Error('A valid reviewed cut plan is required.');
  if(s.sourceRevision!==draft.roof.sourceRevision||fingerprint(s.profile)!==fingerprint(draft.profile)||fingerprint(s.settings)!==fingerprint(draft.settings))throw new Error('The quantity plan is stale. Recalculate first.');
  const errors=validateDraft(draft).filter(i=>i.severity==='error');
  if(errors.length)throw new Error(errors.map(i=>i.message).join('\n'));
  const q=quantitySummary(s);
  const quantity=basis==='lineal-metres'?q.purchasedLinealM:basis==='cover-square-metres'?q.suppliedCoverAreaM2:q.suppliedProfileAreaM2;
  return {schemaVersion:1,kind:'quotecore-offcut-quantity-proposal',engineVersion:s.engineVersion??'unknown',
    quoteId:draft.roof.quoteId,pageId:draft.roof.pageId,areaScopeId:draft.roof.areaScopeId,sourceRevision:draft.roof.sourceRevision,
    facesRevision:s.facesRevision,layoutId:s.layoutId??fingerprint(s.placements),basis,unit:basis==='lineal-metres'?'lm':'m2',quantity,
    netApprovedRoofAreaM2:q.netRoofAreaM2,purchasedLinealM:q.purchasedLinealM,suppliedCoverAreaM2:q.suppliedCoverAreaM2,suppliedProfileAreaM2:q.suppliedProfileAreaM2,
    newSheets:q.newSheetCount,effectiveCoverMm:s.profile.coverMm,profileWidthMm:s.profile.coverMm+s.profile.leftLapMm+s.profile.rightLapMm,
    calibrationMmPerSceneUnit:draft.roof.mmPerSceneUnit,pitchByFace:Object.fromEntries(draft.faces.map(f=>[f.id,f.pitchDeg])),
    quantityFingerprint:fingerprint([draft.roof.sourceRevision,s.facesRevision,s.profile,s.settings,s.placements,basis,q.purchaseRows]),
    assumptions:['Current selected page/roof scope only; not other roofs in this quote.','Pitch is already included once in surface blank lengths.',
      'Cutting stock, selected extension, end allowances and order-length rounding are already included. Do not add them twice.',
      'No spare sheets, installation contingency or supplier-specific developed coil width included.',
      'Offcuts and later recuts are not purchased again. Remainders can include reusable stock, not just rubbish.',
      'Replace only an explicitly selected material quantity with a matching rate basis. Preserve measured roof area and labour quantities.'],
    warnings:s.issues.filter(i=>i.severity==='warning').map(i=>i.message),action:'propose-material-quantity',orderReady:false,sparesIncluded:false};
}
