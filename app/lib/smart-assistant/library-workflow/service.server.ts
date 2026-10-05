import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isUuid, type Access } from '../v2/contracts';
import { canonical, ProposalError } from '../v2/action-domain';
import { requireEdits } from '../v2/actions.server';
import { freshAccess } from '../v2/runtime.server';
import { workflowRpcError } from '../v2/workflow-conflict';
import { batchClient, toJson } from '../v2/database';
import { addCard } from '../v2/session.server';
import { creationContext, proposeDraft } from '../v2/creation.server';
import { WORKFLOW_SECTIONS, type DraftChoiceWire, type WorkflowCard, type WorkflowResult } from './contracts';
import type { WorkingBrief, WorkflowState } from '../workflow-controller/contracts';
import type { PlannedDraft } from '../workflow-controller/structural-diff';
import { createWorkingBrief, applyWorkingDeltas, validateWorkingBrief } from '../workflow-controller/brief';
import { resolveWorkingBrief, workingBriefSummary, workingProposalArgs } from '../workflow-controller/decisions';
import { readWorkflowCatalog, readWorkflowEpoch, readWorkflowVocabulary } from '../workflow-controller/configuration.server';
import { libraryWorkflowEnabled } from './config';

const admin=()=>createAdminClient() as any;
type StoredBrief={id:string;revision:number;company_id:string;user_id:string;conversation_id:string;permission_revision:number;
  brief:WorkingBrief;workflow_state:WorkflowState;catalog_epoch:number;produced_quote_id:string|null;action_id:string|null;
  committed_plan:PlannedDraft|null;committed_snapshot:Record<string,unknown>|null;start_run_id:string|null;last_run_id:string|null;created_at:string;updated_at:string;conflict_reason:string|null};
const FIELDS='id,revision,company_id,user_id,conversation_id,permission_revision,brief,workflow_state,catalog_epoch,produced_quote_id,action_id,committed_plan,committed_snapshot,start_run_id,last_run_id,created_at,updated_at,conflict_reason';

