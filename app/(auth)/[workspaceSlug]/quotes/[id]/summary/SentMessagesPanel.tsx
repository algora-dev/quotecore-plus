import { createSupabaseServerClient } from '@/app/lib/supabase/server';

interface Props {
  quoteId: string;
  companyId: string;
}

/**
 * Compact log of outbound Messages sent from the quote summary, rendered
 * as a server component so it picks up new sends on the next page render
 * without a separate client fetch.
 *
 * Renders nothing when the quote has no messages \u2014 keeps the summary
 * uncluttered for the common case where the user hasn't used Send from
 * QuoteCore+ yet.
 */
export async function SentMessagesPanel({ quoteId, companyId }: Props) {
  const supabase = await createSupabaseServerClient();

  // Load the most recent 10 messages for this quote. We rely on the
  // outbound_messages.select RLS policy to keep this scoped to the
  // caller's company (the page boundary above already enforces this via
  // requireCompanyContext; this is belt-and-braces).
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

  // Count messages with replies for the header badge.
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
          <li key={m.id} className="py-2.5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{m.subject}</p>
              <p className="text-xs text-slate-500 truncate">
                To {m.recipient_name ? `${m.recipient_name} <${m.recipient_email}>` : m.recipient_email}
                {' \u00b7 '}
                {new Date(m.sent_at ?? m.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <StatusPill status={m.status} replied={!!m.replied_at} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({ status, replied }: { status: string; replied: boolean }) {
  if (replied) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
        Replied
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
        Sent
      </span>
    );
  }
  if (status === 'suppressed') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
        Suppressed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 whitespace-nowrap">
        Failed
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
      {status}
    </span>
  );
}
