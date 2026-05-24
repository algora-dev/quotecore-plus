'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import { sendOutboundMessage } from '@/app/lib/messages/send';
import { generateOrderSupplierToken } from './supplier-link-actions';
import {
  assertCanSendMessage,
  requireFeature,
  FeatureGatedError,
  SubscriptionInactiveError,
  FEATURE_LABELS,
} from '@/app/lib/billing/entitlements';

export interface SendOrderMessageInput {
  orderId: string;
  templateId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
}

export type SendOrderMessageResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed' }
  | { ok: false; error: string };

/**
 * Send a material order to a supplier via the Messages pipeline.
 * Mirrors `sendQuoteMessage` but with order-specific merge context.
 */
export async function sendOrderMessage(
  input: SendOrderMessageInput,
): Promise<SendOrderMessageResult> {
  const profile = await requireCompanyContext();

  // Two entitlements required to send a supplier order through the
  // pipeline: the user must have material_orders to operate this surface
  // at all, AND email_send to dispatch a real email through Resend.
  // Without email_send they can still generate the supplier link via
  // the order page and copy it manually - that path doesn't go through
  // this action.
  try {
    await requireFeature(profile.company_id, 'material_orders');
    await assertCanSendMessage(profile.company_id, 'manual');
  } catch (gateErr) {
    if (gateErr instanceof FeatureGatedError) {
      return {
        ok: false,
        error: `${FEATURE_LABELS[gateErr.feature]} isn't included in your current plan. Upgrade to use this feature.`,
      };
    }
    if (gateErr instanceof SubscriptionInactiveError) {
      return {
        ok: false,
        error: 'Your subscription is not active. Reactivate to send orders.',
      };
    }
    throw gateErr;
  }

  const supabase = await createSupabaseServerClient();

  const { data: order, error: orderErr } = await supabase
    .from('material_orders')
    .select(
      'id, order_number, reference, to_supplier, from_company, contact_details, acceptance_token',
    )
    .eq('id', input.orderId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (orderErr || !order) {
    return { ok: false, error: 'Order not found.' };
  }

  // Make sure a supplier token exists so the pipeline can resolve the
  // "View order" CTA + the {{order_link}} merge variable.
  // generateOrderSupplierToken is idempotent when a live token already
  // exists, so this is safe to call every time.
  let acceptanceToken: string | null = order.acceptance_token ?? null;
  if (!acceptanceToken) {
    try {
      acceptanceToken = await generateOrderSupplierToken(order.id);
    } catch (err) {
      console.error('[sendOrderMessage] supplier-token issue:', err);
    }
  }

  // Item count for the {{order_total_items}} merge variable.
  const { count: itemCount } = await supabase
    .from('material_order_lines')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id);

  // Company branding for the email shell. Orders don't carry per-row CQ
  // branding overrides like quotes do, so we pull from companies.
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', profile.company_id)
    .maybeSingle();

  const companyName = order.from_company || company?.name || 'QuoteCore+ user';

  const recipient = input.recipientEmail.trim();
  if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
    return { ok: false, error: 'Please enter a valid recipient email.' };
  }

  const result = await sendOutboundMessage({
    companyId: profile.company_id,
    senderUserId: profile.id,
    kind: 'order_send',
    relatedOrderId: order.id,
    templateId: input.templateId,
    subject: input.subject,
    body: input.body,
    recipientEmail: recipient,
    recipientName: input.recipientName ?? order.to_supplier ?? null,
    mergeContext: {
      company_name: companyName,
      sender_name: profile.full_name ?? undefined,
      today: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      order_number: order.order_number,
      order_reference: order.reference ?? undefined,
      order_supplier: order.to_supplier ?? undefined,
      order_total_items: itemCount != null ? String(itemCount) : undefined,
      // {{order_link}} is substituted by the pipeline using acceptanceToken
      // so the text reference and the primary CTA URL stay consistent.
    },
    companyName,
    companyLogoUrl: null,
    companyEmail: profile.email ?? null,
    companyPhone: null,
    acceptanceToken,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(
    `/[workspaceSlug]/material-orders/${input.orderId}/preview`,
  );
  return { ok: true, messageId: result.messageId, status: result.status };
}

export async function loadOrderTemplatesForSend(): Promise<
  Array<{ id: string; name: string; subject: string; body: string; is_default: boolean | null }>
> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  // For Phase 1 we surface all the user's templates regardless of kind so
  // they can pick a freeform "custom" template for orders if they want.
  // Phase 2 will filter by kind in [order_send, custom].
  const { data } = await supabase
    .from('email_templates')
    .select('id, name, subject, body, is_default')
    .eq('company_id', profile.company_id)
    .order('name');
  return data ?? [];
}
