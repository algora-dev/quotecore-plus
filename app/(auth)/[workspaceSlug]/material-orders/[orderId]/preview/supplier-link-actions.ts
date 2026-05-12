'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';

/**
 * Generate (or reuse) a supplier link for a material order.
 *
 * Behavioural parity with `generateAcceptanceToken` on quotes:
 *  - If a live token already exists, return it (idempotent for the
 *    "Supplier Link" pill that copies the URL on every click).
 *  - Otherwise mint a new UUID, clamp the expiry to 1\u2013365 days, and
 *    persist on the order row.
 *
 * The public page at `/orders/[token]` looks the token up directly; no
 * HMAC wrapper. The token is high-entropy (UUID v4 \u2248 122 bits) so URL
 * scanning isn't a credible attack vector at our volumes. If we ever
 * need rotation we add a separate token-revocation column.
 */
export async function generateOrderSupplierToken(
  orderId: string,
  expiryDays: number = 90,
): Promise<string> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: order, error } = await supabase
    .from('material_orders')
    .select('id, acceptance_token, acceptance_token_expires_at')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (error || !order) throw new Error('Order not found');

  // Reuse the existing token only when there's a live one. We don't
  // check confirmation status because a supplier may still need to view
  // the order URL after confirming (they might lose the email).
  if (
    order.acceptance_token &&
    (!order.acceptance_token_expires_at ||
      new Date(order.acceptance_token_expires_at) > new Date())
  ) {
    return order.acceptance_token;
  }

  const days = Math.max(1, Math.min(365, expiryDays));
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error: updateError } = await supabase
    .from('material_orders')
    .update({
      acceptance_token: token,
      acceptance_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', orderId)
    .eq('company_id', profile.company_id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/[workspaceSlug]/material-orders/${orderId}/preview`);
  return token;
}
