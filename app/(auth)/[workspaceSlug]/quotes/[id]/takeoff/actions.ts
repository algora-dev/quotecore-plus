'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { applyPitchAndWaste, rafterPitchFactor } from '@/app/lib/pricing/engine';

interface TakeoffMeasurement {
  componentId: string | null; // null for informational roof areas
  type: 'line' | 'area' | 'point';
  value: number;
  pitch?: number; // Pitch in degrees (for roof areas)
  name?: string; // Name (for roof areas)
  points?: { x: number; y: number }[];
  visible: boolean;
}

export async function saveTakeoffMeasurements(
  quoteId: string,
  measurements: TakeoffMeasurement[],
  unit: string,
  canvasImageUrl?: string,
  linesImageUrl?: string
) {
  const supabase = await createSupabaseServerClient();
  
  // Get company context for ownership check
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();
  
  if (quoteError || !quote) {
    throw new Error('Quote not found');
  }
  
  // Update quote with canvas image URLs if provided
  if (canvasImageUrl || linesImageUrl) {
    const updateData: Record<string, string> = {};
    if (canvasImageUrl) updateData.takeoff_canvas_url = canvasImageUrl;
    if (linesImageUrl) updateData.takeoff_lines_url = linesImageUrl;
    
    console.log('[SaveTakeoff] Saving canvas URLs:', updateData);
    const { error: updateError } = await supabase
      .from('quotes')
      .update(updateData)
      .eq('id', quoteId);
    
    if (updateError) {
      console.error('[SaveTakeoff] Failed to save canvas URLs:', updateError);
    }
  }
  
  // Delete existing measurements for this quote
  await supabase
    .from('quote_takeoff_measurements')
    .delete()
    .eq('quote_id', quoteId);
  
  // Insert new measurements
  if (measurements.length > 0) {
    const records = measurements.map(m => ({
      quote_id: quoteId,
      company_id: quote.company_id,
      component_library_id: m.componentId,
      measurement_type: m.type,
      measurement_value: m.value,
      measurement_unit: unit,
      canvas_points: m.points,
      is_visible: m.visible,
    }));
    
    const { error } = await supabase
      .from('quote_takeoff_measurements')
      .insert(records);
    
    if (error) {
      throw new Error(`Failed to save measurements: ${error.message}`);
    }
    
    // Auto-create roof areas
    const roofAreaMeasurements = measurements.filter(m => !m.componentId && m.type === 'area');
    console.log('[SaveTakeoff] Found roof areas to create:', roofAreaMeasurements.length);
    console.log('[SaveTakeoff] Roof area measurements:', roofAreaMeasurements);
    let firstRoofAreaId: string | null = null;
    
    for (let i = 0; i < roofAreaMeasurements.length; i++) {
      const measurement = roofAreaMeasurements[i];
      const pitchDegrees = measurement.pitch || 0;
      
      // Apply pitch to roof area (rafter factor for area calculations)
      const pitchFactor = pitchDegrees > 0 ? rafterPitchFactor(pitchDegrees) : 1;
      const pitchedArea = measurement.value * pitchFactor;
      
      console.log(`[SaveTakeoff] Creating roof area ${i + 1} - plan: ${measurement.value.toFixed(2)}, pitch: ${pitchDegrees}°, factor: ${pitchFactor.toFixed(3)}, actual: ${pitchedArea.toFixed(2)}`);
      
      const { data: roofArea, error: roofAreaError } = await supabase.from('quote_roof_areas').insert({
        quote_id: quoteId,
        label: measurement.name || `Roof Area ${i + 1}`, // Use user's name or fallback to default
        input_mode: 'final',
        final_value_sqm: pitchedArea, // Store pitched area
        computed_sqm: pitchedArea, // Copy to computed for v1 builder display
        calc_pitch_degrees: pitchDegrees,
        is_locked: true,
      }).select().single();
      
      if (roofAreaError) {
        console.error('[SaveTakeoff] Error creating roof area:', roofAreaError);
      } else {
        console.log('[SaveTakeoff] Created roof area:', roofArea);
      }
      
      if (i === 0 && roofArea) firstRoofAreaId = roofArea.id;
    }
    
    console.log('[SaveTakeoff] First roof area ID:', firstRoofAreaId);
    
    // Auto-populate components linked to first roof area
    const componentIds = [...new Set(measurements.filter(m => m.componentId).map(m => m.componentId!))];
    
    for (const componentId of componentIds) {
      const { data: existing } = await supabase
        .from('quote_components')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('component_library_id', componentId)
        .maybeSingle();
      
      if (existing) continue;
      
      const { data: libComp } = await supabase
        .from('component_library')
        .select('*')
        .eq('id', componentId)
        .single();
      
      if (!libComp) continue;
      
      // Get all measurements for this component
      const componentMeasurements = measurements.filter(m => m.componentId === componentId);
      
      console.log(`[SaveTakeoff] Creating component ${libComp.name} with ${componentMeasurements.length} entries`);
      
      // Create component (without final_value - will be calculated from entries)
      const { data: newComponent, error: compError } = await supabase.from('quote_components').insert({
        quote_id: quoteId,
        quote_roof_area_id: firstRoofAreaId,
        component_library_id: componentId,
        name: libComp.name,
        component_type: 'main',
        measurement_type: 'lineal',
        input_mode: 'calculated',
        material_rate: libComp.default_material_rate || 0,
        labour_rate: libComp.default_labour_rate || 0,
        waste_type: libComp.default_waste_type || 'none',
        waste_percent: libComp.default_waste_percent || 0,
        waste_fixed: libComp.default_waste_fixed || 0,
        pitch_type: libComp.default_pitch_type || 'none',
      }).select().single();
      
      if (compError || !newComponent) {
        console.error('[SaveTakeoff] Error creating component:', compError);
        continue;
      }
      
      // Get roof area pitch for calculations
      const { data: roofAreaData } = await supabase
        .from('quote_roof_areas')
        .select('calc_pitch_degrees')
        .eq('id', firstRoofAreaId)
        .single();
      
      const roofPitch = roofAreaData?.calc_pitch_degrees || 0;
      
      // Create entries with pitch and waste applied
      const entries = componentMeasurements.map((m, index) => {
        const pitchType = libComp.default_pitch_type || 'none';
        const wasteType = libComp.default_waste_type || 'none';
        const wastePercent = libComp.default_waste_percent || 0;
        const wasteFixed = libComp.default_waste_fixed || 0;
        
        // Apply pitch and waste to get final value
        const result = applyPitchAndWaste(
          m.value,
          true, // isPlan (from takeoff)
          pitchType as any,
          roofPitch,
          wasteType as any,
          wastePercent,
          wasteFixed
        );
        
        console.log(`[SaveTakeoff] Entry ${index + 1}: raw=${m.value.toFixed(2)}, pitch=${roofPitch}°, type=${pitchType}, factor=${result.pitchFactorUsed.toFixed(3)}, afterPitch=${result.afterPitch.toFixed(2)}, afterWaste=${result.afterWaste.toFixed(2)}`);
        
        return {
          quote_component_id: newComponent.id,
          raw_value: m.value,
          value_after_waste: result.afterWaste,
          sort_order: index,
        };
      });
      
      const { error: entriesError } = await supabase
        .from('quote_component_entries')
        .insert(entries);
      
      if (entriesError) {
        console.error('[SaveTakeoff] Error creating entries:', entriesError);
      } else {
        console.log(`[SaveTakeoff] Created ${entries.length} entries for ${libComp.name}`);
        
        // Calculate totals and update component
        const totalQuantity = entries.reduce((sum, e) => sum + e.value_after_waste, 0);
        const materialCost = totalQuantity * (libComp.default_material_rate || 0);
        const labourCost = totalQuantity * (libComp.default_labour_rate || 0);
        
        await supabase.from('quote_components').update({
          final_quantity: totalQuantity,
          material_cost: materialCost,
          labour_cost: labourCost,
        }).eq('id', newComponent.id);
        
        console.log(`[SaveTakeoff] Updated component totals: qty=${totalQuantity.toFixed(2)}, mat=$${materialCost.toFixed(2)}, lab=$${labourCost.toFixed(2)}`);
      }
    }
  }
  
  revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  
  return { success: true };
}

