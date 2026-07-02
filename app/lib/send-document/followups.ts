'use server';

/**
 * Unified follow-up scheduler dispatcher.
 *
 * Routes to the existing scheduleQuoteFollowUp / scheduleOrderFollowUp /
 * scheduleInvoiceFollowUp functions based on entity kind. Server-side
 * trigger allowlist is defence-in-depth (the client config also constrains it).
 */

import { scheduleQuoteFollowUp } from '@/app/lib/messages/scheduled';
import { scheduleOrderFollowUp } from '@/app/lib/messages/scheduled';
import { scheduleInvoiceFollowUp } from '@/app/lib/messages/scheduled';
import type { ScheduledTriggerEvent } from '@/app/lib/messages/scheduled-types';
import type { EntityKind } from './types';

interface ScheduleInput {
  entityId: string;
  templateId: string;
  triggerEvent: string;
  waitDays: number;
  waitHours: number;
  waitMinutes: number;
  requireNoResponse: boolean;
  respectQuietHours: boolean;
  recipientEmail: string;
  recipientName: string | null;
}

export type ScheduleResult =
  | { ok: true; fireAt: string }
  | { ok: false; error: string };

// Per-kind trigger allowlists (defence-in-depth — client also constrains).
const TRIGGER_ALLOWLIST: Record<EntityKind, Set<string>> = {
  quote: new Set(['quote_accepted', 'quote_declined', 'quote_revision_requested', 'quote_viewed', 'quote_sent']),
  order: new Set(['order_accepted', 'order_declined', 'order_viewed', 'order_sent']),
  invoice: new Set(['invoice_sent', 'invoice_viewed']),
};

export async function scheduleDocumentFollowUp(
  entityKind: EntityKind,
  input: ScheduleInput,
): Promise<ScheduleResult> {
  const allowed = TRIGGER_ALLOWLIST[entityKind];
  if (!allowed || !allowed.has(input.triggerEvent)) {
    return { ok: false, error: `Trigger '${input.triggerEvent}' is not valid for ${entityKind}.` };
  }

  switch (entityKind) {
    case 'quote':
      return scheduleQuoteFollowUp({
        quoteId: input.entityId,
        templateId: input.templateId,
        triggerEvent: input.triggerEvent as ScheduledTriggerEvent,
        waitDays: input.waitDays,
        waitHours: input.waitHours,
        waitMinutes: input.waitMinutes,
        requireNoResponse: input.requireNoResponse,
        respectQuietHours: input.respectQuietHours,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
      });
    case 'order':
      return scheduleOrderFollowUp({
        orderId: input.entityId,
        templateId: input.templateId,
        triggerEvent: input.triggerEvent as ScheduledTriggerEvent,
        waitDays: input.waitDays,
        waitHours: input.waitHours,
        waitMinutes: input.waitMinutes,
        requireNoResponse: input.requireNoResponse,
        respectQuietHours: input.respectQuietHours,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
      });
    case 'invoice':
      return scheduleInvoiceFollowUp({
        invoiceId: input.entityId,
        templateId: input.templateId,
        triggerEvent: input.triggerEvent as ScheduledTriggerEvent,
        waitDays: input.waitDays,
        waitHours: input.waitHours,
        waitMinutes: input.waitMinutes,
        requireNoResponse: input.requireNoResponse,
        respectQuietHours: input.respectQuietHours,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
      });
  }
}
