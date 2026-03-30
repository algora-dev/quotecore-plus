'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../lib/supabase/server';

const ITEM_CATEGORIES = ['material', 'labour', 'extra', 'reroof', 'allowance'] as const;
const ITEM_TYPES = ['area_derived', 'direct_measurement', 'fixed_custom'] as const;

export async function createTemplateItem(
  templateId: string,
  groupId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const itemType = String(formData.get('item_type') || '').trim();
  const pricingUnit = String(formData.get('pricing_unit') || '').trim();
  const baseRate = Number(formData.get('base_rate') || 0);

  if (!name) {
    throw new Error('Item name is required.');
  }

  if (!ITEM_CATEGORIES.includes(category as (typeof ITEM_CATEGORIES)[number])) {
    throw new Error('Invalid category.');
  }

  if (!ITEM_TYPES.includes(itemType as (typeof ITEM_TYPES)[number])) {
    throw new Error('Invalid item type.');
  }

  const { data, error } = await supabase
    .from('template_items')
    .insert({
      template_id: templateId,
      group_id: groupId,
      name,
      category,
      item_type: itemType,
      pricing_unit: pricingUnit || null,
      base_rate: Number.isFinite(baseRate) ? baseRate : 0,
      is_customer_visible_default: true,
      supports_quote_override: true,
      included_by_default: true,
      auto_calculate_quantity: true,
      sort_order: 0,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create item.');
  }

  redirect(`/templates/${templateId}/items/${data.id}`);
}
