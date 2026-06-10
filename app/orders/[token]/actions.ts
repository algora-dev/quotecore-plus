'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled, emailAlertEnabled } from '@/app/lib/alerts/prefs';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { notifyGenericAlert } from '@/app/lib/email/notify';
import { orderPreviewUrl } from '@/app/lib/email/urls';
import { activateOrderScheduledMessages } from '@/app/lib/messages/scheduled';

export interface SubmitOrderResponseInput {
  token: string;
  action: 'accept' | 'decline' | 'request_info';
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
  const ACTION_VALUES = ['accept', 'decline', 'request_info'] as const;
  if (!ACTION_VALUES.includes(input.action)) {
    return { ok: false, error: 'Invalid response option.' };
  }
  // Request Info requires a message; Accept/Decline can be bare.
  if (input.action === 'request_info' && !input.body) {
    return { ok: false, error: 'Please add a message describing what you need.' };
  }
  // Map the public action to the value stored in material_order_responses.
  const storedAction =
    input.action === 'accept' ? 'confirm' : input.action === 'decline' ? 'decline' : 'request_info';
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
      'id, company_id, order_number, to_supplier, acceptance_token_expires_at, confirmed_at, declined_at, info_requested_at',
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
    action: storedAction,
    body: input.body,
    ip,
    user_agent: hdrs.get('user-agent'),
  });
  if (insertError) {
    return { ok: false, error: 'Could not record your response. Please try again.' };
  }

  const now = new Date().toISOString();
  const orderUpdate: Record<string, string | null> = { last_supplier_response_at: now };
  // Stamp the lifecycle timestamp on the FIRST occurrence of each action.
  if (input.action === 'accept' && !order.confirmed_at) orderUpdate.confirmed_at = now;
  if (input.action === 'decline' && !order.declined_at) orderUpdate.declined_at = now;
  if (input.action === 'request_info' && !order.info_requested_at) orderUpdate.info_requested_at = now;

  await supabase.from('material_orders').update(orderUpdate).eq('id', order.id);

  // Activate / cancel parked ORDER follow-ups based on this response.
  // Best-effort: the supplier's response must never fail because of a
  // follow-up hiccup, so we swallow errors here.
  //   accept       -> activate order_accepted rules, cancel order_declined
  //   decline      -> activate order_declined rules, cancel order_accepted
  //   request_info -> cancel BOTH parked order trigger rules
  try {
    const followupEvent =
      input.action === 'accept'
        ? 'accepted'
        : input.action === 'decline'
          ? 'declined'
          : 'info_requested';
    await activateOrderScheduledMessages({
      orderId: order.id,
      companyId: order.company_id,
      event: followupEvent,
      eventAt: now,
    });
  } catch (err) {
    console.error('[submitOrderResponse] follow-up activation failed:', err);
  }

  // Fire the in-app alert. Always: every supplier response creates an
  // alert (unlike message_reply where only the first reply alerts).
  // Reasoning: the supplier responding twice is genuinely two events the
  // user wants to know about (e.g. "Confirmed" then "Actually I have a
  // question about delivery").
  const actionLabels: Record<typeof input.action, string> = {
    accept: 'Accepted',
    decline: 'Declined',
    request_info: 'Info Requested',
  };
  // Each supplier action now maps to a DISTINCT alert_type so users can
  // toggle them independently in the Message Center matrix. Old DB rows still
  // carry the superseded 'order_supplier_response' type and render fine via
  // the order_id / `startsWith('order')` routing + category logic.
  const alertTypeByAction: Record<typeof input.action, string> = {
    accept: 'order_accepted',
    decline: 'order_declined',
    request_info: 'order_info_requested',
  };
  const alertType = alertTypeByAction[input.action];
  const supplierLabel = order.to_supplier || 'Supplier';
  const alertTitle = `${actionLabels[input.action]} \u2013 ${supplierLabel}`;
  // Include the supplier's FULL message - the Message Center expanded view is
  // the only place the owner ever reads it, so truncating loses detail the
  // owner needs (e.g. exactly what info was requested). 2026-06-10.
  const alertBody = input.body
    ? `Order ${order.order_number}\n\n${input.body}`
    : `Order ${order.order_number}`;

  // Response row + lifecycle stamps above always happen; this alert is gated
  // by the Message Center notification matrix.
  if (await alertEnabled(supabase, order.company_id, alertType)) {
    await supabase.from('alerts').insert({
      company_id: order.company_id,
      alert_type: alertType,
      title: alertTitle,
      message: alertBody,
      order_id: order.id,
    });
  }

  // Best-effort alert email, gated independently by the company email pref.
  // The response row + lifecycle stamps above always happen regardless.
  if (await emailAlertEnabled(supabase, order.company_id, alertType)) {
    let ctaUrl: string | null = null;
    const { data: company } = await supabase
      .from('companies')
      .select('slug')
      .eq('id', order.company_id)
      .maybeSingle();
    if (company?.slug) ctaUrl = orderPreviewUrl(company.slug, order.id);
    await notifyGenericAlert({
      companyId: order.company_id,
      alertType,
      title: alertTitle,
      body: alertBody,
      ctaUrl,
      ctaLabel: 'View order',
    });
  }

  return { ok: true };
}
