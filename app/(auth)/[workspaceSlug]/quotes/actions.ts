'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
import type { InputMode, WasteType, PitchType } from '@/app/lib/types';

export async function createQuoteFromTemplate(templateId: string, customerName: string, jobReference?: string | null) {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data: quote, error: qErr } = await supabase.from('quotes').insert({
    company_id: profile.company_id, 
    template_id: templateId, 
    customer_name: customerName,
    job_name: jobReference || null,
    tax_rate: company.default_tax_rate ?? 0, 
    measurement_system: company.default_measurement_system,
    created_by_user_id: profile.id,
  }).select().single();
  if (qErr || !quote) throw new Error(qErr?.message || 'Failed to create quote');
  const { data: templateAreas } = await supabase.from('template_roof_areas').select('*').eq('template_id', templateId).order('sort_order');
  const areaMapping: Record<string, string> = {};
  if (templateAreas?.length) {
    for (const ta of templateAreas) {
      const { data: qa } = await supabase.from('quote_roof_areas').insert({
        quote_id: quote.id, template_roof_area_id: ta.id, label: ta.label,
        input_mode: ta.default_input_mode || 'calculated', sort_order: ta.sort_order,
      }).select('id').single();
      if (qa) areaMapping[ta.id] = qa.id;
    }
  }
  const { data: templateComps } = await supabase.from('template_components').select('*, component_library(*)').eq('template_id', templateId).eq('is_included_by_default', true).order('sort_order');
  if (templateComps?.length) {
    const quoteComponents = templateComps.map(tc => {
      const lib = tc.component_library;
      return {
        quote_id: quote.id, quote_roof_area_id: tc.template_roof_area_id ? (areaMapping[tc.template_roof_area_id] ?? null) : null,
        component_library_id: tc.component_library_id, template_component_id: tc.id, name: lib.name,
        component_type: tc.component_type, measurement_type: lib.measurement_type, input_mode: 'calculated' as InputMode,
        waste_type: (tc.override_waste_type ?? lib.default_waste_type) as WasteType,
        waste_percent: tc.override_waste_percent ?? lib.default_waste_percent ?? 0,
        waste_fixed: tc.override_waste_fixed ?? lib.default_waste_fixed ?? 0,
        pitch_type: (tc.override_pitch_type ?? lib.default_pitch_type ?? 'none') as PitchType,
        material_rate: tc.override_material_rate ?? lib.default_material_rate ?? 0,
        labour_rate: tc.override_labour_rate ?? lib.default_labour_rate ?? 0, sort_order: tc.sort_order,
      };
    });
    await supabase.from('quote_components').insert(quoteComponents);
  }
  redirect(`/${company.slug}/quotes/${quote.id}`);
}

export async function createBlankQuote(customerName: string, jobReference?: string | null) {
  const { profile, company } = await loadCompanyContext();
  console.log('createBlankQuote - company.default_measurement_system:', company.default_measurement_system);
  const supabase = await createSupabaseServerClient();
  const { data: quote, error } = await supabase.from('quotes').insert({
    company_id: profile.company_id, 
    customer_name: customerName,
    job_name: jobReference || null,
    tax_rate: company.default_tax_rate ?? 0, 
    measurement_system: company.default_measurement_system,
    created_by_user_id: profile.id,
  }).select().single();
  console.log('createBlankQuote - created quote measurement_system:', quote?.measurement_system);
  if (error || !quote) throw new Error(error?.message || 'Failed to create quote');
  redirect(`/${company.slug}/quotes/${quote.id}`);
}

export async function loadQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).eq('company_id', profile.company_id).single();
  if (error || !data) throw new Error(error?.message || 'Quote not found');
  return data;
}

export async function loadQuoteRoofAreas(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quote_roof_areas').select('*').eq('quote_id', quoteId).order('sort_order');
  if (error) throw new Error(error.message);
  return data;
}

export async function loadAllRoofAreaEntriesForQuote(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: areas } = await supabase.from('quote_roof_areas').select('id').eq('quote_id', quoteId);
  if (!areas?.length) return {};
  const areaIds = areas.map(a => a.id);
  const { data: entries, error } = await supabase.from('quote_roof_area_entries').select('*').in('quote_roof_area_id', areaIds).order('sort_order');
  if (error) throw new Error(error.message);
  const grouped: Record<string, typeof entries> = {};
  for (const entry of (entries ?? [])) {
    if (!grouped[entry.quote_roof_area_id]) grouped[entry.quote_roof_area_id] = [];
    grouped[entry.quote_roof_area_id].push(entry);
  }
  return grouped;
}

export async function loadQuoteComponents(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quote_components').select('*').eq('quote_id', quoteId).order('sort_order');
  if (error) throw new Error(error.message);
  return data;
}

