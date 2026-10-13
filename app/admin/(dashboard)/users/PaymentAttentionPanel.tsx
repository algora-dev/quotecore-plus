import Link from 'next/link';
import type { PaymentAttentionRow } from './actions';

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}
function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : 'None';
}
function active(row: PaymentAttentionRow): boolean {
  const failure = Date.parse(row.firstFailedAt);
  return (row.lastMeteredActivityAt ? Date.parse(row.lastMeteredActivityAt) >= failure : false)
    || (row.lastSignInAt ? Date.parse(row.lastSignInAt) >= failure : false)
    || row.storageTouchedAfterFailure;
}

export function PaymentAttentionPanel({ rows, error }: { rows: PaymentAttentionRow[]; error?: string | null }) {
  if (error) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Payment attention could not be loaded: {error}</div>;
  }
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-200">
        <h2 className="text-base font-semibold text-amber-950">Payment attention · {rows.length}</h2>
        <p className="text-xs text-amber-800 mt-1">Failed custom subscription payments. Usage shown here is observational; it does not change the amount Stripe retries.</p>
      </div>
      <div className="divide-y divide-amber-200">
        {rows.map(row => {
          const stillActive = active(row);
          return (
            <div key={row.attentionId} className="p-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1.4fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{row.companyName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stillActive ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {stillActive ? 'Activity after failure' : 'No observed activity'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{row.email ?? 'No account email'} · failed {ageDays(row.firstFailedAt)}d ago · attempts {row.failureCount}</p>
              </div>
              <div className="text-xs text-slate-700">
                <div>Quote units: {row.usageAfterFailure.quotes}</div>
                <div>Scan tokens: {row.usageAfterFailure.scanTokens}</div>
                <div>Assistant tasks: {row.usageAfterFailure.assistantTasks}</div>
              </div>
              <div className="text-xs text-slate-600">
                <div>Last metered activity: {fmt(row.lastMeteredActivityAt)}</div>
                <div>Last sign-in: {fmt(row.lastSignInAt)}</div>
                <div>7-day reminder: {row.noticeSentAt ? `sent ${fmt(row.noticeSentAt)}` : `due ${fmt(row.noticeDueAt)}`}</div>
              </div>
              <div className="flex gap-2">
                {row.userId && <Link href={`/admin/users/${row.userId}`} className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">Open user</Link>}
                {row.stripeCustomerId && <a href={`https://dashboard.stripe.com/${row.stripeMode === 'test' ? 'test/' : ''}customers/${row.stripeCustomerId}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Customer ↗</a>}
                <a href={`https://dashboard.stripe.com/${row.stripeMode === 'test' ? 'test/' : ''}invoices/${row.invoiceId}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Invoice ↗</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
