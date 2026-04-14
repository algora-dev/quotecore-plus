'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface SaveOrderInput {
  // Header data
  templateId?: string;
  reference: string;
  toSupplier: string;
  fromCompany: string;
  contactPerson?: string;
  contactDetails?: string;
  orderType?: string;
  colours: string[];
  deliveryDate?: string;
  deliveryAddress?: string;
  orderNotes?: string;
  logoUrl?: string;
  orderDate: string;
  
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
    // Generate order number (simple incrementing - could be improved)
    const orderNumber = `ORD-${Date.now()}`;
    
    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('material_orders')
      .insert({
        company_id: profile.company_id,
        template_id: input.templateId || null,
        order_number: orderNumber,
        job_name: input.reference || 'Untitled Order',
        supplier_name: input.toSupplier,
        supplier_contact: input.contactPerson || null,
        delivery_date: input.deliveryDate ? new Date(input.deliveryDate) : null,
        delivery_address: input.deliveryAddress || null,
        job_colours: input.colours.length > 0 ? input.colours : null,
        header_notes: input.orderNotes || null,
        is_sent: false, // Draft
      })
      .select()
      .single();
    
    if (orderError) {
      console.error('[saveDraftOrder] Order insert error:', orderError);
      throw new Error('Failed to save order');
    }
    
    // Create line items
    if (input.lineItems.length > 0) {
      const lineItemsData = input.lineItems.map((item, index) => ({
        order_id: order.id,
        component_id: null, // Custom order - no component reference
        component_name: item.componentName,
        flashing_id: item.flashingId || null,
        flashing_image_url: item.flashingImageUrl || null,
        quantity: item.entryMode === 'single' ? item.quantity : null,
        unit: item.entryMode === 'single' ? item.unit : null,
        // Store complex data as JSONB
        item_notes: JSON.stringify({
          entryMode: item.entryMode,
          lengths: item.lengths,
          lengthUnit: item.lengthUnit,
          notes: item.notes,
          showComponentName: item.showComponentName,
          showFlashingImage: item.showFlashingImage,
          showMeasurements: item.showMeasurements,
        }),
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
