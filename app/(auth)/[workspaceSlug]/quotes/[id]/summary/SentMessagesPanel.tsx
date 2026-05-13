import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { type SentMessageReply, type MessageReplyAction } from './SentMessageRow';
import { DeleteAllMessagesButton } from './DeleteAllMessagesButton';
import { SentMessagesList, type SentMessageListItem } from './SentMessagesList';
import { ScheduleFollowUpButton } from './ScheduleFollowUpButton';
import {
  ScheduledMessagesList,
  type ScheduledRowDisplay,
} from './ScheduledMessagesList';

interface Props {
  quoteId: string;
  companyId: string;
}

/**
 * Compact log of outbound Messages sent from the quote summary, rendered
 * as a server component so it picks up new sends on the next page render
 * without a separate client fetch.
 *
 * 2026-05-12: rows are now expandable to surface the recipient's reply
 * detail (action + body + timestamp). The expansion UI lives in
 * `SentMessageRow.tsx` (client component); this server component fetches
 * the messages + their replies in a single round-trip and hydrates the
 * client component with the result.
 *
 * 2026-05-13: Messages Phase 2 \u2014 the panel now also surfaces
 * `scheduled_messages` rows in a top "Scheduled" subsection, and adds
 * a "Schedule follow-up" button in the header. The panel renders if
 * the quote has any sent OR scheduled activity (or if there are email
 * templates available, so the button is always reachable on a fresh
 * quote).
 */
export async function SentMessagesPanel({ quoteId, companyId }: Props) {
  const supabase = await createSupabaseServerClient();

  // Resolve current user once \u2014 used for the admin "Send now" flag on
  // scheduled rows and (implicitly) for RLS scoping on every query below.
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: me } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = !!me?.is_admin;
  }

  const { data: messages } = await supabase
    .from('outbound_messages')
    .select(
      'id, subject, recipient_email, recipient_name, status, sent_at, replied_at, created_at',
    )
    .eq('related_quote_id', quoteId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: scheduledRows } = await supabase
    .from('scheduled_messages')
    .select(
      'id, template_id, recipient_email, recipient_name, trigger_event, fire_at, status, fired_at, cancelled_reason, failed_error',
    )
    .eq('quote_id', quoteId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Load email templates so the Schedule modal can pick one. Restrict
  // to the lightweight columns we need.
  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('id, name, subject')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  // Cross-reference template ids \u2192 name for the Scheduled list.
  const templateNameById = new Map<string, string>();
  for (const t of emailTemplates ?? []) {
    templateNameById.set(t.id, t.name);
  }

  // Customer name from the quote drives the recipient-name default on
  // the Schedule modal. Fetch in the same round-trip.
  const { data: quoteForSchedule } = await supabase
    .from('quotes')
    .select('customer_name, accepted_at, declined_at')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle();

  const hasMessages = (messages?.length ?? 0) > 0;
  const hasScheduled = (scheduledRows?.length ?? 0) > 0;
  const hasTemplates = (emailTemplates?.length ?? 0) > 0;

  // Render conditions:
  //   - any sent message OR scheduled row \u2192 always show the panel.
  //   - no activity yet but the user has at least one email template
  //     and the quote exists \u2192 show the panel with just the schedule
  //     button so a fresh quote can be auto-followed-up.
  //   - no activity AND no templates \u2192 don't render. The user has no
  //     templates anyway, the Schedule modal would be useless.
  if (!hasMessages && !hasScheduled && !hasTemplates) {
    return null;
  }

  // --- Sent messages prep -------------------------------------------
  let listItems: SentMessageListItem[] = [];
  let repliedCount = 0;
  if (hasMessages) {
    const messageIds = messages!.map((m) => m.id);
    const { data: replyRows } = await supabase
      .from('outbound_message_replies')
      .select('id, message_id, action, body, created_at')
      .in('message_id', messageIds)
      .order('created_at', { ascending: true });
    const repliesByMessage = new Map<string, SentMessageReply[]>();
    for (const row of replyRows ?? []) {
      const list = repliesByMessage.get(row.message_id) ?? [];
      list.push({
        id: row.id,
        action: row.action as MessageReplyAction,
        body: row.body,
        created_at: row.created_at,
      });
      repliesByMessage.set(row.message_id, list);
    }
    repliedCount = messages!.filter((m) => m.replied_at).length;
    listItems = messages!.map((m) => ({
      id: m.id,
      subject: m.subject,
      recipientEmail: m.recipient_email,
      recipientName: m.recipient_name,
      status: m.status,
      sentAt: m.sent_at,
      createdAt: m.created_at,
      repliedAt: m.replied_at,
      replies: repliesByMessage.get(m.id) ?? [],
    }));
  }

  // --- Scheduled rows prep ------------------------------------------
  const scheduledDisplay: ScheduledRowDisplay[] = (scheduledRows ?? []).map((row) => ({
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
    isAdmin,
  }));

  // --- Schedule modal defaults --------------------------------------
  // Pre-fill the recipient with the most recent successful manual send
  // for this quote, so the user usually just hits Save. Falls back to
  // the customer's name with no email when there's been no manual send.
  let defaultRecipientEmail: string | null = null;
  let defaultRecipientName: string | null = quoteForSchedule?.customer_name ?? null;
  if (hasMessages) {
    const lastSuccessful = messages!.find((m) => m.status === 'sent') ?? messages![0];
    defaultRecipientEmail = lastSuccessful.recipient_email;
    defaultRecipientName = lastSuccessful.recipient_name ?? defaultRecipientName;
  }

  return (
    <div className="data-exclude-pdf bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900">Sent messages</h2>
          {repliedCount > 0 ? (
            <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {repliedCount} replied
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {hasTemplates && quoteForSchedule ? (
            <ScheduleFollowUpButton
              quoteId={quoteId}
              quote={{
                customer_name: quoteForSchedule.customer_name,
                accepted_at: quoteForSchedule.accepted_at,
                declined_at: quoteForSchedule.declined_at,
              }}
              defaultRecipientEmail={defaultRecipientEmail}
              defaultRecipientName={defaultRecipientName}
              emailTemplates={emailTemplates ?? []}
              hasPriorSend={hasMessages}
            />
          ) : null}
          {hasMessages ? (
            <DeleteAllMessagesButton quoteId={quoteId} messageCount={messages!.length} />
          ) : null}
        </div>
      </header>

      <ScheduledMessagesList rows={scheduledDisplay} />

      {hasMessages ? (
        <SentMessagesList messages={listItems} />
      ) : !hasScheduled ? (
        <p className="text-xs text-slate-500 italic">
          No messages sent yet. Use &ldquo;Schedule follow-up&rdquo; to plan an automatic message.
        </p>
      ) : null}
    </div>
  );
}
