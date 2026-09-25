/* Synthetic report tests only. These timings are NOT a QuoteCore benchmark. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {percentile,summarize,decode} from './report-smart-assistant-speed.mjs';
test('nearest-rank percentiles never convert missing data to zero',()=>{assert.equal(percentile([],0.5),null);assert.equal(percentile([30,10,20],0.5),20);assert.equal(percentile([null,NaN],0.95),null)});
test('decodes prefixed logs and message envelopes but not unrelated content',()=>{const line='[smart-assistant:performance] '+JSON.stringify({event:'sa_turn_performance',runId:'r'});assert.equal(decode(line).runId,'r');assert.equal(decode(JSON.stringify({message:line})).runId,'r');assert.equal(decode('unrelated'),null)});
test('uncertain finish is not counted as canonical completed; repeated logs deduplicate',()=>{
  const t={event:'sa_turn_performance',runId:'r',path:'fast_records',model:'configured-model',modelCalls:0,toolCalls:0,status:'completed',pipelineMs:500,firstModelTokenMs:null,tokensIn:0,tokensOut:0};
  const r={event:'sa_request_performance',runId:'r',status:'finish_uncertain',requestMs:900};
  const result=summarize([t,t,r].map(JSON.stringify).join('\n'));assert.equal(result.groups[0].attempts,1);assert.equal(result.groups[0].confirmedCompleted,0);assert.equal(result.groups[0].finishUncertain,1);assert.equal(result.groups[0].backendFirstModelTokenMs.p50,null);assert.match(result.groups[0].key,/no-model/);
});
test('benchmark plan runs without credentials or network',()=>{const r=spawnSync(process.execPath,['scripts/benchmark-smart-assistant-speed.mjs','--plan'],{encoding:'utf8'});assert.equal(r.status,0);assert.match(r.stdout,/OFFLINE PLAN ONLY/)});
test('live benchmark refuses without explicit paid-turn opt-in',()=>{const r=spawnSync(process.execPath,['scripts/benchmark-smart-assistant-speed.mjs','--run'],{encoding:'utf8',env:{...process.env,SA_SPEED_BENCH_ACK:''}});assert.equal(r.status,2);assert.match(r.stderr,/Explicit SA_SPEED_BENCH_ACK/)});
