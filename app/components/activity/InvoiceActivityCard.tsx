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
import { InvoiceDisputesPanel, type InvoiceDispute } from './InvoiceDisputesPanel';
import { EntityScheduleFollowUpButton } from './EntityScheduleFollowUpButton';
import { EntityDeleteAllMessagesButton } from './EntityDeleteAllMessagesButton';

/**
 * Activity card for an invoice. Mirrors the quote summary ActivityCard
 * (3 tabs) but specific to invoices:
 *   - Unresolved = open invoice_disputes (with Mark-resolved action).
 *   - Scheduled  = scheduled_messages keyed on invoice_id.
 *   - Sent       = outbound_messages keyed on related_invoice_id.
 */

interface Props {
  invoiceId: string;
  companyId: string;
  customerName: string | null;
  customerEmail: string | null;
  emailTemplates: { id: string; name: string; subject: string }[];
  canFollowups: boolean;
}

export async function InvoiceActivityCard({
  invoiceId,
  companyId,
  customerName,
  customerEmail,
  emailTemplates,
  canFollowups,
}: Props) {
  const supabase = await createSupabaseServerClient();

  const [messagesResult, scheduledResult, disputesResult] = await Promise.all([
    supabase
      .from('outbound_messages')
      .select(
        'id, subject, recipient_email, recipient_name, status, sent_at, replied_at, created_at',
      )
      .eq('related_invoice_id', invoiceId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('scheduled_messages')
      .select(
        'id, template_id, recipient_email, recipient_name, trigger_event, fire_at, status, fired_at, cancelled_reason, failed_error',
      )
      .eq('invoice_id', invoiceId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('invoice_disputes')
      .select('id, reason, message, recipient_name, recipient_email, created_at, resolved_at')
      .eq('invoice_id', invoiceId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const messages = messagesResult.data ?? [];
  const scheduledRows = scheduledResult.data ?? [];
  const disputes = (disputesResult.data ?? []) as InvoiceDispute[];

  const { data: templateRows } = await supabase
    .from('email_templates')
    .select('id, name')
    .eq('company_id', companyId);
  const templateNameById = new Map<string, string>();
  for (const t of templateRows ?? []) templateNameById.set(t.id, t.name);

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

  let defaultRecipientEmail: string | null = customerEmail ?? null;
  let defaultRecipientName: string | null = customerName ?? null;
  if (messages.length > 0) {
    const last = messages.find((m) => m.status === 'sent') ?? messages[0];
    defaultRecipientEmail = last.recipient_email ?? defaultRecipientEmail;
    defaultRecipientName = last.recipient_name ?? defaultRecipientName;
  }

  const unresolvedCount = disputes.filter((d) => !d.resolved_at).length;
  const scheduledCount = scheduledRows.filter((r) => r.status === 'scheduled').length;
  const sentCount = messages.length;

  const scheduleCta =
    canFollowups && emailTemplates.length > 0 ? (
      <EntityScheduleFollowUpButton
        kind="invoice"
        entityId={invoiceId}
        flags={{}}
        defaultRecipientEmail={defaultRecipientEmail}
        defaultRecipientName={defaultRecipientName}
        emailTemplates={emailTemplates}
        hasPriorSend={sentCount > 0}
      />
    ) : null;

  const deleteAllCta =
    sentCount > 0 ? (
      <EntityDeleteAllMessagesButton kind="invoice" entityId={invoiceId} messageCount={sentCount} />
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
        No messages sent yet for this invoice.
      </div>
    );

  return (
    <ActivityCardClient
      quoteId={invoiceId}
      counts={{ unresolved: unresolvedCount, scheduled: scheduledCount, sent: sentCount }}
      headerCtas={
        <>
          {scheduleCta}
          {deleteAllCta}
        </>
      }
      tabs={{
        unresolved: <InvoiceDisputesPanel disputes={disputes} />,
        scheduled: scheduledTab,
        sent: sentTab,
      }}
    />
  );
}
