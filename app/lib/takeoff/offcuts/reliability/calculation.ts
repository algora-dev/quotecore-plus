import {recoveryId} from './id';
import { CALCULATION_LIMIT_MS, WORKER_PROTOCOL, STAGE_LABELS, checkedPlanMatches, isStage, requestFingerprint,
  solutionFingerprint, type CalculationJournal, type CalculationKind, type CheckedPlan, type WorkerMessage, type WorkerRequest } from './protocol';
import type { SolveRequest } from '../core/types';
export interface WorkerPort {
  onmessage:((event:MessageEvent)=>void)|null; onerror:((event:ErrorEvent)=>void)|null;
  onmessageerror:((event:MessageEvent)=>void)|null; postMessage(value:unknown):void; terminate():void;
}
export interface CalculationCallbacks {
  progress:(journal:CalculationJournal)=>void;
  result:(message:WorkerMessage)=>void;
  failure:(message:string,plan:CheckedPlan|null,journal:CalculationJournal)=>void;
}
/** The deadline lives on the UI thread: it can terminate a worker even when that
 * worker is stuck inside a synchronous geometry routine. Never reset on progress. */
export class CalculationController {
  private port:WorkerPort|null=null; private timer:ReturnType<typeof setTimeout>|null=null;
  private started=0; private finished=false; private fallback:CheckedPlan|null=null;
  private state:CalculationJournal;
  constructor(private request:SolveRequest,kind:CalculationKind,private callbacks:CalculationCallbacks,
    private limitMs=CALCULATION_LIMIT_MS,runId:string=recoveryId()) {
    const at=new Date().toISOString();
    this.limitMs=Number.isFinite(limitMs)?Math.max(1,Math.min(120_000,limitMs)):CALCULATION_LIMIT_MS;
    this.state={schemaVersion:1,runId,engineVersion:'2.22',kind,status:'saving',stage:'saving-input',startedAt:at,updatedAt:at,
      elapsedMs:0,limitMs:this.limitMs,requestFingerprint:requestFingerprint(request),completed:0,total:0,
      checkedFallbackAvailable:false,message:STAGE_LABELS['saving-input'],events:[]};
  }
  journal():CalculationJournal {return structuredClone(this.state);}
  private notify(message?:string):void {
    this.state.updatedAt=new Date().toISOString();this.state.elapsedMs=this.started?Math.max(0,performance.now()-this.started):0;
    if(message){this.state.message=message;this.state.events.push({at:this.state.updatedAt,stage:this.state.stage,message});this.state.events=this.state.events.slice(-60);}
    this.callbacks.progress(this.journal());
  }
  start(create:()=>WorkerPort,extras:Pick<WorkerRequest,'alternative'|'salvage'>={}):void {
    if(this.finished||this.port)return;
    this.started=performance.now();this.state.status='running';this.state.stage='starting-worker';
    try {
      this.notify(STAGE_LABELS[this.state.stage]);this.port=create();
      this.timer=setTimeout(()=>this.fail('timed-out','Calculation reached its time limit. Your measurements and reviewed faces are kept.'),this.limitMs);
      this.port.onmessage=e=>{try{this.receive(e.data as WorkerMessage);}catch(error){this.fail('failed',`Could not apply the calculation result: ${error instanceof Error?error.message:'invalid response'}. Your original plan is kept.`);}};
      this.port.onerror=e=>{e.preventDefault?.();this.fail('failed',`Worker failed: ${e.message||'module could not load'}. Export diagnostics and check the worker deployment.`);};
      this.port.onmessageerror=()=>this.fail('failed','The worker result could not be read. Reviewed faces and the original plan are kept.');
      this.port.postMessage({protocol:WORKER_PROTOCOL,id:this.state.runId,request:this.request,limitMs:this.limitMs,...extras});
    } catch(error){this.fail('failed',error instanceof Error?error.message:'Calculation could not start.');}
  }
  private receive(m:WorkerMessage):void {
    if(this.finished||!m||m.id!==this.state.runId)return;
    if(m.protocol!==WORKER_PROTOCOL){this.fail('failed','The page and worker versions do not match. Reload the updated app; the saved measurements can be restored.');return;}
    if(performance.now()-this.started>=this.limitMs){this.fail('timed-out','Calculation reached its time limit. Reviewed faces are kept.');return;}
    if(m.kind==='stage'){
      if(!isStage(m.stage))throw new Error('Unknown calculation stage');
      this.state.stage=m.stage;this.notify(STAGE_LABELS[m.stage]);return;
    }
    if(m.kind==='progress'){
      if(!isStage(m.stage)||!Number.isFinite(m.completed)||!Number.isFinite(m.total)||m.completed<0||m.total<0||m.completed>m.total)throw new Error('Invalid progress');
      this.state.stage=m.stage;this.state.completed=m.completed;this.state.total=m.total;this.notify();return;
    }
    if(m.kind==='checked-plan'){
      if(this.state.kind!=='recommended'||!checkedPlanMatches(m.plan,this.request))throw new Error('Unverified fallback');
      if(!this.fallback||m.plan.solution.metrics.newMaterialMm2<this.fallback.solution.metrics.newMaterialMm2)this.fallback=m.plan;
      this.state.checkedFallbackAvailable=true;this.notify();return;
    }
    if(m.kind==='error'){this.fail(m.code==='CALCULATION_LIMIT'?'timed-out':'failed',m.message);return;}
    const correct=this.state.kind==='recommended'?m.kind==='result':this.state.kind==='salvage'?m.kind==='salvage-result':m.kind==='alternative-result';
    if(!correct)throw new Error('Unexpected result type');
    if(m.kind==='result'&&!checkedPlanMatches(m.plan,this.request))throw new Error('Result validation receipt does not match');
    if((m.kind==='alternative-result'||m.kind==='salvage-result')&&m.result.solution&&(!m.plan||!checkedPlanMatches(m.plan,this.request)||m.result.solution.layoutId!==m.plan.solution.layoutId||solutionFingerprint(m.result.solution)!==m.plan.solutionFingerprint))throw new Error('Alternative validation receipt does not match');
    // Stop computing before applying/rendering. Exceptions are caught above and
    // surface a recoverable failure instead of leaving a stale busy overlay.
    this.stopPort();this.state.status='complete';this.state.stage='returning-result';this.notify('Checked calculation complete.');
    this.callbacks.result(m);this.finished=true;
  }
  fail(status:'failed'|'timed-out',message:string):void {
    if(this.finished)return;this.finished=true;this.stopPort();this.state.status=status;this.notify(message.slice(0,1000));
    this.callbacks.failure(message,status==='timed-out'?this.fallback:null,this.journal());
  }
  cancel(message='Calculation cancelled. Reviewed faces and the original plan are kept.'):void {
    if(this.finished)return;this.finished=true;this.stopPort();this.state.status='cancelled';this.notify(message);
  }
  dispose():void {this.finished=true;this.stopPort();}
  private stopPort():void {
    if(this.timer)clearTimeout(this.timer);this.timer=null;
    if(this.port){this.port.onmessage=null;this.port.onerror=null;this.port.onmessageerror=null;this.port.terminate();this.port=null;}
  }
}
