/** P1.7.2 OFFLINE runner. Original executable suites are retained unmodified.
 * Historical source-manifest checks target older packages; the new source gate
 * uses the actual 28 September baseline. No network, credentials or fixtures in
 * a live account are used here. This is not a deployment acceptance test. */
import {spawnSync} from 'node:child_process';
const scripts=[
 'test-smart-assistant-retrieval.cjs','test-smart-assistant-retrieval-services.cjs','test-smart-assistant-retrieval-metrics.mjs',
 'test-smart-assistant-speed.cjs','test-smart-assistant-speed-services.cjs','test-smart-assistant-speed-metrics.mjs',
 'test-smart-assistant-p17.cjs','test-smart-assistant-p17-services.cjs','test-smart-assistant-p17-metrics.mjs','test-smart-assistant-p17-corpus.cjs',
 'test-smart-assistant-resolver-pure.cjs','test-smart-assistant-resolver-services.cjs','test-smart-assistant-resolver-integration.cjs',
 'test-smart-assistant-task-boundary.cjs','test-smart-assistant-task-conversations.cjs','test-smart-assistant-task-integration.cjs',
 'test-smart-assistant-task-http.cjs','test-smart-assistant-task-presentation.cjs',
];
for(const name of scripts){console.log('\n=== '+name+' ===');const r=spawnSync(process.execPath,['scripts/'+name],{stdio:'inherit',env:process.env});if(r.error||r.status!==0){console.error('FAILED',name,r.error?.message??r.status);process.exit(r.status||1);}}
for(const name of ['check-smart-assistant-speed-source.cjs','check-smart-assistant-retrieval-source.cjs','check-smart-assistant-p17-source.cjs','check-smart-assistant-task-quality-source.cjs']) {const r=spawnSync(process.execPath,['scripts/'+name],{stdio:'inherit',env:process.env});if(r.error||r.status!==0)process.exit(r.status||1);}
console.log('\nAll executable OFFLINE suites passed. Mock transport != database security, real model, browser or live speed.');
