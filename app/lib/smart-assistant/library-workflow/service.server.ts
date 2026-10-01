import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { boundedText, isUuid, type Access } from '../v2/contracts';
import { ProposalError } from '../v2/action-domain';
import { addCard } from '../v2/session.server';
import { creationContext, proposeDraft } from '../v2/creation.server';
import { ASSISTANT_LIBRARY_ROLES, ROLE_PITCH_TYPE, type AssistantLibraryRole, type DraftBrief, type DraftChoiceWire, type LibraryCatalogItem, type WorkflowCard, type WorkflowQuestion, type WorkflowResult, WORKFLOW_SECTIONS } from './contracts';

const q=(client:SupabaseClient)=>client as any;
const admin=()=>createAdminClient() as any;
const roleSet=new Set<string>(ASSISTANT_LIBRARY_ROLES);

function unitFor(measurement:string){return ['area'].includes(measurement)?'m2':['count','quantity','fixed'].includes(measurement)?'each':'m';}

export async function readAssistantLibraryCatalog(client:SupabaseClient, access:Access, collectionId?:string|null):Promise<LibraryCatalogItem[]>{
  let profilesQuery=q(client).from('assistant_v2_library_profiles').select('collection_id,enabled,include_all').eq('company_id',access.companyId).eq('enabled',true);
  if(collectionId)profilesQuery=profilesQuery.eq('collection_id',collectionId);
  const {data:profiles,error:pErr}=await profilesQuery;
  if(pErr)throw new ProposalError('Smart Assistant library setup is unavailable. Ask an admin to review Assistant library access.');
  const ids=(profiles??[]).map((p:any)=>p.collection_id).filter(isUuid);
  if(!ids.length)return [];
  const [{data:collections,error:cErr},{data:members,error:mErr},{data:components,error:compErr}]=await Promise.all([
    q(client).from('component_collections').select('id,name').eq('company_id',access.companyId).in('id',ids),
    q(client).from('assistant_v2_library_members').select('collection_id,component_id,included,assistant_role,is_default').eq('company_id',access.companyId).in('collection_id',ids),
    q(client).from('component_library').select('id,collection_id,name,measurement_type,takeoff_slot,is_takeoff_default,is_active').eq('company_id',access.companyId).in('collection_id',ids).eq('is_active',true).order('sort_order',{ascending:true}),
  ]);
  if(cErr||mErr||compErr)throw new ProposalError('Smart Assistant could not read the configured component libraries.');
  const pMap=new Map<string,any>((profiles??[]).map((p:any)=>[p.collection_id,p]));
  const cMap=new Map<string,string>((collections??[]).map((c:any)=>[c.id,String(c.name)]));
  const mMap=new Map<string,any>((members??[]).map((m:any)=>[m.component_id,m]));
  const out:LibraryCatalogItem[]=[];
  for(const comp of components??[]){
    const profile=pMap.get(comp.collection_id); if(!profile)continue;
    const member=mMap.get(comp.id);
    const included=profile.include_all===true||member?.included===true;
    if(!included)continue;
    const roleRaw=member?.assistant_role??(roleSet.has(String(comp.takeoff_slot))?comp.takeoff_slot:null);
    const role=roleSet.has(String(roleRaw))?roleRaw as AssistantLibraryRole:null;
    out.push({id:comp.id,collectionId:comp.collection_id,collectionName:String(cMap.get(comp.collection_id)??'Library'),name:String(comp.name),role,isDefault:member?.is_default===true,measurementType:String(comp.measurement_type),takeoffSlot:comp.takeoff_slot??null,unit:unitFor(String(comp.measurement_type)),active:comp.is_active===true});
  }
  return out;
}

