/* Source-derived layout specimens, NOT a React/Next runtime test.
 * Existing TSX is evaluated using inert hook shims; effects, requests and actions
 * do not run. Fixture-only state injection simulates loaded document values.
 * The shipped app never imports this tool. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QC_TYPESCRIPT_MODULE || 'typescript');
const tw=require(process.env.QC_TAILWIND_MODULE || 'tailwindcss');
const root=process.env.QC_SOURCE_ROOT||path.resolve(__dirname,'../../../..');
const out=process.env.QC_FIXTURE_OUT||path.resolve(__dirname,'../fixtures');fs.mkdirSync(out,{recursive:true});
let current='',states={},id=0;const loaded=new Map(),sources=new Map(),excluded=new Set();
const jsx=(type,props,key)=>({type,props:props||{},key});
const react={createContext:v=>({_fixtureDefault:v,Provider:p=>p.children}),useContext:c=>c._fixtureDefault,useState:(v,k)=>[Object.hasOwn(states[current]||{},k)?states[current][k]:(typeof v==='function'?v():v),()=>{}],useEffect:()=>{},useLayoutEffect:()=>{},useMemo:f=>f(),useCallback:f=>f,useRef:v=>({current:v}),useId:()=>`fixture-${++id}`,forwardRef:f=>function ForwardRef(p){return f(p,null)},memo:f=>f,createElement:(t,p,...c)=>jsx(t,{...p,children:c}),Fragment:'FRAGMENT'};
const htmlesc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function load(file){if(file.endsWith('.css'))return{};if(loaded.has(file))return loaded.get(file).exports;let src=fs.readFileSync(file,'utf8');sources.set(file,src);const m={exports:{}};loaded.set(file,m);
 const fixtureHookNames=ctx=>{const f=ctx.factory;return node=>{function v(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText()==='useState'){return f.updateVariableDeclaration(n,n.name,n.exclamationToken,n.type,f.updateCallExpression(n.initializer,n.initializer.expression,n.initializer.typeArguments,[...n.initializer.arguments,f.createStringLiteral(n.name.elements[0].name.text)]));}return ts.visitEachChild(n,v,ctx)}return ts.visitNode(node,v)}};
 const js=ts.transpileModule(src,{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},transformers:{before:[fixtureHookNames]}}).outputText;
 const requireLocal=id=>{
  if(id==='react')return react;if(id==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'FRAGMENT'};
  if(id==='next/navigation')return{useRouter:()=>({push:()=>{},back:()=>{},refresh:()=>{}}),useSearchParams:()=>({get:()=>null}),useParams:()=>({workspaceSlug:'fixture'})};
  if(id==='next/link')return{__esModule:true,default:p=>jsx('a',p)};
  if(id.endsWith('.css'))return{};
  if(id.endsWith('/useSendDocument')){excluded.add('useSendDocument (inert send hook; real trigger component rendered)');return{useSendDocument:()=>({config:{sendButtonLabel:'Send Invoice',sendButtonDataCopilot:'invoice-send'},handleOpen:()=>{},showTestTip:false,showNoCustomerQuote:false})};}
  if(id.endsWith('/SendDocumentModal')){excluded.add('SendDocumentModal (closed, not evaluated)');return{SendDocumentModal:()=>null};}
  let target=id.startsWith('@/')?path.join(root,id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(file),id):null;
  if(!target){excluded.add(id);return new Proxy({},{get:(_,k)=>k==='__esModule'?false:()=>{throw new Error('Unavailable external dependency invoked: '+id+'.'+String(k))}})}
  if(/(?:actions|order-loader|quote-loader|renderPreviewToPdf|supabase\/)/.test(target)){excluded.add(path.relative(root,target));return new Proxy({},{get:(_,k)=>k==='__esModule'?false:()=>{throw new Error('Protected dependency invoked: '+String(k))}})}
  target=[target,target+'.tsx',target+'.ts',target+'.js',path.join(target,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if(!target)throw new Error('Cannot resolve '+id+' from '+file);return load(target);
 };
 const fn=vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:file});fn(requireLocal,m,m.exports);return m.exports;
}
const booleanAttrs=new Set(['hidden','checked','disabled','required','multiple','autoFocus','readOnly','open','selected']);
const aliases={className:'class',htmlFor:'for',tabIndex:'tabindex',autoFocus:'autofocus',readOnly:'readonly',strokeWidth:'stroke-width',strokeLinecap:'stroke-linecap',strokeLinejoin:'stroke-linejoin',fillRule:'fill-rule',clipRule:'clip-rule',colSpan:'colspan',rowSpan:'rowspan'};
function html(n,selectValue){if(n==null||typeof n==='boolean')return'';if(Array.isArray(n))return n.map(x=>html(x,selectValue)).join('');if(typeof n!=='object')return htmlesc(n);if(typeof n.type==='function'){const old=current;current=n.type.name;try{return html(n.type(n.props),selectValue)}finally{current=old}};if(n.type==='FRAGMENT')return html(n.props.children,selectValue);if(typeof n.type!=='string')throw new Error('Invalid element '+String(n.type));
 let {children,...attrs}=n.props;if(attrs.dangerouslySetInnerHTML)children={raw:attrs.dangerouslySetInnerHTML.__html};
 if(n.type==='select'&&Object.hasOwn(attrs,'value'))selectValue=attrs.value;
 if(n.type==='option'&&selectValue!==undefined)attrs.selected=String(attrs.value)===String(selectValue);
 if(n.type==='textarea'){children=attrs.value??attrs.defaultValue??children;delete attrs.value;delete attrs.defaultValue}
 let aa='';for(let [k,v]of Object.entries(attrs)){if(v==null||k==='ref'||k==='key'||k==='dangerouslySetInnerHTML'||k.startsWith('on')||k==='defaultChecked')continue;if(typeof v==='function')continue;
  if(k==='defaultValue')k='value';if(k==='style'){v=Object.entries(v).map(([a,b])=>a.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())+':'+(typeof b==='number'&&b!==0&&!['opacity','zIndex','fontWeight','flex','order','flexGrow','flexShrink','lineHeight'].includes(a)?b+'px':b)).join(';')}
  if(booleanAttrs.has(k)){if(v)aa+=' '+(aliases[k]||k);continue}if(typeof v==='boolean')v=String(v);aa+=` ${aliases[k]||k}="${htmlesc(v)}"`;
 }
 const voids=['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];return`<${n.type}${aa}>`+(voids.includes(n.type)?'':(children?.raw||html(children,selectValue))+`</${n.type}>`);
}
function css(file){return fs.readFileSync(file,'utf8').replace(/@import\s+['"](.+?)['"];?/g,(_,p)=>css(path.resolve(path.dirname(file),p)))}
const quoteLines=[
 {id:'l1',type:'custom',roofAreaId:'roof',text:'Roof tiles',quantityText:'Concrete interlocking tiles · supply and fit',amount:6720,qty:120,unitPrice:56,showPrice:true,showUnits:true,isVisible:true,includeInTotal:true,sortOrder:0},
 {id:'l2',type:'custom',roofAreaId:'roof',text:'Dry ridge system',quantityText:'12 m · ventilated ridge system',amount:864,qty:12,unitPrice:72,showPrice:true,showUnits:true,isVisible:true,includeInTotal:true,sortOrder:1},
 {id:'l3',type:'custom',text:'Scaffolding',quantityText:'Access and perimeter protection',amount:1800,qty:1,unitPrice:1800,showPrice:true,showUnits:true,isVisible:true,includeInTotal:true,sortOrder:2},
 {id:'l4',type:'custom',text:'Waste removal',quantityText:'Site clearance and disposal',amount:460,qty:1,unitPrice:460,showPrice:true,showUnits:true,isVisible:true,includeInTotal:true,sortOrder:3}
];
const company={cq_company_name:'Oak & Slate Roofing',cq_company_address:'18 Workshop Lane\nSampleton, AB1 2CD',cq_company_email:'office@example.invalid',cq_company_phone:'01234 000000',cq_company_logo_url:'',cq_footer_text:'Thank you for choosing Oak & Slate Roofing. This specimen uses fictional data.'};
const quote={id:'fixture-quote',quote_number:'Q-1042',customer_name:'Sample Customer',customer_email:'customer@example.invalid',customer_address:'8 Meadow Close, Sampleton',address:'8 Meadow Close, Sampleton',quote_date:'2026-09-25',created_at:'2026-09-25T12:00:00Z',show_quantity_column:true,material_margin_enabled:false,labor_margin_percent:0,entry_mode:'digital',trade:'roofing',...company};
const common={workspaceSlug:'fixture',currency:'GBP',defaultLogoUrl:null,templates:[],companyTaxes:[{id:'tax',name:'VAT',rate_percent:20}],collections:[],componentLibrary:[],catalogs:[]};
const quoteProps={...common,quote,roofAreas:[{id:'roof',label:'Main roof'}],components:[],savedLines:[],initialTaxes:[]};
const invoice={id:'fixture-invoice',invoice_number:'INV-1042',payment_reference:'INV-1042',status:'draft',source_type:'quote',customer_name:'Sample Customer',customer_email:'customer@example.invalid',customer_snapshot:{address:'8 Meadow Close, Sampleton'},currency:'GBP',subtotal:9844,tax_total:0,discount_total:0,total:9844,invoice_date:'2026-09-25',due_date:'2026-10-09',public_token:'fixture-only-no-link',payment_details:{accountName:'Oak & Slate Roofing',bankName:'Example Bank',accountNumber:'00000000',sortCode:'00-00-00'},notes:'Please use the invoice reference with your payment.',terms:'Payment due within 14 days.',...company};
const invoiceLines=quoteLines.map(l=>({id:l.id,line_source_type:'custom',source_id:null,title:l.text,description:l.quantityText,quantity:l.qty,unit:'',unit_price:l.unitPrice,line_total:l.amount,show_price:true,show_quantity:true,show_description:true,is_visible:true,include_in_total:true,sort_order:l.sortOrder}));
const invoiceProps={...common,invoice,savedLines:invoiceLines,emailTemplates:[],libraryFiles:[],libraryLocked:false,activity:[]};
const lineItems=quoteLines.map(l=>({...l,quantity:l.qty,quantityText:l.quantityText}));
const visualItems=[{id:'c1',flashingId:'ridge-demo',flashingImageUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 180"><path d="M25 140 L190 40 L230 40 L395 140" fill="none" stroke="#303641" stroke-width="5"/><path d="M28 160H390" stroke="#7c8798"/><text x="140" y="178" fill="#596273" font-family="Arial" font-size="13">Illustrative ridge profile</text></svg>').toString('base64'),componentName:'Ridge flashing',entryMode:'linear',quantity:1,unit:'m',lengthUnit:'m',lengths:[{length:2.4,multiplier:5}],showComponentName:true,showMeasurements:true,showFlashingImage:true,notes:'Anthracite finish. Match approved profile.'},{id:'c2',componentName:'Concrete roof tiles',entryMode:'single',quantity:1200,unit:'tiles',showComponentName:true,showMeasurements:true,showFlashingImage:false,notes:'Allow for the specified lap.'},{id:'c3',componentName:'Breather membrane',entryMode:'area',quantity:1,unit:'m²',lengthUnit:'m²',lengths:[{length:150,multiplier:1}],showComponentName:true,showMeasurements:true,showFlashingImage:false}];
const orderState={toSupplier:'Example Roofing Supplies',reference:'Meadow Close · roof replacement',orderType:'Materials',colours:'Anthracite',deliveryDate:'2026-10-02',deliveryAddress:'8 Meadow Close\nSampleton, AB1 2CD',fromCompany:'Oak & Slate Roofing',contactPerson:'Site team',contactDetails:'office@example.invalid',orderDate:'2026-09-25',orderNotes:'Please confirm delivery time before dispatch.',orderLines:visualItems,lineByLineLines:lineItems,lineByLineFooter:'Please confirm lead time before dispatch.',lineByLineTaxes:[],lineByLineShowQuantityColumn:true};
const orderProps={...common,flashings:[{id:'ridge-demo',name:'Ridge flashing',image_url:visualItems[0].flashingImageUrl}],components:[],initialLayout:'components',initialColumn:'single'};
const q=load(path.join(root,'app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx')).CustomerQuoteEditor;
const i=load(path.join(root,'app/(auth)/[workspaceSlug]/invoices/[id]/InvoiceEditor.tsx')).InvoiceEditor;
const o=load(path.join(root,'app/(auth)/[workspaceSlug]/material-orders/create/order-create-form.tsx')).OrderCreateForm;
const picker=load(path.join(root,'app/(auth)/[workspaceSlug]/material-orders/OrderLayoutPickerModal.tsx')).OrderLayoutPickerModal;
const qp=load(path.join(root,'app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/QuotePreview.tsx')).QuotePreview;
const ip=load(path.join(root,'app/(auth)/[workspaceSlug]/invoices/[id]/InvoicePreview.tsx')).InvoicePreview;
const op=load(path.join(root,'app/orders/[token]/OrderBody.tsx')).OrderBody;
const publicInvoice=load(path.join(root,'app/invoice/[token]/PublicInvoiceView.tsx')).PublicInvoiceView;
const qoutput={quote,lines:quoteLines,subtotal:9844,taxLines:[],taxTotal:0,total:9844,currency:'GBP',companyName:company.cq_company_name,companyAddress:company.cq_company_address,companyPhone:company.cq_company_phone,companyEmail:company.cq_company_email,companyLogoUrl:'',footerText:company.cq_footer_text,showEditButtons:false,showQuantityColumn:true};
const ioutput={invoice,lines:invoiceLines.map(l=>({...l,localId:l.id})),subtotal:9844,taxTotal:0,total:9844,currency:'GBP',companyName:company.cq_company_name,companyAddress:company.cq_company_address,companyPhone:company.cq_company_phone,companyEmail:company.cq_company_email,companyLogoUrl:'',footerText:company.cq_footer_text,notes:invoice.notes,terms:invoice.terms,invoiceDate:invoice.invoice_date,dueDate:invoice.due_date,paymentDetails:invoice.payment_details};
const ooutput={order:{order_number:2047,to_supplier:orderState.toSupplier,from_company:orderState.fromCompany,contact_person:orderState.contactPerson,contact_details:orderState.contactDetails,reference:orderState.reference,order_type:orderState.orderType,colours:orderState.colours,delivery_date:orderState.deliveryDate,delivery_address:orderState.deliveryAddress,header_notes:orderState.orderNotes,logo_url:'',order_date:orderState.orderDate,layout_mode:'double',line_by_line_data:{lines:lineItems,footer:orderState.lineByLineFooter,taxes:[],showQuantityColumn:true}},lines:visualItems.map(l=>({id:l.id,item_name:l.componentName,flashing_image_url:l.flashingImageUrl,flashing_id:null,entry_mode:l.entryMode,quantity:l.quantity,lengths:l.lengths,length_unit:l.lengthUnit,item_notes:l.notes,show_component_name:l.showComponentName,show_measurements:l.showMeasurements,show_flashing_image:l.showFlashingImage})),flashings:[],currency:'GBP'};
const cases=[
 ['output-quote',qp,qoutput,{}],
 ['output-invoice',ip,ioutput,{}],
 ['output-order-lines',op,{...ooutput,order:{...ooutput.order,layout_mode:'line_by_line'}},{}],
 ['output-order-visual',op,ooutput,{}],
 ['output-public-invoice',publicInvoice,{invoice,lines:invoiceLines,token:'fixture'},{}],
 ['output-long-invoice',ip,{...ioutput,lines:Array.from({length:48},(_,k)=>({...ioutput.lines[k%4],localId:'long'+k,title:'Item '+(k+1)+' · '+ioutput.lines[k%4].title,description:'Detailed specification: '+ioutput.lines[k%4].description})),subtotal:118128,total:118128},{}],
 ['quote',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines}}],
 ['quote-collapsed',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,panelCollapsed:true}}],
 ['quote-edit-line',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,editingLineId:'l1',studioSection:'line:l1'}}],
 ['quote-empty',q,quoteProps,{}],
 ['quote-items',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,studioSection:'items'}}],
 ['quote-appearance',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,studioSection:'appearance'}}],
 ['quote-full-preview',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,showPreviewModal:true,hideLinePrices:true}}],
 ['labour-sheet',q,{...quoteProps,editorTitle:'Labour Sheet Editor',previewTitle:'Labour Sheet Preview',includeMargins:false,taxAudience:'labor'}, {CustomerQuoteEditor:{lines:quoteLines}}],
 ['invoice',i,invoiceProps,{}],
 ['invoice-details',i,invoiceProps,{InvoiceEditor:{studioSection:'payment',payDirty:true}}],
 ['invoice-edit-line',i,invoiceProps,{InvoiceEditor:{editingLineId:'l1',studioSection:'line:l1'}}],
 ['invoice-paid',i,{...invoiceProps,invoice:{...invoice,status:'paid'}},{}],
 ['order-lines',o,{...orderProps,initialLayout:'line_by_line'},{OrderCreateForm:orderState}],
 ['order-single',o,orderProps,{OrderCreateForm:orderState}],
 ['order-double',o,{...orderProps,initialColumn:'double'},{OrderCreateForm:orderState}],
 ['order-edit-component',o,{...orderProps,initialColumn:'double'},{OrderCreateForm:{...orderState,studioSection:'line:c1',editingLineId:'c1',showAddItemModal:true}}],
 ['order-lines-edit',o,{...orderProps,initialLayout:'line_by_line'},{OrderCreateForm:orderState,OrderLineByLineEditor:{studioSection:'line:l1',editingLineId:'l1'}}],
 ['order-collapsed',o,{...orderProps,initialColumn:'double'},{OrderCreateForm:{...orderState,componentsPanelCollapsed:true}}],
 ['order-empty',o,orderProps,{}],
 ['order-picker',picker,{open:true,onClose:()=>{},onSelect:()=>{}},{}],
 ['quote-add-item',q,quoteProps,{CustomerQuoteEditor:{lines:quoteLines,showAddLine:true}}],
 ['invoice-add-item',i,invoiceProps,{InvoiceEditor:{showAddLine:true}}],
 ['visual-add-item',o,orderProps,{OrderCreateForm:{...orderState,showAddItemModal:true}}]
];
(async()=>{
 const rendered=[];
 for(const [name,component,props,st]of cases){states=st;id=0;try{const body=html(jsx(component,props));rendered.push([name,body]);console.log(name,'rendered',body.length);}catch(err){console.error(name,err.stack);process.exitCode=1;}}
 const candidates=new Set();for(const s of sources.values())for(const word of s.split(/[\s'"`{}<>]+/))candidates.add(word);for(const[,body]of rendered)for(const m of body.matchAll(/class="([^"]*)"/g))for(const x of m[1].split(' '))candidates.add(x);
 const twroot=process.env.QC_TAILWIND_ROOT || path.dirname(require.resolve('tailwindcss/package.json'));const compiled=await tw.compile(fs.readFileSync(path.join(twroot,'theme.css'),'utf8')+'\n'+fs.readFileSync(path.join(twroot,'preflight.css'),'utf8')+'\n@tailwind utilities;');
 const styles=compiled.build([...candidates])+'\n'+css(path.join(root,'app/components/ui/v2/qc-document.css'))+'\n'+css(path.join(root,'app/components/ui/v2/qc-document-studio.css'))+'\n'+css(path.join(root,'app/components/documents/qc-document-output.css'))+'\nbody{font-family:var(--qc-font-sans);background:var(--qc-bg-app);margin:0}.specimen-label{padding:10px 20px;font-size:11px;line-height:18px;color:#626771;border-bottom:1px solid #e7e9ee;background:white}.specimen-label strong{color:#191b20}.specimen-shell{min-width:0;margin:0 auto}.qc-dialog:not([open]){display:none}';
 fs.writeFileSync(path.join(out,'fixtures.css'),styles);
 for(const[name,body]of rendered)fs.writeFileSync(path.join(out,name+'.html'),`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Phase 5 · ${name} · static specimen</title><link rel="stylesheet" href="fixtures.css"></head><body><div class="specimen-label"><strong>PHASE 5 · SOURCE-DERIVED LAYOUT SPECIMEN</strong> · ${name} · Fictional data · Not the running application</div><main class="specimen-shell" style="${name.startsWith('output-') ? 'max-width:880px;margin:24px auto' : ''}">${body.replace(/src="(\/[^"]+)"/g,(match,url)=>{const file=path.join(root,'public',url);if(!fs.existsSync(file))return match;const mime=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')||file.endsWith('.jpeg')?'image/jpeg':'image/png';return 'src="data:'+mime+';base64,'+fs.readFileSync(file).toString('base64')+'"';})}</main><script>document.querySelectorAll('dialog').forEach(d=>d.showModal());</script></body></html>`);
 fs.writeFileSync(path.join(out,'fixture-manifest.json'),JSON.stringify({method:'Actual TSX evaluated with inert hook shims. No React/Next mount, effects, requests, API, persistence, PDF export or lifecycle execution.',tailwindVersion:JSON.parse(fs.readFileSync(path.join(twroot,'package.json'),'utf8')).version + ' (fixture compiler, not an app build)',excludedDependencies:[...excluded],cases:rendered.map(([n])=>n),sources:[...sources.keys()].map(p=>path.relative(root,p))},null,2));
})();
