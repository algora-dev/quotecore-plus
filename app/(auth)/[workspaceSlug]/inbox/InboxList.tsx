'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcLibrary, QcLibraryEmpty } from '@/app/components/ui/v2/QcLibrary';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { useQcActionNotice } from '@/app/components/ui/v2/QcActionNotice';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { resolveInboxOutcome } from './inbox-outcomes';
import { updateNotificationPref, updateChannelMaster } from './settings-actions';
import type { EventPref, PrefSurface } from '@/app/lib/alerts/prefs';
import { NOTIFICATION_MATRIX, FOLDERS, TYPE_FILTERS, categoryOf,
  type Alert, type AlertStatus, type NotificationChannelKey, type Props, type TypeFilter } from './message-center-model';
import { MessageCenterPreferences } from './MessageCenterPreferences';
import { MessageCenterRow } from './MessageCenterRow';
import './message-center.css';

export function InboxList({ initialAlerts, workspaceSlug, initialNotificationPrefs }: Props) {
  const router = useRouter();
  const { showNotice, notice } = useQcActionNotice();
  const { ask, feedback } = useQcFeedback();
  const mutationBusy = useRef(false);
  const preferenceBusy = useRef(false);
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
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current !== view) {
      if (view === 'settings') settingsHeading.current?.focus({ preventScroll: true });
      else settingsTrigger.current?.focus({ preventScroll: true });
      previousView.current = view;
    }
  }, [view]);


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
    if (a.alert_type === 'supplier_update') return `/${workspaceSlug}/components?from=inbox`;
    return null;
  }

  // Optimistic changes remain local. Restore only unsuccessful rows and keep
  // those selected; no polling or router.refresh can remount another workspace.
  async function bulk(action: 'read' | 'unread' | 'todo' | 'active' | 'archive' | 'delete', ids: string[], quiet = false) {
    if (ids.length === 0 || mutationBusy.current) return;
    mutationBusy.current = true;
    setBusy(true);
    const requested = Array.from(new Set(ids));
    const previous = alerts;
    const apply = (list: Alert[], affected: Set<string>): Alert[] => {
      if (action === 'delete') return list.filter(a => !affected.has(a.id));
      return list.map(a => {
        if (!affected.has(a.id)) return a;
        if (action === 'read' || action === 'unread') return { ...a, is_read: action === 'read' };
        return { ...a, status: (action === 'archive' ? 'archived' : action) as AlertStatus };
      });
    };
    try {
      if (action === 'delete' && !await ask({
        title: 'Delete selected messages?',
        description: `${requested.length} message${requested.length === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`,
        confirmLabel: 'Delete messages', cancelLabel: 'Keep messages', destructive: true,
      })) return;
      setAlerts(apply(previous, new Set(requested)));
      const res = await fetch('/api/alerts/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: requested, action }),
      });
      if (!res.ok) throw new Error('The update could not be confirmed.');
      const { updatedIds, failedIds } = resolveInboxOutcome(await res.json(), requested);
      setAlerts(apply(previous, new Set(updatedIds)));
      setSelected(current => {
        const next = new Set(current);
        updatedIds.forEach(id => next.delete(id));
        if (!quiet) failedIds.forEach(id => next.add(id));
        return next;
      });
      if (failedIds.length || !quiet) {
        showNotice({
          tone: failedIds.length ? (updatedIds.length ? 'warning' : 'danger') : 'success',
          title: failedIds.length ? `${updatedIds.length} of ${requested.length} messages updated` : 'Messages updated',
          description: failedIds.length
            ? (quiet ? 'The message update was not confirmed. Check the details before trying again.' : 'Messages without a confirmed update remain selected. Check the details before trying again.')
            : `${updatedIds.length} message${updatedIds.length === 1 ? '' : 's'} ${action === 'delete' ? 'deleted' : action === 'read' ? 'marked as read' : action === 'unread' ? 'marked as unread' : action === 'archive' ? 'archived' : action === 'todo' ? 'moved to To-Do' : 'moved to Active'}.`,
          details: failedIds.map(id => `${previous.find(a => a.id === id)?.title ?? id}: no update confirmed. The record may no longer be available.`),
          focus: !quiet,
        });
      }
    } catch {
      setAlerts(previous);
      if (!quiet) setSelected(current => new Set([...current, ...requested]));
      showNotice({ tone: 'danger', title: 'Message update not confirmed',
        description: 'Your previous view has been restored. The server may have received the request. Refresh this page to check before trying again.',
        focus: !quiet });
    } finally {
      mutationBusy.current = false;
      setBusy(false);
    }
  }

  async function open(a: Alert) {
    const href = openHref(a);
    if (!a.is_read) void bulk('read', [a.id], true);
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
    if (preferenceBusy.current) return;
    preferenceBusy.current = true;
    const next = !eventOn(eventKey, surface);
    const prev = prefs;
    setPrefs((p) => ({
      ...p,
      [eventKey]: { ...p[eventKey], [surface]: next },
    })); // optimistic
    setSavingPref(true);
    const res = await updateNotificationPref(eventKey, surface, next).catch(() => null);
    if (!res || !res.ok) {
      setPrefs(prev);
      showNotice({ tone: 'danger', title: 'Notification setting not saved',
        description: 'The previous setting has been restored. Try again when your connection is available.', focus: true });
    }
    preferenceBusy.current = false;
    setSavingPref(false);
  }

  async function toggleMaster(channelKey: NotificationChannelKey, surface: PrefSurface) {
    if (preferenceBusy.current) return;
    const ch = NOTIFICATION_MATRIX.find((c) => c.key === channelKey);
    if (!ch) return;
    preferenceBusy.current = true;
    const next = !channelMasterOn(channelKey, surface); // bulk-set all children
    const prev = prefs;
    setPrefs((p) => {
      const copy = { ...p };
      for (const e of ch.events) copy[e.key] = { ...copy[e.key], [surface]: next };
      return copy;
    });
    setSavingPref(true);
    const res = await updateChannelMaster(channelKey, surface, next).catch(() => null);
    if (!res || !res.ok) {
      setPrefs(prev);
      showNotice({ tone: 'danger', title: 'Notification setting not saved',
        description: 'The previous setting has been restored. Try again when your connection is available.', focus: true });
    }
    preferenceBusy.current = false;
    setSavingPref(false);
  }

  const unreadInFolder = alerts.filter(a => a.status === folder && !a.is_read).length;
  const folderLabel = FOLDERS.find(f => f.key === folder)?.label ?? 'Active';

  return (
    <QcLibrary className="qc-message-center">
      {feedback}
      {notice}
      <div className="qc-messages-navigation">
        {view === 'inbox' ? <>
          <nav aria-label="Message folders" className="qc-messages-folders" data-assistant-id="inbox-folders" data-copilot="inbox-folders">
            {FOLDERS.map(f => <button key={f.key} type="button"
              aria-current={folder === f.key ? 'page' : undefined}
              data-assistant-id={`inbox-folder-${f.key}`}
              onClick={() => { setFolder(f.key); setSelected(new Set()); }}>
              <span>{f.label}</span><span className="qc-messages-count">{folderCounts[f.key]}</span>
            </button>)}
          </nav>
          <QcButton ref={settingsTrigger} className="qc-messages-settings" size="sm" onClick={() => setView('settings')} aria-label="Open notification settings">
            <svg className="qc-messages-settings-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round">
              <path d="M4 7h4m4 0h8M4 17h10m4 0h2" /><circle cx="10" cy="7" r="2" /><circle cx="16" cy="17" r="2" />
            </svg><span className="qc-messages-settings-label">Notification settings</span>
          </QcButton>
        </> : <QcButton onClick={() => setView('inbox')}><QcIcon name="back" />Back to messages</QcButton>}
      </div>

      {view === 'settings' ? <MessageCenterPreferences headingRef={settingsHeading} prefs={prefs} saving={savingPref}
        eventOn={eventOn} masterOn={channelMasterOn} onToggleEvent={toggleEvent} onToggleMaster={toggleMaster} /> : <>
        <div className="qc-messages-search" data-assistant-id="inbox-search" data-copilot="inbox-search">
          <label className="qc-messages-search-field">
            <span className="qc-label">Search messages</span>
            <QcInput type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a job, document or message" />
          </label>
          <label className="qc-messages-type-field">
            <span className="qc-label">Type</span>
            <QcSelect value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}>
              {TYPE_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </QcSelect>
          </label>
        </div>
        <div className="qc-messages-list-summary">
          <div className="qc-messages-summary-copy">
            <strong>{folderLabel}</strong><span>{visible.length} {visible.length === 1 ? 'message' : 'messages'}{unreadInFolder ? ` · ${unreadInFolder} unread in this folder` : ''}</span>
          </div>
          {visible.length > 0 && <label className="qc-messages-select-all">
            <input type="checkbox" className="qc-checkbox" checked={allVisibleSelected} disabled={busy} onChange={toggleAll} />Select all in view
          </label>}
        </div>
        {selected.size > 0 && <div className="qc-messages-selection" data-assistant-id="inbox-bulk-bar" aria-label="Selected message actions">
          <div className="qc-messages-selection-count"><strong>{selInVisible.length} selected in this view</strong>
            {selected.size > selInVisible.length && <span>{selected.size - selInVisible.length} selected outside this view; these actions do not affect them.</span>}
          </div>
          <div className="qc-messages-bulk-actions">
            <QcButton size="sm" disabled={busy || !selInVisible.length} onClick={() => bulk('read', selInVisible)}>Mark read</QcButton>
            {folder !== 'todo' && <QcButton size="sm" disabled={busy || !selInVisible.length} onClick={() => bulk('todo', selInVisible)}>To-do</QcButton>}
            {folder !== 'active' && <QcButton size="sm" disabled={busy || !selInVisible.length} onClick={() => bulk('active', selInVisible)}>Move to Active</QcButton>}
            {folder !== 'archived'
              ? <QcButton size="sm" disabled={busy || !selInVisible.length} onClick={() => bulk('archive', selInVisible)}>Done · Archive</QcButton>
              : <QcButton size="sm" variant="danger" disabled={busy || !selInVisible.length} onClick={() => bulk('delete', selInVisible)}>Delete permanently</QcButton>}
            <QcButton size="sm" disabled={busy} onClick={() => setSelected(new Set())}>Clear selection</QcButton>
          </div>
        </div>}
        {busy && <p role="status" className="qc-messages-pending">Updating messages…</p>}
        {visible.length === 0 ? <QcLibraryEmpty
          title={search.trim() || typeFilter !== 'all' ? 'No matching messages' : `Nothing in ${folderLabel} yet`}
          action={search.trim() || typeFilter !== 'all' ? <QcButton onClick={() => { setSearch(''); setTypeFilter('all'); }}>Clear filters</QcButton> : undefined}>
          {search.trim() || typeFilter !== 'all' ? 'Try another search or show all message types.'
            : folder === 'todo' ? 'Move an active message to To-do when you want to follow it up.'
              : folder === 'archived' ? 'Messages marked Done or dismissed appear here. You can restore them later.'
                : 'Replies and updates will appear here as activity happens on your quotes, orders and invoices.'}
        </QcLibraryEmpty> : <ul className="qc-messages-list" aria-label={`${folderLabel} messages`}>
          {visible.map(a => <MessageCenterRow key={a.id} alert={a} folder={folder} busy={busy}
            selected={selected.has(a.id)} expanded={expanded.has(a.id)} date={fmt(a.created_at)} href={openHref(a)}
            onSelect={() => toggle(a.id)} onExpand={() => { toggleExpand(a.id); if (!a.is_read) void bulk('read', [a.id], true); }}
            onOpen={() => open(a)} onAction={action => bulk(action, [a.id])} />)}
        </ul>}
        {initialAlerts.length >= 1000 && <p className="qc-messages-limit">This view loads the latest 1,000 messages. Counts and search apply to those messages.</p>}
      </>}
    </QcLibrary>
  );
}
