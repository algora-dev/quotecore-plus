import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { RevisionRequestsPanel, type RevisionRequest } from './RevisionRequestsPanel';
import { SentMessagesPanel } from './SentMessagesPanel';
import { ActivityCardClient } from './ActivityCardClient';
import { ScheduleFollowUpButton } from './ScheduleFollowUpButton';
import { DeleteAllMessagesButton } from './DeleteAllMessagesButton';

/**
 * Activity card on the quote summary.
 *
 * Replaces the two stacked boxes (RevisionRequestsPanel + SentMessagesPanel)
 * with a single tabbed card whose tabs are:
 *   1. Unresolved \u2014 customer-submitted re-quote requests
 *   2. Scheduled \u2014 pending scheduled follow-ups
 *   3. Sent      \u2014 outbound messages sent for this quote
 *
 * The card collapses to a one-line summary by default when nothing
 * needs attention. Auto-expands when there's at least one open
 * unresolved request or pending scheduled message. Collapse state is
 * persisted in localStorage per quoteId via ActivityCardClient.
 *
 * Server-component shell: does all data loading via Supabase, then
 * hands typed props to the client tab shell. Tab bodies reuse the
 * existing panel components in `chromeless` / `chromelessSection`
 * mode so we don't duplicate row-rendering logic.
 */

interface Props {
  workspaceSlug: string;
  quoteId: string;
  companyId: string;
  customerName: string;
  quoteNumber: number | null;
  revisionRequests: RevisionRequest[];
}

export async function ActivityCard({
  workspaceSlug: _workspaceSlug,
  quoteId,
  companyId,
  customerName,
  quoteNumber,
  revisionRequests,
}: Props) {
  const supabase = await createSupabaseServerClient();

  // Counts only \u2014 the actual rows are loaded inside SentMessagesPanel
  // (chromelessSection mode) so we keep one source of truth for what
  // goes in each tab. Doing two extra count(*) queries here is fine;
  // they live next to the page render and are cheap on indexed cols.
  const [scheduledCountResult, sentCountResult, scheduleDefaultsResult] = await Promise.all([
    supabase
      .from('scheduled_messages')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
      .eq('company_id', companyId)
      .eq('status', 'scheduled'),
    supabase
      .from('outbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('related_quote_id', quoteId)
      .eq('company_id', companyId),
    // One small read to power the Schedule modal defaults (recipient
    // email, accepted/declined gating). Mirrors the same picks made
    // inside SentMessagesPanel so the modal lands with the same
    // defaults the user expects when they previously used the panel.
    Promise.all([
      supabase
        .from('email_templates')
        .select('id, name, subject')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('outbound_messages')
        .select('recipient_email, recipient_name, status, created_at')
        .eq('related_quote_id', quoteId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('quotes')
        .select('accepted_at, declined_at')
        .eq('id', quoteId)
        .eq('company_id', companyId)
        .maybeSingle(),
    ]),
  ]);

  const scheduledCount = scheduledCountResult.count ?? 0;
  const sentCount = sentCountResult.count ?? 0;
  const [emailTemplatesResult, recentSendsResult, quoteFlagsResult] = scheduleDefaultsResult;
  const emailTemplates = emailTemplatesResult.data ?? [];
  const recentSends = recentSendsResult.data ?? [];
  const quoteFlags = quoteFlagsResult.data ?? null;

  const unresolvedCount = revisionRequests.filter((r) => !r.resolved_at).length;

  let defaultRecipientEmail: string | null = null;
  let defaultRecipientName: string | null = customerName ?? null;
  if (recentSends.length > 0) {
    const lastSuccessful = recentSends.find((m) => m.status === 'sent') ?? recentSends[0];
    defaultRecipientEmail = lastSuccessful.recipient_email;
    defaultRecipientName = lastSuccessful.recipient_name ?? defaultRecipientName;
  }

  const scheduleCta =
    emailTemplates.length > 0 && quoteFlags ? (
      <ScheduleFollowUpButton
        quoteId={quoteId}
        quote={{
          customer_name: customerName,
          accepted_at: quoteFlags.accepted_at,
          declined_at: quoteFlags.declined_at,
        }}
        defaultRecipientEmail={defaultRecipientEmail}
        defaultRecipientName={defaultRecipientName}
        emailTemplates={emailTemplates}
        hasPriorSend={sentCount > 0}
      />
    ) : null;

  const deleteAllCta =
    sentCount > 0 ? <DeleteAllMessagesButton quoteId={quoteId} messageCount={sentCount} /> : null;

  // Pre-render each tab's body as JSX so the client component receives
  // ready-to-mount React nodes. The chromeless variants share their row
  // rendering with the standalone panels \u2014 keeps row markup in one
  // place and avoids drift.
  const unresolvedTab = (
    <RevisionRequestsPanel
      requests={revisionRequests}
      fallbackCustomerName={customerName}
      quoteNumber={quoteNumber}
      chromeless
    />
  );

  const scheduledTab = (
    <SentMessagesPanel quoteId={quoteId} companyId={companyId} chromelessSection="scheduled" />
  );

  const sentTab = (
    <SentMessagesPanel quoteId={quoteId} companyId={companyId} chromelessSection="sent" />
  );

  return (
    <ActivityCardClient
      quoteId={quoteId}
      counts={{
        unresolved: unresolvedCount,
        scheduled: scheduledCount,
        sent: sentCount,
      }}
      headerCtas={
        <>
          {scheduleCta}
          {deleteAllCta}
        </>
      }
      tabs={{
        unresolved: unresolvedTab,
        scheduled: scheduledTab,
        sent: sentTab,
      }}
    />
  );
}
