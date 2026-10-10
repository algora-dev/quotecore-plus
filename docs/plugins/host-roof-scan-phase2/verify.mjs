#!/usr/bin/env node
// Run after npm ci in the complete current repository. No dependency upgrades or ignored failures.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--out'))throw Error('Use --out /absolute/evidence-directory or no arguments');
const out=args.length?path.resolve(args[1]):fs.mkdtempSync(path.join(os.tmpdir(),'qc-phase2-verify-'));if(out===root||out.startsWith(root+path.sep))throw Error('Evidence must be outside the source repository');fs.mkdirSync(out,{recursive:true});
const env={...process.env,QC_TEST_OUT:path.join(out,'baseline-gates/core-build')};const results=[];
function run(name,cmd,timeout=120000){const r=spawnSync(process.execPath,cmd,{cwd:root,env,timeout,encoding:'utf8',maxBuffer:20*1024*1024});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.message:''));results.push({name,status:r.status===0?'PASS':'FAIL',exitCode:r.status});console.log(results.at(-1));}
run('full-existing-gates',['docs/plugins/host-roof-scan-phase1b/verify.mjs','--out',path.join(out,'baseline-gates')],1200000);
if(fs.existsSync(path.join(env.QC_TEST_OUT,'app/lib/free-tools/host-roof-scan/image-delivery.js')))run('new-image-delivery-core',['--test','docs/plugins/host-roof-scan-phase2/tests/image-delivery.test.cjs']);else results.push({name:'new-image-delivery-core',status:'BLOCKED',reason:'Core compilation missing'});
run('raw-protocol-inspector',['--test','docs/plugins/host-roof-scan-phase2/tests/inspect-response.test.mjs']);
fs.writeFileSync(path.join(out,'PHASE2_VERIFICATION.json'),JSON.stringify({results,limits:['Full locked SDK/build and baseline error comparison remain required.','Browser and real AI-host tests run separately. This script does not deploy or spend inference credits.']},null,2)+'\n');
process.exitCode=results.every(r=>r.status==='PASS')?0:1;
