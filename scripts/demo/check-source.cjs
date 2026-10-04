/* Offline syntax/import checks. Requires the project's existing typescript dev dependency. */
const fs = require('node:fs'); const path = require('node:path'); const ts = require('typescript');
const root=path.resolve(__dirname,'../..');
const manifest=process.env.DEMO_CHANGED_MANIFEST;
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=manifest?JSON.parse(fs.readFileSync(manifest,'utf8')).map(x=>path.join(root,x.path)):walk(path.join(root,'app/lib/demo')).concat(walk(path.join(root,'app/components/demo')),walk(path.join(root,'app/api/demo')),walk(path.join(root,'app/demo')));
let failures=0, checked=0;
for(const file of files){if(!/\.(tsx?|mjs|cjs)$/.test(file)||!fs.existsSync(file))continue;if(/\.[mc]js$/.test(file))continue;checked++;
 const text=fs.readFileSync(file,'utf8');const result=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});
 for(const d of result.diagnostics??[]){if(d.category===ts.DiagnosticCategory.Error){console.error(path.relative(root,file),ts.flattenDiagnosticMessageText(d.messageText,'\n'));failures++;}}
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const item of source.statements){if(!ts.isImportDeclaration(item)||!ts.isStringLiteral(item.moduleSpecifier))continue;const name=item.moduleSpecifier.text;if(!name.startsWith('@/')&&!name.startsWith('.'))continue;
 const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);if(![base,...['.ts','.tsx','.js','.jsx','.mjs','.json','/index.ts','/index.tsx'].map(s=>base+s)].some(p=>fs.existsSync(p))){console.error('Unresolved local import:',path.relative(root,file),name);failures++;}}
}
console.log(JSON.stringify({checkedFiles:checked,failures,scope:'TypeScript syntax and local import resolution only; not a Next build/full typecheck'}));process.exitCode=failures?1:0;
