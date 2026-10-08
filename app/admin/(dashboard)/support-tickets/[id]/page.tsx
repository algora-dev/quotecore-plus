import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { parseSupportMessages } from './support-messages';
import TicketDetailPanel from './TicketDetailPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-slate-100 text-slate-700',
  low: 'bg-slate-50 text-slate-500',
};

const STATUS_TONE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Admin support-ticket detail: full ticket body, who it came from,
 * message thread, reply box and status/priority controls.
 * Service-role read (admin gate already enforced upstream).
 */
export default async function SupportTicketDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select(
      'id, subject, body, category, priority, status, created_at, updated_at, resolved_at, page_context, user_agent, app_version, email_forwarded_at, email_forward_error, user_id, company_id, messages',
    )
    .eq('id', id)
    .maybeSingle();

  if (!ticket) notFound();

  const [{ data: user }, { data: company }] = await Promise.all([
    supabase.from('users').select('email, full_name').eq('id', ticket.user_id).maybeSingle(),
    supabase.from('companies').select('name').eq('id', ticket.company_id).maybeSingle(),
  ]);

  const companyName = company?.name ?? null;
  const messages = parseSupportMessages(ticket.messages);

  const meta: Array<[string, ReactNode]> = [
    [
      'From',
      user ? (
        <span key="from">
          <span className="text-slate-900">{user.full_name || '(no name)'}</span>{' '}
          <span className="text-slate-500">&lt;{user.email}&gt;</span>
        </span>
      ) : (
        <span key="from" className="text-slate-500">unknown user</span>
      ),
    ],
    ['Company', companyName ?? <span key="co" className="text-slate-400">(no company)</span>],
    ['Category', <span key="cat" className="capitalize text-slate-900">{ticket.category}</span>],
    ['Opened', formatDateTime(ticket.created_at)],
    ['Updated', formatDateTime(ticket.updated_at)],
    ticket.page_context
      ? ['Page', <code key="ctx" className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700">{ticket.page_context}</code>]
      : null,
    ticket.app_version ? ['App version', <span key="av" className="text-slate-600">{ticket.app_version}</span>] : null,
    ticket.email_forward_error
      ? ['Email forward', <span key="ef" className="text-rose-700">failed: {ticket.email_forward_error}</span>]
      : ticket.email_forwarded_at
        ? ['Email forward', <span key="ef" className="text-emerald-700">sent {formatDateTime(ticket.email_forwarded_at)}</span>]
        : null,
  ].filter(Boolean) as Array<[string, React.ReactNode]>;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/support-tickets"
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Support tickets
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <h1 className="text-2xl font-semibold text-slate-900">{ticket.subject}</h1>
          <div className="flex items-center gap-2">
            <span className={['inline-block px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_TONE[ticket.priority] ?? 'bg-slate-100 text-slate-700'].join(' ')}>
              {ticket.priority}
            </span>
            <span className={['inline-block px-2 py-0.5 rounded-full text-xs font-medium', STATUS_TONE[ticket.status] ?? 'bg-slate-100 text-slate-700'].join(' ')}>
              {ticket.status}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1 font-mono">ticket {ticket.id}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {meta.map(([label, value]) => (
            <div key={label} className="flex gap-3 min-w-0">
              <dt className="text-slate-500 shrink-0 w-28">{label}</dt>
              <dd className="text-slate-900 min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">Original message</h2>
        <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{ticket.body}</p>
      </div>

      {messages.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Thread ({messages.length})</h2>
          {messages.map((m, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs text-slate-400">
                {m.role === 'admin' ? `QuoteCore+ Support${m.author ? ` · ${m.author}` : ''}` : 'User'} · {formatDateTime(m.at)}
              </p>
              <div
                className={[
                  'rounded-xl px-4 py-3 text-sm whitespace-pre-wrap break-words',
                  m.role === 'admin'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-900',
                ].join(' ')}
              >
                {m.body}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <TicketDetailPanel ticketId={ticket.id} status={ticket.status} priority={ticket.priority} />
    </div>
  );
}
