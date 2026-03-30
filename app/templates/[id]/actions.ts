'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

const TEMPLATE_MODES = ['simple', 'advanced', 'hybrid'] as const;
const MEASUREMENT_TYPES = ['area', 'linear', 'count', 'custom'] as const;

export async function createMeasurementKey(templateId: string, formData: FormData) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const key = String(formData.get('key') || '').trim();
  const label = String(formData.get('label') || '').trim();
  const measurementType = String(formData.get('measurement_type') || 'custom').trim();
  const unitLabel = String(formData.get('unit_label') || '').trim();

  if (!key || !label) {
    throw new Error('Key and label are required.');
  }

  if (!MEASUREMENT_TYPES.includes(measurementType as (typeof MEASUREMENT_TYPES)[number])) {
    throw new Error('Invalid measurement type.');
  }

  const { error } = await supabase
    .from('template_measurement_keys')
    .insert({
      template_id: templateId,
      key,
      label,
      measurement_type: measurementType,
      unit_label: unitLabel || null,
      is_default_key: false,
      sort_order: 0,
      is_active: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}`);
}

export async function updateTemplate(templateId: string, formData: FormData) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const mode = String(formData.get('mode') || 'hybrid').trim();
  const roofingProfile = String(formData.get('roofing_profile') || '').trim();
  const isActive = String(formData.get('is_active') || 'true') === 'true';
  const materialMarginRaw = String(formData.get('material_margin_default_pct') || '').trim();
  const labourMarginRaw = String(formData.get('labour_margin_default_pct') || '').trim();

  if (!name) {
    throw new Error('Template name is required.');
  }

  if (!TEMPLATE_MODES.includes(mode as (typeof TEMPLATE_MODES)[number])) {
    throw new Error('Invalid template mode.');
  }

  const materialMargin = materialMarginRaw === '' ? null : Number(materialMarginRaw);
  const labourMargin = labourMarginRaw === '' ? null : Number(labourMarginRaw);

  const { error } = await supabase
    .from('templates')
    .update({
      name,
      description: description || null,
      mode,
      roofing_profile: roofingProfile || null,
      is_active: isActive,
      material_margin_default_pct: materialMargin,
      labour_margin_default_pct: labourMargin,
    })
    .eq('id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}`);
}

export async function updateMeasurementKey(
  templateId: string,
  measurementId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const key = String(formData.get('key') || '').trim();
  const label = String(formData.get('label') || '').trim();
  const measurementType = String(formData.get('measurement_type') || 'custom').trim();
  const unitLabel = String(formData.get('unit_label') || '').trim();
  const sortOrderRaw = String(formData.get('sort_order') || '0').trim();
  const isActive = String(formData.get('is_active') || 'true') === 'true';

  if (!key || !label) {
    throw new Error('Key and label are required.');
  }

  if (!MEASUREMENT_TYPES.includes(measurementType as (typeof MEASUREMENT_TYPES)[number])) {
    throw new Error('Invalid measurement type.');
  }

  const sortOrder = Number(sortOrderRaw || 0);

  const { error } = await supabase
    .from('template_measurement_keys')
    .update({
      key,
      label,
      measurement_type: measurementType,
      unit_label: unitLabel || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: isActive,
    })
    .eq('id', measurementId)
    .eq('template_id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}`);
}
