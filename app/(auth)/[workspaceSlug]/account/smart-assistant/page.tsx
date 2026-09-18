import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { SmartAssistantConfigPanel, type ConfigDoc } from './SmartAssistantConfigPanel';
import { AddToPhone } from './AddToPhone';

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

  const configDocs: ConfigDoc[] = (docs ?? []).map((d) => ({
    id: d.id,
    file_name: d.file_name,
    status: d.status,
    size_bytes: d.size_bytes,
    created_at: d.created_at,
  }));

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
