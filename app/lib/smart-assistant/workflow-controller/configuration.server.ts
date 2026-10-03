import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ProposalError } from '../v2/action-domain';
import { isUuid, type Access } from '../v2/contracts';
import type { LibraryCatalogItem } from '../library-workflow/contracts';
import { validateVocabulary, conceptSupportsMeasurement, type AssistantConcept } from './vocabulary';

// Additive tables have intentionally local contracts until integration regenerates
// database.types.ts. Every query retains the authenticated client and tenant filter.
const db=(client:SupabaseClient)=>client as any;
export async function readWorkflowEpoch(client:SupabaseClient,companyId:string):Promise<number>{
  const {data,error}=await db(client).from('assistant_v2_workflow_epochs').select('epoch').eq('company_id',companyId).maybeSingle();
  const epoch=Number(data?.epoch);
  if(error||!Number.isSafeInteger(epoch)||epoch<1)throw new ProposalError('Workflow Controller setup is not installed. Ask an administrator to apply the V1 migrations before enabling it.');
  return epoch;
}
export async function readWorkflowVocabulary(client:SupabaseClient,companyId:string):Promise<{epoch:number;concepts:AssistantConcept[]}>{
  const epoch=await readWorkflowEpoch(client,companyId);
  const {data,error}=await db(client).from('assistant_v2_concepts').select('key,display_name,aliases,behavior,builtin').eq('company_id',companyId).order('key').limit(21);
  if(error||!Array.isArray(data))throw new ProposalError('The workspace vocabulary could not be read.');
  const concepts:AssistantConcept[]=data.map((c:any)=>({key:c.key,displayName:c.display_name,aliases:c.aliases,behavior:c.behavior,builtin:c.builtin}));
  try{validateVocabulary(concepts);}catch{throw new ProposalError('The workspace vocabulary is incomplete or ambiguous. Review it in Assistant settings.');}
  if(await readWorkflowEpoch(client,companyId)!==epoch)throw new ProposalError('Assistant settings changed while being read. Please review again.');
  return {epoch,concepts};
}

/** Explicit eligibility/mapping only. Takeoff roles remain setup suggestions,
 * never silent authority. Pagination must complete before a sole-match decision. */
export async function readWorkflowCatalog(client:SupabaseClient,access:Access,concepts:readonly AssistantConcept[],collectionId?:string|null):Promise<LibraryCatalogItem[]>{
  let query=db(client).from('assistant_v2_library_profiles').select('collection_id,enabled,include_all').eq('company_id',access.companyId).eq('enabled',true).order('collection_id').limit(201);
  if(collectionId)query=query.eq('collection_id',collectionId);
  const {data:profiles,error}=await query;
  if(error||!Array.isArray(profiles)||profiles.length>200)throw new ProposalError('Assistant library setup could not be read completely. Review enabled libraries in settings.');
  const ids=profiles.map((p:any)=>p.collection_id);
  if(ids.some((id:unknown)=>!isUuid(id)))throw new ProposalError('An assistant library has an invalid identity.');
  if(!ids.length)return [];
  const {data:collections,error:collectionError}=await db(client).from('component_collections').select('id,name').eq('company_id',access.companyId).in('id',ids).order('id').limit(201);
  if(collectionError||collections?.length!==ids.length)throw new ProposalError('A configured library changed. Review assistant library access.');
  const readAll=async(table:'assistant_v2_library_members'|'component_library',fields:string)=>{
    const output:any[]=[];
    for(let offset=0;offset<=10000;offset+=500){
      let q=db(client).from(table).select(fields).eq('company_id',access.companyId).in('collection_id',ids).order('id').range(offset,offset+499);
      if(table==='component_library')q=q.eq('is_active',true);
      const {data,error:readError}=await q;
      if(readError||!Array.isArray(data))throw new ProposalError('The configured products could not be read completely.');
      output.push(...data);
      if(output.length>10000)throw new ProposalError('This assistant catalogue is too large for one workflow. Narrow the enabled library set in settings.');
      if(data.length<500)return output;
    }
    throw new ProposalError('The assistant catalogue could not be read completely.');
  };
  const [members,components]=await Promise.all([
    readAll('assistant_v2_library_members','id,collection_id,component_id,included,concept_key,is_default'),
    readAll('component_library','id,collection_id,name,measurement_type,takeoff_slot,is_active'),
  ]);
  const profilesById=new Map<string,any>(profiles.map((p:any)=>[p.collection_id,p]));
  const names=new Map<string,string>(collections.map((c:any)=>[c.id,c.name]));
  const assignments=new Map<string,any>(members.map(m=>[m.component_id,m]));
  const out:LibraryCatalogItem[]=[];
  for(const component of components){
    const profile=profilesById.get(component.collection_id),member=assignments.get(component.id);
    if(!profile||!(member ? member.included===true : profile.include_all===true))continue;
    const concept=concepts.find(c=>c.key===member?.concept_key);
    // Included but unmapped components do not become a guessed structural role.
    if(!concept||!conceptSupportsMeasurement(concept.behavior,String(component.measurement_type)))continue;
    out.push({id:component.id,collectionId:component.collection_id,collectionName:names.get(component.collection_id)!,name:component.name,
      role:concept.behavior,conceptKey:concept.key,isDefault:member.is_default===true,measurementType:component.measurement_type,
      takeoffSlot:component.takeoff_slot??null,unit:component.measurement_type==='area'?'m2':['count','quantity','fixed'].includes(component.measurement_type)?'each':'m',active:true});
  }
  return out;
}
