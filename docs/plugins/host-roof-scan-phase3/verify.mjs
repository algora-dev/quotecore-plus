#!/usr/bin/env node
/** Complete-repository gate: uses locked dependencies, real shared geometry and real MCP SDK.
 * No installation, deployment, paid APIs, or test adapters. Browser/live host gates are separate.
 */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--out'))throw Error('Use --out /absolute/evidence-directory, or no arguments');
const out=args.length?path.resolve(args[1]):fs.mkdtempSync(path.join(os.tmpdir(),'qc-phase3-verify-'));
if(out===root||out.startsWith(root+path.sep))throw Error('Evidence must be outside the repository');fs.mkdirSync(out,{recursive:true});
// The phase2 runner invokes all phase1b gates, including actual SDK and the normal project build.
const build=path.join(out,'baseline-gates/baseline-gates/core-build'),env={...process.env,QC_TEST_OUT:build};delete env.QC_ALLOW_SLICE_ADAPTERS;
if(fs.existsSync(path.join(build,'TEST_ADAPTERS_ONLY.json')))throw Error('Refusing a build directory containing source-slice adapters. Use a fresh directory.');
const results=[];
function run(name,cmd,timeout=120000){const r=spawnSync(process.execPath,cmd,{cwd:root,env,timeout,encoding:'utf8',maxBuffer:20*1024*1024});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.message:''));results.push({name,status:r.status===0?'PASS':'FAIL',exitCode:r.status});console.log(results.at(-1));return r.status===0;}
run('full-existing-gates',['docs/plugins/host-roof-scan-phase2/verify.mjs','--out',path.join(out,'baseline-gates')],1500000);
if(fs.existsSync(path.join(build,'app/lib/free-tools/host-roof-scan/references.js'))&&!fs.existsSync(path.join(build,'TEST_ADAPTERS_ONLY.json'))){
 run('reference-core-tests',['--test','docs/plugins/host-roof-scan-phase3/tests/references.test.cjs']);
 run('real-service-regressions',['--test','docs/plugins/host-roof-scan-phase3/tests/service.test.cjs']);
 run('widget-functions',['--test','docs/plugins/host-roof-scan-phase3/tests/widget-functions.test.cjs']);
}else results.push({name:'reference-core-and-service-tests',status:'BLOCKED',reason:'Real isolated core build missing'});
run('reference-ops-tests',['--test','docs/plugins/host-roof-scan-phase3/tests/reference-ops.test.mjs']);
run('image-input-and-origin-regressions',['--import','tsx','--test','app/lib/free-tools/host-roof-scan/image-ingestion.test.ts']);
const report={timestamp:new Date().toISOString(),node:process.version,results,coreBuild:build,limitations:['Browser script is a separate mandatory gate.','No actual Supabase storage, Vercel deployment or ChatGPT model image visibility is exercised here.','No source-slice adapters may be used to satisfy these gates.']};
fs.writeFileSync(path.join(out,'PHASE3_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=results.every(r=>r.status==='PASS')?0:1;
