/* Executable conversation fixture using the REAL router/controller/resolver and
 * compiler. Transport/order evaluation is explicit in-memory data, not PostgreSQL
 * or a claim about RLS, Luna or browser behaviour. */
const base=require('../sa-resolver/fixture.cjs');
const {load,uuid}=base;
const {prepareTaskTurn}=load('tasks/controller.server.ts');
const {parseResolutionState}=load('resolver/state.ts');
function conversation(db={},extra={}) {
 const s=base.setup(db,{clock:new Date('2026-09-28T12:00:00Z'),...extra});
 const bindings=new Map(), completed=new Set(), states=new Map();
 let task=null,pendingMessage=null;
 s.trace=[];s.taskEvents=[];s.transcript=[];
 const originalOverride=s.override;
 s.override=async(plan,signal)=>{
   if(originalOverride){const result=await originalOverride(plan,signal);if(result!==undefined)return result;}
   if(plan.orderBy?.length && s.db[plan.source])s.db[plan.source].sort((a,b)=>{
     for(const sort of plan.orderBy){const x=a[sort.field],y=b[sort.field];if(x!==y)return (x<y?-1:1)*(sort.direction==='asc'?1:-1);}
     return 0;
   });
 };
 s.snapshot=()=>({task:task?structuredClone(task):null,pendingMessage,
   runIds:task?[...bindings].filter(([id,b])=>b.taskId===task.id&&completed.has(id)).map(([id])=>id):[],
   resolution:task&&task.status!=='closed'?[...states.values()].reverse().find(x=>x.taskId===task.id&&completed.has(x.runId))?.saved??null:null});
 s.close=(closure='solved',expected=task)=>{
   if(s.inFlight)throw new Error('run_in_progress');
   if(!task||!expected||task.id!==expected.id||task.version!==expected.version)throw new Error('task_changed');
   task={...task,status:'closed',closure,version:task.version+1,updatedAt:s.clock.toISOString(),boundary:false};pendingMessage=null;
 };
 s.ask=async(message,{model,failFinish=false,...runExtra}={})=>{
   const runId=uuid(s.run+1),questionCards=[];s.reads=[];s.inFlight=true;
   const store={read:async()=>s.snapshot(),begin:async(before,decision,label)=>{
     if(task && (before.task?.id!==task.id||before.task.version!==task.version))throw new Error('task_changed');
     const fresh=decision.disposition==='new'||!task;
     task={id:fresh?uuid(s.nextId++):task.id,version:(task?.version??0)+1,status:decision.disposition==='close'?'closed':decision.disposition==='ask_boundary'?'awaiting_input':'open',label,lastRunId:runId,
       startedAt:fresh?s.clock.toISOString():task.startedAt,updatedAt:s.clock.toISOString(),expiresAt:new Date(s.clock.getTime()+900000).toISOString(),closure:decision.closure??null,boundary:decision.disposition==='ask_boundary'};
     pendingMessage=task.boundary?decision.message:null;bindings.set(runId,{taskId:task.id,version:task.version});return structuredClone(task);
   },finish:async(status,label)=>{
     if(failFinish)throw new Error('fixture metadata failure');
     if(task.lastRunId!==runId||bindings.get(runId)?.version!==task.version)throw new Error('task_changed');
     if(task.status!=='closed'&&!task.boundary)task={...task,status,label};return structuredClone(task);
   }};
   const resolutionStore={load:async(id)=>{
     const saved=s.snapshot().resolution;
     return saved&&(!id||id===saved.id)?structuredClone(saved):null;
   },save:async(state,sections)=>{
     if(!parseResolutionState(JSON.parse(JSON.stringify(state))))throw new Error('invalid actual resolver output');
     const saved={id:uuid(s.nextId++),expiresAt:new Date(s.clock.getTime()+900000).toISOString(),state:JSON.parse(JSON.stringify(state))};
     states.set(runId,{taskId:task.id,runId,saved});s.saved.push(saved);return structuredClone(saved);
   }};
   try{
     const prepared=await prepareTaskTurn({message,runId,store,now:s.clock,emit:async content=>{questionCards.push({content});return uuid(s.nextId++);},report:e=>s.taskEvents.push(e)});
     s.prepared=prepared;
     let result;
     if(prepared.terminal){s.run++;s.cards=questionCards;result={state:'task_control',answer:prepared.terminal};}
     else{
       result=await s.turn(prepared.message,{taskTurn:{decision:prepared.decision,previous:prepared.previous},onResult:prepared.noteResolver,store:resolutionStore,...runExtra});
       if(!result&&model)result=await model(s.service,prepared);
     }
     if(result){await prepared.finish();completed.add(runId);}
     const trace={message,runId,disposition:prepared.decision.disposition,reason:prepared.decision.reason,taskId:task?.id,state:result?.state??'model_required',answer:result?.answer??null,plans:s.reads.map(x=>x.plan),cards:s.cards.map(c=>c.content)};
     s.trace.push(trace);s.transcript.push({runId,role:'user',content:message});if(result?.answer)s.transcript.push({runId,role:'assistant',content:result.answer});
     return result;
   } finally {s.inFlight=false;s.clock=new Date(s.clock.getTime()+1000);}
 };
 return s;
}
module.exports={...base,conversation};
