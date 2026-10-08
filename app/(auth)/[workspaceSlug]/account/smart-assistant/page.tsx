import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { SmartAssistantConfigPanel, type ConfigDoc } from './SmartAssistantConfigPanel';
import { AddToPhone } from './AddToPhone';
import { AssistantPermissionsPanel } from './AssistantPermissionsPanel';
import { readSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';
import { AssistantLibrarySettings } from './AssistantLibrarySettings';
import { ASSISTANT_LIBRARY_ROLES, type AssistantLibraryRole } from '@/app/lib/smart-assistant/library-workflow/contracts';

export const dynamic = 'force-dynamic';

/**
 * Smart Assistant config portal (dark launch). Flag-off companies get a 404 -
 * the page must not exist for them, matching route/API refusal.
 */
export default async function SmartAssistantConfigPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Exposure gate: refuse before reading anything.
  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });
  if (!flagOn) notFound();

  const [{ data: config }, { data: docs }] = await Promise.all([
    supabase
      .from('assistant_configs')
      .select('name, greeting, custom_rules, enabled, members_can_manage')
      .eq('company_id', profile.company_id)
      .maybeSingle(),
    supabase
      .from('assistant_knowledge_docs')
      .select('id, file_name, status, size_bytes, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Failure/missing migration affects the new panel only, never V1 config.
  const permissionState = await readSectionPermissions(supabase);

  const configDocs: ConfigDoc[] = (docs ?? []).map((d) => ({
    id: d.id,
    file_name: d.file_name,
    status: d.status,
    size_bytes: d.size_bytes,
    created_at: d.created_at,
  }));

  let assistantLibraries: Array<{id:string;name:string;enabled:boolean;includeAll:boolean;components:Array<{id:string;name:string;takeoffSlot:string|null;included:boolean;role:AssistantLibraryRole|null;isDefault:boolean}>}> = [];
  let libraryWorkflowAvailable = true;
  try {
    const db = supabase as any;
    const [{ data: collections, error: collectionError }, { data: profiles, error: profileError }, { data: members, error: memberError }] = await Promise.all([
      db.from('component_collections').select('id,name').eq('company_id', profile.company_id).order('name'),
      db.from('assistant_v2_library_profiles').select('collection_id,enabled,include_all').eq('company_id', profile.company_id),
      db.from('assistant_v2_library_members').select('collection_id,component_id,included,assistant_role,is_default').eq('company_id', profile.company_id),
    ]);
    if (collectionError || profileError || memberError) throw new Error('library workflow unavailable');
    const ids = (collections ?? []).map((c:any)=>c.id);
    const { data: components, error: componentError } = ids.length ? await db.from('component_library').select('id,collection_id,name,takeoff_slot,is_active').eq('company_id',profile.company_id).in('collection_id',ids).eq('is_active',true).order('sort_order') : {data:[],error:null};
    if (componentError) throw new Error('component library unavailable');
    const pMap=new Map((profiles??[]).map((x:any)=>[x.collection_id,x]));
    const mMap=new Map((members??[]).map((x:any)=>[x.component_id,x]));
    assistantLibraries=(collections??[]).map((c:any)=>{const profileRow:any=pMap.get(c.id);return {id:c.id,name:c.name,enabled:profileRow?.enabled===true,includeAll:profileRow?.include_all===true,components:(components??[]).filter((x:any)=>x.collection_id===c.id).map((x:any)=>{const m:any=mMap.get(x.id);const suggested=ASSISTANT_LIBRARY_ROLES.includes(x.takeoff_slot as any)?x.takeoff_slot:null;return {id:x.id,name:x.name,takeoffSlot:suggested,included:m?.included===true,role:(m?.assistant_role??suggested) as AssistantLibraryRole|null,isDefault:m?.is_default===true};})};});
  } catch { libraryWorkflowAvailable=false; }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Smart Assistant</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure your workspace assistant: identity, behaviour rules and
              searchable knowledge documents.
            </p>
          </div>
          <AddToPhone />
        </div>
      </div>

      <AssistantPermissionsPanel key={profile.company_id} initialState={permissionState} />

      <AssistantLibrarySettings libraries={assistantLibraries} available={libraryWorkflowAvailable} />

      <SmartAssistantConfigPanel
        initialName={config?.name ?? 'Assistant'}
        initialGreeting={config?.greeting ?? ''}
        initialRules={Array.isArray(config?.custom_rules) ? (config!.custom_rules as string[]) : []}
        initialEnabled={config?.enabled ?? false}
        initialMembersCanManage={config?.members_can_manage ?? false}
        docs={configDocs}
      />
    </div>
  );
}
