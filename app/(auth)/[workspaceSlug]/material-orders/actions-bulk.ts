'use server';

/**
 * Bulk operations on material orders (multi-select on the orders list).
 *
 * Mirrors quotes/actions-bulk.ts:
 *   - getMaxBulkBatch(): the shared 25-item cap (client mirrors it for UX).
 *   - loadOrderBundleData(orderId): everything one order's downloadable PDF
 *     needs (header, supplier, lines). Used by the client-side ZIP builder.
 *   - bulkDeleteOrders(ids[]): deletes multiple orders in one round-trip,
 *     reusing the EXACT same ownership-scoped, line-items-first delete that
 *     the single-order deleteOrder() in order-list-actions.ts performs.
 *
 * NB on audit: quotes log bulk actions to `bulk_operations_log`, but that
 * table's `operation` CHECK constraint only allows the quote variants. Adding
 * order/invoice variants would require a DB migration, which is out of scope
 * for this change, so orders intentionally skip the audit log (the per-id
 * ownership filter + 25 cap remain the authoritative safety controls).
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Hard cap on how many orders a single bulk operation can touch. Mirrored on
 * the client (`MAX_BULK_SELECTION` in order-list.tsx). The server check is
 * authoritative; the client cap is only for UX. Matches the quotes cap (25).
 */
const MAX_BULK_BATCH = 25;

export async function getMaxBulkBatch(): Promise<number> {
  return MAX_BULK_BATCH;
}

export interface OrderBundleLine {
  itemName: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  showComponentName: boolean;
  showMeasurements: boolean;
  lengths: unknown;
  lengthUnit: string | null;
}

export interface OrderBundleData {
  /**
   * Everything the REAL on-screen OrderBody component needs to render the
   * order exactly as it appears in the order preview screen. The bulk ZIP
   * builder mounts <OrderBody {...preview} /> off-screen and html2canvas-
   * captures it so the downloaded PDF is a pixel match.
   *
   * These are the same raw shapes OrderBody receives on screen:
   *   order     -> raw `material_orders` row (MaterialOrderRow)
   *   lines     -> raw `material_order_lines` rows (MaterialOrderLineRow[])
   *   flashings -> id/name/image_url for any flashing referenced by a line
   *   currency  -> company default currency (line-by-line price rendering)
   */
  preview: {
    order: Record<string, unknown>;
    lines: Array<Record<string, unknown>>;
    flashings: Array<{ id: string; name: string | null; image_url: string | null }>;
    currency: string;
  };
  order: {
    id: string;
    orderNumber: string;
    reference: string | null;
    jobName: string | null;
    status: string;
    orderType: string | null;
    layoutMode: string | null;
    fromCompany: string | null;
    toSupplier: string | null;
    supplierName: string | null;
    supplierContact: string | null;
    contactPerson: string | null;
    contactDetails: string | null;
    deliveryAddress: string | null;
    deliveryDate: string | null;
    orderDate: string | null;
    colours: string | null;
    jobColours: string[] | null;
    headerNotes: string | null;
    createdAt: string;
  };
  lines: OrderBundleLine[];
}

/**
 * Load everything needed to build one order's downloadable PDF.
 * Returns null if the order doesn't exist or doesn't belong to the caller's company.
 */