function cleanBrief(input:Record<string,unknown>,context:Record<string,unknown>):DraftBrief{
  const customerName=boundedText(input.customer_name,200),jobName=boundedText(input.job_name,200);
  if(!customerName||!jobName)throw new ProposalError('Tell me the customer and job name.');
  const address=input.site_address==null?null:boundedText(input.site_address,500); if(input.site_address!=null&&!address)throw new ProposalError('The site address is not valid.');
  const contextSystem=String(context.measurement_system??'metric');
  const measurementSystem=['metric','imperial_ft','imperial_rs'].includes(String(input.measurement_system))?String(input.measurement_system) as DraftBrief['measurementSystem']:(['metric','imperial_ft','imperial_rs'].includes(contextSystem)?contextSystem as DraftBrief['measurementSystem']:'metric');
  const pitch=Number(input.pitch_degrees??0); if(!Number.isFinite(pitch)||pitch<0||pitch>89)throw new ProposalError('Pitch must be between 0 and 89 degrees.');
  const areasRaw=Array.isArray(input.areas)?input.areas:[]; if(areasRaw.length>12)throw new ProposalError('This draft has too many areas for one assistant task.');
  const areas=areasRaw.map((v:any)=>{const label=boundedText(v?.label,120);const quantity=Number(v?.quantity);const unit=String(v?.unit??'m2');const basis=String(v?.basis??'plan');const p=v?.pitch_degrees==null?null:Number(v.pitch_degrees);if(!label||!Number.isFinite(quantity)||quantity<=0||!['m2','ft2','rs'].includes(unit)||!['plan','surface'].includes(basis)||p!=null&&(!Number.isFinite(p)||p<0||p>89))throw new ProposalError('Each area needs a valid label, size, unit, basis and optional pitch.');return {label,quantity,unit:unit as 'm2'|'ft2'|'rs',basis:basis as 'plan'|'surface',pitchDegrees:p};});
  const msRaw=Array.isArray(input.measurements)?input.measurements:[]; if(msRaw.length>40)throw new ProposalError('This draft has too many component measurement groups for one assistant task.');
  const measurements=msRaw.map((v:any)=>{const role=String(v?.role);if(!roleSet.has(role))throw new ProposalError(`Unsupported measurement role: ${role}.`);const entries=(Array.isArray(v?.entries)?v.entries:[]).map((e:any)=>{const quantity=Number(e?.quantity),unit=String(e?.unit??(role==='roof_area'?'m2':'m'));if(!Number.isFinite(quantity)||quantity<=0)throw new ProposalError(`Invalid ${role} measurement.`);return {quantity,unit};});if(!entries.length)throw new ProposalError(`${role} needs at least one measurement.`);const basis=String(v?.basis??(role==='roof_area'?'plan':'plan'));const areaIndex=v?.area_index==null?null:Number(v.area_index);if(!['plan','actual'].includes(basis)||areaIndex!=null&&(!Number.isInteger(areaIndex)||areaIndex<0||areaIndex>=areas.length))throw new ProposalError(`Invalid ${role} measurement context.`);return {role:role as AssistantLibraryRole,entries,basis:basis as 'plan'|'actual',areaIndex};});
  return {customerName,jobName,siteAddress:address,measurementSystem,defaultPitchDegrees:pitch,trade:String(input.trade??'roofing'),collectionId:isUuid(input.collection_id)?String(input.collection_id):null,collectionName:boundedText(input.collection_name,200),areas,measurements,selections:{}};
}

async function persist(access:Access,conversationId:string,brief:DraftBrief,stateId?:string,expectedRevision?:number){
  const db=admin();
  if(stateId){
    const {data,error}=await db.from('assistant_v2_draft_briefs').update({brief,revision:(expectedRevision??0)+1,updated_at:new Date().toISOString()}).eq('id',stateId).eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId).eq('revision',expectedRevision).select('id,revision').maybeSingle();
    if(error||!data)throw new ProposalError('Those draft choices changed or expired. Please review the current draft again.');return {id:data.id,revision:data.revision};
  }
  const {data,error}=await db.from('assistant_v2_draft_briefs').upsert({company_id:access.companyId,user_id:access.userId,conversation_id:conversationId,brief,revision:1,status:'open',permission_revision:access.permissionRevision,updated_at:new Date().toISOString()},{onConflict:'company_id,user_id,conversation_id'}).select('id,revision').single();
  if(error||!data)throw new ProposalError('Could not save the working draft.');return {id:data.id,revision:data.revision};
}

async function loadState(access:Access,conversationId:string,stateId:string,revision:number){
  const {data,error}=await admin().from('assistant_v2_draft_briefs').select('id,revision,brief,status,permission_revision').eq('id',stateId).eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId).maybeSingle();
  if(error||!data||data.status!=='open'||data.revision!==revision||data.permission_revision!==access.permissionRevision)throw new ProposalError('Those draft choices are no longer current. Ask me to review the draft again.');
  return data as {id:string;revision:number;brief:DraftBrief;status:string;permission_revision:number};
}

