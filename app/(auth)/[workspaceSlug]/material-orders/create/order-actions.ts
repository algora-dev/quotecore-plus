'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { requireOrderSlot } from '@/app/lib/billing/entitlements';
import { revalidatePath } from 'next/cache';
import type { LineByLineData } from '../lineByLine';
import type { Json } from '@/app/lib/supabase/database.types';

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
  layoutMode: 'single' | 'double' | 'line_by_line';
  /** Line-by-line layout only: the editor's full state (lines + footer +
   *  optional taxes), persisted verbatim to `material_orders.line_by_line_data`
   *  as an envelope object. Ignored for single/double. */
  lineByLineData?: LineByLineData;
  
  // Line items
  lineItems: {
    componentName: string;
    flashingId?: string;
    flashingImageUrl?: string;
    entryMode: 'single' | 'linear' | 'area' | 'volume' | 'multiple';
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
      calcLength?: number;
      calcWidth?: number;
      calcDepth?: number;
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
          delivery_date: input.deliveryDate ? new Date(input.deliveryDate).toISOString() : null,
          delivery_address: input.deliveryAddress || null,
          header_notes: input.orderNotes || null,
          logo_url: input.logoUrl || null,
          order_date: input.orderDate ? new Date(input.orderDate).toISOString() : null,
          layout_mode: input.layoutMode,
          line_by_line_data:
            input.layoutMode === 'line_by_line'
              ? ((input.lineByLineData ?? { lines: [], footer: '', taxes: [] }) as unknown as Json)
              : null,
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
      // Gate ONLY on creation (not edits): feature + monthly order cap
      // (P0012 / P0016). Throws a typed billing error for the UI.
      await requireOrderSlot(profile.company_id);
      // CREATE new order - generate a proper, COLLISION-SAFE order number.
      //
      // Order-from-quote derives ON-<quoteNumber> from the reference, which is
      // deterministic: saving a second order from the SAME quote would produce
      // the same number and hit the unique (company_id, order_number)
      // constraint -> the insert throws -> "Failed to save order". To keep the
      // friendly quote-linked number while staying safe, we suffix duplicates
      // (ON-1015, ON-1015-2, ON-1015-3, ...). Custom orders use the sequential
      // path. We also retry on a unique-violation race (23505) to the next free
      // number, so concurrent saves can't crash either.

      // 1) Preferred base number.
      let baseNumber: string;
      const quoteMatch = input.reference?.match(/Order for (\d+)/);
      if (quoteMatch) {
        // Order-from-quote: link the order to the quote number.
        baseNumber = `ON-${quoteMatch[1]}`;
      } else {
        // Custom order: next sequential number. IMPORTANT: derive it from the
        // numeric MAX across ALL existing ON-<n> numbers for the company, NOT
        // from "the most recently created order". Quote-linked orders
        // (ON-<quoteNumber>) share this same ON- namespace, so keying off the
        // last-created row could land on a quote number (e.g. ON-1015) and
        // compute ON-1016 - which sits BELOW the true custom sequence
        // (ON-001024 already existed) and collides, forcing a spurious "-2"
        // suffix. Taking the max+1 makes the counter monotonic and collision-
        // free regardless of creation order or quote-number magnitudes.
        const { data: allOrders } = await supabase
          .from('material_orders')
          .select('order_number')
          .eq('company_id', profile.company_id)
          .like('order_number', 'ON-%');
        let maxNum = 0;
        for (const row of allOrders ?? []) {
          // Match the leading numeric run only (ignores any "-2" dedupe suffix).
          const m = row.order_number?.match(/^ON-(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n > maxNum) maxNum = n;
          }
        }
        const nextNum = maxNum + 1;
        // One leading zero before the running number, e.g. ON-01234.
        baseNumber = `ON-0${nextNum}`;
      }

      // 2) Find the first free variant of the base (base, base-2, base-3, ...).
      async function firstFreeNumber(base: string): Promise<string> {
        const { data: taken } = await supabase
          .from('material_orders')
          .select('order_number')
          .eq('company_id', profile.company_id)
          .or(`order_number.eq.${base},order_number.like.${base}-%`);
        const used = new Set((taken ?? []).map((r) => r.order_number));
        if (!used.has(base)) return base;
        for (let n = 2; n < 1000; n++) {
          const candidate = `${base}-${n}`;
          if (!used.has(candidate)) return candidate;
        }
        // Extreme fallback: timestamp suffix (effectively never collides).
        return `${base}-${Date.now()}`;
      }

      const buildInsert = (orderNumber: string) => ({
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
        delivery_date: input.deliveryDate ? new Date(input.deliveryDate).toISOString() : null,
        delivery_address: input.deliveryAddress || null,
        header_notes: input.orderNotes || null,
        logo_url: input.logoUrl || null,
        order_date: input.orderDate ? new Date(input.orderDate).toISOString() : null,
        layout_mode: input.layoutMode,
        line_by_line_data:
          input.layoutMode === 'line_by_line'
            ? ((input.lineByLineData ?? { lines: [], footer: '', taxes: [], hideAllPrices: false }) as unknown as Json)
            : null,
        status: 'ready',
      });

      // 3) Insert, retrying on a unique-violation race (23505) up to 5 times.
      let newOrder = null;
      let lastError: unknown = null;
      let candidate = await firstFreeNumber(baseNumber);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error: orderError } = await supabase
          .from('material_orders')
          .insert(buildInsert(candidate))
          .select()
          .single();
        if (!orderError) {
          newOrder = data;
          break;
        }
        lastError = orderError;
        // 23505 = unique_violation (someone took this number between our check
        // and insert). Recompute the next free number and retry.
        if ((orderError as { code?: string }).code === '23505') {
          candidate = await firstFreeNumber(baseNumber);
          continue;
        }
        // Any other error is non-retryable.
        break;
      }

      if (!newOrder) {
        console.error('[saveDraftOrder] Order insert error:', lastError);
        throw new Error('Failed to save order');
      }

      order = newOrder;
    }
    
    // Create line items with new schema.
    // Line-by-line orders store their items in `line_by_line_data` (above),
    // NOT in `material_order_lines`, so skip the relational line insert.
    if (input.layoutMode !== 'line_by_line' && input.lineItems.length > 0) {
      const lineItemsData = input.lineItems.map((item) => ({
        order_id: order.id,
        component_id: null,
        item_name: item.componentName,
        entry_mode: item.entryMode,
        quantity: item.entryMode === 'single' ? (item.quantity || null) : null,
        unit: item.entryMode === 'single' ? (item.unit || null) : null,
        // linear / area / volume (and legacy 'multiple') all store entries in `lengths`.
        lengths: item.entryMode !== 'single' ? item.lengths : null,
        length_unit: item.entryMode !== 'single' ? item.lengthUnit : null,
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
