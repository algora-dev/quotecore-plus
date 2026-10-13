/** Focused V1.1 continuity contract tests. Offline/static only: no live Supabase. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root}=require('./sa-speed-test-loader.cjs');
const {load,uuid}=require('./sa-resolver/fixture.cjs');
const {prepareTaskTurn}=load('tasks/controller.server.ts');
const {taskControl}=load('tasks/boundary.ts');
const migration=fs.readFileSync(path.join(root,'backend/supabase/migrations/20261013173000_sa_v2_context_continuity.sql'),'utf8');
const controller=fs.readFileSync(path.join(root,'app/lib/smart-assistant/tasks/controller.server.ts'),'utf8');
const tools=fs.readFileSync(path.join(root,'app/lib/smart-assistant/v2/tools.server.ts'),'utf8');

test('continuity migration extends task and resolver metadata to three hours without touching action TTLs',()=>{
  assert.match(migration,/assistant_v2_task_context[\s\S]*interval '3 hours'/);
  assert.match(migration,/assistant_v2_resolution_states[\s\S]*interval '3 hours'/);
  assert.match(migration,/clock_timestamp\(\)\+interval '3 hours'/);
  assert.doesNotMatch(migration,/assistant_v2_actions[\s\S]{0,120}expires_at\s*=/);
});

test('new tasks can see authorised transcript while strict task-owned state stays filtered',()=>{
  assert.match(controller,/transcriptRun: \(id: string \| null\) => !!id/);
  assert.match(controller,/Recent text transcript may be used to interpret an EXPLICIT backward reference/);
  assert.match(controller,/Recent transcript never grants mutation authority/);
  assert.match(controller,/visibleRun: \(id: string \| null\) => !!id && ids\.has\(id\)/);
});

test('committed working brief survives conversational task boundaries',()=>{
  assert.match(tools,/workflowHint\.state !== 'committed'/);
  assert.match(tools,/workflowEnabled && continuingWorkflow/);
  assert.match(migration,/b\.workflow_state='committed' AND b\.produced_quote_id IS NOT NULL AND b\.committed_snapshot IS NOT NULL THEN CONTINUE/);
});


test('casual thanks stays conversational while a closed task remains transcript-visible to a new task',async()=>{
  assert.equal(taskControl('thanks'),null);
  assert.equal(taskControl('thank you'),null);
  const now=new Date('2026-10-13T18:00:00.000Z'),priorRun=uuid(700),runId=uuid(701);
  const snapshot={task:{id:uuid(702),version:9,status:'closed',label:'Preparing quote',lastRunId:priorRun,startedAt:'2026-10-13T16:00:00.000Z',updatedAt:'2026-10-13T16:30:00.000Z',expiresAt:'2026-10-13T19:30:00.000Z',closure:'solved',boundary:false},resolution:null,runIds:[priorRun],pendingMessage:null};
  const fresh={...snapshot.task,id:uuid(703),version:10,status:'open',label:'New request',lastRunId:runId,startedAt:now.toISOString(),updatedAt:now.toISOString(),expiresAt:new Date(now.getTime()+3*60*60*1000).toISOString(),closure:null};
  const prepared=await prepareTaskTurn({message:'Actually, change that quote to 8,500.',runId,now,store:{read:async()=>snapshot,begin:async(_before,decision)=>{assert.equal(decision.disposition,'new');return fresh;},finish:async()=>fresh},emit:async()=>uuid(704)});
  assert.equal(prepared.decision.disposition,'new');
  assert.equal(prepared.visibleRun(priorRun),false);
  assert.equal(prepared.transcriptRun(priorRun),true);
  assert.match(prepared.prompt(),/Resolve the referenced record again with current tools and permissions/);
});
