const fs=require('fs'),path=require('path'),ts=require(process.env.QC_TYPESCRIPT || 'typescript');
const root=(process.env.QC_REPO_ROOT || path.resolve(__dirname,'../../../..')),v=__dirname,builder='app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx';
const before=ts.createSourceFile('before.tsx',fs.readFileSync(v+'/baseline/quote-builder.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),after=ts.createSourceFile('after.tsx',fs.readFileSync(root+'/'+builder,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const printer=ts.createPrinter({removeComments:true});const normal=n=>printer.printNode(ts.EmitHint.Unspecified,n,n.getSourceFile()).replace(/\s+/g,' ').trim();
function named(sf){const m={};function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)m[n.name.text]=normal(n.initializer);if(ts.isFunctionDeclaration(n)&&n.name)m['fn:'+n.name.text]=normal(n);ts.forEachChild(n,walk);}walk(sf);return m;}
const b=named(before),a=named(after),checks=[];const c=(name,pass,detail)=>checks.push({name,pass,...detail?{detail}:{}});
for(const name of Object.keys(b)){if(['fn:QuoteBuilder','setPhase','handleSaveMargins','phases','phaseHelp'].includes(name))continue;c('Existing Builder binding unchanged: '+name,b[name]===a[name]);}
function calls(sf,name){const arr=[];function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)===name)arr.push(n.arguments.map(normal));ts.forEachChild(n,walk);}walk(sf);return arr;}
c('Margin action payload arguments unchanged',JSON.stringify(calls(before,'updateQuoteMargins'))===JSON.stringify(calls(after,'updateQuoteMargins')));
c('Totals calculator calls unchanged',JSON.stringify(calls(before,'computeQuoteTotals'))===JSON.stringify(calls(after,'computeQuoteTotals')));
const complete=fs.readFileSync(root+'/app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx','utf8'),helper=fs.readFileSync(root+'/app/components/quote-entry/reviewCompletion.ts','utf8'),recovery=fs.readFileSync(root+'/app/components/quote-entry/CustomerQuoteRouteState.tsx','utf8'),err=fs.readFileSync(root+'/app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/error.tsx','utf8');
c('No document creation/save/send action added to completion',!/(createCustomerQuote|saveCustomerQuote|sendQuote|sendDocument)/.test(complete+helper));
c('No refresh polling, remount key hack, browser storage or timer added',!/(router\.refresh|setInterval|setTimeout|localStorage|sessionStorage|location\.reload)/.test(complete+helper+recovery+err));
c('Compatibility selector retained',complete.includes('data-copilot="quote-confirm"'));
c('Non-draft statuses skip confirmation',complete.includes("quoteStatus === 'draft' && !confirmedHere.current"));
c('Destination load retries use Next 16.2 refetch callback',err.includes('unstable_retry')&&recovery.includes('startTransition(retry)'));
c('Fallback without retry performs only same-route navigation',recovery.includes('<a href={documentHref}'));
c('No empty-area/component guard introduced',!/(canConfirm|hasComponents|roofAreas\.length)/.test(complete));
c('Named destination helper has no dependencies',!/^import /m.test(helper));
const customer=fs.readFileSync(root+'/app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx','utf8');
c('Existing customer editor global and per-line margin fields remain',customer.includes('materialMarginPercent')&&customer.includes('laborMarginPercent')&&customer.includes('material_margin_percent'));
const report={method:'TypeScript AST normalized expressions compared to supplied baseline; direct source contracts. Not pricing or live-app validation.',checks,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length};fs.writeFileSync(v+'/source-contracts.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
