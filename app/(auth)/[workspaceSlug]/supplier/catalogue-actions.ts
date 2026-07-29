'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  requireComponentSlot,
  ComponentLimitReachedError,
  SubscriptionInactiveError,
  isBillingError,
} from '@/app/lib/billing/entitlements';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminAny = any;

export type CatalogueRow = {
  sku: string;
  name: string;
  price: number;
  product_type: string;
  notes: string;
};

export type CatalogueImportResult = {
  ok: boolean;
  created: number;
  errors: string[];
};

/**
 * Parse CSV text into CatalogueRow[].
 * Expected format: header row with columns SKU, Name, Price, Product Type, Notes
 * (case-insensitive, order doesn't matter). Comma-separated. Quotes supported.
 */
export async function parseCatalogueCSV(csvText: string): Promise<{ rows: CatalogueRow[]; errors: string[] }> {
  const errors: string[] = [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], errors: ['Need at least a header row and one data row.'] };
  }

  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const colMap: Record<string, number> = {};
  header.forEach((h, i) => {
    if (h === 'sku' || h === 'code') colMap.sku = i;
    else if (h === 'name' || h === 'product' || h === 'product name') colMap.name = i;
    else if (h === 'price' || h === 'cost' || h === 'rate') colMap.price = i;
    else if (h === 'product type' || h === 'type' || h === 'category' || h === 'takeoff_slot' || h === 'slot') colMap.product_type = i;
    else if (h === 'notes' || h === 'description') colMap.notes = i;
  });

  if (colMap.name === undefined) {
    errors.push('Missing required column: Name (or "Product", "Product Name").');
  }
  if (colMap.price === undefined) {
    errors.push('Missing required column: Price (or "Cost", "Rate").');
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: CatalogueRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const row: CatalogueRow = {
      sku: colMap.sku !== undefined ? (cols[colMap.sku] ?? '').trim() : '',
      name: (cols[colMap.name] ?? '').trim(),
      price: parseFloat((cols[colMap.price] ?? '0').replace(/[^0-9.\-]/g, '')) || 0,
      product_type: colMap.product_type !== undefined ? (cols[colMap.product_type] ?? '').trim().toLowerCase() : '',
      notes: colMap.notes !== undefined ? (cols[colMap.notes] ?? '').trim() : '',
    };
    if (!row.name) {
      errors.push(`Row ${i + 1}: Missing name, skipped.`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Map a product type string to a takeoff_slot value.
 */
function mapProductType(productType: string): string {
  const pt = productType.toLowerCase().trim();
  if (!pt) return 'custom';
  if (pt.includes('area') || pt.includes('roof') || pt.includes('sheet') || pt.includes('tile') || pt.includes('shingle')) return 'roof_area';
  if (pt.includes('ridge')) return 'ridge';
  if (pt.includes('hip')) return 'hip';
  if (pt.includes('valley')) return 'valley';
  if (pt.includes('barge')) return 'barge';
  if (pt.includes('spout') || pt.includes('gutter')) return 'spouting';
  if (pt.includes('underlay') || pt.includes('underlayment') || pt.includes('membrane')) return 'underlay';
  if (pt.includes('fixing') || pt.includes('screw') || pt.includes('nail') || pt.includes('bolt')) return 'fixings';
  return 'custom';
}

/**
 * Map a product type string to a measurement_type.
 */
function mapMeasurementType(productType: string): string {
  const slot = mapProductType(productType);
  switch (slot) {
    case 'roof_area':
    case 'underlay':
      return 'area';
    case 'ridge':
    case 'hip':
    case 'valley':
    case 'barge':
    case 'spouting':
      return 'linear';
    case 'fixings':
      return 'quantity';
    default:
      return 'quantity';
  }
}

/**
 * Bulk-create components from catalogue rows.
 * Maps the 5 fields (SKU, name, price, product type, notes) to full component_library rows
 * with sensible defaults for all other fields.
 */
export async function importCatalogueComponents(params: {
  targetCollectionId: string;
  rows: CatalogueRow[];
}): Promise<CatalogueImportResult> {
  const { targetCollectionId, rows } = params;

  if (!rows.length) {
    return { ok: false, created: 0, errors: ['No rows to import.'] };
  }

  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, created: 0, errors: ['Authentication required.'] };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Verify target collection belongs to the user's company
  const { data: targetCol } = await supabase
    .from('component_collections')
    .select('id, company_id')
    .eq('id', targetCollectionId)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (!targetCol) {
    return { ok: false, created: 0, errors: ['Target library not found.'] };
  }

  // 2. Check tier limit
  try {
    await requireComponentSlot(profile.company_id);

    if (rows.length > 1) {
      const { loadCompanyEntitlements } = await import('@/app/lib/billing/entitlements');
      const ent = await loadCompanyEntitlements(profile.company_id);
      if (ent.componentLimit !== null && ent.componentCount + rows.length > ent.componentLimit) {
        return {
          ok: false,
          created: 0,
          errors: [`Importing ${rows.length} components would exceed your plan limit (${ent.componentCount}/${ent.componentLimit} on ${ent.effectivePlanCode} plan).`],
        };
      }
    }
  } catch (err) {
    if (err instanceof ComponentLimitReachedError) {
      return { ok: false, created: 0, errors: [`Component limit reached (${err.used}/${err.limit} on ${err.planCode} plan).`] };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, created: 0, errors: ['Subscription inactive.'] };
    }
    if (isBillingError(err)) {
      return { ok: false, created: 0, errors: [err.message] };
    }
    throw err;
  }

  // 3. Get current max sort_order
  const { data: maxSort } = await supabase
    .from('component_library')
    .select('sort_order')
    .eq('company_id', profile.company_id)
    .eq('collection_id', targetCollectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  let nextSort = (maxSort && maxSort.length > 0 ? maxSort[0].sort_order : 0) + 1;

  // 4. Build insert rows
  const insertRows = rows.map(row => {
    const slot = mapProductType(row.product_type);
    const mType = mapMeasurementType(row.product_type);
    return {
      company_id: profile.company_id,
      collection_id: targetCollectionId,
      name: row.name,
      component_type: 'main' as const,
      measurement_type: mType as 'area' | 'linear' | 'quantity' | 'fixed' | 'lineal' | 'length_x_height' | 'volume' | 'hours_days' | 'count' | 'curved_line' | 'irregular_area' | 'multi_lineal' | 'multi_lineal_lxh' | 'volume_3d' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle',
      default_material_rate: row.price,
      default_labour_rate: 0,
      default_waste_type: 'percent' as const,
      default_waste_percent: 0,
      default_waste_fixed: 0,
      default_pitch_type: 'none' as const,
      pack_price: null,
      pack_size: null,
      pack_coverage_m2: null,
      pricing_strategy: 'per_unit' as const,
      waste_unit: 'percent' as const,
      show_price_default: true,
      show_dimensions_default: false,
      eligible_for_orders: false,
      height_value_mm: null,
      depth_value_mm: null,
      notes: row.notes || null,
      sku: row.sku || null,
      takeoff_slot: slot,
      sort_order: nextSort++,
      is_active: true,
      is_system: false,
    };
  });

  // 5. Insert
  const { error: insertError } = await supabase
    .from('component_library')
    .insert(insertRows);

  if (insertError) {
    console.error('[importCatalogueComponents] Insert error:', insertError);
    return { ok: false, created: 0, errors: [insertError.message] };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');
  revalidatePath('/[workspaceSlug]/supplier', 'page');

  return {
    ok: true,
    created: insertRows.length,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// fetchCatalogRowsForConversion - get all rows from a catalogue (following source_catalog_id)
// ---------------------------------------------------------------------------
export type CatalogRowsResult = {
  ok: boolean;
  headers?: string[];
  rows?: Record<string, string>[];
  columnMapping?: Record<string, string | null>;
  name?: string;
  error?: string;
};

export async function fetchCatalogRowsForConversion(catalogId: string, limit = 30000): Promise<CatalogRowsResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, name, headers, column_mapping, company_id, source_catalog_id, status')
      .eq('id', catalogId)
      .maybeSingle();

    if (!catalog) {
      return { ok: false, error: 'Catalogue not found.' };
    }

    // Determine which catalogue to read rows from
    let rowsCatalogId = catalogId;
    if (catalog.source_catalog_id) {
      rowsCatalogId = catalog.source_catalog_id;
    }

    const { data: rows, error } = await admin
      .from('catalog_rows')
      .select('raw_row, row_index')
      .eq('catalog_id', rowsCatalogId)
      .order('row_index', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    return {
      ok: true,
      headers: catalog.headers as string[],
      rows: (rows ?? []).map((r: { raw_row: Record<string, string> }) => r.raw_row),
      columnMapping: catalog.column_mapping as Record<string, string | null>,
      name: catalog.name as string,
    };
  } catch (err) {
    console.error('[fetchCatalogRowsForConversion]', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// convertSelectedRowsToComponents - take selected raw rows + column mapping, create components
// ---------------------------------------------------------------------------
export type ConvertResult = {
  ok: boolean;
  created?: number;
  errors?: string[];
};

export async function convertSelectedRowsToComponents(params: {
  targetCollectionId: string;
  selectedRows: Record<string, string>[];
  columnMapping: Record<string, string[]>;
}): Promise<ConvertResult> {
  const { targetCollectionId, selectedRows, columnMapping } = params;

  if (!selectedRows.length) {
    return { ok: false, errors: ['No rows selected.'] };
  }

  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, errors: ['Authentication required.'] };
  }

  const supabase = await createSupabaseServerClient();

  // Verify target collection
  const { data: targetCol } = await supabase
    .from('component_collections')
    .select('id, company_id')
    .eq('id', targetCollectionId)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (!targetCol) {
    return { ok: false, errors: ['Target library not found.'] };
  }

  // Check tier limit
  try {
    await requireComponentSlot(profile.company_id);
    if (selectedRows.length > 1) {
      const { loadCompanyEntitlements } = await import('@/app/lib/billing/entitlements');
      const ent = await loadCompanyEntitlements(profile.company_id);
      if (ent.componentLimit !== null && ent.componentCount + selectedRows.length > ent.componentLimit) {
        return {
          ok: false,
          errors: [`Importing ${selectedRows.length} components would exceed your plan limit (${ent.componentCount}/${ent.componentLimit} on ${ent.effectivePlanCode} plan).`],
        };
      }
    }
  } catch (err) {
    if (err instanceof ComponentLimitReachedError) {
      return { ok: false, errors: [`Component limit reached (${err.used}/${err.limit} on ${err.planCode} plan).`] };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, errors: ['Subscription inactive.'] };
    }
    if (isBillingError(err)) {
      return { ok: false, errors: [err.message] };
    }
    throw err;
  }

  // Get current max sort_order
  const { data: maxSort } = await supabase
    .from('component_library')
    .select('sort_order')
    .eq('company_id', profile.company_id)
    .eq('collection_id', targetCollectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  let nextSort = (maxSort && maxSort.length > 0 ? maxSort[0].sort_order : 0) + 1;

  // Map columns: columnMapping maps header -> array of field names
  // Build reverse map: field -> header (first header that maps to this field)
  const fieldToHeader: Record<string, string> = {};
  for (const [header, fields] of Object.entries(columnMapping)) {
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (field && !fieldToHeader[field]) {
        fieldToHeader[field] = header;
      }
    }
  }

  const NAME_CHAR_LIMIT = 60;

  // Build insert rows
  const insertRows = selectedRows.map(row => {
    const sku = fieldToHeader.sku ? (row[fieldToHeader.sku] ?? '').trim() : '';
    const fullName = fieldToHeader.name ? (row[fieldToHeader.name] ?? '').trim() : '';
    const name = fullName.substring(0, NAME_CHAR_LIMIT) || 'Unnamed';
    const priceStr = fieldToHeader.price ? (row[fieldToHeader.price] ?? '0') : '0';
    const price = parseFloat(priceStr.replace(/[^0-9.\-]/g, '')) || 0;
    const notes = fieldToHeader.notes ? (row[fieldToHeader.notes] ?? '').trim() : '';

    const slot = mapProductType('');
    const mType = mapMeasurementType('');

    return {
      company_id: profile.company_id,
      collection_id: targetCollectionId,
      name: name || 'Unnamed',
      component_type: 'main' as const,
      measurement_type: mType as 'area' | 'linear' | 'quantity' | 'fixed' | 'lineal' | 'length_x_height' | 'volume' | 'hours_days' | 'count' | 'curved_line' | 'irregular_area' | 'multi_lineal' | 'multi_lineal_lxh' | 'volume_3d' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle',
      default_material_rate: price,
      default_labour_rate: 0,
      default_waste_type: 'percent' as const,
      default_waste_percent: 0,
      default_waste_fixed: 0,
      default_pitch_type: 'none' as const,
      pack_price: null,
      pack_size: null,
      pack_coverage_m2: null,
      pricing_strategy: 'per_unit' as const,
      waste_unit: 'percent' as const,
      show_price_default: true,
      show_dimensions_default: false,
      eligible_for_orders: false,
      height_value_mm: null,
      depth_value_mm: null,
      notes: notes || null,
      sku: sku || null,
      takeoff_slot: slot,
      sort_order: nextSort++,
      is_active: true,
      is_system: false,
    };
  });

  const { error: insertError } = await supabase
    .from('component_library')
    .insert(insertRows);

  if (insertError) {
    console.error('[convertSelectedRowsToComponents] Insert error:', insertError);
    return { ok: false, errors: [insertError.message] };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');
  revalidatePath('/[workspaceSlug]/supplier', 'page');

  return { ok: true, created: insertRows.length, errors: [] };
}
