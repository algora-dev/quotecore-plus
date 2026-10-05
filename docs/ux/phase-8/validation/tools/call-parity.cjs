const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'),out=process.env.QC_VALIDATION||path.resolve(__dirname,'..');const originals=JSON.parse(fs.readFileSync(out+'/baseline-changed-source.json','utf8')),print=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
let reports=[],all=[];
function inventory(file,source){const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const owners=new Map();
for(const n of sf.statements){if(ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&/actions|\/lib\/|supabase|\/api\//.test(n.moduleSpecifier.text)){for(const e of n.importClause.namedBindings.elements)if(!e.isTypeOnly)owners.set(e.name.text,n.moduleSpecifier.text+'::'+(e.propertyName?.text||e.name.text));}}
const out=[];function walk(n){if(ts.isCallExpression(n)){
 const expr=n.expression.getText(sf);const target=owners.get(expr)||(/^(fetch|downloadBlob|addQuoteToZip|addOrderToZip|addInvoiceToZip|router\.(push|refresh|replace)|.*\.(uploadToSignedUrl|mint|upload|move|remove|signOut|deleteSecurityQuestion))$/.test(expr)?expr:null);
 if(target)out.push({target,args:n.arguments.map(a=>print.printNode(ts.EmitHint.Unspecified,a,sf)).join(', ')});
}ts.forEachChild(n,walk);}walk(sf);return out.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
for(const [file,b]of Object.entries(originals)){
 if(file.endsWith('/resources/new/page.tsx')){reports.push({file,passed:true,authorizedException:'Old orphan inline create action replaced with library redirect.'});continue;}
 const before=inventory(file,b),after=inventory(file,fs.readFileSync(path.join(root,file),'utf8'));
 reports.push({file,passed:JSON.stringify(before)===JSON.stringify(after),calls:before.length,...(JSON.stringify(before)!==JSON.stringify(after)?{before,after}:{})});all.push(...before.map(c=>({file,...c})));
}
fs.writeFileSync(out+'/call-parity-report.json',JSON.stringify({method:'Syntax-normalized external action/helper/request/navigation call targets and arguments. Does not prove provider behavior or event ordering; canonical diff and runtime checklist cover those separately.',reports,callInventory:all},null,2));console.log('Passed',reports.filter(r=>r.passed).length,'/',reports.length,'calls',all.length);for(const r of reports.filter(r=>!r.passed))console.log(r);if(reports.some(r=>!r.passed))process.exitCode=1;
