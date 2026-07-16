import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { WorkspaceNav } from '@/app/components/workspace/WorkspaceNav';
import { MobileHeader } from '@/app/components/workspace/MobileHeader';
import { AlertBell } from '@/app/components/alerts/AlertBell';
import { InboxLink } from '@/app/components/alerts/InboxLink';
import { HelpDrawerTrigger, HelpDrawerPanel } from '@/app/components/docs/HelpDrawer';
import { HelpDrawerProvider } from '@/app/components/docs/HelpDrawerContext';
import { HelpDrawerLayout } from '@/app/components/docs/HelpDrawerLayout';
import { AssistantWidget } from '@/app/components/assistant/AssistantWidget';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { EntitlementBanner } from '@/app/components/billing/EntitlementBanner';
import { TrialRolledToFreeBanner } from '@/app/components/billing/TrialRolledToFreeBanner';
import { GlobalAnnouncementBanner } from '@/app/components/GlobalAnnouncementBanner';
import { ImpersonationBanner } from '@/app/components/ImpersonationBanner';
import { UserImpersonationBanner } from '@/app/components/UserImpersonationBanner';
import { getAnnouncement } from '@/app/admin/(dashboard)/settings/actions';

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

  // Per-user Chat Assistant visibility preference (default ON). When false the
  // widget renders nothing. Read directly here (not in the shared profile
  // selector) to avoid touching getCurrentProfile's broad usage.
  const { data: assistantPref } = await supabase
    .from('users')
    .select('assistant_enabled')
    .eq('id', profile.id)
    .maybeSingle();
  const assistantEnabled = (assistantPref as { assistant_enabled?: boolean } | null)?.assistant_enabled ?? true;

  // Global announcement banner (admin-controlled, localStorage dismissal)
  const announcement = await getAnnouncement();

  // Impersonation overlay: profile was fetched above, cached per request

  return (
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
            {announcement && <GlobalAnnouncementBanner config={announcement} />}
            {'isImpersonating' in profile && profile.isImpersonating && (
              <ImpersonationBanner
                adminEmail={profile.impersonationAdminEmail ?? null}
                targetEmail={profile.email}
              />
            )}
            {'isBeingImpersonated' in profile && profile.isBeingImpersonated && (
              <UserImpersonationBanner />
            )}
            <header className="border-b border-slate-200 bg-white shadow-sm">
              {/* Mobile header (below md): Logo | Bell | Inbox | Help | Hamburger */}
              <MobileHeader
                workspaceSlug={slug}
                navItems={[
                  { href: `/${slug}/quotes`, label: 'Quotes' },
                  { href: `/${slug}/material-orders`, label: 'Orders' },
                  { href: `/${slug}/invoices`, label: 'Invoices' },
                  { href: `/${slug}/resources`, label: 'Resources' },
                ]}
                bell={
                  <AlertBell
                    initialAlerts={alerts || []}
                    initialUnreadCount={unreadCount}
                    workspaceSlug={slug}
                  />
                }
                inbox={<InboxLink workspaceSlug={slug} />}
                help={<HelpDrawerTrigger />}
              />

              {/* Desktop header (md+): full header with nav */}
              <div className="hidden md:block">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/${slug}`} prefetch={false} className="flex items-center">
                      <img src="/logo.png" alt="QuoteCore" className="h-9" />
                    </Link>
                    <div className="flex items-center gap-3">
                      <AlertBell
                        initialAlerts={alerts || []}
                        initialUnreadCount={unreadCount}
                        workspaceSlug={slug}
                      />
                      <InboxLink workspaceSlug={slug} />
                      <HelpDrawerTrigger />
                      <Link
                        href={`/${slug}/account`}
                        prefetch={false}
                        data-assistant-id="nav-account"
                        className="inline-flex items-center rounded-full border-2 border-transparent bg-white px-3 py-1 text-sm font-semibold text-slate-600 pill-shimmer"
                      >
                        Account
                      </Link>
                      <LogoutButton />
                    </div>
                  </div>

                  <WorkspaceNav workspaceSlug={slug} entitlements={entitlements} />
                </div>
              </div>
            </header>

            <EntitlementBanner entitlements={entitlements} workspaceSlug={slug} />

            {/* Trial -> Free roll-over notice. Shows once a trial has lapsed and
                the account is effectively on Free (covers the window before the
                daily cron flips stored status from 'trialing' to 'active' too).
                Dismissible; reappears once per fresh login (sessionStorage). */}
            {entitlements.effectivePlanCode === 'free' &&
            entitlements.trialEndsAt &&
            new Date(entitlements.trialEndsAt).getTime() < Date.now() ? (
              <TrialRolledToFreeBanner
                workspaceSlug={slug}
                sessionTag={`${company.id}:${entitlements.trialEndsAt}`}
              />
            ) : null}

            <main className="mx-auto w-full max-w-6xl px-4 py-4 pb-20 md:px-6 md:py-10 md:pb-10">{children}</main>
            {/*
              AI Assistant widget. Self-gates on NEXT_PUBLIC_AI_ASSISTANT_V1 -
              renders nothing when the flag is off. This is now the SOLE
              in-app help surface (legacy Copilot removed); the Help Drawer
              remains as a deterministic docs fallback.
            */}
            <AssistantWidget
              userId={profile.id}
              companyId={company.id}
              trade={(company as { default_trade?: string }).default_trade ?? 'roofing'}
              enabled={assistantEnabled}
            />
          </div>
        </HelpDrawerLayout>
      </HelpDrawerProvider>
  );
}
