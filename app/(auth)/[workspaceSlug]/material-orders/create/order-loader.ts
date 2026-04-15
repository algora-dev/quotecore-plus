'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { MaterialOrderRow, MaterialOrderLineRow } from '@/app/lib/types';

export interface ExistingOrderData {
  order: MaterialOrderRow;
  lines: MaterialOrderLineRow[];
}

export async function loadOrderForEdit(orderId: string): Promise<ExistingOrderData | null> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Load order
  const { data: order, error: orderError } = await supabase
    .from('material_orders')
    .select('*')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .single();
  
  if (orderError || !order) {
    console.error('[loadOrderForEdit] Order not found:', orderError);
    return null;
  }
  
  // Load line items
  const { data: lines, error: linesError } = await supabase
    .from('material_order_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });
  
  if (linesError) {
    console.error('[loadOrderForEdit] Lines error:', linesError);
    return { order, lines: [] };
  }
  
  return {
    order,
    lines: lines || [],
  };
}
