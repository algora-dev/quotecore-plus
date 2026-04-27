import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { WorkspaceNav } from '@/app/components/workspace/WorkspaceNav';
import { AlertBell } from '@/app/components/alerts/AlertBell';
import { CopilotProvider } from '@/app/components/copilot/CopilotProvider';
import { CopilotToggle } from '@/app/components/copilot/CopilotToggle';
import { CopilotOverlay } from '@/app/components/copilot/CopilotOverlay';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { company } = await loadCompanyContext();
  const slug = company.slug;

  if (slug !== workspaceSlug) {
    redirect(`/${slug}`);
  }

  const workspaceLabel = company.name ? company.name.slice(0, 10) : 'Workspace';
  const profile = await getCurrentProfile();

  const supabase = await createSupabaseServerClient();

  // Load copilot progress
  const { data: copilotData } = await supabase
    .from('copilot_progress')
    .select('copilot_enabled, copilot_visible, guides_completed, current_guide, current_step')
    .eq('user_id', profile.id)
    .single();

  const copilotState = copilotData ? {
    enabled: copilotData.copilot_enabled ?? true,
    visible: (copilotData as any).copilot_visible ?? true,
    activeGuide: copilotData.current_guide,
    currentStep: copilotData.current_step ?? 0,
    guidesCompleted: copilotData.guides_completed ?? [],
  } : null;

  // Load alerts for bell
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, alert_type, title, message, is_read, created_at, quote_id')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  const unreadCount = (alerts || []).filter(a => !a.is_read).length;

  return (
    <CopilotProvider userId={profile.id} initialState={copilotState}>
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href={`/${slug}`} prefetch={false} className="flex items-center">
              <img src="/logo.png" alt="QuoteCore" className="h-9" />
            </Link>
            <div className="flex items-center gap-3">
              <CopilotToggle />
              <AlertBell
                initialAlerts={alerts || []}
                initialUnreadCount={unreadCount}
                workspaceSlug={slug}
              />
              <Link
                href={`/${slug}/settings`}
                prefetch={false}
                className="inline-flex items-center rounded-full border-2 border-transparent bg-white px-3 py-1 text-sm font-semibold text-slate-600 pill-shimmer"
              >
                Account
              </Link>
              <LogoutButton />
            </div>
          </div>

          <WorkspaceNav workspaceSlug={slug} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
      <CopilotOverlay />
    </div>
    </CopilotProvider>
  );
}