export async function loadAllEntriesForQuote(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: comps } = await supabase.from('quote_components').select('id').eq('quote_id', quoteId);
  if (!comps?.length) return {};
  const compIds = comps.map(c => c.id);
  const { data: entries, error } = await supabase.from('quote_component_entries').select('*').in('quote_component_id', compIds).order('sort_order');
  if (error) throw new Error(error.message);
  const grouped: Record<string, typeof entries> = {};
  for (const entry of (entries ?? [])) {
    if (!grouped[entry.quote_component_id]) grouped[entry.quote_component_id] = [];
    grouped[entry.quote_component_id].push(entry);
  }
  return grouped;
}

export async function addQuoteRoofArea(quoteId: string, label: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quote_roof_areas').insert({ quote_id: quoteId, label, input_mode: 'calculated', is_locked: false }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addRoofAreaEntry(roofAreaId: string, widthM: number, lengthM: number, pitchDegrees: number) {
  const supabase = await createSupabaseServerClient();
  const planSqm = widthM * lengthM;
  const pf = 1 / Math.cos((pitchDegrees ?? 0) * Math.PI / 180);
  const sqm = planSqm * pf;
  const { data, error } = await supabase.from('quote_roof_area_entries').insert({
    quote_roof_area_id: roofAreaId, width_m: widthM, length_m: lengthM, sqm,
  }).select().single();
  if (error) throw new Error(error.message);
  await recalcAreaFromEntries(roofAreaId);
  return data;
}

export async function removeRoofAreaEntry(entryId: string, roofAreaId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_roof_area_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
  await recalcAreaFromEntries(roofAreaId);
}

async function recalcAreaFromEntries(roofAreaId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: entries } = await supabase.from('quote_roof_area_entries').select('sqm').eq('quote_roof_area_id', roofAreaId);
  const totalSqm = (entries ?? []).reduce((sum, e) => sum + Number(e.sqm), 0);
  await supabase.from('quote_roof_areas').update({ computed_sqm: totalSqm }).eq('id', roofAreaId);
}

export async function updateQuoteRoofArea(id: string, input: any) {
  const supabase = await createSupabaseServerClient();
  if (input.input_mode === 'calculated') {
    let planSqm = input.calc_plan_sqm ?? 0;
    if (!planSqm && input.calc_width_m && input.calc_length_m) planSqm = input.calc_width_m * input.calc_length_m;
    const pf = 1 / Math.cos((input.calc_pitch_degrees ?? 0) * Math.PI / 180);
    input.computed_sqm = planSqm * pf;
  } else if (input.input_mode === 'final') input.computed_sqm = input.final_value_sqm ?? 0;
  const { data, error } = await supabase.from('quote_roof_areas').update(input).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  if (input.calc_pitch_degrees && input.calc_pitch_degrees > 0) {
    const { data: area } = await supabase.from('quote_roof_areas').select('quote_id').eq('id', id).single();
    if (area) {
      const { data: quote } = await supabase.from('quotes').select('global_pitch_degrees').eq('id', area.quote_id).single();
      if (quote && !quote.global_pitch_degrees) {
        await supabase.from('quotes').update({ global_pitch_degrees: input.calc_pitch_degrees }).eq('id', area.quote_id);
      }
    }
  }
  return data;
}

