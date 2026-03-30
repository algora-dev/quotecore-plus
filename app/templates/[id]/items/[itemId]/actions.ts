'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../../lib/supabase/server';

const ITEM_CATEGORIES = ['material', 'labour', 'extra', 'reroof', 'allowance'] as const;
const ITEM_TYPES = ['area_derived', 'direct_measurement', 'fixed_custom'] as const;
const ROUNDING_RULES = [
  'nearest_1dp',
  'nearest_2dp',
  'whole_up',
  'nearest_tenth_up',
  'custom_rule_reserved',
] as const;
const CONVERSION_MODES = ['cover_width', 'cover_area', 'explicit_area_per_unit'] as const;
const INPUT_MEASUREMENT_MODES = ['plan_length', 'actual_length', 'plan_area'] as const;
const PITCH_ADJUSTMENT_TYPES = ['none', 'rafter_pitch', 'diagonal_pitch'] as const;

export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const groupId = String(formData.get('group_id') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const itemType = String(formData.get('item_type') || '').trim();
  const pricingUnit = String(formData.get('pricing_unit') || '').trim();
  const baseRateRaw = String(formData.get('base_rate') || '').trim();
  const sortOrderRaw = String(formData.get('sort_order') || '0').trim();
  const isActive = String(formData.get('is_active') || 'true') === 'true';
  const isCustomerVisibleDefault =
    String(formData.get('is_customer_visible_default') || 'true') === 'true';
  const supportsQuoteOverride =
    String(formData.get('supports_quote_override') || 'true') === 'true';
  const includedByDefault = String(formData.get('included_by_default') || 'true') === 'true';
  const autoCalculateQuantity =
    String(formData.get('auto_calculate_quantity') || 'true') === 'true';

  if (!name) {
    throw new Error('Item name is required.');
  }

  if (!ITEM_CATEGORIES.includes(category as (typeof ITEM_CATEGORIES)[number])) {
    throw new Error('Invalid category.');
  }

  if (!ITEM_TYPES.includes(itemType as (typeof ITEM_TYPES)[number])) {
    throw new Error('Invalid item type.');
  }

  const baseRate = baseRateRaw === '' ? null : Number(baseRateRaw);
  const sortOrder = Number(sortOrderRaw || 0);

  const { error } = await supabase
    .from('template_items')
    .update({
      group_id: groupId || null,
      name,
      category,
      item_type: itemType,
      pricing_unit: pricingUnit || null,
      base_rate: baseRate,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: isActive,
      is_customer_visible_default: isCustomerVisibleDefault,
      supports_quote_override: supportsQuoteOverride,
      included_by_default: includedByDefault,
      auto_calculate_quantity: autoCalculateQuantity,
    })
    .eq('id', itemId)
    .eq('template_id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}/items/${itemId}`);
}

export async function saveAreaConfig(
  templateId: string,
  itemId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const areaSourceKey = String(formData.get('area_source_key') || '').trim();
  const conversionMode = String(formData.get('conversion_mode') || '').trim();
  const effectiveCoverWidthMm = Number(formData.get('effective_cover_width_mm') || 0);
  const effectiveCoverLengthMm = Number(formData.get('effective_cover_length_mm') || 0);
  const effectiveCoverAreaM2 = Number(formData.get('effective_cover_area_m2') || 0);
  const wastePercent = Number(formData.get('waste_percent') || 0);
  const roundingRule = String(formData.get('rounding_rule') || '').trim();
  const appliesMaterialMargin =
    String(formData.get('applies_material_margin') || 'true') === 'true';
  const notes = String(formData.get('notes') || '').trim();

  if (!areaSourceKey) {
    throw new Error('Area source key is required.');
  }

  if (!CONVERSION_MODES.includes(conversionMode as (typeof CONVERSION_MODES)[number])) {
    throw new Error('Invalid conversion mode.');
  }

  if (!ROUNDING_RULES.includes(roundingRule as (typeof ROUNDING_RULES)[number])) {
    throw new Error('Invalid rounding rule.');
  }

  const payload = {
    template_item_id: itemId,
    area_source_key: areaSourceKey,
    conversion_mode: conversionMode,
    effective_cover_width_mm:
      Number.isFinite(effectiveCoverWidthMm) && effectiveCoverWidthMm > 0
        ? effectiveCoverWidthMm
        : null,
    effective_cover_length_mm:
      Number.isFinite(effectiveCoverLengthMm) && effectiveCoverLengthMm > 0
        ? effectiveCoverLengthMm
        : null,
    effective_cover_area_m2:
      Number.isFinite(effectiveCoverAreaM2) && effectiveCoverAreaM2 > 0
        ? effectiveCoverAreaM2
        : null,
    waste_percent: Number.isFinite(wastePercent) ? wastePercent : 0,
    rounding_rule: roundingRule,
    applies_material_margin: appliesMaterialMargin,
    notes: notes || null,
  };

  const { data: existing } = await supabase
    .from('template_area_configs')
    .select('template_item_id')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('template_area_configs')
      .update(payload)
      .eq('template_item_id', itemId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('template_area_configs').insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }

  redirect(`/templates/${templateId}/items/${itemId}`);
}

export async function saveDirectConfig(
  templateId: string,
  itemId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const measurementKey = String(formData.get('measurement_key') || '').trim();
  const inputMeasurementModeDefault = String(
    formData.get('input_measurement_mode_default') || 'actual_length'
  ).trim();
  const pitchAdjustmentType = String(
    formData.get('pitch_adjustment_type') || 'none'
  ).trim();
  const wastePercent = Number(formData.get('waste_percent') || 0);
  const notes = String(formData.get('notes') || '').trim();

  if (!measurementKey) {
    throw new Error('Measurement key is required.');
  }

  if (
    !INPUT_MEASUREMENT_MODES.includes(
      inputMeasurementModeDefault as (typeof INPUT_MEASUREMENT_MODES)[number]
    )
  ) {
    throw new Error('Invalid input measurement mode.');
  }

  if (
    !PITCH_ADJUSTMENT_TYPES.includes(
      pitchAdjustmentType as (typeof PITCH_ADJUSTMENT_TYPES)[number]
    )
  ) {
    throw new Error('Invalid pitch adjustment type.');
  }

  const payload = {
    template_item_id: itemId,
    measurement_key: measurementKey,
    input_measurement_mode_default: inputMeasurementModeDefault,
    pitch_adjustment_type: pitchAdjustmentType,
    waste_percent: Number.isFinite(wastePercent) ? wastePercent : 0,
    default_formula_mode: 'measurement_times_rate',
    notes: notes || null,
  };

  const { data: existing } = await supabase
    .from('template_direct_configs')
    .select('template_item_id')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('template_direct_configs')
      .update(payload)
      .eq('template_item_id', itemId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('template_direct_configs').insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }

  redirect(`/templates/${templateId}/items/${itemId}`);
}

export async function saveFixedConfig(
  templateId: string,
  itemId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const quantityDefaultRaw = String(formData.get('quantity_default') || '').trim();
  const fixedValueDefaultRaw = String(formData.get('fixed_value_default') || '').trim();
  const allowManualQuantity =
    String(formData.get('allow_manual_quantity') || 'true') === 'true';
  const allowManualRate = String(formData.get('allow_manual_rate') || 'true') === 'true';
  const notes = String(formData.get('notes') || '').trim();

  const payload = {
    template_item_id: itemId,
    quantity_default: quantityDefaultRaw === '' ? null : Number(quantityDefaultRaw),
    fixed_value_default: fixedValueDefaultRaw === '' ? null : Number(fixedValueDefaultRaw),
    allow_manual_quantity: allowManualQuantity,
    allow_manual_rate: allowManualRate,
    notes: notes || null,
  };

  const { data: existing } = await supabase
    .from('template_fixed_configs')
    .select('template_item_id')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('template_fixed_configs')
      .update(payload)
      .eq('template_item_id', itemId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('template_fixed_configs').insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }

  redirect(`/templates/${templateId}/items/${itemId}`);
}
