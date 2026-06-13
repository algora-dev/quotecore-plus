/**
 * Shared types for the scheduled-messages domain.
 *
 * Kept in a non-server file so client components can import them
 * without dragging the server action runtime into the bundle. The
 * actual action handlers live in `./scheduled.ts` with `'use server'`.
 */

export type ScheduledTriggerEvent =
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_declined'
  | 'quote_revision_requested'
  // "On Read" triggers: countdown anchored to the recipient OPENING the item
  // (viewed_at). Parked until viewed, fires after the wait, cancelled if the
  // recipient takes any action first. One per entity family.
  | 'quote_viewed'
  | 'order_viewed'
  | 'invoice_viewed'
  // Order follow-up triggers (Phase B). 'order_sent' is the time-based
  // chase anchor (mirrors 'quote_sent'); 'order_accepted' / 'order_declined'
  // are event triggers. Note: there is deliberately NO 'order_info_requested'
  // trigger - a supplier requesting info CANCELS all parked order follow-ups
  // rather than firing one.
  | 'order_sent'
  | 'order_accepted'
  | 'order_declined'
  // Invoice follow-up trigger (Phase C). Invoices are TIME-BASED ONLY:
  // 'invoice_sent' is the chase anchor (mirrors 'quote_sent' /
  // 'order_sent'). There are deliberately NO invoice event triggers -
  // when the recipient acts (payment_reported / paid / disputed) the
  // pending chase is CANCELLED at dispatch time rather than firing.
  | 'invoice_sent'
  | 'manual';

export type ScheduledStatus =
  | 'scheduled'
  | 'sent'
  | 'cancelled'
  | 'suppressed'
  | 'failed';

export interface ScheduleResultOk { ok: true; id: string; fireAt: string }
export interface ScheduleResultErr { ok: false; error: string }
export type ScheduleResult = ScheduleResultOk | ScheduleResultErr;

export interface CancelResultOk { ok: true }
export interface CancelResultErr { ok: false; error: string }
export type CancelResult = CancelResultOk | CancelResultErr;

export interface ScheduleOrderFollowUpInput {
  orderId: string;
  templateId: string;
  triggerEvent: ScheduledTriggerEvent;
  waitDays: number;
  waitHours?: number;
  /** Minute-level granularity; honoured (not floored away). */
  waitMinutes?: number;
  requireNoResponse: boolean;
  respectQuietHours: boolean;
  recipientEmail: string;
  recipientName?: string | null;
}

export interface ScheduleInvoiceFollowUpInput {
  invoiceId: string;
  templateId: string;
  /** Defaults to 'invoice_sent' (time-based chase). 'invoice_viewed' is the
   *  "On Read" event trigger - parked until the recipient opens the invoice,
   *  then fires after the wait, cancelled if they act first. */
  triggerEvent?: ScheduledTriggerEvent;
  /** Always the time-based chase anchor for invoices. */
  waitDays: number;
  waitHours?: number;
  /** Minute-level granularity; honoured (not floored away). */
  waitMinutes?: number;
  /** Always true for the invoice chase - it cancels once the recipient
   *  reports payment / pays / disputes. */
  requireNoResponse: boolean;
  respectQuietHours: boolean;
  recipientEmail: string;
  recipientName?: string | null;
}

export interface ScheduleQuoteFollowUpInput {
  quoteId: string;
  templateId: string;
  triggerEvent: ScheduledTriggerEvent;
  waitDays: number;
  waitHours?: number;
  /** Optional minute-level granularity on top of days/hours. Unlike
   *  days/hours this is NOT floored away to zero - minutes are honoured. */
  waitMinutes?: number;
  requireNoResponse: boolean;
  respectQuietHours: boolean;
  recipientEmail: string;
  recipientName?: string | null;
}

export interface DispatchSweepResult {
  scanned: number;
  sent: number;
  cancelled: number;
  failed: number;
  suppressed: number;
}

export interface ScheduledMessageRow {
  id: string;
  company_id: string;
  quote_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  template_id: string | null;
  trigger_event: ScheduledTriggerEvent;
  trigger_anchor_at: string;
  fire_at: string;
  require_no_response: boolean;
  respect_quiet_hours: boolean;
  recipient_email: string;
  recipient_name: string | null;
  status: ScheduledStatus;
  fired_at: string | null;
  cancelled_reason: string | null;
  failed_error: string | null;
  outbound_message_id: string | null;
  created_by_user_id: string;
  created_at: string;
}
