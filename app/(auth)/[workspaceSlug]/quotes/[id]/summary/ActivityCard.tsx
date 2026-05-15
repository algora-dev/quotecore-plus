import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { RevisionRequestsPanel, type RevisionRequest } from './RevisionRequestsPanel';
import { ActivityCardClient } from './ActivityCardClient';
import { ScheduleFollowUpButton } from './ScheduleFollowUpButton';
import { DeleteAllMessagesButton } from './DeleteAllMessagesButton';
import {
  ScheduledMessagesList,
  type ScheduledRowDisplay,
} from './ScheduledMessagesList';
import {
  SentMessagesList,
  type SentMessageListItem,
} from './SentMessagesList';
import {
  type SentMessageReply,
  type MessageReplyAction,
} from './SentMessageRow';

/**
 * Activity card on the quote summary.
 *
 * Single self-contained server component that does ALL data loading
 * for the three tabs in one parallel Promise.all batch. Previously
 * this component delegated to two SentMessagesPanel instances (one
 * per tab) which each opened their own Supabase client and re-ran
 * the same five queries \u2014 ~13 queries per render where 6 would do.
 * That's the activity-section slowness Shaun reported.
 *
 * Tabs:
 *   1. Unresolved \u2014 customer-submitted re-quote requests
 *   2. Scheduled \u2014 pending scheduled follow-ups
 *   3. Sent      \u2014 outbound messages sent for this quote
 *
 * Collapsed by default when nothing demands attention; auto-expands
 * when there's an open unresolved request or pending scheduled
 * follow-up. Collapse state persists in localStorage per quoteId via
 * the client shell.
 */

interface Props {
  workspaceSlug: string;
  quoteId: string;
  companyId: string;
  customerName: string;
  quoteNumber: number | null;
  revisionRequests: RevisionRequest[];
}

const TRIGGER_LABELS = {
  quote_sent: 'After quote was sent',
  quote_accepted: 'After acceptance',
  quote_declined: 'After decline',
  quote_revision_requested: 'After revision request',
  manual: 'Starting now',
} as const;

