import { parseScope,sameScope,type JobScope } from '../contracts/evidence';
import { ensure,hash,id,integer,choice,record } from '../contracts/validation';
import { admit } from '../policy/admission';
import { digest } from '../policy/approval';
import { prepareMeasurements } from '../measurements/prepare';
import type { Actor,Transaction } from '../persistence/store';
import type { SolveRequest } from '../../takeoff/offcuts/core/types';
import { checkRequest,legacyDigest,projectOptimisation,type OptimisationResult } from './optimise';

export type TakeoffSnapshot={scope:JobScope;source:{revisionId:string;pageIndex:number;pageHash:string;transformVersion:number;imageRevision:string;pageId:string};geometryRevision:string;libraryRevision:string;approvedProfileId:string;request:SolveRequest};
export type TakeoffTransaction=Transaction & {canReviewTakeoff:boolean;takeoff:TakeoffSnapshot;result:(OptimisationResult & {previewDigest:string})|null};
/** Unregistered read-only server port: resolve all source/image/quote/profile
 * rows inside one authorized fresh transaction. The result is from a trusted
 * bounded worker, never browser/model input. No solver inside the transaction. */
export interface TakeoffStore{transactTakeoff<T>(scope:JobScope,actor:Actor,fn:(tx:TakeoffTransaction)=>T):Promise<T>}
export class TakeoffOptimisationService{
 constructor(private readonly store:TakeoffStore){}
 private run<T>(scope:JobScope,actor:Actor,revision:number,fn:(tx:TakeoffTransaction,binding:string)=>T){
  const s=parseScope(scope);return this.store.transactTakeoff(s,actor,tx=>{
   const p=tx.company.policy,b=tx.job.brief,r=tx.job.documentRun,t=tx.takeoff;
   ensure(s.kind==='quote'&&actor.kind==='user'&&tx.canReview&&tx.canReviewTakeoff&&tx.company.enabled&&sameScope(s,tx.job.scope)&&sameScope(s,t.scope),'takeoff authorization');
   ensure(integer(revision,'revision',1)===tx.job.revision&&b?.revision===revision&&sameScope(s,b.manifest.scope),'stale brief');
   ensure(admit(p,tx.authority,{scope:s,actorId:actor.id,action:'prepare_measurements',policyVersion:p.version,jobRevision:revision,trigger:'explicit'}).allowed,'takeoff admission');
   ensure(r&&!r.intent&&sameScope(s,r.manifest.scope)&&r.policyVersion===p.version&&digest(r.manifest)===digest(b.manifest),'stale document run');
   const task=tx.job.tasks.find(t=>t.id===r.taskId);
   ensure(task&&sameScope(task.scope,s)&&task.stage==='analyze'&&task.inputHash===r.inputHash&&task.policyVersion===p.version&&['completed','waiting_for_input'].includes(task.status),'document task not reviewable');
   ensure(!tx.job.tasks.some(t=>['running','queued','retryable_failure'].includes(t.status)),'active work');
   const m=prepareMeasurements(b);ensure(m.ready,'brief not reviewed');
   const src=t.source,pg=m.pages.find(x=>x.revisionId===src.revisionId&&x.pageIndex===src.pageIndex&&x.pageHash===src.pageHash&&x.transformVersion===src.transformVersion&&x.status==='analyzed');
   ensure(pg&&t.request.roof.quoteId===s.quoteId&&t.request.roof.pageId===src.pageId&&t.request.roof.imageRevision===src.imageRevision,'stale or mismatched plan');
   ensure(t.request.profile.id===id(t.approvedProfileId,'approved profile'),'profile mapping');hash(t.geometryRevision,'geometry revision');hash(t.libraryRevision,'library revision');
   checkRequest(t.request);
   const binding=digest({scope:s,actorId:actor.id,policyVersion:p.version,revision,inputHash:tx.job.inputHash,briefDigest:digest(b),snapshot:legacyDigest(t)});
   return fn(tx,binding);
  });
 }
 /** Server-internal worker input only; adapter must bind queued results to the
  * returned previewDigest and reauthorize at dispatch and publication. */
 prepare(scope:JobScope,actor:Actor,revision:number){return this.run(scope,actor,revision,(tx,previewDigest)=>({request:structuredClone(tx.takeoff.request),previewDigest,requestDigest:legacyDigest(tx.takeoff.request),writeAuthorized:false as const}));}
 review(scope:JobScope,actor:Actor,revision:number,previewDigest:string,raw:unknown){
  hash(previewDigest,'preview digest');const c=record(raw,'material review',['basis']);const basis=choice(c.basis,'basis',['lineal-metres','cover-square-metres','profile-square-metres'] as const);
  return this.run(scope,actor,revision,(tx,current)=>{ensure(current===previewDigest,'stale takeoff preview');ensure(tx.result&&tx.result.previewDigest===current,'no current worker result');return {...projectOptimisation(tx.takeoff.request,tx.result,basis),previewDigest:current};});
 }
}
