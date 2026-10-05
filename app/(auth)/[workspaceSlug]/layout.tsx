import { PushSessionBridge } from '@/app/components/pwa/PushSessionBridge';
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { QcAppShell } from '@/app/components/workspace/QcAppShell';
import { AlertBell } from '@/app/components/alerts/AlertBell';
import { InboxLink } from '@/app/components/alerts/InboxLink';
import { HelpDrawerTrigger, HelpDrawerPanel } from '@/app/components/docs/HelpDrawer';
import { HelpDrawerProvider } from '@/app/components/docs/HelpDrawerContext';
import { HelpDrawerLayout } from '@/app/components/docs/HelpDrawerLayout';
import { AssistantWidget } from '@/app/components/assistant/AssistantWidget';
import { SmartAssistantLauncher } from '@/app/components/smart-assistant/SmartAssistantLauncher';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { EntitlementBanner } from '@/app/components/billing/EntitlementBanner';
import { GlobalAnnouncementBanner } from '@/app/components/GlobalAnnouncementBanner';
import { ImpersonationBanner } from '@/app/components/ImpersonationBanner';
import { UserImpersonationBanner } from '@/app/components/UserImpersonationBanner';
import { getAnnouncement } from '@/app/admin/(dashboard)/settings/actions';
import { getActiveDemoContext } from '@/app/lib/demo/context';
import { DemoExperience } from '@/app/components/demo/DemoExperience';

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

  // ── PAID-UPFRONT GATE (2026-09-16) ────────────────────────────────
  // Companies whose effective plan is inactive (never paid, canceled,
  // no comp) never see the workspace - they're sent to the paywall
  // until they subscribe or are manually comped. Paid/comped users pass
  // through untouched. The paywall route lives OUTSIDE this layout so
  // there is no redirect loop. Admin routes are not affected.
  if (!entitlements.isActive) {
    redirect('/paywall');
  }
  // ── END PAID-UPFRONT GATE ────────────────────────────────────────

  const _workspaceLabel = company.name ? company.name.slice(0, 10) : 'Workspace';
  const profile = await getCurrentProfile();
  const demoContext = await getActiveDemoContext(company.id);

  const supabase = await createSupabaseServerClient();

  // Load alerts for the bell. The bell is a PREVIEW surface only: it shows
  // alerts that haven't been "Cleared" from the bell (bell_cleared_at IS NULL),
  // completely independent of Message Center read/archive state. Clearing the
  // bell never touches is_read/status, so MC keeps its own unread/orange state.
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, alert_type, title, message, is_read, created_at, quote_id, order_id, invoice_id')
    .eq('company_id', company.id)
    .is('bell_cleared_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Bell badge counts the alerts currently shown in the bell (not yet cleared),
  // not is_read - the bell has its own lifecycle now.
  const unreadCount = (alerts || []).length;

  // Inbox envelope badge: counts ALL unread alerts (is_read = false) for the
  // company, independent of the bell's clear lifecycle. This reflects the
  // Message Center's unread state. Uses status = 'active' to exclude archived.
  const { count: inboxUnreadCountRaw } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('is_read', false)
    .eq('status', 'active');
  const inboxUnreadCount = inboxUnreadCountRaw ?? 0;

  // Per-user Chat Assistant visibility preference (default ON). When false the
  // widget renders nothing. Read directly here (not in the shared profile
  // selector) to avoid touching getCurrentProfile's broad usage.
  const { data: assistantPref } = await supabase
    .from('users')
    .select('assistant_enabled')
    .eq('id', profile.id)
    .maybeSingle();
  const assistantEnabled = (assistantPref as { assistant_enabled?: boolean } | null)?.assistant_enabled ?? true;

  // Smart Assistant (V1.5): flag-on companies get the launcher instead of
  // the legacy Q widget. Conversations + config are fetched here so the
  // embedded ChatClient has its initial state server-side.
  const { data: smartAssistantOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: company.id,
  });
  let smartAssistantProps: {
    conversations: { id: string; title: string | null; last_active_at: string }[];
    name: string;
    greeting: string;
  } | null = null;
  if (smartAssistantOn) {
    const [{ data: saConfig }, { data: saConvos }] = await Promise.all([
      supabase
        .from('assistant_configs')
        .select('name, greeting, enabled')
        .eq('company_id', company.id)
        .maybeSingle(),
      supabase
        .from('smart_assistant_conversations')
        .select('id, title, last_active_at')
        .order('last_active_at', { ascending: false })
        .limit(50),
    ]);
    smartAssistantProps = {
      conversations: (saConvos ?? []) as { id: string; title: string | null; last_active_at: string }[],
      name: saConfig?.enabled === false ? 'Assistant (disabled)' : (saConfig?.name ?? 'Smart Assistant'),
      greeting: (saConfig as { greeting?: string } | null)?.greeting ?? '',
    };
  }

  // Global announcement banner (admin-controlled, localStorage dismissal)
  const announcement = await getAnnouncement();

  // Impersonation overlay: profile was fetched above, cached per request

  return (
    <HelpDrawerProvider>
      {!demoContext && process.env.PWA_PUSH_ENABLED === 'true' && <PushSessionBridge />}
      <HelpDrawerPanel />
      <HelpDrawerLayout>
        <QcAppShell
          workspaceSlug={slug}
          userId={profile.id}
          companyName={company.name || 'Workspace'}
          entitlements={{ features: entitlements.features }}
          isSupplier={(company as { is_supplier?: boolean }).is_supplier ?? false}
          assistantAvailable={!!smartAssistantOn}
          notices={<>
            {demoContext && <DemoExperience sessionId={demoContext.sessionId} workspaceSlug={slug} expiresAt={demoContext.expiresAt} initialState={demoContext.tutorialState} />}
            {announcement && <GlobalAnnouncementBanner config={announcement} />}
            {'isImpersonating' in profile && profile.isImpersonating && (
              <ImpersonationBanner adminEmail={profile.impersonationAdminEmail ?? null} targetEmail={profile.email} />
            )}
            {'isBeingImpersonated' in profile && profile.isBeingImpersonated && <UserImpersonationBanner />}
          </>}
          entitlementBanner={<EntitlementBanner entitlements={entitlements} workspaceSlug={slug} />}
          bell={<AlertBell initialAlerts={alerts || []} initialUnreadCount={unreadCount} workspaceSlug={slug} userId={profile.id} />}
          inbox={<InboxLink workspaceSlug={slug} unreadCount={inboxUnreadCount} />}
          help={<HelpDrawerTrigger />}
          logout={<LogoutButton className="qc-button qc-shell-logout-button" />}
          assistant={demoContext && demoContext.tutorialState.chapter !== 'smart-assistant' && demoContext.tutorialState.chapter !== 'complete' ? (
            null
          ) : smartAssistantProps ? (
            <SmartAssistantLauncher workspaceSlug={slug} initialConversations={smartAssistantProps.conversations}
              assistantName={smartAssistantProps.name} greeting={smartAssistantProps.greeting} />
          ) : (
            <AssistantWidget userId={profile.id} companyId={company.id}
              trade={(company as { default_trade?: string }).default_trade ?? 'roofing'} enabled={assistantEnabled} />
          )}
        >
          {children}
        </QcAppShell>
      </HelpDrawerLayout>
    </HelpDrawerProvider>
  );
}
