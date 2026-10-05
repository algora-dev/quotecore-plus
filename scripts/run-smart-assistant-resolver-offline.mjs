/** Offline executable + source checks only; no install, DB, model or build. */
import {spawnSync} from 'node:child_process';
const stages=[['scripts/run-smart-assistant-p17-offline.mjs'],['--test','scripts/test-smart-assistant-resolver-pure.cjs','scripts/test-smart-assistant-resolver-services.cjs','scripts/test-smart-assistant-resolver-integration.cjs'],['scripts/check-smart-assistant-resolver-source.cjs']];
for(const args of stages){console.log('\n=== '+args.join(' ')+' ===');const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.error||r.status!==0){console.error('Offline checks stopped:',r.error?.message??r.status);process.exit(r.status||1);}}
console.log('\nAll executed P1.7.1 OFFLINE suites and static checks passed. This is not live release acceptance.');
