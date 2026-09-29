const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname, '../../../..');
const base=process.env.QC_BASELINE||path.join(path.dirname(root), 'pricing-activation-baseline', 'quotecore-plus');
const out=__dirname;
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)])}
const changed=walk(path.join(root,'app')).filter(p=>!fs.existsSync(path.join(base,path.relative(root,p)))||!fs.readFileSync(p).equals(fs.readFileSync(path.join(base,path.relative(root,p)))));
let syntax=[];for(const p of changed.filter(p=>/\.tsx?$/.test(p))){const r=ts.transpileModule(fs.readFileSync(p,'utf8'),{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.ESNext}});syntax.push({file:path.relative(root,p),diagnostics:(r.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' '))})}
const printer=ts.createPrinter({removeComments:true});
function astValues(dir,file,name){const f=ts.createSourceFile(file,fs.readFileSync(path.join(dir,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let results=[];function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(f)===name&&n.initializer)results.push(printer.printNode(ts.EmitHint.Expression,n.initializer,f));ts.forEachChild(n,visit)}visit(f);return results}
const list='app/(auth)/[workspaceSlug]/components/component-list.tsx';
let contracts=[];for(const name of ['input','inputWithGenericTrades']){const before=astValues(base,list,name),after=astValues(root,list,name);contracts.push({name,occurrences:before.length,equal:JSON.stringify(before)===JSON.stringify(after)});}
const cf='app/(auth)/[workspaceSlug]/components/components/AddFromCatalogModal.tsx';
for(const name of ['MAX_ROWS','NAME_CHAR_LIMIT']){const b=astValues(base,cf,name),a=astValues(root,cf,name);contracts.push({name,occurrences:b.length,equal:JSON.stringify(a)===JSON.stringify(b)})}
// Pure calculator semantic check with the REAL generated database and union types.
// Avoid importing server-side Next/Supabase runtimes solely for type re-exports.
const options={strict:true,noEmit:true,target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,baseUrl:root,paths:{'@/*':['./*']},skipLibCheck:true,types:[]};
const host=ts.createCompilerHost(options),read=host.readFile.bind(host);
const server=path.join(root,'app/lib/supabase/server.ts');
host.readFile=f=>path.resolve(f)===server?`import type {Database} from './database.types';export type Tables<T extends keyof Database['public']['Tables']>=Database['public']['Tables'][T]['Row'];export type TablesInsert<T extends keyof Database['public']['Tables']>=Database['public']['Tables'][T]['Insert'];`:read(f);
const program=ts.createProgram([path.join(root,'app/components/pricing/componentTest.ts')],options,host);
const semantic=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(root,d.file.fileName):null,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
const result={syntax,contracts,isolatedCalculatorTypes:{scope:'Real componentTest.ts, engine, conversions, union and generated database types; server module reduced to unchanged type exports. Not the full application build.',diagnostics:semantic}};
fs.writeFileSync(path.join(out,'source-results.json'),JSON.stringify(result,null,2));
console.log('Syntax files',syntax.length,'errors',syntax.reduce((n,x)=>n+x.diagnostics.length,0));console.log('Contracts',contracts);console.log('Core semantic diagnostics',semantic);
if(syntax.some(x=>x.diagnostics.length)||contracts.some(x=>!x.equal)||semantic.length)process.exitCode=1;
