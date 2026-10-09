import { salvagePhysicalFingerprint } from '../core/salvageModel';
/** Recoverable structured reviews. PNGs are display artefacts, never geometry.
 * Storage identity and authorization belong to the authenticated host adapter.
 * No stored result is accepted without re-running geometric/material checks. */
import type { Draft, RoofInput, Solution, Issue } from '../core/types';
import type { LiveInputCapture } from '../adapters/liveSnapshot';
import { exportLiveCapture, captureLiveTakeoff, legacyLiveInputFingerprint } from '../adapters/liveSnapshot';
import { fingerprint } from '../core/math';
import { parseDraft } from '../core/codec';
import { validateDraft } from '../core/editing';
import { directionApproved } from '../core/directions';
import { roofRevision } from '../adapters/quotecore';

export interface ReviewScope { quoteId:string; pageId:string; areaScopeId:string|null }
export interface ReviewDocument {
  schemaVersion:1; kind:'quotecore-offcut-review'; engineVersion:'2.10'|'2.11'|'2.12'|'2.13'|'2.14'|'2.15'|'2.16'|'2.17'|'2.18'|'2.19'|'2.20'|'2.21';
  scope:ReviewScope; sourceFingerprint:string; sourceRevision:string;
  savedAt:string; capture:LiveInputCapture|null; sourceRoof:RoofInput;
  draft:Draft; plans:Solution[]; selectedPlanIndex:number;
  diagnostics:{initialDetection:unknown;issues:Issue[];repairs:unknown[];adjustments:unknown[]};
}
export interface StoredReview { revision:number; document:ReviewDocument }
export interface ReviewRepository {
  kind:'cloud'|'device'|'memory';
  load(scope:ReviewScope):Promise<StoredReview|null>;
  /** expectedRevision=0 means create only. Never last-write-wins across tabs. */
  save(scope:ReviewScope,document:ReviewDocument,expectedRevision:number):Promise<StoredReview>;
}
export class ReviewConflict extends Error { constructor(){super('This draft was saved in another tab. Reload that saved version or export your changes; it has not been overwritten.');this.name='ReviewConflict';} }
export const REVIEW_MAX_BYTES=12_000_000;
export function reviewScope(roof:RoofInput):ReviewScope{return{quoteId:roof.quoteId,pageId:roof.pageId,areaScopeId:roof.areaScopeId};}
export function reviewScopeKey(scope:ReviewScope):string { return JSON.stringify([scope.quoteId,scope.pageId,scope.areaScopeId??null]); }
export function sameReviewScope(a:ReviewScope,b:ReviewScope):boolean {return reviewScopeKey(a)===reviewScopeKey(b);}
export function sourceFingerprint(roof:RoofInput,capture?:LiveInputCapture|null):string{
  const copy=structuredClone(roof);delete copy.imageUrl;return capture?.inputFingerprint??fingerprint(copy);
}
export function createReviewDocument(args:{draft:Draft;sourceRoof:RoofInput;capture?:LiveInputCapture;plans:Solution[];selectedPlanIndex:number;diagnostics:ReviewDocument['diagnostics']}):ReviewDocument{
  const draft=structuredClone({...args.draft,solution:null}),sourceRoof=structuredClone(args.sourceRoof);delete draft.roof.imageUrl;delete sourceRoof.imageUrl;
  // Store each potentially large plan once; selectedPlanIndex restores the view.
  draft.solution=null;
  const result:ReviewDocument={schemaVersion:1,kind:'quotecore-offcut-review',engineVersion:'2.21',scope:reviewScope(sourceRoof),
    sourceFingerprint:sourceFingerprint(sourceRoof,args.capture),sourceRevision:sourceRoof.sourceRevision,savedAt:new Date().toISOString(),
    capture:args.capture?JSON.parse(exportLiveCapture(args.capture)) as LiveInputCapture:null,sourceRoof,draft,
    plans:structuredClone(args.plans).slice(0,12),selectedPlanIndex:args.selectedPlanIndex,diagnostics:structuredClone(args.diagnostics)};
  if(JSON.stringify(result).length>REVIEW_MAX_BYTES)throw new Error('Review is too large to autosave. Export the debug bundle and remove unneeded saved alternatives.');
  return result;
}
/** Treat a database/local-storage payload as untrusted. Never restore image URLs,
 * approval flags with changed signatures, or cached arithmetic as authority. */
