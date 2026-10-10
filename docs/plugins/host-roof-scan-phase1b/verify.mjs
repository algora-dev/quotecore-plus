#!/usr/bin/env node
/** Run after npm ci in the full integration repository. Never installs or upgrades dependencies. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const argv=process.argv.slice(2);
if(argv.length && !(argv.length===2 && argv[0]==='--out')) throw new Error('Use --out /absolute/evidence-directory, or no arguments.');
const out=argv.length?path.resolve(argv[1]):fs.mkdtempSync(path.join(os.tmpdir(),'qc-phase1b-verification-'));
if(out===root || out.startsWith(root+path.sep)) throw new Error('Write verification evidence outside the repository.');
fs.mkdirSync(out,{recursive:true});
const env={...process.env,QC_TEST_OUT:path.join(out,'core-build'),QC_TYPESCRIPT:path.join(root,'node_modules/typescript'),QC_SHARP:path.join(root,'node_modules/sharp'),QC_NODE_TYPES:path.join(root,'node_modules/@types')};
const results=[];
function run(name,args,timeout=120000){
 const start=Date.now();const r=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout,maxBuffer:20*1024*1024});
 fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.message:'')+'\n');
 const item={name,status:r.status===0?'PASS':'FAIL',exit_code:r.status,signal:r.signal,seconds:Math.round((Date.now()-start)/100)/10};
 results.push(item);console.log(item.status+' '+name);return r.status===0;
}
const production=[
 'app/mcp/route.ts','app/mcp/host-scan/route.ts','app/mcp/host-scan/review/route.ts','app/api/public/host-roof-scan/route.ts',
 'app/lib/free-tools/mcp/transport.ts',
 ...fs.readdirSync(path.join(root,'app/lib/free-tools/host-roof-scan')).filter(f=>f.endsWith('.ts')).map(f=>'app/lib/free-tools/host-roof-scan/'+f),
];
run('whole-project-typescript',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],300000);
run('scoped-eslint',['node_modules/eslint/bin/eslint.js',...production],180000);
const built=run('isolated-core-compile',['docs/plugins/host-roof-scan-phase1/tests/build-core.cjs']);
if(built){
 run('core-tests',['--test','docs/plugins/host-roof-scan-phase1/tests/core.test.cjs']);
 run('configuration-http-tests',['--test','docs/plugins/host-roof-scan-phase1b/tests/config-http.test.cjs']);
}else{
 results.push({name:'core-tests',status:'BLOCKED',reason:'isolated compile failed'});
 results.push({name:'configuration-http-tests',status:'BLOCKED',reason:'isolated compile failed'});
}
run('staging-helper-tests',['--test','docs/plugins/host-roof-scan-phase1b/tests/ops.test.mjs']);
run('actual-sdk-route-tests',['--import','tsx','--test','docs/plugins/host-roof-scan-phase1b/tests/sdk-http.test.mjs'],180000);
const prebuild=run('normal-project-prebuild',['scripts/check-server-deps.mjs']);
if(prebuild)run('normal-next-build',['node_modules/next/dist/bin/next','build'],600000);
else results.push({name:'normal-next-build',status:'BLOCKED',reason:'project prebuild failed'});
const report={timestamp_utc:new Date().toISOString(),node:process.version,results,limitations:['Does not deploy, test actual storage or connect to a live AI host.','The SDK test uses actual protocol code, synthetic geometry and a mocked rate-limit network response.','Any nonzero baseline TypeScript/lint/build results must be compared, disclosed and resolved or explicitly accepted by the owner; this runner does not waive them.']};
fs.writeFileSync(path.join(out,'VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');
console.log('Evidence: '+out);
process.exitCode=results.every(r=>r.status==='PASS')?0:1;
