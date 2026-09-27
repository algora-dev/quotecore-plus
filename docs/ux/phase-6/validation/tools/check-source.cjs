const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'), base=path.join(root,'docs/ux/phase-6/baseline/source');
const changes=JSON.parse(fs.readFileSync(path.join(root,'docs/ux/phase-6/validation/source-changes.json'),'utf8')).filter(x=>/\.tsx?$/.test(x.path));
let errors=[], report=[];
function parse(rel,dir){let text=fs.readFileSync(path.join(dir,rel)+(dir===base?'.source.txt':''),'utf8'), sf=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,rel.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);return sf;}
const printer=ts.createPrinter({removeComments:true});
function norm(n,sf){return printer.printNode(ts.EmitHint.Unspecified,n,sf).replace(/\s+/g,' ').trim();}
function audit(sf){let events=[],disabled=[],bindings=[],functions={},constants=[],duplicates=[];
 function visit(n){
  if(ts.isJsxAttribute(n)&&/^on[A-Z]/.test(n.name.getText(sf))){events.push(n.name.getText(sf)+'='+norm(n.initializer,sf));}
  if(ts.isJsxAttribute(n)&&n.name.getText(sf)==='disabled')disabled.push(n.initializer?norm(n.initializer,sf):'true');
  if(ts.isJsxAttribute(n)&&['name','action','method','encType','accept','min','max','required','multiple','data-copilot','data-pdf','data-exclude-pdf'].includes(n.name.getText(sf)))bindings.push(norm(n,sf));
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){let names=new Set();for(const x of n.attributes.properties){if(ts.isJsxAttribute(x)){let name=x.name.getText(sf);if(names.has(name))duplicates.push(name+' @ '+sf.getLineAndCharacterOfPosition(n.pos).line);names.add(name);}}}
  if(ts.isFunctionDeclaration(n)&&n.name&&n.body){
    let hasJsx=false;function find(x){if(ts.isJsxElement(x)||ts.isJsxSelfClosingElement(x)||ts.isJsxFragment(x))hasJsx=true;ts.forEachChild(x,find);}find(n.body);
    if(!hasJsx)functions[n.name.text]=norm(n.body,sf);
  }
  if(ts.isVariableDeclaration(n)&&n.initializer){const name=n.name.getText(sf);if(/^[A-Z][A-Z0-9_]+$/.test(name))constants.push(name+'='+norm(n.initializer,sf));}
  ts.forEachChild(n,visit);
 }visit(sf);return {events,disabled,bindings,functions,constants,duplicates};
}
function missing(a,b){b=[...b];return a.filter(x=>{let i=b.indexOf(x);if(i<0)return true;b.splice(i,1);return false;});}
for(const ch of changes){let sf=parse(ch.path,root);for(const d of sf.parseDiagnostics)errors.push({file:ch.path,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});const out=ts.transpileModule(sf.text,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true,fileName:ch.path});for(const d of out.diagnostics||[])errors.push({file:ch.path,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});let a=audit(sf);
 if(a.duplicates.length)errors.push({file:ch.path,duplicates:a.duplicates});
 if(ch.status==='added')continue;
 let b=audit(parse(ch.path,base));let funcDelta=Object.entries(b.functions).filter(([k,v])=>a.functions[k]!==v).map(([k])=>k);
 report.push({file:ch.path,baselineEvents:b.events.length,events:a.events.length,removedEvents:missing(b.events,a.events),removedDisabled:missing(b.disabled,a.disabled),removedBindings:missing(b.bindings,a.bindings),changedNonJsxFunctions:funcDelta,changedConstants:missing(b.constants,a.constants)});
}
let summary={syntaxErrors:errors,files:changes.length,baselineEvents:report.reduce((n,x)=>n+x.baselineEvents,0),preservedEvents:report.reduce((n,x)=>n+x.baselineEvents-x.removedEvents.length,0),report};
fs.writeFileSync(path.join(root,'docs/ux/phase-6/validation/source-parity-rerun.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,report:report.filter(x=>x.removedEvents.length||x.removedDisabled.length||x.removedBindings.length||x.changedNonJsxFunctions.length||x.changedConstants.length)},null,2));if(errors.length)process.exitCode=1;
