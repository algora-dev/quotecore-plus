#!/usr/bin/env node
// Strict check of new reference modules only. The source slice lacks V3Point; the only
// shim is its structurally used {x,y} TYPE. No runtime replacement is compiled or shipped.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ts=require(process.env.QC_TYPESCRIPT||'typescript');
const root=path.resolve(__dirname,'../../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qc-reference-typecheck-'));
try {
 const core='app/lib/free-tools/host-roof-scan', files=['types.ts','tokens.ts','references.ts','reference-store.ts','config.ts'];
 fs.mkdirSync(path.join(tmp,core),{recursive:true});
 for(const file of files)fs.copyFileSync(path.join(root,core,file),path.join(tmp,core,file));
 const missing=path.join(tmp,'app/lib/takeoff');fs.mkdirSync(missing,{recursive:true});
 fs.writeFileSync(path.join(missing,'ai-prompt-v3.d.ts'),'export interface V3Point { x: number; y: number; }\n');
 const nodeTypes=process.env.QC_NODE_TYPES || path.join(root,'node_modules/@types');
 if(!fs.existsSync(path.join(nodeTypes,'node')))throw Error('Set QC_NODE_TYPES to an installed @types directory containing node.');
 const program=ts.createProgram(files.map(f=>path.join(tmp,core,f)),{strict:true,noEmit:true,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.NodeJs,esModuleInterop:true,skipLibCheck:true,types:['node'],typeRoots:[nodeTypes],lib:['lib.esnext.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
 const diagnostics=ts.getPreEmitDiagnostics(program);
 if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>tmp,getNewLine:()=> '\n'}));process.exitCode=1;}
 else console.log('PASS: strict reference/config/token TypeScript check; V3Point is a declaration-only test shim. Not a full-repository check.');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