async function workflowAccess(client:SupabaseClient,access:Access){
  if(!libraryWorkflowEnabled())throw new ProposalError('The draft workflow is disabled on this deployment. Nothing was changed.');
  await freshAccess(client,access,'p4'); requireEdits(access,WORKFLOW_SECTIONS);
}
async function environment(client:SupabaseClient,access:Access){
  const config=await readWorkflowVocabulary(client,access.companyId);
  const catalog=await readWorkflowCatalog(client,access,config.concepts);
  if(await readWorkflowEpoch(client,access.companyId)!==config.epoch)throw new ProposalError('Assistant settings changed while preparing this brief. Review it again.');
  return {...config,catalog};
}
// Kept as an exported seam for existing callers; resolution always uses the new
// deliberate concept mapping, never a Takeoff role fallback.
export async function readAssistantLibraryCatalog(client:SupabaseClient,access:Access,collectionId?:string|null){
  await workflowAccess(client,access);
  const config=await readWorkflowVocabulary(client,access.companyId);
  const catalog=await readWorkflowCatalog(client,access,config.concepts,collectionId);
  if(await readWorkflowEpoch(client,access.companyId)!==config.epoch)throw new ProposalError('Assistant settings changed. Read the library again.');
  return catalog;
}
function assertCurrent(state:StoredBrief|null,access:Access,revision?:number):asserts state is StoredBrief{
  if(!state||state.company_id!==access.companyId||state.user_id!==access.userId||state.permission_revision!==access.permissionRevision
    ||revision!==undefined&&state.revision!==revision||['cancelled','closed'].includes(state.workflow_state)
    ||access.historyAfter&&Date.parse(state.created_at)<Date.parse(access.historyAfter))
    throw new ProposalError('That working brief changed or is no longer active. Reopen the current task; nothing was created or changed.');
  if(state.brief?.version!==1)throw new ProposalError('This older working brief has no safe revision baseline. Review its existing draft in the builder; do not recreate it automatically.');
}
async function loadState(access:Access,conversationId:string,stateId:string,revision:number):Promise<StoredBrief>{
  if(!isUuid(stateId)||!Number.isSafeInteger(revision)||revision<1)throw new ProposalError('A current working-brief identity and revision are required.');
  const {data,error}=await admin().from('assistant_v2_draft_briefs').select(FIELDS).eq('id',stateId).eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId).maybeSingle();
  if(error)throw workflowRpcError(error);
  const state=data as StoredBrief|null; assertCurrent(state,access,revision); return state;
}
async function snapshot(client:SupabaseClient,access:Access,state:StoredBrief,runId:string){
  if(!state.produced_quote_id) {
    if(state.committed_plan || state.committed_snapshot) throw new ProposalError('The original draft is no longer available. This brief cannot create a replacement. Nothing changed.');
    return null;
  }
  const {data,error}=await batchClient(createAdminClient()).rpc('sa_v2_workflow_quote_snapshot',{p_user_id:access.userId,p_quote_id:state.produced_quote_id});
  if(error)throw workflowRpcError(error);
  const found=data as Record<string,unknown>|null;
  const quote=found?.quote as Record<string,unknown>|undefined;
  if(!state.committed_plan||!state.committed_snapshot||!found||canonical(found)!==canonical(state.committed_snapshot)
    ||quote?.status!=='draft'||quote?.entry_mode!=='manual'||quote?.acceptance_token!=null||quote?.accepted_at!=null||quote?.withdrawn_at!=null||quote?.declined_at!=null
    ||!Array.isArray(found.area_entries)||found.area_entries.length){
    const conflict=await batchClient(createAdminClient()).rpc('sa_v2_workflow_conflict',{p_user_id:access.userId,p_conversation_id:state.conversation_id,p_run_id:runId,p_state_id:state.id,p_revision:state.revision,p_baseline:toJson(state.committed_snapshot)});
    if(conflict.error)throw workflowRpcError(conflict.error);
    throw new ProposalError('The saved draft changed outside this working brief or is no longer editable. Review the same draft in the builder. Nothing was overwritten and no replacement draft was created.');
  }
  return found;
}
function refreshAutomaticSelections(brief:WorkingBrief){
  const copy=structuredClone(brief);
  for(const key of Object.keys(copy.selections))if(copy.selectionSources[key]!=='explicit'){delete copy.selections[key];delete copy.selectionSources[key];}
  return copy;
}
async function persist(access:Access,conversationId:string,runId:string,brief:WorkingBrief,epoch:number,state:WorkflowState,previous?:StoredBrief):Promise<StoredBrief>{
  const {data,error}=await batchClient(createAdminClient()).rpc('sa_v2_workflow_save',{p_user_id:access.userId,p_conversation_id:conversationId,p_run_id:runId,
    p_state_id:previous?.id??null,p_expected_revision:previous?.revision??null,p_epoch:epoch,p_brief:toJson(brief),p_state:state});
  if(error)throw workflowRpcError(error);
  if(!data||typeof data!=='object'||Array.isArray(data)||!isUuid(data.id))throw workflowRpcError(null);
  return data as unknown as StoredBrief;
}

