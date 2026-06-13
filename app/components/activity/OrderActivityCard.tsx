import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { ActivityCardClient } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/summary/ActivityCardClient';
import {
  ScheduledMessagesList,
  type ScheduledRowDisplay,
} from '@/app/(auth)/[workspaceSlug]/quotes/[id]/summary/ScheduledMessagesList';
import {
  SentMessagesList,
  type SentMessageListItem,
} from '@/app/(auth)/[workspaceSlug]/quotes/[id]/summary/SentMessagesList';
import {
  type SentMessageReply,
  type MessageReplyAction,
} from '@/app/(auth)/[workspaceSlug]/quotes/[id]/summary/SentMessageRow';
import { OrderResponsesPanel } from './OrderResponsesPanel';
import { FollowUpBuilderButton } from './FollowUpBuilderButton';
import { EntityDeleteAllMessagesButton } from './EntityDeleteAllMessagesButton';

/**
 * Activity card for a material order. Mirrors the quote summary
 * ActivityCard (3 tabs: Unresolved / Scheduled / Sent) but specific to
 * orders:
 *   - Unresolved = open supplier responses (questions / change requests /
 *     declines / info requests). Read-only - orders are actioned via the
 *     order status, not a per-response resolve flag.
 *   - Scheduled  = scheduled_messages keyed on order_id.
 *   - Sent       = outbound_messages keyed on related_order_id.
 *
 * One parallel batch for all reads, matching the quote card's pattern.
 */

interface Props {
  orderId: string;
  companyId: string;
  supplierName: string | null;
  /** Lifecycle stamps for trigger labelling. */
  acceptedAt: string | null;
  declinedAt: string | null;
  emailTemplates: { id: string; name: string; subject: string; is_default?: boolean | null }[];
  canFollowups: boolean;
}

export async function OrderActivityCard({
  orderId,
  companyId,
  supplierName,
  acceptedAt,
  declinedAt,
  emailTemplates,
  canFollowups,
}: Props) {
  const supabase = await createSupabaseServerClient();

  const [messagesResult, scheduledResult, responsesResult] = await Promise.all([
    supabase
      .from('outbound_messages')
      .select(
        'id, subject, recipient_email, recipient_name, status, sent_at, replied_at, created_at',
      )
      .eq('related_order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('scheduled_messages')
      .select(
        'id, template_id, recipient_email, recipient_name, trigger_event, fire_at, status, fired_at, cancelled_reason, failed_error',
      )
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('material_order_responses')
      .select('id, action')
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .limit(50),
  ]);

  const messages = messagesResult.data ?? [];
  const scheduledRows = scheduledResult.data ?? [];

  // Template names for scheduled rows.
  const { data: templateRows } = await supabase
    .from('email_templates')
    .select('id, name')
    .eq('company_id', companyId);
  const templateNameById = new Map<string, string>();
  for (const t of templateRows ?? []) templateNameById.set(t.id, t.name);

  // Replies for sent messages.
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
      .in('message_id', messages.map((m) => m.id))
      .order('created_at', { ascending: true });
    replyRows = (data ?? []) as typeof replyRows;
  }
  const repliesByMessage = new Map<string, SentMessageReply[]>();
  for (const row of replyRows) {
    const list = repliesByMessage.get(row.message_id) ?? [];
    list.push({ id: row.id, action: row.action, body: row.body, created_at: row.created_at });
    repliesByMessage.set(row.message_id, list);
  }

  // Suppression banners.
  const suppressedEmails = Array.from(
    new Set(
      messages
        .filter((m) => m.status === 'suppressed')
        .map((m) => m.recipient_email.toLowerCase()),
    ),
  );
  const suppressionByEmail = new Map<string, { reason: string | null; createdAt: string }>();
  if (suppressedEmails.length > 0) {
    const { data: suppRows } = await supabase
      .from('message_suppressions')
      .select('email, reason, created_at')
      .eq('company_id', companyId)
      .in('email', suppressedEmails);
    for (const row of suppRows ?? []) {
      suppressionByEmail.set(row.email.toLowerCase(), { reason: row.reason, createdAt: row.created_at });
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

  // Schedule defaults: most recent successful send, else supplier name.
  let defaultRecipientEmail: string | null = null;
  let defaultRecipientName: string | null = supplierName ?? null;
  if (messages.length > 0) {
    const last = messages.find((m) => m.status === 'sent') ?? messages[0];
    defaultRecipientEmail = last.recipient_email;
    defaultRecipientName = last.recipient_name ?? defaultRecipientName;
  }

  // Counts.
  const UNRESOLVED_ACTIONS = new Set([
    'request_changes',
    'question',
    'declined',
    'info_requested',
    'other',
  ]);
  const unresolvedCount = (responsesResult.data ?? []).filter((r) =>
    UNRESOLVED_ACTIONS.has(r.action),
  ).length;
  const scheduledCount = scheduledRows.filter((r) => r.status === 'scheduled').length;
  const sentCount = messages.length;

  // acceptedAt / declinedAt no longer needed for the builder (the shared
  // builder parks pre-event triggers itself) but kept on Props for the
  // caller; reference to keep them "used".
  void acceptedAt;
  void declinedAt;

  const scheduleCta =
    canFollowups && emailTemplates.length > 0 ? (
      <FollowUpBuilderButton
        kind="order"
        entityId={orderId}
        emailTemplates={emailTemplates}
        defaultRecipientEmail={defaultRecipientEmail}
        defaultRecipientName={defaultRecipientName}
      />
    ) : null;

  const deleteAllCta =
    sentCount > 0 ? (
      <EntityDeleteAllMessagesButton kind="order" entityId={orderId} messageCount={sentCount} />
    ) : null;

  const scheduledTab =
    scheduledRows.length > 0 ? (
      <ScheduledMessagesList rows={scheduledDisplay} />
    ) : (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No follow-ups scheduled. Use &ldquo;Schedule follow-up&rdquo; above to plan an automatic message.
      </div>
    );

  const sentTab =
    sentItems.length > 0 ? (
      <SentMessagesList messages={sentItems} />
    ) : (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No messages sent yet for this order.
      </div>
    );

  return (
    <ActivityCardClient
      quoteId={orderId}
      counts={{ unresolved: unresolvedCount, scheduled: scheduledCount, sent: sentCount }}
      headerCtas={
        <>
          {scheduleCta}
          {deleteAllCta}
        </>
      }
      tabs={{
        unresolved: <OrderResponsesPanel orderId={orderId} companyId={companyId} />,
        scheduled: scheduledTab,
        sent: sentTab,
      }}
    />
  );
}