export async function loadOrderBundleData(orderId: string): Promise<OrderBundleData | null> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from('material_orders')
    .select('*')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .single();

  if (!order) return null;

  const { data: lineRows } = await supabase
    .from('material_order_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });

  const lineRowsArr = lineRows ?? [];

  // Mirror the order preview page's data load: the company default currency
  // (for line-by-line price rendering) and the flashing library entries any
  // component line references (for the flashing images in the captured PDF).
  const [companyRes, flashingRes] = await Promise.all([
    supabase.from('companies').select('default_currency').eq('id', profile.company_id).single(),
    supabase
      .from('flashing_library')
      .select('id, name, image_url')
      .eq('company_id', profile.company_id),
  ]);
  const previewCurrency: string = companyRes.data?.default_currency ?? 'GBP';
  const previewFlashings = (flashingRes.data ?? []).map((f: any) => ({
    id: f.id as string,
    name: (f.name ?? null) as string | null,
    image_url: (f.image_url ?? null) as string | null,
  }));

  const lines: OrderBundleLine[] = lineRowsArr.map((l) => ({
    itemName: l.item_name,
    quantity: l.quantity,
    unit: l.unit,
    notes: l.item_notes ?? null,
    showComponentName: l.show_component_name !== false,
    showMeasurements: l.show_measurements !== false,
    lengths: l.lengths ?? null,
    lengthUnit: l.length_unit ?? null,
  }));

  return {
    preview: {
      order: order as Record<string, unknown>,
      lines: lineRowsArr as Array<Record<string, unknown>>,
      flashings: previewFlashings,
      currency: previewCurrency,
    },
    order: {
      id: order.id,
      orderNumber: order.order_number,
      reference: order.reference ?? null,
      jobName: order.job_name ?? null,
      status: order.status,
      orderType: order.order_type ?? null,
      layoutMode: order.layout_mode ?? null,
      fromCompany: order.from_company ?? null,
      toSupplier: order.to_supplier ?? null,
      supplierName: order.supplier_name ?? null,
      supplierContact: order.supplier_contact ?? null,
      contactPerson: order.contact_person ?? null,
      contactDetails: order.contact_details ?? null,
      deliveryAddress: order.delivery_address ?? null,
      deliveryDate: order.delivery_date ?? null,
      orderDate: order.order_date ?? null,
      colours: order.colours ?? null,
      jobColours: order.job_colours ?? null,
      headerNotes: order.header_notes ?? null,
      createdAt: order.created_at,
    },
    lines,
  };
}

/**
 * Delete multiple orders in one call. Each id is verified against the caller's
 * company_id before any destructive action; unknown / cross-company ids are
 * silently skipped (we still report a count back so the UI knows what happened).
 *
 * Mirrors the single-order delete (deleteOrder in order-list-actions.ts):
 * line items are removed first (FK), then the order rows. Orders have no
 * delete-vs-status rule (any order can be deleted), so there is no per-status
 * skipping here - only ownership filtering.
 */
export async function bulkDeleteOrders(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const profile = await requireCompanyContext();
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0, skipped: 0 };

  // Authoritative server-side cap.
  if (ids.length > MAX_BULK_BATCH) {
    throw new Error(`Too many orders selected: ${ids.length}. The limit is ${MAX_BULK_BATCH} per batch.`);
  }

  // De-dupe in case the client somehow sent duplicates.
  ids = Array.from(new Set(ids));

  const supabase = await createSupabaseServerClient();

  // Filter to orders actually owned by this company.
  const { data: ownedOrders } = await supabase
    .from('material_orders')
    .select('id')
    .in('id', ids)
    .eq('company_id', profile.company_id);

  const ownedIds = (ownedOrders ?? []).map((o) => o.id as string);
  const skipped = ids.length - ownedIds.length;
  if (ownedIds.length === 0) {
    return { deleted: 0, skipped };
  }

  // Delete line items first (foreign key), same as the single-order delete.
  const { error: lineErr } = await supabase
    .from('material_order_lines')
    .delete()
    .in('order_id', ownedIds);
  if (lineErr) {
    console.warn('[bulkDeleteOrders] line delete warning:', lineErr.message);
  }

  // Delete the order rows (company-scoped, never across companies).
  const { error: deleteErr } = await supabase
    .from('material_orders')
    .delete()
    .in('id', ownedIds)
    .eq('company_id', profile.company_id);

  if (deleteErr) {
    throw new Error(`Failed to delete orders: ${deleteErr.message}`);
  }

  revalidatePath('/');

  return { deleted: ownedIds.length, skipped };
}
