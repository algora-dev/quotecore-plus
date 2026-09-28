/** Source invariants. Does not execute framework, Fabric, RLS or persistence. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),ts=require('typescript');
const R=process.env.QC_ROOT,B=process.env.QC_BASELINE,V=process.env.QC_VALIDATION;
if(!R||!B||!V)throw Error('Set QC_ROOT, QC_BASELINE and QC_VALIDATION');
const W='app/(auth)/[workspaceSlug]/'; const tests=[],detail={};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
const sf=(root,p)=>ts.createSourceFile(p,read(root,p),ts.ScriptTarget.Latest,true,p.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const printer=ts.createPrinter({removeComments:true}); const norm=(n,f)=>printer.printNode(ts.EmitHint.Unspecified,n,f).replace(/\r\n/g,'\n');
function test(name,pass,extra){tests.push({name,pass:!!pass,...extra});}
function files(d,p=''){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name),p+e.name+'/'):[p+e.name]);}
const originals=files(B);const missing=originals.filter(p=>!fs.existsSync(path.join(R,p)));
test('All original repository paths retained',missing.length===0,{count:originals.length,missing});
const changed=originals.filter(p=>fs.existsSync(path.join(R,p))&&!fs.readFileSync(path.join(B,p)).equals(fs.readFileSync(path.join(R,p))));
const protectedPath=p=> /^(app\/\((marketing|public)\)\/|app\/lib\/|backend\/|supabase\/)/.test(p)||
 /(^|\/)(assistant|smart-assistant|sa-[^/]+|takeoff|Takeoff)(\/|$)/i.test(p)||
 /(^|\/)(ConversationCards|V2ChatClient|BlogHeader|EarlyAccessPopup)[^/]*$/.test(p)||p.includes('competitor-pages/')||
 /^(package(-lock)?\.json|next\.config\.[^/]+|tsconfig\.json|public\/q-mark\.png|app\/manifest\.ts)$/.test(p)||
 p.startsWith(W+'drawings/draw/parts/')||p.startsWith(W+'quotes/')&&p.includes('/build/')||
 /(CustomerQuoteEditor|QuotePreview|InvoiceEditor|InvoicePreview|OrderBody|OrderLineByLineEditor|PublicInvoiceView|order-create-form)\.(tsx|ts)$/.test(p)||p.endsWith('/LOCKED_FILES.json');
const protectedFiles=originals.filter(protectedPath).map(p=>({path:p,beforeHash:hash(fs.readFileSync(path.join(B,p))),afterHash:fs.existsSync(path.join(R,p))?hash(fs.readFileSync(path.join(R,p))):null}));
test('Protected engine, provider, parallel lanes, output, configuration and ledger bytes unchanged',protectedFiles.every(x=>x.beforeHash===x.afterHash),{count:protectedFiles.length});
fs.writeFileSync(path.join(V,'protected-files.json'),JSON.stringify({definition:protectedPath.toString(),baseline:'quotecore-plus-phase9-ux-handoff-2026-09-28.zip',files:protectedFiles},null,2));
function withoutCache(f){const transformed=ts.transform(f,[ctx=>root=>ts.visitNode(root,function visit(n){if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='next/cache')return undefined;if(ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(f)==='revalidatePath')return undefined;return ts.visitEachChild(n,visit,ctx);})]);const out=printer.printFile(transformed.transformed[0]);transformed.dispose();return out;}
function tokens(text){const scan=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text);const out=[];let token;while((token=scan.scan())!==ts.SyntaxKind.EndOfFileToken)out.push([token,scan.getTokenText().replace(/\r\n/g,'\n')]);return JSON.stringify(out);}
const cacheFiles=changed.filter(p=>p.endsWith('actions.ts'));
for(const p of cacheFiles){const a=sf(B,p),b=sf(R,p);test('Cache-only server-action diff: '+p,tokens(withoutCache(a))===tokens(withoutCache(b)));}
const cacheTargets=[];
for(const p of cacheFiles){const f=sf(R,p);function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(f)==='revalidatePath'&&ts.isStringLiteral(n.arguments[0])){const target=n.arguments[0].text;cacheTargets.push({source:p,target,type:n.arguments[1]?.getText(f)});}ts.forEachChild(n,walk);}walk(f);}
for(const target of [...new Set(cacheTargets.map(x=>x.target))]){if(!target.includes('[workspaceSlug]')){detail.legacyCacheTargets=(detail.legacyCacheTargets||[]).concat(target);continue;}const exists=['page.tsx','page.ts','page.js'].some(x=>fs.existsSync(path.join(R,'app/(auth)',target.slice(1),x)));test('Revalidation target exists: '+target,exists&&cacheTargets.filter(x=>x.target===target).every(x=>x.type==="'page'"||x.type==='"page"'));}
detail.cacheTargets=cacheTargets;
function functions(f){const m=new Map();function walk(n){if(ts.isFunctionDeclaration(n)&&n.name)m.set(n.name.text,n);if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))m.set(n.name.text,n.initializer);ts.forEachChild(n,walk);}walk(f);return m;}
for(const p of [W+'drawings/draw/FlashingCanvas.tsx',W+'drawings/[id]/edit/edit-form.tsx',W+'drawings/draw/AngleCalculatorModal.tsx',W+'drawings/draw/AngleCalculatorWidget.tsx']){const a=sf(B,p),b=sf(R,p),aa=functions(a),bb=functions(b);const equal=[],different=[],absent=[];for(const [name,n] of aa){if(!bb.has(name))absent.push(name);else if(norm(n,a)===norm(bb.get(name),b))equal.push(name);else different.push(name);}detail[p]={identicalFunctions:equal,changedFunctions:different,removedFunctions:absent};}
const p=W+'drawings/draw/FlashingCanvas.tsx';const a=sf(B,p),b=sf(R,p),aa=functions(a),bb=functions(b);
const allowedCanvasChanges=new Set(['FlashingCanvas','handleKeyDown','loadFlashing','_handleAddRightAngle','_handleAddCustomAngle','handleSave','close','submit']);
const unexpected=detail[p].changedFunctions.filter(n=>!allowedCanvasChanges.has(n));test('No unreviewed named canvas-engine function changes',unexpected.length===0&&detail[p].removedFunctions.length===0,{unexpected,reviewed:detail[p].changedFunctions,unchangedCount:detail[p].identicalFunctions.length});
const ep=W+'drawings/[id]/edit/edit-form.tsx';test('Hidden drawing regeneration / measurement-edit engine functions unchanged',detail[ep].changedFunctions.every(n=>['EditFlashingForm','handleSave'].includes(n))&&detail[ep].removedFunctions.length===0,{reviewed:detail[ep].changedFunctions,unchanged:detail[ep].identicalFunctions});
function nodes(f,pred){const out=[];function v(n){if(pred(n))out.push(n);ts.forEachChild(n,v);}v(f);return out;}
const canvasProps=f=>nodes(f,n=>(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(f)==='canvas').map(n=>norm(n.attributes,f));
test('Native canvas attributes, intrinsic dimensions and ref unchanged',JSON.stringify(canvasProps(a))===JSON.stringify(canvasProps(b)),{before:canvasProps(a),after:canvasProps(b)});
const ap='app/api/alerts/bulk/route.ts',af=sf(B,ap),bf=sf(R,ap);test('Archive source-entity helper unchanged',norm(functions(af).get('clearActionRequiredForArchivedAlerts'),af)===norm(functions(bf).get('clearActionRequiredForArchivedAlerts'),bf));
const mwA=read(B,'middleware.ts'),mwB=read(R,'middleware.ts');test('Middleware change is only exact manifest asset bypass',mwB.replace(/\s*\/\/ P9[^\n]*\n/g,'\n').replace(/\s*pathname === '\/manifest\.webmanifest' \|\|[^\n]*\n/g,'\n').replace(/\s+/g,' ')===mwA.replace(/\s+/g,' '));
for(const p of [W+'resources/new/page.tsx',W+'quotes/page.tsx',W+'catalogs/catalog-list.tsx','public/q-mark.png','app/components/workspace/workspace-return.ts']){
 if(!fs.existsSync(path.join(B,p))){test('Locked invariant file exists: '+p,false);continue;}test('Accepted navigation/layout lock unchanged: '+p,fs.readFileSync(path.join(B,p)).equals(fs.readFileSync(path.join(R,p))));}
// UI function inventory is evidence for review, not a general behavioural proof.
const report={method:'Raw baseline hashes, TypeScript AST comparisons and route existence checks. No framework execution or behavioural equivalence claim.',tests,detail,passed:tests.filter(t=>t.pass).length,failed:tests.filter(t=>!t.pass).length};fs.writeFileSync(path.join(V,'invariant-report.json'),JSON.stringify(report,null,2));console.log(report.passed,'passed',report.failed,'failed');console.log(JSON.stringify(tests.filter(t=>!t.pass),null,2));process.exitCode=report.failed?1:0;
