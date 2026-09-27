const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'),out=process.env.QC_VALIDATION||path.resolve(__dirname,'..');
const scope=JSON.parse(fs.readFileSync(path.join(out,'source-check.json'),'utf8'));const results=[];
for(const rel of [...scope.modified,...scope.added]){
 if(!/\.tsx?$/.test(rel))continue;const file=path.join(root,rel),source=fs.readFileSync(file,'utf8');
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const tr=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const diagnostics=[...sf.parseDiagnostics,...(tr.diagnostics||[])];
 function visit(n){if(ts.isAwaitExpression(n)){let f=n.parent;while(f&&!ts.isFunctionLike(f))f=f.parent;if(f&&!f.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))diagnostics.push({messageText:'await outside async at line '+(sf.getLineAndCharacterOfPosition(n.pos).line+1)});}ts.forEachChild(n,visit);}visit(sf);
 results.push({file:rel,pass:diagnostics.length===0,diagnostics:diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))});
}
fs.writeFileSync(out+'/syntax-report.json',JSON.stringify({method:'Syntax AST and isolated transpile only, not semantic typechecking.',results},null,2));console.log(results.length+' modules; failures '+results.filter(r=>!r.pass).length);if(results.some(r=>!r.pass))process.exitCode=1;
