'use server';

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
    console.error('[markOrderAsOrdered] Error:', error);
    throw new Error('Failed to update order status');
  }
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
