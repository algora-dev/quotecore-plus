'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface TakeoffMeasurement {
  componentId: string | null; // null for informational roof areas
  type: 'line' | 'area' | 'point';
  value: number;
  points?: { x: number; y: number }[];
  visible: boolean;
}

export async function saveTakeoffMeasurements(
  quoteId: string,
  measurements: TakeoffMeasurement[],
  unit: string
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