export function restoreReviewDocument(value:unknown,scope:ReviewScope):{document:ReviewDocument;draft:Draft;plans:Solution[];warnings:string[]}{
  const text=JSON.stringify(value);if(!text||text.length>REVIEW_MAX_BYTES)throw new Error('Invalid or oversized saved review.');
  const d=JSON.parse(text) as ReviewDocument;
  if(d?.schemaVersion!==1||d.kind!=='quotecore-offcut-review'||!['2.10','2.11','2.12','2.13','2.14','2.15','2.16','2.17','2.18','2.19','2.20','2.21'].includes(d.engineVersion)||!d.scope||!sameReviewScope(d.scope,scope)||
    !d.draft?.roof||!sameReviewScope(reviewScope(d.draft.roof),scope)||!d.sourceRoof||!sameReviewScope(reviewScope(d.sourceRoof),scope)||
    !Array.isArray(d.plans)||d.plans.length>12||typeof d.sourceFingerprint!=='string')throw new Error('Saved review does not belong to this quote, page and roof area.');
  const warnings:string[]=[];
  const legacy=!['2.13','2.14','2.15','2.16','2.17','2.18','2.19','2.20','2.21'].includes(d.engineVersion);
  if(d.engineVersion==='2.13'||d.engineVersion==='2.14'||d.engineVersion==='2.15'||d.engineVersion==='2.16'||d.engineVersion==='2.17'||d.engineVersion==='2.18'||d.engineVersion==='2.19'||d.engineVersion==='2.20')warnings.push(`Saved V${d.engineVersion} plans were rechecked and retained with their original version. New plans use V2.21. Original plans and their provenance are preserved. New plans also check removable square-ended stock; optional filler reuse still needs explicit acceptance.`);
  if(legacy)warnings.push('Your saved shapes and water arrows were kept. Recalculate once for the updated continuous-cut stock and valley-phase checks; old cut plans were not reused.');
  // The original saved capture is data too: rebuild its adapter output rather
  // than allowing a forged cached `.adapted` object to enter the face builder.
  const source=parseDraft(JSON.stringify({schemaVersion:1,roof:d.sourceRoof,faces:[],profile:d.draft.profile,settings:d.draft.settings})).roof;
  if(d.capture){
    const rebuilt=captureLiveTakeoff(d.capture.snapshot);
    // Canonical for new saves; the legacy hash still verifies pre-canonical copies.
    if(!sameReviewScope(reviewScope(rebuilt.adapted.roof),scope)||(rebuilt.inputFingerprint!==d.sourceFingerprint&&legacyLiveInputFingerprint(rebuilt.snapshot)!==d.sourceFingerprint)||
      roofRevision(source)!==roofRevision(rebuilt.adapted.roof))throw new Error('Saved capture does not match its source roof or scope.');
    d.capture=JSON.parse(exportLiveCapture(rebuilt)) as LiveInputCapture;
  }else if(sourceFingerprint(source)!==d.sourceFingerprint)throw new Error('Saved source geometry fingerprint changed.');
  d.sourceRoof=source;
  // parseDraft validates geometry/limits and strips untrusted solutions/URLs.
  const draft=parseDraft(JSON.stringify(d.draft));
  const raw=d.draft;
  for(const face of draft.faces){
    const old=raw.faces.find(f=>f.id===face.id);
    if(!legacy&&old&&directionApproved(old)){face.confirmed=true;face.directionApproval=old.directionApproval;}
  }
  draft.dismissedWarnings=Array.isArray(raw.dismissedWarnings)?raw.dismissedWarnings.filter(x=>typeof x==='string').slice(-500):[];
  draft.reviewNotes=Array.isArray(raw.reviewNotes)?raw.reviewNotes:[];
  // Preserving these flags is safe only for this exactly reviewed stored geometry.
  draft.profile.rulesConfirmed=raw.profile.rulesConfirmed===true;
  draft.roof.sourceRevision=roofRevision(draft.roof);
  const plans:Solution[]=[];
  for(const plan of legacy?[]:d.plans){
    try{
      const candidate={...draft,solution:plan};
      const checks=validateDraft(candidate);
      if(checks.some(i=>i.severity==='error')){warnings.push('A saved cut plan no longer passes current checks; it was not restored.');continue;}
      plans.push(structuredClone(plan));
    }catch{warnings.push('A saved cut plan was malformed; reviewed faces were kept.');}
  }
  // An accepted reuse variant must retain its immutable parent for comparison.
  for(let i=plans.length-1;i>=0;i--){const certificate=plans[i].salvage;
    if(certificate&&!plans.some(p=>!p.salvage&&salvagePhysicalFingerprint(p)===certificate.basePhysicalFingerprint)){
      plans.splice(i,1);warnings.push('A more-reuse variant had no matching original plan; it was not restored.');
    }
  }
  const chosen=d.plans[d.selectedPlanIndex];
  draft.solution=plans.find(p=>p.layoutId===chosen?.layoutId)??null;
  delete d.sourceRoof.imageUrl;delete d.draft.roof.imageUrl;
  if(d.capture){delete d.capture.snapshot.imageUrl;delete d.capture.adapted.roof.imageUrl;}
  d.engineVersion='2.21';d.draft=draft;d.plans=plans;d.selectedPlanIndex=draft.solution?plans.indexOf(draft.solution):0;
  return{document:d,draft,plans,warnings};
}
export type SaveState={status:'loading'|'ready'|'dirty'|'saving'|'saved'|'error'|'conflict';revision:number;message:string};
/** Serial, debounced, last-local-edit wins; external edits require explicit
 * conflict resolution. A successful response never erases a newer dirty edit. */
