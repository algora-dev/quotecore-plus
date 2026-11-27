import { parseScope,sameScope,type JobScope } from '../contracts/evidence';
import { ensure,integer,hash,record,ids,id } from '../contracts/validation';
import { admit } from '../policy/admission';
import { digest } from '../policy/approval';
import type { Actor, IntelligenceStore, Transaction } from '../persistence/store';
import { prepareMeasurements } from './prepare';

/** Authenticated preview and fresh handoff validation only. No external side
 * effects and no write authorization. Integrated import must revalidate and
 * stage atomically in its own authorized transaction; never use client lines. */
export class MeasurementPreparationService {
  constructor(private readonly store:IntelligenceStore){}
  private run(scope:JobScope,actor:Actor,expectedRevision:number,fn:(tx:Transaction)=>ReturnType<typeof prepareMeasurements>){
    const s=parseScope(scope);
    return this.store.transact(s,actor,tx=>{
      const policy=tx.company.policy;
      ensure(s.kind==='quote'&&actor.kind==='user'&&tx.canReview&&tx.company.enabled&&sameScope(s,tx.job.scope),'measurement authorization');
      ensure(integer(expectedRevision,'expected revision',1)===tx.job.revision,'stale job');
      ensure(admit(policy,tx.authority,{scope:s,actorId:actor.id,action:'prepare_measurements',policyVersion:policy.version,jobRevision:tx.job.revision,trigger:'explicit'}).allowed,'measurement admission');
      const b=tx.job.brief,r=tx.job.documentRun;
      ensure(b&&b.revision===expectedRevision&&sameScope(b.manifest.scope,s),'stale brief');
      ensure(r&&!r.intent&&sameScope(r.manifest.scope,s)&&r.policyVersion===policy.version&&digest(r.manifest)===digest(b.manifest),'stale document manifest or policy');
      const task=tx.job.tasks.find(t=>t.id===r.taskId);
      ensure(task&&sameScope(task.scope,s)&&task.stage==='analyze'&&task.inputHash===r.inputHash&&task.policyVersion===r.policyVersion&&['completed','waiting_for_input'].includes(task.status),'document task not reviewable');
      ensure(!tx.job.tasks.some(t=>['running','queued','retryable_failure'].includes(t.status)),'active work');
      const data=fn(tx);
      // Digest binds exact server projection, actor, current policy, revision
      // and input hash. It is not a signature or an approval receipt.
      return {...data,previewDigest:digest({scope:s,actorId:actor.id,policyVersion:policy.version,inputHash:tx.job.inputHash,data})};
    });
  }
  preview(scope:JobScope,actor:Actor,expectedRevision:number){return this.run(scope,actor,expectedRevision,tx=>prepareMeasurements(tx.job.brief));}
  async recheck(scope:JobScope,actor:Actor,expectedRevision:number,previewDigest:string){
    hash(previewDigest,'preview digest');
    const p=await this.preview(scope,actor,expectedRevision);
    ensure(p.previewDigest===previewDigest,'stale measurement preview');
    ensure(p.ready,'brief review incomplete');return p;
  }
  /** User selects proposed rows and at most one plan for opening the legacy
   * workstation. No client geometry, component IDs, pitch or quantities accepted. */
  async handoff(scope:JobScope,actor:Actor,expectedRevision:number,previewDigest:string,raw:unknown){
    const command=record(raw,'measurement handoff',['factIds','plan']);
    const factIds=ids(command.factIds,'fact IDs');ensure(factIds.length<=60,'legacy import line limit');
    const plan=command.plan===null?null:record(command.plan,'plan',['revisionId','pageIndex']);
    ensure(factIds.length>0||plan!==null,'empty handoff');
    const p=await this.recheck(scope,actor,expectedRevision,previewDigest);
    const lines=factIds.map(factId=>{const row=p.candidates.find(c=>c.factId===factId);ensure(row,'not an eligible quantity');return row;});
    const page=plan===null?null:p.pages.find(x=>x.revisionId===id(plan.revisionId,'plan revision')&&x.pageIndex===integer(plan.pageIndex,'plan page'));
    ensure(plan===null||page?.status==='analyzed','plan not analyzed or unavailable');
    return {scope:parseScope(scope),briefRevision:expectedRevision,previewDigest,lines,plan:page??null,
      calibrationHints:page?p.calibrationHints.filter(h=>h.evidence.documentRevisionId===page.revisionId&&h.evidence.pageIndex===page.pageIndex):[],
      pitchContext:p.pitchContext,requiresSeparateImportAndGeometryReview:true as const,writeAuthorized:false as const};
  }
}
