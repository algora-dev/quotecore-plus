'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireAssistantManager } from './actions';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { validateVocabulary, type AssistantConcept } from '@/app/lib/smart-assistant/workflow-controller/vocabulary';
type MemberInput={componentId:string;included:boolean;conceptKey:string|null;isDefault:boolean};
type Saved = {ok:true;epoch:number;message:string}|{ok:false;error:string};
function message(error:{code?:string;message?:string}):string {
  if(error.code==='40001')return 'Assistant settings changed in another session. Reload this page and review the current settings before saving.';
  if(error.code==='23503')return 'A removed concept is still mapped to products. Remove those mappings before deleting the concept.';
  if(error.code==='23505')return 'An alias or default is ambiguous. Use unique aliases and one default per concept.';
  if(error.code==='42501')return 'Your permission or workspace changed. Reload before saving.';
  return 'These settings could not be saved. Check concept compatibility, aliases and defaults, and confirm the Workflow Controller migrations are installed.';
}
function epochValid(epoch:number){return Number.isSafeInteger(epoch)&&epoch>0;}
export async function saveAssistantVocabulary(input:{epoch:number;concepts:AssistantConcept[]}):Promise<Saved>{
  const gate=await requireAssistantManager();if(!gate.ok)return gate;
  try{if(!epochValid(input.epoch))return {ok:false,error:'Reload the current assistant settings.'};validateVocabulary(input.concepts);}catch(error){return {ok:false,error:error instanceof Error?error.message:'Invalid vocabulary.'};}
  const {data,error}=await (createAdminClient() as any).rpc('sa_v2_save_assistant_vocabulary',{p_user_id:gate.userId,p_expected_epoch:input.epoch,p_concepts:input.concepts});
  if(error)return {ok:false,error:message(error)};
  revalidatePath('/[workspaceSlug]/account/smart-assistant','page');
  return {ok:true,epoch:Number(data),message:'Workspace vocabulary saved. Existing proposals will require a fresh review.'};
}
export async function saveAssistantLibrary(input:{epoch:number;collectionId:string;enabled:boolean;includeAll:boolean;members:MemberInput[]}):Promise<Saved>{
  const gate=await requireAssistantManager();if(!gate.ok)return gate;
  if(!epochValid(input.epoch)||!isUuid(input.collectionId)||typeof input.enabled!=='boolean'||typeof input.includeAll!=='boolean'||!Array.isArray(input.members)||input.members.length>500)return {ok:false,error:'Use a current library with at most 500 configured active products. No partial settings were saved.'};
  const ids=new Set<string>(),defaults=new Set<string>();
  for(const m of input.members){
    if(!m||!isUuid(m.componentId)||ids.has(m.componentId)||typeof m.included!=='boolean'||typeof m.isDefault!=='boolean'||m.conceptKey!==null&&(typeof m.conceptKey!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(m.conceptKey)))return {ok:false,error:'Invalid or duplicate component mapping. Nothing was saved.'};
    ids.add(m.componentId);
    if(m.isDefault){if(!m.included||!m.conceptKey||defaults.has(m.conceptKey))return {ok:false,error:'Choose one included default per concept.'};defaults.add(m.conceptKey);}
  }
  const {data,error}=await (createAdminClient() as any).rpc('sa_v2_save_assistant_library',{p_user_id:gate.userId,p_expected_epoch:input.epoch,p_collection_id:input.collectionId,p_enabled:input.enabled,p_include_all:input.includeAll,p_members:input.members});
  if(error)return {ok:false,error:message(error)};
  revalidatePath('/[workspaceSlug]/account/smart-assistant','page');
  return {ok:true,epoch:Number(data),message:'Assistant library saved atomically. Existing proposals will require a fresh review.'};
}
