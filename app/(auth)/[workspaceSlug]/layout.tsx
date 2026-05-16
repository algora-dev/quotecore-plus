import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { WorkspaceNav } from '@/app/components/workspace/WorkspaceNav';
import { AlertBell } from '@/app/components/alerts/AlertBell';
import { CopilotProvider } from '@/app/components/copilot/CopilotProvider';
import { CopilotToggle } from '@/app/components/copilot/CopilotToggle';
import { CopilotOverlay } from '@/app/components/copilot/CopilotOverlay';
import { HelpDrawerTrigger, HelpDrawerPanel } from '@/app/components/docs/HelpDrawer';
import { HelpDrawerProvider } from '@/app/components/docs/HelpDrawerContext';
import { HelpDrawerLayout } from '@/app/components/docs/HelpDrawerLayout';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { EntitlementBanner } from '@/app/components/billing/EntitlementBanner';

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

  // Single source of truth for feature gating in this workspace shell. The
  // entitlements snapshot is cached per request via React `cache()`, so
  // downstream callers can re-call loadCompanyEntitlements without a
  // second DB round-trip.
  const entitlements = await loadCompanyEntitlements(company.id);

  const _workspaceLabel = company.name ? company.name.slice(0, 10) : 'Workspace';
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
    <CopilotProvider userId={profile.id} companyId={company.id} initialState={copilotState}>
      <HelpDrawerProvider>
        {/*
          The help drawer panel mounts at the viewport's left edge. It's
          rendered as a sibling of the app shell so it can occupy a column
          on screen while the rest of the workspace shifts right via
          <HelpDrawerLayout>'s margin-left offset. The trigger button
          inside the header simply opens the drawer; both pieces share
          state through HelpDrawerProvider.
        */}
        <HelpDrawerPanel />
        <HelpDrawerLayout>
          <div className="min-h-screen">
            <header className="border-b border-slate-200 bg-white shadow-sm">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
                <div className="flex items-center justify-between">
                  <Link href={`/${slug}`} prefetch={false} className="flex items-center">
                    <img src="/logo.png" alt="QuoteCore" className="h-9" />
                  </Link>
                  <div className="flex items-center gap-3">
                    <HelpDrawerTrigger />
                    <CopilotToggle />
                    <AlertBell
                      initialAlerts={alerts || []}
                      initialUnreadCount={unreadCount}
                      workspaceSlug={slug}
                    />
                    <Link
                      href={`/${slug}/account`}
                      prefetch={false}
                      className="inline-flex items-center rounded-full border-2 border-transparent bg-white px-3 py-1 text-sm font-semibold text-slate-600 pill-shimmer"
                    >
                      Account
                    </Link>
                    <LogoutButton />
                  </div>
                </div>

                <WorkspaceNav workspaceSlug={slug} entitlements={entitlements} />
              </div>
            </header>

            <EntitlementBanner entitlements={entitlements} workspaceSlug={slug} />

            <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
            <CopilotOverlay />
          </div>
        </HelpDrawerLayout>
      </HelpDrawerProvider>
    </CopilotProvider>
  );
}
