import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verify a quote belongs to the given company.
 * Throws if not found or unauthorized.
 */
export async function verifyQuoteOwnership(
  supabase: SupabaseClient,
  quoteId: string,
  companyId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (error || !data) {
    throw new Error('Quote not found');
  }
  if (data.company_id !== companyId) {
    throw new Error('Unauthorized');
  }
}

/**
 * Verify a roof area belongs to the given company (via its parent quote).
 */
export async function verifyRoofAreaOwnership(
  supabase: SupabaseClient,
  areaId: string,
  companyId: string
): Promise<void> {
  const { data: area, error } = await supabase
    .from('quote_roof_areas')
    .select('quote_id')
    .eq('id', areaId)
    .single();

  if (error || !area) {
    throw new Error('Roof area not found');
  }
  await verifyQuoteOwnership(supabase, area.quote_id, companyId);
}

/**
 * Verify a component belongs to the given company (via its parent quote).
 */
export async function verifyComponentOwnership(
  supabase: SupabaseClient,
  componentId: string,
  companyId: string
): Promise<void> {
  const { data: comp, error } = await supabase
    .from('quote_components')
    .select('quote_id')
    .eq('id', componentId)
    .single();

  if (error || !comp) {
    throw new Error('Component not found');
  }
  await verifyQuoteOwnership(supabase, comp.quote_id, companyId);
}

/**
 * Verify a material order belongs to the given company.
 */
export async function verifyOrderOwnership(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('material_orders')
    .select('company_id')
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw new Error('Order not found');
  }
  if (data.company_id !== companyId) {
    throw new Error('Unauthorized');
  }
}

/**
 * Verify a component library item belongs to the given company.
 */
export async function verifyLibraryComponentOwnership(
  supabase: SupabaseClient,
  componentId: string,
  companyId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('component_library')
    .select('company_id')
    .eq('id', componentId)
    .single();

  if (error || !data) {
    throw new Error('Component not found');
  }
  if (data.company_id !== companyId) {
    throw new Error('Unauthorized');
  }
}