export async function toggleAreaLock(id: string, locked: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_roof_areas').update({ is_locked: locked }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function removeQuoteRoofArea(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_roof_areas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addQuoteComponent(quoteId: string, input: any) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quote_components').insert({
    quote_id: quoteId, quote_roof_area_id: input.quote_roof_area_id ?? null,
    component_library_id: input.component_library_id ?? null, name: input.name,
    component_type: input.component_type, measurement_type: input.measurement_type, input_mode: 'calculated',
    material_rate: input.material_rate ?? 0, labour_rate: input.labour_rate ?? 0,
    waste_type: input.waste_type ?? 'none', waste_percent: input.waste_percent ?? 0, waste_fixed: input.waste_fixed ?? 0,
    pitch_type: input.pitch_type ?? 'none',
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeQuoteComponent(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_components').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateComponentSettings(id: string, updates: { input_mode?: InputMode; quote_roof_area_id?: string | null; use_custom_pitch?: boolean; custom_pitch_degrees?: number | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_components').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function addComponentEntry(quoteComponentId: string, rawValue: number, areaPitch: number | null) {
  const supabase = await createSupabaseServerClient();
  const { data: comp } = await supabase.from('quote_components').select('*').eq('id', quoteComponentId).single();
  if (!comp) throw new Error('Component not found');
  const isPlan = comp.input_mode === 'calculated';
  const pitchDegrees = comp.use_custom_pitch ? (comp.custom_pitch_degrees ?? 0) : (areaPitch ?? 0);
  const { afterWaste } = applyPitchAndWaste(rawValue, isPlan, comp.pitch_type, pitchDegrees, comp.waste_type, comp.waste_percent, comp.waste_fixed);
  const { data: entry, error } = await supabase.from('quote_component_entries').insert({
    quote_component_id: quoteComponentId, raw_value: rawValue, value_after_waste: afterWaste,
  }).select().single();
  if (error) throw new Error(error.message);
  await recalcComponentFromEntries(quoteComponentId);
  return entry;
}

export async function useRoofAreaTotal(quoteComponentId: string, roofAreaSqm: number, areaPitch: number | null) {
  return addComponentEntry(quoteComponentId, roofAreaSqm, areaPitch);
}

export async function removeComponentEntry(entryId: string, quoteComponentId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quote_component_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
  await recalcComponentFromEntries(quoteComponentId);
}

async function recalcComponentFromEntries(quoteComponentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: entries } = await supabase.from('quote_component_entries').select('value_after_waste').eq('quote_component_id', quoteComponentId);
  const totalQty = (entries ?? []).reduce((sum, e) => sum + Number(e.value_after_waste), 0);
  const { data: comp } = await supabase.from('quote_components').select('material_rate, labour_rate').eq('id', quoteComponentId).single();
  const materialCost = totalQty * (comp?.material_rate ?? 0);
  const labourCost = totalQty * (comp?.labour_rate ?? 0);
  await supabase.from('quote_components').update({ final_quantity: totalQty, material_cost: materialCost, labour_cost: labourCost }).eq('id', quoteComponentId);
}

export async function updateQuoteSettings(quoteId: string, input: any) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('quotes').update(input).eq('id', quoteId).eq('company_id', profile.company_id);
  if (error) throw new Error(error.message);
}

export async function confirmQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Check if quote already has a number (prevent reassignment)
  const { data: existing } = await supabase
    .from('quotes')
    .select('quote_number, status')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();
    
  if (!existing) throw new Error('Quote not found');
  if (existing.status !== 'draft') throw new Error('Only draft quotes can be confirmed');
  
  // Get next quote number if not already assigned
  let quoteNumber = existing.quote_number;
  if (!quoteNumber) {
    const { data: numberData, error: numError } = await supabase.rpc('get_next_quote_number', {
      p_company_id: profile.company_id
    });
    if (numError) throw new Error(`Failed to generate quote number: ${numError.message}`);
    quoteNumber = numberData;
  }
  
  // Update quote with confirmed status and number
  const { error } = await supabase
    .from('quotes')
    .update({ 
      status: 'confirmed',
      quote_number: quoteNumber
    })
    .eq('id', id)
    .eq('company_id', profile.company_id);
    
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function confirmQuoteAndRedirect(id: string, workspaceSlug: string) {
  'use server';
  await confirmQuote(id);
  const { redirect } = await import('next/navigation');
  redirect(`/${workspaceSlug}/quotes/${id}/summary`);
}

export async function convertQuoteMeasurementSystem(id: string, newSystem: 'metric' | 'imperial') {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Verify quote is draft
  const { data: quote } = await supabase.from('quotes').select('status').eq('id', id).eq('company_id', profile.company_id).single();
  if (!quote || quote.status !== 'draft') {
    throw new Error('Only draft quotes can be converted');
  }
  
  const { error } = await supabase.from('quotes')
    .update({ measurement_system: newSystem })
    .eq('id', id)
    .eq('company_id', profile.company_id);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/quotes/${id}`);
}

export async function updateQuoteNames(id: string, customerName: string, jobName: string | null) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('quotes')
    .update({ 
      customer_name: customerName,
      job_name: jobName 
    })
    .eq('id', id)
    .eq('company_id', profile.company_id);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/quotes/${id}`);
}

