#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const root=path.resolve(__dirname,'../..');const files=[];
function walk(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){const name=path.join(p,entry.name);if(entry.isDirectory())walk(name);else if(/\.tsx?$/.test(name))files.push(name)}}
walk(path.join(root,'app'));
const errors=[];
for(const f of files){let raw=fs.readFileSync(f);let source=(raw[0]===0xff&&raw[1]===0xfe)?raw.toString('utf16le'):raw.toString('utf8');source=source.replace(/^\uFEFF/,'');
 if(f.endsWith('.d.ts'))continue;
 const r=ts.transpileModule(source,{fileName:f,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 for(const d of r.diagnostics??[])if(d.category===ts.DiagnosticCategory.Error)errors.push({file:path.relative(root,f),message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});}
const core=['contracts','scan-contract','scan-execution','scan-client','assistant-provider'].map(x=>path.join(root,'app/lib/billing/custom/usage',x+'.ts'));
let nodeTypes;try{nodeTypes=path.dirname(path.dirname(require.resolve('@types/node/package.json',{paths:[root]})))}catch{
 const globalRoot=cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();nodeTypes=path.join(globalRoot,'ts-node/node_modules/@types');}
const program=ts.createProgram(core,{noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,skipLibCheck:true,lib:['lib.es2022.d.ts','lib.dom.d.ts'],types:['node'],typeRoots:[nodeTypes]});
const strictErrors=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(root,d.file.fileName):null,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
console.log(JSON.stringify({syntaxFiles:files.length,syntaxErrors:errors,strictCoreFiles:core.length,strictCoreErrors:strictErrors,fullNextBuild:'not performed by this command'},null,2));
process.exitCode=errors.length||strictErrors.length?1:0;
