import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { SmartAssistantConfigPanel } from './SmartAssistantConfigPanel';
import { AddToPhone } from './AddToPhone';
import { AssistantPermissionsPanel } from './AssistantPermissionsPanel';
import { readSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';
import { AssistantLibrarySettings } from './AssistantLibrarySettings';
import { readWorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings.server';
import type { WorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings-contracts';
import { getActiveDemoContext } from '@/app/lib/demo/context';
import { DemoFeatureGate } from '@/app/components/demo/DemoFeatureGate';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

type Usage = { used: number | null; limit: number | null; periodEnd: string | null };

async function readAssistantUsage(companyId: string): Promise<Usage> {
  try {
    const entitlements = await loadCompanyEntitlements(companyId);
    if (entitlements.assistantTasksLimit != null) return {
      used: entitlements.assistantTasksUsed ?? 0,
      limit: entitlements.assistantTasksLimit,
      periodEnd: entitlements.usagePeriodEnd,
    };
  } catch { /* legacy/fallback below */ }
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await (supabase as any).rpc('sa_check_turn_quota', { p_company_id: companyId });
    const row = Array.isArray(data) ? data[0] : data;
    const used = Number(row?.used), limit = Number(row?.cap);
    if (Number.isFinite(used) && Number.isFinite(limit)) return { used, limit, periodEnd: null };
  } catch { /* usage display is non-blocking */ }
  return { used: null, limit: null, periodEnd: null };
}

function UsageCard({ usage }: { usage: Usage }) {
  const known = usage.used != null && usage.limit != null;
  const percentage = known && usage.limit! > 0 ? Math.min(100, Math.round((usage.used! / usage.limit!) * 100)) : 0;
  const remaining = known ? Math.max(0, usage.limit! - usage.used!) : null;
  const renews = usage.periodEnd ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(usage.periodEnd)) : null;
  return <section className="rounded-2xl border border-white/10 bg-[#0D1014] p-5 text-[#FBFCFF] shadow-sm" aria-labelledby="assistant-usage-heading">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF9A5C]">Usage</p>
    <div className="mt-1 flex items-end justify-between gap-4"><div><h2 id="assistant-usage-heading" className="text-lg font-semibold text-[#FBFCFF]">Smart Assistant tasks</h2><p className="mt-1 text-sm text-[#B9C0CC]">Your current plan allowance.</p></div>{known && <strong className="text-2xl font-semibold text-[#FBFCFF]">{usage.used} <span className="text-sm font-medium text-[#B9C0CC]">/ {usage.limit}</span></strong>}</div>
    {known ? <><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#252B34]"><div className="h-full rounded-full bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B]" style={{ width: `${percentage}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-xs text-[#B9C0CC]"><span>{remaining} remaining</span><span>{renews ? `Renews ${renews}` : 'Current billing period'}</span></div></> : <p className="mt-4 rounded-xl border border-white/10 bg-[#171C23] p-3 text-sm text-[#E7EAF1]">Task usage is managed by your plan. Current totals could not be loaded on this request.</p>}
  </section>;
}

export default async function SmartAssistantConfigPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const profile = await requireCompanyContext();
  const { workspaceSlug } = await params;
  const demoContext = await getActiveDemoContext(profile.company_id);
  if (demoContext && demoContext.tutorialState.chapter !== 'smart-assistant' && demoContext.tutorialState.chapter !== 'complete') {
    return <DemoFeatureGate title="Try Smart Assistant" description="Smart Assistant is unlocked through the guided demo so its real actions stay inside the prepared scenario." chapter="smart-assistant" workspaceSlug={workspaceSlug} href={`/${workspaceSlug}/account/smart-assistant`} />;
  }
  const supabase = await createSupabaseServerClient();
  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', { p_company_id: profile.company_id });
  if (!flagOn) notFound();

  const [{ data: config }, permissionState, usage] = await Promise.all([
    supabase.from('assistant_configs').select('name, greeting, enabled, members_can_manage').eq('company_id', profile.company_id).maybeSingle(),
    readSectionPermissions(supabase),
    readAssistantUsage(profile.company_id),
  ]);

  let workflowSettings: WorkflowSettings | null = null;
  try { workflowSettings = await readWorkflowSettings(supabase, profile.company_id); } catch { /* panel fails closed */ }

  return <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0D1014] p-5 text-[#FBFCFF] shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
      <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF9A5C]">Workspace setup</p><h1 className="mt-1 text-2xl font-semibold text-[#FBFCFF]">Smart Assistant</h1><p className="mt-1 text-sm leading-6 text-[#B9C0CC]">Choose how your Assistant sounds, what it can access, and the short names that make your libraries and Smart Components faster to find.</p></div>
      <div className="flex flex-wrap gap-2"><AddToPhone /><Link href={`/${workspaceSlug}/assistant`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B] px-4 py-2.5 text-sm font-semibold text-[#191B20] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A5C]">Open Smart Assistant</Link></div>
    </header>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.7fr)]">
      <SmartAssistantConfigPanel initialName={config?.name ?? 'Assistant'} initialGreeting={config?.greeting ?? ''} initialEnabled={config?.enabled ?? false} initialMembersCanManage={config?.members_can_manage ?? false} />
      <UsageCard usage={usage} />
    </div>

    <AssistantPermissionsPanel key={profile.company_id} initialState={permissionState} />
    <AssistantLibrarySettings initial={workflowSettings} />
  </div>;
}
