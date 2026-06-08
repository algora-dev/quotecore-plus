'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  is_read: boolean | null;
  created_at: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  order_id: string | null;
}

interface Props {
  initialAlerts: Alert[];
  workspaceSlug: string;
}

type FilterKey = 'all' | 'unread' | 'quotes' | 'orders' | 'invoices' | 'messages';

// Map an alert_type to a coarse category for the filter tabs.
function categoryOf(a: Alert): Exclude<FilterKey, 'all' | 'unread'> {
  const t = a.alert_type;
  if (t === 'message_reply') return 'messages';
  if (t.startsWith('invoice') || a.invoice_id) return 'invoices';
  if (t.startsWith('order') || a.order_id) return 'orders';
  return 'quotes';
}

const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  quotes: { label: 'Quote', cls: 'bg-orange-100 text-orange-700' },
  orders: { label: 'Order', cls: 'bg-blue-100 text-blue-700' },
  invoices: { label: 'Invoice', cls: 'bg-emerald-100 text-emerald-700' },
  messages: { label: 'Message', cls: 'bg-purple-100 text-purple-700' },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'orders', label: 'Orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'messages', label: 'Messages' },
];

export function InboxList({ initialAlerts, workspaceSlug }: Props) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: alerts.length,
      unread: alerts.filter((a) => !a.is_read).length,
      quotes: 0,
      orders: 0,
      invoices: 0,
      messages: 0,
    };
    for (const a of alerts) c[categoryOf(a)] += 1;
    return c;
  }, [alerts]);

  const visible = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'unread') return alerts.filter((a) => !a.is_read);
    return alerts.filter((a) => categoryOf(a) === filter);
  }, [alerts, filter]);

  function openHref(a: Alert): string | null {
    if (a.quote_id) return `/${workspaceSlug}/quotes/${a.quote_id}/summary`;
    if (a.invoice_id) return `/${workspaceSlug}/invoices/${a.invoice_id}`;
    if (a.order_id) return `/${workspaceSlug}/material-orders/${a.order_id}`;
    return null;
  }

  async function markRead(id: string) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    await fetch(`/api/alerts/${id}/read`, { method: 'POST' }).catch(() => {});
  }

  async function markAllRead() {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    await fetch('/api/alerts/read-all', { method: 'POST' }).catch(() => {});
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    const prev = alerts;
    setAlerts((p) => p.filter((a) => a.id !== id));
    const res = await fetch(`/api/alerts/${id}/delete`, { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) setAlerts(prev); // rollback on failure
    setBusyId(null);
  }

  async function open(a: Alert) {
    const href = openHref(a);
    if (!a.is_read) await markRead(a.id);
    if (href) router.push(href);
  }

  function fmt(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filter === f.key ? 'text-slate-300' : 'text-slate-400'}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
        {counts.unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="ml-auto text-xs text-orange-600 hover:text-orange-800"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Nothing here yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => {
            const cat = categoryOf(a);
            const badge = CATEGORY_BADGE[cat];
            const href = openHref(a);
            return (
              <li
                key={a.id}
                className={`rounded-xl border bg-white p-3 transition hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] ${
                  a.is_read ? 'border-slate-200' : 'border-orange-200 bg-orange-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!a.is_read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${a.is_read ? 'ml-5' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                    </div>
                    {a.message && (
                      <p className="text-xs text-slate-500 mt-1 whitespace-pre-line line-clamp-3">
                        {a.message}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{fmt(a.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {href && (
                      <button
                        type="button"
                        onClick={() => open(a)}
                        className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:shadow-[0_0_8px_rgba(255,107,53,0.4)]"
                      >
                        Open
                      </button>
                    )}
                    {!a.is_read && (
                      <button
                        type="button"
                        onClick={() => markRead(a.id)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Mark done
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={busyId === a.id}
                      className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