export async function ActivityCard({
  workspaceSlug: _workspaceSlug,
  quoteId,
  companyId,
  customerName,
  quoteNumber,
  revisionRequests,
}: Props) {
  const supabase = await createSupabaseServerClient();

  // One parallel batch: every read the Activity card needs. Far cheaper
  // than the previous "render two child server components, each of
  // which re-opens a Supabase client and re-runs five queries" path.
  const [
    messagesResult,
    scheduledResult,
    emailTemplatesResult,
    quoteForScheduleResult,
  ] = await Promise.all([
    supabase
      .from('outbound_messages')
      .select(
        'id, subject, recipient_email, recipient_name, status, sent_at, replied_at, created_at',
      )
      .eq('related_quote_id', quoteId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('scheduled_messages')
      .select(
        'id, template_id, recipient_email, recipient_name, trigger_event, fire_at, status, fired_at, cancelled_reason, failed_error',
      )
      .eq('quote_id', quoteId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('email_templates')
      .select('id, name, subject')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('quotes')
      .select('accepted_at, declined_at')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);

  const messages = messagesResult.data ?? [];
  const scheduledRows = scheduledResult.data ?? [];
  const emailTemplates = emailTemplatesResult.data ?? [];
  const quoteFlags = quoteForScheduleResult.data ?? null;

  // Replies pulled in a second batch so the IN clause has the right ids.
  // Cheap (single query) and only when there are messages.
  let replyRows: Array<{
    id: string;
    message_id: string;
    action: MessageReplyAction;
    body: string | null;
    created_at: string;
  }> = [];
  if (messages.length > 0) {
    const { data } = await supabase
      .from('outbound_message_replies')
      .select('id, message_id, action, body, created_at')
      .in(
        'message_id',
        messages.map((m) => m.id),
      )
      .order('created_at', { ascending: true });
    replyRows = (data ?? []) as typeof replyRows;
  }

  // ----------------------------------------------------------------
  // Shape data into the row component contracts.
  // ----------------------------------------------------------------
  const repliesByMessage = new Map<string, SentMessageReply[]>();
  for (const row of replyRows) {
    const list = repliesByMessage.get(row.message_id) ?? [];
    list.push({
      id: row.id,
      action: row.action,
      body: row.body,
      created_at: row.created_at,
    });
    repliesByMessage.set(row.message_id, list);
  }

  // For any suppressed messages we look up the matching
  // `message_suppressions` rows so the row can render the reason
  // banner inline. One additional query keyed on the small set of
  // distinct recipient emails; matched in JS to keep the SQL simple.
  const suppressedEmails = Array.from(
    new Set(
      messages
        .filter((m) => m.status === 'suppressed')
        .map((m) => m.recipient_email.toLowerCase()),
    ),
  );
  const suppressionByEmail = new Map<
    string,
    { reason: string | null; createdAt: string }
  >();
  if (suppressedEmails.length > 0) {
    const { data: suppRows } = await supabase
      .from('message_suppressions')
      .select('email, reason, created_at')
      .eq('company_id', companyId)
      .in('email', suppressedEmails);
    for (const row of suppRows ?? []) {
      suppressionByEmail.set(row.email.toLowerCase(), {
        reason: row.reason,
        createdAt: row.created_at,
      });
    }
  }

  const sentItems: SentMessageListItem[] = messages.map((m) => {
    const supp =
      m.status === 'suppressed'
        ? suppressionByEmail.get(m.recipient_email.toLowerCase()) ?? null
        : null;
    return {
      id: m.id,
      subject: m.subject,
      recipientEmail: m.recipient_email,
      recipientName: m.recipient_name,
      status: m.status,
      sentAt: m.sent_at,
      createdAt: m.created_at,
      repliedAt: m.replied_at,
      replies: repliesByMessage.get(m.id) ?? [],
      suppressionReason: supp?.reason ?? null,
      suppressionAt: supp?.createdAt ?? null,
    };
  });

  const templateNameById = new Map<string, string>();
  for (const t of emailTemplates) {
    templateNameById.set(t.id, t.name);
  }

  const scheduledDisplay: ScheduledRowDisplay[] = scheduledRows.map((row) => ({
    id: row.id,
    templateName: row.template_id ? (templateNameById.get(row.template_id) ?? null) : null,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    triggerEvent: row.trigger_event as ScheduledRowDisplay['triggerEvent'],
    fireAt: row.fire_at,
    status: row.status as ScheduledRowDisplay['status'],
    firedAt: row.fired_at,
    cancelledReason: row.cancelled_reason,
    failedError: row.failed_error,
  }));

  // Schedule modal defaults: prefer the most recent successful send.
  let defaultRecipientEmail: string | null = null;
  let defaultRecipientName: string | null = customerName ?? null;
  if (messages.length > 0) {
    const lastSuccessful = messages.find((m) => m.status === 'sent') ?? messages[0];
    defaultRecipientEmail = lastSuccessful.recipient_email;
    defaultRecipientName = lastSuccessful.recipient_name ?? defaultRecipientName;
  }

  // ----------------------------------------------------------------
  // Counts for the tab badges + header summary.
  // ----------------------------------------------------------------
  const unresolvedCount = revisionRequests.filter((r) => !r.resolved_at).length;
  const scheduledCount = scheduledRows.filter((r) => r.status === 'scheduled').length;
  const sentCount = messages.length;

  // ----------------------------------------------------------------
  // Header CTAs.
  // ----------------------------------------------------------------
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

  void TRIGGER_LABELS; // reserved for future inline summaries; intentionally unused

  // ----------------------------------------------------------------
  // Tab bodies. Inline empty-states so each tab is self-explanatory.
  // ----------------------------------------------------------------
  const unresolvedTab = (
    <RevisionRequestsPanel
      requests={revisionRequests}
      fallbackCustomerName={customerName}
      quoteNumber={quoteNumber}
      chromeless
    />
  );

  const scheduledTab =
    scheduledRows.length > 0 ? (
      <ScheduledMessagesList rows={scheduledDisplay} />
    ) : (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No follow-ups scheduled. Use &ldquo;Schedule follow-up&rdquo; above to plan an automatic
        message.
      </div>
    );

  const sentTab =
    sentItems.length > 0 ? (
      <SentMessagesList messages={sentItems} />
    ) : (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No messages sent yet. Use &ldquo;Send Quote&rdquo; or &ldquo;Schedule follow-up&rdquo; to
        send one.
      </div>
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
