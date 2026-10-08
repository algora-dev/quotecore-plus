'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { requireAssistantManager } from './actions';
import { ASSISTANT_LIBRARY_ROLES, type AssistantLibraryRole } from '@/app/lib/smart-assistant/library-workflow/contracts';

type MemberInput={componentId:string;included:boolean;role:AssistantLibraryRole|null;isDefault:boolean};
export async function saveAssistantLibrary(input:{collectionId:string;enabled:boolean;includeAll:boolean;members:MemberInput[]}){
 const gate=await requireAssistantManager();if(!gate.ok)return gate;
 if(!/^[0-9a-f-]{36}$/i.test(input.collectionId))return {ok:false as const,error:'Invalid library.'};
 const supabase=await createSupabaseServerClient();
 const {data:collection}=await supabase.from('component_collections').select('id').eq('id',input.collectionId).eq('company_id',gate.companyId).maybeSingle();
 if(!collection)return {ok:false as const,error:'Library not found in this workspace.'};
 const ids=[...new Set(input.members.map(m=>m.componentId))];
 const {data:components}=ids.length?await supabase.from('component_library').select('id').eq('company_id',gate.companyId).eq('collection_id',input.collectionId).in('id',ids):{data:[] as {id:string}[]};
 const allowed=new Set((components??[]).map(c=>c.id));
 const clean=input.members.filter(m=>allowed.has(m.componentId)&&(!m.role||ASSISTANT_LIBRARY_ROLES.includes(m.role))).slice(0,500);
 const defaults=new Set<string>();
 for(const m of clean){if(m.isDefault&&m.role){if(defaults.has(m.role))return {ok:false as const,error:`Choose only one default for ${m.role.replace('_',' ')}.`};defaults.add(m.role);}}
 const admin=createAdminClient() as any;
 const {error:pErr}=await admin.from('assistant_v2_library_profiles').upsert({company_id:gate.companyId,collection_id:input.collectionId,enabled:!!input.enabled,include_all:!!input.includeAll,updated_by:gate.userId,updated_at:new Date().toISOString()},{onConflict:'company_id,collection_id'});
 if(pErr)return {ok:false as const,error:pErr.message};
 const {error:delErr}=await admin.from('assistant_v2_library_members').delete().eq('company_id',gate.companyId).eq('collection_id',input.collectionId);
 if(delErr)return {ok:false as const,error:delErr.message};
 if(clean.length){const {error:mErr}=await admin.from('assistant_v2_library_members').insert(clean.map(m=>({company_id:gate.companyId,collection_id:input.collectionId,component_id:m.componentId,included:m.included,assistant_role:m.role,is_default:m.isDefault&&!!m.role,updated_by:gate.userId})));if(mErr)return {ok:false as const,error:mErr.message};}
 revalidatePath('/account/smart-assistant','page');
 return {ok:true as const,message:'Smart Assistant library access saved.'};
}
