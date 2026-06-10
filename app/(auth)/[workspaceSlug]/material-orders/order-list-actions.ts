'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { MaterialOrderRow } from '@/app/lib/types';

export async function loadRecentOrders(): Promise<MaterialOrderRow[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('material_orders')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('[loadRecentOrders] Error:', error);
    return [];
  }
  
  return data || [];
}

export async function markOrderAsOrdered(orderId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('material_orders')
    .update({ status: 'ordered' })
    .eq('id', orderId)
    .eq('company_id', profile.company_id);
  
  if (error) {
    throw new Error('Failed to update order status');
  }
}

export async function updateOrderStatus(orderId: string, status: string) {
  const validStatuses = ['ready', 'ordered', 'delivered', 'paid', 'pickup', 'waiting'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('material_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error('Failed to update order status');
}

/**
 * Reset an order back to its pre-send state ("start fresh").
 *
 * Mirrors the quote Withdraw/Reopen flow: voids the current public link
 * (clears acceptance_token so the old supplier URL stops resolving and the
 * next Send mints a brand-new token), clears every recipient/action stamp
 * (viewed / confirmed / declined / changes-requested / info-requested), rolls
 * status back to the 'ready' baseline, and cancels any still-pending scheduled
 * follow-ups so a stale chase can't fire against the reset order.
 *
 * Use case: remedy a change/info request or just re-issue — then re-send a
 * fresh order with a new URL. Returns the count of cancelled follow-ups so the
 * confirm UI can report exactly what happened.
 */
export async function resetOrder(
  orderId: string,
): Promise<{ ok: true; cancelledFollowUps: number } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: order, error: loadErr } = await supabase
    .from('material_orders')
    .select('id, company_id, order_number')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .single();

  if (loadErr || !order) return { ok: false, error: 'Order not found.' };

  const { error: updateErr } = await supabase
    .from('material_orders')
    .update({
      acceptance_token: null,
      acceptance_token_expires_at: null,
      viewed_at: null,
      confirmed_at: null,
      declined_at: null,
      changes_requested_at: null,
      info_requested_at: null,
      last_supplier_response_at: null,
      status: 'ready',
    } as Record<string, unknown>)
    .eq('id', orderId)
    .eq('company_id', profile.company_id);

  if (updateErr) return { ok: false, error: `Failed to reset order: ${updateErr.message}` };

  // Cancel any still-pending follow-ups so they don't fire against the reset.
  const { count: cancelledFollowUps } = await supabase
    .from('scheduled_messages')
    .update(
      { status: 'cancelled', cancelled_reason: 'Order was reset.' } as Record<string, unknown>,
      { count: 'exact' },
    )
    .eq('order_id', orderId)
    .eq('company_id', profile.company_id)
    .eq('status', 'scheduled');

  // Best-effort audit alert.
  try {
    await supabase.from('alerts').insert({
      company_id: profile.company_id,
      order_id: orderId,
      alert_type: 'order_reset',
      title: `Order ${order.order_number ?? '?'} reset`,
      message: 'Link voided and status reset; ready for a fresh send.',
    });
  } catch {
    /* ignore audit failure */
  }

  revalidatePath(`/[workspaceSlug]/material-orders/${orderId}/preview`);
  revalidatePath(`/[workspaceSlug]/material-orders`);
  return { ok: true, cancelledFollowUps: cancelledFollowUps ?? 0 };
}

export async function deleteOrder(orderId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Verify ownership
  const { data: order } = await supabase
    .from('material_orders')
    .select('id')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .single();
  
  if (!order) {
    throw new Error('Order not found or unauthorized');
  }
  
  // Delete line items first (foreign key)
  await supabase
    .from('material_order_lines')
    .delete()
    .eq('order_id', orderId);
  
  // Delete order
  const { error } = await supabase
    .from('material_orders')
    .delete()
    .eq('id', orderId);
  
  if (error) {
    console.error('[deleteOrder] Error:', error);
    throw new Error('Failed to delete order');
  }
}