export async function loadTakeoffMeasurements(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: measurements, error } = await supabase
    .from('quote_takeoff_measurements')
    .select(`
      *,
      component_library (
        id,
        name
      )
    `)
    .eq('quote_id', quoteId)
    .order('created_at');
  
  if (error) {
    console.error('[loadTakeoffMeasurements] Error:', error);
    return [];
  }
  
  // Group by component and calculate totals
  const grouped = (measurements || []).reduce((acc, m) => {
    const compId = m.component_library_id;
    if (!compId) return acc;
    
    if (!acc[compId]) {
      acc[compId] = {
        componentId: compId,
        componentName: m.component_library?.name || 'Unknown',
        lines: [],
        areas: [],
        points: [],
        totalLength: 0,
        totalArea: 0,
        totalQuantity: 0,
        unit: m.measurement_unit,
      };
    }
    
    if (m.measurement_type === 'line') {
      acc[compId].lines.push(m);
      acc[compId].totalLength += Number(m.measurement_value);
    } else if (m.measurement_type === 'area') {
      acc[compId].areas.push(m);
      acc[compId].totalArea += Number(m.measurement_value);
    } else if (m.measurement_type === 'point') {
      acc[compId].points.push(m);
      acc[compId].totalQuantity += Number(m.measurement_value);
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  return Object.values(grouped);
}
