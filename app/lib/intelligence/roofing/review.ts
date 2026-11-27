import { parseBrief, parseCandidates, type JobBrief } from '../contracts/brief';
import { evidenceIsCurrent, parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { choice, ensure, id, integer, record, text } from '../contracts/validation';
import { admit } from '../policy/admission';
import { digest } from '../policy/approval';
import type { Actor, IntelligenceStore, Transaction, RoofingReviewHistory } from '../persistence/store';
import { compileRoofingBrief } from './compile';
import { assessBrief } from '../brief/readiness';
import { coverage } from '../brief/coverage';

const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const ranks={critical:0,high:1,medium:2,low:3};
/** Internal UI view model. Text must be rendered literally; source coordinates are not URLs.
 * A real viewer must independently authorize each document and obtain a private signed URL. */
export function roofingReviewView(raw:unknown){
  const {brief,ready,blockers}=assessBrief(raw);const c=coverage(brief.manifest);
  const evidence=brief.evidence.map(e=>({id:e.id,filename:brief.manifest.documents.find(d=>d.revisionId===e.documentRevisionId)?.filename??'Unavailable source',revisionId:e.documentRevisionId,pageIndex:e.pageIndex,pageNumber:e.pageIndex+1,box:e.box,excerpt:e.excerpt,current:evidenceIsCurrent(e,brief.manifest)}));
  const pages=brief.manifest.documents.filter(d=>d.status==='active').flatMap(d=>Array.from({length:d.pageCount},(_,index)=>{const p=d.pages.find(p=>p.index===index);return {revisionId:d.revisionId,filename:d.filename,pageIndex:index,status:p?.status??'missing',relevance:p?.relevance??'unknown',selected:brief.selectedPages.some(s=>s.revisionId===d.revisionId&&s.pageIndex===index)};}));
  return {revision:brief.revision,manifestRevision:brief.manifest.revision,coverage:c,ready,blockers,
    issues:[...brief.issues].sort((a,b)=>ranks[a.priority]-ranks[b.priority]||cmp(a.id,b.id)),facts:brief.facts,evidence,pages,
    nextAction:!c.complete?'Complete source review or use manual workflow':ready?'Brief reviewed; separate measurement preparation required':'Review facts and resolve issues',manualAvailable:true as const};
}
/** Only authenticated user commands. Each write uses a job/brief CAS and fresh permissions.
 * No arbitrary client JobBrief, approvals, prices, measurement writes or external sends. */
export class RoofingReviewService {
  constructor(private readonly store:IntelligenceStore){}
  private run<T>(scope:JobScope,actor:Actor,fn:(tx:Transaction)=>T){
    return this.store.transact(parseScope(scope),actor,tx=>{
      const p=tx.company.policy;
      ensure(actor.kind==='user'&&tx.canReview&&tx.company.enabled&&sameScope(scope,tx.job.scope),'roofing review authorization');
      ensure(admit(p,tx.authority,{scope,actorId:actor.id,action:'analyze_documents',policyVersion:p.version,jobRevision:tx.job.revision,trigger:'explicit'}).allowed,'roofing review admission');
      return fn(tx);
    });
  }
  private remember(tx:Transaction,previous:RoofingReviewHistory['previous'],reason:string){
    const history=tx.job.roofingReviewHistory??(tx.job.roofingReviewHistory=[]);
    ensure(history.length<2000,'review history limit requires archival');
    history.push({actorId:tx.authority.actorId,atMs:integer(tx.nowMs,'trusted time',1),briefRevision:tx.job.revision,reason,previous:structuredClone(previous)});
  }
  private save(tx:Transaction,brief:JobBrief,event:string,target:string){
    ensure(!tx.job.tasks.some(t=>t.status==='running'||t.status==='queued'||t.status==='retryable_failure'),'active task blocks brief edit');
    const next=parseBrief(brief);ensure(next.revision===tx.job.revision+1,'brief version');
    tx.job.brief=next;tx.job.revision=next.revision;
    // Invalidate earlier task/approval bindings. Don't mark source manifest as changed.
    tx.job.inputHash=digest({previous:tx.job.inputHash,revision:next.revision,event,target});
    tx.job.audit.push({actorId:tx.authority.actorId,atMs:tx.nowMs,event,target});return next;
  }
  create(scope:JobScope,actor:Actor,expectedRevision:number){return this.run(scope,actor,tx=>{
    ensure(integer(expectedRevision,'expected revision',1)===tx.job.revision&&!tx.job.brief,'existing brief or stale revision');
    const r=tx.job.documentRun;ensure(r&&r.inputHash===tx.job.inputHash&&r.policyVersion===tx.company.policy.version&&r.manifest.revision===tx.job.revision&&sameScope(r.manifest.scope,scope),'stale document run');
    const task=tx.job.tasks.find(t=>t.id===r.taskId);ensure(task&&sameScope(task.scope,scope)&&task.stage==='analyze'&&task.inputHash===r.inputHash&&task.policyVersion===r.policyVersion&&['completed','waiting_for_input'].includes(task.status),'run not reviewable');
    return this.save(tx,compileRoofingBrief(r,expectedRevision+1),'roofing_brief_created',r.taskId);
  });}
  private current(tx:Transaction,expectedRevision:number){const b=tx.job.brief;ensure(b&&b.revision===integer(expectedRevision,'expected revision',1)&&tx.job.revision===expectedRevision,'stale brief');
    ensure(sameScope(b.manifest.scope,tx.job.scope),'brief scope');return parseBrief(b);}
  view(scope:JobScope,actor:Actor,expectedRevision:number){return this.run(scope,actor,tx=>{const b=this.current(tx,expectedRevision);const view=roofingReviewView(b);const r=tx.job.documentRun;const failures=r&&sameScope(r.manifest.scope,b.manifest.scope)&&r.manifest.revision===b.manifest.revision?r.failures:[];return {...view,pages:view.pages.map(p=>({...p,failureReason:failures.find(f=>f.revisionId===p.revisionId&&f.index===p.pageIndex)?.reason??null}))};});}
  apply(scope:JobScope,actor:Actor,expectedRevision:number,raw:unknown){return this.run(scope,actor,tx=>{
    const b=this.current(tx,expectedRevision);const r=record(raw,'review command',['kind','recordId','recordVersion','reason','outcome','correction','pages']);
    const kind=choice(r.kind,'command',['confirm_fact','reject_fact','correct_fact','resolve_issue','select_pages'] as const);
    if(kind==='select_pages'){
      record(raw,'selection',['kind','pages']);this.remember(tx,b.selectedPages,'Working page selection changed');return this.save(tx,{...b,revision:b.revision+1,selectedPages:r.pages as JobBrief['selectedPages']},'roofing_pages_selected',String(b.revision+1));
    }
    const target=id(r.recordId,'record id');const version=integer(r.recordVersion,'record version',1);const reason=text(r.reason,'review reason');
    const review={actorId:actor.id,atMs:integer(tx.nowMs,'trusted time',1),manifestRevision:b.manifest.revision,recordVersion:version+1,reason};
    const currentIds=new Set(b.evidence.filter(e=>evidenceIsCurrent(e,b.manifest)).map(e=>e.id));
    if(kind==='resolve_issue'){
      record(raw,'issue resolution',['kind','recordId','recordVersion','reason','outcome']);
      const i=b.issues.find(x=>x.id===target);ensure(i&&i.version===version&&i.state!=='superseded','stale issue');
      this.remember(tx,i,reason);const outcome=choice(r.outcome,'outcome',['resolved','not_applicable'] as const);
      ensure(i.evidenceIds.every(e=>currentIds.has(e)),'stale issue evidence');
      // No component inclusion/exclusion until actual component IDs can be checked in Phase 3/4.
      Object.assign(i,{version:version+1,state:'closed',decision:{...review,outcome,linkedComponentIds:[]}});
    }else{
      const f=b.facts.find(x=>x.id===target);ensure(f&&f.version===version&&f.state!=='superseded','stale fact');
      this.remember(tx,f,reason);
      if(kind==='correct_fact'){
        record(raw,'fact correction',['kind','recordId','recordVersion','reason','correction']);
        const correction=record(r.correction,'correction',['category','title','finding','basis','evidenceIds','quantity']);
        const revised=parseCandidates({facts:[{...correction,id:target}],issues:[]}).facts[0];
        ensure(revised.evidenceIds.every(e=>currentIds.has(e)),'stale correction evidence');
        // Explicit correction requires another confirmation; old quantity/review cannot leak through.
        b.facts[b.facts.indexOf(f)]={...revised,version:version+1,state:'proposed'};
      }else{
        record(raw,'fact decision',['kind','recordId','recordVersion','reason']);
        if(kind==='confirm_fact')ensure(f.evidenceIds.every(e=>currentIds.has(e)),'stale fact evidence');
        Object.assign(f,{version:version+1,state:kind==='confirm_fact'?'confirmed':'rejected',review});
      }
    }
    return this.save(tx,{...b,revision:b.revision+1},'roofing_'+kind,target);
  });}
}
