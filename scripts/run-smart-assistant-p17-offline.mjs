/** Run existing + P1.7 executable offline tests without installation/network.
 * Uses installed TypeScript or the explicit TYPESCRIPT_PATH test-loader hook.
 * Results do not establish SQL, RLS, browser, build or model acceptance.
 */
import {spawnSync} from 'node:child_process';
const scripts=[
 'test-smart-assistant-retrieval.cjs','test-smart-assistant-retrieval-services.cjs','test-smart-assistant-retrieval-metrics.mjs',
 'test-smart-assistant-speed.cjs','test-smart-assistant-speed-services.cjs','test-smart-assistant-speed-metrics.mjs',
 'test-smart-assistant-p17.cjs','test-smart-assistant-p17-services.cjs','test-smart-assistant-p17-metrics.mjs','test-smart-assistant-p17-corpus.cjs',
 'check-smart-assistant-speed-source.cjs','check-smart-assistant-retrieval-source.cjs','check-smart-assistant-p17-source.cjs',
];
for(const script of scripts){console.log(`\n=== ${script} ===`);const r=spawnSync(process.execPath,['scripts/'+script],{stdio:'inherit',env:process.env});if(r.error||r.status!==0){console.error('Offline checks stopped at',script,r.error?.message??r.status);process.exit(r.status||1);}}
console.log('\nAll executed OFFLINE suites passed. No live acceptance or performance claim is made.');
