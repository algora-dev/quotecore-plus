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

export interface ScheduleQuoteFollowUpInput {
  quoteId: string;
  templateId: string;
  triggerEvent: ScheduledTriggerEvent;
  waitDays: number;
  waitHours?: number;
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
