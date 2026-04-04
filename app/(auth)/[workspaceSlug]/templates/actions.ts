'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface TemplateData {
  name: string;
  description: string;
  roofingProfile: string;
  components: { libraryId: string; type: 'main' | 'extra' }[];
  extras: { libraryId: string; type: 'main' | 'extra' }[];
  customerTemplateId: string;
  notes: string;
}

export async function createTemplate(data: TemplateData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Create template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .insert({
      company_id: profile.company_id,
      name: data.name,
      description: data.description || null,
      roofing_profile: data.roofingProfile || null,
      customer_template_id: data.customerTemplateId || null,
      notes: data.notes || null,
      is_active: true,
    })
    .select()
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message || 'Failed to create template');
  }

  // Create a default roof area for main components
  const { data: roofArea, error: roofAreaError } = await supabase
    .from('template_roof_areas')
    .insert({
      template_id: template.id,
      label: 'Main Roof',
      default_input_mode: 'calculated',
      sort_order: 1,
    })
    .select()
    .single();

  if (roofAreaError || !roofArea) {
    throw new Error('Failed to create roof area');
  }

  // Add components
  const allComponents = [
    ...data.components.map((c, idx) => ({
      template_id: template.id,
      component_library_id: c.libraryId,
      template_roof_area_id: roofArea.id, // Main components go to roof area
      component_type: 'main' as const,
      is_included_by_default: true,
      sort_order: idx + 1,
    })),
    ...data.extras.map((e, idx) => ({
      template_id: template.id,
      component_library_id: e.libraryId,
      template_roof_area_id: null, // Extras are not tied to roof area
      component_type: 'extra' as const,
      is_included_by_default: false,
      sort_order: data.components.length + idx + 1,
    })),
  ];

  if (allComponents.length > 0) {
    const { error: componentsError } = await supabase
      .from('template_components')
      .insert(allComponents);

    if (componentsError) {
      throw new Error('Failed to add components to template');
    }
  }

  revalidatePath('/templates');
  return template.id;
}

export async function updateTemplate(templateId: string, data: TemplateData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify ownership
  const { data: template } = await supabase
    .from('templates')
    .select('company_id')
    .eq('id', templateId)
    .single();

  if (!template || template.company_id !== profile.company_id) {
    throw new Error('Unauthorized');
  }

  // Update template
  const { error: updateError } = await supabase
    .from('templates')
    .update({
      name: data.name,
      description: data.description || null,
      roofing_profile: data.roofingProfile || null,
      customer_template_id: data.customerTemplateId || null,
      notes: data.notes || null,
    })
    .eq('id', templateId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Delete existing components
  await supabase
    .from('template_components')
    .delete()
    .eq('template_id', templateId);

  // Get or create roof area
  let { data: roofAreas } = await supabase
    .from('template_roof_areas')
    .select('id')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
    .limit(1);

  let roofAreaId: string;
  if (!roofAreas || roofAreas.length === 0) {
    const { data: newArea, error } = await supabase
      .from('template_roof_areas')
      .insert({
        template_id: templateId,
        label: 'Main Roof',
        default_input_mode: 'calculated',
        sort_order: 1,
      })
      .select('id')
      .single();

    if (error || !newArea) {
      throw new Error('Failed to create roof area');
    }
    roofAreaId = newArea.id;
  } else {
    roofAreaId = roofAreas[0].id;
  }

  // Re-add components
  const allComponents = [
    ...data.components.map((c, idx) => ({
      template_id: templateId,
      component_library_id: c.libraryId,
      template_roof_area_id: roofAreaId,
      component_type: 'main' as const,
      is_included_by_default: true,
      sort_order: idx + 1,
    })),
    ...data.extras.map((e, idx) => ({
      template_id: templateId,
      component_library_id: e.libraryId,
      template_roof_area_id: null,
      component_type: 'extra' as const,
      is_included_by_default: false,
      sort_order: data.components.length + idx + 1,
    })),
  ];

  if (allComponents.length > 0) {
    const { error: componentsError } = await supabase
      .from('template_components')
      .insert(allComponents);

    if (componentsError) {
      throw new Error('Failed to update components');
    }
  }

  revalidatePath('/templates');
  return templateId;
}

export async function loadTemplate(templateId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from('templates')
    .select(`
      *,
      template_components (
        id,
        component_library_id,
        component_type,
        template_roof_area_id,
        sort_order,
        component_library:component_library_id (
          id,
          name,
          component_type
        )
      )
    `)
    .eq('id', templateId)
    .eq('company_id', profile.company_id)
    .single();

  if (error || !template) {
    throw new Error('Template not found');
  }

  return template;
}

export async function deleteTemplate(templateId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify ownership
  const { data: template } = await supabase
    .from('templates')
    .select('company_id')
    .eq('id', templateId)
    .single();

  if (!template || template.company_id !== profile.company_id) {
    throw new Error('Unauthorized');
  }

  // Delete template (cascade will delete components and roof areas)
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/templates');
}

export async function deleteCustomerQuoteTemplate(templateId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify ownership and not starter template
  const { data: template } = await supabase
    .from('customer_quote_templates')
    .select('company_id, is_starter_template')
    .eq('id', templateId)
    .single();

  if (!template || template.company_id !== profile.company_id) {
    throw new Error('Unauthorized');
  }

  if (template.is_starter_template) {
    throw new Error('Cannot delete starter template');
  }

  // Delete template
  const { error } = await supabase
    .from('customer_quote_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/templates');
}
