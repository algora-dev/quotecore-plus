#!/usr/bin/env node
// TRANSPILE/SYNTAX check for the supplied source slice. Not a strict/full-repository build.
// Required external path prevents test artifacts from being mistaken for production source.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../../..');
const out=process.env.QC_TEST_OUT && path.resolve(process.env.QC_TEST_OUT);
if(!out||out===root||out.startsWith(root+path.sep))throw Error('Set QC_TEST_OUT to a new directory OUTSIDE the source repository.');
const ts=require(process.env.QC_TYPESCRIPT||'typescript');
const dir=path.join(root,'app/lib/free-tools/host-roof-scan');
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.ts'))){
 const source=fs.readFileSync(path.join(dir,name),'utf8');
 const r=ts.transpileModule(source,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true},reportDiagnostics:true});
 if(r.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('TypeScript syntax error: '+name);
 const dest=path.join(out,'app/lib/free-tools/host-roof-scan',name.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,r.outputText);
}
const {WIDGET_SCRIPT}=require(path.join(out,'app/lib/free-tools/host-roof-scan/widget.js'));
new vm.Script('const QC_API_ORIGIN="https://unit-test.example";\n'+WIDGET_SCRIPT);
console.log('PASS: TypeScript transpilation/syntax and browser-script syntax. NOT strict type-checking or full repository integration.');
console.log('TypeScript '+ts.version);
