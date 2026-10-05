// Source views with deterministic sample state. No effects, network or writes.
const fs=require('fs'),path=require('path');
const out=process.env.QC_FIXTURES,root=process.env.QC_ROOT;
const {load,node,render,setFixture,used,mocked}=require('./view-harness.cjs');
fs.mkdirSync(out,{recursive:true});const results=[];
function screen(name,rel,component,props,states={},title){setFixture({states});try{
 const html=render(node(load(rel)[component],props));
 const h=title?render(node(load('app/components/ui/v2/QcJourney.tsx').QcJourneyHeader,{title,description:'Phase 8 source-derived example. No real records or operations.'})):'';
 fs.writeFileSync(path.join(out,name+'.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="stylesheet" href="fixture.css"><style>body{margin:0;background:#f6f7f9}.specimen{max-width:1160px;margin:0 auto;padding:28px 24px}.specimen-note{font:12px/18px Arial;color:#596273;padding:12px 16px;background:#fff;border-bottom:1px solid #dde1e7}@media(max-width:767px){.specimen{padding:20px 16px}}</style></head><body><div class="specimen-note">SOURCE-DERIVED STATIC REVIEW · sample data · not the deployed application</div><main class="specimen" data-qc-ui="v2">${h}${html}</main><script>document.querySelectorAll('dialog').forEach(d=>d.showModal());</script></body></html>`);
 results.push({name,rel,pass:true});
}catch(e){results.push({name,rel,pass:false,error:e.stack});console.error(name,e.message);}}
const W='app/(auth)/[workspaceSlug]/',date='2026-09-27T12:00:00Z';
const q=['Willow House','Ridge House','Studio extension'].map((job,i)=>({id:'q'+i,customer_name:['Alex Morgan','Taylor & Sons','Willow Homes'][i],job_name:job,status:'confirmed',job_status:'sent',quote_number:1048+i,created_at:date,updated_at:date}));
const qp={quotes:q,workspaceSlug:'demo',monthlyQuoteAtCap:false,monthlyQuoteUsed:12,monthlyQuoteLimit:50,effectivePlanCode:'pro',subscriptionActive:true};
const partial={title:'Some quotes were not exported',description:'Prepared 2 of 3 quotes. The ZIP download has been requested. Check your browser downloads.',tone:'warning',details:['Quote 1049, Taylor & Sons (render failed)']};
screen('quotes-partial-export',W+'quotes/QuotesList.tsx','QuotesList',qp,{useQcActionNotice:{result:partial}},'Quotes');
screen('quotes-export-failure',W+'quotes/QuotesList.tsx','QuotesList',qp,{useQcActionNotice:{result:{title:'Nothing exported',description:'No quotes could be exported. Review the details before trying again.',tone:'danger',details:['Willow House (not found)','Ridge House (provider unavailable)']}},QuotesList:{selectedIds:new Set(['q0','q1'])}},'Quotes');
screen('quotes-confirm-delete',W+'quotes/QuotesList.tsx','QuotesList',qp,{QuotesList:{selectedIds:new Set(['q0','q1']),bulkDeleteConfirmOpen:true}},'Quotes');
const orders=[{id:'o1',order_number:'PO-2047',to_supplier:'Northside Building Supplies',supplier_name:'Northside Building Supplies',status:'ordered',created_at:date,updated_at:date,quote_id:'q1'}];
screen('orders-complete-export',W+'material-orders/order-list.tsx','OrderList',{orders,workspaceSlug:'demo'},{useQcActionNotice:{result:{title:'Export ready',description:'Prepared 1 of 1 orders. The ZIP download has been requested. Check your browser downloads.',tone:'success'}}},'Orders');
screen('orders-empty-after-delete',W+'material-orders/order-list.tsx','OrderList',{orders:[],workspaceSlug:'demo'},{useQcActionNotice:{result:{title:'Deletion complete',description:'Orders deleted: 1. Skipped: 0 (not owned or already gone).',tone:'success'}}},'Orders');
const invoices=[{id:'i1',invoice_number:'INV-038',payment_reference:'INV-038',status:'sent',customer_name:'Willow Homes',customer_email:'example@example.invalid',currency:'GBP',total:11812.8,invoice_date:'2026-09-25',due_date:'2026-10-25',created_at:date,updated_at:date,public_token:'fixture'}];
screen('invoices-skipped-delete',W+'invoices/InvoiceList.tsx','InvoiceList',{invoices,workspaceSlug:'demo'},{useQcActionNotice:{result:{title:'Deletion finished with skipped records',description:'Draft invoices deleted: 2. Skipped: 1. Only draft invoices can be bulk-deleted; cancel sent invoices individually.',tone:'warning'}}},'Invoices');
const setup={workspaceSlug:'demo',templates:[],companyId:'example',defaultMeasurementSystem:'metric',digitalTakeoffAvailable:true,monthlyQuoteAtCap:false,monthlyQuoteUsed:12,monthlyQuoteLimit:50,effectivePlanCode:'pro',defaultTrade:'roofing',componentCollections:[{id:'c1',name:'Standard components',is_bootstrap:true}]};
screen('new-quote-customer-validation',W+'quotes/new/QuoteDetailsForm.tsx','QuoteDetailsForm',setup,{QuoteDetailsForm:{customerTouched:true}},'New quote');
screen('new-quote-digital-validation',W+'quotes/new/QuoteDetailsForm.tsx','QuoteDetailsForm',setup,{QuoteDetailsForm:{customerName:'Alex Morgan',entryMode:'digital',validationAttempted:true}},'New quote');
process.env.NEXT_PUBLIC_GENERIC_TRADES_V1='true';
screen('new-quote-generic-trades',W+'quotes/new/QuoteDetailsForm.tsx','QuoteDetailsForm',setup,{QuoteDetailsForm:{customerName:'Alex Morgan',entryMode:'manual',selectedTrade:'electrical'}},'New quote');
process.env.NEXT_PUBLIC_GENERIC_TRADES_V1='false';
const tp={workspaceSlug:'demo',componentLibrary:[],customerTemplates:[]};
screen('template-name-validation',W+'resources/create/TemplateBuilder.tsx','TemplateBuilder',tp,{TemplateBuilder:{nameError:'Enter a template name.'}});
screen('template-empty-confirmation',W+'resources/create/TemplateBuilder.tsx','TemplateBuilder',tp,{TemplateBuilder:{name:'My quote structure'},useQcFeedback:{request:{kind:'confirm',title:'Save without components?',description:'You have not added any roof components or extras. You can still add them when building a quote.',confirmLabel:'Save template',cancelLabel:'Keep editing',resolve:()=>{}}}});
screen('order-template-name-validation',W+'material-orders/template-form.tsx','TemplateForm',{mode:'create',onSubmit:()=>{},onCancel:()=>{},saving:false},{TemplateForm:{nameError:'Enter a template name.'}},'Order template');
screen('security-remove-confirmation',W+'settings/SecurityQuestionsSection.tsx','SecurityQuestionsSection',{initialQuestions:[{slot:1,isSet:true,question:'What was the name of your first school?',updatedAt:date},{slot:2,isSet:false,question:''}]},{useQcFeedback:{request:{kind:'confirm',title:'Remove recovery question?',description:'You will no longer be able to use this question for account recovery.',confirmLabel:'Remove question',destructive:true,resolve:()=>{}}}},'Account security');
screen('long-result-details','app/components/ui/v2/QcActionNotice.tsx','QcActionNotice',{result:{title:'Some files were not exported',description:'Prepared 12 of 25 records. Check the details for records that need attention.',tone:'warning',details:Array.from({length:13},(_,i)=>`Record ${i+1}: ${'Long-record-name-'.repeat(8)} (provider unavailable)`)},onDismiss:()=>{}},{},'Export result');
fs.writeFileSync(out+'/render-report.json',JSON.stringify({method:'Actual source JSX and shared CSS, deterministic hook values, effects off, requests and actions forbidden; not React/Next or deployed screenshots.',results,loaded:[...used],mocked:[...mocked]},null,2));
console.log(results);if(results.some(r=>!r.pass))process.exitCode=1;