async function evaluate(client:SupabaseClient,access:Access,conversationId:string,runId:string,source:WorkingBrief,previous?:StoredBrief):Promise<WorkflowResult>{
  await workflowAccess(client,access);
  const env=await environment(client,access);
  validateWorkingBrief(source,env.concepts);
  const brief=previous&&!previous.produced_quote_id&&Number(previous.catalog_epoch)!==env.epoch?refreshAutomaticSelections(source):source;
  // A bound draft can NEVER become an unbound creation merely because it was
  // deleted, sent or edited. This check runs even while collecting choices.
  const quoteSnapshot=previous?await snapshot(client,access,previous,runId):null;
  const decision=resolveWorkingBrief(brief,env.catalog,env.concepts);
  const state:WorkflowState=decision.questions.length?'needs_choices':decision.issues.length?'collecting':'ready_to_review';
  const stored=await persist(access,conversationId,runId,decision.brief,env.epoch,state,previous);
  if(decision.questions.length||decision.issues.length){
    const card:WorkflowCard={kind:'draft_workflow',title:stored.produced_quote_id?'Revise this draft':'Finish this draft',workflowState:state,
      stateId:stored.id,revision:stored.revision,taskId:conversationId,summary:workingBriefSummary(decision.brief,env.concepts),issues:decision.issues,questions:decision.questions};
    await addCard(runId,access,`draft-workflow-${stored.id}-${stored.revision}`,WORKFLOW_SECTIONS,card);
    return {state:'awaiting_input',answer:decision.questions.length?'Choose the remaining options together below. Your job details and separate measurements are retained.':'Your brief is saved. Please provide the missing details listed below.',card};
  }
  const action=await proposeDraft(client,access,runId,workingProposalArgs(decision.brief,decision.catalog),{
    controllerVersion:1,briefStateId:stored.id,briefRevision:stored.revision,workflowEpoch:env.epoch,producedQuoteId:stored.produced_quote_id,
    identities:{areas:decision.brief.areas.map(a=>a.id),components:decision.brief.measurements.map(m=>({id:m.id,entries:m.entries.map(e=>e.id)}))},
    previousPlan:stored.committed_plan,quoteSnapshot,
  });
  const attached=await batchClient(createAdminClient()).rpc('sa_v2_workflow_attach',{p_user_id:access.userId,p_run_id:runId,p_state_id:stored.id,p_revision:stored.revision,p_action_id:action.id});
  if(attached.error)throw workflowRpcError(attached.error);
  await addCard(runId,access,`draft-proposal-${action.id}`,WORKFLOW_SECTIONS,{kind:'proposal',title:action.title,actionId:action.id});
  return {state:'proposal',answer:stored.produced_quote_id?'Review the changes to the same draft, then use Confirm. Nothing has been applied yet.':'Review the job and calculated quantities below, then use Confirm to create the draft.',actionId:action.id};
}
export async function prepareDraftWorkflow(client:SupabaseClient,access:Access,conversationId:string,runId:string,args:Record<string,unknown>){
  await workflowAccess(client,access);
  const [{data},config]=await Promise.all([creationContext(client,access),readWorkflowVocabulary(client,access.companyId)]);
  return evaluate(client,access,conversationId,runId,createWorkingBrief(args,data,config.concepts));
}
export async function reviseDraftWorkflow(client:SupabaseClient,access:Access,conversationId:string,runId:string,args:Record<string,unknown>){
  await workflowAccess(client,access);
  const state=await loadState(access,conversationId,String(args.state_id),Number(args.revision));
  const config=await readWorkflowVocabulary(client,access.companyId);
  return evaluate(client,access,conversationId,runId,applyWorkingDeltas(state.brief,args.deltas,config.concepts),state);
}
export async function applyDraftChoice(client:SupabaseClient,access:Access,conversationId:string,runId:string,choice:DraftChoiceWire):Promise<WorkflowResult>{
  await workflowAccess(client,access);
  const state=await loadState(access,conversationId,choice.stateId,choice.revision);
  if(choice.choice==='cancel'){
    const {error}=await batchClient(createAdminClient()).rpc('sa_v2_workflow_cancel',{p_user_id:access.userId,p_conversation_id:conversationId,p_run_id:runId,p_state_id:state.id,p_revision:state.revision,p_close:false});
    if(error)throw workflowRpcError(error);
    return {state:'cancelled',answer:state.produced_quote_id?'Draft preparation stopped. The existing draft was not deleted or changed.':'Draft preparation stopped. No draft was created.'};
  }
  const env=await environment(client,access);
  if(Number(state.catalog_epoch)!==env.epoch){
    const result=await evaluate(client,access,conversationId,runId,state.produced_quote_id?state.brief:refreshAutomaticSelections(state.brief),state);
    return {...result,answer:`Assistant settings changed, so the old choices were not applied. ${result.answer}`};
  }
  const decision=resolveWorkingBrief(state.brief,env.catalog,env.concepts),brief=decision.brief;
  if(!choice.selections||Array.isArray(choice.selections)||!Object.keys(choice.selections).length||Object.keys(choice.selections).length>25)
    throw new ProposalError('Choose at least one of the current product options. Selecting an option is not confirmation.');
  for(const [key,id] of Object.entries(choice.selections)){
    const question=decision.questions.find(q=>q.key===key);
    // Owner 2026-10-05 (pass 5): the plan/actual button answer (ids are the
    // literals 'plan'/'actual', not record identities) applies the blanket
    // basis to every area and measurement, then clears the pending flag.
    if(key==='basis'){
      if(!question||(id!=='plan'&&id!=='actual'))throw new ProposalError('Those options are not current for this working brief. Review the current choices again.');
      brief.areas=brief.areas.map(a=>({...a,basis:id==='plan'?'plan' as const:'surface' as const}));
      brief.measurements=brief.measurements.map(m=>({...m,basis:id as 'plan'|'actual'}));
      delete brief.basisPending;continue;
    }
    if(!question||!isUuid(id)||!question.options.some(o=>o.id===id))throw new ProposalError('Those options are not current for this working brief. Review the current choices again.');
    if(key==='collection'){brief.collectionId=id;brief.collectionName=question.options.find(o=>o.id===id)!.label;brief.selections={};brief.selectionSources={};}
    else{brief.selections[key]=id;brief.selectionSources[key]='explicit';}
  }
  return evaluate(client,access,conversationId,runId,brief,state);
}
export async function closeDraftWorkflow(client:SupabaseClient,access:Access,conversationId:string,runId:string){
  await workflowAccess(client,access);
  const {error}=await batchClient(createAdminClient()).rpc('sa_v2_workflow_cancel',{p_user_id:access.userId,p_conversation_id:conversationId,p_run_id:runId,p_state_id:null,p_revision:null,p_close:true});
  if(error)throw workflowRpcError(error);
}
export async function readWorkingMeasurements(client:SupabaseClient,access:Access,conversationId:string,args:Record<string,unknown>){
  await workflowAccess(client,access);
  const state=await loadState(access,conversationId,String(args.state_id),Number(args.revision));
  const m=state.brief.measurements.find(m=>m.id===args.measurement_id),offset=Number(args.offset??0);
  if(!m||!Number.isInteger(offset)||offset<0||offset>=m.entries.length)throw new ProposalError('Choose a current measured component and entry offset.');
  return {stateId:state.id,revision:state.revision,measurementId:m.id,entries:m.entries.slice(offset,offset+50),total:m.entries.length,nextOffset:offset+50<m.entries.length?offset+50:null};
}
export async function pendingDraftWorkflowContext(client:SupabaseClient,access:Access,conversationId:string,visibleRun?:(id:string|null)=>boolean){
  if(!access.phases.p4||WORKFLOW_SECTIONS.some(s=>access.permissions[s]!=='edit'))return null;
  await workflowAccess(client,access);
  const {data,error}=await admin().from('assistant_v2_draft_briefs').select(FIELDS).eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId)
    .not('workflow_state','in','(cancelled,closed)').order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw workflowRpcError(error);
  const state=data as StoredBrief|null;
  if(!state||visibleRun&&!visibleRun(state.last_run_id)&&!visibleRun(state.start_run_id)||access.historyAfter&&Date.parse(state.created_at)<Date.parse(access.historyAfter))return null;
  assertCurrent(state,access);
  const env=await environment(client,access),decision=resolveWorkingBrief(state.brief,env.catalog,env.concepts);
  return {stateId:state.id,revision:state.revision,workflowState:state.workflow_state,boundQuoteId:state.produced_quote_id,actionId:state.action_id,
    settingsChanged:Number(state.catalog_epoch)!==env.epoch,summary:workingBriefSummary(state.brief,env.concepts),
    brief:{...state.brief,measurements:state.brief.measurements.map(m=>({...m,entries:m.entries.slice(0,20),entryCount:m.entries.length,moreEntriesAvailable:m.entries.length>20}))},
    vocabulary:env.concepts,questions:decision.questions,issues:state.conflict_reason?[state.conflict_reason,...decision.issues]:decision.issues};
}

export async function readDraftTaskHint(client:SupabaseClient,access:Access,conversationId:string){
  if(!libraryWorkflowEnabled()||!access.phases.p4||WORKFLOW_SECTIONS.some(s=>access.permissions[s]!=='edit'))return null;
  await workflowAccess(client,access);
  const {data,error}=await admin().from('assistant_v2_draft_briefs').select(FIELDS).eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId)
    .not('workflow_state','in','(cancelled,closed)').order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw workflowRpcError(error);
  const state=data as StoredBrief|null;
  if(!state||state.brief?.version!==1||state.permission_revision!==access.permissionRevision||access.historyAfter&&Date.parse(state.created_at)<Date.parse(access.historyAfter))return null;
  return {startRunId:state.start_run_id,lastRunId:state.last_run_id,areaLabels:state.brief.areas.map(a=>a.label),state:state.workflow_state};
}