export async function deleteQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
    
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function cloneQuote(id: string, newCustomerName: string) {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { data: originalQuote } = await supabase.from('quotes').select('*').eq('id', id).eq('company_id', profile.company_id).single();
  if (!originalQuote) throw new Error('Quote not found');

  const { data: newQuote, error: qErr } = await supabase.from('quotes').insert({
    company_id: profile.company_id, template_id: originalQuote.template_id, customer_name: newCustomerName,
    customer_email: originalQuote.customer_email, customer_phone: originalQuote.customer_phone, job_name: originalQuote.job_name,
    site_address: originalQuote.site_address, material_margin_pct: originalQuote.material_margin_pct, labour_margin_pct: originalQuote.labour_margin_pct,
    tax_rate: originalQuote.tax_rate, global_pitch_degrees: originalQuote.global_pitch_degrees, created_by_user_id: profile.id,
  }).select().single();
  if (qErr || !newQuote) throw new Error(qErr?.message || 'Failed to clone quote');

  const { data: areas } = await supabase.from('quote_roof_areas').select('*').eq('quote_id', id).order('sort_order');
  const areaMapping: Record<string, string> = {};
  if (areas?.length) {
    for (const area of areas) {
      const { data: newArea } = await supabase.from('quote_roof_areas').insert({
        quote_id: newQuote.id, template_roof_area_id: area.template_roof_area_id, label: area.label, input_mode: area.input_mode,
        final_value_sqm: area.final_value_sqm, calc_width_m: area.calc_width_m, calc_length_m: area.calc_length_m,
        calc_plan_sqm: area.calc_plan_sqm, calc_pitch_degrees: area.calc_pitch_degrees, computed_sqm: area.computed_sqm,
        is_locked: area.is_locked, sort_order: area.sort_order,
      }).select('id').single();
      if (newArea) areaMapping[area.id] = newArea.id;
    }
  }

  const { data: comps } = await supabase.from('quote_components').select('*').eq('quote_id', id).order('sort_order');
  if (comps?.length) {
    for (const comp of comps) {
      await supabase.from('quote_components').insert({
        quote_id: newQuote.id, quote_roof_area_id: comp.quote_roof_area_id ? (areaMapping[comp.quote_roof_area_id] ?? null) : null,
        component_library_id: comp.component_library_id, template_component_id: comp.template_component_id, name: comp.name,
        component_type: comp.component_type, measurement_type: comp.measurement_type, input_mode: comp.input_mode,
        final_value: comp.final_value, calc_raw_value: comp.calc_raw_value, calc_pitch_degrees: comp.calc_pitch_degrees,
        calc_pitch_factor: comp.calc_pitch_factor, pitch_type: comp.pitch_type, use_custom_pitch: comp.use_custom_pitch,
        custom_pitch_degrees: comp.custom_pitch_degrees, waste_type: comp.waste_type, waste_percent: comp.waste_percent,
        waste_fixed: comp.waste_fixed, final_quantity: comp.final_quantity, pricing_unit: comp.pricing_unit,
        material_rate: comp.material_rate, labour_rate: comp.labour_rate, material_cost: comp.material_cost,
        labour_cost: comp.labour_cost, is_rate_overridden: comp.is_rate_overridden, is_quantity_overridden: comp.is_quantity_overridden,
        is_waste_overridden: comp.is_waste_overridden, is_pitch_overridden: comp.is_pitch_overridden, is_customer_visible: comp.is_customer_visible,
        sort_order: comp.sort_order,
      });
    }
  }

  return newQuote.id;
}

export async function saveCustomerQuoteLines(
  quoteId: string,
  lines: Array<{
    id: string;
    lineType: 'component' | 'custom';
    componentId?: string;
    text: string;
    amount: number;
    showPrice: boolean;
    sortOrder: number;
    isVisible: boolean;
  }>
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Delete existing lines for this quote
  await supabase
    .from('customer_quote_lines')
    .delete()
    .eq('quote_id', quoteId);

  // Insert new lines
  if (lines.length > 0) {
    const insertData = lines.map(line => ({
      quote_id: quoteId,
      line_type: line.lineType,
      quote_component_id: line.componentId || null,
      custom_text: line.text,
      custom_amount: line.amount,
      show_price: line.showPrice,
      sort_order: line.sortOrder,
      is_visible: line.isVisible,
    }));

    const { error } = await supabase
      .from('customer_quote_lines')
      .insert(insertData);

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/quotes/${quoteId}/customer-edit`);
}

export async function loadCustomerQuoteLines(quoteId: string) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Load saved lines
  const { data: lines, error } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  return lines || [];
}

export async function loadCustomerQuoteTemplates() {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load all templates: company-owned + starter template
  const { data: templates, error } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .or(`company_id.eq.${profile.company_id},is_starter_template.eq.true`)
    .order('name');

  if (error) throw new Error(error.message);

  return templates || [];
}

export async function loadCustomerQuoteTemplate(templateId: string) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load template
  const { data: template, error: templateError } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    throw new Error('Template not found');
  }

  // Load template lines
  const { data: lines, error: linesError } = await supabase
    .from('customer_quote_template_lines')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');

  if (linesError) throw new Error(linesError.message);

  return { template, lines: lines || [] };
}

export async function saveCustomerQuoteBranding(
  quoteId: string,
  branding: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    footerText: string;
  }
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Update branding
  const { error } = await supabase
    .from('quotes')
    .update({
      cq_company_name: branding.companyName || null,
      cq_company_address: branding.companyAddress || null,
      cq_company_phone: branding.companyPhone || null,
      cq_company_email: branding.companyEmail || null,
      cq_footer_text: branding.footerText || null,
    })
    .eq('id', quoteId);

  if (error) throw new Error(error.message);
}