function summary(brief:DraftBrief){
  const lines=[`${brief.customerName} — ${brief.jobName}`];if(brief.siteAddress)lines.push(brief.siteAddress);
  for(const a of brief.areas)lines.push(`${a.label}: ${a.quantity} ${a.unit}, ${a.basis}${a.pitchDegrees!=null?`, ${a.pitchDegrees}°`:''}`);
  for(const m of brief.measurements)lines.push(`${m.role.replace('_',' ')}: ${m.entries.map(e=>`${e.quantity} ${e.unit}`).join(' + ')}`);
  return lines;
}

function chooseCatalog(brief:DraftBrief,catalog:LibraryCatalogItem[]){
  const collectionCandidates=[...new Map(catalog.map(c=>[c.collectionId,c.collectionName])).entries()];
  if(!brief.collectionId){
    if(collectionCandidates.length===1){brief.collectionId=collectionCandidates[0][0];brief.collectionName=collectionCandidates[0][1];}
  }
  const filtered=brief.collectionId?catalog.filter(c=>c.collectionId===brief.collectionId):catalog;
  const questions:WorkflowQuestion[]=[];const issues:string[]=[];
  if(!brief.collectionId){
    if(collectionCandidates.length>1)questions.push({key:'collection',label:'Which Smart Assistant library should I use?',role:'roof_area',options:collectionCandidates.slice(0,5).map(([id,name])=>({id,label:name,detail:'Assistant-enabled component library'}))});
    else issues.push('No Smart Assistant component library is enabled.');
  }
  const roles=[...new Set(brief.measurements.map(m=>m.role))];
  for(const role of roles){
    const key=`role:${role}`; if(brief.selections[key])continue;
    const candidates=filtered.filter(c=>c.role===role);
    const defaults=candidates.filter(c=>c.isDefault);
    if(defaults.length===1){brief.selections[key]=defaults[0].id;continue;}
    if(candidates.length===1){brief.selections[key]=candidates[0].id;continue;}
    if(candidates.length===0){issues.push(`No assistant-enabled ${role.replace('_',' ')} component is assigned in ${brief.collectionName??'the selected library'}.`);continue;}
    questions.push({key,label:`Which ${role.replace('_',' ')} component should I use?`,role,options:candidates.slice(0,5).map(c=>({id:c.id,label:c.name,detail:`${c.collectionName} · ${c.measurementType}`}))});
  }
  return {questions,issues,catalog:filtered};
}

function proposalArgs(brief:DraftBrief,catalog:LibraryCatalogItem[]){
  if(!brief.collectionId)throw new ProposalError('Choose a component library first.');
  const components=brief.measurements.map(m=>{const id=brief.selections[`role:${m.role}`];const item=catalog.find(c=>c.id===id&&c.collectionId===brief.collectionId);if(!item)throw new ProposalError(`Choose a current ${m.role.replace('_',' ')} component.`);return {library_id:id,basis:m.basis,area_index:m.areaIndex,entries:m.entries,
    // Blanket pitch rule (owner 2026-10-01): PLAN-basis measurements carry
    // their role's pitch factor explicitly so library-level
    // default_pitch_type cannot silently drop pitch from a role.
    pitch_type:m.basis==='plan'?ROLE_PITCH_TYPE[m.role]:'none',
    source:{role:m.role}};});
  return {customer_name:brief.customerName,job_name:brief.jobName,site_address:brief.siteAddress,measurement_system:brief.measurementSystem,pitch_degrees:brief.defaultPitchDegrees,trade:brief.trade,collection_id:brief.collectionId,areas:brief.areas.map(a=>({label:a.label,quantity:a.quantity,unit:a.unit,basis:a.basis,pitch_degrees:a.pitchDegrees})),components};
}

