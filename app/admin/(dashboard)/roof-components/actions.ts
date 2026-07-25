'use server';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireAdmin } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ComponentKind = 'roof_area' | 'ridge' | 'hip' | 'valley' | 'barge' | 'spouting' | 'custom' | (string & {});

export interface RoofComponent {
  id: string;
  component_kind: ComponentKind;
  name: string;
  description: string | null;
  unit: string;
  price_per_unit: number;
  currency: string;
  pricing_strategy: string;
  pack_size: number | null;
  pack_price: number | null;
  labour_rate: number;
  labour_unit: string;
  suggested_waste_percent: number;
  pitch_type: string;
  is_active: boolean;
  sort_order: number;
}

export async function getRoofComponents(): Promise<RoofComponent[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('free_tool_roof_components')
    .select('*')
    .order('component_kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to load components: ${error.message}`);
  return (data || []) as RoofComponent[];
}

export async function createRoofComponent(formData: FormData) {
  const supabase = createAdminClient();

  const component = {
    component_kind: formData.get('component_kind') as string,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    unit: (formData.get('unit') as string) || 'm',
    price_per_unit: parseFloat((formData.get('price_per_unit') as string) || '0'),
    currency: 'GBP',
    pricing_strategy: (formData.get('pricing_strategy') as string) || 'per_unit',
    pack_size: formData.get('pack_size') ? parseFloat(formData.get('pack_size') as string) : null,
    pack_price: formData.get('pack_price') ? parseFloat(formData.get('pack_price') as string) : null,
    labour_rate: parseFloat((formData.get('labour_rate') as string) || '0'),
    labour_unit: (formData.get('labour_unit') as string) || 'fixed',
    suggested_waste_percent: parseFloat((formData.get('suggested_waste_percent') as string) || '10'),
    pitch_type: (formData.get('pitch_type') as string) || 'none',
    is_active: true,
    sort_order: parseInt((formData.get('sort_order') as string) || '0', 10),
  };

  const { error } = await supabase.from('free_tool_roof_components').insert(component);
  if (error) throw new Error(`Failed to create: ${error.message}`);

  revalidatePath('/admin/roof-components');
  revalidatePath('/free-roofing-takeoff-builder');
}

export async function updateRoofComponent(id: string, formData: FormData) {
  const supabase = createAdminClient();

  const updates = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    unit: (formData.get('unit') as string) || 'm',
    price_per_unit: parseFloat((formData.get('price_per_unit') as string) || '0'),
    pricing_strategy: (formData.get('pricing_strategy') as string) || 'per_unit',
    pack_size: formData.get('pack_size') ? parseFloat(formData.get('pack_size') as string) : null,
    pack_price: formData.get('pack_price') ? parseFloat(formData.get('pack_price') as string) : null,
    labour_rate: parseFloat((formData.get('labour_rate') as string) || '0'),
    labour_unit: (formData.get('labour_unit') as string) || 'fixed',
    suggested_waste_percent: parseFloat((formData.get('suggested_waste_percent') as string) || '10'),
    pitch_type: (formData.get('pitch_type') as string) || 'none',
    sort_order: parseInt((formData.get('sort_order') as string) || '0', 10),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('free_tool_roof_components')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(`Failed to update: ${error.message}`);

  revalidatePath('/admin/roof-components');
  revalidatePath('/free-roofing-takeoff-builder');
}

export async function toggleRoofComponent(id: string, isActive: boolean) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('free_tool_roof_components')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to toggle: ${error.message}`);

  revalidatePath('/admin/roof-components');
  revalidatePath('/free-roofing-takeoff-builder');
}

export async function deleteRoofComponent(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('free_tool_roof_components')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete: ${error.message}`);

  revalidatePath('/admin/roof-components');
  revalidatePath('/free-roofing-takeoff-builder');
}
