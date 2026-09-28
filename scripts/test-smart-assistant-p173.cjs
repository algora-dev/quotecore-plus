/* P1.7.3 release-hardening checks. Offline only: no network/database/model. */
const {root}=require('./sa-speed-test-loader.cjs');
const path=require('node:path'),fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const load=p=>require(path.join(root,'app/lib/smart-assistant',p));
const {extractAnchors}=load('resolver/anchors.ts');
const {failedTurns}=load('tasks/presentation.ts');
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('plural entity customer qualifiers are deterministic',()=>{
  assert.equal(extractAnchors('Show me quotes for John Smith').customer,'John Smith');
  assert.equal(extractAnchors('Show orders for John Smith').customer,'John Smith');
  assert.equal(extractAnchors('Show quotes for John Smith with Ridge').customer,'John Smith');
});

test('edit-shaped component anchors survive labour quantity waste and pitch wording',()=>{
  for(const text of [
    'Set Ridge labour rate to 25 per m on quote 1014',
    'Set Ridge quantity to 40 on quote 1014',
    'Change the waste on Ridge component to 10% on quote 1014',
    'Change the pitch of Ridge component to 25 degrees on quote 1014',
  ]) assert.equal(extractAnchors(text).child,'Ridge',text);
});

test('canonical setup failure is explicit and not retryable',()=>{
  const run=uuid(1),request=uuid(2),message=uuid(3);
  const failures=failedTurns([{id:message,role:'user',content:'Show quotes',runId:run,createdAt:new Date().toISOString()}],[{id:run,requestId:request,status:'failed',errorCode:'migration_required'}]);
  assert.equal(failures.length,1);assert.equal(failures[0].canRetry,false);assert.match(failures[0].copy,/setup is incomplete/i);
});

test('provider canary includes a function schema and no company data surface',()=>{
  const route=fs.readFileSync(path.join(root,'app/api/admin/smart-assistant/health/route.ts'),'utf8');
  assert.match(route,/health_probe_noop/);assert.match(route,/runChatStep/);assert.doesNotMatch(route,/companyId|company_id|conversationId|conversation_id/);
});