async function evaluate(client:SupabaseClient,access:Access,conversationId:string,runId:string,brief:DraftBrief,stateId?:string,expectedRevision?:number):Promise<WorkflowResult>{
  const catalog=await readAssistantLibraryCatalog(client,access,brief.collectionId);
  if(!catalog.length){const all=await readAssistantLibraryCatalog(client,access,null);if(!all.length)return {state:'blocked',answer:'No component library is enabled for Smart Assistant yet. Ask a workspace admin to enable a library and assign component roles first.'};catalog.push(...all);}
  const decision=chooseCatalog(brief,catalog);
  if(decision.questions.length||decision.issues.length){
    const stored=await persist(access,conversationId,brief,stateId,expectedRevision);
    const card:WorkflowCard={kind:'draft_workflow',title:'Finish this draft',stateId:stored.id,revision:stored.revision,taskId:conversationId,summary:summary(brief),issues:decision.issues,questions:decision.questions};
    await addCard(runId,access,`draft-workflow-${stored.id}-${stored.revision}`,WORKFLOW_SECTIONS,card as any);
    return {state:'awaiting_input',answer:decision.questions.length?'I kept the job and measurements. Choose the remaining product options below.':'I kept the job and measurements, but the selected library is missing an assistant component assignment.',card};
  }
  const stored=await persist(access,conversationId,brief,stateId,expectedRevision);
  const action=await proposeDraft(client,access,runId,proposalArgs(brief,decision.catalog));
  await addCard(runId,access,`draft-proposal-${action.id}`,WORKFLOW_SECTIONS,{kind:'proposal',title:action.title,actionId:action.id});
  // Sticky task: the proposed brief stays queryable as the conversation's
  // active task so correction turns can revise it instead of asking which
  // record to update.
  await admin().from('assistant_v2_draft_briefs').update({status:'proposal',updated_at:new Date().toISOString()}).eq('id',stored.id).eq('company_id',access.companyId).eq('user_id',access.userId);
  return {state:'proposal',answer:'I have enough information. Review the complete draft proposal below. It is not created until you press Confirm these changes.',actionId:action.id};
}

export async function prepareDraftWorkflow(client:SupabaseClient,access:Access,conversationId:string,runId:string,args:Record<string,unknown>){const {data}=await creationContext(client,access);return evaluate(client,access,conversationId,runId,cleanBrief(args,data));}

export async function applyDraftChoice(client:SupabaseClient,access:Access,conversationId:string,runId:string,choice:DraftChoiceWire):Promise<WorkflowResult>{
  const state=await loadState(access,conversationId,choice.stateId,choice.revision);const brief=structuredClone(state.brief);
  if(choice.choice==='cancel'){await admin().from('assistant_v2_draft_briefs').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',state.id);return {state:'cancelled',answer:'Draft preparation cancelled. Nothing was created.'};}
  const catalog=await readAssistantLibraryCatalog(client,access,null);
  for(const [key,id] of Object.entries(choice.selections)){
    if(key==='collection'){const name=catalog.find(c=>c.collectionId===id)?.collectionName;if(!name)throw new ProposalError('That library is no longer available to Smart Assistant.');brief.collectionId=id;brief.collectionName=name;brief.selections={};continue;}
    if(!key.startsWith('role:')||!isUuid(id))continue;
    const role=key.slice(5);const item=catalog.find(c=>c.id===id&&c.role===role&&(!brief.collectionId||c.collectionId===brief.collectionId));if(!item)throw new ProposalError('That component is no longer available for this draft.');brief.selections[key]=id;
  }
  return evaluate(client,access,conversationId,runId,brief,state.id,state.revision);
}

export async function pendingDraftWorkflowContext(client:SupabaseClient,access:Access,conversationId:string){
  // Sticky task (owner 2026-10-01): a draft awaiting choices (open) OR one
  // proposed within the last 30 minutes stays the conversation's active
  // task, so correction turns continue it instead of starting over.
  const {data,error}=await admin().from('assistant_v2_draft_briefs').select('id,revision,brief,status,permission_revision,updated_at').eq('company_id',access.companyId).eq('user_id',access.userId).eq('conversation_id',conversationId).in('status',['open','proposal']).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(error||!data||data.permission_revision!==access.permissionRevision)return null;
  if(Date.parse(String(data.updated_at))<Date.now()-30*60*1000)return null;
  const brief=data.brief as DraftBrief;
  const catalog=await readAssistantLibraryCatalog(client,access,null).catch(()=>[]);
  const decision=chooseCatalog(brief,catalog);
  return {stateId:data.id,revision:data.revision,status:data.status,summary:summary(brief),brief:{customerName:brief.customerName,jobName:brief.jobName,siteAddress:brief.siteAddress,measurementSystem:brief.measurementSystem,defaultPitchDegrees:brief.defaultPitchDegrees,trade:brief.trade,collectionId:brief.collectionId,collectionName:brief.collectionName,areas:brief.areas,measurements:brief.measurements,selections:brief.selections},questions:decision.questions.map(q=>({key:q.key,label:q.label,options:q.options.map(o=>({id:o.id,label:o.label}))})),issues:decision.issues};
}
