import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Access, CardContent, RecordTarget } from '../v2/contracts';
import { isUuid, parseTarget } from '../v2/contracts';
import { AssistantV2Error } from '../v2/runtime.server';
import { batchClient, toJson } from '../v2/database';
import { isRecord, type AssistantSection } from '../section-permissions';
import { RETRIEVAL_SCHEMA_HASH } from './schema-version';
import { LIMITS, parseQueryPlan, sourceSpec } from './registry';
import { RetrievalError, type QueryData, type QueryPlan, type QueryRow, type RetrievalResult } from './contracts';
import { finishEngineQuery } from './engine';
import { renderResult, rowLabel, scopeLabel } from './render';
import { intelligenceAvailable } from './intelligence';
import { compileIntelligentPlan } from './semantics';
import { childPlan, parentPlan, parseCompositeSelection, selectedRow, connectionFor, type CompositeResult } from './relationships';
import { targetForRow, targetKey } from './targets';
import { parseCoverage, requirePopulationCoverage } from './ranking';
export function retrievalEnabled(): boolean { return process.env.SMART_ASSISTANT_RETRIEVAL_ENABLED === 'true'; }
export interface RetrievalCapabilities { intelligenceVersion?: number; enabled: boolean; knowledge: boolean; catalogues: boolean; historyAfter: string | null; knowledgeRevision: string; state: 'ready' | 'disabled' | 'setup_required'; }
function dbError(error:{code?:string}):Error {
 if(error.code==='42501')return new AssistantV2Error('access_changed','Assistant access or its admitted run changed. Start a new request.',403);
 if(error.code==='P1604')return new RetrievalError('permission_denied','This query requires a hidden section or an unavailable record. No inaccessible record is identified.');
 if(error.code==='P1601')return new RetrievalError('feature_disabled','This retrieval capability is not enabled for the workspace or its application entitlement. This is not a failed record search.');
 if(error.code==='P1603')return new RetrievalError('unsupported_field','The requested source, field or operation is not registered. Use source discovery instead of guessing.');
 if(['PGRST202','PGRST205','42883','42P01','42703'].includes(error.code??''))return new RetrievalError('setup_required','Retrieval setup or schema is incomplete. Ask the integrator to check the deployed P1.6/P1.7 reader migrations and generated registry.');
 if(['22023','22007','22008','22P02'].includes(error.code??''))return new RetrievalError('invalid_query','The database rejected this constrained query. No operation was performed.');
 if(['57014','54000'].includes(error.code??''))return new RetrievalError('too_broad','This query exceeded its read budget. Narrow the date range or record filters; no partial total was returned.');
 return new RetrievalError('read_failed','The authoritative read failed. Missing data has not been treated as zero or a permission denial.');
}
export async function loadRetrievalCapabilities(client:SupabaseClient,access:Access,runId:string,signal?:AbortSignal):Promise<RetrievalCapabilities>{
 const request=batchClient(client).rpc('sa_v2_retrieval_capabilities',{p_run_id:runId,p_revision:access.permissionRevision});
 const {data,error}=await(signal?request.abortSignal(signal):request);
 if(error){
  const mapped=dbError(error);
  if(mapped instanceof RetrievalError&&['feature_disabled','setup_required'].includes(mapped.code))return {enabled:false,knowledge:false,catalogues:false,historyAfter:null,knowledgeRevision:'0',state:mapped.code==='setup_required'?'setup_required':'disabled'};
  throw mapped;
 }
 if(!isRecord(data)||data.version!==1||typeof data.schema_hash!=='string'||typeof data.enabled!=='boolean'||typeof data.knowledge_enabled!=='boolean'||typeof data.catalogues_allowed!=='boolean'||typeof data.knowledge_revision!=='string'||!/^\d+$/.test(data.knowledge_revision)||(data.knowledge_history_after!==null&&(typeof data.knowledge_history_after!=='string'||!Number.isFinite(Date.parse(data.knowledge_history_after)))))throw new RetrievalError('setup_required','Retrieval code and SQL registry do not match. No query was attempted.');
 const compatible=data.schema_hash===RETRIEVAL_SCHEMA_HASH;
 return {intelligenceVersion:data.intelligence_version===1?1:0,enabled:compatible&&data.enabled,knowledge:compatible&&data.knowledge_enabled,catalogues:compatible&&data.catalogues_allowed,historyAfter:data.knowledge_history_after as string|null,knowledgeRevision:data.knowledge_revision,state:!compatible?'setup_required':data.enabled?'ready':'disabled'};
}
function decode(data:unknown,plan:QueryPlan,access:Access):QueryData {
 if(!isRecord(data)||data.version!==1||data.schema_hash!==RETRIEVAL_SCHEMA_HASH||data.source!==plan.source||!['rows','aggregate','engine_inputs'].includes(String(data.mode))||!Array.isArray(data.rows)||!data.rows.every(isRecord)||typeof data.complete!=='boolean'||typeof data.truncated!=='boolean'||typeof data.as_of!=='string'||!Number.isFinite(Date.parse(data.as_of))||!Array.isArray(data.group_by)||!data.group_by.every(k=>typeof k==='string')||!Array.isArray(data.warnings)||!data.warnings.every(w=>typeof w==='string'))throw new RetrievalError('read_failed','The database returned an invalid retrieval envelope.');
 if((data.mode!=='engine_inputs'&&data.mode!==plan.mode)||data.rows.length>(data.mode==='engine_inputs'?LIMITS.engineQuotes:LIMITS.rows)||JSON.stringify(data).length>2_800_000)throw new RetrievalError('read_failed','The read returned an unexpected mode or exceeded its bound.');
 const spec=sourceSpec(plan.source),expected=new Set([...plan.fields,...plan.groupBy,'_row_id','_kind','_target_id','_section','_touched','_rank','_matched','_position','_tie_count']);
 if(data.mode==='engine_inputs')for(const k of ['id','quote_number','customer_name','job_name','status','currency','updated_at',...plan.metrics.map(m=>m.field).filter((f):f is string=>!!f)])expected.add(k);
 plan.metrics.forEach((_,i)=>{expected.add(`metric_${i}`);expected.add(`_missing_${i}`);});
 if(data.group_by.length!==plan.groupBy.length||data.group_by.some(k=>!plan.groupBy.includes(String(k))))throw new RetrievalError('read_failed','The aggregate dimensions do not match the validated plan.');
 for(const row of data.rows){
  if(Object.keys(row).some(k=>!expected.has(k)))throw new RetrievalError('read_failed','An unrequested field appeared in a read result.');
  if(data.mode!=='aggregate'&&(typeof row._row_id!=='string'||!row._row_id||row._row_id.length>150))throw new RetrievalError('read_failed','Invalid source row identity.');
  if(row._section!=null&&(typeof row._section!=='string'||!Object.hasOwn(access.permissions,row._section)||access.permissions[row._section as AssistantSection]==='hidden'))throw new AssistantV2Error('access_changed','A returned section is no longer visible.',403);
  if(row._target_id!=null&&(!isUuid(row._target_id)||!parseTarget({kind:row._kind,id:row._target_id})))throw new RetrievalError('read_failed','Invalid navigation identity in the read result.');
  if(row._rank!==undefined&&(!isRecord(row._rank)||!Number.isInteger(row._rank.tier)||Number(row._rank.tier)<0||Number(row._rank.tier)>4||typeof row._rank.score!=='number'||!Number.isFinite(row._rank.score)))throw new RetrievalError('read_failed','Invalid structural ranking signals.');
  for(const [key,value] of Object.entries(row)){
   if(value===null||value===undefined||key.startsWith('_'))continue;
   const f=spec.fields[key];
   if(f?.type==='number'||key.startsWith('metric_')){if((typeof value!=='string'&&typeof value!=='number')||value===''||!Number.isFinite(Number(value)))throw new RetrievalError('read_failed','Invalid numeric result.');}
   else if(f?.type==='boolean'&&typeof value!=='boolean')throw new RetrievalError('read_failed','Invalid boolean result.');
   else if(f?.type==='uuid'&&!isUuid(value))throw new RetrievalError('read_failed','Invalid record identity.');
   else if(f&&f.type!=='json'&&typeof value!=='string')throw new RetrievalError('read_failed','Invalid scalar result.');
  }
 }
 return {version:1,schemaHash:RETRIEVAL_SCHEMA_HASH,source:plan.source,mode:data.mode as QueryData['mode'],rows:data.rows,asOf:data.as_of,truncated:data.truncated,complete:data.complete,groupBy:data.group_by as string[],warnings:data.warnings as string[],...(data.snapshots!==undefined?{snapshots:data.snapshots}:{}),...(typeof data.status==='string'?{status:data.status}:{}),...(data.coverage!==undefined?{coverage:parseCoverage(data.coverage,plan)}:{})};
}
function currentPlan(plan:QueryPlan,target:RecordTarget|null):QueryPlan {
 if(!plan.current)return plan;
 if(!target)throw new RetrievalError('needs_context','There is no current record on this page. Which job, quote, order or invoice do you mean?');
 const source=plan.source;
 let key:string|null=null;
 if(['quote','draft_quote'].includes(target.kind))key=source==='quotes'?'id':['quote_components','quote_areas','quote_entries','customer_quote_lines'].includes(source)?'quote_id':null;
 if(target.kind==='order')key=source==='orders'?'id':['order_lines','order_text_lines'].includes(source)?'order_id':null;
 if(target.kind==='invoice')key=source==='invoices'?'id':source==='invoice_lines'?'invoice_id':null;
 if(target.kind==='component'&&source==='component_library')key='id';
 if(!key)throw new RetrievalError('needs_context','The current page is a different record type. Which record should I use?');
 if(plan.filters.length>=LIMITS.filters)throw new RetrievalError('invalid_query','Too many filters to bind current page context safely.');
 return {...plan,current:false,filters:[...plan.filters,{field:key,op:'eq',value:target.id}]};
}
function resultError(error:RetrievalError,scope='No data read.'):RetrievalResult{return {source:'',mode:'none',state:error.code,code:error.code,rows:[],asOf:null,complete:false,truncated:false,scope,warnings:[],answer:error.message};}
export function createRetrievalService(input:{client:SupabaseClient;access:Access;runId:string;capabilities:RetrievalCapabilities;signal?:AbortSignal;current:()=>Promise<RecordTarget|null>;emit:(sections:AssistantSection[],content:CardContent)=>Promise<string>;report?:(value:Record<string,unknown>)=>void}){
 // Current history can contain prior knowledge even when this turn queries a quote.
 const usedKnowledge=input.capabilities.knowledge;
 let hasQueried=false;
 const produced=new WeakSet<object>();
 const report=input.report??(value=>console.info('[smart-assistant:retrieval]',JSON.stringify(value)));
 let usedIntelligence = false;
 const sections=Object.entries(input.access.permissions).filter(([,level])=>level!=='hidden').map(([key])=>key as AssistantSection);
 const service = {
  /** Classification/publication changes invalidate in-flight knowledge output. */
  async guard(signal?:AbortSignal){
   if(!usedKnowledge&&!hasQueried)return;
   const current=await loadRetrievalCapabilities(input.client,input.access,input.runId,signal??input.signal);
   if((usedIntelligence&&!intelligenceAvailable(current))||!current.enabled)throw new AssistantV2Error('access_changed','Retrieval capability or access changed. Ask again using current permissions.',409);
   if(usedKnowledge&&(!current.knowledge||current.knowledgeRevision!==input.capabilities.knowledgeRevision))throw new AssistantV2Error('access_changed','Document visibility changed. Ask again using current permissions.',409);
  },
  terminal(value:unknown):string|null{return isRecord(value)&&produced.has(value)&&!['invalid_query','unsupported_source','unsupported_field'].includes(String(value.state))&&typeof value.answer==='string'&&value.answer.length<=12_000?value.answer:null;},
  async resolve(rawSelection:unknown,presentation:'context'|'answer'|'open',signal?:AbortSignal):Promise<CompositeResult>{
   const start=performance.now();let reads=0;let relationship:string|null=null;
   try{
    if(!intelligenceAvailable(input.capabilities))throw new RetrievalError('feature_disabled','P1.7 composite resolution is not enabled or its SQL setup is incomplete.');
    const selection=parseCompositeSelection(rawSelection,input.access.permissions,input.capabilities.catalogues);relationship=selection.relationship;
    const parent=await service.query(parentPlan(selection,input.access.permissions),'context',signal);reads++;
    const chosen=selectedRow(parent);
    if(!chosen){const stopped:CompositeResult={...parent,stoppedAt:'parent'};produced.add(stopped);return stopped;}
    const parentId=String(chosen._row_id??chosen.id??'');
    if(!isUuid(parentId))throw new RetrievalError('read_failed','The resolved parent has no valid authoritative identity.');
    const child=await service.query(childPlan(selection,parentId,input.access.permissions),presentation,signal);reads++;
    const connection=connectionFor(selection.relationship);
    const result:CompositeResult={...child,relationship:{name:selection.relationship,parentSource:connection.parent,parentId,childSource:connection.child,verified:['ok','empty','ambiguous','incomplete'].includes(child.state)},stoppedAt:'child'};
    produced.add(result);return result;
   }catch(error){if(error instanceof RetrievalError){const result=resultError(error);produced.add(result);return result;}throw error;}
   finally{try{report({event:'sa_composite_resolution',version:1,runId:input.runId,relationship,reads,totalMs:Math.round(performance.now()-start)});}catch{/* diagnostics only */}}
  },
  async query(rawPlan:unknown,presentation:'context'|'answer'|'open',signal?:AbortSignal):Promise<RetrievalResult>{
   const start=performance.now();let rpcMs=0,engineMs=0,renderMs=0;let plan:QueryPlan|undefined;let result:RetrievalResult|undefined;
   try{
    if(!retrievalEnabled()||!input.capabilities.enabled)throw new RetrievalError('feature_disabled','Universal retrieval is not enabled for this workspace.');
    const intelligent=intelligenceAvailable(input.capabilities);
    if(intelligent){const compiled=compileIntelligentPlan(rawPlan,input.access.permissions,input.capabilities.knowledge);plan=compiled.plan;usedIntelligence=true;
     if(compiled.normalizations.length)try{report({event:'sa_retrieval_normalized',version:1,runId:input.runId,normalizations:compiled.normalizations});}catch{/* diagnostics only */}
    }else plan=parseQueryPlan(rawPlan,input.access.permissions,input.capabilities.knowledge);
    if(sourceSpec(plan.source).feature==='catalogs'&&!input.capabilities.catalogues)throw new RetrievalError('feature_disabled','Catalogue access is not enabled by this account’s current application entitlement.');
    if(plan.current)plan=currentPlan(plan,await input.current());
    hasQueried=true;
    if(signal?.aborted)throw new AssistantV2Error('turn_timeout','The turn timed out.',408);
    // The invoker RPC revalidates the admitted run, tenant, current permissions
    // and revision in its database snapshot; no redundant pre-RPC access read.
    const at=performance.now();
    const request=batchClient(input.client).rpc(intelligent?'sa_v2_retrieval_query_v17':'sa_v2_retrieval_query',{p_run_id:input.runId,p_revision:input.access.permissionRevision,p_plan:toJson(plan)});
    const response=await(signal?request.abortSignal(signal):request);rpcMs=performance.now()-at;
    if(response.error)throw dbError(response.error);
    if(signal?.aborted)throw new AssistantV2Error('turn_timeout','The turn timed out.',408);
    const decoded=decode(response.data,plan,input.access);
    const et=performance.now();const engineData=finishEngineQuery(decoded,plan,intelligent);const data=intelligent?requirePopulationCoverage(engineData,plan):engineData;engineMs=performance.now()-et;
    const rt=performance.now();result=renderResult(data,plan);renderMs=performance.now()-rt;
    if(result.state==='empty'&&!result.rows.length&&plan.filters.some(f=>f.field==='quote_number'&&f.op==='eq'))
     result.warnings.push('No permitted record has that quote number. If the user meant a job or customer name, search words/exact by name instead of filtering quote_number.');
    if(presentation!=='context'||result.state==='ambiguous'){
     if(result.state==='ambiguous'){
      const candidates=result.rows.slice(0,4);
      const options=candidates.map(row=>({label:rowLabel(row,plan!.source).slice(0,100),reply:`Use ${plan!.source} record ${String(row._row_id??row.id??'unknown')} (${rowLabel(row,plan!.source)}) for my previous request.`.slice(0,500)}));
      if(options.length===1)options.push({label:'Search differently',reply:'That is not the record I meant. Ask me for a useful name or date to narrow the search.'});
      if(options.length>=2)result.cardId=await input.emit(sections,{kind:'choices',title:result.answer.split('\n')[0].slice(0,300),options});
     }else{
      const candidates:QueryRow[]=result.rows.flatMap(row=>[row,...Object.entries(row).filter(([k])=>k.startsWith('_winners_')).flatMap(([,v])=>Array.isArray(v)?v as QueryRow[]:[])]);
      const unique=new Map<string,RecordTarget & {label:string;detail:string}>();
      for(const row of candidates){const target=targetForRow(row,plan.source,intelligent);if(target)unique.set(targetKey(target),{...target,label:rowLabel(row,plan.source).slice(0,300),detail:'Authorised retrieval result. Opening does not confirm a change.'});}
      const options=[...unique.values()].slice(0,10);
      const autoOpen=presentation==='open'&&result.complete&&result.state==='ok'&&options.length===1&&(!plan.resolve||result.resolution?.state==='selected');
      if(options.length){result.cardId=await input.emit(sections,{kind:'records',title:options.length===1?options[0].label:'Matching records',options,note:'Navigation does not approve a change. Your conversation stays available.',autoOpen});if(autoOpen)result.answer='The selected record will open. Your conversation will stay available.\n'+result.answer;}
     }
    }
    // Final access guard in the normal orchestrator still runs before finish.
    produced.add(result);return result;
   }catch(error){
    if(error instanceof RetrievalError){result=resultError(error,plan?scopeLabel(plan):undefined);produced.add(result);return result;}
    throw error;
   }finally{
    try{report({event:'sa_retrieval',version:1,runId:input.runId,source:plan?.source??null,mode:plan?.mode??null,state:result?.state??'failed',rowsReturned:result?.rows.length??0,truncated:result?.truncated??false,rpcMs:Math.round(rpcMs),engineMs:Math.round(engineMs),renderMs:Math.round(renderMs),totalMs:Math.round(performance.now()-start)});}catch{/* Diagnostics never change a task outcome. */}
   }
  },
 };
 return service;
}
