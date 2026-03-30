'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function createGlobalExtra(formData: FormData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const itemType = String(formData.get('item_type') || '').trim();
  const pricingUnit = String(formData.get('pricing_unit') || '').trim();
  const baseRate = Number(formData.get('base_rate') || 0);
  const sortOrder = Number(formData.get('sort_order') || 0);
  const isActive = String(formData.get('is_active') || 'true') === 'true';
  const isCustomerVisibleDefault =
    String(formData.get('is_customer_visible_default') || 'true') === 'true';
  const supportsQuoteOverride =
    String(formData.get('supports_quote_override') || 'true') === 'true';
  const includedByDefault =
    String(formData.get('included_by_default') || 'true') === 'true';
  const autoCalculateQuantity =
    String(formData.get('auto_calculate_quantity') || 'true') === 'true';

  if (!name) {
    throw new Error('Extra name is required.');
  }

  if (!['material', 'labour', 'extra', 'reroof', 'allowance'].includes(category)) {
    throw new Error('Invalid category.');
  }

  if (!['area_derived', 'direct_measurement', 'fixed_custom'].includes(itemType)) {
    throw new Error('Invalid item type.');
  }

  const { data, error } = await supabase
    .from('global_extras')
    .insert({
      company_id: profile.company_id,
      name,
      description: description || null,
      category,
      item_type: itemType,
      pricing_unit: pricingUnit || null,
      base_rate: Number.isFinite(baseRate) ? baseRate : 0,
      is_active: isActive,
      is_customer_visible_default: isCustomerVisibleDefault,
      supports_quote_override: supportsQuoteOverride,
      included_by_default: includedByDefault,
      auto_calculate_quantity: autoCalculateQuantity,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create global extra.');
  }

  redirect(`/extras/${data.id}`);
}
