'use client';

import { useId } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { categoryOf, CATEGORY_BADGE, type Alert, type AlertStatus } from './message-center-model';

type RowAction = 'read' | 'unread' | 'todo' | 'active' | 'archive' | 'delete';

/** One event, not a fabricated conversation. Expansion and navigation remain separate. */
export function MessageCenterRow({ alert: a, folder, busy, selected, expanded, date, href,
  onSelect, onExpand, onOpen, onAction }: {
  alert: Alert; folder: AlertStatus; busy: boolean; selected: boolean; expanded: boolean;
  date: string; href: string | null; onSelect: () => void; onExpand: () => void;
  onOpen: () => void; onAction: (action: RowAction) => void;
}) {
  const detailsId = useId();
  const category = categoryOf(a);
  const badge = CATEGORY_BADGE[category];
  // Match the existing link resolver's priority, not the event badge. A message
  // reply may link to a job or invoice; it does not open a new chat experience.
  const targetLabel = a.quote_id ? 'Open Job Space' : a.invoice_id ? 'Open invoice'
    : a.order_id ? 'Open order' : 'Open Pricing Library';

  return <li className="qc-message-row" data-unread={!a.is_read || undefined}
    data-selected={selected || undefined} data-expanded={expanded || undefined}>
    <div className="qc-message-row-top">
      <label className="qc-message-select">
        <input type="checkbox" className="qc-checkbox" checked={selected} disabled={busy}
          onChange={onSelect} aria-label={`Select ${a.title}`} />
      </label>
      <button type="button" className="qc-message-open" onClick={onExpand}
        aria-expanded={expanded} aria-controls={detailsId}>
        <span className="qc-message-meta">
          <span className="qc-message-category" data-category={category}>{badge.label}</span>
          {!a.is_read && <span className="qc-message-unread"><span aria-hidden="true" />Unread</span>}
          {date && <time dateTime={a.created_at ?? undefined}>{date}</time>}
        </span>
        <span className="qc-message-title">{a.title}</span>
        {!expanded && a.message && <span className="qc-message-row-preview">{a.message}</span>}
        <QcIcon name="chevron" className="qc-message-disclosure" />
      </button>
    </div>
    <div id={detailsId} hidden={!expanded} className="qc-message-details">
      <p className="qc-message-body">{a.message || 'No additional details.'}</p>
      <div className="qc-message-actions">
        {href && <QcButton variant="primary" size="sm" onClick={onOpen}>{targetLabel}<QcIcon name="arrow" /></QcButton>}
        {folder === 'active' && (href ? <>
          <QcButton size="sm" disabled={busy} onClick={() => onAction('todo')}>Add to To-do</QcButton>
          <QcButton size="sm" disabled={busy} onClick={() => onAction('archive')}>Done · Archive</QcButton>
        </> : <QcButton size="sm" disabled={busy} onClick={() => onAction('archive')}>Dismiss</QcButton>)}
        {folder === 'todo' && <>
          <QcButton size="sm" disabled={busy} onClick={() => onAction('active')}>Move to Active</QcButton>
          <QcButton size="sm" disabled={busy} onClick={() => onAction('archive')}>Done · Archive</QcButton>
        </>}
        {folder === 'archived' && <>
          <QcButton size="sm" disabled={busy} onClick={() => onAction('active')}>Restore</QcButton>
          <QcButton size="sm" variant="danger" disabled={busy} onClick={() => onAction('delete')}>Delete</QcButton>
        </>}
        <QcButton size="sm" disabled={busy} onClick={() => onAction(a.is_read ? 'unread' : 'read')}>
          {a.is_read ? 'Mark unread' : 'Mark read'}
        </QcButton>
      </div>
    </div>
  </li>;
}
