'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AlertStatus = 'active' | 'todo' | 'archived';

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  is_read: boolean | null;
  status: AlertStatus;
  created_at: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  order_id: string | null;
}

interface Props {
  initialAlerts: Alert[];
  workspaceSlug: string;
}

type TypeFilter = 'all' | 'quotes' | 'orders' | 'invoices' | 'messages';

function categoryOf(a: Alert): Exclude<TypeFilter, 'all'> {
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

const FOLDERS: { key: AlertStatus; label: string; icon: string }[] = [
  { key: 'active', label: 'Active', icon: 'M4 6h16M4 12h16M4 18h7' },
  { key: 'todo', label: 'To-Do', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { key: 'archived', label: 'Archived', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
];

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'orders', label: 'Orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'messages', label: 'Messages' },
];

export function InboxList({ initialAlerts, workspaceSlug }: Props) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [folder, setFolder] = useState<AlertStatus>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const folderCounts = useMemo(() => {
    const c: Record<AlertStatus, number> = { active: 0, todo: 0, archived: 0 };
    for (const a of alerts) c[a.status] += 1;
    return c;
  }, [alerts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (a.status !== folder) return false;
      if (typeFilter !== 'all' && categoryOf(a) !== typeFilter) return false;
      if (q) {
        const hay = `${a.title} ${a.message ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, folder, typeFilter, search]);

  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (visible.every((a) => prev.has(a.id))) {
        const next = new Set(prev);
        visible.forEach((a) => next.delete(a.id));
        return next;
      }
      const next = new Set(prev);
      visible.forEach((a) => next.add(a.id));
      return next;
    });
  }

  function openHref(a: Alert): string | null {
    if (a.quote_id) return `/${workspaceSlug}/quotes/${a.quote_id}/summary`;
    if (a.invoice_id) return `/${workspaceSlug}/invoices/${a.invoice_id}`;
    if (a.order_id) return `/${workspaceSlug}/material-orders/${a.order_id}`;
    return null;
  }

  // Apply a bulk action to a set of ids, with optimistic local update.
  async function bulk(action: 'read' | 'unread' | 'todo' | 'active' | 'archive' | 'delete', ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const prev = alerts;
    setAlerts((list) => {
      if (action === 'delete') return list.filter((a) => !ids.includes(a.id));
      return list.map((a) => {
        if (!ids.includes(a.id)) return a;
        if (action === 'read') return { ...a, is_read: true };
        if (action === 'unread') return { ...a, is_read: false };
        if (action === 'archive') return { ...a, status: 'archived' as AlertStatus };
        if (action === 'todo') return { ...a, status: 'todo' as AlertStatus };
        if (action === 'active') return { ...a, status: 'active' as AlertStatus };
        return a;
      });
    });
    setSelected(new Set());
    const res = await fetch('/api/alerts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    }).catch(() => null);
    if (!res || !res.ok) setAlerts(prev); // rollback
    setBusy(false);
  }

  async function open(a: Alert) {
    const href = openHref(a);
    if (!a.is_read) bulk('read', [a.id]);
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

  const sel = Array.from(selected);
  const selInVisible = sel.filter((id) => visible.some((a) => a.id === id));

  return (
    <div className="flex gap-5">
      {/* LEFT PANEL — folders */}
      <aside className="w-44 flex-shrink-0" data-assistant-id="inbox-folders" data-copilot="inbox-folders">
        <nav className="space-y-1">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFolder(f.key);
                setSelected(new Set());
              }}
              data-assistant-id={`inbox-folder-${f.key}`}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition ${
                folder === f.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
                {f.label}
              </span>
              <span className={folder === f.key ? 'text-slate-300' : 'text-slate-400'}>
                {folderCounts[f.key]}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* RIGHT — search/filter bar + list */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Search + type filters (these are filters, not navigation) */}
        <div className="flex items-center gap-2 flex-wrap" data-assistant-id="inbox-search" data-copilot="inbox-search">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                typeFilter === f.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bulk action toolbar — appears when rows are selected */}
        {selInVisible.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2 text-xs" data-assistant-id="inbox-bulk-bar">
            <span className="font-medium text-slate-700">{selInVisible.length} selected</span>
            <span className="h-4 w-px bg-orange-200" />
            <button disabled={busy} onClick={() => bulk('read', selInVisible)} className="rounded-full px-2.5 py-1 text-slate-600 hover:bg-white">Mark read</button>
            {folder !== 'todo' && (
              <button disabled={busy} onClick={() => bulk('todo', selInVisible)} className="rounded-full px-2.5 py-1 text-slate-600 hover:bg-white">To-Do</button>
            )}
            {folder !== 'active' && (
              <button disabled={busy} onClick={() => bulk('active', selInVisible)} className="rounded-full px-2.5 py-1 text-slate-600 hover:bg-white">Move to Active</button>
            )}
            {folder !== 'archived' ? (
              <button disabled={busy} onClick={() => bulk('archive', selInVisible)} className="rounded-full px-2.5 py-1 text-slate-600 hover:bg-white">Done (Archive)</button>
            ) : (
              <button disabled={busy} onClick={() => bulk('delete', selInVisible)} className="rounded-full px-2.5 py-1 font-medium text-red-600 hover:bg-white">Delete permanently</button>
            )}
          </div>
        )}

        {/* Select-all row */}
        {visible.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500 px-1">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
            Select all
          </label>
        )}

        {/* Rows */}
        {visible.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            Nothing in {FOLDERS.find((f) => f.key === folder)?.label}.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => {
              const cat = categoryOf(a);
              const badge = CATEGORY_BADGE[cat];
              const href = openHref(a);
              const checked = selected.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`rounded-xl border bg-white p-3 transition hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] ${
                    a.is_read ? 'border-slate-200' : 'border-orange-200 bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                      className="mt-1 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!a.is_read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                        <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                      </div>
                      {a.message && (
                        <p className="text-xs text-slate-500 mt-1 whitespace-pre-line line-clamp-3">{a.message}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{fmt(a.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {href && (
                        <button type="button" onClick={() => open(a)} className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:shadow-[0_0_8px_rgba(255,107,53,0.4)]">
                          Open
                        </button>
                      )}
                      {/* Per-row quick actions, contextual to the folder */}
                      {folder === 'active' && (
                        <>
                          {!a.is_read && (
                            <button type="button" onClick={() => bulk('read', [a.id])} className="text-xs text-slate-500 hover:text-slate-700">Read</button>
                          )}
                          <button type="button" onClick={() => bulk('todo', [a.id])} className="text-xs text-slate-500 hover:text-slate-700">To-Do</button>
                          <button type="button" onClick={() => bulk('archive', [a.id])} className="text-xs text-slate-400 hover:text-emerald-600">Done</button>
                        </>
                      )}
                      {folder === 'todo' && (
                        <>
                          <button type="button" onClick={() => bulk('active', [a.id])} className="text-xs text-slate-500 hover:text-slate-700">Active</button>
                          <button type="button" onClick={() => bulk('archive', [a.id])} className="text-xs text-slate-400 hover:text-emerald-600">Done</button>
                        </>
                      )}
                      {folder === 'archived' && (
                        <>
                          <button type="button" onClick={() => bulk('active', [a.id])} className="text-xs text-slate-500 hover:text-slate-700">Restore</button>
                          <button type="button" onClick={() => bulk('delete', [a.id])} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