export class ReviewSaver {
  private revision=0; private pending:ReviewDocument|null=null; private active:Promise<void>|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null; private closed=false; private blocked=false;
  constructor(private repository:ReviewRepository,private scope:ReviewScope,private changed:(s:SaveState)=>void,private debounceMs=600){}
  initialise(revision:number):void{
    if(this.active)throw new Error('Wait for the current save before loading a different revision.');
    if(this.timer)clearTimeout(this.timer);this.timer=null;this.pending=null;
    this.revision=revision;this.blocked=false;
  }
  queue(document:ReviewDocument):void{
    if(this.closed)return;this.pending=structuredClone(document);
    if(!this.blocked)this.changed({status:'dirty',revision:this.revision,message:'Changes waiting to save…'});
    if(this.timer)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.timer=null;void this.flush().catch(()=>{});},this.debounceMs);
  }
  async flush():Promise<void>{
    if(this.timer){clearTimeout(this.timer);this.timer=null;}
    if(this.blocked)throw new ReviewConflict();
    if(this.active){await this.active;if(this.pending)return this.flush();return;}
    if(!this.pending)return;
    const document=this.pending;this.pending=null;
    this.changed({status:'saving',revision:this.revision,message:'Saving review…'});
    this.active=(async()=>{
      try{
        const record=await this.repository.save(this.scope,document,this.revision);this.revision=record.revision;
        this.changed({status:'saved',revision:this.revision,message:this.repository.kind==='cloud'?'Saved to your account':this.repository.kind==='device'?'Saved on this device':'Saved for this test session'});
      }catch(error){
        if(!this.pending)this.pending=document;
        this.blocked=error instanceof ReviewConflict;
        this.changed({status:this.blocked?'conflict':'error',revision:this.revision,message:error instanceof Error?error.message:'Save failed. Retry or export the draft.'});throw error;
      }finally{this.active=null;}
    })();
    await this.active;if(this.pending&&!this.closed)await this.flush();
  }
  /** Closing the view stops debounce timers; caller should await flush first. */
  dispose():void{this.closed=true;if(this.timer)clearTimeout(this.timer);this.timer=null;}
}
