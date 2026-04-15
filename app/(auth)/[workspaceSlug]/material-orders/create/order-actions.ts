'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface SaveOrderInput {
  // Optional: edit existing order
  orderId?: string;
  
  // Header data
  templateId?: string;
  reference: string;
  toSupplier: string;
  fromCompany: string;
  contactPerson?: string;
  contactDetails?: string;
  orderType?: string;
  colours?: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  orderNotes?: string;
  logoUrl?: string;
  orderDate: string;
  layoutMode: 'single' | 'double';
  
  // Line items
  lineItems: {
    componentName: string;
    flashingId?: string;
    flashingImageUrl?: string;
    entryMode: 'single' | 'multiple';
    quantity?: number;
    unit?: string;
    lengths?: Array<{
      length: number;
      multiplier: number;
      variables?: Array<{
        name: string;
        value: number;
        unit: string;
      }>;
    }>;
    lengthUnit?: string;
    notes?: string;
    showComponentName: boolean;
    showFlashingImage: boolean;
    showMeasurements: boolean;
    sortOrder: number;
  }[];
}

export async function saveDraftOrder(input: SaveOrderInput) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  try {
    let order;
    
    if (input.orderId) {
      // UPDATE existing order
      const { data: existingOrder, error: fetchError } = await supabase
        .from('material_orders')
        .select('id, order_number')
        .eq('id', input.orderId)
        .eq('company_id', profile.company_id)
        .single();
      
      if (fetchError || !existingOrder) {
        throw new Error('Order not found or unauthorized');
      }
      
      const { data: updatedOrder, error: updateError } = await supabase
        .from('material_orders')
        .update({
          template_id: input.templateId || null,
          reference: input.reference || 'Untitled Order',
          to_supplier: input.toSupplier,
          from_company: input.fromCompany,
          contact_person: input.contactPerson || null,
          contact_details: input.contactDetails || null,
          order_type: input.orderType || null,
          colours: input.colours || null,
          delivery_date: input.deliveryDate ? new Date(input.deliveryDate) : null,
          delivery_address: input.deliveryAddress || null,
          header_notes: input.orderNotes || null,
          logo_url: input.logoUrl || null,
          order_date: input.orderDate ? new Date(input.orderDate) : null,
          layout_mode: input.layoutMode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.orderId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[saveDraftOrder] Order update error:', updateError);
        throw new Error('Failed to update order');
      }
      
      order = updatedOrder;
      
      // Delete old line items
      await supabase
        .from('material_order_lines')
        .delete()
        .eq('order_id', input.orderId);
      
    } else {
      // CREATE new order
      const orderNumber = `ORD-${Date.now()}`;
      
      const { data: newOrder, error: orderError } = await supabase
        .from('material_orders')
        .insert({
          company_id: profile.company_id,
          template_id: input.templateId || null,
          order_number: orderNumber,
          reference: input.reference || 'Untitled Order',
          to_supplier: input.toSupplier,
          from_company: input.fromCompany,
          contact_person: input.contactPerson || null,
          contact_details: input.contactDetails || null,
          order_type: input.orderType || null,
          colours: input.colours || null,
          delivery_date: input.deliveryDate ? new Date(input.deliveryDate) : null,
          delivery_address: input.deliveryAddress || null,
          header_notes: input.orderNotes || null,
          logo_url: input.logoUrl || null,
          order_date: input.orderDate ? new Date(input.orderDate) : null,
          layout_mode: input.layoutMode,
          status: 'draft',
        })
        .select()
        .single();
      
      if (orderError) {
        console.error('[saveDraftOrder] Order insert error:', orderError);
        throw new Error('Failed to save order');
      }
      
      order = newOrder;
    }
    
    // Create line items with new schema
    if (input.lineItems.length > 0) {
      const lineItemsData = input.lineItems.map((item) => ({
        order_id: order.id,
        component_id: null,
        item_name: item.componentName,
        entry_mode: item.entryMode,
        quantity: item.entryMode === 'single' ? (item.quantity || 0) : 0,
        unit: item.entryMode === 'single' ? (item.unit || '') : null,
        lengths: item.entryMode === 'multiple' ? item.lengths : null,
        length_unit: item.entryMode === 'multiple' ? item.lengthUnit : null,
        flashing_id: item.flashingId || null,
        flashing_image_url: item.flashingImageUrl || null,
        item_notes: item.notes || null,
        show_component_name: item.showComponentName,
        show_flashing_image: item.showFlashingImage,
        show_measurements: item.showMeasurements,
        sort_order: item.sortOrder,
      }));
      
      const { error: linesError } = await supabase
        .from('material_order_lines')
        .insert(lineItemsData);
      
      if (linesError) {
        console.error('[saveDraftOrder] Line items insert error:', linesError);
        throw new Error('Failed to save order items');
      }
    }
    
    revalidatePath(`/[workspaceSlug]/material-orders`, 'page');
    
    return { 
      success: true, 
      orderId: order.id,
      orderNumber: order.order_number 
    };
  } catch (error) {
    console.error('[saveDraftOrder] Error:', error);
    throw error;
  }
}
