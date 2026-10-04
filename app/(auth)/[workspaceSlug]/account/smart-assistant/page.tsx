import { PushSettings } from '@/app/components/pwa/PushSettings';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { SmartAssistantConfigPanel, type ConfigDoc } from './SmartAssistantConfigPanel';
import { AddToPhone } from './AddToPhone';
import { AssistantPermissionsPanel } from './AssistantPermissionsPanel';
import { readSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';
import { AssistantLibrarySettings } from './AssistantLibrarySettings';
import { readWorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings.server';
import type { WorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings-contracts';
import { getActiveDemoContext } from '@/app/lib/demo/context';
import { DemoFeatureGate } from '@/app/components/demo/DemoFeatureGate';

export const dynamic = 'force-dynamic';

/**
 * Smart Assistant config portal (dark launch). Flag-off companies get a 404 -
 * the page must not exist for them, matching route/API refusal.
 */
export default async function SmartAssistantConfigPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const profile = await requireCompanyContext();
  const { workspaceSlug } = await params;
  const demoContext = await getActiveDemoContext(profile.company_id);
  if (demoContext && demoContext.tutorialState.chapter !== 'smart-assistant' && demoContext.tutorialState.chapter !== 'complete') {
    return <DemoFeatureGate title="Try Smart Assistant" description="Smart Assistant is unlocked through the guided demo so its real actions stay inside the prepared scenario." chapter="smart-assistant" workspaceSlug={workspaceSlug} href={`/${workspaceSlug}/account/smart-assistant`} />;
  }
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

  let workflowSettings:WorkflowSettings|null=null;
  try { workflowSettings=await readWorkflowSettings(supabase,profile.company_id); } catch { /* Fail closed for this panel; never edit a partial catalogue. */ }

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

      <AssistantLibrarySettings initial={workflowSettings} />

      <PushSettings companyId={profile.company_id} />

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
