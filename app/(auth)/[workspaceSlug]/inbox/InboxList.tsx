'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateNotificationPref, updateChannelMaster } from './settings-actions';
import type { EventPref, PrefSurface } from '@/app/lib/alerts/prefs';

type NotificationChannelKey = 'quotes' | 'orders' | 'invoices';

/**
 * The notification matrix - the REAL alert_type taxonomy in the codebase.
 * Orders splits supplier responses into distinct events (accepted / declined /
 * info requested) plus Read, and Invoices surfaces Payment Made / Dispute
 * Opened / Read, so the matrix renders only these real events.
 */
const NOTIFICATION_MATRIX: {
  key: NotificationChannelKey;
  label: string;
  events: { key: string; label: string }[];
}[] = [
  {
    key: 'quotes',
    label: 'Quotes',
    events: [
      { key: 'quote_accepted', label: 'Accepted' },
      { key: 'quote_declined', label: 'Declined' },
      { key: 'revision_requested', label: 'Request Info' },
      { key: 'quote_viewed', label: 'Viewed' },
      { key: 'quote_expired', label: 'Expired' },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    events: [
      { key: 'order_accepted', label: 'Accepted' },
      { key: 'order_declined', label: 'Declined' },
      { key: 'order_info_requested', label: 'Info Requested' },
      { key: 'order_viewed', label: 'Viewed' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    events: [
      { key: 'invoice_payment_reported', label: 'Payment Made' },
      { key: 'invoice_disputed', label: 'Dispute Opened' },
      { key: 'invoice_viewed', label: 'Viewed' },
    ],
  },
];

/**
 * Shared toggle switch - the exact rounded-full w-11 h-6 accent pattern used
 * throughout the app. `color` selects the ON tint: orange for the in-app
 * surface, blue for the email surface. Reused for every matrix row + master.
 */
function Toggle({
  checked,
  disabled,
  onChange,
  label,
  color = 'orange',
  size = 'md',
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  color?: 'orange' | 'blue';
  /** `md` (default) is the full-size master toggle (w-11 h-6). `sm` is the
   *  ~30%-smaller per-line toggle (w-8 h-[18px]) used on per-event rows. */
  size?: 'sm' | 'md';
}) {
  const onClass = color === 'blue' ? 'bg-blue-500' : 'bg-[#FF6B35]';
  const isSm = size === 'sm';
  // Track + knob sizing. `md`: w-11 h-6 track, w-4 knob, travel translate-x-6.
  // `sm`: ~30% smaller track w-8 h-[18px], w-3.5 knob, travel translate-x-[14px].
  const trackClass = isSm ? 'h-[18px] w-8' : 'h-6 w-11';
  const knobSizeClass = isSm ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const knobOnClass = isSm ? 'translate-x-[14px]' : 'translate-x-6';
  const knobOffClass = isSm ? 'translate-x-0.5' : 'translate-x-1';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex ${trackClass} flex-shrink-0 items-center rounded-full transition ${
        checked ? onClass : 'bg-slate-300'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <span
        className={`inline-block ${knobSizeClass} transform rounded-full bg-white transition ${
          checked ? knobOnClass : knobOffClass
        }`}
      />
    </button>
  );
}

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
  /** Resolved notification matrix: { "<alert_type>": { app, email } } for every
   *  known event. `app` gates the in-app alert, `email` gates the alert email. */
  initialNotificationPrefs: Record<string, EventPref>;
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

export function InboxList({ initialAlerts, workspaceSlug, initialNotificationPrefs }: Props) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [view, setView] = useState<'inbox' | 'settings'>('inbox');
  const [prefs, setPrefs] = useState<Record<string, EventPref>>(initialNotificationPrefs);
  const [savingPref, setSavingPref] = useState(false);
  const [folder, setFolder] = useState<AlertStatus>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    // `?from=inbox` tells the destination page to point its "Back" breadcrumb
    // at the Message Center instead of the entity's main list page.
    if (a.quote_id) return `/${workspaceSlug}/quotes/${a.quote_id}/summary?from=inbox`;
    if (a.invoice_id) return `/${workspaceSlug}/invoices/${a.invoice_id}?from=inbox`;
    if (a.order_id) return `/${workspaceSlug}/material-orders/${a.order_id}/preview?from=inbox`;
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

  function eventOn(eventKey: string, surface: PrefSurface): boolean {
    const p = prefs[eventKey];
    if (!p) return surface === 'app'; // app defaults ON, email handled by resolver
    return p[surface];
  }

  // A surface master is ON if ANY child in the channel has that surface on.
  // Toggling sets every child's that-surface to the opposite of the master.
  function channelMasterOn(channelKey: NotificationChannelKey, surface: PrefSurface): boolean {
    const ch = NOTIFICATION_MATRIX.find((c) => c.key === channelKey);
    if (!ch) return false;
    return ch.events.some((e) => eventOn(e.key, surface));
  }

  async function toggleEvent(eventKey: string, surface: PrefSurface) {
    const next = !eventOn(eventKey, surface);
    const prev = prefs;
    setPrefs((p) => ({
      ...p,
      [eventKey]: { ...p[eventKey], [surface]: next },
    })); // optimistic
    setSavingPref(true);
    const res = await updateNotificationPref(eventKey, surface, next).catch(() => null);
    if (!res || !res.ok) setPrefs(prev); // rollback
    setSavingPref(false);
  }

  async function toggleMaster(channelKey: NotificationChannelKey, surface: PrefSurface) {
    const ch = NOTIFICATION_MATRIX.find((c) => c.key === channelKey);
    if (!ch) return;
    const next = !channelMasterOn(channelKey, surface); // bulk-set all children
    const prev = prefs;
    setPrefs((p) => {
      const copy = { ...p };
      for (const e of ch.events) copy[e.key] = { ...copy[e.key], [surface]: next };
      return copy;
    });
    setSavingPref(true);
    const res = await updateChannelMaster(channelKey, surface, next).catch(() => null);
    if (!res || !res.ok) setPrefs(prev); // rollback
    setSavingPref(false);
  }

  return (
    <div className="space-y-4">
      {/* Top tabs: Inbox / Settings (rounded-full pill tabs). */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
        <button
          type="button"
          onClick={() => setView('inbox')}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
            view === 'inbox' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Inbox
        </button>
        <button
          type="button"
          onClick={() => setView('settings')}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
            view === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Settings
        </button>
      </div>

      {view === 'settings' ? (
        <div className="space-y-4 max-w-2xl">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <p className="text-xs text-slate-500 mt-1">
              Email + in-app alerts are configured per event below. The{' '}
              <span className="font-medium text-[#FF6B35]">In-app</span> column
              controls the Message Center alert; the{' '}
              <span className="font-medium text-blue-500">Email</span> column
              controls whether your team is emailed too. The underlying status
              (Read, Accepted, Disputed…) always updates either way - these
              toggles only control notifications.
            </p>
          </div>

          {NOTIFICATION_MATRIX.map((channel) => {
            const appMasterOn = channelMasterOn(channel.key, 'app');
            const emailMasterOn = channelMasterOn(channel.key, 'email');
            return (
              <div
                key={channel.key}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* Channel header row + per-surface MASTER toggles + column labels */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">All {channel.label} alerts</p>
                  </div>
                  <div className="flex items-end gap-4 md:gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-[#FF6B35]">In-app</span>
                      <Toggle
                        color="orange"
                        checked={appMasterOn}
                        disabled={savingPref}
                        onChange={() => toggleMaster(channel.key, 'app')}
                        label={`All ${channel.label} in-app alerts`}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-blue-500">Email</span>
                      <Toggle
                        color="blue"
                        checked={emailMasterOn}
                        disabled={savingPref}
                        onChange={() => toggleMaster(channel.key, 'email')}
                        label={`All ${channel.label} emails`}
                      />
                    </div>
                  </div>
                </div>

                {/* Per-event child rows: two toggles each (in-app + email). */}
                <div className="divide-y divide-slate-100">
                  {channel.events.map((event) => {
                    const appOn = eventOn(event.key, 'app');
                    const emailOn = eventOn(event.key, 'email');
                    return (
                      <div
                        key={event.key}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-orange-50/40 transition"
                      >
                        <p className="text-sm text-slate-700">{event.label}</p>
                        <div className="flex items-center gap-4 md:gap-6">
                          <Toggle
                            size="sm"
                            color="orange"
                            checked={appOn}
                            disabled={savingPref}
                            onChange={() => toggleEvent(event.key, 'app')}
                            label={`${channel.label} – ${event.label} – in-app`}
                          />
                          <Toggle
                            size="sm"
                            color="blue"
                            checked={emailOn}
                            disabled={savingPref}
                            onChange={() => toggleEvent(event.key, 'email')}
                            label={`${channel.label} – ${event.label} – email`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
    <div className="flex flex-col md:flex-row gap-4 md:gap-5">
      {/* LEFT PANEL - folders */}
      <aside className="w-full md:w-44 flex-shrink-0">
        {/* The guide highlight targets this <nav> (only the 3 folder buttons),
            not the <aside> - the aside stretches to the full list height. */}
        <nav className="flex md:flex-col gap-1 md:space-y-1 self-start overflow-x-auto md:overflow-visible -mx-2 md:mx-0 px-0 md:px-0 pb-2 md:pb-0" data-assistant-id="inbox-folders" data-copilot="inbox-folders">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFolder(f.key);
                setSelected(new Set());
              }}
              data-assistant-id={`inbox-folder-${f.key}`}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 md:py-2 text-sm font-medium transition whitespace-nowrap md:whitespace-normal min-h-[44px] md:min-h-0 ${
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

      {/* RIGHT - search/filter bar + list */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Search + type filters (these are filters, not navigation) */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2 md:flex-wrap" data-assistant-id="inbox-search" data-copilot="inbox-search">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-base md:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 md:mx-0 md:px-0 md:flex-wrap">
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
        </div>

        {/* Bulk action toolbar - appears when rows are selected */}
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
              const isOpen = expanded.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`rounded-xl border-2 bg-white transition hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] ${
                    a.is_read
                      ? 'border-slate-300'
                      : 'border-orange-300 bg-orange-50/40'
                  }`}
                >
                  {/* Collapsed row - single line. Clicking the body expands
                      in place; we no longer navigate on row click, so a
                      missing/broken link can never 404. */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 flex-shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        toggleExpand(a.id);
                        if (!a.is_read) bulk('read', [a.id]);
                      }}
                      className="flex flex-1 min-w-0 flex-wrap items-center gap-2 text-left md:flex-nowrap"
                      aria-expanded={isOpen}
                    >
                      {!a.is_read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                      <span className="text-sm font-medium text-slate-900 truncate min-w-0 flex-1">{a.title}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0 md:ml-auto">{fmt(a.created_at)}</span>
                      <svg
                        className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded view - full message + contextual actions.
                      Open only renders when openHref resolves (has FK). */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-3 py-3 pl-10">
                      {a.message ? (
                        <p className="text-sm text-slate-600 whitespace-pre-line">{a.message}</p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No additional details.</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mt-3">
                        {href && (
                          <button type="button" onClick={() => open(a)} title="Click to open the full summary page" className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:shadow-[0_0_8px_rgba(255,107,53,0.4)]">
                            Open {badge.label.toLowerCase()}
                          </button>
                        )}
                        {/* Folder-contextual actions. Link-less alerts simply
                            omit To-Do/Done flow and offer Dismiss. */}
                        {folder === 'active' && (
                          href ? (
                            <>
                              <button type="button" onClick={() => bulk('todo', [a.id])} title='Click to add this alert to your "To Do" list' className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-white">To-Do</button>
                              <button type="button" onClick={() => bulk('archive', [a.id])} title='Click to mark this alert "Done" and add to archive list' className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-white hover:text-emerald-600">Done</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => bulk('archive', [a.id])} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-white">Dismiss</button>
                          )
                        )}
                        {folder === 'todo' && (
                          <>
                            <button type="button" onClick={() => bulk('active', [a.id])} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-white">Move to Active</button>
                            <button type="button" onClick={() => bulk('archive', [a.id])} title='Click to mark this alert "Done" and add to archive list' className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-white hover:text-emerald-600">Done</button>
                          </>
                        )}
                        {folder === 'archived' && (
                          <>
                            <button type="button" onClick={() => bulk('active', [a.id])} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-white">Restore</button>
                            <button type="button" onClick={() => bulk('delete', [a.id])} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-red-600 hover:bg-white">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
