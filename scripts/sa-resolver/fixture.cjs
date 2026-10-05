/* Explicit in-memory read/metadata transports, NOT a Supabase or RLS emulator.
 * Queries are compiled against the real registry; fixtures only evaluate the
 * known predicates needed by these application-contract tests. */
const {root,mocks}=require('../sa-speed-test-loader.cjs');
const path=require('node:path');
const load=p=>require(path.join(root,'app/lib/smart-assistant',p));
class AccessError extends Error{constructor(code,message,status=403){super(message);this.code=code;this.status=status;}}
mocks.set('../v2/runtime.server',{AssistantV2Error:AccessError});
const {DEFAULT_SECTION_PERMISSIONS:DEFAULT}=load('section-permissions.ts');
const {createEntityResolver}=load('resolver/service.server.ts');
const {parseResolutionState}=load('resolver/state.ts');
const {compileIntelligentPlan}=load('retrieval/semantics.ts');
const {normalizeName}=load('resolver/anchors.ts');
const {encodeResolutionChoice}=load('resolver/wire.ts');
const {RetrievalError}=load('retrieval/contracts.ts');
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const fixedNow=()=>new Date('2026-09-27T12:00:00Z');
const metadata=(source,id,extra={})=>({id:typeof id==='string'?id:uuid(id),_row_id:typeof id==='string'?id:uuid(id),_kind:'quote',_target_id:uuid(id),_section:'quotes',_rank:{tier:4,score:100},_touched:'2026-09-27',...extra});
const quote=(id=1,extra={})=>metadata('quotes',id,{quote_number:1014,status:'draft',job_name:'Smith Roof',customer_name:'John Smith',currency:'GBP',created_at:'2026-09-18T00:00:00.000Z',updated_at:'2026-09-20T00:00:00.000Z',_kind:'draft_quote',_section:'draft_quotes',...extra});
const component=(id=10,extra={})=>metadata('quote_components',id,{name:'Ridge',quote_id:uuid(1),quote_number:1014,quote_status:'draft',job_name:'Smith Roof',customer_name:'John Smith',currency:'GBP',unit:'m',pricing_unit:'m',material_rate:30,labour_rate:12,material_cost:300,labour_cost:120,final_quantity:10,_kind:'draft_quote',_target_id:uuid(1),_section:'components',...extra});
const library=(id=20,extra={})=>metadata('component_library',id,{name:'Ridge',collection_name:'Standard',currency:'GBP',unit:'m',default_material_rate:18.5,default_labour_rate:5,pricing_strategy:'per_unit',is_active:true,_kind:'component',_target_id:uuid(id),_section:'components',...extra});
const order=(id=30,extra={})=>metadata('orders',id,{order_number:'184',job_name:'Smith Roof',supplier_name:'Supplier',order_date:'2026-09-18',status:'Ready',related_quote_id:uuid(1),_kind:'order',_target_id:uuid(id),_section:'orders',...extra});
const orderLine=(id=31,extra={})=>metadata('order_lines',id,{order_id:uuid(30),order_number:'184',job_name:'Smith Roof',item_name:'Ridge',quantity:42,unit:'m',_kind:'order',_target_id:uuid(30),_section:'orders',...extra});
const matchFilter=(row,f)=>{const v=row[f.field];if(f.op==='eq')return String(v)===String(f.value);if(f.op==='in')return f.value.map(String).includes(String(v));if(f.op==='gte')return v>=f.value;if(f.op==='lt')return v<f.value;if(f.op==='words')return normalizeName(String(f.value)).split(' ').every(x=>normalizeName(String(v??'')).split(' ').includes(x));throw Error('fixture unsupported filter '+f.op);};
function setup(db={},extras={}){
 const s={db,reads:[],cards:[],reports:[],saved:[],guards:0,proposals:[],current:null,revoked:false,run:40,nextId:100,clock:fixedNow(),permissions:{...DEFAULT,...Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,'edit']))},...extras};
 const store={load:async(id)=>{s.loads=(s.loads??0)+1;if(s.storeError)throw s.storeError;const last=s.saved.at(-1);return last&&(!id||last.id===id)?structuredClone(last):null;},save:async(state,sections)=>{if(s.storeError)throw s.storeError;if(!parseResolutionState(JSON.parse(JSON.stringify(state))))throw Error('fixture rejected invalid produced state '+JSON.stringify(state));const item={id:uuid(s.nextId++),expiresAt:new Date(s.clock.getTime()+900000).toISOString(),state:JSON.parse(JSON.stringify(state)),sections};s.saved.push(item);return structuredClone(item);}};
 async function lookup(raw,signal){
  const plan=compileIntelligentPlan(raw,s.permissions).plan;
  s.reads.push({plan:structuredClone(plan),signal});if(s.revoked)throw new AccessError('permissions_changed','Revoked');
  if(s.override){const r=await s.override(plan,signal);if(r!==undefined)return r;}
  let rows=(s.db[plan.source]??[]).filter(row=>plan.filters.every(f=>matchFilter(row,f)));
  if(plan.quoteScope==='quotes')rows=rows.filter(r=>!(r.status==='draft'||r.quote_status==='draft'));
  if(plan.quoteScope==='drafts')rows=rows.filter(r=>r.status==='draft'||r.quote_status==='draft');
  if(plan.current){const target=s.current;if(!target)rows=[];else rows=rows.filter(r=>r.id===target.id||r._target_id===target.id);}
  for(const rel of plan.related){rows=rows.filter(row=>{let children;if(rel.relation==='quote')children=(s.db.quotes??[]).filter(q=>q.id===(row.quote_id??row.related_quote_id));else if(rel.relation==='components')children=(s.db.quote_components??[]).filter(q=>q.quote_id===row.id);else throw Error('fixture relation '+rel.relation);return children.some(c=>rel.filters.every(f=>matchFilter(c,f)));});}
  if(plan.search){const {text,match,field}=plan.search,q=normalizeName(text);rows=rows.filter(row=>{const hay=field?String(row[field]??''):Object.entries(row).filter(([k])=>!k.startsWith('_')).map(([,v])=>String(v)).join(' ');const n=normalizeName(hay);return match==='natural'?true:match==='exact'?Object.values(row).some(v=>normalizeName(String(v))===q):q.split(' ').every(t=>n.split(' ').includes(t));});}
  const truncated=rows.length>plan.limit;rows=rows.slice(0,plan.limit).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>k.startsWith('_')||plan.fields.includes(k))));
  return {state:rows.length?'ok':'empty',source:plan.source,mode:'rows',rows,complete:!truncated,truncated,asOf:s.clock.toISOString(),scope:'fixture admitted caller',warnings:[],answer:'fixture'};
 }
 s.turn=async(message,runExtra={})=>{s.run++;s.reads=[];s.cards=[];s.reports=[];const service=createEntityResolver({access:{userId:uuid(900),companyId:uuid(901),permissionRevision:7,workspaceSlug:'test',permissions:s.permissions,phases:{p1:true,p2:true,p3:true,p4:false}},runId:uuid(s.run),userMessage:message,catalogues:true,lookup,current:async()=>s.current,store,emit:async(sections,content)=>{s.cards.push({sections,content});return uuid(s.nextId++);},guard:async()=>{s.guards++;if(s.revoked)throw new AccessError('permissions_changed','Revoked');},propose:async(args,parentId)=>{s.proposals.push({args,parentId});return s.proposalResult??{action:{id:uuid(800),status:'proposed'}};},now:()=>s.clock,uuid:()=>uuid(s.nextId++),report:e=>s.reports.push(e),...runExtra});s.service=service;return service.tryTurn(runExtra.signal);};
 s.click=async(choice,runExtra={})=>s.turn(encodeResolutionChoice({version:1,stateId:s.saved.at(-1).id,choice}),runExtra);
 return s;
}
module.exports={setup,uuid,quote,component,library,order,orderLine,metadata,AccessError,RetrievalError,load,fixedNow};
