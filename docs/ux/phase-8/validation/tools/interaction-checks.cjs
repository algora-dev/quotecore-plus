const fs=require('fs'),assert=require('assert'),path=require('path');
const out=process.env.QC_VALIDATION||path.resolve(__dirname,'..');
const {load,node,expand,states,refs,injections,reset,mocked}=require('./controller-harness.cjs');
const W='app/(auth)/[workspaceSlug]/';let tree,tests=[],calls=[],cases={},zipFails=false,auditFails=false,beginFails=false,deleteFails=false,createResult={ok:true,quoteId:'created'},mutationResult={deleted:2,skipped:0};
function flatten(n){if(n==null)return [];if(Array.isArray(n))return n.flatMap(flatten);return typeof n==='object'?[n,...flatten(n.props.children)]:[];}
const text=n=>n==null?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props.children):String(n);
function draw(F,p){tree=expand(node(F,p));return flatten(tree);}
function byText(F,p,t){const n=draw(F,p).find(n=>n.type==='button'&&text(n).trim()===t);assert(n,'Missing button '+t);return n;}
function button(F,p,match){const n=draw(F,p).find(n=>n.type==='button'&&match(n));assert(n,'Missing button '+match);return n;}
function action(name,fn=()=>undefined){return (...args)=>{calls.push({name,args});return fn(...args)}}
const router={push:action('router.push'),refresh:action('router.refresh'),replace:action('router.replace'),back:action('router.back')};
injections.set('next/navigation',{useRouter:()=>router,useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/demo/quotes',useParams:()=>({workspaceSlug:'demo'}),redirect:action('redirect')});
injections.set('jszip',{__esModule:true,default:class{async generateAsync(options){calls.push({name:'generateZip',args:[options]});if(zipFails)throw Error('compression unavailable');return new Blob(['fake fixture']);}}});
const download=action('download'),sanitize=x=>String(x);
for(const f of ['quote','order','invoice']){
 const plural=f==='quote'?'quotes':f==='order'?'material-orders':'invoices', cap=f[0].toUpperCase()+f.slice(1);
 injections.set(W+plural+'/actions-bulk.ts',{
  ['load'+cap+'BundleData']:action('load-'+f,async id=>{if(cases[id]==='throw')throw Error('provider unavailable');return cases[id]==='missing'?null:{id};}),
  ['bulkDelete'+cap+'s']:action('delete-'+f,async ids=>{if(deleteFails)throw Error('permission denied');return mutationResult}),
  beginBulkDownload:action('begin',async ids=>{if(beginFails)throw Error('batch limit');return {auditId:'test-audit'}}),
  finishBulkDownloadAudit:action('finish',async(...args)=>{if(auditFails)throw Error('audit unavailable')})
 });
 injections.set(W+plural+'/lib/'+f+'-bundle.tsx',{['add'+cap+'ToZip']:action('add-'+f,async(_zip,data)=>{if(cases[data.id]==='render')return null;return 'file.pdf';}),downloadBlob:download,sanitizeFilename:sanitize});
 injections.set(W+plural+'/actions.ts',{updateQuoteJobStatus:action('status-quote',async()=>{throw Error('status unavailable')}),updateOrderStatus:action('status-order',async()=>{throw Error('status unavailable')}),updateInvoiceStatus:action('status-invoice',async()=>{throw Error('status unavailable')}),deleteQuote:action('single-delete',async()=>{}),deleteMaterialOrder:action('single-delete',async()=>{}),cancelInvoice:action('single-delete',async()=>{}),deleteInvoice:action('single-delete',async()=>{})});
}
injections.set(W+'quotes/new/actions.ts',{createQuoteWithDetails:action('createQuoteWithDetails',async p=>createResult)});
// Create import may be quotes/actions-details; its path is resolved below from source.
const root=process.env.QC_ROOT;const qs=fs.readFileSync(path.join(root,W+'quotes/new/QuoteDetailsForm.tsx'),'utf8');
const createImport=qs.match(/import\s*{\s*createQuoteWithDetails\s*}\s*from\s*['"]([^'"]+)/)?.[1];
assert(createImport);injections.set(path.relative(root,path.resolve(root,W+'quotes/new',createImport+'.ts')),{createQuoteWithDetails:action('createQuoteWithDetails',async p=>createResult)});
const quoteRows=['q1','q2','q3'].map((id,i)=>({id,customer_name:'Sample '+i,job_name:'Roof '+i,status:'confirmed',quote_number:1048+i,created_at:'2026-09-27',updated_at:'2026-09-27',job_status:'sent'}));
const invoiceRows=quoteRows.map((q,i)=>({...q,id:q.id,status:'draft',invoice_number:'INV-'+i,invoice_date:'2026-09-27',currency:'GBP',total:100,customer_email:'sample@example.invalid'}));
const orderRows=quoteRows.map((q,i)=>({...q,order_number:'PO-'+i,status:'ready',to_supplier:'Sample supplier'}));
const families=[['quote','QuotesList','quotes/QuotesList.tsx',{workspaceSlug:'demo',quotes:quoteRows,subscriptionActive:true,monthlyQuoteAtCap:false,monthlyQuoteUsed:2,monthlyQuoteLimit:50,effectivePlanCode:'pro'}],['order','OrderList','material-orders/order-list.tsx',{workspaceSlug:'demo',orders:orderRows}],['invoice','InvoiceList','invoices/InvoiceList.tsx',{workspaceSlug:'demo',invoices:invoiceRows}]];
async function test(name,fn){reset();calls=[];cases={};zipFails=false;auditFails=false;beginFails=false;deleteFails=false;mutationResult={deleted:2,skipped:0};createResult={ok:true,quoteId:'created'};try{await fn();tests.push({name,status:'passed'});}catch(e){tests.push({name,status:'failed',message:e.stack});}}
const flush=()=>new Promise(r=>setTimeout(r,0));
const result=()=>states.get('useQcActionNotice.result');
async function main(){
for(const [kind,name,file,props]of families){
 const setup=()=>{const F=load(W+file)[name];states.set(name+'.selectedIds',new Set(['q1','q2']));return F};
 await test(kind+': successful bulk export requests one download and clears pending',async()=>{const F=setup();await button(F,props,n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().tone,'success');assert.match(result().description,/Prepared 2 of 2/);assert.equal(calls.filter(c=>c.name==='download').length,1);assert.equal(states.get(name+'.bulkBusy'),null);});
 await test(kind+': partial export preserves full failure details',async()=>{cases={q2:'missing'};const F=setup();await button(F,props,n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().tone,'warning');assert.equal(result().details.length,1);assert.match(result().description,/Prepared 1 of 2/);assert.match(result().details[0],/not found/);assert.equal(calls.filter(c=>c.name==='download').length,1);});
 await test(kind+': zero successful records never requests a download',async()=>{cases={q1:'missing',q2:'throw'};const F=setup();await button(F,props,n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().tone,'danger');assert.equal(result().details.length,2);assert(!calls.some(c=>c.name==='download'||c.name==='generateZip'));assert.equal(states.get(name+'.bulkBusy'),null);});
 await test(kind+': compression failure reports no completed download',async()=>{zipFails=true;const F=setup();await button(F,props,n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().title,'Export could not finish');assert(!calls.some(c=>c.name==='download'));assert.equal(states.get(name+'.bulkBusy'),null);});
 await test(kind+': existing 25-record selection cap remains enforced before requests',async()=>{const F=setup();states.set(name+'.selectedIds',new Set(Array.from({length:26},(_,i)=>'q'+i)));await button(F,props,n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().title,'Selection limit');assert(!calls.some(c=>/^load-|^begin$/.test(c.name)));});
 await test(kind+': bulk delete needs confirmation; cancelling never mutates',async()=>{const F=setup();await button(F,props,n=>/^Delete Selected$/i.test(text(n).trim())).props.onClick();assert.equal(calls.filter(c=>c.name==='delete-'+kind).length,0);assert(states.get(name+'.bulkDeleteConfirmOpen'));await byText(F,props,kind==='invoice'?'Keep':'Cancel').props.onClick();assert.equal(calls.filter(c=>c.name==='delete-'+kind).length,0);assert.equal(states.get(name+'.selectedIds').size,2);});
 await test(kind+': confirmed delete shows deleted/skipped counts from actual result',async()=>{const F=setup();mutationResult={deleted:1,skipped:1};states.set(name+'.bulkDeleteConfirmOpen',true);await button(F,props,n=>n.props.onClick?.name==='handleBulkDelete').props.onClick();assert.equal(calls.filter(c=>c.name==='delete-'+kind).length,1);assert.equal(result().tone,'warning');assert.match(result().description,/deleted: 1/i);assert.match(result().description,/Skipped: 1/);assert.equal(states.get(name+'.selectedIds').size,0);});
 await test(kind+': failed delete exposes result and preserves selected IDs for retry',async()=>{deleteFails=true;const F=setup();states.set(name+'.bulkDeleteConfirmOpen',true);await button(F,props,n=>n.props.onClick?.name==='handleBulkDelete').props.onClick();assert.equal(result().tone,'danger');assert.equal(states.get(name+'.selectedIds').size,2);assert.equal(states.get(name+'.bulkDeleteConfirmOpen'),false);assert.equal(states.get(name+'.bulkBusy'),null);});
}
await test('Quote audit begin failure prevents downloads and clears progress',async()=>{beginFails=true;const F=load(W+families[0][2]).QuotesList;states.set('QuotesList.selectedIds',new Set(['q1']));await button(F,families[0][3],n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().title,'Export could not start');assert(!calls.some(c=>c.name==='download'||c.name==='load-quote'));assert.equal(states.get('QuotesList.bulkProgress'),null);});
await test('Post-download quote audit failure tells user to check the requested download',async()=>{auditFails=true;const F=load(W+families[0][2]).QuotesList;states.set('QuotesList.selectedIds',new Set(['q1']));await button(F,families[0][3],n=>n.props.onClick?.name==='handleBulkDownload').props.onClick();assert.equal(result().title,'Check your download');assert.equal(calls.filter(c=>c.name==='download').length,1);});
await test('Orders final delete result remains available in empty list branch',async()=>{const F=load(W+families[1][2]).OrderList;states.set('useQcActionNotice.result',{title:'Deletion complete',description:'Orders deleted: 1.',tone:'success'});draw(F,{workspaceSlug:'demo',orders:[]});assert.match(text(tree),/Deletion complete/);});
const formProps={workspaceSlug:'demo',templates:[],companyId:'company',defaultMeasurementSystem:'metric',digitalTakeoffAvailable:true,monthlyQuoteAtCap:false,monthlyQuoteUsed:1,monthlyQuoteLimit:50,effectivePlanCode:'pro',defaultTrade:'roofing',componentCollections:[{id:'c1',name:'Library',is_bootstrap:true}]};
const formF=()=>load(W+'quotes/new/QuoteDetailsForm.tsx').QuoteDetailsForm;
const submit=F=>draw(F,formProps).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
await test('New Quote missing customer exposes inline validation without creating',async()=>{const F=formF();await submit(F);assert.equal(states.get('QuoteDetailsForm.customerTouched'),true);assert.equal(states.get('QuoteDetailsForm.validationAttempted'),true);assert(!calls.some(c=>c.name==='createQuoteWithDetails'));draw(F,formProps);assert.match(text(tree),/Enter a customer name/);});
await test('New Quote missing entry mode explains exactly the blocked choice',async()=>{const F=formF();states.set('QuoteDetailsForm.customerName','Alex');await submit(F);assert(!calls.some(c=>c.name==='createQuoteWithDetails'));draw(F,formProps);assert.match(text(tree),/Choose how you want to create this quote/);});
await test('New Quote Digital without plan prevents creation and shows scoped help',async()=>{const F=formF();states.set('QuoteDetailsForm.customerName','Alex');states.set('QuoteDetailsForm.entryMode','digital');await submit(F);assert(!calls.some(c=>c.name==='createQuoteWithDetails'));draw(F,formProps);assert.match(text(tree),/Upload a plan or image before starting Digital Takeoff/);});
await test('New Quote existing monthly cap guard precedes required-field validation',async()=>{const F=formF();await draw(F,{...formProps,monthlyQuoteAtCap:true}).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(states.get('QuoteDetailsForm.quoteCapUpgradeOpen'),true);assert(!states.get('QuoteDetailsForm.validationAttempted'));assert(!calls.some(c=>c.name==='createQuoteWithDetails'));});
for(const mode of ['manual','blank'])await test('New Quote '+mode+' retains action payload and destination',async()=>{process.env.NEXT_PUBLIC_GENERIC_TRADES_V1='true';const F=formF();states.set('QuoteDetailsForm.customerName',' Alex ');states.set('QuoteDetailsForm.jobName',' Roof ');states.set('QuoteDetailsForm.entryMode',mode);states.set('QuoteDetailsForm.selectedTrade','electrical');states.set('QuoteDetailsForm.selectedCollectionId','c1');await submit(F);const call=calls.find(c=>c.name==='createQuoteWithDetails');assert(call);assert.deepEqual(call.args[0],{customerName:'Alex',jobName:'Roof',templateId:null,entryMode:mode,measurementSystem:'metric',trade:'electrical',componentCollectionId:'c1'});assert.deepEqual(calls.find(c=>c.name==='router.push').args,[mode==='blank'?'/demo/quotes/created/blank-build':'/demo/quotes/created']);process.env.NEXT_PUBLIC_GENERIC_TRADES_V1='false';});
await test('New Quote structured failure retains typed billing message and no navigation',async()=>{const F=formF();states.set('QuoteDetailsForm.customerName','Alex');states.set('QuoteDetailsForm.entryMode','manual');createResult={ok:false,code:'subscription_inactive',message:'Subscription is inactive.'};await submit(F);assert.deepEqual(states.get('QuoteDetailsForm.createError'),{message:'Subscription is inactive.',showUpgrade:true});assert(!calls.some(c=>c.name==='router.push'));});
// Test the actual queued confirmation hook using a small host, not a mock hook.
const FeedbackHost=()=>{const {ask,notify,feedback}=load('app/components/ui/v2/useQcFeedback.tsx').useQcFeedback();return node('div',{children:[node('button',{onClick:async()=>{const accepted=await ask({title:'Remove?',description:'Confirm',confirmLabel:'Remove',destructive:true});if(accepted)calls.push({name:'confirmed-mutation',args:[]});},children:'Ask'}),node('button',{onClick:async()=>{await notify('Example','Result');calls.push({name:'acknowledged',args:[]})},children:'Notify'}),feedback]});};
await test('Shared destructive feedback cancels safely and requires explicit affirmative action',async()=>{let p=byText(FeedbackHost,{},'Ask').props.onClick();assert(!calls.some(c=>c.name==='confirmed-mutation'));await byText(FeedbackHost,{},'Cancel').props.onClick();await p;assert(!calls.some(c=>c.name==='confirmed-mutation'));p=byText(FeedbackHost,{},'Ask').props.onClick();const yes=byText(FeedbackHost,{},'Remove');assert.equal(yes.props['data-qc-variant'],'danger');await yes.props.onClick();await p;assert.equal(calls.filter(c=>c.name==='confirmed-mutation').length,1);});
await test('Shared notification waits for acknowledgement before caller continues',async()=>{let p=byText(FeedbackHost,{},'Notify').props.onClick();assert(!calls.some(c=>c.name==='acknowledged'));await byText(FeedbackHost,{},'OK').props.onClick();await p;assert.equal(calls.filter(c=>c.name==='acknowledged').length,1);});

for(const [kind,fn,file,initial,next] of [
 ['quote','JobStatusDropdown','quotes/QuotesList.tsx','sent','Accepted'],
 ['order','OrderStatusDropdown','material-orders/order-list.tsx','ready','Ordered'],
 ['invoice','InvoiceStatusDropdown','invoices/InvoiceList.tsx','draft','Sent']]){
 await test(kind+': failed status update preserves current value and exposes error',async()=>{
  const F=load(W+file)['__'+fn],p={currentStatus:initial,quoteId:'q1',orderId:'o1',invoiceId:'i1',onResult:r=>calls.push({name:'result',args:[r]})};
  await button(F,p,n=>!!n.props['aria-expanded']===false).props.onClick();
  await byText(F,p,next).props.onClick();
  assert.equal(states.get(fn+'.status'),initial);assert.equal(states.get(fn+'.saving'),false);
  assert.equal(calls.find(c=>c.name==='result').args[0].title,'Status was not updated');
 });
 await test(kind+': Escape closes status options and restores trigger through existing ref',async()=>{
  const F=load(W+file)['__'+fn],p={currentStatus:initial,quoteId:'q1',orderId:'o1',invoiceId:'i1',onResult:()=>{}};
  draw(F,p);refs.get(fn+'.ref0').current={querySelector:()=>({focus:()=>calls.push({name:'focus-trigger'})})};states.set(fn+'.open',true);
  const handler=draw(F,p).find(n=>n.props.onKeyDown).props.onKeyDown;handler({key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(states.get(fn+'.open'),false);assert(calls.some(c=>c.name==='focus-trigger'));
 });
}
injections.set(W+'resources/actions.ts',{createTemplate:action('createTemplate',async()=>({id:'new-template'}))});
const TP={workspaceSlug:'demo',componentLibrary:[],customerTemplates:[]};
await test('Quote structure missing name is inline and never calls create',async()=>{
 const F=load(W+'resources/create/TemplateBuilder.tsx').TemplateBuilder;
 await button(F,TP,n=>n.props.onClick?.name==='handleSave').props.onClick();
 assert.equal(states.get('TemplateBuilder.nameError'),'Enter a template name.');assert(!calls.some(c=>c.name==='createTemplate'));
});
await test('Quote structure empty-components confirmation cancellation preserves draft',async()=>{
 const F=load(W+'resources/create/TemplateBuilder.tsx').TemplateBuilder;states.set('TemplateBuilder.name','My structure');
 const saving=button(F,TP,n=>n.props.onClick?.name==='handleSave').props.onClick();
 assert(!calls.some(c=>c.name==='createTemplate'));await byText(F,TP,'Keep editing').props.onClick();await saving;
 assert(!calls.some(c=>c.name==='createTemplate'));assert.equal(states.get('TemplateBuilder.name'),'My structure');
});
await test('Quote structure explicit save uses existing payload and library destination',async()=>{
 const F=load(W+'resources/create/TemplateBuilder.tsx').TemplateBuilder;states.set('TemplateBuilder.name','My structure');
 const saving=button(F,TP,n=>n.props.onClick?.name==='handleSave').props.onClick();
 await button(F,TP,n=>text(n).trim()==='Save template'&&n.props['data-qc-variant']==='primary').props.onClick();await saving;
 assert.deepEqual(calls.find(c=>c.name==='createTemplate').args[0],{name:'My structure',description:'',roofingProfile:'',components:[],extras:[],customerTemplateId:'',notes:''});
 assert.deepEqual(calls.find(c=>c.name==='router.push').args,['/demo/resources/document-templates?type=quote&kind=quote-structure']);
});

const resultReport={method:'Actual source callbacks executed under named state/ref evaluator. All specified server/download/router calls are deterministic substitutions. React scheduling, effects, native focus restore, network, PDF contents and persistence NOT tested.',tests};fs.writeFileSync(out+'/interaction-report.json',JSON.stringify(resultReport,null,2));console.log(tests);process.exitCode=tests.some(t=>t.status==='failed')?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1});
