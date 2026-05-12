'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export interface SubmitOrderResponseInput {
  token: string;
  action: 'confirm' | 'request_changes' | 'question';
  body: string | null;
}

export type SubmitOrderResponseResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Public server action for supplier responses on `/orders/[token]`.
 *
 * - Trust model: token in the URL is the only access gate. Service-role
 *   client because the supplier is anonymous and the target tables
 *   (alerts, material_orders, material_order_responses) are RLS-scoped.
 * - Rate limit: 10 submissions per order per hour. Modest because the
 *   form allows follow-up messages after the first response.
 * - Status timestamps: on the FIRST response only, we set
 *   `confirmed_at` / `changes_requested_at` so the order's lifecycle
 *   stays clean. Subsequent responses only update
 *   `last_supplier_response_at` (and append a row to
 *   material_order_responses).
 * - Alert: one per first response. Mirrors the message_reply pattern.
 */
export async function submitOrderResponse(
  input: SubmitOrderResponseInput,
): Promise<SubmitOrderResponseResult> {
  if (!input.token || input.token.length < 16) {
    return { ok: false, error: 'This link is no longer valid.' };
  }
  const ACTION_VALUES = ['confirm', 'request_changes', 'question'] as const;
  if (!ACTION_VALUES.includes(input.action)) {
    return { ok: false, error: 'Invalid response option.' };
  }
  if (input.body !== null && (input.body.length < 1 || input.body.length > 8000)) {
    return { ok: false, error: 'Message must be between 1 and 8000 characters.' };
  }

  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const ipAllowed = await checkRateLimit(`order-respond-ip:${ip}`, 30, 60 * 60 * 1000);
  if (!ipAllowed) {
    return { ok: false, error: 'Too many requests. Please wait a moment and try again.' };
  }

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from('material_orders')
    .select(
      'id, company_id, order_number, to_supplier, acceptance_token_expires_at, confirmed_at, changes_requested_at',
    )
    .eq('acceptance_token', input.token)
    .maybeSingle();

  if (!order) return { ok: false, error: 'This link is no longer valid.' };
  if (order.acceptance_token_expires_at && new Date(order.acceptance_token_expires_at) < new Date()) {
    return { ok: false, error: 'This link has expired.' };
  }

  const orderAllowed = await checkRateLimit(`order-respond-order:${order.id}`, 10, 60 * 60 * 1000);
  if (!orderAllowed) {
    return { ok: false, error: 'Too many responses. Please wait a moment and try again.' };
  }

  // Insert the response row.
  const { error: insertError } = await supabase.from('material_order_responses').insert({
    order_id: order.id,
    company_id: order.company_id,
    action: input.action,
    body: input.body,
    ip,
    user_agent: hdrs.get('user-agent'),
  });
  if (insertError) {
    return { ok: false, error: 'Could not record your response. Please try again.' };
  }

  const now = new Date().toISOString();
  const isFirstConfirm = input.action === 'confirm' && !order.confirmed_at;
  const isFirstChangeRequest = input.action === 'request_changes' && !order.changes_requested_at;

  const orderUpdate: Record<string, string | null> = { last_supplier_response_at: now };
  if (isFirstConfirm) orderUpdate.confirmed_at = now;
  if (isFirstChangeRequest) orderUpdate.changes_requested_at = now;

  await supabase.from('material_orders').update(orderUpdate).eq('id', order.id);

  // Fire the in-app alert. Always: every supplier response creates an
  // alert (unlike message_reply where only the first reply alerts).
  // Reasoning: the supplier responding twice is genuinely two events the
  // user wants to know about (e.g. "Confirmed" then "Actually I have a
  // question about delivery").
  const actionLabels: Record<typeof input.action, string> = {
    confirm: 'Confirmed',
    request_changes: 'Requested changes',
    question: 'Asked a question',
  };
  const supplierLabel = order.to_supplier || 'Supplier';
  const alertTitle = `${actionLabels[input.action]} \u2013 ${supplierLabel}`;
  const alertBody = input.body
    ? `Order ${order.order_number}\n\n${input.body.slice(0, 280)}${input.body.length > 280 ? '\u2026' : ''}`
    : `Order ${order.order_number}`;

  await supabase.from('alerts').insert({
    company_id: order.company_id,
    alert_type: 'order_supplier_response',
    title: alertTitle,
    message: alertBody,
  });

  return { ok: true };
}
