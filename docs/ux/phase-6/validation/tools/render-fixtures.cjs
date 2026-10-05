/** SOURCE-DERIVED STATIC FIXTURES, not React/Next application tests.
 * Transpiles real view modules. JSX produces a tree; hooks get deterministic
 * sample state. Effects/requests/router/action invocations are NOT executed.
 * Native dialogs are opened only by the local specimen document script.
 */
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'),out=process.env.QC_FIXTURES||path.resolve(__dirname,'../fixtures');fs.mkdirSync(out,{recursive:true});
const cache=new Map(),meta=new WeakMap(),names=new Map(),used=new Set(),mocked=new Set();let current=null,overrides={},query='',id=0;
const node=(type,props,key)=>({type,props:props||{},key}),Fragment=Symbol('fragment');
const noAction=()=>{throw Error('Fixture forbids backend/auth/router/upload actions');};
function state(init){const name=current.names[current.index++]||('state'+current.index),o=overrides[current.name]||{};let v=Object.hasOwn(o,name)?o[name]:(typeof init==='function'?init():init);return [v,noAction];}
const React={Fragment,createElement:(t,p,...c)=>node(t,{...p,children:c}),useState:state,useMemo:f=>/void loadMyCatalogs/.test(String(f))?undefined:f(),useCallback:f=>f,useEffect:()=>{},useLayoutEffect:()=>{},useInsertionEffect:()=>{},useRef:v=>({current:v}),useId:()=>`fixture-${++id}`,useTransition:()=>[false,noAction],useDeferredValue:x=>x,useSyncExternalStore:(_s,get)=>get(),memo:f=>f,forwardRef:f=>{function Forward(p){return f(p,null)}meta.set(Forward,{name:f.name||'Forward',names:['visible'],path:'forwardRef'});return Forward},createContext:v=>{let c={value:v};c.Provider={context:c};return c},useContext:c=>c.value,Suspense:({children})=>children};
React.default=React;
const jsx={jsx:node,jsxs:node,jsxDEV:node,Fragment};
const stub=new Proxy({__esModule:true,default:noAction},{get:(o,k)=>k in o?o[k]:noAction});
function getInfo(sf){let infos={};function visit(n){if(ts.isFunctionLike(n)&&n.name){let name=n.name.getText(sf),states=[];function scan(x){if(x!==n&&ts.isFunctionLike(x))return;if(ts.isVariableDeclaration(x)&&ts.isArrayBindingPattern(x.name)&&x.initializer&&ts.isCallExpression(x.initializer)&&/useState$/.test(x.initializer.expression.getText(sf)))states.push(x.name.elements[0].name.getText(sf));ts.forEachChild(x,scan);}scan(n);infos[name]=states;}ts.forEachChild(n,visit);}visit(sf);return infos;}
function load(rel){let p=path.resolve(root,rel);if(cache.has(p))return cache.get(p).exports;
 let s=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),infos=getInfo(sf);for(const [n,a]of Object.entries(infos))names.set(n,a);
 const code=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:p}).outputText;
 let module={exports:{}};cache.set(p,module);used.add(path.relative(root,p));
 const req=spec=>{
  if(spec==='react')return React;if(spec==='react/jsx-runtime'||spec==='react/jsx-dev-runtime')return jsx;
  if(spec.includes('FreeToolsWelcomeModal')){mocked.add(spec+' (not shown in no-draft fixture)');return {FreeToolsWelcomeModal:()=>null};}
  if(spec==='react-dom')return {createPortal:c=>c};
  if(spec==='next/link')return {__esModule:true,default:props=>node('a',props)};
  if(spec==='next/image')return {__esModule:true,default:props=>node('img',props)};
  if(spec==='next/navigation')return {useRouter:()=>({push:noAction,replace:noAction,refresh:noAction,back:noAction}),useSearchParams:()=>new URLSearchParams(query),useParams:()=>({workspaceSlug:'demo'}),usePathname:()=>'/demo/quotes',redirect:noAction,notFound:noAction};
  if(/\.(css|svg|png)$/.test(spec))return {};
  if(spec.startsWith('@heroicons')||spec==='lucide-react'){mocked.add(spec);return new Proxy({},{get:(_o,k)=>props=>node('svg',{...props,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','aria-hidden':true,children:node('path',{d:'M5 12h14M12 5v14',strokeWidth:1.7})})});}
  let target=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(p),spec):null;
  if(target){let file=[target,target+'.tsx',target+'.ts',target+'/index.tsx',target+'/index.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
   const r=file?path.relative(root,file):spec;
   const pure=/app\/lib\/currency\/currencies\.ts$/.test(r);
   const forbidden=/\/actions(?:[-\.]|$)|-actions\.ts$|\/lib\/|\/api\/|useSendDocument|MeasureJobModal|FreeToolsWelcomeModal|SendTip|useAuth|supabase|server-only/.test(r)&&!pure;
   if(file&&!forbidden)return load(r);
  }
  mocked.add(spec);return stub;
 };
 new Function('require','module','exports',code)(req,module,module.exports);
 for(const [key,value]of Object.entries(module.exports))if(typeof value==='function')meta.set(value,{name:value.name||key,names:infos[value.name]||[],path:path.relative(root,p)});
 return module.exports;
}
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const unitless=new Set(['opacity','zIndex','flex','flexGrow','flexShrink','order','fontWeight','lineHeight','zoom','gridColumn','gridRow']);
function render(n,selected){if(n===null||n===undefined||typeof n==='boolean')return '';if(Array.isArray(n))return n.map(x=>render(x,selected)).join('');if(typeof n==='string'||typeof n==='number')return esc(n);
 if(n.type===Fragment)return render(n.props.children,selected);
 if(n.type?.context){const c=n.type.context,prev=c.value;c.value=n.props.value;const h=render(n.props.children,selected);c.value=prev;return h;}
 if(typeof n.type==='function'){let prev=current,m=meta.get(n.type)||{name:n.type.name,names:names.get(n.type.name)||[]};current={...m,index:0};let tree;try{tree=n.type(n.props);}catch(e){e.message=`${m.path||''}:${m.name}: ${e.message}`;throw e;}let h=render(tree,selected);current=prev;return h;}
 if(typeof n.type!=='string')throw Error('Unknown element '+String(n.type));
 let attrs='',children=n.props.children;for(let[k,v]of Object.entries(n.props)){if(k==='children'||k==='ref'||k==='key'||k==='dangerouslySetInnerHTML'||/^on[A-Z]/.test(k)||v==null||typeof v==='function')continue;if(k==='className')k='class';if(k==='htmlFor')k='for';if(k==='defaultValue')k='value';if(k==='defaultChecked')k='checked';if(k==='autoFocus')k='autofocus';if(k==='tabIndex')k='tabindex';if(k==='readOnly')k='readonly';
 if(k==='style'&&typeof v==='object')v=Object.entries(v).map(([a,b])=>`${a.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}:${typeof b==='number'&&b!==0&&!unitless.has(a)?b+'px':b}`).join(';');
 if(n.type==='select'&&k==='value'){selected=String(v);continue;}
 if(n.type==='textarea'&&k==='value'){children=v;continue;}
 if(typeof v==='object')continue;
 if(typeof v==='boolean'){if(k.startsWith('aria-')||k.startsWith('data-'))attrs+=` ${k}="${v}"`;else if(v)attrs+=' '+k;}else attrs+=` ${k}="${esc(v)}"`;
 }
 if(n.type==='option'&&String(n.props.value??n.props.children)===selected)attrs+=' selected';
 return `<${n.type}${attrs}>`+(voids.has(n.type)?'':(n.props.dangerouslySetInnerHTML?.__html||render(children,selected))+`</${n.type}>`);
}
const W='app/(auth)/[workspaceSlug]/';let results=[];
function screen(name,rel,exportName,props={},states={},title=null){overrides=states;id=0;query='';try{const f=load(rel)[exportName],html=render(node(f,props));let head=title?render(node(load('app/components/ui/v2/QcJourney.tsx').QcJourneyHeader,{title,eyebrow:'QuoteCore+ · example workspace',description:'Source-derived Phase 6 layout specimen. Not the running application.'})):'';
 let page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><link rel="stylesheet" href="fixture.css"><style>body{margin:0;background:#f6f7f9;font-family:Arial,sans-serif}.specimen{max-width:1120px;margin:0 auto;padding:28px 24px}.specimen-note{font:11px/18px Arial;color:#596273;padding:8px 16px;background:#fff;border-bottom:1px solid #dde1e7}.specimen:has(.qc-flow-auth){max-width:none;padding:0}@media(max-width:767px){.specimen{padding:20px 16px}}</style><body><div class="specimen-note">SOURCE-DERIVED STATIC FIXTURE · sample data · no saving, sending or payments</div><main class="specimen">${head}${html}</main><script>for(const d of document.querySelectorAll('dialog')){d.showModal();}</script></body></html>`;
 fs.writeFileSync(path.join(out,name+'.html'),page);results.push({name,source:rel,status:'rendered'});
 }catch(e){results.push({name,source:rel,status:'failed',error:e.stack});console.error(name,e.stack);}}
const now='2026-09-26T14:30:00Z';
const quotes=[['q1','Aster Roofing Ltd','32 Willow Lane','sent','sent'],['q2','Morgan Ellis','Ridge House','confirmed','accepted'],['q3','Greenwood Homes','Westfield extension','confirmed','materials_ordered'],['q4','Taylor & Sons','Workshop roof','draft','unsent']].map((a,i)=>({id:a[0],customer_name:a[1],job_name:a[2],status:a[3],job_status:a[4],quote_number:i===3?null:`Q-${1048+i}`,created_at:now,updated_at:now,viewed_at:i===0?now:null,has_pending_revision:i===2}));
const qp={quotes,workspaceSlug:'demo',monthlyQuoteAtCap:false,monthlyQuoteUsed:18,monthlyQuoteLimit:50,effectivePlanCode:'pro',subscriptionActive:true};
screen('quotes',W+'quotes/QuotesList.tsx','QuotesList',qp,{},'Quotes');
screen('quotes-drafts',W+'quotes/QuotesList.tsx','QuotesList',qp,{QuotesList:{activeTab:'draft'}},'Quotes');
screen('quotes-bulk',W+'quotes/QuotesList.tsx','QuotesList',qp,{QuotesList:{selectedIds:new Set(['q1','q2'])}},'Quotes');
const invoices=quotes.slice(0,3).map((q,i)=>({...q,invoice_number:`INV-${2080+i}`,payment_reference:`INV-${2080+i}`,customer_email:'customer@example.test',currency:'GBP',total:4250+i*820,invoice_date:'2026-09-25',due_date:'2026-10-25',sent_at:now,paid_at:null,viewed_at:null,changes_requested_at:null,payment_reported_at:null,disputed_at:null,status:['sent','paid','draft'][i]}));
screen('invoices',W+'invoices/InvoiceList.tsx','InvoiceList',{invoices,workspaceSlug:'demo'},{},'Invoices');
screen('create-invoice',W+'invoices/CreateInvoiceModal.tsx','CreateInvoiceModal',{workspaceSlug:'demo',onClose:noAction});
const orders=quotes.slice(0,3).map((q,i)=>({...q,order_number:`ORD-${415+i}`,status:['ready','ordered','pickup'][i],supplier_name:['Westfield Roofing Supplies','Northgate Trade Centre','Ridgeway Materials'][i],order_name:'Roof materials',order_total:1200,total:1200,quote_name:q.job_name,quote_id:q.id,layout_mode:'line_by_line',updated_at:now,created_at:now,viewed_at:null,changes_requested_at:null,info_requested_at:null}));
screen('orders',W+'material-orders/order-list.tsx','OrderList',{orders,workspaceSlug:'demo'},{},'Recent orders');
screen('catalogue-upload',W+'catalogs/upload-wizard.tsx','UploadWizard',{workspaceSlug:'demo',onClose:noAction,onComplete:noAction});
const rows=[{Product:'Ridge tile',SKU:'RT-200',Price:'24.50',Notes:'Grey finish'},{Product:'Roof membrane',SKU:'RM-50',Price:'92.00',Notes:'50 m² roll'},{Product:'Timber batten',SKU:'TB-38',Price:'3.40',Notes:'Treated'}];
screen('catalogue-map',W+'catalogs/upload-wizard.tsx','UploadWizard',{workspaceSlug:'demo',onClose:noAction,onComplete:noAction},{UploadWizard:{step:2,file:{name:'supplier-prices.csv'},catalogName:'September roofing supplies',parsed:{headers:Object.keys(rows[0]),titles:Object.keys(rows[0]),rows,warnings:[],synthesised:false},columnMapping:{sku:'SKU',name:'Product',price:'Price',notes:'Notes'}}});
screen('catalogue-components',W+'components/components/AddFromCatalogModal.tsx','AddFromCatalogModal',{workspaceSlug:'demo',collections:[{id:'lib1',name:'Roofing materials',is_bootstrap:true}],onClose:noAction,onCreated:noAction},{AddFromCatalogModal:{step:'view-rows',headers:Object.keys(rows[0]),allRows:rows,fieldToHeader:{name:'Product',sku:'SKU',price:'Price',notes:'Notes'},columnMapping:{Product:['name'],SKU:['sku'],Price:['price'],Notes:['notes']},selectedRowIndices:new Set([0,1,2])}});
const plan=(code,price,index)=>({code,displayName:code==='pro_plus'?'Pro Plus':code[0].toUpperCase()+code.slice(1),sortOrder:index,priceCentsMonthly:price,priceCentsMonthlyOriginal:null,monthlyQuoteLimit:50*(index+1),storageLimitBytes:2*1024**3,componentLimit:1000,flashingLimit:50,monthlyMaterialOrderLimit:25,monthlyInvoiceLimit:25,monthlyAiTokens:50,monthlyAiParseLimit:5,aiAssistPointsLimit:15,includedSeats:1,features:{digital_takeoff:true,flashings:true,material_orders:true,followups:true,email_send:true,activity_card:true,invoices:true,message_center:true},tagline:'Choose the tools and limits for your work.',featureBlurbs:[],comingSoon:false,hasStripePrice:true});
const bp={effectivePlanCode:'pro',purchasedPlanCode:'pro',subscriptionStatus:'active',hasStripeCustomer:true,hasActiveSubscription:true,currentPeriodEnd:'2026-10-25T00:00:00Z',cancelAtPeriodEnd:false,cancelAt:null,firstPaymentFailureAt:null,storageUsedBytes:512*1024**2,storageLimitBytes:2*1024**3,plans:[plan('starter',1900,0),plan('pro',3900,1),plan('pro_plus',5900,2)]};
screen('billing',W+'account/billing/BillingPanel.tsx','BillingPanel',bp,{},'Billing');
screen('activation',W+'account/billing/BillingPanel.tsx','BillingPanel',{...bp,context:'activation',effectivePlanCode:'free',purchasedPlanCode:'free',subscriptionStatus:'inactive',hasStripeCustomer:false,hasActiveSubscription:false,currentPeriodEnd:null},{},'Activate your workspace');
screen('company-settings',W+'settings/CompanySettingsForm.tsx','CompanySettingsForm',{companyId:'fixture-company',userId:'fixture-user',currentCompanyName:'Aster Roofing Ltd',currentUserName:'Alex Morgan',currentCurrency:'GBP',currentLanguage:'en',currentMeasurement:'metric',currentMaterialMargin:15,currentLaborMargin:20,currentLogoUrl:null,currentTaxes:[{id:'tax1',name:'VAT',rate_percent:20}]},{},'Company');
screen('login','app/login/page.tsx','default');screen('signup','app/signup/page.tsx','default');
screen('reset-password','app/auth/reset-password/page.tsx','default');
const config={noun:'Quote',recipientNoun:'customer',attachments:'library+entity',modes:['send','url','email'],nounLower:'quote'};
const hook={config,open:true,setOpen:noAction,mode:'choose',setMode:noAction,sendStage:'form',setSendStage:noAction,emailTemplates:[],draftRules:[],attachmentSelection:{libraryFileIds:[],entityFileIds:[]},openEmailOrSendMode:noAction};
screen('send-options','app/components/send/SendDocumentModal.tsx','SendDocumentModal',{hook,entityKind:'quote',libraryFiles:[],entityFiles:[],libraryLocked:false});
fs.writeFileSync(out+'/render-report.json',JSON.stringify({method:'Real TSX modules; custom static JSX evaluator and deterministic hook stubs. NOT React/Next runtime tests.',results,loadedSources:[...used],mockedModules:[...mocked]},null,2));
console.log(results.map(x=>x.name+': '+x.status).join('\n'));
