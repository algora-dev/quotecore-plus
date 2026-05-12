import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { SentMessageRow, type SentMessageReply, type MessageReplyAction } from './SentMessageRow';

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
 * Renders nothing when the quote has no messages.
 */
export async function SentMessagesPanel({ quoteId, companyId }: Props) {
  const supabase = await createSupabaseServerClient();

  const { data: messages } = await supabase
    .from('outbound_messages')
    .select(
      'id, subject, recipient_email, recipient_name, status, sent_at, replied_at, created_at',
    )
    .eq('related_quote_id', quoteId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!messages || messages.length === 0) {
    return null;
  }

  const messageIds = messages.map((m) => m.id);
  const { data: replyRows } = await supabase
    .from('outbound_message_replies')
    .select('id, message_id, action, body, created_at')
    .in('message_id', messageIds)
    .order('created_at', { ascending: true });

  // Group replies by message_id so the row component can render them
  // in chronological order without doing its own grouping.
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

  const repliedCount = messages.filter((m) => m.replied_at).length;

  return (
    <div className="data-exclude-pdf bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <header className="flex items-center justify-between">
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
      </header>

      <ul className="divide-y divide-slate-100">
        {messages.map((m) => (
          <SentMessageRow
            key={m.id}
            id={m.id}
            subject={m.subject}
            recipientEmail={m.recipient_email}
            recipientName={m.recipient_name}
            status={m.status}
            sentAt={m.sent_at}
            createdAt={m.created_at}
            repliedAt={m.replied_at}
            replies={repliesByMessage.get(m.id) ?? []}
          />
        ))}
      </ul>
    </div>
  );
}
