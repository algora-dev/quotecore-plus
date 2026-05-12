import Link from 'next/link';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ status?: string; priority?: string }>;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
] as const;

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
};

/**
 * Support tickets list for admin triage. Reads with the service-role
 * client (admin gate already enforced upstream) so we see every
 * company's tickets in one place.
 *
 * Filters via query params:
 *   /admin/support-tickets?status=open
 *   /admin/support-tickets?priority=urgent
 *
 * Detail view is a follow-up; for now this is the triage list.
 */
export default async function SupportTicketsPage({ searchParams }: Props) {
  const { status, priority } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from('support_tickets')
    .select('id, subject, category, priority, status, created_at, updated_at, company_id, user_id')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);

  const { data: tickets, error } = await query;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Support tickets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Latest 200 across every company. Filter by status or priority via the query
            string.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {STATUS_FILTERS.map((f) => {
            const active = (status ?? 'all') === f.value;
            const href =
              f.value === 'all'
                ? '/admin/support-tickets'
                : `/admin/support-tickets?status=${f.value}`;
            return (
              <Link
                key={f.value}
                href={href}
                className={[
                  'px-3 py-1.5 rounded-full border',
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                ].join(' ')}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Could not load tickets: {error.message}
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {(tickets ?? []).length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No tickets match this filter.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Subject</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-4 py-2">Priority</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(tickets ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {/* Detail page is a follow-up; for now we render the row
                        but the link points at a placeholder. */}
                    <span className="font-medium text-slate-900">{t.subject}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        PRIORITY_TONE[t.priority] ?? 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_TONE[t.status] ?? 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Showing {(tickets ?? []).length} ticket{(tickets ?? []).length === 1 ? '' : 's'}.
        Detail/reply view is a follow-up; this list is the triage entry point.
      </p>
    </div>
  );
}
