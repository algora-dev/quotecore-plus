const fs = require('fs'), path = require('path'), ts = require('typescript'), crypto = require('crypto');
const root = process.env.QC_ROOT || path.resolve(__dirname, '../../../../..');
const out = process.env.QC_VALIDATION || path.resolve(__dirname, '..');
const hashes = JSON.parse(fs.readFileSync(path.join(out,'baseline-sha256.json'),'utf8'));
let result={syntax:[],missingImports:[],added:[],modified:[]};
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):[path.join(dir,d.name)]);}
for(const file of walk(root)){
 const rel=path.relative(root,file); if(!rel.startsWith('app/'))continue; const buf=fs.readFileSync(file); const hash=crypto.createHash('sha256').update(buf).digest('hex');
 if(hashes[rel]===hash)continue;
 (hashes[rel]?result.modified:result.added).push(rel);
 if(!/\.(ts|tsx)$/.test(file) || file.endsWith('.d.ts'))continue;
 const src=buf.toString();const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const diagnostics=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).diagnostics??[];
 const all=[...(ast.parseDiagnostics||[]),...diagnostics];
 for(const d of all){ if(d.category===ts.DiagnosticCategory.Error){result.syntax.push({file:rel,line:ast.getLineAndCharacterOfPosition(d.start||0).line+1,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});}}
 for(const s of ast.statements){ if(!ts.isImportDeclaration(s))continue;const spec=s.moduleSpecifier.text;
  if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
  const p=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(file),spec);
  if(![p,p+'.ts',p+'.tsx',p+'.js',path.join(p,'index.ts'),path.join(p,'index.tsx')].some(f=>fs.existsSync(f)))result.missingImports.push({file:rel,import:spec});
 }
}
fs.writeFileSync(path.join(out,'source-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
process.exitCode=result.syntax.length||result.missingImports.length?1:0;
