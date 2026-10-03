import type { EventPref } from '@/app/lib/alerts/prefs';

// Presentation taxonomy only. Alert eligibility and routing stay in InboxList.
export type NotificationChannelKey = 'quotes' | 'orders' | 'invoices' | 'suppliers';

/**
 * The notification matrix - the REAL alert_type taxonomy in the codebase.
 * Orders splits supplier responses into distinct events (accepted / declined /
 * info requested) plus Read, and Invoices surfaces Payment Made / Dispute
 * Opened / Read, so the matrix renders only these real events.
 */
export const NOTIFICATION_MATRIX: {
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
  {
    key: 'suppliers',
    label: 'Suppliers',
    events: [
      { key: 'supplier_update', label: 'Component Updates' },
    ],
  },
];

export type AlertStatus = 'active' | 'todo' | 'archived';

export interface Alert {
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

export interface Props {
  initialAlerts: Alert[];
  workspaceSlug: string;
  /** Resolved notification matrix: { "<alert_type>": { app, email } } for every
   *  known event. `app` gates the in-app alert, `email` gates the alert email. */
  initialNotificationPrefs: Record<string, EventPref>;
}

export type TypeFilter = 'all' | 'quotes' | 'orders' | 'invoices' | 'messages' | 'suppliers';

export function categoryOf(a: Alert): Exclude<TypeFilter, 'all'> {
  const t = a.alert_type;
  if (t === 'message_reply') return 'messages';
  if (t.startsWith('supplier')) return 'suppliers';
  if (t.startsWith('invoice') || a.invoice_id) return 'invoices';
  if (t.startsWith('order') || a.order_id) return 'orders';
  return 'quotes';
}

export const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  quotes: { label: 'Quote', cls: 'bg-orange-100 text-orange-700' },
  orders: { label: 'Order', cls: 'bg-blue-100 text-blue-700' },
  invoices: { label: 'Invoice', cls: 'bg-emerald-100 text-emerald-700' },
  messages: { label: 'Message', cls: 'bg-purple-100 text-purple-700' },
  suppliers: { label: 'Supplier', cls: 'bg-amber-100 text-amber-700' },
};

export const FOLDERS: { key: AlertStatus; label: string; icon: string }[] = [
  { key: 'active', label: 'Active', icon: 'M4 6h16M4 12h16M4 18h7' },
  { key: 'todo', label: 'To-do', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { key: 'archived', label: 'Archived', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
];

export const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'orders', label: 'Orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'messages', label: 'Messages' },
  { key: 'suppliers', label: 'Suppliers' },
];
