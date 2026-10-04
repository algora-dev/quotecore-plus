import { HomeDashboard, type RecentWorkItem } from '@/app/components/workspace/HomeDashboard';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { MeasureJobButton } from './MeasureJobModal';
import { WelcomeModal } from './tutorials/WelcomeModal';
import { V2WelcomeModal } from './V2WelcomeModal';
import { getActiveDemoContext } from '@/app/lib/demo/context';
import { DocDraftRestorer } from './DocDraftRestorer';
import { TakeoffDraftNoteBanner } from './TakeoffDraftNoteBanner';
import { CalcDraftImportBanner } from './CalcDraftImportBanner';

// HOME-01 helpers (module scope so render stays pure under react-hooks/purity).
// Labels and tones mirror QuotesList's JOB_STATUS_CONFIG.
const JOB_STATUS_META: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' }> = {
  unsent: { label: 'Unsent', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'warning' },
  deposit_paid: { label: 'Deposit paid', tone: 'success' },
  materials_ordered: { label: 'Materials ordered', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  complete: { label: 'Complete', tone: 'success' },
};
function recentUpdatedLabel(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return days < 60 ? '1 month ago' : `${Math.floor(days / 30)} months ago`;
}

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { company } = await loadCompanyContext();
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();

  // Measure a job entry - same entitlement inputs as the new-quote page so
  // the modal inherits identical gating/copy behaviour.
  const defaultMeasurementSystem = normalizeMeasurementSystem(company.default_measurement_system);
  const ent = await loadCompanyEntitlements(profile.company_id);
  const monthlyQuoteAtCap = ent.monthlyQuoteUsed >= ent.monthlyQuoteLimit;
  const { data: componentCollections } = await supabase
    .from('component_collections')
    .select('id, name, is_bootstrap')
    .eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false })
    .order('name', { ascending: true });
  const defaultTrade = (company as { default_trade?: string }).default_trade ?? 'roofing';

  // Load bell-visible alert count (same lifecycle as the bell icon:
  // bell_cleared_at IS NULL). This keeps the dashboard banner in sync with
  // the bell - clearing alerts from the bell also clears the banner.
  const { count: unreadAlerts } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .is('bell_cleared_at', null);

  // Load user name + first-login Tutorials flag (gates the Welcome modal)
  // and the one-time V2 rollout welcome (gates V2WelcomeModal).
  const { data: user } = await supabase
    .from('users')
    .select('full_name, tutorials_seen_at, v2_welcome_seen_at')
    .eq('id', profile.id)
    .single();

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  // Demo sessions greet with their own welcome inside the guide widget; never
  // stack the normal-account modals on top of it (owner direction 2026-10-04).
  const demoContext = await getActiveDemoContext(company.id);
  // A personal help preference, not workspace pricing-readiness. No blocking tour.
  const showWelcome = !demoContext && !user?.tutorials_seen_at;
  // One-time V2 welcome for every account (new and existing) on first sign-in
  // after the V2 rollout. Dismissal stamps v2_welcome_seen_at.
  const showV2Welcome = !demoContext && !user?.v2_welcome_seen_at;

  // Check for calculator draft from signup flow (H-03: signup context preservation)
  const cookieStore = await cookies();
  const signupDraft = cookieStore.get('qcp_signup_draft')?.value;
  const signupRef = cookieStore.get('qcp_signup_ref')?.value;
  // Ref cookie is optional - the T2 path (restore-calc-draft → onboarding)
  // only sets the draft cookie. The draft id alone is enough to import.
  const hasCalcDraft = Boolean(signupDraft);

  // Smart Assistant dark-launch flag (service-written per company). Gates
  // the dashboard card so flag-off companies never see the entry point.
  const { data: smartAssistantOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });

  // HOME-01 (wired): company-scoped recent work, bounded to the 5 most recently
  // updated quotes. User client + RLS: no cross-company rows are possible. On
  // read failure recentWork stays undefined, which renders the safe Open-quotes
  // route (unknown is not zero jobs). Routing matches QuotesList: drafts open
  // the builder, confirmed quotes open their summary (never write a snapshot
  // by sending a draft to Summary).
  const { data: recentQuoteRows, error: recentQuoteError } = await supabase
    .from('quotes')
    .select('id, customer_name, job_name, status, quote_number, job_status, updated_at')
    .eq('company_id', profile.company_id)
    .order('updated_at', { ascending: false })
    .limit(5);
  const recentWork: RecentWorkItem[] | undefined = recentQuoteError
    ? undefined
    : (recentQuoteRows ?? []).map((q) => {
        const isDraft = q.status === 'draft';
        const meta = JOB_STATUS_META[q.job_status ?? 'unsent']
          ?? { label: q.job_status ?? 'Unsent', tone: 'neutral' as const };
        return {
          id: q.id,
          href: isDraft ? `/${workspaceSlug}/quotes/${q.id}` : `/${workspaceSlug}/quotes/${q.id}/summary`,
          title: q.job_name || q.customer_name || 'Quote',
          customer: q.customer_name || '-',
          quoteNumber: String(q.quote_number ?? ''),
          statusLabel: isDraft ? 'Draft' : meta.label,
          statusTone: isDraft ? 'neutral' : meta.tone,
          updatedLabel: recentUpdatedLabel(q.updated_at),
        };
      });

  return (
    <section data-qc-ui="v2" className="space-y-5">
      {showV2Welcome && <V2WelcomeModal />}
      {showWelcome ? <WelcomeModal base={`/${workspaceSlug}`} firstName={firstName} pricingFirst={!hasCalcDraft && recentWork !== undefined && recentWork.length === 0 && !(company as { is_supplier?: boolean }).is_supplier} /> : null}
      {hasCalcDraft && <CalcDraftImportBanner draftId={signupDraft!} sourceRef={signupRef ?? null} />}
      <Suspense fallback={null}><DocDraftRestorer workspaceSlug={workspaceSlug} /></Suspense>
      <TakeoffDraftNoteBanner />
      {/* HOME-01 wired: see recentWork mapping above. JOB-01 (related orders/invoices
          on Job Space) deferred to the next pass; its undefined state shows safe routes. */}
      <HomeDashboard workspaceSlug={workspaceSlug} firstName={firstName} newUser={showWelcome}
        notificationCount={unreadAlerts ?? 0} canCreateQuote={!monthlyQuoteAtCap}
        assistantAvailable={!!smartAssistantOn} recentWork={recentWork}
        allowPricingInvitation={!hasCalcDraft && !(company as { is_supplier?: boolean }).is_supplier}
        measureAction={
<MeasureJobButton
        variant="inline"
        workspaceSlug={workspaceSlug}
        companyId={profile.company_id}
        defaultMeasurementSystem={defaultMeasurementSystem}
        digitalTakeoffAvailable={ent.features.digital_takeoff}
        monthlyQuoteAtCap={monthlyQuoteAtCap}
        monthlyQuoteUsed={ent.monthlyQuoteUsed}
        monthlyQuoteLimit={ent.monthlyQuoteLimit}
        effectivePlanCode={ent.effectivePlanCode}
        defaultTrade={defaultTrade}
        componentCollections={componentCollections ?? []}
        isOverStorage={ent.isOverStorage}
      />
        }
      />
    </section>
  );
}
