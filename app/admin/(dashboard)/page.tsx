import Link from 'next/link';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard landing. Shows a few high-signal counters so the
 * operator gets an at-a-glance view of what needs attention.
 *
 * Uses the service-role client because the admin shell already enforced
 * `requireAdmin()` upstream; we want full visibility across all
 * companies' rows, not RLS-bound to one.
 */
export default async function AdminHome() {
  const supabase = createAdminClient();

  const [openTickets, urgentTickets, totalCompanies, totalUsers] = await Promise.all([
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'resolved'),
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
  ]);

  const stats: { label: string; value: number | null; href?: string; tone: 'default' | 'warn' }[] = [
    {
      label: 'Open support tickets',
      value: openTickets.count ?? 0,
      href: '/admin/support-tickets',
      tone: (openTickets.count ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Urgent + open',
      value: urgentTickets.count ?? 0,
      href: '/admin/support-tickets?priority=urgent',
      tone: (urgentTickets.count ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Companies',
      value: totalCompanies.count ?? 0,
      tone: 'default',
    },
    {
      label: 'Users',
      value: totalUsers.count ?? 0,
      tone: 'default',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          QuoteCore+ internal operations. Support triage, account actions, and
          system health.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const card = (
            <div
              className={[
                'rounded-xl border p-4',
                s.tone === 'warn'
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{s.value ?? '—'}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:scale-[1.01] transition">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Coming soon</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Per-user impersonation and password reset</li>
          <li>Company storage usage and quota override</li>
          <li>Audit trail across account actions</li>
        </ul>
      </section>
    </div>
  );
}
