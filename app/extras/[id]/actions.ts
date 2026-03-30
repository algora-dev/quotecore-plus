'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

async function assertExtraOwnership(extraId: string, companyId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('global_extras')
    .select('id')
    .eq('id', extraId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Global extra not found.');
  }
}

export async function updateGlobalExtra(extraId: string, formData: FormData) {
  const profile = await requireCompanyContext();
  await assertExtraOwnership(extraId, profile.company_id);
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

  if (!name) throw new Error('Extra name is required.');
  if (!['material', 'labour', 'extra', 'reroof', 'allowance'].includes(category)) {
    throw new Error('Invalid category.');
  }
  if (!['area_derived', 'direct_measurement', 'fixed_custom'].includes(itemType)) {
    throw new Error('Invalid item type.');
  }

  const { error } = await supabase
    .from('global_extras')
    .update({
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
    .eq('id', extraId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  redirect(`/extras/${extraId}`);
}

export async function saveGlobalExtraAreaConfig(extraId: string, formData: FormData) {
  const profile = await requireCompanyContext();
  await assertExtraOwnership(extraId, profile.company_id);
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

  if (!areaSourceKey) throw new Error('Area source key is required.');
  if (!['cover_width', 'cover_area', 'explicit_area_per_unit'].includes(conversionMode)) {
    throw new Error('Invalid conversion mode.');
  }
  if (!['nearest_1dp', 'nearest_2dp', 'whole_up', 'nearest_tenth_up', 'custom_rule_reserved'].includes(roundingRule)) {
    throw new Error('Invalid rounding rule.');
  }

  const payload = {
    global_extra_id: extraId,
    area_source_key: areaSourceKey,
    conversion_mode: conversionMode,
    effective_cover_width_mm: Number.isFinite(effectiveCoverWidthMm) && effectiveCoverWidthMm > 0 ? effectiveCoverWidthMm : null,
    effective_cover_length_mm: Number.isFinite(effectiveCoverLengthMm) && effectiveCoverLengthMm > 0 ? effectiveCoverLengthMm : null,
    effective_cover_area_m2: Number.isFinite(effectiveCoverAreaM2) && effectiveCoverAreaM2 > 0 ? effectiveCoverAreaM2 : null,
    waste_percent: Number.isFinite(wastePercent) ? wastePercent : 0,
    rounding_rule: roundingRule,
    applies_material_margin: appliesMaterialMargin,
    notes: notes || null,
  };

  const { data: existing, error: existingError } = await supabase
    .from('global_extra_area_configs')
    .select('global_extra_id')
    .eq('global_extra_id', extraId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const result = existing
    ? await supabase.from('global_extra_area_configs').update(payload).eq('global_extra_id', extraId)
    : await supabase.from('global_extra_area_configs').insert(payload);

  if (result.error) throw new Error(result.error.message);

  redirect(`/extras/${extraId}`);
}

export async function saveGlobalExtraDirectConfig(extraId: string, formData: FormData) {
  const profile = await requireCompanyContext();
  await assertExtraOwnership(extraId, profile.company_id);
  const supabase = await createSupabaseServerClient();

  const measurementKey = String(formData.get('measurement_key') || '').trim();
  const inputMeasurementModeDefault = String(formData.get('input_measurement_mode_default') || 'actual_length').trim();
  const pitchAdjustmentType = String(formData.get('pitch_adjustment_type') || 'none').trim();
  const wastePercent = Number(formData.get('waste_percent') || 0);
  const notes = String(formData.get('notes') || '').trim();

  if (!measurementKey) throw new Error('Measurement key is required.');
  if (!['plan_length', 'actual_length', 'plan_area'].includes(inputMeasurementModeDefault)) {
    throw new Error('Invalid input measurement mode.');
  }
  if (!['none', 'rafter_pitch', 'diagonal_pitch'].includes(pitchAdjustmentType)) {
    throw new Error('Invalid pitch adjustment type.');
  }

  const payload = {
    global_extra_id: extraId,
    measurement_key: measurementKey,
    input_measurement_mode_default: inputMeasurementModeDefault,
    pitch_adjustment_type: pitchAdjustmentType,
    waste_percent: Number.isFinite(wastePercent) ? wastePercent : 0,
    default_formula_mode: 'measurement_times_rate',
    notes: notes || null,
  };

  const { data: existing, error: existingError } = await supabase
    .from('global_extra_direct_configs')
    .select('global_extra_id')
    .eq('global_extra_id', extraId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const result = existing
    ? await supabase.from('global_extra_direct_configs').update(payload).eq('global_extra_id', extraId)
    : await supabase.from('global_extra_direct_configs').insert(payload);

  if (result.error) throw new Error(result.error.message);

  redirect(`/extras/${extraId}`);
}

export async function saveGlobalExtraFixedConfig(extraId: string, formData: FormData) {
  const profile = await requireCompanyContext();
  await assertExtraOwnership(extraId, profile.company_id);
  const supabase = await createSupabaseServerClient();

  const quantityDefault = Number(formData.get('quantity_default') || 0);
  const fixedValueDefault = Number(formData.get('fixed_value_default') || 0);
  const allowManualQuantity = String(formData.get('allow_manual_quantity') || 'true') === 'true';
  const allowManualRate = String(formData.get('allow_manual_rate') || 'true') === 'true';
  const notes = String(formData.get('notes') || '').trim();

  const payload = {
    global_extra_id: extraId,
    quantity_default: Number.isFinite(quantityDefault) && quantityDefault > 0 ? quantityDefault : null,
    fixed_value_default: Number.isFinite(fixedValueDefault) && fixedValueDefault > 0 ? fixedValueDefault : null,
    allow_manual_quantity: allowManualQuantity,
    allow_manual_rate: allowManualRate,
    notes: notes || null,
  };

  const { data: existing, error: existingError } = await supabase
    .from('global_extra_fixed_configs')
    .select('global_extra_id')
    .eq('global_extra_id', extraId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const result = existing
    ? await supabase.from('global_extra_fixed_configs').update(payload).eq('global_extra_id', extraId)
    : await supabase.from('global_extra_fixed_configs').insert(payload);

  if (result.error) throw new Error(result.error.message);

  redirect(`/extras/${extraId}`);
}
